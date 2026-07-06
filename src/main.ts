import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  mkdirSync('storage/tmp', { recursive: true });
  mkdirSync(process.env.UPLOAD_DIR ?? 'storage/uploads', { recursive: true });
  const app = await NestFactory.create(AppModule);
  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  app.use(helmet());
  app.enableCors({ origin: corsOrigins.length ? corsOrigins : true, credentials: true });
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      // Modo compatible con frontend: conserva validación de tipos/campos obligatorios,
      // pero no rompe por propiedades extras enviadas por formularios o tablas legacy.
      whitelist: true,
      forbidNonWhitelisted: process.env.VALIDATION_FORBID_NON_WHITELISTED === 'true',
      forbidUnknownValues: false,
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
