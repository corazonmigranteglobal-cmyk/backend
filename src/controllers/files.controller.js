"use strict";

const { getGcsForKey, resolveStorageKeyFromReq } = require("../services/gcsRegistry");
const { call_db } = require("../core/db/call_db.cjs");

// Nota: NO permitimos bucket arbitrario desde el cliente.
// Solo keys whitelisted definidas en gcsRegistry (user_media / public_assets).
function getGcsFromReq(req) {
  const key = resolveStorageKeyFromReq(req);
  return getGcsForKey(key);
}

// src/controllers/files.controller.js
async function ensureUserFolders(req, res) {
  try {
    const userId = req.body?.userId ?? req.query?.userId ?? req.params?.userId;

    if (!userId) {
      return res.status(400).json({ ok: false, error: "Falta {userId}" });
    }

    // Esta operación solo tiene sentido en el bucket de user media.
    const gcs = getGcsForKey("user_media");
    const result = await gcs.ensureUserFolders({ userId });
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e.message || e) });
  }
}

async function uploadAtPath(req, res) {
  try {
    const storageKey = resolveStorageKeyFromReq(req);
    const targetPath = String(req.body?.targetPath || "").trim();
    const contentType = String(req.body?.contentType || "").trim();

    if (!targetPath) {
      return res.status(400).json({ ok: false, error: "Falta {targetPath}" });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        ok: false,
        error:
          "Falta archivo (file). Debes enviar multipart/form-data con el campo 'file' (type File).",
        debug: {
          receivedContentType: req.headers["content-type"],
          receivedBodyKeys: Object.keys(req.body || {}),
          receivedFile: !!req.file,
          expectedField: "file",
        },
      });
    }

    const bodyPublicRead = String(req.body?.publicRead ?? "").toLowerCase();
    let publicRead = bodyPublicRead === "true" || bodyPublicRead === "1";

    // Reglas por bucket:
    // - public_assets: siempre público (URL estable)
    // - user_media: público solo si lo pides o si es profile
    if (storageKey === "public_assets") {
      publicRead = true;
    } else if (!publicRead && /^\/?users\/[^/]+\/profile\//.test(targetPath)) {
      publicRead = true;
    }

    const gcs = getGcsForKey(storageKey);
    const result = await gcs.uploadBufferAtPath({
      targetPath,
      buffer: req.file.buffer,
      contentType: contentType || req.file.mimetype || "application/octet-stream",
      ensureFolders: storageKey === "user_media",
      publicRead,
      cacheControl: publicRead
        ? "public, max-age=31536000, immutable"
        : "private, max-age=0, no-cache",
    });


    const reg = await call_db({
      fnName: "infraestructura.fn_archivo_registrar",
      args: {
        p_storage_key: storageKey,
        p_path: result.objectName,          // IMPORTANTE: usa objectName real en bucket
        p_url: result.url,                  // fallback si no existe servidor_archivos cod
        p_nombre_original: req.file.originalname,
        p_mime_type: contentType || req.file.mimetype || "application/octet-stream",
        p_bytes: req.file.size,
        p_checksum_sha256: null,            // si luego quieres, lo calculamos
        p_metadata: {
          bucket: result.bucket,
          gcsUri: result.gcsUri,
          publicRead,
          targetPath,
        },
      },
    meta: { module: "files", op: "uploadAtPath" },
  });

  const archivoRow = reg?.rows?.[0] || null;

    return res.json({
      ok: true,
      storageKey,
      id_archivo: archivoRow?.id_archivo ?? null,
      archivo_url: archivoRow?.url ?? null,
      ...result,
    });
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e.message || e) });
  }
}

async function signedRead(req, res) {
  try {
    const targetPath = String(req.query?.targetPath || req.body?.targetPath || "").trim();
    const ttlSeconds = req.query?.ttlSeconds ?? req.body?.ttlSeconds;

    if (!targetPath) return res.status(400).json({ ok: false, error: "Falta {targetPath}" });

    const storageKey = resolveStorageKeyFromReq(req);
    const gcs = getGcsForKey(storageKey);

    // Si es bucket público, devuelve URL estable (no expira)
    if (storageKey === "public_assets") {
      const result = gcs.getPublicUrlByPath({ targetPath });
      return res.json({ storageKey, ...result, stable: true });
    }

    const result = await gcs.getSignedReadUrlByPath({ targetPath, ttlSeconds });
    return res.json({ storageKey, ...result });
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e.message || e) });
  }
}

