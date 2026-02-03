"use strict";

const os = require("os");
const { logger } = require("../core/logger");
const { createEmailServiceFromEnv } = require("../core/email/EmailService");
const { call_db } = require("../core/db/call_db.cjs");

const WORKER_ID = `${os.hostname()}-${process.pid}`;

function getEmailService() {
  return createEmailServiceFromEnv();
}

function extractRows(r) {
  return (
    (r && Array.isArray(r.data) && r.data) ||
    (r && Array.isArray(r.rows) && r.rows) ||
    (Array.isArray(r) && r) ||
    []
  );
}

async function lockNextBatch(limit = 10) {
  const r = await call_db({
    fnName: "mensajeria.fn_lock_next_outbox_batch",
    args: {
      p_limit: limit,
      p_locked_by: WORKER_ID,
    },
    meta: { feature: "outbox.lockNextBatch" },
  });

  return extractRows(r);
}

async function logSend({ id_mensaje, ok, provider_id = null, respuesta = null, error = null }) {
  return call_db({
    fnName: "mensajeria.fn_log_outbox_send",
    args: {
      p_id_mensaje: id_mensaje,
      p_ok: ok,
      p_provider_id: provider_id,
      p_respuesta: respuesta, 
      p_error: error,
    },
    meta: { feature: "outbox.logSend" },
  });
}

async function setOutboxState({
  id_mensaje,
  action,
  attempts = null,
  last_error = null,
  max_attempts = null,
  locked_by = null,
}) {
  return call_db({
    fnName: "mensajeria.fn_set_outbox_state",
    args: {
      p_id_mensaje: id_mensaje,
      p_action: action,           // 'SENT' | 'FAILED' | 'RETRY' | 'CANCEL' | 'UNLOCK'
      p_attempts: attempts,
      p_last_error: last_error,
      p_max_attempts: max_attempts,
      p_locked_by: locked_by,
    },
    meta: { feature: "outbox.setState", action },
  });
}

async function processJob(job, emailService) {
  if (job.canal !== "EMAIL") {
    throw new Error(`Canal no soportado: ${job.canal}`);
  }

  let result;

  // 1) Con template
  if (job.template_key) {
    result = await emailService.sendByKey(job.template_key, job.payload);
    return result;
  }

  // 2) Sin template: payload.message (forma recomendada)
  if (job.payload?.to && job.payload?.message) {
    result = await emailService.sendSimple(job.payload.to, job.payload.message);
    return result;
  }

  // 3) Sin template: payload con {subject/text/html} directo (tolerante)
  const hasDirectMessageFields =
    job.payload && (job.payload.subject || job.payload.text || job.payload.html);

  if (hasDirectMessageFields) {
    const to = job.payload.to || job.para;
    result = await emailService.sendSimple(to, job.payload);
    return result;
  }

  // 4) Sin template: fallback clásico {para + payload.message}
  const msg = job.payload?.message;
  if (!msg) throw new Error("payload.message requerido si no hay template_key");
  result = await emailService.sendSimple(job.para, msg);

  return result;
}

async function runOnce({ batchSize = 10 } = {}) {
  const emailService = getEmailService();
  const jobs = await lockNextBatch(batchSize);

  if (!jobs.length) return { processed: 0 };

  for (const job of jobs) {
    const attempts = Number(job.intentos || 0) + 1;
    const maxAttempts = Number(job.max_intentos || 6);

    try {
      const result = await processJob(job, emailService);

      await logSend({
        id_mensaje: job.id_mensaje,
        ok: true,
        provider_id: result?.id || null,
        respuesta: result || null,
        error: null,
      });

      await setOutboxState({
        id_mensaje: job.id_mensaje,
        action: "SENT",
      });

      logger.info("Outbox job sent", { id: job.id_mensaje, tipo: job.tipo, para: job.para });
    } catch (e) {
      const msg = String(e?.message || e);

      await logSend({
        id_mensaje: job.id_mensaje,
        ok: false,
        provider_id: null,
        respuesta: null,
        error: msg,
      });

      await setOutboxState({
        id_mensaje: job.id_mensaje,
        action: "FAILED", 
        attempts,
        last_error: msg,
        max_attempts: maxAttempts,
        locked_by: WORKER_ID, 
      });

      logger.error("Outbox job failed", { id: job.id_mensaje, attempts, error: msg });
    }
  }

  return { processed: jobs.length };
}

function startWorker({ intervalMs = 2000, batchSize = 10 } = {}) {
  logger.info("Outbox worker started", { WORKER_ID, intervalMs, batchSize });
  setInterval(() => {
    runOnce({ batchSize }).catch((e) =>
      logger.error("Worker loop error", { error: String(e?.message || e) })
    );
  }, intervalMs);
}

module.exports = { startWorker, runOnce, WORKER_ID };
