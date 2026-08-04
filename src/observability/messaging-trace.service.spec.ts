import { SpanKind } from '@opentelemetry/api';
import {
  TracingTestHarness,
  setupInMemoryTracing,
} from '../../test/observability/tracing-test.harness';
import { MessagingTraceService } from './messaging-trace.service';
import { TraceContextService } from './trace-context.service';
import { TracingService } from './tracing.service';

describe('MessagingTraceService', () => {
  let harness: TracingTestHarness;
  let tracing: TracingService;
  let messagingTrace: MessagingTraceService;

  beforeEach(() => {
    harness = setupInMemoryTracing();
    tracing = new TracingService(new TraceContextService());
    messagingTrace = new MessagingTraceService(tracing);
  });

  afterEach(async () => {
    await harness.shutdown();
  });

  it('inyecta traceparent cuando hay un span activo', async () => {
    let carrier: Record<string, string> | undefined;

    await tracing.runInSpan('outbox.enqueue', {}, () => {
      carrier = messagingTrace.inject();
    });

    expect(carrier?.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-\d{2}$/);
  });

  it('no devuelve carrier fuera de un span activo', () => {
    expect(messagingTrace.inject()).toBeUndefined();
  });

  it('mantiene el mismo trace id entre productor y consumidor', async () => {
    let carrier: Record<string, string> | undefined;
    await messagingTrace.runAsProducer('outbox.enqueue', {}, () => {
      carrier = messagingTrace.inject();
    });
    const producerSpan = harness.finishedSpans()[0];

    await messagingTrace.runAsConsumer('outbox.process', carrier, {}, () => undefined);
    const consumerSpan = harness.finishedSpans()[1];

    expect(producerSpan.kind).toBe(SpanKind.PRODUCER);
    expect(consumerSpan.kind).toBe(SpanKind.CONSUMER);
    expect(consumerSpan.links).toHaveLength(1);
    expect(consumerSpan.links[0].context.traceId).toBe(producerSpan.spanContext().traceId);
    expect(consumerSpan.links[0].context.spanId).toBe(producerSpan.spanContext().spanId);
  });

  it('procesa mensajes antiguos sin carrier como traza raíz', async () => {
    const result = await messagingTrace.runAsConsumer(
      'outbox.process',
      undefined,
      { 'app.module': 'messaging' },
      () => 'processed',
    );

    expect(result).toBe('processed');
    const [span] = harness.finishedSpans();
    expect(span.links).toHaveLength(0);
    expect(span.attributes['app.module']).toBe('messaging');
  });

  it('tolera metadata incompleta o corrupta sin romper el procesamiento', async () => {
    for (const carrier of [null, 'traceparent', [], { traceparent: 42 }, { traceparent: 'nope' }]) {
      expect(messagingTrace.extractLink(carrier)).toBeUndefined();
    }

    await expect(
      messagingTrace.runAsConsumer('outbox.process', { traceparent: 'nope' }, {}, () => 'ok'),
    ).resolves.toBe('ok');
  });

  it('no modifica destructivamente el carrier recibido', () => {
    const carrier = { traceparent: '00-11111111111111111111111111111111-2222222222222222-01' };
    const snapshot = { ...carrier };

    messagingTrace.extractLink(carrier);

    expect(carrier).toEqual(snapshot);
  });

  it('marca el span consumidor como error y relanza la excepción', async () => {
    const failure = new Error('provider down');

    await expect(
      messagingTrace.runAsConsumer('outbox.process', undefined, {}, () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    const [span] = harness.finishedSpans();
    expect(span.ended).toBe(true);
    expect(span.events.map((event) => event.name)).toContain('exception');
  });
});
