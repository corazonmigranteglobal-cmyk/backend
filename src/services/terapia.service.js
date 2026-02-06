const path = require("path");
const crypto = require("crypto");

const { terapiaRepository } = require("../repository/terapia.repository.js");
const { enqueueMessage } = require("./messageQueueService.js");
const { redisReady, redisGetJson, redisSetJson } = require("../core/cache/redis.js");
const { call_db } = require("../core/db/call_db.cjs");
const { getGcsForKey } = require("./gcsRegistry");

function wrapError(scope, err, extra = {}) {
  const e = new Error(`[${scope}] ${err.message}`);
  e.cause = err;
  e.extra = extra;
  throw e;
}

async function uploadAndRegisterArchivoForEnfoque({ args, meta, file, targetDir }) {
  if (!file || !file.buffer) {
    throw new Error(
      "Falta archivo (field 'file'). Debes enviar multipart/form-data con el campo 'file'."
    );
  }

  const storageKey = String(args?.storageKey ?? args?.storage ?? args?.p_storage_key ?? "public_assets")
    .trim()
    .toLowerCase();

  // Por defecto, assets públicos (imagen de enfoque suele ser pública)
  const publicRead = storageKey === "public_assets" ? true : true;

  const safeName = String(file.originalname || "upload")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 180);

  const ext = path.extname(safeName);
  const base = path.basename(safeName, ext);
  const filename = `${base}_${crypto.randomUUID()}${ext || ""}`;

  const normalizedDir = String(targetDir || "")
    .replace(/^\/+/, "")
    .replace(/\.{2,}/g, "")
    .replace(/\\/g, "/");

  const safeDir = normalizedDir
    ? normalizedDir.endsWith("/")
      ? normalizedDir
      : `${normalizedDir}/`
    : "terapia/enfoques/";

  const targetPath = `${safeDir}${filename}`;

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
        module: "terapia",
        entity: "enfoque",
      },
    },
    meta: { ...meta, module: "terapia", op: "enfoque:archivo_registrar" },
  });

  const archivoRow = reg?.rows?.[0] || null;
  const id_archivo = archivoRow?.id_archivo ?? null;

  if (!id_archivo) {
    throw new Error("No se pudo obtener id_archivo desde infraestructura.fn_archivo_registrar");
  }

  return {
    storageKey,
    targetPath,
    uploadResult,
    id_archivo,
    archivo_url: archivoRow?.url ?? uploadResult.url,
  };
}

