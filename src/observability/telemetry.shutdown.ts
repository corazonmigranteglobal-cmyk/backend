import { diag } from '@opentelemetry/api';
import type { NodeSDK } from '@opentelemetry/sdk-node';

let handlersRegistered = false;

/**
 * Cierre limpio del SDK.
 *
 * Deliberadamente NO llama a `process.exit()`: el proceso debe seguir su curso
 * para que NestJS ejecute sus propios `onApplicationShutdown` (cierre del pool
 * de Sequelize, `quit()` de ioredis, flush del fichero de logs de Pino).
 */
export function registerShutdownHandlers(sdk: NodeSDK, timeoutMs: number): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  const shutdown = async (signal: NodeJS.Signals) => {
    diag.debug(`Telemetry shutdown requested by ${signal}.`);
    await shutdownTelemetry(sdk, timeoutMs);
  };

  process.once('SIGTERM', (signal) => void shutdown(signal));
  process.once('SIGINT', (signal) => void shutdown(signal));
}

/**
 * Vacía los spans pendientes con un límite de tiempo. Un exportador colgado
 * (Jaeger caído, red bloqueada) nunca debe impedir que el proceso termine.
 */
export async function shutdownTelemetry(sdk: NodeSDK, timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      diag.warn(`Telemetry shutdown timed out after ${timeoutMs} ms; continuing.`);
      resolve();
    }, timeoutMs);
    timer.unref();
  });

  try {
    await Promise.race([sdk.shutdown(), timeout]);
  } catch (error) {
    // Un fallo cerrando la telemetría no debe alterar el código de salida.
    diag.error(`Telemetry shutdown failed: ${(error as Error)?.message ?? String(error)}`);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Sólo para pruebas: permite volver a registrar manejadores en otro proceso simulado. */
export function resetShutdownHandlersForTesting(): void {
  handlersRegistered = false;
}
