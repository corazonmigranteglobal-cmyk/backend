import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { FileAccessLog, FileAsset } from '@/database/models';
import { AuditModule } from '../audit/audit.module';
import { AdminFilesController } from './admin-files.controller';
import { FilesController } from './files.controller';
import { CloudinaryDirectUploadService } from './cloudinary-direct-upload.service';
import { FilesAccessService } from './files-access.service';
import { FilesAdminService } from './files-admin.service';
import { FileSecurityService } from './file-security.service';
import { FileStorageService } from './file-storage.service';
import { FilesService } from './files.service';

@Module({
  imports: [ConfigModule, SequelizeModule.forFeature([FileAsset, FileAccessLog]), AuditModule],
  controllers: [FilesController, AdminFilesController],
  providers: [
    FilesService,
    FileStorageService,
    FileSecurityService,
    CloudinaryDirectUploadService,
    FilesAdminService,
    FilesAccessService,
  ],
  exports: [FilesService],
})
export class FilesModule {}
