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

function normalizeValueByType(value, pgType) {
  const t = (pgType || "").trim().toLowerCase();
  if (value === undefined) return undefined;
  if (value === null) return null;

  // SOLO json/jsonb se valida/serializa como JSON
  if (t === "jsonb" || t === "json") {
    if (typeof value === "string") {
      const s = value.trim();
      if (!s) return null;

      // acepta strings JSON válidos; rechaza basura tipo "[object Object]"
      try {
        JSON.parse(s);
        return s;
      } catch (e) {
        throw new Error(`Invalid JSON param for ${t}: ${s.slice(0, 120)}`);
      }
    }

    // objeto/array/boolean/number -> stringify válido para json/jsonb
    return JSON.stringify(value);
  }

  // Para el resto de tipos: NO JSON.parse, NO JSON.stringify.
  // Solo ajustes mínimos por compatibilidad:
  if (t === "integer" || t === "int" || t === "int4" || t === "bigint" || t === "int8" || t === "smallint" || t === "int2") {
    if (value === "") return null;
    return value; // puede ser number o string numérica, Postgres castea por ::int/::bigint
  }

  if (t === "boolean" || t === "bool") {
    if (value === "") return null;
    return value; // true/false o "true"/"false"
  }

  if (t === "date" || t === "time" || t.startsWith("timestamp")) {
    if (value === "") return null;
    return value; // string tipo "2026-02-04"
  }

  // text/varchar/uuid/numeric/etc: tal cual
  if (value === "") return value; // permite texto vacío si lo mandas
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
    if (!has) {
      // If missing: OK only if function param has DEFAULT; omit it to use default.
      if (!p.hasDefault) {
        throw new Error(`Missing required param '${p.name}' for function ${fnName}`);
      }
      continue;
    }

    const v = normalizeValueByType(args[p.name], p.type);
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
