import { Injectable } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

/**
 * Lectura del contexto de traza activo.
 *
 * Deliberadamente NO genera identificadores: si no hay span activo devuelve
 * `undefined`. Un ID inventado sería indistinguible de uno real en los logs y
 * llevaría a soporte técnico a buscar en Jaeger una traza que no existe.
 */
@Injectable()
export class TraceContextService {
  getTraceId(): string | undefined {
    const spanContext = trace.getActiveSpan()?.spanContext();
    if (!spanContext) return undefined;
    // El trace ID inválido de OpenTelemetry es una cadena de ceros.
    return /^0+$/.test(spanContext.traceId) ? undefined : spanContext.traceId;
  }

  getSpanId(): string | undefined {
    const spanContext = trace.getActiveSpan()?.spanContext();
    if (!spanContext) return undefined;
    return /^0+$/.test(spanContext.spanId) ? undefined : spanContext.spanId;
  }

  getTraceFlags(): number | undefined {
    return trace.getActiveSpan()?.spanContext().traceFlags;
  }

  hasActiveSpan(): boolean {
    return this.getTraceId() !== undefined;
  }
}
