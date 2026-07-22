import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PaginationQueryDto } from '@/common/pagination/pagination.dto';
import { FileAsset } from '@/database/models';
import { AuditService } from '../audit/audit.service';
import { CloudinaryDirectUploadService } from './cloudinary-direct-upload.service';
import {
  CloudinaryUploadSignatureDto,
  CompleteCloudinaryUploadDto,
  UpdateFileDto,
  UploadFileDto,
} from './dto/file.dto';
import { FilesAccessService } from './files-access.service';
import { FilesAdminService } from './files-admin.service';
import { FileSecurityService } from './file-security.service';
import { FileStorageService } from './file-storage.service';
import { buildBackendDownloadUrl, toFileResponse } from './file-response.mapper';
import { STORAGE_PROVIDER_CLOUDINARY } from './files.constants';

/**
 * Coordinates file registration while delegating storage, access, direct-upload,
 * and administration responsibilities to focused services.
 */
@Injectable()
export class FilesService {
  constructor(
    @InjectModel(FileAsset) private readonly fileModel: typeof FileAsset,
    private readonly config: ConfigService,
    private readonly storage: FileStorageService,
    private readonly security: FileSecurityService,
    private readonly directUpload: CloudinaryDirectUploadService,
    private readonly admin: FilesAdminService,
    private readonly access: FilesAccessService,
    private readonly audit: AuditService,
  ) {}

  async upload(user: AuthenticatedUser, dto: UploadFileDto, file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Archivo requerido.' });
    }

    try {
      const validatedFile = await this.security.validateTemporaryFile(file);
      if (
        this.storage.storageProvider === STORAGE_PROVIDER_CLOUDINARY &&
        validatedFile.mimeType.startsWith('image/')
      ) {
        throw new BadRequestException({
          code: 'CLOUDINARY_DIRECT_UPLOAD_REQUIRED',
          message: 'Las imágenes públicas deben subirse directamente a Cloudinary.',
        });
      }

      const objectKey = this.buildObjectKey(dto.module, user.sub, validatedFile.extension);
      const storedFile = await this.storage.store(file, objectKey, dto.module);
      let externalObjectCreated = true;
      try {
        const response = await this.fileModel.sequelize!.transaction(async (transaction) => {
          const record = await this.fileModel.create(
            {
              ownerUserId: user.sub,
              module: dto.module,
              entityType: dto.entityType,
              entityId: dto.entityId,
              storageProvider: storedFile.storageProvider,
              bucket: storedFile.bucket,
              objectKey: storedFile.objectKey,
              originalName: validatedFile.originalName,
              mimeType: validatedFile.mimeType,
              sizeBytes: file.size,
              checksum: validatedFile.checksum,
              visibility: dto.visibility ?? 'PUBLIC',
              status: 'ACTIVE',
              metadata: storedFile.metadata,
            } as never,
            { transaction },
          );
          const publicUrl =
            typeof storedFile.metadata.publicUrl === 'string'
              ? storedFile.metadata.publicUrl
              : buildBackendDownloadUrl(this.config, record.id);
          await record.update(
            { metadata: { ...storedFile.metadata, publicUrl, downloadUrl: publicUrl } } as never,
            { transaction },
          );
          await this.audit.log(
            {
              actorUserId: user.sub,
              action: 'files.upload',
              entityType: 'FileAsset',
              entityId: record.id,
              after: {
                module: dto.module,
                visibility: record.visibility,
                storageProvider: storedFile.storageProvider,
              },
            },
            { transaction },
          );
          return toFileResponse(this.config, record, publicUrl);
        });
        externalObjectCreated = false;
        return response;
      } finally {
        if (externalObjectCreated) {
          await this.storage
            .deleteObject(storedFile.storageProvider, storedFile.bucket, storedFile.objectKey)
            .catch(() => undefined);
        }
      }
    } finally {
      await this.storage.cleanupTemporaryFile(file.path);
    }
  }

  createCloudinaryUploadSignature(user: AuthenticatedUser, dto: CloudinaryUploadSignatureDto) {
    return this.directUpload.createSignature(user, dto);
  }

  completeCloudinaryUpload(user: AuthenticatedUser, dto: CompleteCloudinaryUploadDto) {
    return this.directUpload.complete(user, dto);
  }

  listAdmin(query: PaginationQueryDto) {
    return this.admin.list(query);
  }

  getAdmin(id: string) {
    return this.admin.get(id);
  }

  updateAdmin(actorUserId: string, id: string, dto: UpdateFileDto) {
    return this.admin.update(actorUserId, id, dto);
  }

  deleteAdmin(actorUserId: string, id: string) {
    return this.admin.delete(actorUserId, id);
  }

  getDownloadInfo(user: AuthenticatedUser | undefined, id: string) {
    return this.access.getDownloadInfo(user, id);
  }

  downloadLocal(
    user: AuthenticatedUser | undefined,
    id: string,
    response: Parameters<FilesAccessService['downloadLocal']>[2],
  ) {
    return this.access.downloadLocal(user, id, response);
  }

  private buildObjectKey(moduleCode: string, userId: string, extension: string) {
    const configPrefix =
      this.storage.storageProvider === STORAGE_PROVIDER_CLOUDINARY
        ? 'files.cloudinary'
        : 'files.gcs';
    const prefix = ['CMS', 'THERAPY_CATALOG'].includes(moduleCode)
      ? (this.config.get<string>(`${configPrefix}.publicAssetsPrefix`) ?? 'public')
      : (this.config.get<string>(`${configPrefix}.userMediaPrefix`) ?? 'users');
    return `${prefix}/${moduleCode.toLowerCase()}/${userId}/${randomUUID()}${extension}`;
  }
}
