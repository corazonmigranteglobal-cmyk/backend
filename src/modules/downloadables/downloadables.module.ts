import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  ContentSubscriber,
  DownloadableDownloadEvent,
  DownloadableResource,
} from '@/database/models';
import { DownloadablesService } from './downloadables.service';
import {
  AdminDownloadablesController,
  DownloadablesController,
} from './downloadables.controller';
import { HotmartAdapter } from './hotmart.adapter';

@Module({
  imports: [
    SequelizeModule.forFeature([
      DownloadableResource,
      DownloadableDownloadEvent,
      ContentSubscriber,
    ]),
  ],
  controllers: [AdminDownloadablesController, DownloadablesController],
  providers: [DownloadablesService, HotmartAdapter],
  exports: [DownloadablesService],
})
export class DownloadablesModule {}
