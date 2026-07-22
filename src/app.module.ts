import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PinoLoggerService } from './common/logging/pino-logger.service';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { DatabaseBootstrapModule } from './database/bootstrap/database-bootstrap.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { AdvertisingModule } from './modules/advertising/advertising.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CmsModule } from './modules/cms/cms.module';
import { ContentModule } from './modules/content/content.module';
import { FilesModule } from './modules/files/files.module';
import { HealthModule } from './modules/health/health.module';
import { HomepageModule } from './modules/homepage/homepage.module';
import { LegacyCompatibilityModule } from './modules/legacy-compatibility/legacy-compatibility.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { DownloadablesModule } from './modules/downloadables/downloadables.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RolesPermissionsModule } from './modules/roles-permissions/roles-permissions.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { TherapyCatalogModule } from './modules/therapy-catalog/therapy-catalog.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttler.ttl') ?? 60_000,
          limit: config.get<number>('throttler.limit') ?? 120,
        },
      ],
    }),
    DatabaseModule,
    DatabaseBootstrapModule,
    RedisModule,
    JwtModule.register({}),
    RolesPermissionsModule,
    AuditModule,
    MessagingModule,
    AuthModule,
    UsersModule,
    TherapyCatalogModule,
    SchedulingModule,
    AppointmentsModule,
    FilesModule,
    CmsModule,
    AccountingModule,
    AnalyticsModule,
    ContentModule,
    AdvertisingModule,
    HomepageModule,
    HealthModule,
    LegacyCompatibilityModule,
    NotificationsModule,
    DownloadablesModule,
  ],
  providers: [
    PinoLoggerService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
