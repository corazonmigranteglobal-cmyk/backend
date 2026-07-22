import { existsSync, readFileSync } from 'node:fs';
import {
  cleanEnvironmentValue,
  decodeOptionalBase64,
  firstEnvironmentValue,
} from './environment.util';

const MAX_CREDENTIAL_JSON_BYTES = 64 * 1024;

type GoogleServiceAccountCredentials = {
  type: 'service_account';
  project_id: string;
  client_email: string;
  private_key: string;
  private_key_id?: string;
  [key: string]: unknown;
};

export type GoogleCredentialsConfiguration = {
  credentials?: GoogleServiceAccountCredentials;
  keyFilename?: string;
};

function parseCredentialJson(rawValue: string, sourceName: string): unknown {
  if (Buffer.byteLength(rawValue, 'utf8') > MAX_CREDENTIAL_JSON_BYTES) {
    throw new Error(`${sourceName} exceeds the maximum accepted credential size.`);
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${sourceName} does not contain valid JSON: ${reason}`);
  }
}

function normalizeCredentials(value: unknown, sourceName: string): GoogleServiceAccountCredentials {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${sourceName} must decode to a JSON object.`);
  }

  const rawCredentials = value as Record<string, unknown>;
  const type = rawCredentials.type;
  const projectId = rawCredentials.project_id;
  const clientEmail = rawCredentials.client_email;
  const privateKey = rawCredentials.private_key;

  if (type !== 'service_account') {
    throw new Error(`${sourceName} must contain a service_account credential.`);
  }
  if (typeof projectId !== 'string' || !projectId.trim()) {
    throw new Error(`${sourceName} is missing project_id.`);
  }
  if (typeof clientEmail !== 'string' || !clientEmail.trim()) {
    throw new Error(`${sourceName} is missing client_email.`);
  }
  if (typeof privateKey !== 'string' || !privateKey.includes('PRIVATE KEY')) {
    throw new Error(`${sourceName} is missing a valid private_key.`);
  }

  return {
    ...rawCredentials,
    type: 'service_account',
    project_id: projectId.trim(),
    client_email: clientEmail.trim(),
    private_key: privateKey.replace(/\\n/g, '\n'),
    private_key_id:
      typeof rawCredentials.private_key_id === 'string' ? rawCredentials.private_key_id : undefined,
  };
}

function parseBase64Credentials(value: string, sourceName: string) {
  const decodedValue = decodeOptionalBase64(
    value.replace(/^data:application\/json;base64,/i, ''),
    sourceName,
  );
  if (!decodedValue?.startsWith('{')) {
    throw new Error(
      `${sourceName} must contain the complete service-account JSON encoded in Base64.`,
    );
  }

  return normalizeCredentials(parseCredentialJson(decodedValue, sourceName), sourceName);
}

function resolveLegacyDevelopmentCredentials(): GoogleCredentialsConfiguration {
  const legacyInlineValue = firstEnvironmentValue(
    'GOOGLE_APPLICATION_CREDENTIALS_JSON',
    'GOOGLE_CREDENTIALS_JSON',
    'GOOGLE_CREDENTIALS',
  );
  if (legacyInlineValue) {
    return {
      credentials: normalizeCredentials(
        parseCredentialJson(legacyInlineValue.value, legacyInlineValue.name),
        legacyInlineValue.name,
      ),
    };
  }

  const legacyBase64Value = firstEnvironmentValue(
    'GOOGLE_APPLICATION_CREDENTIALS_BASE64',
    'GOOGLE_SERVICE_ACCOUNT_BASE64',
    'GCP_SERVICE_ACCOUNT_BASE64',
  );
  if (legacyBase64Value) {
    return {
      credentials: parseBase64Credentials(legacyBase64Value.value, legacyBase64Value.name),
    };
  }

  const credentialsPath = cleanEnvironmentValue(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (!credentialsPath) return {};
  if (!existsSync(credentialsPath)) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS points to a file that does not exist.');
  }

  return {
    credentials: normalizeCredentials(
      parseCredentialJson(readFileSync(credentialsPath, 'utf8'), 'GOOGLE_APPLICATION_CREDENTIALS'),
      'GOOGLE_APPLICATION_CREDENTIALS',
    ),
  };
}

/**
 * Resolves explicit GCS credentials without ever logging their contents.
 * Production accepts the canonical Base64 secret or Application Default
 * Credentials. Legacy aliases remain development-only to ease local migration.
 */
export function resolveGoogleCredentials(): GoogleCredentialsConfiguration {
  const canonicalBase64 = cleanEnvironmentValue(process.env.GOOGLE_CREDENTIALS_BASE64);
  if (canonicalBase64) {
    return {
      credentials: parseBase64Credentials(canonicalBase64, 'GOOGLE_CREDENTIALS_BASE64'),
    };
  }

  const useApplicationDefaultCredentials =
    String(process.env.GCS_USE_ADC ?? 'false').toLowerCase() === 'true';
  if (useApplicationDefaultCredentials) {
    const keyFilename = cleanEnvironmentValue(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    if (keyFilename && !existsSync(keyFilename)) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS points to a file that does not exist.');
    }
    return { keyFilename };
  }

  if (process.env.NODE_ENV === 'production') {
    const legacyCredential = firstEnvironmentValue(
      'GOOGLE_APPLICATION_CREDENTIALS',
      'GOOGLE_APPLICATION_CREDENTIALS_JSON',
      'GOOGLE_APPLICATION_CREDENTIALS_BASE64',
      'GOOGLE_CREDENTIALS_JSON',
      'GOOGLE_CREDENTIALS',
      'GOOGLE_SERVICE_ACCOUNT_BASE64',
      'GCP_SERVICE_ACCOUNT_BASE64',
    );
    if (legacyCredential) {
      throw new Error(
        `${legacyCredential.name} is not accepted for explicit production keys. Use GOOGLE_CREDENTIALS_BASE64 or GCS_USE_ADC=true.`,
      );
    }
    return {};
  }

  return resolveLegacyDevelopmentCredentials();
}
