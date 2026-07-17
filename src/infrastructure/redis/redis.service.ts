import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client?: Redis;
  private readonly enabled: boolean;
  private readonly endpointLabel: string;
  private readonly scanCount: number;
  private readonly deleteBatchSize: number;
  private readonly maxPatternDeleteKeys: number;
  private connectionPromise?: Promise<void>;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('redis.enabled') !== false;
    this.scanCount = this.config.get<number>('redis.scanCount') ?? 250;
    this.deleteBatchSize = this.config.get<number>('redis.deleteBatchSize') ?? 250;
    this.maxPatternDeleteKeys =
      this.config.get<number>('redis.maxPatternDeleteKeys') ?? 10_000;

    if (!this.enabled) {
      this.endpointLabel = 'disabled';
      this.logger.warn('Redis is disabled by REDIS_ENABLED=false.');
      return;
    }

    const redisUrl = this.config.get<string>('redis.url');
    const host = this.config.get<string>('redis.host') ?? 'localhost';
    const port = this.config.get<number>('redis.port') ?? 6379;
    const database = this.config.get<number>('redis.database') ?? 0;
    const tls = this.config.get<boolean>('redis.tls') === true;

    this.endpointLabel = redisUrl ? this.maskRedisUrl(redisUrl) : `${host}:${port}/${database}`;

    const commonOptions: RedisOptions = {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: this.config.get<number>('redis.connectTimeoutMs') ?? 5_000,
      commandTimeout: this.config.get<number>('redis.commandTimeoutMs') ?? 5_000,
      tls: tls ? {} : undefined,
      retryStrategy: (attempt) => Math.min(attempt * 250, 2_000),
    };

    this.client = redisUrl
      ? new Redis(redisUrl, commonOptions)
      : new Redis({
          host,
          port,
          username: this.config.get<string>('redis.username') || undefined,
          password: this.config.get<string>('redis.password') || undefined,
          db: database,
          ...commonOptions,
        });

    this.client.on('error', (error: NodeJS.ErrnoException) => {
      const reason = error.code ?? error.message ?? String(error);
      this.logger.warn(`Redis unavailable (${this.endpointLabel}): ${reason}`);
    });
  }

  get rawClient() {
    if (!this.client) throw new ServiceUnavailableException('Redis is disabled.');
    return this.client;
  }

  async ping(): Promise<'PONG'> {
    await this.ensureConnected();
    return this.rawClient.ping() as Promise<'PONG'>;
  }

  async getJson<T>(key: string): Promise<T | null> {
    await this.ensureConnected();
    const value = await this.rawClient.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      this.logger.warn(`Discarding malformed JSON cache value for key ${key}.`);
      await this.rawClient.unlink(key);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 86_400) {
      throw new RangeError('Redis JSON TTL must be between 1 and 86400 seconds.');
    }
    await this.ensureConnected();
    await this.rawClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  /**
   * Deletes matching keys incrementally. SCAN avoids the event-loop and Redis
   * blocking behavior caused by KEYS on large production datasets.
   */
  async delByPattern(pattern: string): Promise<number> {
    await this.ensureConnected();

    let cursor = '0';
    let deletedKeys = 0;
    do {
      const [nextCursor, keys] = await this.rawClient.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        this.scanCount,
      );
      cursor = nextCursor;

      if (deletedKeys + keys.length > this.maxPatternDeleteKeys) {
        this.logger.warn(
          `Pattern deletion stopped at the configured safety limit (${this.maxPatternDeleteKeys}).`,
        );
        break;
      }

      for (let index = 0; index < keys.length; index += this.deleteBatchSize) {
        const batch = keys.slice(index, index + this.deleteBatchSize);
        if (batch.length > 0) deletedKeys += await this.rawClient.unlink(...batch);
      }
    } while (cursor !== '0');

    return deletedKeys;
  }

  async onModuleDestroy() {
    if (!this.client || this.client.status === 'end') return;

    try {
      if (this.client.status === 'ready') {
        await this.client.quit();
      } else {
        this.client.disconnect();
      }
    } catch {
      this.client.disconnect();
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client) throw new ServiceUnavailableException('Redis is disabled.');
    if (this.client.status === 'ready') return;

    if (this.client.status === 'wait') {
      if (!this.connectionPromise) {
        this.connectionPromise = this.client.connect().finally(() => {
          this.connectionPromise = undefined;
        });
      }
      await this.connectionPromise;
      return;
    }

    throw new ServiceUnavailableException(
      `Redis is not ready (${this.endpointLabel}, status=${this.client.status}).`,
    );
  }

  private maskRedisUrl(redisUrl: string): string {
    try {
      const parsedUrl = new URL(redisUrl);
      if (parsedUrl.password) parsedUrl.password = '***';
      return parsedUrl.toString();
    } catch {
      return 'REDIS_URL';
    }
  }
}
