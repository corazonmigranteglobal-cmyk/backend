import { LoggerService } from '@nestjs/common';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import pino, { LevelWithSilent, Logger as PinoLogger } from 'pino';

const DEFAULT_LOG_FILE_PATH = 'storage/logs/app.log';
const DEFAULT_LOG_LEVEL: LevelWithSilent = 'info';

function resolveLogLevel(value?: string): LevelWithSilent {
  const levels: LevelWithSilent[] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
  return levels.includes(value as LevelWithSilent) ? (value as LevelWithSilent) : DEFAULT_LOG_LEVEL;
}

function normalizeMessage(message: unknown): string {
  if (typeof message === 'string') return message;
  if (message instanceof Error) return message.message;

  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

function extractContext(optionalParams: unknown[]) {
  const maybeContext = optionalParams.at(-1);
  return typeof maybeContext === 'string' ? maybeContext : undefined;
}

export class PinoLoggerService implements LoggerService {
  private readonly logger: PinoLogger;

  constructor() {
    const logFilePath = resolve(process.env.LOG_FILE_PATH ?? DEFAULT_LOG_FILE_PATH);
    mkdirSync(dirname(logFilePath), { recursive: true });

    this.logger = pino(
      {
        level: resolveLogLevel(process.env.LOG_LEVEL),
        timestamp: pino.stdTimeFunctions.isoTime,
        redact: {
          paths: [
            'password',
            '*.password',
            'authorization',
            '*.authorization',
            'cookie',
            '*.cookie',
            'token',
            '*.token',
            'accessToken',
            '*.accessToken',
            'refreshToken',
            '*.refreshToken',
            'apiKey',
            '*.apiKey',
          ],
          censor: '[REDACTED]',
        },
      },
      pino.multistream([
        { stream: process.stdout },
        { stream: pino.destination({ dest: logFilePath, sync: false, mkdir: true }) },
      ]),
    );
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    this.logger.info({ context: extractContext(optionalParams) }, normalizeMessage(message));
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    const context = extractContext(optionalParams);
    const stack = optionalParams.find((param) => typeof param === 'string' && param !== context);

    this.logger.error(
      {
        context,
        stack,
        err: message instanceof Error ? message : undefined,
      },
      normalizeMessage(message),
    );
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.logger.warn({ context: extractContext(optionalParams) }, normalizeMessage(message));
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.logger.debug({ context: extractContext(optionalParams) }, normalizeMessage(message));
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.logger.trace({ context: extractContext(optionalParams) }, normalizeMessage(message));
  }
}
