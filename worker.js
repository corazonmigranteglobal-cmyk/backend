if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const { logger } = require("./src/core/logger");
const { startWorker } = require("./src/services/messageOutboxWorker");

const INTERVAL_MS = Number(process.env.OUTBOX_INTERVAL_MS || 2000);
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE || 10);

logger.info("Starting Outbox Worker", {
  intervalMs: INTERVAL_MS,
  batchSize: BATCH_SIZE,
  MAIL_PROVIDER: process.env.MAIL_PROVIDER,
  HAS_SENDGRID: !!String(process.env.SENDGRID_API_KEY || "").trim(),
});

startWorker({ intervalMs: INTERVAL_MS, batchSize: BATCH_SIZE });
