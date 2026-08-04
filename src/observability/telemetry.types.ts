/** Tipos públicos de la capa de observabilidad. */

export type SamplerName =
  | 'always_on'
  | 'always_off'
  | 'traceidratio'
  | 'parentbased_always_on'
  | 'parentbased_always_off'
  | 'parentbased_traceidratio';

export type DiagLevelName = 'NONE' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'VERBOSE' | 'ALL';

/** Configuración efectiva del SDK, resuelta una sola vez por proceso. */
export interface TelemetryConfig {
  enabled: boolean;
  serviceName: string;
  serviceNamespace: string;
  serviceVersion: string;
  deploymentEnvironment: string;
  exporterProtocol: string;
  tracesEndpoint: string;
  exportTimeoutMs: number;
  sampler: SamplerName;
  samplerRatio: number;
  propagators: string[];
  diagLogLevel: DiagLevelName;
  excludedUrls: string[];
  shutdownTimeoutMs: number;
}

/** Carrier W3C que viaja dentro del payload de los mensajes del outbox. */
export type TraceCarrier = Record<string, string>;
