const nodemailer = require("nodemailer");
const sgMail = require("@sendgrid/mail");
const messages = require("./messagges");

function asArray(x) { return x ? (Array.isArray(x) ? x : [x]) : []; }
function normalizeEmails(list) {
  return asArray(list).flat().map(s => String(s || "").trim()).filter(Boolean);
}
function assertNonEmpty(v, name) {
  if (!v || String(v).trim() === "") throw new Error(`EmailService: falta ${name}`);
}

const DEFAULT_SUBJECT = "Notificación — Corazón Migrante";

const REQUIRED_CTX = {
  VERIFICACION_CUENTA: ["to"],
  CITA_PENDIENTE: ["to"],
  CITA_CONFIRMADA: ["to"],
  CITA_CANCELADA: ["to"],    
  PAGO_CONFIRMADO: ["to"],
  PAGO_RECHAZADO: ["to"],   
  PASSWORD_RECOVERY_PIN: ["to", "pin"], 
};

function validateCtx(key, ctx) {
  const req = REQUIRED_CTX[key] || [];
  for (const field of req) {
    if (!ctx || ctx[field] == null || String(ctx[field]).trim() === "") {
      throw new Error(`EmailService.sendByKey: falta ctx.${field} para ${key}`);
    }
  }
}

function createGmailOAuthEmailService(config) {
  const {
    gmailUser,
    clientId,
    clientSecret,
    refreshToken,
    fromEmail,
    fromName = "Empresa",
    replyTo,
  } = config;

  assertNonEmpty(gmailUser, "gmailUser");
  assertNonEmpty(clientId, "clientId");
  assertNonEmpty(clientSecret, "clientSecret");
  assertNonEmpty(refreshToken, "refreshToken");
  assertNonEmpty(fromEmail, "fromEmail");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { type: "OAuth2", user: gmailUser, clientId, clientSecret, refreshToken },
  });

  async function ping() {
    await transporter.verify();
    return true;
  }

  async function sendSimple(to, message, opts = {}) {
    const toList = normalizeEmails(to);
    if (!toList.length) throw new Error("EmailService.sendSimple: sin destinatarios");

    const isObj = typeof message === "object" && message !== null;

    const subject =
      (isObj ? message.subject : opts.subject) ||
      opts.subject ||
      DEFAULT_SUBJECT;

    const text = isObj ? (message.text || "") : String(message || "");
    const html = isObj ? (message.html || undefined) : undefined;

    assertNonEmpty(subject, "subject");

    const info = await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: toList,
      subject,
      text: text || undefined,
      html,
      replyTo: replyTo || undefined,
    });

    // Normalizamos `id` para que el worker pueda guardarlo como provider_id.
    return {
      ok: true,
      to: toList,
      id: info?.messageId || null,
      messageId: info?.messageId || null,
      accepted: info?.accepted,
      rejected: info?.rejected,
    };
  }

  async function sendByKey(key, ctx) {
    const def = messages[key];
    if (!def) throw new Error(`EmailService.sendByKey: key inválida: ${key}`);

    validateCtx(key, ctx);

    const to = typeof def.to === "function" ? def.to(ctx) : def.to;
    const subject = typeof def.subject === "function" ? def.subject(ctx) : def.subject;
    const text = typeof def.text === "function" ? def.text(ctx) : def.text;
    const html = typeof def.html === "function" ? def.html(ctx) : def.html;

    return sendSimple(to, { subject, text, html });
  }

  return { ping, sendSimple, sendByKey };
}

