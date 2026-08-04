import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import {
  TracingTestHarness,
  setupInMemoryTracing,
} from '../../test/observability/tracing-test.harness';
import { TRACE_ID_HEADER } from './telemetry.constants';
import { TraceContextService } from './trace-context.service';
import { TraceResponseInterceptor, setTraceIdHeader } from './trace-response.interceptor';
import { TracingService } from './tracing.service';

function makeContext(response: { setHeader: jest.Mock; headersSent?: boolean }) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ExecutionContext;
}

describe('TraceResponseInterceptor', () => {
  let harness: TracingTestHarness;
  let tracing: TracingService;
  const interceptor = new TraceResponseInterceptor();

  beforeEach(() => {
    harness = setupInMemoryTracing();
    tracing = new TracingService(new TraceContextService());
  });

  afterEach(async () => {
    await harness.shutdown();
  });

  it('publica el trace id activo como cabecera x-trace-id', async () => {
    const response = { setHeader: jest.fn() };
    const next: CallHandler = { handle: () => of({ data: 'ok' }) };

    const value = await tracing.runInSpan('http.handler', {}, async (span) => {
      const result = await firstValueFrom(interceptor.intercept(makeContext(response), next));
      expect(response.setHeader).toHaveBeenCalledWith(TRACE_ID_HEADER, span.spanContext().traceId);
      return result;
    });

    // La respuesta atraviesa el interceptor sin alterarse.
    expect(value).toEqual({ data: 'ok' });
  });

  it('no falla ni fija la cabecera cuando no hay span activo', async () => {
    const response = { setHeader: jest.fn() };
    const next: CallHandler = { handle: () => of('payload') };

    await expect(firstValueFrom(interceptor.intercept(makeContext(response), next))).resolves.toBe(
      'payload',
    );
    expect(response.setHeader).not.toHaveBeenCalled();
  });

  it('no escribe si las cabeceras ya se enviaron', async () => {
    const response = { setHeader: jest.fn(), headersSent: true };
    const next: CallHandler = { handle: () => of('payload') };

    await tracing.runInSpan('http.handler', {}, () =>
      firstValueFrom(interceptor.intercept(makeContext(response), next)),
    );

    expect(response.setHeader).not.toHaveBeenCalled();
  });

  it('conserva la excepción del handler', async () => {
    const response = { setHeader: jest.fn() };
    const failure = new Error('handler failed');
    const next: CallHandler = { handle: () => throwError(() => failure) };

    await tracing.runInSpan('http.handler', {}, async () => {
      await expect(firstValueFrom(interceptor.intercept(makeContext(response), next))).rejects.toBe(
        failure,
      );
    });

    expect(response.setHeader).toHaveBeenCalled();
  });

  it('setTraceIdHeader cubre las respuestas que no pasan por el interceptor', async () => {
    // Rutas inexistentes (404) y rechazos de guards (401/403) nunca ejecutan
    // interceptores: el filtro de excepciones fija la cabecera por su cuenta.
    const response = { setHeader: jest.fn() };

    await tracing.runInSpan('http.request', {}, (span) => {
      setTraceIdHeader(response);
      expect(response.setHeader).toHaveBeenCalledWith(TRACE_ID_HEADER, span.spanContext().traceId);
    });
  });

  it('setTraceIdHeader tolera respuestas ausentes o ya enviadas', async () => {
    await tracing.runInSpan('http.request', {}, () => {
      expect(() => setTraceIdHeader(undefined)).not.toThrow();
      expect(() => setTraceIdHeader({} as never)).not.toThrow();

      const sent = { setHeader: jest.fn(), headersSent: true };
      setTraceIdHeader(sent);
      expect(sent.setHeader).not.toHaveBeenCalled();
    });
  });

  it('ignora contextos que no son HTTP', async () => {
    const context = { getType: () => 'rpc' } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of('rpc-result') };

    await expect(firstValueFrom(interceptor.intercept(context, next))).resolves.toBe('rpc-result');
  });
});
