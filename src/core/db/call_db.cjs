"use strict";
async function call_db(payload) {
  const mod = await import("./call_db.mjs");
  return mod.call_db(payload);
}
module.exports = { call_db };