import poolPkg from "./pool.cjs";
const { pool } = poolPkg;

import { DB_FUNCTIONS } from "../../config/db_functions.js";
import { buildSelectFunction, buildSelectFunctionBulk } from "./buildFunctionSelect.js"; 

function safeContext(meta = {}) {
  const clone = { ...meta };
  if (clone?.args?.p_password) clone.args.p_password = "***";
  return clone;
}

/**
 * call_db - ejecuta funciones declaradas en DB_FUNCTIONS
 * @param {object} input
 * @param {string} input.fnName
 * @param {object} [input.args]
 * @param {object} [input.bulk]   { paramName: string, rows: array }
 * @param {object} [input.meta]   para tracking/logs
 */
export async function call_db({ fnName, args = {}, bulk = null, meta = {} }) {
  const start = Date.now();

  try {
    if (!DB_FUNCTIONS[fnName]) {
      throw new Error(`DB function no registrada en DB_FUNCTIONS: ${fnName}`);
    }

    const q = bulk
      ? buildSelectFunctionBulk(fnName, bulk.paramName, bulk.rows, args)
      : buildSelectFunction(fnName, args);

    const res = await pool.query(q.text, q.values);

    return {
      ok: true,
      fnName,
      ms: Date.now() - start,
      rowCount: res.rowCount,
      rows: res.rows,
    };
  } catch (err) {
    // Log rastreable
    console.error("[call_db:error]", {
      fnName,
      ms: Date.now() - start,
      meta: safeContext({ ...meta, args }),
      message: err?.message,
    });

    throw err;
  }
}
