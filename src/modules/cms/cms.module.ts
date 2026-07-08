import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CmsElement, CmsPage, ContentPublication } from '@/database/models';
import { AuditModule } from '../audit/audit.module';
import { CmsController, AdminCmsController, AdminPublicPagesController } from './cms.controller';
import { CmsService } from './cms.service';
@Module({
  imports: [SequelizeModule.forFeature([CmsPage, CmsElement, ContentPublication]), AuditModule],
  controllers: [CmsController, AdminCmsController, AdminPublicPagesController],
  providers: [CmsService],
})
export class CmsModule {}
