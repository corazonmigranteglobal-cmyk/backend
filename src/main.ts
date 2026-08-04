// PRIMERA importación del proceso, a propósito: OpenTelemetry debe parchear
// http, express, pg, ioredis y pino ANTES de que NestJS los cargue. Cualquier
// import por encima de esta línea rompe la instrumentación automática.
import './observability/telemetry.bootstrap.api';

import 'dotenv/config';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { mountApiReference } from './common/openapi/api-reference';
import { mkdirSync } from 'node:fs';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { PinoLoggerService } from './common/logging/pino-logger.service';
import { API_PREFIX_EXCLUDED_ROUTES } from './config/http-routes';
import { TRACE_ID_HEADER } from './observability/telemetry.constants';
import { TraceResponseInterceptor } from './observability/trace-response.interceptor';

async function bootstrap() {
  mkdirSync('storage/tmp', { recursive: true });
  mkdirSync(process.env.UPLOAD_DIR ?? 'storage/uploads', { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  const config = app.get(ConfigService);
  const logger = app.get(PinoLoggerService);
  const apiPrefix = config.get<string>('app.apiPrefix') ?? 'api/v1';
  const bodyLimit = config.get<string>('app.bodyLimit') ?? '1mb';
  const corsOrigins = config.get<string[]>('app.corsOrigins') ?? [];

  app.useLogger(logger);
  app.flushLogs();
  app.set('trust proxy', config.get<number>('app.trustProxyHops') ?? 1);
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', { extended: true, limit: bodyLimit });
  const allowedImgSrc = [
    "'self'",
    'data:',
    'blob:',
    'https://storage.googleapis.com',
    'https://res.cloudinary.com',
  ];
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: allowedImgSrc,
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', TRACE_ID_HEADER],
    maxAge: 600,
  });
  app.setGlobalPrefix(apiPrefix, { exclude: API_PREFIX_EXCLUDED_ROUTES });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'La solicitud contiene datos con un formato invalido.',
          details: errors.map((error) => ({
            field: error.property,
            constraints: error.constraints ?? {},
            children: (error.children ?? []).map((child) => ({
              field: child.property,
              constraints: child.constraints ?? {},
            })),
          })),
        }),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  // El interceptor de trazas va primero para que `x-trace-id` esté fijado antes
  // de que cualquier otro interceptor o el filtro de excepciones escriba.
  app.useGlobalInterceptors(new TraceResponseInterceptor(), new ResponseInterceptor());

  if (config.get<boolean>('app.swaggerEnabled')) {
    mountApiReference(app, config);
  }

  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  const port = config.get<number>('app.port') ?? 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`API listening on port ${port}`, 'Bootstrap');
}

void bootstrap().catch((error: unknown) => {
  const fallbackLogger = new PinoLoggerService();
  fallbackLogger.error(error, 'Bootstrap');
  fallbackLogger.onApplicationShutdown();
  process.exitCode = 1;
});
