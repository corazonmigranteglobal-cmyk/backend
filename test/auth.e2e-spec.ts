import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// `esModuleInterop` está desactivado en tsconfig.json, así que un import por
// defecto compila a `supertest_1.default`, que en un módulo CommonJS es
// `undefined`. El import de espacio de nombres es la forma correcta aquí.
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth e2e', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        forbidUnknownValues: false,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('/health responde ok', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });

  it('/auth/login requiere credenciales válidas', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'bad@example.com', password: 'wrongwrong' })
      .expect(401);
  });
});
