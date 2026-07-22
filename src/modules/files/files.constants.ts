export const STORAGE_PROVIDER_LOCAL = 'LOCAL';
export const STORAGE_PROVIDER_GCS = 'GCS';
export const STORAGE_PROVIDER_CLOUDINARY = 'CLOUDINARY';

export const ALLOWED_FILE_TYPES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
} as const;

export type AllowedMimeType = keyof typeof ALLOWED_FILE_TYPES;

export const CLOUDINARY_DIRECT_UPLOAD_TTL_SECONDS = 10 * 60;
