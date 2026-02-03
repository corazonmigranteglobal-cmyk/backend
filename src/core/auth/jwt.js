"use strict";

const crypto = require("crypto");

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlJson(obj) {
  return base64url(JSON.stringify(obj));
}

function hmacSha256(data, secret) {
  return crypto.createHmac("sha256", secret).update(data).digest();
}

function signJwt(payload, secret, { expiresInSec = 60 * 60 * 8 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };

  const fullPayload = {
    iat: now,
    exp: now + Number(expiresInSec),
    ...payload,
  };

  const p1 = base64urlJson(header);
  const p2 = base64urlJson(fullPayload);
  const toSign = `${p1}.${p2}`;
  const sig = base64url(hmacSha256(toSign, secret));

  return `${toSign}.${sig}`;
}

function verifyJwt(token, secret) {
  if (!token || typeof token !== "string") throw new Error("TOKEN_MISSING");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("TOKEN_BAD_FORMAT");

  const [p1, p2, sig] = parts;
  const toSign = `${p1}.${p2}`;
  const expected = base64url(hmacSha256(toSign, secret));

  // comparación segura
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("TOKEN_BAD_SIGNATURE");
  }

  const payloadJson = Buffer.from(p2.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  const payload = JSON.parse(payloadJson);

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) throw new Error("TOKEN_EXPIRED");

  return payload;
}

module.exports = { signJwt, verifyJwt };
