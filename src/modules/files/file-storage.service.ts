import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { FileAsset } from '@/database/models';
import {
  STORAGE_PROVIDER_CLOUDINARY,
  STORAGE_PROVIDER_GCS,
  STORAGE_PROVIDER_LOCAL,
} from './files.constants';

export type StoredFileResult = {
  storageProvider: string;
  bucket?: string;
  objectKey: string;
  metadata: Record<string, unknown>;
};

@Injectable()
export class FileStorageService {
  private readonly gcs?: Storage;
  constructor(private readonly config: ConfigService) {
    if (this.storageProvider === STORAGE_PROVIDER_GCS) {
      const credentials = this.config.get<Record<string, unknown>>('files.gcs.credentials');
      const keyFilename = credentials
        ? undefined
        : this.config.get<string>('files.gcs.keyFilename') || undefined;
      this.gcs = new Storage({
        projectId: this.config.get<string>('files.gcs.projectId') || undefined,
        credentials: credentials || undefined,
        keyFilename,
      });
    }
  }
  get storageProvider() {
    return (
      this.config.get<string>('files.storageProvider') ?? STORAGE_PROVIDER_CLOUDINARY
    ).toUpperCase();
  }

  async store(file: Express.Multer.File, objectKey: string, moduleCode: string) {
    if (this.storageProvider === STORAGE_PROVIDER_GCS) {
      const bucket = this.resolveGcsBucket(moduleCode);
      try {
        await this.uploadToGcs(file, objectKey, bucket);
        return { storageProvider: STORAGE_PROVIDER_GCS, bucket, objectKey, metadata: {} };
      } catch (error) {
        if (this.config.get<boolean>('files.gcs.uploadFallbackToLocal') !== true) throw error;
        await this.moveToLocalStorage(file.path, objectKey);
        return {
          storageProvider: STORAGE_PROVIDER_LOCAL,
          objectKey,
          metadata: {
            gcsFallbackToLocal: true,
            originalStorageProvider: STORAGE_PROVIDER_GCS,
            originalBucket: bucket,
          },
        };
      }
    }

    if (this.storageProvider === STORAGE_PROVIDER_CLOUDINARY) {
      return this.uploadToCloudinary(file, objectKey);
    }

    await this.moveToLocalStorage(file.path, objectKey);
    return { storageProvider: STORAGE_PROVIDER_LOCAL, objectKey, metadata: {} };
  }

  async deleteObject(provider: string, bucket: string | undefined, objectKey: string) {
    if (provider === STORAGE_PROVIDER_GCS) {
      if (!this.gcs || !bucket) return;
      await this.gcs.bucket(bucket).file(objectKey).delete({ ignoreNotFound: true });
      return;
    }
    if (provider === STORAGE_PROVIDER_CLOUDINARY) {
      await this.deleteFromCloudinary(objectKey);
      return;
    }
    await rm(this.resolveLocalPath(objectKey), { force: true });
  }

  async cleanupTemporaryFile(path?: string) {
    if (path) await rm(path, { force: true }).catch(() => undefined);
  }

  async getGcsSignedUrl(file: FileAsset) {
    if (!this.gcs || !file.bucket) {
      throw new BadRequestException({
        code: 'GCS_NOT_CONFIGURED',
        message: 'Google Cloud Storage no está configurado para este archivo.',
      });
    }
    const expiresInSeconds = this.config.get<number>('files.signedUrlExpiresSeconds') ?? 900;
    try {
      const [url] = await this.gcs
        .bucket(file.bucket)
        .file(file.objectKey)
        .getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + expiresInSeconds * 1_000,
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
    } catch {
      throw new ServiceUnavailableException({
        code: 'GCS_SIGNED_URL_FAILED',
        message: 'No se pudo generar la URL firmada del archivo.',
      });
    }
  }

  resolveLocalPath(objectKey: string) {
    const root = resolve(this.config.get<string>('files.uploadDir') ?? 'storage/uploads');
    const candidate = resolve(root, objectKey);
    const relativePath = relative(root, candidate);
    if (relativePath.startsWith(`..${sep}`) || relativePath === '..' || isAbsolute(relativePath)) {
      throw new BadRequestException({
        code: 'FILE_OBJECT_KEY_INVALID',
        message: 'La ruta interna del archivo no es válida.',
      });
    }
    return candidate;
  }

