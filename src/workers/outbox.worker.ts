// PRIMERA importación del proceso: el worker es un proceso independiente y debe
// inicializar su propio SDK, con su propio service.name, antes de cargar NestJS.
import '@/observability/telemetry.bootstrap.worker';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { setTimeout as delay } from 'node:timers/promises';
import { AppModule } from '@/app.module';
import { PinoLoggerService } from '@/common/logging/pino-logger.service';
import { MessagingService } from '@/modules/messaging/messaging.service';
import { APP_ATTR } from '@/observability/telemetry.constants';
import { TracingService } from '@/observability/tracing.service';

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Ejecuta un ciclo de sondeo dentro de un span raíz `scheduler.outbox-poll`.
 *
 * Se registra el tamaño del lote y cuántos mensajes se procesaron, nunca su
 * contenido. Los spans por mensaje los crea `MessagingService` como CONSUMER.
 */
function runPollCycle(tracing: TracingService, messaging: MessagingService, batchSize: number) {
  return tracing.runInSpan(
    'scheduler.outbox-poll',
    {
      [APP_ATTR.module]: 'messaging',
      [APP_ATTR.operation]: 'poll',
      [APP_ATTR.jobName]: 'outbox-poll',
      [APP_ATTR.batchSize]: batchSize,
    },
    async (span) => {
      const result = await messaging.processPending(batchSize);
      span.setAttributes({
        [APP_ATTR.batchProcessed]: result.processed,
        'app.batch.sent': result.sent,
        'app.batch.failed': result.failed,
      });
      return result;
    },
  );
}

async function startOutboxWorker() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  const logger = app.get(PinoLoggerService);
  const config = app.get(ConfigService);
  const messaging = app.get(MessagingService);
  const tracing = app.get(TracingService);
  const pollIntervalMs = config.get<number>('outbox.pollIntervalMs') ?? 2_000;
  const batchSize = config.get<number>('outbox.batchSize') ?? 50;
  const shutdownTimeoutMs = config.get<number>('outbox.shutdownTimeoutMs') ?? 30_000;
  const abortController = new AbortController();

  app.useLogger(logger);
  app.flushLogs();

  if (config.get<boolean>('outbox.workerEnabled') === false) {
    logger.warn('Outbox worker is disabled.', 'OutboxWorker');
    await app.close();
    return;
  }

  let stopRequested = false;
  let activeCycle: Promise<void> = Promise.resolve();
  let shutdownPromise: Promise<void> | undefined;

  const requestShutdown = (signal: string) => {
    if (shutdownPromise) return shutdownPromise;

    stopRequested = true;
    abortController.abort();
    shutdownPromise = (async () => {
      logger.warn(`Outbox worker stopping after ${signal}.`, 'OutboxWorker');
      await Promise.race([activeCycle, delay(shutdownTimeoutMs)]);
      await app.close();
    })();
    return shutdownPromise;
  };

  process.once('SIGTERM', () => void requestShutdown('SIGTERM'));
  process.once('SIGINT', () => void requestShutdown('SIGINT'));
  logger.log(`Outbox worker started with batch size ${batchSize}.`, 'OutboxWorker');

  while (!stopRequested) {
    // Cada ciclo de sondeo abre su propia traza raíz: no proviene de ninguna
    // petición HTTP y un span permanente que durase toda la vida del proceso
    // sería inútil en Jaeger.
    activeCycle = runPollCycle(tracing, messaging, batchSize)
      .then((result) => {
        if (result.processed > 0) {
          logger.log(
            `Outbox cycle processed=${result.processed} sent=${result.sent} failed=${result.failed}.`,
            'OutboxWorker',
          );
        }
      })
      .catch((error: unknown) => {
        logger.error(error, 'OutboxWorker');
      });
    await activeCycle;
    activeCycle = Promise.resolve();

    try {
      await delay(pollIntervalMs, undefined, { signal: abortController.signal });
    } catch (error) {
      if (!isAbortError(error)) throw error;
    }
  }

  await requestShutdown('worker loop completion');
}

void startOutboxWorker().catch((error: unknown) => {
  const logger = new PinoLoggerService();
  logger.error(error, 'OutboxWorkerBootstrap');
  logger.onApplicationShutdown();
  process.exitCode = 1;
});