async function exists(req, res) {
  try {
    const targetPath = String(req.query?.targetPath || req.body?.targetPath || "").trim();
    if (!targetPath) return res.status(400).json({ ok: false, error: "Falta {targetPath}" });

    const gcs = getGcsFromReq(req);
    const result = await gcs.existsByPath({ targetPath });
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e.message || e) });
  }
}

async function deleteFile(req, res) {
  try {
    const targetPath = String(req.query?.targetPath || req.body?.targetPath || "").trim();
    if (!targetPath) return res.status(400).json({ ok: false, error: "Falta {targetPath}" });

    const storageKey = resolveStorageKeyFromReq(req);
    const gcs = getGcsForKey(storageKey);

    // 1) Borra en el bucket (ignoreNotFound: true)
    const result = await gcs.deleteByPath({ targetPath });

    // 2) Apaga el registro en infraestructura.archivo (si existe)
    // Nota: usamos objectName (ruta real en bucket) para matchear con infraestructura.archivo.path
    const motivo = String(req.query?.motivo || req.body?.motivo || "").trim() || "DELETE_API_FILES";

    let apagadoRow = null;
    try {
      const apagado = await call_db({
        fnName: "infraestructura.fn_archivo_apagar",
        args: {
          p_storage_key: storageKey,
          p_path: result.objectName,
          p_url: null,
          p_motivo: motivo,
          p_metadata: {
            op: "api/files/delete",
            targetPath,
            objectName: result.objectName,
          },
        },
        meta: { module: "files", op: "deleteFile" },
      });
      apagadoRow = apagado?.rows?.[0] || null;
    } catch (e) {
      // No reventamos el delete del bucket si el apagado en DB falla.
      // Devolvemos warning para que puedas detectar el problema.
      return res.json({
        ...result,
        storageKey,
        warning: "DELETED_IN_BUCKET_BUT_DB_UPDATE_FAILED",
        db_error: String(e.message || e),
      });
    }

    return res.json({
      ...result,
      storageKey,
      db: {
        id_archivo: apagadoRow?.id_archivo ?? null,
        url: apagadoRow?.url ?? null,
      },
    });
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e.message || e) });
  }
}

async function list(req, res) {
  try {
    const prefix = String(req.query?.prefix || req.body?.prefix || "").trim() || undefined;

    const gcs = getGcsFromReq(req);
    const result = await gcs.listPaths({ prefix });
    return res.json({ ok: true, items: result });
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e.message || e) });
  }
}

async function copy(req, res) {
  try {
    const { fromPath, toPath } = req.body || {};
    if (!fromPath || !toPath)
      return res.status(400).json({ ok: false, error: "Falta {fromPath, toPath}" });

    const gcs = getGcsFromReq(req);
    const result = await gcs.copyByPath({ fromPath, toPath });
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e.message || e) });
  }
}

async function move(req, res) {
  try {
    const { fromPath, toPath } = req.body || {};
    if (!fromPath || !toPath)
      return res.status(400).json({ ok: false, error: "Falta {fromPath, toPath}" });

    const gcs = getGcsFromReq(req);
    const result = await gcs.moveByPath({ fromPath, toPath });
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e.message || e) });
  }
}

async function download(req, res) {
  try {
    const targetPath = String(req.query.path || "").trim();
    if (!targetPath) return res.status(400).json({ ok: false, error: "Falta query ?path=" });

    const gcs = getGcsFromReq(req);

    let meta;
    try {
      const r = await gcs.getMetadataByPath({ targetPath });
      meta = r.metadata;
    } catch (_) {
      meta = null;
    }

    const filename = targetPath.split("/").pop() || "download.bin";
    const contentType = meta?.contentType || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const stream = gcs.createReadStreamByPath({ targetPath });
    stream.on("error", (err) =>
      res.status(404).end(`Not found: ${String(err.message || err)}`)
    );
    stream.pipe(res);
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e.message || e) });
  }
}

module.exports = {
  ensureUserFolders,
  uploadAtPath,
  signedRead,
  exists,
  deleteFile,
  list,
  copy,
  move,
  download,
};
