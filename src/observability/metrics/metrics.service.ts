import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Registro de métricas en formato Prometheus.
 *
 * Se instrumentan los cuatro recorridos que definen que el servicio «funciona»
 * (ver `docs/observability/service-level-objectives.md`), más las señales que
 * un operador necesita para decidir si hay incidencia:
 *
 *  - **RED** de HTTP: peticiones, errores y latencia, por ruta y método.
 *  - **Pool de base de datos**: la saturación que precede a una caída.
 *  - **Outbox**: pendientes, fallidos y —la más valiosa— la antigüedad del
 *    mensaje pendiente más antiguo. Si crece, algo está roto en el worker o en
 *    el proveedor, y lo notarán las personas antes que cualquier tablero.
 */
@Injectable()
export class MetricsService implements OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  readonly registry = new Registry();

  /** Timer del muestreo de métricas que hay que consultar a la base. */
  private pollTimer?: NodeJS.Timeout;

  readonly httpRequests = new Counter({
    name: 'http_requests_total',
    help: 'Peticiones HTTP atendidas.',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });

  readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Latencia de las peticiones HTTP.',
    labelNames: ['method', 'route', 'status'] as const,
    // Cubetas elegidas alrededor de los objetivos declarados: 500 ms en lectura
    // y 1,2 s en escritura. Sin un límite cerca del objetivo, el percentil 95
    // no se puede calcular con precisión útil.
    buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.2, 2, 5, 10],
    registers: [this.registry],
  });

  readonly dbPoolSize = new Gauge({
    name: 'db_pool_connections',
    help: 'Conexiones del pool de PostgreSQL, por estado.',
    labelNames: ['state'] as const,
    registers: [this.registry],
  });

  readonly outboxMessages = new Gauge({
    name: 'outbox_messages',
    help: 'Mensajes del outbox agrupados por estado.',
    labelNames: ['status'] as const,
    registers: [this.registry],
  });

  readonly outboxOldestPendingSeconds = new Gauge({
    name: 'outbox_oldest_pending_seconds',
    help: 'Antigüedad del mensaje pendiente más antiguo del outbox, en segundos.',
    registers: [this.registry],
  });

  readonly outboxPollFailures = new Counter({
    name: 'outbox_metrics_poll_failures_total',
    help: 'Veces que el muestreo de métricas del outbox falló.',
    registers: [this.registry],
  });

  constructor(@InjectConnection() private readonly sequelize: Sequelize) {
    collectDefaultMetrics({ register: this.registry, prefix: 'nodejs_' });
  }

  /**
   * Arranca el muestreo de las métricas que exigen consultar la base.
   *
   * No se calculan en cada raspado: un `/metrics` que dispara consultas a
   * demanda convierte al sistema de monitorización en una fuente de carga, y es
   * justo cuando el servicio va mal cuando más se raspa.
   */
  startPolling(intervalMs: number) {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      void this.sample();
    }, intervalMs);
    // No debe impedir que el proceso termine.
    this.pollTimer.unref?.();
    void this.sample();
  }

  onModuleDestroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  /** Lee de la base los valores de las métricas que no se pueden contar en memoria. */
  private async sample() {
    try {
      const pool = (
        this.sequelize.connectionManager as unknown as { pool?: Record<string, number> }
      ).pool;
      if (pool) {
        this.dbPoolSize.set({ state: 'used' }, Number(pool.used ?? 0));
        this.dbPoolSize.set({ state: 'available' }, Number(pool.available ?? 0));
        this.dbPoolSize.set({ state: 'pending' }, Number(pool.pending ?? 0));
        this.dbPoolSize.set({ state: 'size' }, Number(pool.size ?? 0));
      }

      const rows = await this.sequelize.query<{ estado: string; total: string }>(
        'SELECT estado, count(*)::text AS total FROM mensajeria.mensaje_outbox GROUP BY estado',
        { type: QueryTypes.SELECT },
      );
      this.outboxMessages.reset();
      for (const row of rows as unknown as Array<{ estado: string; total: string }>) {
        this.outboxMessages.set({ status: row.estado }, Number(row.total));
      }

      const ageRows = await this.sequelize.query<{ seconds: string | null }>(
        `SELECT extract(epoch from now() - min(created_at))::text AS seconds
         FROM mensajeria.mensaje_outbox WHERE estado = 'PENDIENTE'`,
        { type: QueryTypes.SELECT },
      );
      const seconds = (ageRows as unknown as Array<{ seconds: string | null }>)[0]?.seconds;
      this.outboxOldestPendingSeconds.set(seconds ? Number(seconds) : 0);
    } catch (error) {
      // Un fallo del muestreo no debe tumbar nada: se cuenta y se sigue. Que
      // este contador suba ya es en sí una señal de que la base no responde.
      this.outboxPollFailures.inc();
      this.logger.warn(`No se pudieron muestrear las métricas: ${String(error)}`);
    }
  }

  metrics() {
    return this.registry.metrics();
  }

  get contentType() {
    return this.registry.contentType;
  }
}
