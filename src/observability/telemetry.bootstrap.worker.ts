// El worker no cargaba `dotenv` por su cuenta (lo hacía `ConfigModule` mucho
// después). El SDK arranca antes que NestJS, así que necesita el `.env` ya leído.
import 'dotenv/config';
import { startTelemetry } from './telemetry.bootstrap';
import { SERVICE_NAME_OUTBOX_WORKER } from './telemetry.constants';

/**
 * Módulo de efecto lateral: primera importación de `src/workers/outbox.worker.ts`.
 *
 * El worker es un proceso distinto de la API y debe exportar sus trazas con su
 * propio `service.name`; reutilizar el de la API mezclaría dos componentes en el
 * mismo servicio de Jaeger e impediría medirlos por separado.
 */
startTelemetry({
  serviceName: process.env.OTEL_SERVICE_NAME?.trim() || SERVICE_NAME_OUTBOX_WORKER,
});
