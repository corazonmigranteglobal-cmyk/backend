import type { NodeSDK } from '@opentelemetry/sdk-node';
import {
  enforceTracesOnlyPipelines,
  getTelemetryConfig,
  isTelemetryStarted,
  startTelemetry,
} from './telemetry.bootstrap';
import { resetShutdownHandlersForTesting, shutdownTelemetry } from './telemetry.shutdown';

describe('startTelemetry', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    resetShutdownHandlersForTesting();
  });

  it('no arranca el SDK cuando la telemetría está desactivada', () => {
    delete process.env.OTEL_ENABLED;

    expect(startTelemetry()).toBeUndefined();
    expect(isTelemetryStarted()).toBe(false);
  });

  it('no abre exportadores ni registra manejadores de señal estando desactivada', () => {
    process.env.OTEL_ENABLED = 'false';
    const listenersBefore = process.listenerCount('SIGTERM');

    startTelemetry();

    expect(process.listenerCount('SIGTERM')).toBe(listenersBefore);
  });

  it('expone la configuración resuelta para diagnóstico', () => {
    process.env.OTEL_ENABLED = 'false';
    process.env.OTEL_SERVICE_NAME = 'corazon-migrante-worker-outbox';

    startTelemetry();

    expect(getTelemetryConfig()).toMatchObject({
      enabled: false,
      serviceName: 'corazon-migrante-worker-outbox',
    });
  });

  it('permite que el proceso llamante fije el nombre de servicio', () => {
    process.env.OTEL_ENABLED = 'false';
    delete process.env.OTEL_SERVICE_NAME;

    startTelemetry({ serviceName: 'corazon-migrante-worker-outbox' });

    expect(getTelemetryConfig()?.serviceName).toBe('corazon-migrante-worker-outbox');
  });
});

describe('enforceTracesOnlyPipelines', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('desactiva métricas y logs, señales que Jaeger no expone', () => {
    delete process.env.OTEL_METRICS_EXPORTER;
    delete process.env.OTEL_LOGS_EXPORTER;

    enforceTracesOnlyPipelines();

    // Sin esto, NodeSDK exporta periódicamente a /v1/metrics y /v1/logs contra
    // un Jaeger que sólo sirve /v1/traces, y el exportador registra 404.
    expect(process.env.OTEL_METRICS_EXPORTER).toBe('none');
    expect(process.env.OTEL_LOGS_EXPORTER).toBe('none');
  });

  it('respeta el valor que fije el operador', () => {
    process.env.OTEL_METRICS_EXPORTER = 'otlp';

    enforceTracesOnlyPipelines();

    expect(process.env.OTEL_METRICS_EXPORTER).toBe('otlp');
  });
});

describe('shutdownTelemetry', () => {
  it('vacía los spans pendientes en un cierre normal', async () => {
    const sdk = { shutdown: jest.fn().mockResolvedValue(undefined) } as unknown as NodeSDK;

    await shutdownTelemetry(sdk, 1_000);

    expect(sdk.shutdown).toHaveBeenCalledTimes(1);
  });

  it('no bloquea el proceso si el exportador se queda colgado', async () => {
    // Jaeger caído y sin cerrar la conexión: la promesa nunca resuelve.
    const sdk = {
      shutdown: jest.fn(() => new Promise<void>(() => undefined)),
    } as unknown as NodeSDK;

    await expect(shutdownTelemetry(sdk, 50)).resolves.toBeUndefined();
  });

  it('no propaga los errores de cierre', async () => {
    const sdk = {
      shutdown: jest.fn().mockRejectedValue(new Error('exporter closed')),
    } as unknown as NodeSDK;

    await expect(shutdownTelemetry(sdk, 1_000)).resolves.toBeUndefined();
  });
});
