interface FakeRedis {
  status: string;
  handlers: Record<string, (error: unknown) => void>;
  connect: jest.Mock;
  get: jest.Mock;
  set: jest.Mock;
  scan: jest.Mock;
  unlink: jest.Mock;
  ping: jest.Mock;
  quit: jest.Mock;
  disconnect: jest.Mock;
}

/**
 * Doble de `ioredis`. La clase vive dentro de la factoría porque `jest.mock` se
 * eleva por encima de los imports y no puede referenciar variables externas.
 * Las instancias creadas se exponen en `__instances` para poder inspeccionarlas.
 */
jest.mock('ioredis', () => {
  const instances: unknown[] = [];

  class MockRedis {
    status = 'wait';
    handlers: Record<string, (error: unknown) => void> = {};
    connect = jest.fn(async () => {
      this.status = 'ready';
    });
    get = jest.fn();
    set = jest.fn(async () => 'OK');
    scan = jest.fn();
    unlink = jest.fn(async (...keys: string[]) => keys.length);
    ping = jest.fn(async () => 'PONG');
    quit = jest.fn(async () => 'OK');
    disconnect = jest.fn();

    constructor() {
      instances.push(this);
    }

    on(event: string, handler: (error: unknown) => void) {
      this.handlers[event] = handler;
      return this;
    }
  }

  return { __esModule: true, default: MockRedis, __instances: instances };
});

import { ServiceUnavailableException } from '@nestjs/common';
import * as ioredis from 'ioredis';
import { RedisService } from './redis.service';

const clientInstances = (ioredis as unknown as { __instances: FakeRedis[] }).__instances;

function makeService(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    'redis.enabled': true,
    'redis.host': 'localhost',
    'redis.port': 6379,
    'redis.database': 0,
    'redis.scanCount': 2,
    'redis.deleteBatchSize': 2,
    'redis.maxPatternDeleteKeys': 4,
    ...overrides,
  };
  const config = { get: jest.fn((key: string) => values[key]) };
  const service = new RedisService(config as never);
  return { service, client: clientInstances.at(-1) as FakeRedis | undefined };
}

describe('RedisService', () => {
  beforeEach(() => {
    clientInstances.length = 0;
    jest.clearAllMocks();
  });

  describe('cuando Redis está deshabilitado', () => {
    it('no crea cliente y rechaza cualquier operación de forma controlada', async () => {
      const { service } = makeService({ 'redis.enabled': false });

      expect(clientInstances).toHaveLength(0);
      expect(() => service.rawClient).toThrow(ServiceUnavailableException);
      await expect(service.ping()).rejects.toThrow(ServiceUnavailableException);
      // El cierre no debe fallar aunque nunca hubiera cliente.
      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe('getJson', () => {
    it('conecta bajo demanda y deserializa el valor', async () => {
      const { service, client } = makeService();
      client!.get.mockResolvedValue('{"a":1}');

      await expect(service.getJson('clave')).resolves.toEqual({ a: 1 });
      expect(client!.connect).toHaveBeenCalledTimes(1);
    });

    it('devuelve null cuando la clave no existe', async () => {
      const { service, client } = makeService();
      client!.get.mockResolvedValue(null);

      await expect(service.getJson('clave')).resolves.toBeNull();
    });

    it('descarta y elimina un valor corrupto en vez de propagar el error', async () => {
      const { service, client } = makeService();
      client!.get.mockResolvedValue('{no es json');

      await expect(service.getJson('clave')).resolves.toBeNull();
      expect(client!.unlink).toHaveBeenCalledWith('clave');
    });
  });

  describe('setJson', () => {
    it('escribe con TTL', async () => {
      const { service, client } = makeService();

      await service.setJson('clave', { a: 1 }, 60);

      expect(client!.set).toHaveBeenCalledWith('clave', '{"a":1}', 'EX', 60);
    });

    it('rechaza TTL fuera de rango antes de tocar Redis', async () => {
      const { service, client } = makeService();

      await expect(service.setJson('clave', {}, 0)).rejects.toThrow(RangeError);
      await expect(service.setJson('clave', {}, 90_000)).rejects.toThrow(RangeError);
      await expect(service.setJson('clave', {}, 1.5)).rejects.toThrow(RangeError);
      expect(client!.set).not.toHaveBeenCalled();
    });
  });

  describe('delByPattern', () => {
    it('recorre el cursor con SCAN en vez de bloquear con KEYS', async () => {
      const { service, client } = makeService();
      client!.scan.mockResolvedValueOnce(['7', ['a', 'b']]).mockResolvedValueOnce(['0', ['c']]);

      await expect(service.delByPattern('cache:*')).resolves.toBe(3);
      expect(client!.scan).toHaveBeenCalledTimes(2);
      expect(client!.unlink).toHaveBeenCalledWith('a', 'b');
      expect(client!.unlink).toHaveBeenCalledWith('c');
    });

    it('se detiene en el límite de seguridad configurado', async () => {
      // Evita que un patrón demasiado amplio borre media base de cache.
      const { service, client } = makeService();
      client!.scan
        .mockResolvedValueOnce(['1', ['a', 'b']])
        .mockResolvedValueOnce(['2', ['c', 'd', 'e']]);

      await expect(service.delByPattern('*')).resolves.toBe(2);
      expect(client!.scan).toHaveBeenCalledTimes(2);
    });
  });

  describe('onModuleDestroy', () => {
    it('cierra ordenadamente cuando el cliente está listo', async () => {
      const { service, client } = makeService();
      client!.status = 'ready';

      await service.onModuleDestroy();

      expect(client!.quit).toHaveBeenCalled();
    });

    it('desconecta a la fuerza si el cierre ordenado falla', async () => {
      const { service, client } = makeService();
      client!.status = 'ready';
      client!.quit.mockRejectedValue(new Error('sin conexión'));

      await service.onModuleDestroy();

      expect(client!.disconnect).toHaveBeenCalled();
    });
  });

  it('registra los errores de conexión sin lanzarlos', () => {
    const { client } = makeService();

    expect(() => client!.handlers.error?.({ code: 'ECONNREFUSED' })).not.toThrow();
  });
});
