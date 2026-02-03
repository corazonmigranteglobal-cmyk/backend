"use strict";

const { call_db } = require("../core/db/call_db.cjs");

function assertNonEmpty(name, v) {
  if (!v || String(v).trim() === "") throw new Error(`Missing: ${name}`);
  return v;
}

async function enqueueMessage({
  tipo,
  canal = "EMAIL",
  prioridad = 5,
  para,
  templateKey = null,
  payload = {},
  nextRunAt = null,
  maxIntentos = 6,
} = {}) {
  assertNonEmpty("tipo", tipo);
  assertNonEmpty("canal", canal);
  assertNonEmpty("para", para);

  const r = await call_db({
    fnName: "mensajeria.fn_enqueue_outbox_message",
    args: {
      p_tipo: tipo,
      p_para: para,

      p_payload: payload || {},
      p_template_key: templateKey,
      p_canal: canal,
      p_prioridad: prioridad,
      p_next_run_at: nextRunAt,     
      p_max_intentos: maxIntentos,
    },
    meta: { feature: "outbox.enqueue", tipo, canal },
  });

  const row =
    (r && Array.isArray(r.data) && r.data[0]) ||
    (r && Array.isArray(r.rows) && r.rows[0]) ||
    (Array.isArray(r) && r[0]) ||
    null;

  if (!row) {
    return { ok: false, error: "No row returned from fn_enqueue_outbox_message", raw: r };
  }

  if (row.ok === false) {
    return { ok: false, error: row.message, raw: row };
  }

  const idMensaje = row.id_mensaje ?? row.o_id_mensaje;

  if (!idMensaje) {
    return {
      ok: false,
      error: "Missing message id from fn_enqueue_outbox_message",
      raw: row,
    };
  }

  return {
    ok: true,
    job: {
      id_mensaje: idMensaje,
      estado: row.estado,
      next_run_at: row.next_run_at,
      created_at: row.created_at,
    },
  };

}

module.exports = { enqueueMessage };