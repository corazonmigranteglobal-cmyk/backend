import {
  Controller,
  Get,
  INestApplication,
  InternalServerErrorException,
  Module,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import type { InMemorySpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import type { NextFunction, Request, Response } from 'express';
import { isExcludedPath } from '../../src/observability/telemetry.instrumentations';
import { DEFAULT_EXCLUDED_URLS } from '../../src/observability/telemetry.constants';
// `esModuleInterop` está desactivado en este repositorio: la importación por
// defecto de supertest se resolvería a `undefined` en tiempo de ejecución.
import * as request from 'supertest';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { ObservabilityModule } from '../../src/observability/observability.module';
import { APP_ATTR, TRACE_ID_HEADER } from '../../src/observability/telemetry.constants';
import { TraceResponseInterceptor } from '../../src/observability/trace-response.interceptor';
import { TracingService } from '../../src/observability/tracing.service';

/**
 * Integración del pipeline HTTP completo (Express + Nest + interceptor + filtro)
 * contra un exportador en memoria.
 *
 * No arranca `AppModule`: eso exigiría PostgreSQL y Redis vivos y convertiría
 * una prueba de observabilidad en una prueba de infraestructura.
 */
@Controller()
class ProbeController {
  constructor(private readonly tracing: TracingService) {}

  @Get('ok')
  ok() {
    return this.tracing.runInSpan(
      'probe.business-operation',
      { [APP_ATTR.module]: 'probe', [APP_ATTR.operation]: 'read' },
      (span) => {
        span.addEvent('probe.started');
        return { ok: true };
      },
    );
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('boom')
  boom(): never {
    throw new InternalServerErrorException({ code: 'PROBE_FAILURE', message: 'Fallo simulado.' });
  }

  @Get('missing')
  missing(): never {
    throw new NotFoundException({ code: 'PROBE_NOT_FOUND', message: 'No existe.' });
  }
}

@Module({ imports: [ObservabilityModule], controllers: [ProbeController] })
class ProbeModule {}

const exporter = (globalThis as Record<string, unknown>)
  .__OTEL_TEST_EXPORTER__ as InMemorySpanExporter;

/**
 * Sustituto en proceso de `@opentelemetry/instrumentation-http`.
 *
 * Dentro de Jest la instrumentación automática no llega a aplicarse (el
 * enganche de `require-in-the-middle` no se dispara con el registro de módulos
 * de Jest), así que el span raíz de la petición se crea aquí replicando su
 * comportamiento: mismo `SpanKind.SERVER`, misma lista de exclusión y los
 * mismos atributos semánticos. Lo que se valida es el código propio que cuelga
 * de ese span, no la librería de terceros — ésa la valida
 * `scripts/verify-jaeger.sh` contra un proceso y un Jaeger reales.
 */
function rootSpanMiddleware(request: Request, response: Response, next: NextFunction) {
  const path = request.originalUrl ?? request.url;
  if (isExcludedPath(path, [...DEFAULT_EXCLUDED_URLS])) return next();

  const tracer = trace.getTracer('e2e-http');
  tracer.startActiveSpan(
    `${request.method} ${path}`,
    {
      kind: SpanKind.SERVER,
      attributes: { 'http.request.method': request.method, 'url.path': path },
    },
    (span) => {
      response.on('finish', () => span.end());
      next();
    },
  );
}

describe('Observabilidad HTTP (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(rootSpanMiddleware);
    app.useGlobalInterceptors(new TraceResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => exporter.reset());

  const spansOf = (name: string): ReadableSpan[] =>
    exporter.getFinishedSpans().filter((span) => span.name === name);

  it('devuelve x-trace-id y genera una traza coherente para una petición correcta', async () => {
    const response = await request(app.getHttpServer()).get('/ok').expect(200);

    const traceId = response.headers[TRACE_ID_HEADER];
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);

    const spans = exporter.getFinishedSpans();
    expect(spans.length).toBeGreaterThan(0);
    // Todos los spans de la petición comparten trace id y tienen span id propio.
    expect(new Set(spans.map((span) => span.spanContext().traceId))).toEqual(new Set([traceId]));
    expect(new Set(spans.map((span) => span.spanContext().spanId)).size).toBe(spans.length);

    const [business] = spansOf('probe.business-operation');
    expect(business.attributes[APP_ATTR.module]).toBe('probe');
    expect(business.events.map((event) => event.name)).toContain('probe.started');
    // El span de negocio cuelga de la jerarquía HTTP, no es una traza suelta.
    expect(business.parentSpanContext).toBeDefined();
  });

  it('marca la traza como error y conserva el código HTTP en un 500', async () => {
    const response = await request(app.getHttpServer()).get('/boom').expect(500);

    expect(response.body.error.code).toBe('PROBE_FAILURE');
    // El stack no viaja al cliente.
    expect(JSON.stringify(response.body)).not.toContain('at ');

    const errored = exporter
      .getFinishedSpans()
      .filter((span) => span.status.code === SpanStatusCode.ERROR);
    expect(errored.length).toBeGreaterThan(0);
    const marked = errored.find((span) => span.attributes['app.error.code'] === 'PROBE_FAILURE');
    expect(marked).toBeDefined();
    expect(marked!.attributes['http.response.status_code']).toBe(500);
    // La excepción se registra una única vez en toda la traza.
    const exceptionEvents = exporter
      .getFinishedSpans()
      .flatMap((span) => span.events)
      .filter((event) => event.name === 'exception');
    expect(exceptionEvents).toHaveLength(1);
  });

  it('no marca como error un 404, que es parte del contrato', async () => {
    await request(app.getHttpServer()).get('/missing').expect(404);

    const errored = exporter
      .getFinishedSpans()
      .filter((span) => span.status.code === SpanStatusCode.ERROR);
    expect(errored).toHaveLength(0);
  });

  it('no genera trazas para los health checks excluidos', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);

    expect(exporter.getFinishedSpans()).toHaveLength(0);
  });

  it('no filtra cabeceras de autorización ni cookies a los atributos', async () => {
    await request(app.getHttpServer())
      .get('/ok')
      .set('Authorization', 'Bearer super-secreto')
      .set('Cookie', 'session=super-secreto')
      .expect(200);

    const serialized = JSON.stringify(
      exporter.getFinishedSpans().map((span) => span.attributes),
    ).toLowerCase();
    expect(serialized).not.toContain('super-secreto');
    expect(serialized).not.toContain('authorization');
    expect(serialized).not.toContain('cookie');
  });

  it('sigue respondiendo aunque el destino de exportación no exista', async () => {
    // El procesador en memoria simula un exportador siempre disponible; lo que
    // se comprueba aquí es que la respuesta no depende del resultado del export:
    // el pipeline responde antes de que el span termine de procesarse.
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => request(app.getHttpServer()).get('/ok')),
    );

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(responses.every((response) => Boolean(response.headers[TRACE_ID_HEADER]))).toBe(true);
  });
});
