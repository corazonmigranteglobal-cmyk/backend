import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Storage } from '@google-cloud/storage';
import { createHash, createHmac, randomUUID } from 'crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync } from 'fs';
import { dirname, extname, join } from 'path';
import { Op } from 'sequelize';
import { Response } from 'express';
import { FileAccessLog, FileAsset } from '@/database/models';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto, buildPagination, buildSafeOrder, toLimitOffset } from '@/common/pagination/pagination.dto';
import { CloudinaryUploadSignatureDto, CompleteCloudinaryUploadDto, UpdateFileDto, UploadFileDto } from './dto/file.dto';

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const STORAGE_PROVIDER_LOCAL = 'LOCAL';
const STORAGE_PROVIDER_GCS = 'GCS';
const STORAGE_PROVIDER_CLOUDINARY = 'CLOUDINARY';
const CLOUDINARY_DIRECT_UPLOAD_TTL_SECONDS = 10 * 60;

@Injectable()
export class FilesService {
  private readonly gcs?: Storage;

  constructor(
    @InjectModel(FileAsset) private readonly fileModel: typeof FileAsset,
    @InjectModel(FileAccessLog) private readonly accessLogModel: typeof FileAccessLog,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    if (this.storageProvider === STORAGE_PROVIDER_GCS) {
      const projectId = this.config.get<string>('files.gcs.projectId') || undefined;
      const credentials =
        this.config.get<Record<string, unknown>>('files.gcs.credentials') || undefined;
      const keyFilename = !credentials
        ? this.config.get<string>('files.gcs.keyFilename') || undefined
        : undefined;
      this.gcs = new Storage({
        ...(projectId ? { projectId } : {}),
        ...(credentials ? { credentials } : {}),
        ...(keyFilename ? { keyFilename } : {}),
      });
    }
  }

  private get storageProvider() {
    return (
      this.config.get<string>('files.storageProvider') ?? STORAGE_PROVIDER_CLOUDINARY
    ).toUpperCase();
  }

  private get gcsBucketName() {
    return this.config.get<string>('files.gcs.bucket');
  }

  private get shouldFallbackGcsUploadToLocal() {
    return this.config.get<boolean>('files.gcs.uploadFallbackToLocal') === true;
  }

  private buildBackendDownloadUrl(fileId: string) {
    const baseUrl = (this.config.get<string>('files.publicBaseUrl') ?? '').replace(/\/+$/, '');
    const apiPrefix = (process.env.API_PREFIX ?? 'api/v1').replace(/^\/+|\/+$/g, '');
    return `${baseUrl}/${apiPrefix}/files/${fileId}/download`;
  }

  private resolvePublicUrl(record: FileAsset) {
    const metadata = (record.metadata ?? {}) as Record<string, unknown>;
    const metadataUrl = metadata.publicUrl ?? metadata.downloadUrl ?? metadata.url;
    return typeof metadataUrl === 'string' && metadataUrl.trim()
      ? metadataUrl
      : this.buildBackendDownloadUrl(record.id);
  }

  private decorateFileResponse(record: FileAsset, publicUrl = this.resolvePublicUrl(record)) {
    const plain = record.toJSON() as unknown as Record<string, unknown>;
    
    return {
      ...plain,
      fileId: record.id,
      url: publicUrl,
      publicUrl,
      downloadUrl: publicUrl,
    };
  }

  private resolveGcsBucket(module: string) {
    const normalizedModule = (module ?? '').toUpperCase();
    if (normalizedModule === 'CMS' || normalizedModule === 'THERAPY_CATALOG') {
      return (
        this.config.get<string>('files.gcs.publicAssetsBucket') ||
        this.config.get<string>('files.gcs.bucket')
      );
    }
    return (
      this.config.get<string>('files.gcs.userMediaBucket') ||
      this.config.get<string>('files.gcs.bucket')
    );
  }

