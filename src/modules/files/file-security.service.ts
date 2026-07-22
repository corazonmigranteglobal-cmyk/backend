import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { open } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { ALLOWED_FILE_TYPES, AllowedMimeType } from './files.constants';

export type DirectUploadTokenPayload = {
  v: 1;
  userId: string;
  publicId: string;
  objectKey: string;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  visibility: 'PUBLIC';
  originalName: string;
  mimeType: AllowedMimeType;
  sizeBytes: number;
  exp: number;
};

@Injectable()
export class FileSecurityService {
  constructor(private readonly config: ConfigService) {}

  async validateTemporaryFile(file: Express.Multer.File) {
    const maxBytes = (this.config.get<number>('files.maxUploadMb') ?? 8) * 1024 * 1024;
    if (file.size < 1 || file.size > maxBytes) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'El archivo excede el tamaño máximo permitido.',
      });
    }

    const detectedMimeType = await this.detectMimeType(file.path);
    if (!detectedMimeType || detectedMimeType !== file.mimetype) {
      throw new BadRequestException({
        code: 'FILE_CONTENT_TYPE_MISMATCH',
        message: 'El contenido real del archivo no coincide con el tipo declarado.',
      });
    }

    return {
      mimeType: detectedMimeType,
      extension: ALLOWED_FILE_TYPES[detectedMimeType],
      checksum: await this.calculateSha256(file.path),
      originalName: this.cleanOriginalName(file.originalname),
    };
  }

  assertDirectUploadInput(originalName: string, mimeType: string, sizeBytes: number) {
    const directUploadTypes: AllowedMimeType[] = ['image/png', 'image/jpeg', 'image/webp'];
    if (!directUploadTypes.includes(mimeType as AllowedMimeType)) {
      throw new BadRequestException({
        code: 'FILE_MIME_NOT_ALLOWED',
        message: 'Solo se permiten imágenes PNG, JPG/JPEG o WEBP por subida directa.',
      });
    }
    const maxBytes = (this.config.get<number>('files.maxUploadMb') ?? 8) * 1024 * 1024;
    if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > maxBytes) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'La imagen excede el tamaño máximo permitido.',
      });
    }
    if (!this.cleanOriginalName(originalName)) {
      throw new BadRequestException({
        code: 'FILE_NAME_REQUIRED',
        message: 'Nombre de archivo requerido.',
      });
    }
  }

  cleanOriginalName(name: string) {
    const cleanedName = String(name ?? '')
      .replace(/[\\/\0\r\n]/g, '')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, 255);
    return cleanedName || 'archivo';
  }

  signUploadToken(payload: DirectUploadTokenPayload) {
    const encodedBody = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = this.calculateUploadTokenSignature(encodedBody);
    return `${encodedBody}.${signature}`;
  }

  verifyUploadToken(token: string): DirectUploadTokenPayload {
    const [encodedBody, signature, extraPart] = String(token ?? '').split('.');
    if (!encodedBody || !signature || extraPart) this.throwInvalidToken('UPLOAD_TOKEN_INVALID');

    const expectedSignature = this.calculateUploadTokenSignature(encodedBody);
    const actualBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      this.throwInvalidToken('UPLOAD_TOKEN_INVALID_SIGNATURE');
    }

    try {
      const parsed = JSON.parse(Buffer.from(encodedBody, 'base64url').toString('utf8')) as unknown;
      if (!this.isDirectUploadPayload(parsed)) throw new Error('Invalid upload-token shape.');
      return parsed;
    } catch {
      return this.throwInvalidToken('UPLOAD_TOKEN_INVALID_PAYLOAD');
    }
  }

  private async detectMimeType(path: string): Promise<AllowedMimeType | undefined> {
    const fileHandle = await open(path, 'r');
    try {
      const signature = Buffer.alloc(16);
      const { bytesRead } = await fileHandle.read(signature, 0, signature.length, 0);
      const header = signature.subarray(0, bytesRead);
      if (header.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
      if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'image/jpeg';
      if (
        header.subarray(0, 4).toString('ascii') === 'RIFF' &&
        header.subarray(8, 12).toString('ascii') === 'WEBP'
      )
        return 'image/webp';
      if (header.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
      return undefined;
    } finally {
      await fileHandle.close();
    }
  }

  private async calculateSha256(path: string) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
    return hash.digest('hex');
  }

  private calculateUploadTokenSignature(encodedBody: string) {
    const secret = this.config.get<string>('jwt.accessSecret');
    if (!secret || secret.length < 32) {
      throw new BadRequestException({
        code: 'UPLOAD_TOKEN_SECRET_NOT_CONFIGURED',
        message: 'No existe un secreto seguro para autorizar subidas.',
      });
    }
    return createHmac('sha256', secret).update(encodedBody).digest('base64url');
  }

  private isDirectUploadPayload(value: unknown): value is DirectUploadTokenPayload {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const payload = value as Record<string, unknown>;
    return (
      payload.v === 1 &&
      typeof payload.userId === 'string' &&
      typeof payload.publicId === 'string' &&
      typeof payload.objectKey === 'string' &&
      typeof payload.module === 'string' &&
      payload.visibility === 'PUBLIC' &&
      typeof payload.originalName === 'string' &&
      Object.prototype.hasOwnProperty.call(ALLOWED_FILE_TYPES, String(payload.mimeType)) &&
      typeof payload.sizeBytes === 'number' &&
      Number.isInteger(payload.sizeBytes) &&
      typeof payload.exp === 'number' &&
      Number.isInteger(payload.exp)
    );
  }

  private throwInvalidToken(code: string): never {
    throw new BadRequestException({
      code,
      message: 'La autorización de subida no es válida.',
    });
  }
}
