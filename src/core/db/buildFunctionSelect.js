import { DB_FUNCTIONS } from "../../config/db_functions.js";

function isPlainObject(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function castFor(pgType) {
  const t = (pgType || "").trim().toLowerCase();
  if (!t) return "";
  if (t === "jsonb") return "::jsonb";
  if (t === "json") return "::json";
  if (t === "uuid") return "::uuid";
  if (t === "integer" || t === "int" || t === "int4") return "::int";
  if (t === "bigint" || t === "int8") return "::bigint";
  if (t === "smallint" || t === "int2") return "::smallint";
  if (t === "boolean" || t === "bool") return "::boolean";
  if (t === "numeric" || t === "decimal") return "::numeric";
  if (t === "real" || t === "float4") return "::real";
  if (t === "double precision" || t === "float8") return "::double precision";
  if (t === "text" || t === "varchar" || t.startsWith("character varying")) return "::text";
  if (t === "date") return "::date";
  if (t === "time") return "::time";
  if (t.startsWith("timestamp")) return "::timestamp";
  // arrays and custom/domain types: keep exact type
  return `::${pgType.trim()}`;
}

/**
 * Normaliza valores según tipo PG.
 * - json/jsonb: valida string JSON o stringify para object/array/primitive
 * - otros tipos: retorna tal cual (solo mapea undefined -> null)
 */
function normalizeValueByType(value, pgType) {
  const t = (pgType || "").trim().toLowerCase();

  // 🔥 Nunca devolver undefined a la query.
  if (value === undefined) return null;
  if (value === null) return null;

  // SOLO json/jsonb se trata como JSON
if (t === "json" || t === "jsonb") {
  return JSON.stringify(value ?? null);
}

  // Para el resto: retornar tal cual.
  // (PG castea con ::date, ::int, etc.)
  return value;
}

/**
 * Build a parametrized SELECT * FROM fn call using named arguments.
 *
 * @param {string} fnName - Full name e.g. "usuarios.fn_signup_paciente_with_verification_pin"
 * @param {object} args   - { p_email: "...", p_pin_metadata: {...}, ... }
 * @returns {{ text: string, values: any[] }}
 */
export function buildSelectFunction(fnName, args = {}) {
  const meta = DB_FUNCTIONS[fnName];
  if (!meta) {
    throw new Error(`Unknown DB function: ${fnName}. Add it to config/db_functions.js or regenerate.`);
  }

  const values = [];
  const parts = [];

  for (const p of meta.params) {
    const has = Object.prototype.hasOwnProperty.call(args, p.name);

    // Si falta: OK solo si tiene DEFAULT. Caso contrario, error.
    if (!has) {
      if (!p.hasDefault) {
        throw new Error(`Missing required param '${p.name}' for function ${fnName}`);
      }
      continue;
    }

    // Normaliza el valor (json/jsonb stringify + validación; otros tal cual)
    const v = normalizeValueByType(args[p.name], p.type);

    // 🔥 Si tiene DEFAULT y el valor es null, puedes decidir:
    // - Enviar null explícito (lo hará NULL)
    // - O omitirlo para que use DEFAULT
    // En tu caso, p_id_cita default NULL, ambos dan lo mismo.
    // Para ser consistente con tu lógica de "si tiene default, puede omitirse",
    // omitimos si viene null y hasDefault=true:
    if (p.hasDefault && (v === null)) {
      continue;
    }

    values.push(v);
    const idx = values.length;
    parts.push(`${p.name} => $${idx}${castFor(p.type)}`);
  }

  const text = `SELECT * FROM ${fnName}(${parts.join(", ")});`;
  return { text, values };
}

/**
 * Helper for bulk payloads: wrap an array of records into jsonb param.
 * Example: buildSelectFunction("analytics.fn_registrar_ui_events_bulk", { p_events: rows })
 */
export function buildSelectFunctionBulk(fnName, bulkParamName, rows, extraArgs = {}) {
  return buildSelectFunction(fnName, { ...extraArgs, [bulkParamName]: rows });
}
