import type { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-base';

/**
 * Sanea atributos generados por las instrumentaciones automáticas antes de que
 * el exportador los envíe.
 *
 * Necesario porque dos fugas reales sobreviven a la configuración de las
 * instrumentaciones (ambas detectadas ejecutando el backend contra un Jaeger
 * real, no en teoría):
 *
 *  1. `url.full` incluye el query string completo. Una búsqueda como
 *     `?search=juan.perez@gmail.com` acababa almacenada en la traza.
 *  2. `db.query.text` contiene los literales del SQL. `enhancedDatabaseReporting:
 *     false` sólo suprime el array de parámetros, pero **Sequelize no usa
 *     parámetros ligados** en las cláusulas `where`: interpola los valores ya
 *     escapados dentro de la propia sentencia, así que el correo del paciente
 *     viajaba dentro de `ILIKE '%…%'`.
 *
 * Se conserva la *forma* de la consulta y de la URL —que es lo que sirve para
 * diagnosticar latencia— y se descarta el *contenido*.
 */

/** Literales entre comillas simples de SQL, incluidas las comillas escapadas (`''`). */
const SQL_STRING_LITERAL = /'(?:[^']|'')*'/g;
/** Números sueltos tras un operador de comparación o en una lista de valores. */
const SQL_NUMERIC_LITERAL = /(?<=[=<>,(]\s*)-?\d+(?:\.\d+)?\b/g;

export function redactSqlLiterals(sql: string): string {
  return sql.replace(SQL_STRING_LITERAL, "'?'").replace(SQL_NUMERIC_LITERAL, '?');
}

export function stripQueryString(url: string): string {
  const [withoutFragment] = url.split('#');
  return withoutFragment.split('?')[0];
}

const REDACTORS: Record<string, (value: string) => string> = {
  'db.query.text': redactSqlLiterals,
  // Nombre heredado del atributo en versiones anteriores de las convenciones.
  'db.statement': redactSqlLiterals,
  'url.full': stripQueryString,
  'http.url': stripQueryString,
  'http.target': stripQueryString,
};

/** Atributos que se eliminan por completo: no aportan nada sin sus valores. */
const DROPPED_ATTRIBUTES = ['url.query', 'db.query.parameters'];

/**
 * Procesador sin exportador propio: se encadena **antes** del
 * `BatchSpanProcessor` en `spanProcessors`, de modo que muta los atributos y el
 * exportador ya recibe la versión saneada.
 */
export class SpanRedactionProcessor implements SpanProcessor {
  onStart(): void {
    // Sin trabajo: las instrumentaciones fijan los atributos problemáticos al
    // cerrar el span, no al abrirlo.
  }

  onEnd(span: ReadableSpan): void {
    const attributes = span.attributes as Record<string, unknown>;

    for (const [key, redact] of Object.entries(REDACTORS)) {
      const value = attributes[key];
      if (typeof value === 'string') attributes[key] = redact(value);
    }

    for (const key of DROPPED_ATTRIBUTES) {
      if (key in attributes) delete attributes[key];
    }
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
