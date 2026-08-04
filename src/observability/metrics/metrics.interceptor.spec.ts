import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';
import { firstValueFrom, throwError, of } from 'rxjs';
import { MetricsInterceptor } from './metrics.interceptor';
import type { MetricsService } from './metrics.service';

function buildMetrics() {
  const registry = new Registry();
  return {
    httpRequests: new Counter({
      name: 'http_requests_total',
      help: 'test',
      labelNames: ['method', 'route', 'status'],
      registers: [registry],
    }),
    httpDuration: new Histogram({
      name: 'http_request_duration_seconds',
      help: 'test',
      labelNames: ['method', 'route', 'status'],
      registers: [registry],
    }),
    registry,
  } as unknown as MetricsService & { registry: Registry };
}

function contextFor(request: Record<string, unknown>, statusCode = 200): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ statusCode }),
    }),
  } as unknown as ExecutionContext;
}

const handlerOf = (observable: unknown): CallHandler =>
  ({ handle: () => observable }) as CallHandler;

describe('MetricsInterceptor', () => {
  it('etiqueta con el patrón de la ruta, no con la URL concreta', async () => {
    const metrics = buildMetrics();
    const interceptor = new MetricsInterceptor(metrics);

    await firstValueFrom(
      interceptor.intercept(
        contextFor({
          method: 'GET',
          path: '/api/v1/appointments/3f1c8a52-9d47-4a0b-8f21-6d5c0f1e2b7a',
          route: { path: '/api/v1/appointments/:id' },
        }),
        handlerOf(of({ ok: true })),
      ),
    );

    const sample = (await metrics.registry.getMetricsAsJSON()).find(
      (m) => m.name === 'http_requests_total',
    );
    // Si se etiquetara con la URL real habría una serie por identificador, que
    // es la forma más común de tumbar un Prometheus.
    expect(sample?.values[0].labels.route).toBe('/api/v1/appointments/:id');
  });

  it('cuenta también las peticiones que fallan', async () => {
    const metrics = buildMetrics();
    const interceptor = new MetricsInterceptor(metrics);

    await expect(
      firstValueFrom(
        interceptor.intercept(
          contextFor({ method: 'POST', path: '/api/v1/appointments' }, 500),
          handlerOf(throwError(() => new Error('boom'))),
        ),
      ),
    ).rejects.toThrow('boom');

    const sample = (await metrics.registry.getMetricsAsJSON()).find(
      (m) => m.name === 'http_requests_total',
    );
    // Medir sólo el camino feliz dejaría la tasa de error siempre en cero.
    expect(sample?.values[0].labels.status).toBe('500');
    expect(sample?.values[0].value).toBe(1);
  });

  it('reduce la cardinalidad cuando no hay patrón de ruta', async () => {
    const metrics = buildMetrics();
    const interceptor = new MetricsInterceptor(metrics);

    await firstValueFrom(
      interceptor.intercept(
        contextFor(
          { method: 'GET', path: '/inventada/3f1c8a52-9d47-4a0b-8f21-6d5c0f1e2b7a/42' },
          404,
        ),
        handlerOf(of(null)),
      ),
    );

    const sample = (await metrics.registry.getMetricsAsJSON()).find(
      (m) => m.name === 'http_requests_total',
    );
    expect(sample?.values[0].labels.route).toBe('/inventada/:uuid/:n');
  });

  it('no se mide a sí mismo', async () => {
    const metrics = buildMetrics();
    const interceptor = new MetricsInterceptor(metrics);

    await firstValueFrom(
      interceptor.intercept(contextFor({ method: 'GET', path: '/metrics' }), handlerOf(of('ok'))),
    );

    const sample = (await metrics.registry.getMetricsAsJSON()).find(
      (m) => m.name === 'http_requests_total',
    );
    // Sólo añadiría ruido proporcional a la frecuencia de raspado.
    expect(sample?.values ?? []).toHaveLength(0);
  });
});
