import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { RedisModule } from '@/infrastructure/redis/redis.module';

@Module({
  imports: [ConfigModule, SequelizeModule, RedisModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
