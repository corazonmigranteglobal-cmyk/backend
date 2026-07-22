import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { FileAsset } from '@/database/models';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { AuditService } from '../audit/audit.service';
import { CloudinaryUploadSignatureDto, CompleteCloudinaryUploadDto } from './dto/file.dto';
import { FileSecurityService } from './file-security.service';
import { toFileResponse } from './file-response.mapper';
import {
  ALLOWED_FILE_TYPES,
  CLOUDINARY_DIRECT_UPLOAD_TTL_SECONDS,
  STORAGE_PROVIDER_CLOUDINARY,
} from './files.constants';

@Injectable()
export class CloudinaryDirectUploadService {
  constructor(
    @InjectModel(FileAsset) private readonly fileModel: typeof FileAsset,
    private readonly config: ConfigService,
    private readonly security: FileSecurityService,
    private readonly audit: AuditService,
  ) {}

  createSignature(user: AuthenticatedUser, dto: CloudinaryUploadSignatureDto) {
    this.ensureAvailable();
    this.security.assertDirectUploadInput(dto.originalName, dto.mimeType, dto.sizeBytes);
    if (dto.visibility && dto.visibility !== 'PUBLIC') {
      throw new BadRequestException({
        code: 'CLOUDINARY_IMAGES_ARE_PUBLIC',
        message: 'Las imágenes de Cloudinary se registran como públicas.',
      });
    }

    const extension = ALLOWED_FILE_TYPES[dto.mimeType as keyof typeof ALLOWED_FILE_TYPES];
    const objectKey = this.buildObjectKey(dto.module, user.sub, extension);
    const publicId = this.buildPublicId(objectKey);
    const timestamp = Math.floor(Date.now() / 1_000);
    const expiresAt = timestamp + CLOUDINARY_DIRECT_UPLOAD_TTL_SECONDS;
    const { cloudName, apiKey, apiSecret } = this.getConfiguration();
    const uploadParams = { public_id: publicId, timestamp };

    return {
      provider: STORAGE_PROVIDER_CLOUDINARY,
      cloudName,
      apiKey,
      timestamp,
      expiresAt,
      expiresInSeconds: CLOUDINARY_DIRECT_UPLOAD_TTL_SECONDS,
      publicId,
      signature: this.signParams(uploadParams, apiSecret),
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      uploadParams,
      uploadToken: this.security.signUploadToken({
        v: 1,
        userId: user.sub,
        publicId,
        objectKey: publicId,
        module: dto.module,
        entityType: dto.entityType ?? null,
        entityId: dto.entityId ?? null,
        visibility: 'PUBLIC',
        originalName: this.security.cleanOriginalName(dto.originalName),
        mimeType: dto.mimeType as keyof typeof ALLOWED_FILE_TYPES,
        sizeBytes: dto.sizeBytes,
        exp: expiresAt,
      }),
    };
  }

