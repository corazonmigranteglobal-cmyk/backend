/**
 * Constantes compartidas por toda la capa de observabilidad.
 *
 * Se mantienen aquí (y no dispersas por los módulos de dominio) para que exista
 * un único sitio donde revisar las convenciones de nombres y los atributos que
 * se envían al backend de trazas.
 */

/** Nombre del tracer con el que se registran los spans manuales. */
export const TRACER_NAME = 'corazon-migrante';

/** Servicios por defecto de cada proceso ejecutable del backend. */
export const SERVICE_NAME_API = 'corazon-migrante-api';
export const SERVICE_NAME_OUTBOX_WORKER = 'corazon-migrante-worker-outbox';
export const SERVICE_NAMESPACE = 'corazon-migrante';

/** Header de respuesta que permite a soporte técnico localizar la traza. */
export const TRACE_ID_HEADER = 'x-trace-id';

/**
 * Clave reservada dentro del `payload` JSONB del outbox donde viaja el carrier
 * W3C. Empieza por `_` para no colisionar con las claves de plantilla de correo.
 */
export const TRACE_CARRIER_KEY = '_trace';

/**
 * Atributos propios del producto. Todos de cardinalidad baja salvo
 * `APP_ENTITY_ID`, que sólo se usa como atributo (nunca como nombre de span).
 */
export const APP_ATTR = {
  module: 'app.module',
  operation: 'app.operation',
  entityType: 'app.entity.type',
  entityId: 'app.entity.id',
  result: 'app.result',
  jobName: 'app.job.name',
  jobAttempt: 'app.job.attempt',
  jobExecutionId: 'app.job.execution.id',
  eventType: 'app.event.type',
  batchSize: 'app.batch.size',
  batchProcessed: 'app.batch.processed',
} as const;

/**
 * Atributos de mensajería. Se declaran como literales en vez de importarlos de
 * `@opentelemetry/semantic-conventions/incubating`, cuyo contrato aún cambia
 * entre versiones menores.
 */
export const MESSAGING_ATTR = {
  system: 'messaging.system',
  destinationName: 'messaging.destination.name',
  operationType: 'messaging.operation.type',
  messageId: 'messaging.message.id',
} as const;

/** El outbox vive en PostgreSQL, no en un broker dedicado. */
export const MESSAGING_SYSTEM = 'postgresql-outbox';
export const MESSAGING_DESTINATION = 'mensajeria.mensaje_outbox';

/**
 * Rutas que nunca deben generar trazas: sondas de plataforma y assets. Se
 * incluyen variantes que hoy no existen (`/healthz`, `/metrics`) para que un
 * cambio futuro de orquestador no reintroduzca ruido silenciosamente.
 */
export const DEFAULT_EXCLUDED_URLS = [
  '/health',
  '/healthz',
  '/ready',
  '/readiness',
  '/liveness',
  '/metrics',
  '/favicon.ico',
  '/docs',
] as const;
