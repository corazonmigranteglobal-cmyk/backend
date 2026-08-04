import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';

/**
 * Métricas en formato Prometheus.
 *
 * El interceptor se registra como `APP_INTERCEPTOR` para que mida **todas** las
 * rutas sin que cada controlador tenga que acordarse de nada.
 */
@Module({
  imports: [ConfigModule],
  controllers: [MetricsController],
  providers: [MetricsService, { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
  exports: [MetricsService],
})
export class MetricsModule implements OnApplicationBootstrap {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    // El muestreo arranca aquí y no en el constructor: hasta este momento la
    // conexión a la base puede no estar lista y el primer muestreo fallaría
    // siempre, ensuciando el contador de fallos desde el arranque.
    this.metrics.startPolling(this.config.get<number>('metrics.pollIntervalMs') ?? 15_000);
  }
}
