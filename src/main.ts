import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

const logger = new Logger('Bootstrap');

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled promise rejection: ${reason instanceof Error ? reason.stack : reason}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.stack}`);
});

async function bootstrap() {
  mkdirSync('storage/tmp', { recursive: true });
  mkdirSync(process.env.UPLOAD_DIR ?? 'storage/uploads', { recursive: true });
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  app.use(helmet());
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));
  app.enableCors({ origin: corsOrigins.length ? corsOrigins : true, credentials: true });
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Corazón Migrante API')
    .setDescription('API reingenierizada /api/v1 para Corazón Migrante')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(Number(process.env.PORT ?? 3000));
}
bootstrap();
