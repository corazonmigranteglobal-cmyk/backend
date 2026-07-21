import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  ContentSubscriber,
  DownloadableDownloadEvent,
  DownloadableEntitlement,
  DownloadableExternalEvent,
  DownloadablePublicationLink,
  DownloadableResource,
  DownloadableResourceVersion,
} from '@/database/models';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { DownloadablesService } from './downloadables.service';
import {
  AdminDownloadablesController,
  DownloadablesController,
  DownloadablesWebhookController,
  PublicationDownloadablesController,
} from './downloadables.controller';
import { HotmartAdapter } from './hotmart.adapter';

@Module({
  imports: [
    SequelizeModule.forFeature([
      DownloadableResource,
      DownloadableDownloadEvent,
      DownloadableResourceVersion,
      DownloadableEntitlement,
      DownloadablePublicationLink,
      DownloadableExternalEvent,
      ContentSubscriber,
    ]),
    NotificationsModule,
  ],
  controllers: [
    AdminDownloadablesController,
    DownloadablesController,
    PublicationDownloadablesController,
    DownloadablesWebhookController,
  ],
  providers: [DownloadablesService, HotmartAdapter],
  exports: [DownloadablesService],
})
export class DownloadablesModule {}