  private async moveToLocalStorage(sourcePath: string, objectKey: string) {
    const destinationPath = this.resolveLocalPath(objectKey);
    await mkdir(dirname(destinationPath), { recursive: true });
    try {
      await rename(sourcePath, destinationPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      await copyFile(sourcePath, destinationPath);
      await rm(sourcePath, { force: true });
    }
  }

  private resolveGcsBucket(moduleCode: string) {
    const publicModule = ['CMS', 'THERAPY_CATALOG'].includes(moduleCode.toUpperCase());
    const bucket = publicModule
      ? this.config.get<string>('files.gcs.publicAssetsBucket') ||
        this.config.get<string>('files.gcs.bucket')
      : this.config.get<string>('files.gcs.userMediaBucket') ||
        this.config.get<string>('files.gcs.bucket');
    if (!bucket) {
      throw new BadRequestException({
        code: 'GCS_BUCKET_REQUIRED',
        message: 'Debe configurar el bucket de Google Cloud Storage.',
      });
    }
    return bucket;
  }

  private async uploadToGcs(file: Express.Multer.File, objectKey: string, bucket: string) {
    if (!this.gcs) throw new BadRequestException({ code: 'GCS_NOT_CONFIGURED' });
    try {
      await this.gcs.bucket(bucket).upload(file.path, {
        destination: objectKey,
        resumable: file.size >= 5 * 1024 * 1024,
        validation: 'crc32c',
        metadata: {
          contentType: file.mimetype,
          metadata: { originalName: file.originalname },
        },
      });
      await this.cleanupTemporaryFile(file.path);
    } catch {
      throw new ServiceUnavailableException({
        code: 'GCS_UPLOAD_FAILED',
        message: 'No se pudo subir el archivo a Google Cloud Storage.',
      });
    }
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
        message: 'Cloudinary no está configurado.',
      });
    }
    return { cloudName, apiKey, apiSecret, folder };
  }

  private buildCloudinaryPublicId(objectKey: string, folder: string) {
    const withoutExtension = objectKey.replace(/\.[^/.]+$/, '');
    if (!folder || withoutExtension.startsWith(`${folder}/`)) return withoutExtension;
    return `${folder}/${withoutExtension}`;
  }

  private signCloudinaryParams(params: Record<string, string | number>, apiSecret: string) {
    const payload = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
  }

  private async uploadToCloudinary(
    file: Express.Multer.File,
    objectKey: string,
  ): Promise<StoredFileResult> {
    const { cloudName, apiKey, apiSecret, folder } = this.getCloudinaryConfig();
    const publicId = this.buildCloudinaryPublicId(objectKey, folder);
    const timestamp = Math.floor(Date.now() / 1_000);
    const signature = this.signCloudinaryParams({ public_id: publicId, timestamp }, apiSecret);
    const formData = new FormData();
    const boundedFileBuffer = await readFile(file.path);
    formData.append(
      'file',
      new Blob([new Uint8Array(boundedFileBuffer)], { type: file.mimetype }),
      file.originalname,
    );
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('public_id', publicId);
    formData.append('signature', signature);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(this.config.get<number>('files.providerTimeoutMs') ?? 30_000),
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) throw new Error(`Cloudinary HTTP ${response.status}`);
      const publicUrl = String(payload.secure_url ?? '').trim();
      if (!publicUrl) throw new Error('Cloudinary response did not contain secure_url.');
      await this.cleanupTemporaryFile(file.path);
      return {
        storageProvider: STORAGE_PROVIDER_CLOUDINARY,
        bucket: cloudName,
        objectKey: String(payload.public_id ?? publicId),
        metadata: {
          publicUrl,
          downloadUrl: publicUrl,
          url: publicUrl,
          cloudinary: {
            cloudName,
            publicId: payload.public_id,
            assetId: payload.asset_id,
            version: payload.version,
            format: payload.format,
            bytes: payload.bytes,
          },
        },
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'CLOUDINARY_UPLOAD_FAILED',
        message: 'No se pudo subir el archivo a Cloudinary.',
      });
    }
  }

  private async deleteFromCloudinary(publicId: string) {
    const { cloudName, apiKey, apiSecret } = this.getCloudinaryConfig();
    const timeoutMs = this.config.get<number>('files.providerTimeoutMs') ?? 30_000;
    let deleted = false;
    for (const resourceType of ['image', 'raw', 'video']) {
      const timestamp = Math.floor(Date.now() / 1_000);
      const signature = this.signCloudinaryParams({ public_id: publicId, timestamp }, apiSecret);
      const body = new URLSearchParams({
        api_key: apiKey,
        timestamp: String(timestamp),
        public_id: publicId,
        signature,
      });
      try {
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
          { method: 'POST', body, signal: AbortSignal.timeout(timeoutMs) },
        );
        const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (response.ok && ['ok', 'not found'].includes(String(result.result))) deleted = true;
      } catch {
        // Try the next resource type because uploads use Cloudinary's auto endpoint.
      }
    }
    if (!deleted) {
      throw new ServiceUnavailableException({
        code: 'CLOUDINARY_DELETE_FAILED',
        message: 'No se pudo confirmar la eliminación del archivo externo.',
      });
    }
  }
}
