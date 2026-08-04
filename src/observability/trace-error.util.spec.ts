import { SpanStatusCode } from '@opentelemetry/api';
import {
  TracingTestHarness,
  setupInMemoryTracing,
} from '../../test/observability/tracing-test.harness';
import { TraceContextService } from './trace-context.service';
import { markActiveSpanAsFailed } from './trace-error.util';
import { TracingService } from './tracing.service';

describe('markActiveSpanAsFailed', () => {
  let harness: TracingTestHarness;
  let tracing: TracingService;

  beforeEach(() => {
    harness = setupInMemoryTracing();
    tracing = new TracingService(new TraceContextService());
  });

  afterEach(async () => {
    await harness.shutdown();
  });

  it('marca como error los 5xx y registra la excepción', async () => {
    await tracing.runInSpan('http.request', {}, () => {
      markActiveSpanAsFailed(new Error('database down'), 500, 'INTERNAL_SERVER_ERROR');
    });

    const [span] = harness.finishedSpans();
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.status.message).toBe('database down');
    expect(span.attributes['http.response.status_code']).toBe(500);
    expect(span.attributes['app.error.code']).toBe('INTERNAL_SERVER_ERROR');
    expect(span.events.filter((event) => event.name === 'exception')).toHaveLength(1);
  });

  it('no marca como error los 4xx, que son parte del contrato', async () => {
    await tracing.runInSpan('http.request', {}, () => {
      markActiveSpanAsFailed(new Error('not found'), 404, 'HTTP_404');
    });

    const [span] = harness.finishedSpans();
    expect(span.status.code).not.toBe(SpanStatusCode.ERROR);
    expect(span.attributes['http.response.status_code']).toBe(404);
    expect(span.attributes['app.error.code']).toBe('HTTP_404');
    expect(span.events).toHaveLength(0);
  });

  it('normaliza excepciones que no son Error', async () => {
    await tracing.runInSpan('http.request', {}, () => {
      markActiveSpanAsFailed('cadena suelta', 503, 'SERVICE_UNAVAILABLE');
    });

    expect(harness.finishedSpans()[0].status.message).toBe('cadena suelta');
  });

  it('no falla ni crea spans cuando no hay span activo', () => {
    expect(() => markActiveSpanAsFailed(new Error('x'), 500, 'CODE')).not.toThrow();
    expect(harness.finishedSpans()).toHaveLength(0);
  });
});
