import { Global, Module } from '@nestjs/common';
import { MessagingTraceService } from './messaging-trace.service';
import { TraceContextService } from './trace-context.service';
import { TracingService } from './tracing.service';

/**
 * Expone la fachada de trazabilidad a todo el backend.
 *
 * Es `@Global` para que ningún módulo de dominio tenga que importar un módulo de
 * infraestructura sólo para instrumentar una operación, lo que además evitaría
 * dependencias circulares entre módulos de negocio.
 *
 * No arranca el SDK: eso ocurre antes de que exista el contenedor de NestJS
 * (ver `telemetry.bootstrap.ts`).
 */
@Global()
@Module({
  providers: [TraceContextService, TracingService, MessagingTraceService],
  exports: [TraceContextService, TracingService, MessagingTraceService],
})
export class ObservabilityModule {}
