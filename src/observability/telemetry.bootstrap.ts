import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { envDetector, hostDetector, resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  BatchSpanProcessor,
  ParentBasedSampler,
  Sampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_NAMESPACE,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions';
import { SpanRedactionProcessor } from './span-redaction.processor';
import { resolveTelemetryConfig } from './telemetry.config';
import { buildInstrumentations } from './telemetry.instrumentations';
import { registerShutdownHandlers } from './telemetry.shutdown';
import { TelemetryConfig } from './telemetry.types';

let activeSdk: NodeSDK | undefined;
let activeConfig: TelemetryConfig | undefined;

const DIAG_LEVELS = {
  NONE: DiagLogLevel.NONE,
  ERROR: DiagLogLevel.ERROR,
  WARN: DiagLogLevel.WARN,
  INFO: DiagLogLevel.INFO,
  DEBUG: DiagLogLevel.DEBUG,
  VERBOSE: DiagLogLevel.VERBOSE,
  ALL: DiagLogLevel.ALL,
} as const;

function buildSampler(config: TelemetryConfig): Sampler {
  switch (config.sampler) {
    case 'always_on':
      return new AlwaysOnSampler();
    case 'always_off':
      return new AlwaysOffSampler();
    case 'traceidratio':
      return new TraceIdRatioBasedSampler(config.samplerRatio);
    case 'parentbased_always_on':
      return new ParentBasedSampler({ root: new AlwaysOnSampler() });
    case 'parentbased_always_off':
      return new ParentBasedSampler({ root: new AlwaysOffSampler() });
    default:
      return new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(config.samplerRatio) });
  }
}

function buildPropagator(config: TelemetryConfig): CompositePropagator {
  const propagators = [];
  if (config.propagators.includes('tracecontext'))
    propagators.push(new W3CTraceContextPropagator());
  if (config.propagators.includes('baggage')) propagators.push(new W3CBaggagePropagator());
  if (propagators.length === 0) propagators.push(new W3CTraceContextPropagator());
  return new CompositePropagator({ propagators });
}

/**
 * Esta implementación es **sólo de trazas**.
 *
 * Sin esto, `NodeSDK` levanta también los pipelines OTLP de métricas y logs por
 * defecto, que golpean `/v1/metrics` y `/v1/logs`. Jaeger sólo expone
 * `/v1/traces`, así que el exportador registraba un `404 Not Found` de forma
 * periódica (detectado ejecutando el backend contra un Jaeger real).
 *
 * Se respeta el valor si el operador lo fija explícitamente, para no impedir que
 * en el futuro se apunte a un Collector que sí acepte métricas.
 */
export function enforceTracesOnlyPipelines(): void {
  process.env.OTEL_METRICS_EXPORTER = process.env.OTEL_METRICS_EXPORTER || 'none';
  process.env.OTEL_LOGS_EXPORTER = process.env.OTEL_LOGS_EXPORTER || 'none';
}

/**
 * Arranca el SDK de OpenTelemetry.
 *
 * Debe invocarse ANTES de que se cargue cualquier librería instrumentada
 * (NestJS, Express, Sequelize, pg, ioredis, Pino). Por eso los entrypoints la
 * ejecutan desde módulos de efecto lateral importados en primera posición:
 * `telemetry.bootstrap.api.ts` y `telemetry.bootstrap.worker.ts`.
 *
 * Es idempotente: una segunda llamada devuelve el SDK ya activo, lo que evita
 * dobles inicializaciones cuando varias suites de test importan el módulo.
 */
export function startTelemetry(overrides: Partial<TelemetryConfig> = {}): NodeSDK | undefined {
  if (activeSdk) return activeSdk;

  const config: TelemetryConfig = { ...resolveTelemetryConfig(), ...overrides };
  activeConfig = config;

  if (!config.enabled) return undefined;

  diag.setLogger(new DiagConsoleLogger(), DIAG_LEVELS[config.diagLogLevel]);

  enforceTracesOnlyPipelines();

  try {
    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: config.serviceName,
        [ATTR_SERVICE_NAMESPACE]: config.serviceNamespace,
        [ATTR_SERVICE_VERSION]: config.serviceVersion,
        [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: config.deploymentEnvironment,
      }),
      // Se omiten `processDetector` y `serviceInstanceIdDetector`: el primero
      // publica `process.command_args`, que puede arrastrar credenciales pasadas
      // por línea de comandos.
      resourceDetectors: [envDetector, hostDetector],
      sampler: buildSampler(config),
      textMapPropagator: buildPropagator(config),
      // BatchSpanProcessor exporta en segundo plano: una caída de Jaeger nunca
      // bloquea una petición de negocio.
      spanProcessors: [
        // Va PRIMERO: sanea los atributos antes de que el exportador los lea.
        new SpanRedactionProcessor(),
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: config.tracesEndpoint,
            timeoutMillis: config.exportTimeoutMs,
          }),
        ),
      ],
      instrumentations: buildInstrumentations(config),
    });

    sdk.start();
    activeSdk = sdk;
    registerShutdownHandlers(sdk, config.shutdownTimeoutMs);
    diag.info(`Telemetry started for ${config.serviceName} -> ${config.tracesEndpoint}`);
    return sdk;
  } catch (error) {
    // Un fallo de instrumentación no debe impedir que el backend arranque, pero
    // tampoco puede quedar oculto.
    diag.error(`Telemetry failed to start: ${(error as Error)?.message ?? String(error)}`);
    return undefined;
  }
}

export function getTelemetryConfig(): TelemetryConfig | undefined {
  return activeConfig;
}

export function isTelemetryStarted(): boolean {
  return activeSdk !== undefined;
}
