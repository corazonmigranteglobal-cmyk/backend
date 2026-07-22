import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  ContentAuthor,
  ContentCategory,
  ContentPublication,
  ContentPublicationTag,
  ContentSubscriber,
  ContentTag,
  PatientProfile,
  User,
} from '@/database/models';
import { AuditModule } from '../audit/audit.module';
import { AdminContentController } from './admin-content.controller';
import { PublicContentAliasController, PublicContentController } from './public-content.controller';
import { PremiumContentController } from './premium-content.controller';
import { ContentAuthorsService } from './content-authors.service';
import { ContentPublicationAuditService } from './content-publication-audit.service';
import { ContentPublicationRelationsService } from './content-publication-relations.service';
import { ContentPublicationsService } from './content-publications.service';
import { ContentTaxonomyService } from './content-taxonomy.service';
import { ContentSubscribersService } from './content-subscribers.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      ContentAuthor,
      ContentCategory,
      ContentPublication,
      ContentPublicationTag,
      ContentSubscriber,
      ContentTag,
      PatientProfile,
      User,
    ]),
    AuditModule,
  ],
  controllers: [
    PublicContentController,
    PublicContentAliasController,
    AdminContentController,
    PremiumContentController,
  ],
  providers: [
    ContentAuthorsService,
    ContentPublicationAuditService,
    ContentPublicationRelationsService,
    ContentPublicationsService,
    ContentTaxonomyService,
    ContentSubscribersService,
  ],
  exports: [ContentPublicationsService, ContentTaxonomyService, ContentSubscribersService],
})
export class ContentModule {}
