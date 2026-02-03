"use strict";

function errorHandler(err, req, res, next) {
  const status = err?.statusCode || err?.status || 500;

  console.error("[http:error]", {
    status,
    method: req.method,
    path: req.originalUrl || req.path,
    message: err?.message,
    stack: err?.stack,
    body: req.body,
  });

  return res.status(status).json({
    ok: false,
    error: err?.code || "INTERNAL_ERROR",
    message: err?.message || "Error interno",
    // En dev es útil, en prod lo apagas
    stack: process.env.NODE_ENV === "production" ? undefined : err?.stack,
  });
}

module.exports = { errorHandler };
