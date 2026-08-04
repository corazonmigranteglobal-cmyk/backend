import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '@/common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

/**
 * Endpoint de métricas en formato Prometheus.
 *
 * Vive **fuera del prefijo `api/v1`**: no forma parte de la API del producto,
 * lo consume la infraestructura de monitorización y su contrato es el formato
 * de exposición de Prometheus, no el sobre de respuesta del backend. Por eso
 * también queda excluido del contrato OpenAPI.
 *
 * ## Acceso
 *
 * Las métricas revelan superficie interna: nombres de ruta, volumen de tráfico
 * y estado de la infraestructura. **No pueden quedar abiertas.**
 *
 * El control es `METRICS_TOKEN` y **falla cerrado**: si la variable no está
 * configurada, el endpoint responde 404 y ni siquiera admite que existe. Es
 * preferible perder las métricas a exponerlas por olvido de configuración.
 */
@ApiExcludeController()
@Controller('metrics')
@Public()
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Devuelve el texto de exposición **sin el sobre de respuesta**.
   *
   * `ResponseInterceptor` envuelve todo en `{ data, meta }`, y eso rompería el
   * formato que Prometheus espera. El marcador `__raw` es el mecanismo que ya
   * existe en el interceptor para las respuestas que no son JSON de la API.
   */
  @Get()
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(@Headers('authorization') authorization?: string) {
    const expected = this.config.get<string>('metrics.token');

    if (!expected) {
      // Sin token configurado el endpoint no existe: un 403 confirmaría que
      // hay métricas detrás y merece la pena insistir.
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Recurso no encontrado.',
      });
    }

    const provided = (authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!matches(provided, expected)) {
      throw new ForbiddenException({
        code: 'METRICS_INVALID_TOKEN',
        message: 'Token de métricas inválido.',
      });
    }

    return { __raw: true, payload: await this.metrics.metrics() };
  }
}

/**
 * Comparación en tiempo constante: un `===` filtra, por cuánto tarda en fallar,
 * cuántos caracteres iniciales acertó quien lo intenta.
 */
function matches(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
