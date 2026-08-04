import { randomUUID } from 'node:crypto';

/**
 * El header `X-Request-Id` lo controla el cliente y se refleja tanto en la
 * respuesta como en los logs estructurados. Aceptarlo tal cual permite inyectar
 * saltos de línea (log forging) o cabeceras arbitrarias, así que sólo se
 * conserva cuando es un identificador de correlación plausible.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

export function resolveRequestId(rawValue: unknown): string {
  const candidate = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (typeof candidate === 'string' && SAFE_REQUEST_ID.test(candidate)) {
    return candidate;
  }
  return randomUUID();
}
