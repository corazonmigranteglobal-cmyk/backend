    // services/gcsStorageService.js
"use strict";

const crypto = require("crypto");
const { Storage } = require("@google-cloud/storage");

// --------------------
// Helpers
// --------------------
function assertNonEmpty(name, v) {
  if (!v || String(v).trim() === "") throw new Error(`Missing env: ${name}`);
  return v;
}

function toPublicHttpUrl(bucketName, objectName) {
  return `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(objectName).replace(/%2F/g, "/")}`.replace(
    /%2F/g,
    "/"
  );
}



function safeJoinPosix(...parts) {
  return parts
    .filter(Boolean)
    .join("/")
    .replace(/\\/g, "/")
    .replace(/\/\/+/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function stripLeadingSlash(p) {
  return String(p || "").replace(/^\/+/, "");
}

function toObjectName(uploadPrefix, targetPath) {
  const clean = stripLeadingSlash(targetPath);

  if (!uploadPrefix || String(uploadPrefix).trim() === "") return clean;

  const pref = stripLeadingSlash(uploadPrefix).replace(/\/+$/, "");

  if (clean === pref || clean.startsWith(pref + "/")) return clean;

  return safeJoinPosix(pref, clean);
}

// --------------------
// Service Factory
// --------------------
function createGcsStorageService({
  projectId,
  bucketName,
  uploadPrefix = "", 
  signedUrlTtlSeconds = 900,
  publicMode = false,
} = {}) {
  projectId = projectId ?? process.env.GCP_PROJECT_ID;
  bucketName = bucketName ?? process.env.GCS_BUCKET_NAME;

  uploadPrefix = uploadPrefix ?? process.env.GCS_UPLOAD_PREFIX ?? "";
  signedUrlTtlSeconds = Number(
    signedUrlTtlSeconds ?? process.env.GCS_SIGNED_URL_TTL_SECONDS ?? 900
  );
  publicMode =
    String(publicMode ?? process.env.GCS_PUBLIC_MODE ?? "false").toLowerCase() === "true";

  assertNonEmpty("GCP_PROJECT_ID", projectId);
  assertNonEmpty("GCS_BUCKET_NAME", bucketName);
  const storage = new Storage({ projectId });
  const bucket = storage.bucket(bucketName);

  // --------------------
  // Path builders (convención)
  // --------------------
  function userBasePath(userId) {
    assertNonEmpty("userId", userId);
    return `users/${String(userId).trim()}`;
  }

  function userProfilePrefix(userId) {
    return safeJoinPosix(userBasePath(userId), "profile");
  }

  function userMediaPrefix(userId) {
    return safeJoinPosix(userBasePath(userId), "media");
  }

  function getAvatarPath(userId, ext = "jpg") {
    return safeJoinPosix(userProfilePrefix(userId), `avatar.${String(ext).replace(".", "")}`);
  }

  function getCoverPath(userId, ext = "jpg") {
    return safeJoinPosix(userProfilePrefix(userId), `cover.${String(ext).replace(".", "")}`);
  }

  // --------------------
  // "Crear carpetas" (placeholders .keep)
  // --------------------
  async function ensureUserFolders({ userId }) {
    assertNonEmpty("userId", userId);

    const profileFolder = toObjectName(uploadPrefix, userProfilePrefix(userId));
    const mediaFolder = toObjectName(uploadPrefix, userMediaPrefix(userId));

    const profileKeep = safeJoinPosix(profileFolder, ".keep");
    const mediaKeep = safeJoinPosix(mediaFolder, ".keep");

    const [pExists] = await bucket.file(profileKeep).exists();
    if (!pExists) {
      await bucket.file(profileKeep).save(Buffer.from(""), {
        resumable: false,
        metadata: { contentType: "text/plain", cacheControl: "no-store" },
      });
    }

    const [mExists] = await bucket.file(mediaKeep).exists();
    if (!mExists) {
      await bucket.file(mediaKeep).save(Buffer.from(""), {
        resumable: false,
        metadata: { contentType: "text/plain", cacheControl: "no-store" },
      });
    }

    return {
      ok: true,
      profile: { objectName: profileKeep },
      media: { objectName: mediaKeep },
    };
  }

  // --------------------
  // Uploads
  // --------------------
  function buildObjectName({ folder, filename }) {
    const cleanName = filename || crypto.randomUUID();
    const cleanFolder = folder ? folder.replace(/^\//, "").replace(/\/$/, "") : "";
    return safeJoinPosix(uploadPrefix, cleanFolder, cleanName);
  }

  async function uploadBuffer({
    buffer,
    filename,
    folder,
    contentType,
    cacheControl,
    metadata,
    publicRead = false,
  }) {
    if (!Buffer.isBuffer(buffer)) throw new Error("uploadBuffer: buffer must be a Buffer");

    const objectName = buildObjectName({ folder, filename });
    const file = bucket.file(objectName);

    await file.save(buffer, {
      resumable: false,
      metadata: {
        contentType: contentType || "application/octet-stream",
        cacheControl: cacheControl || "private, max-age=0, no-cache",
        metadata: metadata || undefined,
      },
    });


    const effectivePublicRead = Boolean(publicMode || publicRead);
      if (effectivePublicRead) {
        try { await file.makePublic(); } catch (_) {}
    }

    const gcsUri = `gs://${bucketName}/${objectName}`;
    const url = effectivePublicRead
      ? toPublicHttpUrl(bucketName, objectName)
      : await getSignedReadUrl({ objectName });

    return { bucket: bucketName, objectName, gcsUri, url, public: effectivePublicRead };
  }


  function getPublicUrl({ objectName }) {
  assertNonEmpty("objectName", objectName);
  return toPublicHttpUrl(bucketName, objectName);
}

function getPublicUrlByPath({ targetPath }) {
  assertNonEmpty("targetPath", targetPath);
  const objectName = toObjectName(uploadPrefix, targetPath);
  return { objectName, url: toPublicHttpUrl(bucketName, objectName) };
}


  async function uploadBufferAtPath({
    targetPath,
    buffer,
    contentType,
    cacheControl,
    metadata,
    ensureFolders = false,
    publicRead = false, 
  }){
    assertNonEmpty("targetPath", targetPath);
    if (!Buffer.isBuffer(buffer)) throw new Error("uploadBufferAtPath: buffer must be a Buffer");

    // Si quieres auto-crear jerarquía cuando sea un path de user
    if (ensureFolders) {
      let logicalPath = stripLeadingSlash(targetPath);
      const pref = stripLeadingSlash(uploadPrefix);

      if (pref && (logicalPath === pref || logicalPath.startsWith(pref + "/"))) {
        logicalPath = logicalPath.slice(pref.length).replace(/^\/+/, "");
      }

      const m = String(logicalPath).match(/^users\/([^/]+)\//);

      if (m && m[1]) {
        await ensureUserFolders({ userId: m[1] });
      }
    }

    const objectName = toObjectName(uploadPrefix, targetPath);
    const file = bucket.file(objectName);

    await file.save(buffer, {
      resumable: false,
      metadata: {
        contentType: contentType || "application/octet-stream",
        cacheControl: cacheControl || "private, max-age=0, no-cache",
        metadata: metadata || undefined,
      },
    });

    const effectivePublicRead = Boolean(publicMode || publicRead);

    if (effectivePublicRead) {
      try { await file.makePublic(); } catch (_) {}
    }

    const gcsUri = `gs://${bucketName}/${objectName}`;
    const url = effectivePublicRead
      ? toPublicHttpUrl(bucketName, objectName)
      : await getSignedReadUrl({ objectName });

    return { bucket: bucketName, objectName, gcsUri, url, public: effectivePublicRead };
  }

  // --------------------
  // Downloads / Read
  // --------------------
  async function getBufferByPath({ targetPath }) {
    assertNonEmpty("targetPath", targetPath);
    const objectName = toObjectName(uploadPrefix, targetPath);
    const [buf] = await bucket.file(objectName).download();
    return { objectName, buffer: buf };
  }

  function createReadStreamByPath({ targetPath }) {
    assertNonEmpty("targetPath", targetPath);
    const objectName = toObjectName(uploadPrefix, targetPath);
    return bucket.file(objectName).createReadStream();
  }

  async function downloadToLocalPath({ targetPath, localPath }) {
    assertNonEmpty("targetPath", targetPath);
    assertNonEmpty("localPath", localPath);

    const objectName = toObjectName(uploadPrefix, targetPath);
    await bucket.file(objectName).download({ destination: localPath });
    return { ok: true, objectName, localPath };
  }

  async function getMetadataByPath({ targetPath }) {
    assertNonEmpty("targetPath", targetPath);
    const objectName = toObjectName(uploadPrefix, targetPath);
    const [meta] = await bucket.file(objectName).getMetadata();
    return { objectName, metadata: meta };
  }

  // --------------------
  // Exists / Delete
  // --------------------
  async function exists({ objectName }) {
    assertNonEmpty("objectName", objectName);
    const [found] = await bucket.file(objectName).exists();
    return found;
  }

  async function existsByPath({ targetPath }) {
    assertNonEmpty("targetPath", targetPath);
    const objectName = toObjectName(uploadPrefix, targetPath);
    const [found] = await bucket.file(objectName).exists();
    return { found, objectName };
  }

  async function deleteObject({ objectName }) {
    assertNonEmpty("objectName", objectName);
    await bucket.file(objectName).delete({ ignoreNotFound: true });
    return { ok: true };
  }

  async function deleteByPath({ targetPath }) {
    assertNonEmpty("targetPath", targetPath);
    const objectName = toObjectName(uploadPrefix, targetPath);
    await bucket.file(objectName).delete({ ignoreNotFound: true });
    return { ok: true, objectName };
  }

  // --------------------
  // Signed URLs
  // --------------------
  async function getSignedReadUrl({ objectName, ttlSeconds } = {}) {
    assertNonEmpty("objectName", objectName);
    const expiresMs = Date.now() + 1000 * Number(ttlSeconds ?? signedUrlTtlSeconds);
    const [url] = await bucket.file(objectName).getSignedUrl({
      version: "v4",
      action: "read",
      expires: expiresMs,
    });
    return url;
  }

  async function getSignedWriteUrl({
    objectName,
    contentType = "application/octet-stream",
    ttlSeconds,
  } = {}) {
    assertNonEmpty("objectName", objectName);
    const expiresMs = Date.now() + 1000 * Number(ttlSeconds ?? signedUrlTtlSeconds);
    const [url] = await bucket.file(objectName).getSignedUrl({
      version: "v4",
      action: "write",
      expires: expiresMs,
      contentType,
    });
    return url;
  }

  async function getSignedReadUrlByPath({ targetPath, ttlSeconds } = {}) {
    assertNonEmpty("targetPath", targetPath);
    const objectName = toObjectName(uploadPrefix, targetPath);
    const url = await getSignedReadUrl({ objectName, ttlSeconds });
    return { objectName, url };
  }

  async function getSignedWriteUrlByPath({ targetPath, contentType, ttlSeconds } = {}) {
    assertNonEmpty("targetPath", targetPath);
    const objectName = toObjectName(uploadPrefix, targetPath);
    const url = await getSignedWriteUrl({ objectName, contentType, ttlSeconds });
    return { objectName, url };
  }

  // --------------------
  // List / Copy / Move
  // --------------------
  async function list({ prefix } = {}) {
    const [files] = await bucket.getFiles({
      prefix: prefix ? safeJoinPosix(uploadPrefix, prefix) : uploadPrefix,
    });
    return files.map((f) => ({
      objectName: f.name,
      updated: f.metadata?.updated,
      size: f.metadata?.size ? Number(f.metadata.size) : null,
      contentType: f.metadata?.contentType || null,
    }));
  }

  async function listPaths({ prefix } = {}) {
    // IMPORTANTE:
    // - Si NO mandas prefix, el admin espera ver la estructura ROOT del bucket (ej: "admin_portal/").
    // - Si mandas prefix, entonces sí trabajamos "dentro" del uploadPrefix y devolvemos paths relativos.
    const hasPrefix =
      prefix !== undefined && prefix !== null && String(prefix).trim() !== "";

    // Root del bucket cuando no hay prefix
    const effectivePrefix = hasPrefix ? toObjectName(uploadPrefix, prefix) : "";
    const [files] = await bucket.getFiles({ prefix: effectivePrefix });

    return files.map((f) => {
      const name = f.name;

      // Para root: devolvemos el path TAL CUAL (incluye admin_portal/)
      // Para dentro de prefix: devolvemos path relativo al uploadPrefix (comportamiento anterior)
      const path = hasPrefix
        ? uploadPrefix && name.startsWith(stripLeadingSlash(uploadPrefix) + "/")
          ? name.slice(stripLeadingSlash(uploadPrefix).length + 1)
          : name
        : name;

      return {
        objectName: name,
        path,
        updated: f.metadata?.updated,
        size: f.metadata?.size ? Number(f.metadata.size) : null,
        contentType: f.metadata?.contentType || null,
      };
    });
  }

  async function copyByPath({ fromPath, toPath }) {
    assertNonEmpty("fromPath", fromPath);
    assertNonEmpty("toPath", toPath);

    const fromObject = toObjectName(uploadPrefix, fromPath);
    const toObject = toObjectName(uploadPrefix, toPath);

    await bucket.file(fromObject).copy(bucket.file(toObject));
    return { ok: true, fromObject, toObject };
  }

  async function moveByPath({ fromPath, toPath }) {
    const r = await copyByPath({ fromPath, toPath });
    await bucket.file(r.fromObject).delete({ ignoreNotFound: true });
    return { ok: true, fromObject: r.fromObject, toObject: r.toObject };
  }

  // --------------------
  // Read stream by objectName (original)
  // --------------------
  function createReadStream({ objectName }) {
    assertNonEmpty("objectName", objectName);
    return bucket.file(objectName).createReadStream();
  }

  // --------------------
  // Public API
  // --------------------
  return {
    bucketName,
    uploadPrefix,

    // naming helpers
    userBasePath,
    userProfilePrefix,
    userMediaPrefix,
    getAvatarPath,
    getCoverPath,

    // folder bootstrap
    ensureUserFolders,

    // upload
    uploadBuffer,
    uploadBufferAtPath,

    // read
    getBufferByPath,
    createReadStreamByPath,
    downloadToLocalPath,
    getMetadataByPath,

    // signed urls
    getSignedReadUrl,
    getSignedWriteUrl,
    getSignedReadUrlByPath,
    getSignedWriteUrlByPath,

    // exists/delete
    exists,
    existsByPath,
    deleteObject,
    deleteByPath,

    // list / copy / move
    list,
    listPaths,
    copyByPath,
    moveByPath,

    // legacy helper
    buildObjectName,
    createReadStream,

    // public URLs (no expiración)
    getPublicUrl,
    getPublicUrlByPath,

  };
}

module.exports = { createGcsStorageService };
