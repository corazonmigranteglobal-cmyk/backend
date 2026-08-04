import { Injectable } from '@nestjs/common';
import {
  Attributes,
  Link,
  Span,
  SpanKind,
  context,
  isSpanContextValid,
  propagation,
  trace,
} from '@opentelemetry/api';
import { TRACER_NAME } from './telemetry.constants';
import { TraceCarrier } from './telemetry.types';
import { TracingService } from './tracing.service';

/**
 * Propagación explícita de contexto para el outbox transaccional.
 *
 * El contexto de OpenTelemetry NO sobrevive por sí solo cuando un mensaje se
 * persiste en PostgreSQL y otro proceso lo consume minutos después: hay que
 * serializar el carrier W3C al publicar y reconstruirlo al consumir.
 */
@Injectable()
export class MessagingTraceService {
  private readonly tracer = trace.getTracer(TRACER_NAME);

  constructor(private readonly tracing: TracingService) {}

  /**
   * Serializa el contexto activo (`traceparent`, `tracestate`, `baggage`).
   * Devuelve `undefined` cuando no hay traza activa, para no ensuciar el payload
   * con un objeto vacío.
   */
  inject(): TraceCarrier | undefined {
    const carrier: TraceCarrier = {};
    propagation.inject(context.active(), carrier);
    return Object.keys(carrier).length > 0 ? carrier : undefined;
  }

  /** Reconstruye el `SpanContext` remoto a partir de un carrier persistido. */
  extractLink(carrier: unknown): Link | undefined {
    if (!carrier || typeof carrier !== 'object' || Array.isArray(carrier)) return undefined;

    const entries = Object.entries(carrier as Record<string, unknown>).filter(
      ([, value]) => typeof value === 'string',
    );
    if (entries.length === 0) return undefined;

    const extracted = propagation.extract(context.active(), Object.fromEntries(entries));
    const spanContext = trace.getSpanContext(extracted);
    if (!spanContext || !isSpanContextValid(spanContext)) return undefined;

    return { context: spanContext };
  }

  /**
   * Ejecuta el procesamiento de un mensaje como span `CONSUMER`.
   *
   * Se enlaza con el productor mediante `links` en lugar de anidarse como hijo:
   * el span productor ya terminó cuando el worker despierta, y el tiempo que el
   * mensaje pasa en cola no debe inflar la duración de la petición HTTP original.
   *
   * Si el mensaje es anterior al despliegue de la observabilidad (sin carrier),
   * el span se crea como raíz y el procesamiento continúa con normalidad.
   */
  async runAsConsumer<T>(
    name: string,
    carrier: unknown,
    attributes: Attributes,
    operation: (span: Span) => Promise<T> | T,
  ): Promise<T> {
    const link = this.extractLink(carrier);

    return this.tracer.startActiveSpan(
      name,
      { kind: SpanKind.CONSUMER, attributes, links: link ? [link] : undefined },
      async (span) => {
        try {
          return await operation(span);
        } catch (error) {
          this.tracing.markSpanFailed(span, error);
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /** Ejecuta la publicación de un mensaje como span `PRODUCER`. */
  async runAsProducer<T>(
    name: string,
    attributes: Attributes,
    operation: (span: Span) => Promise<T> | T,
  ): Promise<T> {
    return this.tracing.runInSpan(name, attributes, operation, { kind: SpanKind.PRODUCER });
  }
}
