"use strict";

const { verifyJwt } = require("../auth/jwt");

function requireApiKey(req, res, next) {
  // 1) Primero intenta JWT Bearer
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      return res.status(500).json({ ok: false, error: "JWT_SECRET_NOT_SET" });
    }

    try {
      const claims = verifyJwt(token, secret);
      req.auth = claims; // por si luego quieres usarlo
      return next();
    } catch (e) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
  }

  // 2) Fallback: x-api-key (opcional, para server-to-server)
  const expected = process.env.API_KEY || process.env.EMAIL_SEND_API_KEY;

  const allowWithoutKey =
    String(process.env.ALLOW_OPEN_EMAIL_API || "false").toLowerCase() === "true";

  if (!expected) {
    if (allowWithoutKey) return next();
    return res.status(500).json({ ok: false, error: "API_KEY_NOT_SET" });
  }

  const got = req.header("x-api-key");
  if (got !== expected) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  return next();
}

module.exports = { requireApiKey };
