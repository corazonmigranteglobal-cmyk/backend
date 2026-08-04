import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { Observable } from 'rxjs';
import { TRACE_ID_HEADER } from './telemetry.constants';

/** Contrato mínimo de la respuesta HTTP; evita acoplar a los tipos de Express. */
interface TraceableResponse {
  setHeader(name: string, value: string): unknown;
  headersSent?: boolean;
}

/**
 * Publica el `trace_id` activo como cabecera `x-trace-id`.
 *
 * Permite que un usuario reporte un fallo con un identificador que soporte
 * técnico pega directamente en Jaeger. No altera el cuerpo JSON: el contrato de
 * las respuestas queda intacto.
 *
 * El identificador procede SIEMPRE del contexto activo de OpenTelemetry, nunca
 * de una cabecera enviada por el cliente: un ID controlado por el cliente sería
 * falsificable y contaminaría las trazas.
 *
 * Se invoca desde dos sitios porque cubren caminos disjuntos del pipeline de
 * NestJS: el interceptor no llega a ejecutarse en las rutas no encontradas ni
 * cuando un guard rechaza la petición, que son justo los casos (404/401/403)
 * en los que soporte técnico más necesita el identificador.
 */
export function setTraceIdHeader(response: TraceableResponse | undefined): void {
  const traceId = trace.getActiveSpan()?.spanContext().traceId;
  if (!traceId || /^0+$/.test(traceId)) return;
  if (!response || typeof response.setHeader !== 'function' || response.headersSent) return;

  response.setHeader(TRACE_ID_HEADER, traceId);
}

/**
 * Fija la cabecera en el camino correcto (ruta encontrada y autorizada).
 *
 * Se instancia a mano en `main.ts` (igual que `ResponseInterceptor`) y por eso
 * no depende de inyección: `trace.getActiveSpan()` es un singleton global.
 */
@Injectable()
export class TraceResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    // Se fija antes de ejecutar el handler para que también viaje en las
    // respuestas de error que genere el filtro de excepciones.
    setTraceIdHeader(context.switchToHttp().getResponse<TraceableResponse>());

    return next.handle();
  }
}
