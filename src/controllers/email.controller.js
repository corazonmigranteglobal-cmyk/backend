"use strict";

const { createEmailServiceFromEnv } = require("../core/email/EmailService");
const { enqueueMessage } = require("../services/messageQueueService");

let _emailService = null;

function getEmailService() {
  if (_emailService) return _emailService;

  _emailService = createEmailServiceFromEnv();

  return _emailService;
}

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

function normalizeTemplateKey(body) {
  return pick(body, ["templateKey", "template_key", "key"]);
}

function extractCtx(body) {
  // Prioridad: ctx > payload > (body sin campos reservados)
  const base = body?.ctx || body?.payload;
  if (base && typeof base === "object") return { ...base };

  const ctx = { ...(body || {}) };
  delete ctx.templateKey;
  delete ctx.template_key;
  delete ctx.key;
  delete ctx.ctx;
  delete ctx.payload;

  // Campos de encolado
  delete ctx.tipo;
  delete ctx.canal;
  delete ctx.prioridad;
  delete ctx.nextRunAt;
  delete ctx.next_run_at;
  delete ctx.maxIntentos;
  delete ctx.max_intentos;
  delete ctx.para;

  // Campos de libre
  delete ctx.message;
  delete ctx.subject;
  delete ctx.text;
  delete ctx.html;

  return ctx;
}

function extractTo(body, ctx) {
  return (
    pick(body, ["to", "email", "para"]) ||
    pick(ctx, ["to", "email"]) ||
    null
  );
}

/**
 * Normaliza “mensaje libre” para que EmailService.sendSimple lo entienda:
 * - Acepta:
 *   (1) body.message: string | {subject,text,html}
 *   (2) body.subject/text/html sueltos
 */
function extractFreeMessage(body) {
  if (body?.message !== undefined) {
    // string o object
    return body.message;
  }

  // subject/text/html sueltos
  const subject = pick(body, ["subject", "asunto"]);
  const text = pick(body, ["text", "texto"]);
  const html = pick(body, ["html"]);

  if (subject || text || html) {
    return { subject, text, html };
  }

  return null;
}

function validateFree(to, msg) {
  if (!to) return { ok: false, error: "MISSING_TO", message: "Falta {to}" };

  if (msg == null) {
    return {
      ok: false,
      error: "MISSING_MESSAGE",
      message: "Falta {message} o {subject/text/html}",
    };
  }

  // Si es string: no permitir vacío
  if (typeof msg === "string") {
    if (msg.trim() === "") {
      return { ok: false, error: "EMPTY_MESSAGE", message: "message vacío" };
    }
    return { ok: true };
  }

  // Si es objeto: debe tener text o html (subject puede ser opcional porque hay default)
  if (typeof msg === "object") {
    const text = String(msg.text || "").trim();
    const html = String(msg.html || "").trim();
    if (!text && !html) {
      return {
        ok: false,
        error: "EMPTY_BODY",
        message: "Para mensaje libre, falta {text} o {html}",
      };
    }
    return { ok: true };
  }

  return { ok: false, error: "INVALID_MESSAGE", message: "Formato de message inválido" };
}

/**
 * POST /api/email/send  (DIRECTO)
 * Soporta:
 *  - Template: {templateKey, ctx} o {templateKey, ...ctx}
 *  - Libre:    {to, message} o {to, subject, text, html}
 */
async function sendEmail(req, res) {
  try {
    const body = req.body || {};
    const templateKey = normalizeTemplateKey(body);

    const emailService = getEmailService();

    // ---- MODO TEMPLATE
    if (templateKey) {
      const ctx = extractCtx(body);
      const to = extractTo(body, ctx);
      if (to && !ctx.to) ctx.to = to; // importante para templates que requieren ctx.to

      const result = await emailService.sendByKey(templateKey, ctx);
      return res.json({ ok: true, mode: "template", templateKey, result });
    }

    // ---- MODO LIBRE
    const ctx = extractCtx(body); // por si mandan “to” dentro
    const to = extractTo(body, ctx);
    const msg = extractFreeMessage(body);

    const v = validateFree(to, msg);
    if (!v.ok) return res.status(400).json({ ok: false, error: v.error, message: v.message });

    const result = await emailService.sendSimple(to, msg);
    return res.json({ ok: true, mode: "free", result });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_ERROR",
      message: String(e?.message || e),
    });
  }
}

/**
 * POST /api/email/enqueue (ENCOLADO / OUTBOX)
 * Soporta:
 *  - Template: {templateKey, ctx} o {templateKey, ...ctx}
 *  - Libre:    {to, message} o {to, subject, text, html}
 *
 * Opcionales: {tipo, prioridad, nextRunAt, maxIntentos}
 */
async function enqueueEmail(req, res) {
  try {
    const body = req.body || {};
    const templateKey = normalizeTemplateKey(body);

    const ctx = extractCtx(body);
    const to = extractTo(body, ctx);

    if (!to) {
      return res.status(400).json({ ok: false, error: "MISSING_TO", message: "Falta {to}" });
    }

    // defaults de encolado
    const tipo =
      pick(body, ["tipo"]) ||
      (templateKey ? `EMAIL_TEMPLATE_${templateKey}` : "EMAIL_FREE");

    const prioridad = Number(pick(body, ["prioridad"])) || 5;
    const nextRunAt = pick(body, ["nextRunAt", "next_run_at"]) || null;
    const maxIntentos = Number(pick(body, ["maxIntentos", "max_intentos"])) || 6;

    let payload;

    // ---- MODO TEMPLATE
    if (templateKey) {
      if (!ctx.to) ctx.to = to; 
      payload = ctx;

      const r = await enqueueMessage({
        tipo,
        canal: "EMAIL",
        prioridad,
        para: to,
        templateKey,
        payload,
        nextRunAt,
        maxIntentos,
      });

      return res.json({ ok: true, mode: "template", templateKey, enqueued: r });
    }

    // ---- MODO LIBRE
    const msg = extractFreeMessage(body);
    const v = validateFree(to, msg);
    if (!v.ok) return res.status(400).json({ ok: false, error: v.error, message: v.message });

    payload = { to, message: msg };

    const r = await enqueueMessage({
      tipo,
      canal: "EMAIL",
      prioridad,
      para: to,
      templateKey: null,
      payload,
      nextRunAt,
      maxIntentos,
    });

    return res.json({ ok: true, mode: "free", enqueued: r });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_ERROR",
      message: String(e?.message || e),
    });
  }
}

module.exports = { sendEmail, enqueueEmail };
