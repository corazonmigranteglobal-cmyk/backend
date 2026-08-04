import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * Alimenta las métricas RED de HTTP.
 *
 * La etiqueta `route` usa el **patrón** de la ruta (`/api/v1/appointments/:id`),
 * no la URL concreta. Etiquetar con la URL real crearía una serie temporal
 * distinta por cada identificador y haría explotar la cardinalidad del sistema
 * de monitorización, que es la forma más común de tumbar un Prometheus.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { route?: { path?: string } }>();
    const response = http.getResponse<Response>();

    // El propio endpoint de métricas no se mide: sólo añadiría ruido
    // proporcional a la frecuencia de raspado.
    if (request.path === '/metrics') return next.handle();

    const stop = this.metrics.httpDuration.startTimer();

    const record = () => {
      const route = request.route?.path ?? normalize(request.path);
      const labels = {
        method: request.method,
        route,
        status: String(response.statusCode),
      };
      stop(labels);
      this.metrics.httpRequests.inc(labels);
    };

    return next.handle().pipe(
      tap({
        next: record,
        // También se cuentan los errores: si sólo se midiera el camino feliz,
        // la tasa de error sería siempre cero y la métrica, inútil.
        error: record,
      }),
    );
  }
}

/**
 * Reduce una URL sin patrón conocido a una forma de baja cardinalidad.
 *
 * Sólo se usa cuando Express no expone el patrón —rutas no encontradas, sobre
 * todo—, donde la URL la elige quien llama y podría inventarse infinitas.
 */
function normalize(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    .replace(/\/\d+/g, '/:n');
}
