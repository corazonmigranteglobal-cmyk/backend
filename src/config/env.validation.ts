import * as Joi from 'joi';

const durationPattern = /^\d+(ms|s|m|h|d)$/;
const bodyLimitPattern = /^\d+(kb|mb)$/i;

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().integer().port().default(3000),
  API_PREFIX: Joi.string()
    .trim()
    .pattern(/^[a-zA-Z0-9/_-]+$/)
    .default('api/v1'),
  APP_NAME: Joi.string().trim().max(120).default('Corazon Migrante Backend'),
  CORS_ORIGINS: Joi.string().allow('').default('http://localhost:5173'),
  HTTP_BODY_LIMIT: Joi.string().pattern(bodyLimitPattern).default('1mb'),
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(10).default(1),
  SWAGGER_ENABLED: Joi.boolean().optional(),
  VALIDATION_FORBID_NON_WHITELISTED: Joi.boolean().default(false),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  LOG_FILE_PATH: Joi.string().allow('').default(''),

  DATABASE_HOST: Joi.string().trim().required(),
  DATABASE_PORT: Joi.number().integer().port().default(5432),
  DATABASE_NAME: Joi.string().trim().required(),
  DATABASE_USER: Joi.string().trim().required(),
  DATABASE_PASSWORD: Joi.string().min(1).required(),
  DATABASE_SSL: Joi.boolean().default(false),
  DATABASE_SSL_REJECT_UNAUTHORIZED: Joi.boolean().default(true),
  DATABASE_SSL_CA_BASE64: Joi.string().allow('').optional(),
  DATABASE_LOGGING: Joi.boolean().default(false),
  DATABASE_CONNECTION_TIMEOUT_MS: Joi.number().integer().min(1_000).max(60_000).default(15_000),
  DATABASE_STATEMENT_TIMEOUT_MS: Joi.number().integer().min(1_000).max(300_000).default(30_000),
  DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1_000)
    .max(300_000)
    .default(30_000),
  DATABASE_POOL_MAX: Joi.number().integer().min(1).max(100).default(10),
  DATABASE_POOL_MIN: Joi.number().integer().min(0).max(20).default(0),
  DATABASE_POOL_IDLE_MS: Joi.number().integer().min(1_000).max(300_000).default(10_000),
  DATABASE_POOL_ACQUIRE_MS: Joi.number().integer().min(1_000).max(120_000).default(30_000),
  DATABASE_APPLICATION_NAME: Joi.string().trim().max(63).default('corazon-migrante-backend'),
  DATABASE_MIGRATE_ON_STARTUP: Joi.boolean().default(true),
  DATABASE_SEED_BOOT_ON_STARTUP: Joi.boolean().default(true),
  DATABASE_SEED_MOCKUP_ON_STARTUP: Joi.boolean().optional(),
  DATABASE_SEED_RERUN: Joi.boolean().default(false),
  DATABASE_BOOTSTRAP_FAIL_FAST: Joi.boolean().default(true),
  DATABASE_MIGRATIONS_DIR: Joi.string().allow('').optional(),
  DATABASE_SEEDS_BOOT_DIR: Joi.string().allow('').optional(),
  DATABASE_SEEDS_MOCKUP_DIR: Joi.string().allow('').optional(),

  REDIS_ENABLED: Joi.boolean().default(true),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .allow('')
    .optional(),
  REDIS_HOST: Joi.string().trim().allow('').optional(),
  REDIS_PORT: Joi.number().integer().port().default(6379),
  REDIS_USERNAME: Joi.string().allow('').optional(),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().integer().min(0).max(15).default(0),
  REDIS_TLS: Joi.boolean().default(false),
  REDIS_CONNECT_TIMEOUT_MS: Joi.number().integer().min(500).max(30_000).default(5_000),
  REDIS_COMMAND_TIMEOUT_MS: Joi.number().integer().min(500).max(30_000).default(5_000),
  REDIS_SCAN_COUNT: Joi.number().integer().min(10).max(5_000).default(250),
  REDIS_DELETE_BATCH_SIZE: Joi.number().integer().min(10).max(1_000).default(250),
  REDIS_PATTERN_DELETE_MAX_KEYS: Joi.number().integer().min(1).max(100_000).default(10_000),

  OUTBOX_WORKER_ENABLED: Joi.boolean().default(true),
  OUTBOX_BATCH_SIZE: Joi.number().integer().min(1).max(500).default(50),
  OUTBOX_POLL_INTERVAL_MS: Joi.number().integer().min(250).max(300_000).default(2_000),
  OUTBOX_STALE_LOCK_MS: Joi.number().integer().min(30_000).max(86_400_000).default(300_000),
  OUTBOX_RETRY_BASE_DELAY_MS: Joi.number().integer().min(1_000).max(3_600_000).default(30_000),
  OUTBOX_RETRY_MAX_DELAY_MS: Joi.number().integer().min(1_000).max(86_400_000).default(3_600_000),
  OUTBOX_SHUTDOWN_TIMEOUT_MS: Joi.number().integer().min(1_000).max(120_000).default(30_000),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().pattern(durationPattern).default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: Joi.number().integer().min(1).max(365).default(30),
  JWT_ISSUER: Joi.string().trim().max(200).default('corazon-migrante-api'),
  JWT_AUDIENCE: Joi.string().trim().max(200).default('corazon-migrante-clients'),
  BCRYPT_ROUNDS: Joi.number().integer().min(10).max(14).default(12),
  PASSWORD_RESET_EXPIRY_MINUTES: Joi.number().integer().min(5).max(60).default(15),
  PASSWORD_RESET_MAX_ATTEMPTS: Joi.number().integer().min(3).max(10).default(5),

  STORAGE_PROVIDER: Joi.string().valid('LOCAL', 'GCS', 'CLOUDINARY').default('CLOUDINARY'),
  UPLOAD_DIR: Joi.string().trim().default('storage/uploads'),
  MAX_UPLOAD_MB: Joi.number().min(1).max(50).default(8),
  FILE_PROVIDER_TIMEOUT_MS: Joi.number().integer().min(1_000).max(120_000).default(30_000),
  PUBLIC_BASE_URL: Joi.string().uri().default('http://localhost:3000'),
  FILE_SIGNED_URL_EXPIRES_SECONDS: Joi.number().integer().min(60).max(86_400).default(900),
  GCS_SIGNED_URL_TTL_SECONDS: Joi.number().integer().min(60).max(86_400).optional(),
  GCS_BUCKET: Joi.string().allow('').optional(),
  GCS_BUCKET_NAME_USER_MEDIA: Joi.string().allow('').optional(),
  GCS_BUCKET_NAME_PUBLIC_ASSETS: Joi.string().allow('').optional(),
  GCS_UPLOAD_PREFIX_USER_MEDIA: Joi.string().allow('').optional(),
  GCS_UPLOAD_PREFIX_PUBLIC_ASSETS: Joi.string().allow('').optional(),
  GCP_PROJECT_ID: Joi.string().allow('').optional(),
  GCS_PUBLIC_BASE_URL: Joi.string().uri().allow('').optional(),
  GCS_UPLOAD_FALLBACK_TO_LOCAL: Joi.boolean().optional(),
  FILES_GCS_FALLBACK_TO_LOCAL: Joi.boolean().optional(),
  GCS_USE_ADC: Joi.boolean().default(false),
  GOOGLE_CREDENTIALS_BASE64: Joi.string().allow('').optional(),
  GOOGLE_APPLICATION_CREDENTIALS: Joi.string().allow('').optional(),
  GOOGLE_APPLICATION_CREDENTIALS_JSON: Joi.string().allow('').optional(),
  GOOGLE_APPLICATION_CREDENTIALS_BASE64: Joi.string().allow('').optional(),
  GOOGLE_CREDENTIALS: Joi.string().allow('').optional(),
  GOOGLE_CREDENTIALS_JSON: Joi.string().allow('').optional(),
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
  NEWS_SUBSCRIPTION_AMOUNT_BOB: Joi.number().min(0).optional(),
  NEWS_SUBSCRIPTION_CURRENCY: Joi.string().length(3).uppercase().default('BOB'),

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
}).custom((environment, helpers) => {
  const production = environment.NODE_ENV === 'production';
  const corsOrigins = String(environment.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const productionOrigins: string[] = [];
  for (const origin of corsOrigins) {
    if (origin === '*') {
      return helpers.error('any.custom', { message: 'CORS_ORIGINS cannot contain a wildcard.' });
    }
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      return helpers.error('any.custom', { message: `Invalid CORS origin: ${origin}` });
    }
    // En produccion solo se admiten origenes HTTPS reales. Los de desarrollo
    // (localhost / http) se ignoran en vez de tumbar el arranque, para que un
    // .env que arrastra origenes locales no deje la app en bucle de reinicios.
    if (production && parsedOrigin.protocol !== 'https:') {
      continue;
    }
    productionOrigins.push(origin);
  }

  if (production && productionOrigins.length === 0) {
    return helpers.error('any.custom', {
      message: 'CORS_ORIGINS must contain at least one HTTPS production origin.',
    });
  }

  if (production && new URL(environment.PUBLIC_BASE_URL).protocol !== 'https:') {
    return helpers.error('any.custom', {
      message: 'PUBLIC_BASE_URL must use HTTPS in production.',
    });
  }

  if (production && String(environment.DATABASE_NAME).toLowerCase() === 'postgres') {
    return helpers.error('any.custom', {
      message:
        'Production must use a dedicated database instead of the administrative postgres database.',
    });
  }

  if (environment.DATABASE_POOL_MIN > environment.DATABASE_POOL_MAX) {
    return helpers.error('any.custom', {
      message: 'DATABASE_POOL_MIN cannot exceed DATABASE_POOL_MAX.',
    });
  }

  if (environment.JWT_ACCESS_SECRET === environment.JWT_REFRESH_SECRET) {
    return helpers.error('any.custom', {
      message: 'JWT access and refresh secrets must be different.',
    });
  }

  if (environment.OUTBOX_RETRY_BASE_DELAY_MS > environment.OUTBOX_RETRY_MAX_DELAY_MS) {
    return helpers.error('any.custom', {
      message: 'OUTBOX_RETRY_BASE_DELAY_MS cannot exceed OUTBOX_RETRY_MAX_DELAY_MS.',
    });
  }

  if (environment.STORAGE_PROVIDER === 'GCS') {
    if (!environment.GCS_BUCKET && !environment.GCS_BUCKET_NAME_USER_MEDIA) {
      return helpers.error('any.custom', {
        message: 'Configure GCS_BUCKET or GCS_BUCKET_NAME_USER_MEDIA when STORAGE_PROVIDER=GCS.',
      });
    }

    const hasCanonicalCredentials = Boolean(environment.GOOGLE_CREDENTIALS_BASE64);
    const usesApplicationDefaultCredentials = environment.GCS_USE_ADC === true;
    const hasLegacyCredentials = Boolean(
      environment.GOOGLE_APPLICATION_CREDENTIALS ||
      environment.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
      environment.GOOGLE_APPLICATION_CREDENTIALS_BASE64 ||
      environment.GOOGLE_CREDENTIALS_JSON ||
      environment.GOOGLE_CREDENTIALS ||
      environment.GOOGLE_SERVICE_ACCOUNT_BASE64 ||
      environment.GCP_SERVICE_ACCOUNT_BASE64,
    );

    if (production && !hasCanonicalCredentials && !usesApplicationDefaultCredentials) {
      return helpers.error('any.custom', {
        message: 'Production GCS requires GOOGLE_CREDENTIALS_BASE64 or GCS_USE_ADC=true.',
      });
    }
    if (
      !production &&
      !hasCanonicalCredentials &&
      !usesApplicationDefaultCredentials &&
      !hasLegacyCredentials
    ) {
      return helpers.error('any.custom', {
        message: 'GCS credentials are required when STORAGE_PROVIDER=GCS.',
      });
    }
  }

  if (
    environment.STORAGE_PROVIDER === 'CLOUDINARY' &&
    (!environment.CLOUDINARY_CLOUD_NAME ||
      !environment.CLOUDINARY_API_KEY ||
      !environment.CLOUDINARY_API_SECRET)
  ) {
    return helpers.error('any.custom', {
      message: 'Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
    });
  }

  const emailProvider = environment.EMAIL_PROVIDER ?? environment.MAIL_PROVIDER ?? 'DEV_NULL';
  if (emailProvider === 'SENDGRID') {
    if (!(environment.EMAIL_FROM_EMAIL ?? environment.MAIL_FROM)) {
      return helpers.error('any.custom', {
        message: 'Configure EMAIL_FROM_EMAIL or MAIL_FROM when SendGrid is enabled.',
      });
    }
    if (!environment.SENDGRID_API_KEY) {
      return helpers.error('any.custom', {
        message: 'Configure SENDGRID_API_KEY when SendGrid is enabled.',
      });
    }
  }

  return environment;
})
  // Sin esto, Joi imprime "failed custom validation because " y descarta el
  // texto que pasamos en `{ message }`, dejando el error de config indiagnosticable.
  .messages({ 'any.custom': '{{#message}}' });
