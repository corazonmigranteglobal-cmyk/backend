"use strict";

const express = require("express");
const { sendEmail, enqueueEmail  } = require("../controllers/email.controller");
const { requireApiKey } = require("../core/http/requireApiKey");

function emailRoutes({ projectRootDir }) {
  const router = express.Router();

  // API
  router.post("/api/email/send", requireApiKey, sendEmail);

  // ENCOLADO (va a outbox y lo procesa worker con reintentos)
  router.post("/api/email/enqueue", requireApiKey, enqueueEmail);


  return router;
}

module.exports = { emailRoutes };