  async upload(user: AuthenticatedUser, dto: UploadFileDto, file?: Express.Multer.File) {
    if (!file)
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Archivo requerido.' });
    if (!ALLOWED_MIME.includes(file.mimetype))
      throw new BadRequestException({
        code: 'FILE_MIME_NOT_ALLOWED',
        message: 'Tipo de archivo no permitido.',
      });
    const maxBytes = (this.config.get<number>('files.maxUploadMb') ?? 8) * 1024 * 1024;
    if (file.size > maxBytes)
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'El archivo excede el tamaño máximo.',
      });

    if (this.storageProvider === STORAGE_PROVIDER_CLOUDINARY && file.mimetype.startsWith('image/')) {
      if (existsSync(file.path)) {
        unlinkSync(file.path);
      }
      throw new BadRequestException({
        code: 'CLOUDINARY_DIRECT_UPLOAD_REQUIRED',
        message:
          'Las imagenes publicas deben subirse directo desde el frontend a Cloudinary. Usa /files/cloudinary/signature y luego /files/cloudinary/complete para registrar la URL.',
      });
    }

    const safeExt = extname(file.originalname).toLowerCase();
    const checksum = createHash('sha256').update(readFileSync(file.path)).digest('hex');

    let storageProvider = this.storageProvider;
    let objectKey = this.buildObjectKey(dto.module, user.sub, safeExt);
    let bucket = storageProvider === STORAGE_PROVIDER_GCS ? this.resolveGcsBucket(dto.module) : undefined;
    let providerMetadata: Record<string, unknown> = {};
    let fallbackMetadata: Record<string, unknown> = {};

    let externalObjectCreated = false;
    try {
      if (storageProvider === STORAGE_PROVIDER_GCS) {
        try {
          await this.uploadToGcs(file, objectKey, bucket);
        } catch (error) {
          if (!this.shouldFallbackGcsUploadToLocal) throw error;

          fallbackMetadata = {
            gcsFallbackToLocal: true,
            originalStorageProvider: STORAGE_PROVIDER_GCS,
            originalBucket: bucket,
            originalObjectKey: objectKey,
            gcsError: this.extractProviderError(error),
          };
          storageProvider = STORAGE_PROVIDER_LOCAL;
          bucket = undefined;
          this.moveToLocalStorage(file, objectKey);
        }
      } else if (storageProvider === STORAGE_PROVIDER_CLOUDINARY) {
        const uploaded = await this.uploadToCloudinary(file, objectKey);
        objectKey = uploaded.objectKey;
        bucket = uploaded.bucket;
        providerMetadata = uploaded.metadata;
      } else {
        this.moveToLocalStorage(file, objectKey);
      }
      externalObjectCreated = true;

      return await this.fileModel.sequelize!.transaction(async (transaction) => {
        const record = await this.fileModel.create(
          {
            ownerUserId: user.sub,
            module: dto.module,
            entityType: dto.entityType,
            entityId: dto.entityId,
            storageProvider,
            bucket,
            objectKey,
            originalName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            checksum,
            visibility: dto.visibility ?? 'PUBLIC',
            status: 'ACTIVE',
            metadata: { ...fallbackMetadata, ...providerMetadata },
          } as any,
          { transaction },
        );

        const publicUrl =
          typeof providerMetadata.publicUrl === 'string' && providerMetadata.publicUrl.trim()
            ? providerMetadata.publicUrl
            : this.buildBackendDownloadUrl(record.id);
        await record.update(
          { metadata: { ...(record.metadata ?? {}), publicUrl, downloadUrl: publicUrl } } as any,
          { transaction },
        );

        await this.audit.log(
          {
            actorUserId: user.sub,
            action: 'files.upload',
            entityType: 'FileAsset',
            entityId: record.id,
            after: { module: dto.module, visibility: record.visibility, storageProvider, publicUrl },
          },
          { transaction },
        );

        return this.decorateFileResponse(record, publicUrl);
      });
    } catch (error) {
      if (externalObjectCreated) {
        await this.deleteExternalObject(storageProvider, bucket, objectKey);
      }
      if (existsSync(file.path)) {
        unlinkSync(file.path);
      }
      throw error;
    }
  }


  async createCloudinaryUploadSignature(user: AuthenticatedUser, dto: CloudinaryUploadSignatureDto) {
    this.ensureCloudinaryDirectUploadAvailable();
    this.assertDirectUploadInput(dto.originalName, dto.mimeType, dto.sizeBytes);
    if (dto.visibility && dto.visibility !== 'PUBLIC') {
      throw new BadRequestException({
        code: 'CLOUDINARY_IMAGES_ARE_PUBLIC',
        message: 'Las fotos subidas a Cloudinary se registran como publicas.',
      });
    }

    const safeExt = this.extFromMimeType(dto.mimeType, dto.originalName);
    const objectKey = this.buildObjectKey(dto.module, user.sub, safeExt);
    const publicId = this.buildCloudinaryPublicId(objectKey);
    const timestamp = Math.floor(Date.now() / 1000);
    const expiresAt = timestamp + CLOUDINARY_DIRECT_UPLOAD_TTL_SECONDS;
    const { cloudName, apiKey, apiSecret } = this.getCloudinaryConfig();
    const uploadParams = { public_id: publicId, timestamp };
    const signature = this.signCloudinaryParams(uploadParams, apiSecret);
    const uploadToken = this.signDirectUploadToken({
      v: 1,
      userId: user.sub,
      publicId,
      objectKey: publicId,
      module: dto.module,
      entityType: dto.entityType ?? null,
      entityId: dto.entityId ?? null,
      visibility: 'PUBLIC',
      originalName: this.cleanOriginalName(dto.originalName),
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      exp: expiresAt,
    });

    return {
      provider: STORAGE_PROVIDER_CLOUDINARY,
      cloudName,
      apiKey,
      timestamp,
      expiresAt,
      expiresInSeconds: CLOUDINARY_DIRECT_UPLOAD_TTL_SECONDS,
      publicId,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      uploadParams,
      uploadToken,
    };
  }

  async completeCloudinaryUpload(user: AuthenticatedUser, dto: CompleteCloudinaryUploadDto) {
    const token = this.verifyDirectUploadToken(dto.uploadToken);
    const { cloudName } = this.getCloudinaryConfig();
    const now = Math.floor(Date.now() / 1000);

    if (token.exp < now) {
      throw new BadRequestException({
        code: 'CLOUDINARY_UPLOAD_TOKEN_EXPIRED',
        message: 'La autorización de subida expiró. Vuelve a seleccionar la imagen e intenta otra vez.',
      });
    }
    if (token.userId !== user.sub) {
      throw new ForbiddenException({
        code: 'CLOUDINARY_UPLOAD_TOKEN_USER_MISMATCH',
        message: 'La autorización de subida no pertenece al usuario autenticado.',
      });
    }
    if (dto.publicId !== token.publicId) {
      throw new BadRequestException({
        code: 'CLOUDINARY_PUBLIC_ID_MISMATCH',
        message: 'El archivo subido no corresponde a la autorización emitida por el backend.',
      });
    }
    this.assertCloudinarySecureUrl(dto.secureUrl, cloudName, token.publicId);
    this.assertCompletedCloudinaryUpload(token, dto);

    return await this.fileModel.sequelize!.transaction(async (transaction) => {
      const existing = await this.fileModel.findOne({
        where: { storageProvider: STORAGE_PROVIDER_CLOUDINARY, objectKey: token.publicId },
        transaction,
      });
      if (existing) {
        return this.decorateFileResponse(existing);
      }

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
          sizeBytes: Number(dto.bytes ?? token.sizeBytes),
          checksum: dto.assetId,
          visibility: 'PUBLIC',
          status: 'ACTIVE',
          metadata: {
            publicUrl,
            downloadUrl: publicUrl,
            url: publicUrl,
            directClientUpload: true,
            cloudinary: {
              cloudName,
              publicId: token.publicId,
              assetId: dto.assetId,
              version: dto.version,
              format: dto.format,
              resourceType: dto.resourceType ?? 'image',
              bytes: dto.bytes ?? token.sizeBytes,
            },
          },
        } as any,
        { transaction },
      );

      await this.audit.log(
        {
          actorUserId: user.sub,
          action: 'files.cloudinary.complete',
          entityType: 'FileAsset',
          entityId: record.id,
          after: {
            module: record.module,
            visibility: record.visibility,
            storageProvider: record.storageProvider,
            publicUrl,
            directClientUpload: true,
          },
        },
        { transaction },
      );

      return this.decorateFileResponse(record, publicUrl);
    });
  }

  async listAdmin(query: PaginationQueryDto) {
    const search = String(query.search ?? '').trim();
    const where = search
      ? {
          [Op.or]: [
            { module: { [Op.iLike]: `%${search}%` } },
            { entityType: { [Op.iLike]: `%${search}%` } },
            { originalName: { [Op.iLike]: `%${search}%` } },
            { mimeType: { [Op.iLike]: `%${search}%` } },
            { objectKey: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : undefined;

    const { rows, count } = await this.fileModel.findAndCountAll({
      where,
      ...toLimitOffset(query),
      order: buildSafeOrder(
        query,
        {
          id: 'id',
          module: 'module',
          entityType: 'entityType',
          entity_type: 'entityType',
          originalName: 'originalName',
          original_name: 'originalName',
          mimeType: 'mimeType',
          mime_type: 'mimeType',
          storageProvider: 'storageProvider',
          storage_provider: 'storageProvider',
          visibility: 'visibility',
          status: 'status',
          createdAt: 'createdAt',
          created_at: 'createdAt',
          updatedAt: 'updatedAt',
          updated_at: 'updatedAt',
        },
        'createdAt',
      ),
    });

    return { items: rows.map((row) => this.decorateFileResponse(row)), pagination: buildPagination(query, count) };
  }

  async getAdmin(id: string) {
    const record = await this.fileModel.findByPk(id);
    if (!record) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'Archivo no encontrado.' });
    }
    return this.decorateFileResponse(record);
  }

  async updateAdmin(actorUserId: string, id: string, dto: UpdateFileDto) {
    const record = await this.fileModel.findByPk(id);
    if (!record) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'Archivo no encontrado.' });
    }

    const before = record.toJSON();
    const payload: Record<string, unknown> = {};
    if (dto.module !== undefined) payload.module = dto.module;
    if (dto.entityType !== undefined) payload.entityType = dto.entityType || null;
    if (dto.entityId !== undefined) payload.entityId = dto.entityId || null;
    if (dto.visibility !== undefined) payload.visibility = dto.visibility;
    if (dto.status !== undefined) payload.status = dto.status;
    if (dto.originalName !== undefined) payload.originalName = dto.originalName;
    if (dto.metadata !== undefined) payload.metadata = { ...(record.metadata ?? {}), ...dto.metadata };

    await record.update(payload as any);
    await this.audit.log({
      actorUserId,
      action: 'files.update',
      entityType: 'FileAsset',
      entityId: record.id,
      before,
      after: record.toJSON(),
    });

    return this.decorateFileResponse(record);
  }

  async deleteAdmin(actorUserId: string, id: string) {
    const record = await this.fileModel.findByPk(id);
    if (!record) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'Archivo no encontrado.' });
    }

    const before = record.toJSON();
    await this.deleteExternalObject(record.storageProvider, record.bucket, record.objectKey);
    await record.destroy();
    await this.audit.log({
      actorUserId,
      action: 'files.delete',
      entityType: 'FileAsset',
      entityId: id,
      before,
      after: { deleted: true },
    });

    return { id, deleted: true };
  }

  async getDownloadInfo(user: AuthenticatedUser | undefined, id: string) {
    const file = await this.findAllowedFile(user, id);
    await this.accessLogModel.create({
      fileId: file.id,
      actorUserId: user?.sub,
      action: 'SIGNED_URL',
    } as any);

    if (file.storageProvider === STORAGE_PROVIDER_GCS) {
      return this.getGcsSignedUrl(file);
    }

    if (file.storageProvider === STORAGE_PROVIDER_CLOUDINARY) {
      return {
        fileId: file.id,
        provider: STORAGE_PROVIDER_CLOUDINARY,
        url: this.resolvePublicUrl(file),
        expiresInSeconds: null,
      };
    }

    return {
      fileId: file.id,
      provider: STORAGE_PROVIDER_LOCAL,
      url: this.buildBackendDownloadUrl(file.id),
      expiresInSeconds: this.config.get<number>('files.signedUrlExpiresSeconds') ?? 900,
    };
  }

  async downloadLocal(user: AuthenticatedUser | undefined, id: string, response: Response) {
    const file = await this.findAllowedFile(user, id);
    if (file.storageProvider === STORAGE_PROVIDER_GCS) {
      const signed = await this.getGcsSignedUrl(file);
      response.redirect(signed.url);
      return undefined;
    }

    if (file.storageProvider === STORAGE_PROVIDER_CLOUDINARY) {
      response.redirect(this.resolvePublicUrl(file));
      return undefined;
    }

    const uploadDir = this.config.get<string>('files.uploadDir') ?? 'storage/uploads';
    const fullPath = join(uploadDir, file.objectKey);
    if (!existsSync(fullPath))
      throw new NotFoundException({
        code: 'FILE_OBJECT_NOT_FOUND',
        message: 'El archivo físico no existe en almacenamiento local.',
      });

    await this.accessLogModel.create({
      fileId: file.id,
      actorUserId: user?.sub,
      action: 'DOWNLOAD',
    } as any);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader(
      'Content-Disposition',
      `${file.mimeType.startsWith('image/') ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.originalName)}"`,
    );
    return new StreamableFile(createReadStream(fullPath));
  }

  private async findAllowedFile(user: AuthenticatedUser | undefined, id: string) {
    const file = await this.fileModel.findByPk(id);
    if (!file)
      throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'Archivo no encontrado.' });
    const isOwner = user?.sub === file.ownerUserId;
    const isAdmin = user?.roles?.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role));
    if (file.visibility !== 'PUBLIC' && !isOwner && !isAdmin) {
      throw new ForbiddenException({
        code: 'FILE_FORBIDDEN',
        message: 'No puede acceder a este archivo.',
      });
    }
    return file;
  }

  private buildObjectKey(module: string, userId: string, safeExt: string) {
    const moduleKey = module.toLowerCase();
    const prefixConfig =
      this.storageProvider === STORAGE_PROVIDER_CLOUDINARY ? 'files.cloudinary' : 'files.gcs';
    const userMediaPrefix = this.config.get<string>(`${prefixConfig}.userMediaPrefix`) ?? 'users';
    const publicAssetsPrefix =
      this.config.get<string>(`${prefixConfig}.publicAssetsPrefix`) ?? 'public';
    const prefix =
      module === 'CMS' || module === 'THERAPY_CATALOG' ? publicAssetsPrefix : userMediaPrefix;
    return `${prefix}/${moduleKey}/${userId}/${randomUUID()}${safeExt}`;
  }

  private moveToLocalStorage(file: Express.Multer.File, objectKey: string) {
    const uploadDir = this.config.get<string>('files.uploadDir') ?? 'storage/uploads';
    mkdirSync(uploadDir, { recursive: true });
    const finalPath = join(uploadDir, objectKey);
    mkdirSync(dirname(finalPath), { recursive: true });
    renameSync(file.path, finalPath);
  }


  private getCloudinaryConfig() {
    const cloudName = this.config.get<string>('files.cloudinary.cloudName')?.trim();
    const apiKey = this.config.get<string>('files.cloudinary.apiKey')?.trim();
    const apiSecret = this.config.get<string>('files.cloudinary.apiSecret')?.trim();
    const folder = (this.config.get<string>('files.cloudinary.folder') ?? 'corazon-migrante')
      .trim()
      .replace(/^\/+|\/+$/g, '');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestException({
        code: 'CLOUDINARY_NOT_CONFIGURED',
        message:
          'Cloudinary no está configurado. Define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.',
      });
    }

    return { cloudName, apiKey, apiSecret, folder };
  }

  private buildCloudinaryPublicId(objectKey: string) {
    const { folder } = this.getCloudinaryConfig();
    const withoutExtension = objectKey.replace(/\.[^/.]+$/, '');
    if (!folder) return withoutExtension;
    return withoutExtension.startsWith(`${folder}/`) ? withoutExtension : `${folder}/${withoutExtension}`;
  }

  private signCloudinaryParams(params: Record<string, string | number | boolean>, apiSecret: string) {
    const payload = Object.keys(params)
      .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
  }


  private ensureCloudinaryDirectUploadAvailable() {
    if (this.storageProvider !== STORAGE_PROVIDER_CLOUDINARY) {
      throw new BadRequestException({
        code: 'CLOUDINARY_DIRECT_UPLOAD_UNAVAILABLE',
        message:
          'La subida directa a Cloudinary solo está disponible cuando STORAGE_PROVIDER=CLOUDINARY.',
      });
    }
    this.getCloudinaryConfig();
  }

  private cleanOriginalName(name: string) {
    const cleaned = String(name ?? 'archivo').replace(/[\\/\0]/g, '').trim();
    return cleaned || 'archivo';
  }

  private assertDirectUploadInput(originalName: string, mimeType: string, sizeBytes: number) {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(mimeType)) {
      throw new BadRequestException({
        code: 'FILE_MIME_NOT_ALLOWED',
        message: 'Solo se permite subir imágenes PNG, JPG/JPEG o WEBP por subida directa.',
      });
    }
    const maxBytes = (this.config.get<number>('files.maxUploadMb') ?? 8) * 1024 * 1024;
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxBytes) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `La imagen debe pesar menos de ${this.config.get<number>('files.maxUploadMb') ?? 8} MB.`,
      });
    }
    if (!this.cleanOriginalName(originalName)) {
      throw new BadRequestException({ code: 'FILE_NAME_REQUIRED', message: 'Nombre de archivo requerido.' });
    }
  }

  private extFromMimeType(mimeType: string, originalName: string) {
    const ext = extname(originalName).toLowerCase();
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'image/jpeg') return ext === '.jpg' || ext === '.jpeg' ? ext : '.jpg';
    if (mimeType === 'image/webp') return '.webp';
    return ext || '.bin';
  }

  private getDirectUploadTokenSecret() {
    const secret = this.config.get<string>('jwt.accessSecret') || this.getCloudinaryConfig().apiSecret;
    if (!secret || secret.length < 16) {
      throw new BadRequestException({
        code: 'UPLOAD_TOKEN_SECRET_NOT_CONFIGURED',
        message: 'No hay secreto suficiente para firmar autorizaciones de subida.',
      });
    }
    return secret;
  }

  private encodeBase64Url(value: string) {
    return Buffer.from(value, 'utf8').toString('base64url');
  }

  private decodeBase64Url(value: string) {
    return Buffer.from(value, 'base64url').toString('utf8');
  }

  private signDirectUploadToken(payload: Record<string, unknown>) {
    const body = this.encodeBase64Url(JSON.stringify(payload));
    const signature = createHmac('sha256', this.getDirectUploadTokenSecret()).update(body).digest('base64url');
    return `${body}.${signature}`;
  }

  private verifyDirectUploadToken(token: string) {
    const [body, signature] = String(token ?? '').split('.');
    if (!body || !signature) {
      throw new BadRequestException({
        code: 'UPLOAD_TOKEN_INVALID',
        message: 'La autorización de subida no es válida.',
      });
    }
    const expected = createHmac('sha256', this.getDirectUploadTokenSecret()).update(body).digest('base64url');
    if (signature !== expected) {
      throw new BadRequestException({
        code: 'UPLOAD_TOKEN_INVALID_SIGNATURE',
        message: 'La autorización de subida fue alterada o no fue emitida por este backend.',
      });
    }
    try {
      const parsed = JSON.parse(this.decodeBase64Url(body)) as Record<string, any>;
      const required = ['userId', 'publicId', 'module', 'originalName', 'mimeType', 'sizeBytes', 'exp'];
      for (const key of required) {
        if (parsed[key] === undefined || parsed[key] === null || parsed[key] === '') throw new Error(key);
      }
      return parsed as {
        v: number;
        userId: string;
        publicId: string;
        objectKey: string;
        module: string;
        entityType?: string | null;
        entityId?: string | null;
        visibility?: string;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
        exp: number;
      };
    } catch {
      throw new BadRequestException({
        code: 'UPLOAD_TOKEN_INVALID_PAYLOAD',
        message: 'La autorización de subida tiene un contenido inválido.',
      });
    }
  }


  private assertCompletedCloudinaryUpload(
    token: {
      publicId: string;
      mimeType: string;
      sizeBytes: number;
    },
    dto: CompleteCloudinaryUploadDto,
  ) {
    const resourceType = String(dto.resourceType ?? 'image').toLowerCase();
    if (resourceType !== 'image') {
      throw new BadRequestException({
        code: 'CLOUDINARY_RESOURCE_TYPE_INVALID',
        message: 'La subida directa solo acepta recursos de tipo imagen.',
      });
    }

    const allowedFormats = new Set(['png', 'jpg', 'jpeg', 'webp']);
    if (dto.format && !allowedFormats.has(String(dto.format).toLowerCase())) {
      throw new BadRequestException({
        code: 'CLOUDINARY_FORMAT_INVALID',
        message: 'Cloudinary devolvió un formato de imagen no permitido.',
      });
    }

    if (typeof dto.bytes === 'number' && Number.isFinite(dto.bytes)) {
      if (dto.bytes <= 0 || dto.bytes > token.sizeBytes) {
        throw new BadRequestException({
          code: 'CLOUDINARY_BYTES_MISMATCH',
          message: 'El tamaño devuelto por Cloudinary no coincide con la autorización emitida por el backend.',
        });
      }
    }

    if (dto.signature && dto.version) {
      const { apiSecret } = this.getCloudinaryConfig();
      const expected = this.signCloudinaryParams(
        { public_id: token.publicId, version: dto.version },
        apiSecret,
      );
      if (dto.signature !== expected) {
        throw new BadRequestException({
          code: 'CLOUDINARY_RESPONSE_SIGNATURE_INVALID',
          message: 'La respuesta de Cloudinary no pudo verificarse con la firma esperada.',
        });
      }
    }
  }

  private assertCloudinarySecureUrl(secureUrl: string, cloudName: string, publicId: string) {
    let parsed: URL;
    try {
      parsed = new URL(secureUrl);
    } catch {
      throw new BadRequestException({ code: 'CLOUDINARY_URL_INVALID', message: 'Cloudinary devolvió una URL inválida.' });
    }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') {
      throw new BadRequestException({
        code: 'CLOUDINARY_URL_NOT_TRUSTED',
        message: 'La URL de la imagen no pertenece al dominio seguro de Cloudinary.',
      });
    }
    const expectedPrefix = `/${cloudName}/`;
    if (!parsed.pathname.startsWith(expectedPrefix)) {
      throw new BadRequestException({
        code: 'CLOUDINARY_URL_CLOUD_MISMATCH',
        message: 'La URL de Cloudinary no corresponde al cloud configurado.',
      });
    }
    const decodedPath = decodeURIComponent(parsed.pathname);
    if (!decodedPath.includes(publicId)) {
      throw new BadRequestException({
        code: 'CLOUDINARY_URL_PUBLIC_ID_MISMATCH',
        message: 'La URL de Cloudinary no corresponde al public_id autorizado.',
      });
    }
  }

  private async uploadToCloudinary(file: Express.Multer.File, objectKey: string) {
    const { cloudName, apiKey, apiSecret } = this.getCloudinaryConfig();
    const publicId = this.buildCloudinaryPublicId(objectKey);
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { public_id: publicId, timestamp };
    const signature = this.signCloudinaryParams(params, apiSecret);

    const formData = new FormData();
    const blob = new Blob([readFileSync(file.path) as any], { type: file.mimetype });
    formData.append('file', blob, file.originalname);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('public_id', publicId);
    formData.append('signature', signature);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: 'POST',
        body: formData as any,
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, any>;
      if (!response.ok) {
        throw { response: { status: response.status, statusText: response.statusText, data: payload } };
      }

      if (existsSync(file.path)) unlinkSync(file.path);
      const resolvedPublicId = String(payload.public_id || publicId);
      const publicUrl = String(payload.secure_url || payload.url || '').trim();
      if (!publicUrl) {
        throw new Error('Cloudinary no devolvió secure_url/url para el archivo subido.');
      }

      return {
        bucket: cloudName,
        objectKey: resolvedPublicId,
        metadata: {
          publicUrl,
          downloadUrl: publicUrl,
          url: publicUrl,
          cloudinary: {
            cloudName,
            publicId: resolvedPublicId,
            resourceType: payload.resource_type,
            assetId: payload.asset_id,
            version: payload.version,
            format: payload.format,
            bytes: payload.bytes,
            originalFilename: payload.original_filename,
          },
        },
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'CLOUDINARY_UPLOAD_FAILED',
        message: 'No se pudo subir el archivo a Cloudinary.',
        details: [
          {
            provider: STORAGE_PROVIDER_CLOUDINARY,
            action: 'upload',
            cloudName,
            publicId,
            ...this.extractProviderError(error),
            hint:
              'Verifica CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET. Si estás usando variables de Coolify, que estén disponibles en runtime y sin espacios/saltos extra.',
          },
        ],
      });
    }
  }

  private async deleteFromCloudinary(publicId: string) {
    const { cloudName, apiKey, apiSecret } = this.getCloudinaryConfig();
    for (const resourceType of ['image', 'raw', 'video']) {
      const timestamp = Math.floor(Date.now() / 1000);
      const params = { public_id: publicId, timestamp };
      const signature = this.signCloudinaryParams(params, apiSecret);
      const formData = new URLSearchParams();
      formData.set('api_key', apiKey);
      formData.set('timestamp', String(timestamp));
      formData.set('public_id', publicId);
      formData.set('signature', signature);
      try {
        await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
          method: 'POST',
          body: formData as any,
        });
      } catch {
        // Se intenta con varios resource_type porque la subida usa /auto/upload.
      }
    }
  }

  private async deleteExternalObject(
    storageProvider: string,
    bucket: string | undefined,
    objectKey: string,
  ) {
    try {
      if (storageProvider === STORAGE_PROVIDER_GCS) {
        if (this.gcs && bucket) {
          await this.gcs.bucket(bucket).file(objectKey).delete({ ignoreNotFound: true });
        }
        return;
      }
      if (storageProvider === STORAGE_PROVIDER_CLOUDINARY) {
        await this.deleteFromCloudinary(objectKey);
        return;
      }
      const uploadDir = this.config.get<string>('files.uploadDir') ?? 'storage/uploads';
      const fullPath = join(uploadDir, objectKey);
      if (existsSync(fullPath)) {
        unlinkSync(fullPath);
      }
    } catch {
      // La operación principal ya falló. No se oculta el error original por un fallo de limpieza.
    }
  }

  private async uploadToGcs(
    file: Express.Multer.File,
    objectKey: string,
    bucketName: string | undefined,
  ) {
    if (!this.gcs)
      throw new BadRequestException({
        code: 'GCS_NOT_CONFIGURED',
        message: 'Google Cloud Storage no está inicializado.',
      });
    if (!bucketName)
      throw new BadRequestException({
        code: 'GCS_BUCKET_REQUIRED',
        message:
          'Debe configurar GCS_BUCKET o GCS_BUCKET_NAME_USER_MEDIA para subir archivos a GCS.',
      });

    try {
      await this.gcs.bucket(bucketName).upload(file.path, {
        destination: objectKey,
        resumable: false,
        metadata: {
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
          },
        },
      });
      unlinkSync(file.path);
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'GCS_UPLOAD_FAILED',
        message: 'No se pudo subir el archivo a Google Cloud Storage.',
        details: [
          {
            provider: STORAGE_PROVIDER_GCS,
            action: 'upload',
            bucket: bucketName,
            objectKey,
            ...this.extractProviderError(error),
            hint: this.buildGcsUploadHint(error),
          },
        ],
      });
    }
  }

  private async getGcsSignedUrl(file: FileAsset) {
    if (!this.gcs)
      throw new BadRequestException({
        code: 'GCS_NOT_CONFIGURED',
        message: 'Google Cloud Storage no está inicializado.',
      });
    if (!file.bucket)
      throw new BadRequestException({
        code: 'GCS_BUCKET_MISSING_IN_FILE',
        message: 'El archivo no tiene bucket asociado.',
      });

    const expiresInSeconds = this.config.get<number>('files.signedUrlExpiresSeconds') ?? 900;
    try {
      const [url] = await this.gcs
        .bucket(file.bucket)
        .file(file.objectKey)
        .getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + expiresInSeconds * 1000,
          responseDisposition: `${file.mimeType.startsWith('image/') ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.originalName)}"`,
        });

      return {
        fileId: file.id,
        provider: STORAGE_PROVIDER_GCS,
        bucket: file.bucket,
        objectKey: file.objectKey,
        url,
        expiresInSeconds,
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'GCS_SIGNED_URL_FAILED',
        message: 'No se pudo generar la URL firmada de Google Cloud Storage.',
        details: [
          {
            provider: STORAGE_PROVIDER_GCS,
            action: 'signed-url',
            bucket: file.bucket,
            objectKey: file.objectKey,
            ...this.extractProviderError(error),
            hint: 'Verifica que la service account pueda firmar URLs y leer el objeto en el bucket.',
          },
        ],
      });
    }
  }


  private buildGcsUploadHint(error: unknown) {
    const providerMessage = String((error as Record<string, any>)?.message ?? '').toLowerCase();
    const providerBody = JSON.stringify((error as Record<string, any>)?.errors ?? (error as Record<string, any>)?.response?.data ?? {}).toLowerCase();
    if (providerMessage.includes('invalid_grant') || providerBody.includes('invalid_grant')) {
      return 'GCS rechazó la credencial con invalid_grant / Invalid JWT Signature. Esto casi siempre significa que el client_email no corresponde al private_key, la private_key fue copiada incompleta/corrupta, la key fue revocada, o el reloj del servidor está desfasado. Genera una nueva key JSON del service account correcto, codifica ese JSON completo en base64 y úsalo en GOOGLE_CREDENTIALS_BASE64. Verifica también fecha/hora del VPS.';
    }
    return 'Verifica que tu .env.local/.env esté siendo leído, que STORAGE_PROVIDER=GCS, que GCS_BUCKET exista y que GOOGLE_CREDENTIALS_BASE64/GOOGLE_APPLICATION_CREDENTIALS tenga permisos storage.objects.create, storage.objects.get y storage.objects.delete. Para desarrollo local temporal puedes usar GCS_UPLOAD_FALLBACK_TO_LOCAL=true.';
  }

  private extractProviderError(error: unknown) {
    const candidate = error as Record<string, any>;
    const response = candidate?.response as Record<string, any> | undefined;
    const body = response?.data ?? candidate?.body ?? candidate?.errors;
    return {
      providerCode: candidate?.code ?? response?.status,
      providerMessage: candidate?.message ?? response?.statusText ?? 'Error desconocido de GCS.',
      providerErrors: candidate?.errors ?? body,
    };
  }
}
