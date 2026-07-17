import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import type { Response } from 'express';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { FileAccessLog, FileAsset } from '@/database/models';
import { buildBackendDownloadUrl, resolvePublicFileUrl } from './file-response.mapper';
import { FileStorageService } from './file-storage.service';
import {
  STORAGE_PROVIDER_CLOUDINARY,
  STORAGE_PROVIDER_GCS,
  STORAGE_PROVIDER_LOCAL,
} from './files.constants';

@Injectable()
export class FilesAccessService {
  constructor(
    @InjectModel(FileAsset) private readonly fileModel: typeof FileAsset,
    @InjectModel(FileAccessLog) private readonly accessLogModel: typeof FileAccessLog,
    private readonly config: ConfigService,
    private readonly storage: FileStorageService,
  ) {}

  async getDownloadInfo(user: AuthenticatedUser | undefined, id: string) {
    const file = await this.findAllowedFile(user, id);
    await this.recordAccess(file.id, user?.sub, 'SIGNED_URL');
    if (file.storageProvider === STORAGE_PROVIDER_GCS) {
      return this.storage.getGcsSignedUrl(file);
    }
    if (file.storageProvider === STORAGE_PROVIDER_CLOUDINARY) {
      return {
        fileId: file.id,
        provider: STORAGE_PROVIDER_CLOUDINARY,
        url: resolvePublicFileUrl(this.config, file),
        expiresInSeconds: null,
      };
    }
    return {
      fileId: file.id,
      provider: STORAGE_PROVIDER_LOCAL,
      url: buildBackendDownloadUrl(this.config, file.id),
      expiresInSeconds: this.config.get<number>('files.signedUrlExpiresSeconds') ?? 900,
    };
  }

  async downloadLocal(
    user: AuthenticatedUser | undefined,
    id: string,
    response: Response,
  ) {
    const file = await this.findAllowedFile(user, id);
    if (file.storageProvider === STORAGE_PROVIDER_GCS) {
      response.redirect((await this.storage.getGcsSignedUrl(file)).url);
      return undefined;
    }
    if (file.storageProvider === STORAGE_PROVIDER_CLOUDINARY) {
      response.redirect(resolvePublicFileUrl(this.config, file));
      return undefined;
    }

    const localPath = this.storage.resolveLocalPath(file.objectKey);
    try {
      await access(localPath);
    } catch {
      throw new NotFoundException({
        code: 'FILE_OBJECT_NOT_FOUND',
        message: 'El archivo físico no existe en almacenamiento local.',
      });
    }
    await this.recordAccess(file.id, user?.sub, 'DOWNLOAD');
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      `${file.mimeType.startsWith('image/') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    );
    return new StreamableFile(createReadStream(localPath));
  }

  private async findAllowedFile(user: AuthenticatedUser | undefined, id: string) {
    const file = await this.fileModel.findByPk(id);
    if (!file || file.status !== 'ACTIVE') {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'Archivo no encontrado.' });
    }
    const isOwner = user?.sub === file.ownerUserId;
    const isAdmin = user?.roles?.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role));
    if (file.visibility !== 'PUBLIC' && !isOwner && !isAdmin) {
      throw new ForbiddenException({ code: 'FILE_FORBIDDEN', message: 'No puede acceder a este archivo.' });
    }
    return file;
  }

  private async recordAccess(fileId: string, actorUserId: string | undefined, action: string) {
    await this.accessLogModel.create({ fileId, actorUserId, action } as never);
  }
}
