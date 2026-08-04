import { Injectable } from '@nestjs/common';
import { Attributes, Span, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { TRACER_NAME } from './telemetry.constants';
import { TraceContextService } from './trace-context.service';

export interface SpanOptions {
  kind?: SpanKind;
  attributes?: Attributes;
}

/**
 * Fachada de trazabilidad para los servicios de dominio.
 *
 * Los módulos de negocio dependen de esta clase, no de Jaeger ni de ningún
 * exportador concreto. Si mañana el backend de trazas cambia a Tempo o Zipkin,
 * el dominio no se entera.
 */
@Injectable()
export class TracingService {
  private readonly tracer = trace.getTracer(TRACER_NAME);

  constructor(private readonly traceContext: TraceContextService) {}

  /**
   * Ejecuta `operation` dentro de un span activo.
   *
   * - El span se cierra siempre (`finally`), incluso si la operación lanza.
   * - La excepción se registra una única vez y se **relanza sin modificar**:
   *   no se convierte un error en un resultado correcto ni se pierde el stack.
   * - Acepta operaciones síncronas y asíncronas.
   */
  async runInSpan<T>(
    name: string,
    attributes: Attributes,
    operation: (span: Span) => Promise<T> | T,
    options: SpanOptions = {},
  ): Promise<T> {
    return this.tracer.startActiveSpan(
      name,
      {
        kind: options.kind ?? SpanKind.INTERNAL,
        attributes: { ...attributes, ...options.attributes },
      },
      async (span) => {
        try {
          return await operation(span);
        } catch (error) {
          this.markSpanFailed(span, error);
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /** Variante síncrona, para operaciones que no devuelven promesa. */
  runInSpanSync<T>(
    name: string,
    attributes: Attributes,
    operation: (span: Span) => T,
    options: SpanOptions = {},
  ): T {
    return this.tracer.startActiveSpan(
      name,
      {
        kind: options.kind ?? SpanKind.INTERNAL,
        attributes: { ...attributes, ...options.attributes },
      },
      (span) => {
        try {
          return operation(span);
        } catch (error) {
          this.markSpanFailed(span, error);
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /** Marca un span como fallido registrando la excepción una sola vez. */
  markSpanFailed(span: Span, error: unknown): void {
    const normalized = error instanceof Error ? error : new Error(String(error));
    span.recordException(normalized);
    span.setStatus({ code: SpanStatusCode.ERROR, message: normalized.message });
  }

  /** Añade un hito al span activo. No falla si no hay ninguno. */
  addEvent(name: string, attributes?: Attributes): void {
    trace.getActiveSpan()?.addEvent(name, attributes);
  }

  setAttribute(key: string, value: Attributes[string]): void {
    trace.getActiveSpan()?.setAttribute(key, value as never);
  }

  setAttributes(attributes: Attributes): void {
    trace.getActiveSpan()?.setAttributes(attributes);
  }

  /** Registra una excepción en el span activo sin crear ni cerrar spans ajenos. */
  recordException(error: unknown): void {
    const span = trace.getActiveSpan();
    if (span) this.markSpanFailed(span, error);
  }

  getActiveTraceId(): string | undefined {
    return this.traceContext.getTraceId();
  }

  getActiveSpanId(): string | undefined {
    return this.traceContext.getSpanId();
  }
}
