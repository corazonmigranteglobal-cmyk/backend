import { resolveTelemetryConfig } from './telemetry.config';
import { DEFAULT_EXCLUDED_URLS, SERVICE_NAME_API } from './telemetry.constants';
import { isExcludedPath } from './telemetry.instrumentations';

describe('resolveTelemetryConfig', () => {
  it('deja la telemetría desactivada por defecto', () => {
    const config = resolveTelemetryConfig({});

    expect(config.enabled).toBe(false);
    expect(config.serviceName).toBe(SERVICE_NAME_API);
    expect(config.tracesEndpoint).toBe('http://localhost:4318/v1/traces');
    expect(config.sampler).toBe('parentbased_traceidratio');
    expect(config.samplerRatio).toBe(1);
    expect(config.propagators).toEqual(['tracecontext', 'baggage']);
    expect(config.diagLogLevel).toBe('ERROR');
    expect(config.excludedUrls).toEqual([...DEFAULT_EXCLUDED_URLS]);
  });

  it('acepta las formas habituales de booleano', () => {
    for (const value of ['true', '1', 'YES', 'on']) {
      expect(resolveTelemetryConfig({ OTEL_ENABLED: value }).enabled).toBe(true);
    }
    for (const value of ['false', '0', 'no', '']) {
      expect(resolveTelemetryConfig({ OTEL_ENABLED: value }).enabled).toBe(false);
    }
  });

  it('lee la configuración del entorno', () => {
    const config = resolveTelemetryConfig({
      OTEL_ENABLED: 'true',
      OTEL_SERVICE_NAME: 'corazon-migrante-worker-outbox',
      OTEL_SERVICE_NAMESPACE: 'plataforma',
      OTEL_SERVICE_VERSION: '2.1.0',
      OTEL_DEPLOYMENT_ENVIRONMENT: 'staging',
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://jaeger:4318/v1/traces',
      OTEL_TRACES_SAMPLER: 'traceidratio',
      OTEL_TRACES_SAMPLER_ARG: '0.25',
      OTEL_PROPAGATORS: 'tracecontext',
      OTEL_DIAG_LOG_LEVEL: 'debug',
      OTEL_EXCLUDED_URLS: '/health, /internal',
    });

    expect(config).toMatchObject({
      enabled: true,
      serviceName: 'corazon-migrante-worker-outbox',
      serviceNamespace: 'plataforma',
      serviceVersion: '2.1.0',
      deploymentEnvironment: 'staging',
      tracesEndpoint: 'http://jaeger:4318/v1/traces',
      sampler: 'traceidratio',
      samplerRatio: 0.25,
      propagators: ['tracecontext'],
      diagLogLevel: 'DEBUG',
      excludedUrls: ['/health', '/internal'],
    });
  });

  it('descarta valores inválidos en lugar de propagar configuración corrupta', () => {
    const config = resolveTelemetryConfig({
      OTEL_TRACES_SAMPLER: 'inventado',
      OTEL_TRACES_SAMPLER_ARG: '7',
      OTEL_DIAG_LOG_LEVEL: 'GRITOS',
      OTEL_EXPORT_TIMEOUT_MS: '-1',
    });

    expect(config.sampler).toBe('parentbased_traceidratio');
    expect(config.samplerRatio).toBe(1);
    expect(config.diagLogLevel).toBe('ERROR');
    expect(config.exportTimeoutMs).toBe(10_000);
  });

  it('usa NODE_ENV como entorno de despliegue cuando no se indica otro', () => {
    expect(resolveTelemetryConfig({ NODE_ENV: 'production' }).deploymentEnvironment).toBe(
      'production',
    );
  });
});

describe('isExcludedPath', () => {
  const excluded = [...DEFAULT_EXCLUDED_URLS];

  it.each([
    '/health',
    '/health/',
    '/health?probe=1',
    '/api/v1/health/version',
    '/metrics',
    '/docs/json',
  ])('excluye %s', (path) => {
    expect(isExcludedPath(path, excluded)).toBe(true);
  });

  it.each(['/api/v1/appointments', '/api/v1/users/health-summary', '/', '/api/v1/auth/login'])(
    'no excluye %s',
    (path) => {
      expect(isExcludedPath(path, excluded)).toBe(false);
    },
  );
});
