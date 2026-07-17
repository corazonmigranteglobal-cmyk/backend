import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { diskStorage, Options } from 'multer';
import { ALLOWED_FILE_TYPES } from './files.constants';

/** Shared upload limits prevent endpoint drift and bound multipart resource use. */
export function buildMulterOptions(): Options {
  const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 8);
  return {
    storage: diskStorage({
      destination: 'storage/tmp',
      filename: (_request, _file, callback) => callback(null, randomUUID()),
    }),
    limits: {
      fileSize: maxUploadMb * 1024 * 1024,
      files: 1,
      fields: 10,
      fieldNameSize: 100,
      fieldSize: 16 * 1024,
      parts: 12,
    },
    fileFilter: (_request, file, callback) => {
      if (!Object.hasOwn(ALLOWED_FILE_TYPES, file.mimetype)) {
        callback(
          new BadRequestException({
            code: 'FILE_MIME_NOT_ALLOWED',
            message: 'Tipo de archivo no permitido.',
          }),
          false,
        );
        return;
      }
      callback(null, true);
    },
  };
}
