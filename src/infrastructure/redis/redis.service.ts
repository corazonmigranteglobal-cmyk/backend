import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client?: Redis;
  private readonly enabled: boolean;
  private readonly endpointLabel: string;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('redis.enabled') !== false;

    if (!this.enabled) {
      this.endpointLabel = 'disabled';
      this.logger.warn('Redis deshabilitado por REDIS_ENABLED=false');
      return;
    }

    const redisUrl = this.config.get<string>('redis.url');
    const host = this.config.get<string>('redis.host') ?? 'localhost';
    const port = this.config.get<number>('redis.port') ?? 6379;
    const username = this.config.get<string>('redis.username') || undefined;
    const password = this.config.get<string>('redis.password') || undefined;
    const db = this.config.get<number>('redis.db') ?? 0;
    const tls = this.config.get<boolean>('redis.tls') === true;

    this.endpointLabel = redisUrl ? this.maskRedisUrl(redisUrl) : `${host}:${port}/${db}`;

    const commonOptions = {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      tls: tls ? {} : undefined,
    };

    this.client = redisUrl
      ? new Redis(redisUrl, commonOptions)
      : new Redis({
          host,
          port,
          username,
          password,
          db,
          ...commonOptions,
        });

    this.client.on('error', (error: NodeJS.ErrnoException) => {
      const reason = error.code ?? error.message ?? String(error);
      this.logger.warn(`Redis no disponible (${this.endpointLabel}): ${reason}`);
    });
  }

  get rawClient() {
    if (!this.client) throw new ServiceUnavailableException('Redis esta deshabilitado.');
    return this.client;
  }

  async ping(): Promise<'PONG'> {
    await this.ensureConnected();
    return this.rawClient.ping() as Promise<'PONG'>;
  }

  async getJson<T>(key: string): Promise<T | null> {
    await this.ensureConnected();
    const value = await this.rawClient.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.ensureConnected();
    await this.rawClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async delByPattern(pattern: string): Promise<number> {
    await this.ensureConnected();
    const keys = await this.rawClient.keys(pattern);
    if (!keys.length) return 0;
    return this.rawClient.del(...keys);
  }

  async onModuleDestroy() {
    if (this.client && this.client.status !== 'end') {
      this.client.disconnect();
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client) throw new ServiceUnavailableException('Redis esta deshabilitado.');
    if (this.client.status === 'wait') await this.client.connect();
  }

  private maskRedisUrl(redisUrl: string): string {
    try {
      const parsed = new URL(redisUrl);
      if (parsed.password) parsed.password = '***';
      return parsed.toString();
    } catch {
      return 'REDIS_URL';
    }
  }
}
