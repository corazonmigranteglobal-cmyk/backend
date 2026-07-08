import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { RedisService } from '@/infrastructure/redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly redis: RedisService,
  ) {}

  async check() {
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();
    return {
      status: database === 'ok' && redis === 'ok' ? 'ok' : 'degraded',
      database,
      redis,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<'ok' | 'down'> {
    try {
      await this.sequelize.query('SELECT 1');
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<'ok' | 'degraded' | 'down'> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG' ? 'ok' : 'degraded';
    } catch {
      return 'down';
    }
  }
}
