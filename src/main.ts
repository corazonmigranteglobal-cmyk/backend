import 'dotenv/config';
import { BadRequestException, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { mkdirSync } from 'node:fs';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { PinoLoggerService } from './common/logging/pino-logger.service';

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
  app.use(helmet());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });
  app.setGlobalPrefix(apiPrefix, {
    // The health controller remains available at /health for ingress and orchestration probes.
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted:
        process.env.NODE_ENV === 'production' ||
        process.env.VALIDATION_FORBID_NON_WHITELISTED === 'true',
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'La solicitud contiene datos con un formato inválido.',
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
  app.useGlobalInterceptors(new ResponseInterceptor());

  if (config.get<boolean>('app.swaggerEnabled')) {
    const swaggerConfiguration = new DocumentBuilder()
      .setTitle('Corazón Migrante API')
      .setDescription('API /api/v1 para Corazón Migrante')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfiguration);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: false },
    });
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
