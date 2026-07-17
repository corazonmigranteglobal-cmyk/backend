import { decodeOptionalBase64, parseEnvironmentList } from './environment.util';
import { resolveGoogleCredentials } from './google-credentials.config';
import { resolveRedisConnection } from './redis.config';

export default () => {
  const storageProvider = (process.env.STORAGE_PROVIDER ?? 'CLOUDINARY').toUpperCase();
  const redisConnection = resolveRedisConnection();
  const googleCredentials =
    storageProvider === 'GCS' ? resolveGoogleCredentials() : {};
  const emailProvider = process.env.EMAIL_PROVIDER ?? process.env.MAIL_PROVIDER ?? 'DEV_NULL';
  const gcsBucket = process.env.GCS_BUCKET ?? process.env.GCS_BUCKET_NAME_USER_MEDIA;
  const cloudinaryFolder =
    process.env.CLOUDINARY_FOLDER ??
    process.env.CLOUDINARY_UPLOAD_FOLDER ??
    'corazon-migrante';
  const gcsFallbackValue =
    process.env.GCS_UPLOAD_FALLBACK_TO_LOCAL ?? process.env.FILES_GCS_FALLBACK_TO_LOCAL;

  return {
    app: {
      port: Number(process.env.PORT ?? 3000),
      apiPrefix: process.env.API_PREFIX ?? 'api/v1',
      name: process.env.APP_NAME ?? 'Corazon Migrante Backend',
      corsOrigins: parseEnvironmentList(process.env.CORS_ORIGINS),
      bodyLimit: process.env.HTTP_BODY_LIMIT ?? '1mb',
      trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 1),
      swaggerEnabled:
        process.env.SWAGGER_ENABLED === 'true' ||
        (process.env.NODE_ENV !== 'production' && process.env.SWAGGER_ENABLED !== 'false'),
    },
    database: {
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT ?? 5432),
      name: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      ssl: process.env.DATABASE_SSL === 'true',
      sslRejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
      sslCa: decodeOptionalBase64(
        process.env.DATABASE_SSL_CA_BASE64,
        'DATABASE_SSL_CA_BASE64',
      ),
      logging: process.env.DATABASE_LOGGING === 'true',
      connectionTimeoutMs: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 15_000),
      statementTimeoutMs: Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS ?? 30_000),
      idleTransactionTimeoutMs: Number(
        process.env.DATABASE_IDLE_TRANSACTION_TIMEOUT_MS ?? 30_000,
      ),
      poolMax: Number(process.env.DATABASE_POOL_MAX ?? 10),
      poolMin: Number(process.env.DATABASE_POOL_MIN ?? 0),
      poolIdleMs: Number(process.env.DATABASE_POOL_IDLE_MS ?? 10_000),
      poolAcquireMs: Number(process.env.DATABASE_POOL_ACQUIRE_MS ?? 30_000),
      applicationName: process.env.DATABASE_APPLICATION_NAME ?? 'corazon-migrante-backend',
      bootstrapOnStartup: process.env.DATABASE_BOOTSTRAP_ON_STARTUP === 'true',
      bootstrapFailFast: process.env.DATABASE_BOOTSTRAP_FAIL_FAST !== 'false',
      seedPublicCmsOnStartup: process.env.DATABASE_SEED_PUBLIC_CMS_ON_STARTUP === 'true',
    },
    redis: {
      enabled: String(process.env.REDIS_ENABLED ?? 'true').toLowerCase() !== 'false',
      ...redisConnection,
      connectTimeoutMs: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 5_000),
      commandTimeoutMs: Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? 5_000),
      scanCount: Number(process.env.REDIS_SCAN_COUNT ?? 250),
      deleteBatchSize: Number(process.env.REDIS_DELETE_BATCH_SIZE ?? 250),
      maxPatternDeleteKeys: Number(process.env.REDIS_PATTERN_DELETE_MAX_KEYS ?? 10_000),
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshExpiresDays: Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 30),
      issuer: process.env.JWT_ISSUER ?? 'corazon-migrante-api',
      audience: process.env.JWT_AUDIENCE ?? 'corazon-migrante-clients',
    },
    security: {
      bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
      passwordResetExpiryMinutes: Number(process.env.PASSWORD_RESET_EXPIRY_MINUTES ?? 15),
      passwordResetMaxAttempts: Number(process.env.PASSWORD_RESET_MAX_ATTEMPTS ?? 5),
    },
    outbox: {
      workerEnabled: process.env.OUTBOX_WORKER_ENABLED !== 'false',
      batchSize: Number(process.env.OUTBOX_BATCH_SIZE ?? 50),
      pollIntervalMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 2_000),
      staleLockMs: Number(process.env.OUTBOX_STALE_LOCK_MS ?? 300_000),
      retryBaseDelayMs: Number(process.env.OUTBOX_RETRY_BASE_DELAY_MS ?? 30_000),
      retryMaxDelayMs: Number(process.env.OUTBOX_RETRY_MAX_DELAY_MS ?? 3_600_000),
      shutdownTimeoutMs: Number(process.env.OUTBOX_SHUTDOWN_TIMEOUT_MS ?? 30_000),
    },
    files: {
      storageProvider,
      uploadDir: process.env.UPLOAD_DIR ?? 'storage/uploads',
      maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 8),
      publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,
      signedUrlExpiresSeconds: Number(
        process.env.FILE_SIGNED_URL_EXPIRES_SECONDS ??
          process.env.GCS_SIGNED_URL_TTL_SECONDS ??
          900,
      ),
      gcs: {
        bucket: gcsBucket,
        userMediaBucket: process.env.GCS_BUCKET_NAME_USER_MEDIA ?? process.env.GCS_BUCKET,
        publicAssetsBucket: process.env.GCS_BUCKET_NAME_PUBLIC_ASSETS ?? process.env.GCS_BUCKET,
        projectId: process.env.GCP_PROJECT_ID,
        publicBaseUrl: process.env.GCS_PUBLIC_BASE_URL,
        credentials: googleCredentials.credentials,
        keyFilename: googleCredentials.keyFilename,
        uploadFallbackToLocal:
          process.env.NODE_ENV !== 'production' ||
          String(gcsFallbackValue ?? '').toLowerCase() === 'true',
        userMediaPrefix: process.env.GCS_UPLOAD_PREFIX_USER_MEDIA ?? 'users',
        publicAssetsPrefix: process.env.GCS_UPLOAD_PREFIX_PUBLIC_ASSETS ?? 'public',
      },
      cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET,
        folder: cloudinaryFolder,
        userMediaPrefix:
          process.env.CLOUDINARY_UPLOAD_PREFIX_USER_MEDIA ??
          process.env.GCS_UPLOAD_PREFIX_USER_MEDIA ??
          'users',
        publicAssetsPrefix:
          process.env.CLOUDINARY_UPLOAD_PREFIX_PUBLIC_ASSETS ??
          process.env.GCS_UPLOAD_PREFIX_PUBLIC_ASSETS ??
          'public',
      },
    },
    content: {
      subscriptionQrFileId:
        process.env.NEWS_SUBSCRIPTION_QR_FILE_ID ??
        process.env.PREMIUM_SUBSCRIPTION_QR_FILE_ID,
      subscriptionInstructionsFileId:
        process.env.NEWS_SUBSCRIPTION_INSTRUCTIONS_FILE_ID ??
        process.env.PREMIUM_SUBSCRIPTION_INSTRUCTIONS_FILE_ID,
      subscriptionPaymentTitle:
        process.env.NEWS_SUBSCRIPTION_PAYMENT_TITLE ?? 'Suscripción premium',
      subscriptionPaymentInstructions:
        process.env.NEWS_SUBSCRIPTION_PAYMENT_INSTRUCTIONS ??
        'Escanea el QR, realiza el pago y envía el comprobante al equipo de Corazón Migrante para activar tu acceso premium.',
      subscriptionAmountBob: Number(process.env.NEWS_SUBSCRIPTION_AMOUNT_BOB ?? 0),
      subscriptionCurrency: process.env.NEWS_SUBSCRIPTION_CURRENCY ?? 'BOB',
    },
    email: {
      provider: emailProvider,
      fromEmail: process.env.EMAIL_FROM_EMAIL ?? process.env.MAIL_FROM,
      fromName:
        process.env.EMAIL_FROM_NAME ?? process.env.MAIL_FROM_NAME ?? 'Corazón Migrante',
      replyTo: process.env.MAIL_REPLY_TO,
      sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY,
      },
    },
  };
};
