import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'node:crypto';
import { diskStorage } from 'multer';

/** Shared upload limits prevent endpoint drift and bound multipart resource use. */
export function buildMulterOptions(): MulterOptions {
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
  };
}
