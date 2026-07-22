import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { databaseModels } from './models';

const databaseLogger = new Logger('Sequelize');

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logQueries = config.get<boolean>('database.logging') === true;
        const sslEnabled = config.get<boolean>('database.ssl') === true;
        const sslCa = config.get<string>('database.sslCa');

        return {
          dialect: 'postgres' as const,
          host: config.get<string>('database.host'),
          port: config.get<number>('database.port'),
          database: config.get<string>('database.name'),
          username: config.get<string>('database.user'),
          password: config.get<string>('database.password'),
          models: databaseModels,
          autoLoadModels: false,
          synchronize: false,
          timezone: '+00:00',
          benchmark: logQueries,
          logging: logQueries
            ? (sql: string, timing?: number) =>
                databaseLogger.debug(`SQL completed in ${timing ?? 0} ms: ${sql}`)
            : false,
          dialectOptions: {
            application_name:
              config.get<string>('database.applicationName') ?? 'corazon-migrante-backend',
            connectionTimeoutMillis: config.get<number>('database.connectionTimeoutMs') ?? 15_000,
            statement_timeout: config.get<number>('database.statementTimeoutMs') ?? 30_000,
            idle_in_transaction_session_timeout:
              config.get<number>('database.idleTransactionTimeoutMs') ?? 30_000,
            keepAlive: true,
            ssl: sslEnabled
              ? {
                  require: true,
                  rejectUnauthorized:
                    config.get<boolean>('database.sslRejectUnauthorized') !== false,
                  ...(sslCa ? { ca: sslCa } : {}),
                }
              : undefined,
          },
          pool: {
            max: config.get<number>('database.poolMax') ?? 10,
            min: config.get<number>('database.poolMin') ?? 0,
            idle: config.get<number>('database.poolIdleMs') ?? 10_000,
            acquire: config.get<number>('database.poolAcquireMs') ?? 30_000,
            evict: 1_000,
          },
          retry: { max: 2 },
        };
      },
    }),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
