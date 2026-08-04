import { resolveRedisConnection } from './redis.config';

describe('resolveRedisConnection', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('REDIS_')) delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('usa host y puerto discretos cuando no hay REDIS_URL', () => {
    process.env.REDIS_HOST = 'cache.interno';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_DB = '3';
    process.env.REDIS_TLS = 'true';

    expect(resolveRedisConnection()).toEqual({
      host: 'cache.interno',
      port: 6380,
      username: undefined,
      password: undefined,
      database: 3,
      tls: true,
    });
  });

  it('aplica valores por defecto sensatos', () => {
    expect(resolveRedisConnection()).toMatchObject({
      host: 'localhost',
      port: 6379,
      database: 0,
      tls: false,
    });
  });

  it('REDIS_URL tiene precedencia sobre un REDIS_HOST obsoleto', () => {
    // Precedencia deliberada: un REDIS_HOST viejo en el .env no debe anular la
    // URL de conexión que inyecta la plataforma de despliegue.
    process.env.REDIS_HOST = 'host-obsoleto';
    process.env.REDIS_URL = 'redis://usuario:c%C3%B3ntrase%C3%B1a@cache.prod:6390/2';

    expect(resolveRedisConnection()).toEqual({
      url: 'redis://usuario:c%C3%B3ntrase%C3%B1a@cache.prod:6390/2',
      host: 'cache.prod',
      port: 6390,
      username: 'usuario',
      password: 'cóntraseña',
      database: 2,
      tls: false,
    });
  });

  it('marca TLS con el esquema rediss:', () => {
    process.env.REDIS_URL = 'rediss://cache.prod:6379';
    expect(resolveRedisConnection()).toMatchObject({ tls: true, port: 6379, database: 0 });
  });

  it('rechaza esquemas que no son de Redis', () => {
    process.env.REDIS_URL = 'http://cache.prod:6379';
    expect(() => resolveRedisConnection()).toThrow('redis:');
  });

  it('rechaza un número de base de datos inválido', () => {
    process.env.REDIS_URL = 'redis://cache.prod:6379/abc';
    expect(() => resolveRedisConnection()).toThrow('invalid database number');
  });
});
