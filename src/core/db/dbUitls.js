"use strict";

const { pool } = require("./pool.cjs");

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;

  // Puedes cambiar esto a logger luego; por ahora P0: consistente y simple
  console.log("DB query", { duration, rows: res.rowCount });

  return res;
}

module.exports = {
  query,
  pool,
};
