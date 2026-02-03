import { DB_FUNCTIONS } from "../../src/config/db_functions.js";
import { buildSelectFunction, buildSelectFunctionBulk } from "../../src/core/db/buildFunctionSelect.js";

function isJsonType(t) {
  const x = (t || "").toLowerCase().trim();
  return x === "jsonb" || x === "json";
}

function looksLikeBulkParam(paramName = "") {
  const n = paramName.toLowerCase();

  if (n.includes("metadata") || n.includes("patch")) return false;

  return /(events|rows|items|registros|movimientos|detalles|detalle|lista|list|bulk|lote|batch)/i.test(n);
}

function isTimeParam(name = "") {
  const n = name.toLowerCase();
  return n.includes("hora_inicio") || n.includes("hora_fin");
}

function isTimestampParam(name = "") {
  const n = name.toLowerCase();
  return n.includes("inicio") || n.includes("fin");
}

function mockValueByType(pgType, paramName = "") {
  const t = (pgType || "").toLowerCase().trim();
  const n = (paramName || "").toLowerCase();

  if (t === "json" || t === "jsonb") {
    if (n.includes("patch")) return { nombre: "demo", activo: true };
    if (n.includes("metadata")) return { source: "unit_test", ok: true };
    return { demo: true, param: paramName };
  }

  if (t === "inet") return "127.0.0.1";
  if (t === "uuid") return "00000000-0000-0000-0000-000000000000";
  if (t === "boolean" || t === "bool") return true;

  if (t === "smallint" || t === "int2") return 1;
  if (t === "integer" || t === "int" || t === "int4") return 1;
  if (t === "bigint" || t === "int8") return 1;

  if (t === "numeric" || t === "decimal") return 10.5;
  if (t === "real" || t === "float4") return 10.5;
  if (t === "double precision" || t === "float8") return 10.5;

  if (t === "date") return "2025-01-01";

  // time: diferenciar inicio/fin si aplica
  if (t === "time") {
    if (n.includes("hora_inicio")) return "09:00:00";
    if (n.includes("hora_fin")) return "10:00:00";
    return "09:00:00";
  }

  // timestamp / timestamptz
  if (t.startsWith("timestamp")) {
    if (n.includes("inicio")) return "2025-01-01 09:00:00";
    if (n.includes("fin")) return "2025-01-01 10:00:00";
    return "2025-01-01 09:00:00";
  }

  // arrays simples (text[], int[], etc.)
  if (t.endsWith("[]")) return [];

  // text/varchar/otros: string
  return "demo";
}

function buildArgsForFunction(fnName) {
  const meta = DB_FUNCTIONS[fnName];
  const args = {};

  for (const p of meta.params) {
    if (!p.hasDefault) {
      args[p.name] = mockValueByType(p.type, p.name);
    }
  }
  return args;
}

function printQueryResult(title, fnName, q) {
  console.log("\n" + "=".repeat(80));
  console.log(title);
  console.log("FN:", fnName);
  console.log("-".repeat(80));
  console.log("TEXT:\n", q.text);
  console.log("VALUES:\n", JSON.stringify(q.values, null, 2));
}

function testAll() {
  const fns = Object.keys(DB_FUNCTIONS).sort();

  console.log("Total funciones registradas:", fns.length);

  for (const fnName of fns) {
    const meta = DB_FUNCTIONS[fnName];

    try {
      // 1) Preview normal
      const args = buildArgsForFunction(fnName);

      // Ajustes extra por “coherencia” si existen ambos campos
      // (solo para que no falle por validaciones típicas)
      if (meta.params.some(p => isTimeParam(p.name))) {
        // ya lo hace mockValueByType con hora_inicio/fin
      }
      if (meta.params.some(p => isTimestampParam(p.name))) {
        // ya lo hace mockValueByType con inicio/fin
      }

      const q1 = buildSelectFunction(fnName, args);
      printQueryResult("[NORMAL]", fnName, q1);

      // 2) Bulk solo si existe un json/jsonb cuyo nombre parezca lista
      const bulkCandidate = meta.params.find(p => isJsonType(p.type) && looksLikeBulkParam(p.name));

      if (bulkCandidate) {
        const bulkParam = bulkCandidate.name;

        const rows = [
          { id: 1, name: "row-1", meta: { ok: true } },
          { id: 2, name: "row-2", meta: { ok: true } },
        ];

        const extraArgs = buildArgsForFunction(fnName);
        delete extraArgs[bulkParam];

        const q2 = buildSelectFunctionBulk(fnName, bulkParam, rows, extraArgs);
        printQueryResult(`[BULK usando ${bulkParam}]`, fnName, q2);
      } else {
        // Si hay json/jsonb pero NO parece bulk, lo dejamos solo en normal (correcto)
        const jsons = meta.params.filter(p => isJsonType(p.type));
        if (jsons.length) {
          console.log("\n" + "-".repeat(80));
          console.log(`[INFO] ${fnName} tiene json/jsonb (${jsons.map(p => p.name).join(", ")}) pero no se trata como bulk (metadata/patch u objeto).`);
        }
      }

    } catch (e) {
      console.log("\n" + "=".repeat(80));
      console.log("[ERROR]");
      console.log("FN:", fnName);
      console.log("MSG:", e?.message || String(e));
    }
  }
}

testAll();