const terapiaService = {
  // ENFOQUES
listarEnfoques: async (args, meta) => {
    try {
      const argsString = JSON.stringify(args || {}); 
      const cacheKey = `cm:listar_enfoques:v1:${argsString}`;

      const ttlSeconds = 600; 

      if (redisReady()) {
        const cached = await redisGetJson(cacheKey);
        if (cached) {
          return cached; 
        }
      }

      const data = await terapiaRepository.listarEnfoques(args, meta);

      if (redisReady() && data) {
        await redisSetJson(cacheKey, data, ttlSeconds);
      }

      return data;

    } catch (err) {
      wrapError("terapiaService.listarEnfoques", err, { args });
    }
  },

  crearEnfoque: async (args, meta) => {
    try {
      return await terapiaRepository.crearEnfoque(args, meta);
    } catch (err) {
      wrapError("terapiaService.crearEnfoque", err, { args });
    }
  },

  updateEnfoque: async (args, meta) => {
    try {
      return await terapiaRepository.updateEnfoque(args, meta);
    } catch (err) {
      wrapError("terapiaService.updateEnfoque", err, { args });
    }
  },

  // =========================================================
  // ENFOQUES CON ARCHIVO (multipart/form-data)
  // Rutas:
  //   POST /terapia/enfoques/crear-con-archivo
  //   POST /terapia/enfoques/modificar-con-archivo
  // Campo archivo: "file"
  // =========================================================
  crearEnfoqueConArchivo: async (args, meta, file) => {
    try {
      // 1) Subir + registrar archivo
      const fixedDir = process.env.GCS_ENFOQUES_DIR || "terapia/enfoques/";
      const upload = await uploadAndRegisterArchivoForEnfoque({
        args,
        meta,
        file,
        targetDir: fixedDir,
      });

      // 2) Crear enfoque
      const created = await terapiaRepository.crearEnfoque(args, {
        ...meta,
        op: "crearEnfoqueConArchivo:enfoque_crear",
      });

      const row = created?.rows?.[0] || null;
      if (!row) {
        throw new Error("terapia.fn_crear_enfoque no devolvió rows[0]");
      }

      // Si falla la sesión u otra validación, la función devuelve status=error y data=null
      if (row.status !== "ok") {
        throw new Error(row.message || "Error al crear enfoque");
      }

      const id_enfoque = row?.data?.id_enfoque ?? null;
      if (!id_enfoque) {
        throw new Error(
          "No se pudo obtener data.id_enfoque desde terapia.fn_crear_enfoque"
        );
      }

      // 3) Linkear id_archivo al enfoque
      const linked = await terapiaRepository.setEnfoqueArchivo(
        {
          p_actor_user_id: args?.p_actor_user_id,
          p_id_sesion: args?.p_id_sesion,
          p_id_enfoque: Number(id_enfoque),
          p_id_archivo: Number(upload.id_archivo),
          p_metadata: {
            source: "crearEnfoqueConArchivo",
          },
        },
        { ...meta, op: "crearEnfoqueConArchivo:enfoque_set_archivo" }
      );

      return {
        ok: true,
        upload: {
          storageKey: upload.storageKey,
          targetPath: upload.targetPath,
          id_archivo: upload.id_archivo,
          archivo_url: upload.archivo_url,
          uploadResult: upload.uploadResult,
        },
        create: created,
        link: linked,
      };
    } catch (err) {
      wrapError("terapiaService.crearEnfoqueConArchivo", err, { args });
    }
  },

  updateEnfoqueConArchivo: async (args, meta, file) => {
    try {
      const p_id_enfoque = Number(args?.p_id_enfoque);
      if (!p_id_enfoque) {
        throw new Error("Falta p_id_enfoque");
      }

      // 1) Actualizar datos del enfoque
      const updated = await terapiaRepository.updateEnfoque(args, {
        ...meta,
        op: "updateEnfoqueConArchivo:enfoque_update",
      });

      const row = updated?.rows?.[0] || null;
      if (!row) {
        throw new Error("terapia.fn_update_enfoque no devolvió rows[0]");
      }
      if (row.status !== "ok") {
        throw new Error(row.message || "Error al actualizar enfoque");
      }

      // 2) Si viene archivo, subir + registrar + linkear
      let upload = null;
      let linked = null;

      if (file && file.buffer) {
        const fixedDir = process.env.GCS_ENFOQUES_DIR || "terapia/enfoques/";
        upload = await uploadAndRegisterArchivoForEnfoque({
          args,
          meta,
          file,
          targetDir: fixedDir,
        });

        linked = await terapiaRepository.setEnfoqueArchivo(
          {
            p_actor_user_id: args?.p_actor_user_id,
            p_id_sesion: args?.p_id_sesion,
            p_id_enfoque: p_id_enfoque,
            p_id_archivo: Number(upload.id_archivo),
            p_metadata: {
              source: "updateEnfoqueConArchivo",
            },
          },
          { ...meta, op: "updateEnfoqueConArchivo:enfoque_set_archivo" }
        );
      }

      return {
        ok: true,
        update: updated,
        upload: upload
          ? {
              storageKey: upload.storageKey,
              targetPath: upload.targetPath,
              id_archivo: upload.id_archivo,
              archivo_url: upload.archivo_url,
              uploadResult: upload.uploadResult,
            }
          : null,
        link: linked,
      };
    } catch (err) {
      wrapError("terapiaService.updateEnfoqueConArchivo", err, { args });
    }
  },
  // PRODUCTOS
listarProductos: async (args, meta) => {
    try {
      const argsString = JSON.stringify(args || {});
      const cacheKey = `cm:listar_productos:v1:${argsString}`;

      const ttlSeconds = 600;

      if (redisReady()) {
        const cached = await redisGetJson(cacheKey);
        if (cached) {
          return cached; 
        }
      }

      const data = await terapiaRepository.listarProductos(args, meta);

      if (redisReady() && data) {
        await redisSetJson(cacheKey, data, ttlSeconds);
      }

      return data;
    } catch (err) {
      wrapError("terapiaService.listarProductos", err, { args });
    }
  },

  crearProducto: async (args, meta) => {
    try {
      return await terapiaRepository.crearProducto(args, meta);
    } catch (err) {
      wrapError("terapiaService.crearProducto", err, { args });
    }
  },

  updateProducto: async (args, meta) => {
    try {
      return await terapiaRepository.updateProducto(args, meta);
    } catch (err) {
      wrapError("terapiaService.updateProducto", err, { args });
    }
  },

  // HORARIOS
  obtenerHorariosTerapeuta: async (args, meta) => {
    try {
      return await terapiaRepository.obtenerHorariosTerapeuta(args, meta);
    } catch (err) {
      wrapError("terapiaService.obtenerHorariosTerapeuta", err, { args });
    }
  },

  crearHorarioTerapeuta: async (args, meta) => {
    try {
      return await terapiaRepository.crearHorarioTerapeuta(args, meta);
    } catch (err) {
      wrapError("terapiaService.crearHorarioTerapeuta", err, { args });
    }
  },

  actualizarHorarioTerapeutaVersionado: async (args, meta) => {
    try {
      return await terapiaRepository.actualizarHorarioTerapeutaVersionado(args, meta);
    } catch (err) {
      wrapError("terapiaService.actualizarHorarioTerapeutaVersionado", err, { args });
    }
  },

  // BLOQUEOS
  crearBloqueoAgenda: async (args, meta) => {
    try {
      return await terapiaRepository.crearBloqueoAgenda(args, meta);
    } catch (err) {
      wrapError("terapiaService.crearBloqueoAgenda", err, { args });
    }
  },

  // CITAS
  registrarCita: async (args, meta) => {
    try {
      return await terapiaRepository.registrarCita(args, meta);
    } catch (err) {
      wrapError("terapiaService.registrarCita", err, { args });
    }
  },

  actualizarDetalleCita: async (args, meta) => {
    try {
      return await terapiaRepository.actualizarDetalleCita(args, meta);
    } catch (err) {
      wrapError("terapiaService.actualizarDetalleCita", err, { args });
    }
  },

  actualizarEstadoCita: async (args, meta) => {
    // meta suele traer trazabilidad (requestId/traceId) desde el controller
    const trace = meta?.trace ?? meta?.traceId ?? meta?.request_id ?? meta?.requestId ?? null;

    try {
      const result = await terapiaRepository.actualizarEstadoCita(args, meta);

      // Encolar notificación (best-effort): si falla, NO debe tumbar el endpoint
      try {
        const row = result?.rows?.[0];

        const statusStr = String(row?.status ?? row?.estado ?? "").trim().toLowerCase();
        if (statusStr === "ok") {
          const data = row.data || {};

          // Estado nuevo: prioriza el input (contrato) y luego el retorno de DB
          const rawEstado =
            args?.p_nuevo_estado ??
            args?.nuevo_estado ??
            args?.estado ??
            data?.nuevo_estado ??
            data?.estado ??
            data?.cita?.estado ??
            null;

          const estado = String(rawEstado || "").trim().toUpperCase();

          // Mapeo 1:1 con tus estados válidos en DB (ck_cita_estado_valido)
          const templateByEstado = {
            PENDIENTE: "cita_pendiente",
            PLANIFICADA: "cita_pendiente_programacion",
            CONFIRMADA: "cita_confirmada",
            CANCELADA: "cita_cancelada",
            RECHAZADA: "cita_rechazada",
            MODIFICADA: "cita_modificada",
            COMPLETADA: "cita_completada",
          };

          const templateKey = templateByEstado[estado] || null;

          // Detectar email "para" sin asumir nombres:
          // - busca en data/cita cualquier campo típico (email/correo) y también por heurística
          function pickEmail(obj) {
            if (!obj || typeof obj !== "object") return null;

            // 1) claves directas comunes
            const direct =
              obj.email ??
              obj.correo ??
              obj.mail ??
              obj.to ??
              obj.para ??
              null;
            if (direct && String(direct).includes("@")) return String(direct).trim();

            // 2) búsqueda heurística por keys que contengan 'mail' o 'correo'
            for (const [k, v] of Object.entries(obj)) {
              if (!v) continue;
              const kk = String(k).toLowerCase();
              if (kk.includes("email") || kk.includes("correo") || kk.includes("mail")) {
                const s = String(v).trim();
                if (s.includes("@")) return s;
              }
            }
            return null;
          }

          const para =
            pickEmail(data) ??
            pickEmail(data?.cita) ??
            args?.p_email ??
            args?.email ??
            null;

          if (!templateKey) {
            console.warn("[enqueue:skip] estado sin template", { estado, trace });
          } else if (!para) {
            console.warn("[enqueue:skip] sin email destinatario", {
              estado,
              templateKey,
              trace,
              // te dejo trazas mínimas para depurar sin imprimir toda la cita
              hasData: !!data,
              hasCita: !!data?.cita,
              keysData: data && typeof data === "object" ? Object.keys(data).slice(0, 20) : [],
              keysCita: data?.cita && typeof data.cita === "object" ? Object.keys(data.cita).slice(0, 20) : [],
            });
          } else {
            const enq = await enqueueMessage({
              tipo: "ACTUALIZACION_ESTADO_CITA",
              canal: "EMAIL",
              prioridad: 5,
              para,
              templateKey,
              payload: {
                email: para,
                estado,
                ...(data?.cita ? data.cita : {}),
                cita: data?.cita ?? undefined,
                id_cita: data?.id_cita ?? data?.cita?.id_cita ?? args?.p_id_cita,
              },
            });

            if (!enq?.ok) {
              console.warn("[enqueue:fail]", { estado, templateKey, para, trace, error: enq?.error });
            } else {
              console.log("[enqueue:ok]", { estado, templateKey, para, trace, id_mensaje: enq?.job?.id_mensaje });
            }
          }
        } else {
          // No ok: no encolar
        }
      } catch (e) {
        console.error("[service:warn]", {
          action: "terapia.actualizarEstadoCita.enqueueMessage",
          message: e?.message || String(e),
          trace,
        });
      }

      return result;
    } catch (err) {
      wrapError("terapiaService.actualizarEstadoCita", err, { args, trace });
    }
  },

  // ADMIN
listarSolicitudesCitaAdmin: async (args, meta) => {
  try {
    const r = await terapiaRepository.listarSolicitudesCitaAdmin(args, meta);
    console.log("[listarSolicitudesCitaAdmin]", {
      args,
      rowCount: r?.rowCount,
      sample: Array.isArray(r?.rows) ? r.rows.slice(0, 2) : r?.rows
    });
    return r;
  } catch (err) {
    wrapError("terapiaService.listarSolicitudesCitaAdmin", err, { args });
  }
},


  obtenerDisponibilidadHorarios: async (args, meta) => {
    try {
      return await terapiaRepository.obtenerDisponibilidadHorarios(args, meta);
    } catch (err) {
      wrapError("terapiaService.obtenerDisponibilidadHorarios", err, { args });
    }
  },

  obtenerProducto: async (args, meta) => {
    try {
      return await terapiaRepository.obtenerProducto(args, meta);
    } catch (err) {
      wrapError("terapiaService.obtenerProducto", err, { args });
    }
  },

  obtenerEnfoque: async (args, meta) => {
    try {
      return await terapiaRepository.obtenerEnfoque(args, meta);
    } catch (err) {
      wrapError("terapiaService.obtenerEnfoque", err, { args });
    }
  },


  // BOOTSTRAP: ENFOQUE-PRODUCTO
  bookingBootstrap: async (args, meta) => {
    try {
      const uid = Number(args?.p_actor_user_id);
      const sid = Number(args?.p_id_sesion);

      // normalizar boolean
      const incluir = args?.p_incluir_horarios;
      const p_incluir_horarios =
        incluir === undefined ? true :
        incluir === true || incluir === "true" || incluir === 1 || incluir === "1";

      // clave SEGURA: incluye sesión (evita leaks por cache cross-user)
      // v2: incluye nuevos campos (image_url) en terapeutas/enfoques
      const cacheKey = `cm:booking_bootstrap:v2:uid:${uid}:sid:${sid}:h:${p_incluir_horarios ? 1 : 0}`;

      // TTL corto si hay horarios (porque dependen de NOW y de citas/bloqueos)
      const ttlSeconds = p_incluir_horarios ? 45 : 300;

      if (redisReady()) {
        const cached = await redisGetJson(cacheKey);
        if (cached) {
          return { ok: true, cached: true, data: cached };
        }
      }

      const dbRes = await terapiaRepository.bookingBootstrap(
        { p_actor_user_id: uid, p_id_sesion: sid, p_incluir_horarios },
        meta
      );

      // la función retorna 1 columna: fn_booking_bootstrap
      const data = dbRes?.rows?.[0]?.fn_booking_bootstrap ?? null;

      if (redisReady() && data) {
        await redisSetJson(cacheKey, data, ttlSeconds);
      }

      return { ok: true, cached: false, data };
    } catch (err) {
      wrapError("terapiaService.bookingBootstrap", err, { args });
    }
  },
  
  bootstrapEnfoqueProducto: async (args, meta) => {
    try {
      const uid = Number(args?.p_actor_user_id);
      const sid = Number(args?.p_id_sesion);
      const only = args?.p_only_activos;
      const p_only_activos =
        only === undefined ? true :
        only === true || only === "true" || only === 1 || only === "1";

      const cacheKey = `cm:bootstrap:enfoque_producto:v1:uid:${uid}:sid:${sid}:only:${p_only_activos ? 1 : 0}`;
      const ttlSeconds = 60 * 10; 

      if (redisReady()) {
        const cached = await redisGetJson(cacheKey);
        if (cached) return { ok: true, cached: true, data: cached };
      }

      const dbRes = await terapiaRepository.bootstrapEnfoqueProducto(
        { p_actor_user_id: uid, p_id_sesion: sid, p_only_activos },
        meta
      );

      const data = dbRes?.rows?.[0]?.fn_enfoque_producto_bootstrap ?? null;

      if (redisReady() && data) {
        await redisSetJson(cacheKey, data, ttlSeconds);
      }

      return { ok: true, cached: false, data };
    } catch (err) {
      wrapError("terapiaService.bootstrapEnfoqueProducto", err, { args });
    }
  },
  apagarEnfoque: async (args, meta) => {
    try {
      return await terapiaRepository.apagarEnfoque(args, meta);
    } catch (err) {
      wrapError("terapiaService.apagarEnfoque", err, { args });
    }
  },

  apagarProducto: async (args, meta) => {
    try {
      return await terapiaRepository.apagarProducto(args, meta);
    } catch (err) {
      wrapError("terapiaService.apagarProducto", err, { args });
    }
  },

  apagarHorarioTerapeuta: async (args, meta) => {
    try {
      return await terapiaRepository.apagarHorarioTerapeuta(args, meta);
    } catch (err) {
      wrapError("terapiaService.apagarHorarioTerapeuta", err, { args });
    }
  },

  apagarBloqueoAgenda: async (args, meta) => {
    try {
      return await terapiaRepository.apagarBloqueoAgenda(args, meta);
    } catch (err) {
      wrapError("terapiaService.apagarBloqueoAgenda", err, { args });
    }
  },
  
  apagarCita: async (args, meta) => {
    try {
      return await terapiaRepository.apagarCita(args, meta);
    } catch (err) {
      wrapError("terapiaService.apagarCita", err, { args });
    }
  },

};

module.exports = { terapiaService };
