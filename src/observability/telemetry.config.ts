import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_EXCLUDED_URLS, SERVICE_NAME_API, SERVICE_NAMESPACE } from './telemetry.constants';
import { DiagLevelName, SamplerName, TelemetryConfig } from './telemetry.types';

/**
 * Única lectura directa de `process.env` de toda la capa de observabilidad.
 *
 * El bootstrap del SDK corre ANTES de que exista el contenedor de NestJS, así
 * que no puede usar `ConfigService`. Para que no haya dos fuentes de verdad,
 * `src/config/configuration.ts` expone el resultado de esta misma función bajo
 * la clave `otel`, y el resto del código consume siempre `ConfigService`.
 */

const SAMPLERS: readonly SamplerName[] = [
  'always_on',
  'always_off',
  'traceidratio',
  'parentbased_always_on',
  'parentbased_always_off',
  'parentbased_traceidratio',
];

const DIAG_LEVELS: readonly DiagLevelName[] = [
  'NONE',
  'ERROR',
  'WARN',
  'INFO',
  'DEBUG',
  'VERBOSE',
  'ALL',
];

function readBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function readNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readRatio(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

function readList(raw: string | undefined, fallback: readonly string[]): string[] {
  const parsed = (raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [...fallback];
}

function readSampler(raw: string | undefined): SamplerName {
  const candidate = raw?.trim().toLowerCase() as SamplerName | undefined;
  return candidate && SAMPLERS.includes(candidate) ? candidate : 'parentbased_traceidratio';
}

function readDiagLevel(raw: string | undefined): DiagLevelName {
  const candidate = raw?.trim().toUpperCase() as DiagLevelName | undefined;
  return candidate && DIAG_LEVELS.includes(candidate) ? candidate : 'ERROR';
}

/**
 * Lee la versión desde `package.json` sin `require()` dinámico ni
 * `resolveJsonModule`. `__dirname` es `<raíz>/src/observability` bajo ts-jest y
 * `<raíz>/dist/observability` tras compilar: en ambos casos `../..` es la raíz.
 */
function readPackageVersion(): string {
  try {
    const raw = readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8');
    return (JSON.parse(raw) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function resolveTelemetryConfig(
  environment: NodeJS.ProcessEnv = process.env,
): TelemetryConfig {
  return {
    enabled: readBoolean(environment.OTEL_ENABLED, false),
    serviceName: environment.OTEL_SERVICE_NAME?.trim() || SERVICE_NAME_API,
    serviceNamespace: environment.OTEL_SERVICE_NAMESPACE?.trim() || SERVICE_NAMESPACE,
    serviceVersion: environment.OTEL_SERVICE_VERSION?.trim() || readPackageVersion(),
    deploymentEnvironment:
      environment.OTEL_DEPLOYMENT_ENVIRONMENT?.trim() || environment.NODE_ENV || 'development',
    exporterProtocol: environment.OTEL_EXPORTER_OTLP_PROTOCOL?.trim() || 'http/protobuf',
    tracesEndpoint:
      environment.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim() || 'http://localhost:4318/v1/traces',
    exportTimeoutMs: readNumber(environment.OTEL_EXPORT_TIMEOUT_MS, 10_000),
    sampler: readSampler(environment.OTEL_TRACES_SAMPLER),
    samplerRatio: readRatio(environment.OTEL_TRACES_SAMPLER_ARG, 1),
    propagators: readList(environment.OTEL_PROPAGATORS, ['tracecontext', 'baggage']),
    diagLogLevel: readDiagLevel(environment.OTEL_DIAG_LOG_LEVEL),
    excludedUrls: readList(environment.OTEL_EXCLUDED_URLS, DEFAULT_EXCLUDED_URLS),
    shutdownTimeoutMs: readNumber(environment.OTEL_SHUTDOWN_TIMEOUT_MS, 5_000),
  };
}
