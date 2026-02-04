const path = require("path");
const crypto = require("crypto");

const { publicoRepository } = require("../repository/publico.repository.js");
const { redisReady, redisGetJson, redisSetJson } = require("../core/cache/redis.js");
const { call_db } = require("../core/db/call_db.cjs"); 
const { getGcsForKey } = require("./gcsRegistry");

function wrapError(scope, err, extra = {}) {
  const e = new Error(`[${scope}] ${err.message}`);
  e.cause = err;
  e.extra = extra;
  throw e;
}

const publicoService = {
  listarElementosUi: async (args, meta) => {
    try {
      return await publicoRepository.listarElementosUi(args, meta);
    } catch (err) {
      wrapError("publicoService.listarElementosUi", err, { args });
    }
  },

  obtenerElementoUi: async (args, meta) => {
    try {
      return await publicoRepository.obtenerElementoUi(args, meta);
    } catch (err) {
      wrapError("publicoService.obtenerElementoUi", err, { args });
    }
  },

  crearElementoUi: async (args, meta) => {
    try {
      return await publicoRepository.crearElementoUi(args, meta);
    } catch (err) {
      wrapError("publicoService.crearElementoUi", err, { args });
    }
  },

  actualizarElementoUi: async (args, meta) => {
    try {
      return await publicoRepository.actualizarElementoUi(args, meta);
    } catch (err) {
      wrapError("publicoService.actualizarElementoUi", err, { args });
    }
  },

  listarServidoresArchivos: async (args, meta) => {
    try {
      return await publicoRepository.listarServidoresArchivos(args, meta);
    } catch (err) {
      wrapError("publicoService.listarServidoresArchivos", err, { args });
    }
  },

  uiBootstrap: async (args, meta) => {
    try {
      const uid = Number(args?.p_actor_user_id);
      const sid = Number(args?.p_id_sesion);
      const idPagina = args?.p_id_pagina === undefined ? null : Number(args?.p_id_pagina);

      const cacheKey = `cm:publico:ui_bootstrap:v1:uid:${uid}:sid:${sid}:pag:${idPagina ?? "all"}`;
      const ttlSeconds = 600; // 10 min (ajustable)

      if (redisReady()) {
        const cached = await redisGetJson(cacheKey);
        if (cached) return { ok: true, cached: true, data: cached };
      }

      const dbRes = await publicoRepository.uiBootstrap(
        { p_actor_user_id: uid, p_id_sesion: sid, p_id_pagina: idPagina },
        meta
      );

      const data = dbRes?.rows?.[0]?.fn_ui_bootstrap ?? null;

      if (redisReady() && data) {
        await redisSetJson(cacheKey, data, ttlSeconds);
      }

      return { ok: true, cached: false, data };
    } catch (err) {
      wrapError("publicoService.uiBootstrap", err, { args });
    }
  },
  apagarElementoUi: async (args, meta) => {
    try {
      return await publicoRepository.apagarElementoUi(args, meta);
    } catch (err) {
      wrapError("publicoService.apagarElementoUi", err, { args });
    }
  },
  listarPaginasUi: async (args, meta) => {
    try {
      return await publicoRepository.listarPaginasUi(args, meta);
    } catch (err) {
      wrapError("publicoService.listarPaginasUi", err, { args });
    }
  },

  obtenerPaginaUi: async (args, meta) => {
    try {
      return await publicoRepository.obtenerPaginaUi(args, meta);
    } catch (err) {
      wrapError("publicoService.obtenerPaginaUi", err, { args });
    }
  },

  crearPaginaUi: async (args, meta) => {
    try {
      return await publicoRepository.crearPaginaUi(args, meta);
    } catch (err) {
      wrapError("publicoService.crearPaginaUi", err, { args });
    }
  },

  actualizarPaginaUi: async (args, meta) => {
    try {
      return await publicoRepository.actualizarPaginaUi(args, meta);
    } catch (err) {
      wrapError("publicoService.actualizarPaginaUi", err, { args });
    }
  },

  apagarPaginaUi: async (args, meta) => {
    try {
      return await publicoRepository.apagarPaginaUi(args, meta);
    } catch (err) {
      wrapError("publicoService.apagarPaginaUi", err, { args });
    }
  },
  
  actualizarElementoUiConArchivo: async (args, meta, file) => {
    try {
      if (!file || !file.buffer) {
        throw new Error(
          "Falta archivo (field 'file'). Debes enviar multipart/form-data con el campo 'file'."
        );
      }

      const p_id_pagina = Number(args?.p_id_pagina);
      const p_id_elemento = Number(args?.p_id_elemento);
      const p_cod_elemento = String(args?.p_cod_elemento || "").trim();

      if (!p_id_pagina || !p_id_elemento || !p_cod_elemento) {
        throw new Error(
          "Faltan campos en args: p_id_pagina, p_id_elemento, p_cod_elemento (requeridos para ruta del archivo)."
        );
      }

      // --- 1) Upload a GCS (misma lógica base que files.controller.uploadAtPath) ---
      const storageKey = String(
        args?.storageKey ?? args?.storage ?? args?.p_storage_key ?? "public_assets"
      )
        .trim()
        .toLowerCase();

      // En UI pública, por defecto queremos assets públicos (URL estable)
      const publicRead = storageKey === "public_assets" ? true : true;

      const safeName = String(file.originalname || "upload")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .slice(0, 180);

      const ext = path.extname(safeName);
      const base = path.basename(safeName, ext);
      const filename = `${base}_${crypto.randomUUID()}${ext || ""}`;

      // Si el front envía targetDir, subimos a esa carpeta (prefijo) en el storage.
      // Ej: "vistas_publicas_assets/landing_page/".
      const rawTargetDir = String(args?.targetDir ?? args?.p_target_dir ?? "");
      const normalizedDir = rawTargetDir
        .replace(/^\/+/, "")
        .replace(/\.{2,}/g, "")
        .replace(/\\/g, "/");

      const safeDir = normalizedDir
        ? (normalizedDir.endsWith("/") ? normalizedDir : `${normalizedDir}/`)
        : null;

      const targetPath = safeDir
        ? `${safeDir}${filename}`
        : `publico/ui/pagina_${p_id_pagina}/elemento_${p_id_elemento}/${filename}`;

      const gcs = getGcsForKey(storageKey);
      const uploadResult = await gcs.uploadBufferAtPath({
        targetPath,
        buffer: file.buffer,
        contentType: file.mimetype || "application/octet-stream",
        ensureFolders: false,
        publicRead,
        cacheControl: publicRead
          ? "public, max-age=31536000, immutable"
          : "private, max-age=0, no-cache",
      });

      // --- 2) Registrar en DB (infraestructura.archivo) ---
      const reg = await call_db({
        fnName: "infraestructura.fn_archivo_registrar",
        args: {
          p_storage_key: storageKey,
          p_path: uploadResult.objectName,
          p_url: uploadResult.url,
          p_nombre_original: file.originalname,
          p_mime_type: file.mimetype || "application/octet-stream",
          p_bytes: file.size,
          p_checksum_sha256: null,
          p_metadata: {
            bucket: uploadResult.bucket,
            gcsUri: uploadResult.gcsUri,
            publicRead: uploadResult.public,
            targetPath,
            storageKey,
          },
        },
        meta: { ...meta, module: "publico", op: "actualizarElementoUiConArchivo:archivo_registrar" },
      });

      const archivoRow = reg?.rows?.[0] || null;
      const id_archivo = archivoRow?.id_archivo ?? null;

      if (!id_archivo) {
        throw new Error("No se pudo obtener id_archivo desde infraestructura.fn_archivo_registrar");
      }

      // --- 3) Actualizar elemento UI linkeando el archivo ---
      const updateArgs = {
        ...args,
        p_id_archivo: id_archivo,
        // cuando se actualiza por archivo, no necesitamos que el front mande link
        // (la función SQL resolverá path/url desde infraestructura.archivo)
      };

      const updated = await publicoRepository.actualizarElementoUi(updateArgs, {
        ...meta,
        op: "actualizarElementoUiConArchivo:elemento_actualizar",
      });

      return {
        ok: true,
        upload: {
          storageKey,
          targetPath,
          ...uploadResult,
          id_archivo,
          archivo_url: archivoRow?.url ?? uploadResult.url,
        },
        update: updated,
      };
    } catch (err) {
      wrapError("publicoService.actualizarElementoUiConArchivo", err, { args });
    }
  },
    obtenerPaginaPublicaBundle: async ({ id_pagina = null, cod_pagina = null } = {}) => {
    try {
      const pid = id_pagina === null || id_pagina === undefined || id_pagina === "" ? null : Number(id_pagina);
      const pcod = cod_pagina ? String(cod_pagina).trim() : null;

      const dbRes = await publicoRepository.getPaginaPublicaAssets({
        p_id_pagina: pid,
        p_cod_pagina: pcod,
      });

      const row = dbRes?.rows?.[0] || null;
      if (!row) throw new Error("PAGE_PUBLIC_BUNDLE_NOT_FOUND");

      const uiVersion = row.ui_version ?? null;
      const elementos = row.elementos ?? [];
      const contentUrl = row.content_url ?? null;
      const contentElementoId = row.content_elemento_id ?? null;

      if (!contentUrl) {
        throw new Error("CONTENT_URL_NOT_FOUND");
      }

      // Descarga JSON de contenido (GCS público)
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 10000);
      let contentJson = null;
      try {
        const r = await fetch(contentUrl, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: ac.signal,
        });
        if (!r.ok) {
          throw new Error(`CONTENT_FETCH_FAILED_HTTP_${r.status}`);
        }
        contentJson = await r.json();
      } finally {
        clearTimeout(t);
      }

      // Map uiById: { [id_elemento]: { url, alt, cod, tipo, metadata, valor_texto } }
      const uiById = {};
      for (const e of Array.isArray(elementos) ? elementos : []) {
        if (!e) continue;
        const id = e.id_elemento;
        if (id === undefined || id === null) continue;
        uiById[String(id)] = {
          id_elemento: id,
          cod: e.cod ?? null,
          tipo: e.tipo ?? null,
          url: e.url ?? null,
          alt: e.alt ?? null,
          valor_texto: e.valor_texto ?? null,
          metadata: e.metadata ?? {},
        };
      }

      return {
        ok: true,
        meta: {
          id_pagina: row.id_pagina,
          cod_pagina: row.cod,
          titulo: row.titulo,
          ruta: row.ruta,
          ui_version: uiVersion,
          content_elemento_id: contentElementoId,
          content_url: contentUrl,
        },
        content: contentJson,
        uiById,
      };
    } catch (err) {
      wrapError("publicoService.obtenerPaginaPublicaBundle", err, { id_pagina, cod_pagina });
    }
  },
};

module.exports = { publicoService };
