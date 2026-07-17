import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { setTimeout as delay } from 'node:timers/promises';
import { AppModule } from '@/app.module';
import { PinoLoggerService } from '@/common/logging/pino-logger.service';
import { MessagingService } from '@/modules/messaging/messaging.service';

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

async function startOutboxWorker() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  const logger = app.get(PinoLoggerService);
  const config = app.get(ConfigService);
  const messaging = app.get(MessagingService);
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
    activeCycle = messaging
      .processPending(batchSize)
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
