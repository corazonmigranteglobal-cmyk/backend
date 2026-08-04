import { SpanStatusCode, trace } from '@opentelemetry/api';
import { ATTR_HTTP_RESPONSE_STATUS_CODE } from '@opentelemetry/semantic-conventions';

/**
 * Marca el span activo cuando una petición HTTP termina en error.
 *
 * Punto ÚNICO de registro de excepciones HTTP: lo invoca `HttpExceptionFilter`,
 * que es el `@Catch()` global y por tanto ve también los errores lanzados por
 * guards y pipes, que nunca llegan a los interceptores. Registrar además en el
 * interceptor duplicaría la misma excepción en la traza.
 *
 * No crea ni finaliza spans: el span HTTP lo gestiona la instrumentación
 * automática y cerrarlo desde aquí truncaría la traza.
 */
export function markActiveSpanAsFailed(exception: unknown, status: number, code: string): void {
  const span = trace.getActiveSpan();
  if (!span) return;

  span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status);
  span.setAttribute('app.error.code', code);

  // Los 4xx son parte del contrato (validación, no encontrado, no autorizado).
  // Marcarlos como error dispararía falsas alarmas en cualquier panel de SLO.
  if (status < 500) return;

  const normalized = exception instanceof Error ? exception : new Error(String(exception));
  span.recordException(normalized);
  span.setStatus({ code: SpanStatusCode.ERROR, message: normalized.message });
}
