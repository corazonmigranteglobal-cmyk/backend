import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { RedisService } from '@/infrastructure/redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async check() {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    const allOk = database === 'ok' && redis === 'ok';
    return {
      status: allOk ? 'ok' : 'degraded',
      checks: { database, redis },
      version: process.env['npm_package_version'] ?? 'unknown',
      commit: process.env['GIT_COMMIT'] ?? 'unknown',
      env: process.env['NODE_ENV'] ?? 'unknown',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  version() {
    return {
      version: process.env['npm_package_version'] ?? 'unknown',
      commit: process.env['GIT_COMMIT'] ?? 'unknown',
      buildAt: process.env['BUILD_AT'] ?? 'unknown',
      env: process.env['NODE_ENV'] ?? 'unknown',
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
