export type NamedEnvironmentValue = {
  name: string;
  value: string;
};

/**
 * Normalizes a value read from process.env without guessing a replacement.
 */
export function cleanEnvironmentValue(value?: string): string | undefined {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return undefined;

  const isDoubleQuoted = trimmedValue.startsWith('"') && trimmedValue.endsWith('"');
  const isSingleQuoted = trimmedValue.startsWith("'") && trimmedValue.endsWith("'");

  if (isDoubleQuoted || isSingleQuoted) {
    return trimmedValue.slice(1, -1).trim() || undefined;
  }

  return trimmedValue;
}

/**
 * Returns the first non-empty environment variable and preserves its source name
 * for actionable validation errors.
 */
export function firstEnvironmentValue(...names: string[]): NamedEnvironmentValue | undefined {
  for (const name of names) {
    const value = cleanEnvironmentValue(process.env[name]);
    if (value) return { name, value };
  }

  return undefined;
}

/**
 * Parses a comma-separated allow-list and removes duplicate values.
 */
export function parseEnvironmentList(value?: string): string[] {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Decodes an optional Base64 UTF-8 value and fails early when it is malformed.
 */
export function decodeOptionalBase64(
  value: string | undefined,
  sourceName: string,
): string | undefined {
  const cleanedValue = cleanEnvironmentValue(value)?.replace(/\s/g, '');
  if (!cleanedValue) return undefined;

  const normalizedValue = cleanedValue.replace(/-/g, '+').replace(/_/g, '/');
  const paddedValue = normalizedValue.padEnd(Math.ceil(normalizedValue.length / 4) * 4, '=');
  const decodedValue = Buffer.from(paddedValue, 'base64')
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .trim();

  if (!decodedValue) {
    throw new Error(`${sourceName} decodes to an empty value.`);
  }

  return decodedValue;
}
