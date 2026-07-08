const REDACTED = '[REDACTED]';
const MAX_DEPTH = 5;
const MAX_ARRAY_ITEMS = 25;
const MAX_STRING_LENGTH = 2_000;

const SENSITIVE_KEYS = [
  'authorization',
  'cookie',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'privateKey',
  'private_key',
];

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitiveKey) => normalized.includes(sensitiveKey.toLowerCase()));
}

function truncateString(value: string) {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated:${value.length}]`;
}

function looksLikeUploadedFile(value: Record<string, unknown>) {
  return (
    typeof value.fieldname === 'string' &&
    typeof value.originalname === 'string' &&
    typeof value.mimetype === 'string'
  );
}

export function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return truncateString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[Buffer:${value.length}]`;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (depth >= MAX_DEPTH) return '[MaxDepth]';

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeForLog(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`[truncated:${value.length}]`);
    return items;
  }

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;

    if (looksLikeUploadedFile(objectValue)) {
      return {
        fieldname: objectValue.fieldname,
        originalname: objectValue.originalname,
        mimetype: objectValue.mimetype,
        size: objectValue.size,
      };
    }

    return Object.fromEntries(
      Object.entries(objectValue).map(([key, entryValue]) => [
        key,
        isSensitiveKey(key) ? REDACTED : sanitizeForLog(entryValue, depth + 1),
      ]),
    );
  }

  return String(value);
}
