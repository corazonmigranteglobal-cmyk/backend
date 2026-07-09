import { existsSync, readFileSync } from 'fs';
type ParsedRedisUrl = {
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: boolean;
};

function parseRedisUrl(): ParsedRedisUrl {
  const redisUrl = cleanEnvValue(process.env.REDIS_URL);
  if (!redisUrl) return {};
  try {
    const parsed = new URL(redisUrl);
    const dbPath = parsed.pathname.replace(/^\//, '').trim();
    return {
      url: redisUrl,
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 6379,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      db: dbPath ? Number(dbPath) : 0,
      tls: parsed.protocol === 'rediss:',
    };
  } catch {
    return {};
  }
}

function cleanEnvValue(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}


function looksLikeInlineCredential(value?: string) {
  const cleaned = cleanEnvValue(value);
  return !!cleaned && (cleaned.startsWith('{') || cleaned.startsWith('eyJ'));
}

function resolveGoogleCredentialsPath() {
  const value = cleanEnvValue(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (!value) return undefined;
  // GOOGLE_APPLICATION_CREDENTIALS normalmente es una ruta a JSON. Si alguien pega el JSON
  // completo o base64 en esa variable desde Coolify/.env, no se debe pasar como keyFilename.
  if (looksLikeInlineCredential(value)) return undefined;
  return existsSync(value) ? value : undefined;
}

function parseCredentialJson(raw: string, source: string) {
  const cleaned = cleanEnvValue(raw);
  if (!cleaned) return undefined;

  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    // Caso común en paneles web: se pega {\"type\":\"service_account\",...}
    // Eso no es JSON válido directo, así que intentamos desescaparlo una sola vez.
    try {
      const unescaped = cleaned.replace(/\\"/g, '"');
      return JSON.parse(unescaped);
    } catch {
      const message = firstError instanceof Error ? firstError.message : String(firstError);
      throw new Error(`${source} no contiene un JSON válido de Google Service Account: ${message}`);
    }
  }
}

function normalizeGoogleCredentials(credentials: unknown, source: string) {
  if (!credentials || typeof credentials !== 'object') {
    throw new Error(`${source} debe decodificar a un objeto JSON.`);
  }

  const serviceAccount = credentials as Record<string, unknown>;
  if (typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  if (serviceAccount.type !== 'service_account') {
    throw new Error(`${source} debe ser una credencial de tipo service_account.`);
  }
  if (!serviceAccount.project_id || typeof serviceAccount.project_id !== 'string') {
    throw new Error(`${source} no tiene project_id.`);
  }
  if (!serviceAccount.client_email || typeof serviceAccount.client_email !== 'string') {
    throw new Error(`${source} no tiene client_email.`);
  }
  if (!serviceAccount.private_key || typeof serviceAccount.private_key !== 'string') {
    throw new Error(`${source} no tiene private_key.`);
  }

  return serviceAccount;
}

function firstCleanEnv(...names: string[]) {
  for (const name of names) {
    const value = cleanEnvValue(process.env[name]);
    if (value) return { name, value };
  }
  return undefined;
}


function decodeBase64Credential(raw: string, source: string) {
  const cleaned = cleanEnvValue(raw)?.replace(/^data:application\/json;base64,/i, '').replace(/\s/g, '');
  if (!cleaned) return undefined;
  const normalized = cleaned.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const decoded = Buffer.from(padded, 'base64').toString('utf8').replace(/^\uFEFF/, '').trim();
  if (!decoded.startsWith('{')) {
    throw new Error(`${source} no decodifica a JSON. Verifica que hayas codificado el service-account JSON completo en base64.`);
  }
  return decoded;
}

function credentialsFromSplitEnv() {
  const clientEmail = firstCleanEnv('GOOGLE_CLIENT_EMAIL', 'GCP_CLIENT_EMAIL');
  const privateKey = firstCleanEnv('GOOGLE_PRIVATE_KEY', 'GCP_PRIVATE_KEY');
  if (!clientEmail || !privateKey) return undefined;

  return normalizeGoogleCredentials(
    {
      type: 'service_account',
      project_id: cleanEnvValue(process.env.GCP_PROJECT_ID) ?? cleanEnvValue(process.env.GOOGLE_PROJECT_ID),
      private_key_id: cleanEnvValue(process.env.GOOGLE_PRIVATE_KEY_ID) ?? cleanEnvValue(process.env.GCP_PRIVATE_KEY_ID),
      private_key: privateKey.value,
      client_email: clientEmail.value,
    },
    `${clientEmail.name}+${privateKey.name}`,
  );
}

function parseGoogleCredentials() {
  // Prioridad deliberada: Base64 > JSON directo > archivo GOOGLE_APPLICATION_CREDENTIALS.
  // Así se soportan .env.local, Coolify y nombres comunes de variables sin romper por aliases viejos.
  const base64 = firstCleanEnv(
    'GOOGLE_CREDENTIALS_BASE64',
    'GOOGLE_APPLICATION_CREDENTIALS_BASE64',
    'GOOGLE_SERVICE_ACCOUNT_BASE64',
    'GCP_SERVICE_ACCOUNT_BASE64',
  );
  if (base64) {
    const decoded = decodeBase64Credential(base64.value, base64.name)!;
    return normalizeGoogleCredentials(parseCredentialJson(decoded, base64.name), base64.name);
  }

  const json = firstCleanEnv('GOOGLE_APPLICATION_CREDENTIALS_JSON', 'GOOGLE_CREDENTIALS_JSON', 'GOOGLE_CREDENTIALS');
  if (json) {
    return normalizeGoogleCredentials(parseCredentialJson(json.value, json.name), json.name);
  }

  const splitCredentials = credentialsFromSplitEnv();
  if (splitCredentials) return splitCredentials;

  const googleApplicationCredentials = cleanEnvValue(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (looksLikeInlineCredential(googleApplicationCredentials)) {
    const raw = googleApplicationCredentials!;
    const decoded = raw.startsWith('eyJ') ? decodeBase64Credential(raw, 'GOOGLE_APPLICATION_CREDENTIALS')! : raw;
    return normalizeGoogleCredentials(
      parseCredentialJson(decoded, 'GOOGLE_APPLICATION_CREDENTIALS'),
      'GOOGLE_APPLICATION_CREDENTIALS',
    );
  }

  const credentialsPath = resolveGoogleCredentialsPath();
  if (credentialsPath) {
    return normalizeGoogleCredentials(
      parseCredentialJson(readFileSync(credentialsPath, 'utf8'), 'GOOGLE_APPLICATION_CREDENTIALS'),
      'GOOGLE_APPLICATION_CREDENTIALS',
    );
  }

  return undefined;
}
export default () => {
  const redisFromUrl = parseRedisUrl();
  const emailProvider = process.env.EMAIL_PROVIDER ?? process.env.MAIL_PROVIDER ?? 'DEV_NULL';
  const fromEmail = process.env.EMAIL_FROM_EMAIL ?? process.env.MAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME ?? process.env.MAIL_FROM_NAME ?? 'Corazón Migrante';
  const gcsBucket = process.env.GCS_BUCKET ?? process.env.GCS_BUCKET_NAME_USER_MEDIA;
  const gcsUserMediaBucket = process.env.GCS_BUCKET_NAME_USER_MEDIA ?? process.env.GCS_BUCKET;
  const gcsPublicAssetsBucket = process.env.GCS_BUCKET_NAME_PUBLIC_ASSETS ?? process.env.GCS_BUCKET;
  const signedUrlExpiresSeconds = Number(
    process.env.FILE_SIGNED_URL_EXPIRES_SECONDS ?? process.env.GCS_SIGNED_URL_TTL_SECONDS ?? 900,
  );
  const gcsFallbackRaw = process.env.GCS_UPLOAD_FALLBACK_TO_LOCAL ?? process.env.FILES_GCS_FALLBACK_TO_LOCAL;
  // En desarrollo local el fallback queda activo incluso si antes se dejó la variable en false.
  // Eso evita que una credencial/bucket de GCS mal configurado bloquee pruebas visuales de CMS/fotos.
  // En producción sigue apagado salvo que se active explícitamente con GCS_UPLOAD_FALLBACK_TO_LOCAL=true.
  const gcsUploadFallbackToLocal =
    process.env.NODE_ENV !== 'production' || String(gcsFallbackRaw ?? '').toLowerCase() === 'true';
  const gcsCredentialsPath = resolveGoogleCredentialsPath();
  const cloudinaryFolder = process.env.CLOUDINARY_FOLDER ?? process.env.CLOUDINARY_UPLOAD_FOLDER ?? 'corazon-migrante';

  return {
    app: {
      port: Number(process.env.PORT ?? 3000),
      apiPrefix: process.env.API_PREFIX ?? 'api/v1',
      name: process.env.APP_NAME ?? 'Corazon Migrante Backend',
      corsOrigins: (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    },
    database: {
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT ?? 5432),
      name: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      ssl: process.env.DATABASE_SSL === 'true',
      logging: process.env.DATABASE_LOGGING === 'true',
      connectionTimeoutMs: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 20000),
      bootstrapOnStartup: process.env.DATABASE_BOOTSTRAP_ON_STARTUP !== 'false',
      bootstrapFailFast: process.env.DATABASE_BOOTSTRAP_FAIL_FAST !== 'false',
      seedPublicCmsOnStartup: process.env.DATABASE_SEED_PUBLIC_CMS_ON_STARTUP !== 'false',
    },
    redis: {
      // REDIS_URL tiene prioridad intencional en despliegues Docker/Coolify.
      // Si REDIS_HOST quedo como localhost por default o por una variable vieja,
      // no debe pisar el host real incluido en redis://usuario:password@host:6379/0.
      enabled: String(process.env.REDIS_ENABLED ?? 'true').toLowerCase() !== 'false',
      url: redisFromUrl.url,
      host: redisFromUrl.host ?? cleanEnvValue(process.env.REDIS_HOST) ?? 'localhost',
      port: Number(redisFromUrl.port ?? cleanEnvValue(process.env.REDIS_PORT) ?? 6379),
      username: redisFromUrl.username ?? cleanEnvValue(process.env.REDIS_USERNAME),
      password: redisFromUrl.password ?? cleanEnvValue(process.env.REDIS_PASSWORD) ?? undefined,
      db: Number(redisFromUrl.db ?? cleanEnvValue(process.env.REDIS_DB) ?? 0),
      tls: redisFromUrl.tls ?? String(process.env.REDIS_TLS ?? 'false').toLowerCase() === 'true',
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshExpiresDays: Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 30),
    },
    security: {
      bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 10),
    },
    files: {
      storageProvider: process.env.STORAGE_PROVIDER ?? 'CLOUDINARY',
      uploadDir: process.env.UPLOAD_DIR ?? 'storage/uploads',
      maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 8),
      publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,
      signedUrlExpiresSeconds,
      gcs: {
        bucket: gcsBucket,
        userMediaBucket: gcsUserMediaBucket,
        publicAssetsBucket: gcsPublicAssetsBucket,
        projectId: process.env.GCP_PROJECT_ID,
        publicBaseUrl: process.env.GCS_PUBLIC_BASE_URL,
        credentials: parseGoogleCredentials(),
        keyFilename: gcsCredentialsPath,
        uploadFallbackToLocal: gcsUploadFallbackToLocal,
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
        process.env.NEWS_SUBSCRIPTION_QR_FILE_ID ?? process.env.PREMIUM_SUBSCRIPTION_QR_FILE_ID,
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
      fromEmail,
      fromName,
      replyTo: process.env.MAIL_REPLY_TO,
      sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY,
      },
    },
  };
};
