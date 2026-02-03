"use strict";

const { createClient } = require("redis");
const { logger } = require("../logger");

let client = null;
let ready = false;

async function initRedis() {
  const url = process.env.REDIS_URL;
  if (!url) {
    logger.info("Redis disabled (REDIS_URL not set)");
    return null;
  }

  if (client) return client;

  client = createClient({ url });

  client.on("ready", () => {
    ready = true;
    logger.info("Redis ready");
  });

  client.on("end", () => {
    ready = false;
    logger.warn("Redis connection closed");
  });

  client.on("error", (err) => {
    ready = false;
    logger.error("Redis error", { message: err?.message || String(err) });
  });

  await client.connect();
  return client;
}

function redisReady() {
  return !!client && ready;
}

async function redisGetJson(key) {
  if (!redisReady()) return null;
  const v = await client.get(key);
  return v ? JSON.parse(v) : null;
}

async function redisSetJson(key, value, ttlSeconds) {
  if (!redisReady()) return false;
  const payload = JSON.stringify(value);
  if (ttlSeconds && Number.isFinite(ttlSeconds)) {
    await client.set(key, payload, { EX: ttlSeconds });
  } else {
    await client.set(key, payload);
  }
  return true;
}

module.exports = { initRedis, redisReady, redisGetJson, redisSetJson };
