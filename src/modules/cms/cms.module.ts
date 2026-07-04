import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CmsElement, CmsPage } from '@/database/models';
import { AuditModule } from '../audit/audit.module';
import {
  AdminCmsController,
  CmsController,
  PublicCmsElementsController,
  PublicViewsController,
} from './cms.controller';
import { CmsService } from './cms.service';
@Module({
  imports: [SequelizeModule.forFeature([CmsPage, CmsElement]), AuditModule],
  controllers: [
    CmsController,
    PublicCmsElementsController,
    PublicViewsController,
    AdminCmsController,
  ],
  providers: [CmsService],
})
export class CmsModule {}