  async complete(user: AuthenticatedUser, dto: CompleteCloudinaryUploadDto) {
    const token = this.security.verifyUploadToken(dto.uploadToken);
    const { cloudName, apiSecret } = this.getConfiguration();
    if (token.exp < Math.floor(Date.now() / 1_000)) {
      throw new BadRequestException({ code: 'CLOUDINARY_UPLOAD_TOKEN_EXPIRED' });
    }
    if (token.userId !== user.sub) {
      throw new ForbiddenException({ code: 'CLOUDINARY_UPLOAD_TOKEN_USER_MISMATCH' });
    }
    if (dto.publicId !== token.publicId) {
      throw new BadRequestException({ code: 'CLOUDINARY_PUBLIC_ID_MISMATCH' });
    }

    this.assertTrustedUrl(dto.secureUrl, cloudName, token.publicId);
    this.assertProviderResponse(token.publicId, token.sizeBytes, dto, apiSecret);

    return this.fileModel.sequelize!.transaction(async (transaction) => {
      const existing = await this.fileModel.findOne({
        where: { storageProvider: STORAGE_PROVIDER_CLOUDINARY, objectKey: token.publicId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existing) return toFileResponse(this.config, existing);

      const publicUrl = dto.secureUrl.trim();
      const record = await this.fileModel.create(
        {
          ownerUserId: user.sub,
          module: token.module,
          entityType: token.entityType ?? undefined,
          entityId: token.entityId ?? undefined,
          storageProvider: STORAGE_PROVIDER_CLOUDINARY,
          bucket: cloudName,
          objectKey: token.publicId,
          originalName: token.originalName,
          mimeType: token.mimeType,
          sizeBytes: dto.bytes,
          checksum: dto.assetId,
          visibility: 'PUBLIC',
          status: 'ACTIVE',
          metadata: {
            publicUrl,
            downloadUrl: publicUrl,
            directClientUpload: true,
            cloudinary: {
              cloudName,
              publicId: token.publicId,
              assetId: dto.assetId,
              version: dto.version,
              format: dto.format,
              resourceType: dto.resourceType,
              bytes: dto.bytes,
            },
          },
        } as never,
        { transaction },
      );
      await this.audit.log(
        {
          actorUserId: user.sub,
          action: 'files.cloudinary.complete',
          entityType: 'FileAsset',
          entityId: record.id,
          after: { module: record.module, publicUrl, directClientUpload: true },
        },
        { transaction },
      );
      return toFileResponse(this.config, record, publicUrl);
    });
  }

  private assertProviderResponse(
    publicId: string,
    authorizedBytes: number,
    dto: CompleteCloudinaryUploadDto,
    apiSecret: string,
  ) {
    if (dto.resourceType.toLowerCase() !== 'image') {
      throw new BadRequestException({ code: 'CLOUDINARY_RESOURCE_TYPE_INVALID' });
    }
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(dto.format.toLowerCase())) {
      throw new BadRequestException({ code: 'CLOUDINARY_FORMAT_INVALID' });
    }
    if (dto.bytes < 1 || dto.bytes > authorizedBytes) {
      throw new BadRequestException({ code: 'CLOUDINARY_BYTES_MISMATCH' });
    }
    const expected = this.signParams({ public_id: publicId, version: dto.version }, apiSecret);
    const actualBuffer = Buffer.from(dto.signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new BadRequestException({ code: 'CLOUDINARY_RESPONSE_SIGNATURE_INVALID' });
    }
  }

  private assertTrustedUrl(secureUrl: string, cloudName: string, publicId: string) {
    const parsedUrl = new URL(secureUrl);
    const decodedPath = decodeURIComponent(parsedUrl.pathname);
    if (
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.hostname !== 'res.cloudinary.com' ||
      !decodedPath.startsWith(`/${cloudName}/`) ||
      !decodedPath.includes(publicId)
    ) {
      throw new BadRequestException({ code: 'CLOUDINARY_URL_NOT_TRUSTED' });
    }
  }

  private ensureAvailable() {
    if (
      (this.config.get<string>('files.storageProvider') ?? '').toUpperCase() !==
      STORAGE_PROVIDER_CLOUDINARY
    ) {
      throw new BadRequestException({ code: 'CLOUDINARY_DIRECT_UPLOAD_UNAVAILABLE' });
    }
    this.getConfiguration();
  }

  private getConfiguration() {
    const cloudName = this.config.get<string>('files.cloudinary.cloudName')?.trim();
    const apiKey = this.config.get<string>('files.cloudinary.apiKey')?.trim();
    const apiSecret = this.config.get<string>('files.cloudinary.apiSecret')?.trim();
    const folder = (this.config.get<string>('files.cloudinary.folder') ?? 'corazon-migrante')
      .trim()
      .replace(/^\/+|\/+$/g, '');
    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestException({ code: 'CLOUDINARY_NOT_CONFIGURED' });
    }
    return { cloudName, apiKey, apiSecret, folder };
  }

  private buildObjectKey(moduleCode: string, userId: string, extension: string) {
    const prefix = ['CMS', 'THERAPY_CATALOG'].includes(moduleCode)
      ? (this.config.get<string>('files.cloudinary.publicAssetsPrefix') ?? 'public')
      : (this.config.get<string>('files.cloudinary.userMediaPrefix') ?? 'users');
    return `${prefix}/${moduleCode.toLowerCase()}/${userId}/${randomUUID()}${extension}`;
  }

  private buildPublicId(objectKey: string) {
    const { folder } = this.getConfiguration();
    const withoutExtension = objectKey.replace(/\.[^/.]+$/, '');
    return folder ? `${folder}/${withoutExtension}` : withoutExtension;
  }

  private signParams(params: Record<string, string | number>, apiSecret: string) {
    const payload = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
  }
}
