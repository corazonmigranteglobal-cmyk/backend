/**
 * Escapa los comodines de LIKE/ILIKE en un término de búsqueda del usuario.
 *
 * Sequelize parametriza el valor, así que no hay inyección SQL, pero sin esto
 * un `%` enviado por el cliente convierte la búsqueda en un escaneo completo
 * que devuelve toda la tabla, y un `_` produce coincidencias inesperadas.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/** Construye el patrón `%término%` con los comodines del usuario neutralizados. */
export function containsPattern(value: string): string {
  return `%${escapeLikePattern(value)}%`;
}