function createSendGridEmailService(config) {
  const {
    apiKey,
    fromEmail,
    fromName = "Corazón Migrante",
    replyTo,
  } = config;

  assertNonEmpty(apiKey, "SENDGRID_API_KEY");
  assertNonEmpty(fromEmail, "fromEmail");

  sgMail.setApiKey(apiKey);

  async function ping() {
    // SendGrid no tiene "verify" tipo SMTP.
    // Este ping valida configuración mínima.
    return true;
  }

  async function sendSimple(to, message, opts = {}) {
    const toList = normalizeEmails(to);
    if (!toList.length) throw new Error("EmailService.sendSimple: sin destinatarios");

    const isObj = typeof message === "object" && message !== null;

    const subject =
      (isObj ? message.subject : opts.subject) ||
      opts.subject ||
      DEFAULT_SUBJECT;

    const text = isObj ? (message.text || "") : String(message || "");
    const html = isObj ? (message.html || undefined) : undefined;

    assertNonEmpty(subject, "subject");
    const msg = {
      to: toList,
      from: { email: fromEmail, name: fromName },
      subject,
      text: text || undefined,
      html,
      replyTo: replyTo ? { email: replyTo } : undefined,
    };

    console.log(msg); 

    // `sgMail.send` retorna un array [response]
    try {
      console.log(msg);
      const [resp] = await sgMail.send(msg);
      return { ok: true, statusCode: resp.statusCode, headers: resp.headers };
    } catch (e) {
      const status = e?.code || e?.response?.statusCode || 500;
      const body = e?.response?.body;
      console.error("[SENDGRID ERROR]", {
        status,
        message: e.message,
        body: body ? JSON.stringify(body) : null,
      });

      // Para que te salga en Postman:
      throw Object.assign(new Error(body?.errors?.[0]?.message || e.message), {
        statusCode: status,
        sendgrid: body,
      });
    }

  }

  async function sendByKey(key, ctx) {
    const def = messages[key];
    if (!def) throw new Error(`EmailService.sendByKey: key inválida: ${key}`);

    validateCtx(key, ctx);

    const to = typeof def.to === "function" ? def.to(ctx) : def.to;
    const subject = typeof def.subject === "function" ? def.subject(ctx) : def.subject;
    const text = typeof def.text === "function" ? def.text(ctx) : def.text;
    const html = typeof def.html === "function" ? def.html(ctx) : def.html;

    return sendSimple(to, { subject, text, html });
  }

  return { ping, sendSimple, sendByKey };
}

/**
 * Factory: elige proveedor según env.
 * - MAIL_PROVIDER=sendgrid|gmail
 * - Si SENDGRID_API_KEY existe y MAIL_PROVIDER no fuerza gmail, usa SendGrid.
 */
function createEmailServiceFromEnv() {
  const provider = String(process.env.MAIL_PROVIDER || "").trim().toLowerCase();
  const hasSendgrid = !!String(process.env.SENDGRID_API_KEY || "").trim();

  const fromEmail = (process.env.MAIL_FROM || "").trim();
  const fromName = (process.env.MAIL_FROM_NAME || "Corazón Migrante").trim();
  const replyTo = (process.env.MAIL_REPLY_TO || "").trim();

  if (provider === "sendgrid") {
    return createSendGridEmailService({
      apiKey: (process.env.SENDGRID_API_KEY || "").trim(),
      fromEmail,
      fromName,
      replyTo,
    });
  }

  if (hasSendgrid && provider !== "gmail") {
    return createSendGridEmailService({
      apiKey: (process.env.SENDGRID_API_KEY || "").trim(),
      fromEmail,
      fromName,
      replyTo,
    });
  }

  if (provider === "gmail") {
    return createGmailOAuthEmailService({
      gmailUser: (process.env.GMAIL_USER || "").trim(),
      clientId: (process.env.GOOGLE_CLIENT_ID || "").trim(),
      clientSecret: (process.env.GOOGLE_CLIENT_SECRET || "").trim(),
      refreshToken: (process.env.GOOGLE_REFRESH_TOKEN || "").trim(),
      fromEmail,
      fromName,
      replyTo,
    });
  }

  throw new Error("MAIL_PROVIDER no válido. Usa 'sendgrid' o 'gmail'.");
}

module.exports = {
  createGmailOAuthEmailService,
  createSendGridEmailService,
  createEmailServiceFromEnv,
};
