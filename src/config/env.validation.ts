import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  APP_NAME: Joi.string().default('Corazon Migrante Backend'),
  CORS_ORIGINS: Joi.string().allow('').default('http://localhost:5173'),
  VALIDATION_FORBID_NON_WHITELISTED: Joi.boolean().default(false),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  LOG_FILE_PATH: Joi.string().default('storage/logs/app.log'),

  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_NAME: Joi.string().required(),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_SSL: Joi.boolean().default(false),
  DATABASE_LOGGING: Joi.boolean().default(false),
  DATABASE_CONNECTION_TIMEOUT_MS: Joi.number().optional(),
  DATABASE_BOOTSTRAP_ON_STARTUP: Joi.boolean().default(true),
  DATABASE_BOOTSTRAP_FAIL_FAST: Joi.boolean().default(true),
  DATABASE_SEED_PUBLIC_CMS_ON_STARTUP: Joi.boolean().default(true),

  REDIS_URL: Joi.string().allow('').optional(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  OUTBOX_BATCH_SIZE: Joi.number().optional(),
  OUTBOX_INTERVAL_MS: Joi.number().optional(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: Joi.number().default(30),
  BCRYPT_ROUNDS: Joi.number().min(8).max(14).default(10),

  STORAGE_PROVIDER: Joi.string().valid('LOCAL', 'GCS', 'CLOUDINARY').default('CLOUDINARY'),
  UPLOAD_DIR: Joi.string().default('storage/uploads'),
  MAX_UPLOAD_MB: Joi.number().default(8),
  PUBLIC_BASE_URL: Joi.string().uri().default('http://localhost:3000'),
  FILE_SIGNED_URL_EXPIRES_SECONDS: Joi.number().min(60).max(86400).default(900),
  GCS_SIGNED_URL_TTL_SECONDS: Joi.number().min(60).max(86400).optional(),
  GCS_BUCKET: Joi.string().allow('').optional(),
  GCS_BUCKET_NAME_USER_MEDIA: Joi.string().allow('').optional(),
  GCS_BUCKET_NAME_PUBLIC_ASSETS: Joi.string().allow('').optional(),
  GCS_UPLOAD_PREFIX_USER_MEDIA: Joi.string().allow('').optional(),
  GCS_UPLOAD_PREFIX_PUBLIC_ASSETS: Joi.string().allow('').optional(),
  GCP_PROJECT_ID: Joi.string().allow('').optional(),
  GCS_PUBLIC_BASE_URL: Joi.string().uri().allow('').optional(),
  GCS_UPLOAD_FALLBACK_TO_LOCAL: Joi.boolean().optional(),
  FILES_GCS_FALLBACK_TO_LOCAL: Joi.boolean().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: Joi.string().allow('').optional(),
  GOOGLE_APPLICATION_CREDENTIALS_JSON: Joi.string().allow('').optional(),
  GOOGLE_APPLICATION_CREDENTIALS_BASE64: Joi.string().allow('').optional(),
  GOOGLE_CREDENTIALS: Joi.string().allow('').optional(),
  GOOGLE_CREDENTIALS_JSON: Joi.string().allow('').optional(),
  GOOGLE_CREDENTIALS_BASE64: Joi.string().allow('').optional(),
  GOOGLE_SERVICE_ACCOUNT_BASE64: Joi.string().allow('').optional(),
  GCP_SERVICE_ACCOUNT_BASE64: Joi.string().allow('').optional(),
  CLOUDINARY_CLOUD_NAME: Joi.string().allow('').optional(),
  CLOUDINARY_API_KEY: Joi.string().allow('').optional(),
  CLOUDINARY_API_SECRET: Joi.string().allow('').optional(),
  CLOUDINARY_FOLDER: Joi.string().allow('').optional(),
  CLOUDINARY_UPLOAD_FOLDER: Joi.string().allow('').optional(),
  CLOUDINARY_UPLOAD_PREFIX_USER_MEDIA: Joi.string().allow('').optional(),
  CLOUDINARY_UPLOAD_PREFIX_PUBLIC_ASSETS: Joi.string().allow('').optional(),
  NEWS_SUBSCRIPTION_QR_FILE_ID: Joi.string().allow('').optional(),
  PREMIUM_SUBSCRIPTION_QR_FILE_ID: Joi.string().allow('').optional(),
  NEWS_SUBSCRIPTION_INSTRUCTIONS_FILE_ID: Joi.string().allow('').optional(),
  PREMIUM_SUBSCRIPTION_INSTRUCTIONS_FILE_ID: Joi.string().allow('').optional(),
  NEWS_SUBSCRIPTION_PAYMENT_TITLE: Joi.string().allow('').optional(),
  NEWS_SUBSCRIPTION_PAYMENT_INSTRUCTIONS: Joi.string().allow('').optional(),
  NEWS_SUBSCRIPTION_AMOUNT_BOB: Joi.number().optional(),
  NEWS_SUBSCRIPTION_CURRENCY: Joi.string().allow('').default('BOB'),

  EMAIL_PROVIDER: Joi.string().valid('DEV_NULL', 'SENDGRID').optional(),
  EMAIL_FROM_EMAIL: Joi.string().email().allow('').optional(),
  EMAIL_FROM_NAME: Joi.string().allow('').optional(),
  MAIL_PROVIDER: Joi.string().valid('DEV_NULL', 'SENDGRID').optional(),
  MAIL_FROM: Joi.string().email().allow('').optional(),
  MAIL_FROM_NAME: Joi.string().allow('').optional(),
  MAIL_REPLY_TO: Joi.string().email().allow('').optional(),
  SENDGRID_API_KEY: Joi.string().allow('').optional(),

  API_KEY: Joi.string().allow('').optional(),
  SOURCE_DATABASE_URL: Joi.string().allow('').optional(),
  NEON_BACKUP_DATABASE_URL: Joi.string().allow('').optional(),
  BACKUP_CONFIRM_REMOTE_NEON: Joi.boolean().optional(),
  BACKUP_REQUIRE_NEON_HOST: Joi.boolean().optional(),
  SMOKE_TEST_EMAIL: Joi.string().email().allow('').optional(),
}).custom((env, helpers) => {
  if (env.STORAGE_PROVIDER === 'GCS') {
    if (!env.GCS_BUCKET && !env.GCS_BUCKET_NAME_USER_MEDIA) {
      return helpers.error('any.custom', {
        message:
          'Debe configurar GCS_BUCKET o GCS_BUCKET_NAME_USER_MEDIA cuando STORAGE_PROVIDER=GCS.',
      });
    }

    if (
      !env.GOOGLE_CREDENTIALS_BASE64 &&
      !env.GOOGLE_APPLICATION_CREDENTIALS_BASE64 &&
      !env.GOOGLE_SERVICE_ACCOUNT_BASE64 &&
      !env.GCP_SERVICE_ACCOUNT_BASE64 &&
      !env.GOOGLE_APPLICATION_CREDENTIALS_JSON &&
      !env.GOOGLE_CREDENTIALS_JSON &&
      !env.GOOGLE_CREDENTIALS &&
      !env.GOOGLE_APPLICATION_CREDENTIALS
    ) {
      return helpers.error('any.custom', {
        message:
          'Debe configurar credenciales de Google cuando STORAGE_PROVIDER=GCS. Recomendado en Coolify: GOOGLE_CREDENTIALS_BASE64. En local también se acepta GOOGLE_APPLICATION_CREDENTIALS como ruta, JSON o base64.',
      });
    }
  }
  if (env.STORAGE_PROVIDER === 'CLOUDINARY') {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      return helpers.error('any.custom', {
        message:
          'Debe configurar CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET cuando STORAGE_PROVIDER=CLOUDINARY.',
      });
    }
  }


  const provider = env.EMAIL_PROVIDER ?? env.MAIL_PROVIDER ?? 'DEV_NULL';
  if (provider === 'SENDGRID') {
    const from = env.EMAIL_FROM_EMAIL ?? env.MAIL_FROM;
    if (!from)
      return helpers.error('any.custom', {
        message: 'Debe configurar EMAIL_FROM_EMAIL o MAIL_FROM cuando SendGrid está activo.',
      });
    if (!env.SENDGRID_API_KEY)
      return helpers.error('any.custom', {
        message: 'Debe configurar SENDGRID_API_KEY cuando SendGrid está activo.',
      });
  }
  return env;
});
