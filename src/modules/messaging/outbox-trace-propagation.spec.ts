import { SpanKind } from '@opentelemetry/api';
import {
  TracingTestHarness,
  setupInMemoryTracing,
} from '../../../test/observability/tracing-test.harness';
import { MessagingTraceService } from '@/observability/messaging-trace.service';
import { TRACE_CARRIER_KEY } from '@/observability/telemetry.constants';
import { TraceContextService } from '@/observability/trace-context.service';
import { TracingService } from '@/observability/tracing.service';
import { MessagingService } from './messaging.service';

/**
 * Verifica el requisito central de la Fase 12: la traza sobrevive al salto de
 * proceso entre la API (que encola) y el worker de outbox (que entrega).
 */
function makeService() {
  const stored: Array<Record<string, any>> = [];
  const outboxModel = {
    create: jest.fn(async (values: Record<string, any>) => {
      const row = { id: stored.length + 1, ...values };
      stored.push(row);
      return row;
    }),
    update: jest.fn(async () => [1]),
  };
  const logModel = { create: jest.fn() };
  const sequelize = { transaction: jest.fn((cb: (tx: unknown) => unknown) => cb('tx')) };
  const config = { get: jest.fn() };
  const provider = {
    send: jest.fn(async () => ({ provider: 'DEV_NULL', providerMessageId: 'dev-1', metadata: {} })),
    normalizeError: jest.fn((error: unknown) => ({
      message: String(error),
      metadata: { provider: 'DEV_NULL' },
    })),
  };

  const tracing = new TracingService(new TraceContextService());
  const messagingTrace = new MessagingTraceService(tracing);
  const service = new MessagingService(
    outboxModel as any,
    logModel as any,
    sequelize as any,
    config as any,
    provider as any,
    messagingTrace,
  );

  return { service, tracing, stored, provider, outboxModel };
}

describe('Propagación de traza en el outbox', () => {
  let harness: TracingTestHarness;

  beforeEach(() => {
    harness = setupInMemoryTracing();
  });

  afterEach(async () => {
    await harness.shutdown();
  });

  it('inyecta el carrier W3C en el payload al encolar', async () => {
    const { service, tracing, stored } = makeService();

    await tracing.runInSpan('http.request', {}, () =>
      service.enqueue({
        channel: 'EMAIL',
        recipient: 'paciente@example.com',
        templateCode: 'APPOINTMENT_REQUESTED',
        payload: { appointmentId: 'appt-1' },
      }),
    );

    expect(stored[0].payload).toMatchObject({ appointmentId: 'appt-1' });
    expect(stored[0].payload[TRACE_CARRIER_KEY].traceparent).toMatch(/^00-[0-9a-f]{32}-/);
  });

  it('conserva el mismo trace id entre el productor y el consumidor', async () => {
    const { service, tracing, stored } = makeService();

    await tracing.runInSpan('http.request', {}, () =>
      service.enqueue({
        channel: 'EMAIL',
        recipient: 'paciente@example.com',
        templateCode: 'APPOINTMENT_REQUESTED',
        payload: {},
      }),
    );
    const requestTraceId = harness.finishedSpans()[0].spanContext().traceId;
    harness.reset();

    // El worker vive en otro proceso: sólo dispone de la fila persistida.
    await (service as any).processClaimedMessages([
      { id: 1, templateCode: 'APPOINTMENT_REQUESTED', attempts: 1, payload: stored[0].payload },
    ]);

    const consumerSpan = harness.finishedSpans().find((span) => span.name === 'outbox.process');
    expect(consumerSpan).toBeDefined();
    expect(consumerSpan!.kind).toBe(SpanKind.CONSUMER);
    expect(consumerSpan!.links[0].context.traceId).toBe(requestTraceId);
    expect(consumerSpan!.attributes['messaging.message.id']).toBe('1');
    expect(consumerSpan!.attributes['app.result']).toBe('sent');
  });

  it('procesa mensajes antiguos sin carrier sin romperse', async () => {
    const { service } = makeService();

    const result = await (service as any).processClaimedMessages([
      { id: 9, templateCode: 'LEGACY', attempts: 1, payload: { subject: 'hola' } },
    ]);

    expect(result).toMatchObject({ processed: 1, sent: 1, failed: 0 });
    const consumerSpan = harness.finishedSpans().find((span) => span.name === 'outbox.process');
    expect(consumerSpan!.links).toHaveLength(0);
  });

  it('marca el span consumidor cuando el proveedor falla, sin abortar el lote', async () => {
    const { service, provider } = makeService();
    provider.send.mockRejectedValueOnce(new Error('SendGrid 503'));

    const result = await (service as any).processClaimedMessages([
      {
        id: 3,
        templateCode: 'X',
        attempts: 1,
        maxAttempts: 6,
        scheduledAt: new Date(),
        payload: {},
      },
      {
        id: 4,
        templateCode: 'X',
        attempts: 1,
        maxAttempts: 6,
        scheduledAt: new Date(),
        payload: {},
      },
    ]);

    expect(result).toMatchObject({ processed: 2, sent: 1, failed: 1 });
    const spans = harness.finishedSpans().filter((span) => span.name === 'outbox.process');
    expect(spans[0].attributes['app.result']).toBe('retry');
    expect(spans[1].attributes['app.result']).toBe('sent');
  });

  it('no expone el carrier de traza en la respuesta de la API', () => {
    const { service } = makeService();

    const apiRow = (service as any).toApiOutbox({
      id: 1,
      channel: 'EMAIL',
      recipient: 'paciente@example.com',
      templateCode: 'X',
      payload: { subject: 'hola', [TRACE_CARRIER_KEY]: { traceparent: '00-aa-bb-01' } },
      status: 'PENDIENTE',
      attempts: 0,
      maxAttempts: 6,
      scheduledAt: new Date(),
    });

    expect(apiRow.payload).toEqual({ subject: 'hola' });
  });
});
