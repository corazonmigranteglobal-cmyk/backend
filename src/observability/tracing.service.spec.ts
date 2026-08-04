import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import {
  TracingTestHarness,
  setupInMemoryTracing,
} from '../../test/observability/tracing-test.harness';
import { TraceContextService } from './trace-context.service';
import { TracingService } from './tracing.service';

describe('TracingService', () => {
  let harness: TracingTestHarness;
  let traceContext: TraceContextService;
  let tracing: TracingService;

  beforeEach(() => {
    harness = setupInMemoryTracing();
    traceContext = new TraceContextService();
    tracing = new TracingService(traceContext);
  });

  afterEach(async () => {
    await harness.shutdown();
  });

  it('crea el span, ejecuta la operación asíncrona y devuelve su resultado', async () => {
    const result = await tracing.runInSpan(
      'credit.evaluate',
      { 'app.module': 'credit' },
      async () => Promise.resolve('ok'),
    );

    expect(result).toBe('ok');
    const [span] = harness.finishedSpans();
    expect(span.name).toBe('credit.evaluate');
    expect(span.attributes['app.module']).toBe('credit');
    expect(span.kind).toBe(SpanKind.INTERNAL);
    expect(span.status.code).not.toBe(SpanStatusCode.ERROR);
  });

  it('soporta operaciones síncronas', async () => {
    const result = await tracing.runInSpan('domain.action', {}, () => 42);

    expect(result).toBe(42);
    expect(harness.finishedSpans()).toHaveLength(1);
  });

  it('finaliza el span y relanza la excepción original sin modificarla', async () => {
    const failure = new Error('boom');

    await expect(
      tracing.runInSpan('domain.action', {}, () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    const [span] = harness.finishedSpans();
    expect(span.ended).toBe(true);
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.status.message).toBe('boom');
    expect(span.events.map((event) => event.name)).toContain('exception');
  });

  it('registra la excepción una sola vez', async () => {
    await expect(
      tracing.runInSpan('domain.action', {}, () => {
        throw new Error('single');
      }),
    ).rejects.toThrow('single');

    const [span] = harness.finishedSpans();
    expect(span.events.filter((event) => event.name === 'exception')).toHaveLength(1);
  });

  it('anida los spans hijos bajo el mismo trace id con span ids distintos', async () => {
    await tracing.runInSpan('parent.action', {}, async () => {
      await tracing.runInSpan('child.action', {}, () => undefined);
    });

    const [child, parent] = harness.finishedSpans();
    expect(child.name).toBe('child.action');
    expect(parent.name).toBe('parent.action');
    expect(child.spanContext().traceId).toBe(parent.spanContext().traceId);
    expect(child.spanContext().spanId).not.toBe(parent.spanContext().spanId);
    expect(child.parentSpanContext?.spanId).toBe(parent.spanContext().spanId);
  });

  it('expone el trace id y el span id activos, y nada fuera de un span', async () => {
    expect(tracing.getActiveTraceId()).toBeUndefined();
    expect(tracing.getActiveSpanId()).toBeUndefined();

    await tracing.runInSpan('domain.action', {}, (span) => {
      expect(tracing.getActiveTraceId()).toBe(span.spanContext().traceId);
      expect(tracing.getActiveSpanId()).toBe(span.spanContext().spanId);
    });

    expect(tracing.getActiveTraceId()).toBeUndefined();
  });

  it('añade eventos y atributos al span activo', async () => {
    await tracing.runInSpan('domain.action', {}, () => {
      tracing.addEvent('rules.started');
      tracing.setAttribute('app.result', 'granted');
      tracing.setAttributes({ 'app.operation': 'evaluate' });
    });

    const [span] = harness.finishedSpans();
    expect(span.events.map((event) => event.name)).toContain('rules.started');
    expect(span.attributes['app.result']).toBe('granted');
    expect(span.attributes['app.operation']).toBe('evaluate');
  });

  it('no falla al añadir eventos o excepciones sin span activo', () => {
    expect(() => tracing.addEvent('orphan')).not.toThrow();
    expect(() => tracing.setAttribute('app.result', 'none')).not.toThrow();
    expect(() => tracing.recordException(new Error('orphan'))).not.toThrow();
    expect(harness.finishedSpans()).toHaveLength(0);
  });

  it('permite declarar el tipo de span', async () => {
    await tracing.runInSpan('outbox.enqueue', {}, () => undefined, { kind: SpanKind.PRODUCER });

    expect(harness.finishedSpans()[0].kind).toBe(SpanKind.PRODUCER);
  });
});
