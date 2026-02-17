"use strict";

const { createGcsStorageService } = require("./gcsStorageService");

const _cache = new Map();

function envBool(v, def = false) {
  if (v === undefined || v === null || String(v).trim() === "") return def;
  const s = String(v).toLowerCase();
  return s === "true" || s === "1";
}

function normalizeKey(k) {
  return String(k || "").trim().toLowerCase();
}

/**
 * Perfiles permitidos:
 * - user_media: bucket actual (uploads de usuarios)
 * - public_assets: bucket público (assets para vistas públicas)
 */
function getProfilesFromEnv() {
  // Compatibilidad: si no defines *_USER_MEDIA usa GCS_BUCKET_NAME
  const userMediaBucket =
    process.env.GCS_BUCKET_NAME_USER_MEDIA || process.env.GCS_BUCKET_NAME;

  const publicAssetsBucket = process.env.GCS_BUCKET_NAME_PUBLIC_ASSETS;

  return {
    user_media: {
      bucketName: userMediaBucket,
      uploadPrefix:
        process.env.GCS_UPLOAD_PREFIX_USER_MEDIA ?? process.env.GCS_UPLOAD_PREFIX ?? "",
      publicMode: envBool(
        process.env.GCS_PUBLIC_MODE_USER_MEDIA ?? process.env.GCS_PUBLIC_MODE,
        false
      ),
    },
    public_assets: {
      bucketName: publicAssetsBucket,
      uploadPrefix: process.env.GCS_UPLOAD_PREFIX_PUBLIC_ASSETS ?? "",
      // En assets públicos normalmente quieres URL estable (no signed) => publicMode true
      publicMode: envBool(process.env.GCS_PUBLIC_MODE_PUBLIC_ASSETS, true),
    },
  };
}

function getDefaultKey() {
  return normalizeKey(process.env.GCS_STORAGE_DEFAULT || "user_media") || "user_media";
}

function getGcsForKey(key) {
  const k = normalizeKey(key) || getDefaultKey();
  const profiles = getProfilesFromEnv();
  const p = profiles[k];

  if (!p) {
    const allowed = Object.keys(profiles).join(", ");
    throw new Error(`Invalid storage key: ${k}. Allowed: ${allowed}`);
  }

  if (!p.bucketName) {
    // No adivinamos: si no definiste el bucket público, fallamos explícitamente.
    throw new Error(`Missing env: GCS_BUCKET_NAME_${k.toUpperCase()}`);
  }

  if (_cache.has(k)) return _cache.get(k);

  const svc = createGcsStorageService({
    projectId: process.env.GCP_PROJECT_ID,
    bucketName: p.bucketName,
    uploadPrefix: p.uploadPrefix,
    signedUrlTtlSeconds: Number(process.env.GCS_SIGNED_URL_TTL_SECONDS || 21600),
    publicMode: p.publicMode,
  });

  _cache.set(k, svc);
  return svc;
}

/**
 * Resuelve el storage key desde req (body/query) con whitelist.
 * - body.storage | body.storageKey | query.storage | query.storageKey
 */
function resolveStorageKeyFromReq(req, { fallbackToDefault = true } = {}) {
  const raw =
    req?.body?.storage ??
    req?.body?.storageKey ??
    req?.query?.storage ??
    req?.query?.storageKey;

  const k = normalizeKey(raw);
  if (k) return k;
  return fallbackToDefault ? getDefaultKey() : "";
}

module.exports = {
  getGcsForKey,
  resolveStorageKeyFromReq,
  getDefaultKey,
};
