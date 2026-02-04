// backend/src/services/usuarios.service.js

const path = require("path");
const crypto = require("crypto");

const { usuariosRepository } = require("../repository/usuarios.repository");
const { enqueueMessage } = require("../services/messageQueueService");
const { signJwt } = require("../core/auth/jwt");
const { getGcsForKey } = require("../services/gcsRegistry");

/* =========================
   Signed URL helpers (bucket privado de usuarios)
========================= */
function safeFileName(originalname) {
  const safe = String(originalname || "upload")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 180);

  const ext = path.extname(safe);
  const base = path.basename(safe, ext);
  return { ext, filename: `${base}_${crypto.randomUUID()}${ext || ""}` };
}

function buildUserImageTargetPath({ userId, rol, originalname }) {
  const { filename } = safeFileName(originalname);
  const roleTag = String(rol || "PERFIL").toUpperCase() === "PORTADA" ? "portada" : "perfil";
  return `users/${Number(userId)}/media/${roleTag}_${filename}`;
}

function isString(v) {
  return typeof v === "string";
}

function extractTargetPathFromPublicGcsUrl(url, bucketName) {
  if (!isString(url) || !bucketName) return null;

  const prefix = `https://storage.googleapis.com/${bucketName}/`;
  if (!url.startsWith(prefix)) return null;

  const rest = url.slice(prefix.length);
  const pathOnly = rest.split("?")[0];

  try {
    return decodeURIComponent(pathOnly);
  } catch {
    return pathOnly;
  }
}

async function signUserMediaUrlIfNeeded(url) {
  if (!isString(url) || url.trim() === "") return url;

  // ✅ Si ya es signed URL, no re-firmar
  if (url.includes("X-Goog-Algorithm=") || url.includes("X-Goog-Signature=")) {
    return url;
  }

  const gcs = getGcsForKey("user_media");
  if (!gcs) return url;

  const bucketName = gcs?.bucketName;

  // Caso 1: ya es una ruta interna (path)
  if (url.startsWith("users/") || url.startsWith("/users/")) {
    const targetPath = url.replace(/^\/+/, "");
    const signed = await gcs.getSignedReadUrlByPath({ targetPath });
    return signed.url;
  }

  // Caso 2: es URL pública de GCS apuntando al bucket privado (no accesible)
  const targetPath = extractTargetPathFromPublicGcsUrl(url, bucketName);
  if (targetPath) {
    const signed = await gcs.getSignedReadUrlByPath({ targetPath });
    return signed.url;
  }

  return url;
}

async function deepSignUserMediaLinks(node) {
  if (node == null) return node;

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = await deepSignUserMediaLinks(node[i]);
    return node;
  }

  if (typeof node === "object") {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (
        isString(v) &&
        !v.startsWith("blob:") &&
        (k.endsWith("_link") || k.includes("foto") || v.includes("storage.googleapis.com"))
      ) {
        node[k] = await signUserMediaUrlIfNeeded(v);
      } else {
        node[k] = await deepSignUserMediaLinks(v);
      }
    }
    return node;
  }

  return node;
}

/* =========================
   Helpers
========================= */
function pickDeep(obj, paths) {
  for (const p of paths) {
    const parts = String(p).split(".");
    let cur = obj;
    let ok = true;
    for (const k of parts) {
      if (cur && typeof cur === "object" && k in cur) cur = cur[k];
      else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (cur !== undefined && cur !== null && String(cur).trim() !== "") return cur;
  }
  return null;
}

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

async function tryEnsureUserFolders({ userId, trace }) {
  try {
    if (!userId) return { ok: false, skipped: true, reason: "missing_userId" };
    const gcs = getGcsForKey("user_media");
    return await gcs.ensureUserFolders({ userId });
  } catch (e) {
    console.error("[service:error]", {
      action: "usuarios.ensureUserFolders",
      message: e?.message || String(e),
      trace,
    });
    return { ok: false, error: e?.message || String(e) };
  }
}

async function tryEnqueueSignupEmail({ tipo, payload, trace }) {
  const email = pick(payload, ["email", "p_email", "correo", "mail"]);
  const nombre = pick(payload, ["nombre", "p_nombre", "full_name", "name"]);
  const userId = pick(payload, ["userId", "user_id", "id_usuario", "id"]);

  if (!email) {
    console.warn("[service:warn]", {
      action: "usuarios.enqueueMessage",
      reason: "missing_email_in_payload",
      tipo,
      trace,
    });
    return { ok: false, skipped: true, reason: "missing_email" };
  }

  const templateKeyMap = {
    ADMIN: "welcome_admin",
    PACIENTE: "welcome_paciente",
    TERAPEUTA: "welcome_terapeuta",
  };

  const templateKey = templateKeyMap[tipo] || "welcome_generic";
  const pin = pick(payload, ["pin_code", "pin", "verification_pin", "codigo"]);
  const messageTipo = pin ? "EMAIL_VERIFICACION_PIN" : `EMAIL_WELCOME_${tipo}`;

  return enqueueMessage({
    tipo: messageTipo,
    canal: "EMAIL",
    prioridad: 5,
    para: email,
    templateKey: pin ? "verify_pin" : templateKey,
    payload: {
      ...payload,
      email,
      nombre,
      userId,
      pin,
    },
  });
}

/* =========================
   Upload path (FORZADO)
   SIEMPRE: users/{id}/media/
========================= */
function safeExt(originalName) {
  const ext = String(path.extname(originalName || "")).toLowerCase();
  return ext && ext.length <= 10 ? ext : "";
}

function safeBaseName(originalName) {
  const base = String(path.basename(originalName || "", path.extname(originalName || "")));
  return base.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60) || "file";
}

// ✅ SIEMPRE users/{userId}/media/
function pickUserMediaTargetPath({ userId, originalName }) {
  const ext = safeExt(originalName);
  const base = safeBaseName(originalName);
  const rand = crypto.randomBytes(8).toString("hex");
  const fileName = `${Date.now()}_${base}_${rand}${ext}`;
  return `users/${Number(userId)}/media/${fileName}`;
}

/* =========================
   Service
========================= */
const usuariosService = {
  async loginPassword(payload, trace) {
    try {
      const result = await usuariosRepository.loginPassword(payload, trace);

      const row = result?.rows?.[0];
      if (row?.status === "ok" && row?.data) {
        const secret = process.env.JWT_SECRET;
        const ttl = Number(process.env.JWT_TTL_SECONDS || 60 * 60 * 8);

        if (!secret) throw new Error("JWT_SECRET_NOT_SET");

        const data = row.data || {};
        const userId = data.user_id;
        const idSesion = data.id_sesion;

        const token = signJwt(
          {
            sub: String(userId),
            sid: Number(idSesion),
            role: data.role,
            is_admin: !!data.is_admin,
            is_super_admin: !!data.is_super_admin,
            can_manage_files: !!data.can_manage_files,
            is_accounter: !!data.is_accounter,
          },
          secret,
          { expiresInSec: ttl }
        );

        row.data = {
          ...data,
          access_token: token,
          token_type: "Bearer",
          expires_in: ttl,
        };
      }

      return result;
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.loginPassword",
        message: err?.message,
      });
      throw err;
    }
  },

  async signupAdmin(payload, trace) {
    try {
      const result = await usuariosRepository.signupAdmin(payload, trace);

      try {
        const row = result?.rows?.[0] || null;
        const userId = pickDeep(row, ["data.user_id", "data.userId", "data.id_usuario", "data.id"]);
        await tryEnsureUserFolders({ userId, trace });
      } catch (_) {}

      try {
        await tryEnqueueSignupEmail({ tipo: "ADMIN", payload, trace });
      } catch (e) {
        console.error("[service:error]", {
          action: "usuarios.signupAdmin.enqueueMessage",
          message: e?.message || String(e),
          trace,
        });
      }

      return result;
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.signupAdmin",
        message: err?.message,
        trace,
      });
      throw err;
    }
  },

  async signupPaciente(payload, trace) {
    try {
      const result = await usuariosRepository.signupPaciente(payload, trace);

      try {
        const row = result?.rows?.[0] || null;
        const userId = pickDeep(row, ["data.user_id", "data.userId", "data.id_usuario", "data.id"]);
        await tryEnsureUserFolders({ userId, trace });
      } catch (_) {}

      try {
        const row = result?.rows?.[0];
        const data = row?.data || {};
        await tryEnqueueSignupEmail({ tipo: "PACIENTE", payload: { ...payload, ...data }, trace });
      } catch (e) {
        console.error("[service:error]", {
          action: "usuarios.signupPaciente.enqueueMessage",
          message: e?.message || String(e),
          trace,
        });
      }

      return result;
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.signupPaciente",
        message: err?.message,
        trace,
      });
      throw err;
    }
  },

  async signupTerapeuta(payload, trace) {
    try {
      const result = await usuariosRepository.signupTerapeuta(payload, trace);

      try {
        const row = result?.rows?.[0] || null;
        const userId = pickDeep(row, ["data.user_id", "data.userId", "data.id_usuario", "data.id"]);
        await tryEnsureUserFolders({ userId, trace });
      } catch (_) {}

      try {
        await tryEnqueueSignupEmail({ tipo: "TERAPEUTA", payload, trace });
      } catch (e) {
        console.error("[service:error]", {
          action: "usuarios.signupTerapeuta.enqueueMessage",
          message: e?.message || String(e),
          trace,
        });
      }

      return result;
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.signupTerapeuta",
        message: err?.message,
        trace,
      });
      throw err;
    }
  },

  async verifyAuthPin(payload, trace) {
    try {
      return await usuariosRepository.verifyAuthPin(payload, trace);
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.verifyAuthPin",
        message: err?.message,
        trace,
      });
      throw err;
    }
  },

  async updatePacienteFull(payload, trace) {
    try {
      return await usuariosRepository.updatePacienteFull(payload, trace);
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.updatePacienteFull",
        message: err?.message,
      });
      throw err;
    }
  },

  async updateTerapeutaFullConArchivo(args, trace, file) {
    try {
      const p_actor_user_id = Number(args?.p_actor_user_id);
      const p_id_sesion = Number(args?.p_id_sesion);
      const p_user_id = Number(args?.p_user_id);
      const p_rol = String(args?.p_rol || "PERFIL").toUpperCase();

      if (!p_actor_user_id || !p_id_sesion || !p_user_id) {
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: "Faltan campos: p_actor_user_id, p_id_sesion, p_user_id",
        };
      }

      if (!file || !file.buffer) {
        return {
          ok: false,
          error: "MISSING_FILE",
          message: "Falta archivo (file). Debes enviar multipart/form-data con el campo 'file'",
        };
      }

      await tryEnsureUserFolders({ userId: p_user_id, trace }).catch(() => {});

      const storageKey = "user_media";
      const targetPath = buildUserImageTargetPath({
        userId: p_user_id,
        rol: p_rol,
        originalname: file.originalname,
      });

      if (!targetPath || String(targetPath).trim() === "") {
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: "targetPath vacío: no se puede registrar archivo",
        };
      }

      const gcs = getGcsForKey(storageKey);

      const uploadRes = await gcs.uploadBufferAtPath({
        targetPath,
        buffer: file.buffer,
        contentType: file.mimetype || "application/octet-stream",
        ensureFolders: true,
        publicRead: false,
        cacheControl: "private, max-age=3600",
      });

      // ✅ mandar p_path + p_url (URL base, NO signed) para evitar MISSING_PATH_OR_URL en SQL
      const bucketName = gcs?.bucketName;
      const baseUrl = bucketName ? `https://storage.googleapis.com/${bucketName}/${targetPath}` : null;

      const reg = await usuariosRepository.archivoRegistrar(
        {
          p_storage_key: storageKey,
          p_path: targetPath,
          p_url: baseUrl, // ✅ URL base estable
          p_nombre_original: file.originalname || null,
          p_mime_type: file.mimetype || "application/octet-stream",
          p_bytes: Number(file.size || file.buffer.length || 0),
          p_checksum_sha256: null,
          p_metadata: {
            bucket: uploadRes?.bucket,
            objectName: uploadRes?.objectName,
            gcsUri: uploadRes?.gcsUri,
            targetPath,
            storageKey,
            module: "usuarios",
            entity: "usuario_terapeuta",
            rol: p_rol,
          },
        },
        trace
      );

      const archivoRow = reg?.rows?.[0] || null;
      const id_archivo = archivoRow?.id_archivo ?? null;

      if (!id_archivo) {
        return {
          ok: false,
          error: "INTERNAL_ERROR",
          message: "No se pudo obtener id_archivo desde infraestructura.fn_archivo_registrar",
          upload: uploadRes,
          db: reg,
        };
      }

      const linked = await usuariosRepository.usuarioSetArchivo(
        {
          p_actor_user_id,
          p_id_sesion,
          p_target_user_id: p_user_id,
          p_id_archivo: Number(id_archivo),
          p_rol,
          p_metadata: { source: "updateTerapeutaFullConArchivo", targetPath },
        },
        trace
      );

      const patch = (args?.p_patch && typeof args.p_patch === "object") ? { ...args.p_patch } : {};
      if (typeof patch.foto_perfil_link === "string" && patch.foto_perfil_link.startsWith("blob:"))
        delete patch.foto_perfil_link;
      if (typeof patch.foto_portada_link === "string" && patch.foto_portada_link.startsWith("blob:"))
        delete patch.foto_portada_link;

      const updated = await usuariosRepository.updateTerapeutaFull(
        { p_actor_user_id, p_id_sesion, p_user_id, p_patch: patch },
        trace
      );

      const signed = await gcs.getSignedReadUrlByPath({ targetPath });

      return {
        ok: true,
        upload: { targetPath, ...uploadRes },
        archivo: { id_archivo: Number(id_archivo), url: signed?.url || null },
        link: linked,
        update: updated,
      };
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.updateTerapeutaFullConArchivo",
        message: err?.message,
        trace,
      });
      throw err;
    }
  },

  async requestNewAuthPin(payload, trace) {
    try {
      const result = await usuariosRepository.requestNewAuthPin(payload, trace);

      try {
        const row = result?.rows?.[0];
        if (row?.status === "ok") {
          const data = row.data || {};
          await enqueueMessage({
            tipo: "EMAIL_VERIFICACION_PIN",
            canal: "EMAIL",
            prioridad: 5,
            para: data.email,
            templateKey: "verify_pin",
            payload: {
              email: data.email,
              userId: data.user_id,
              pin: data.pin_code,
              contexto: data.contexto,
              expiresAt: data.expires_at,
            },
          });
        }
      } catch (e) {
        console.error("[service:warn]", {
          action: "usuarios.requestNewAuthPin.enqueueMessage",
          message: e?.message || String(e),
          trace,
        });
      }

      return result;
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.requestNewAuthPin",
        message: err?.message,
        trace,
      });
      throw err;
    }
  },

  async getTerapeutasSinAdminActivo(trace) {
    try {
      return await usuariosRepository.getTerapeutasSinAdminActivo({}, trace);
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.getTerapeutasSinAdminActivo",
        message: err?.message,
        trace,
      });
      throw err;
    }
  },

  async superSetUsuarioEstado(payload, trace) {
    try {
      return await usuariosRepository.superSetUsuarioEstado(payload, trace);
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.superSetUsuarioEstado",
        message: err?.message,
        trace,
      });
      throw err;
    }
  },

  async superListarUsuariosEstado(payload, trace) {
    try {
      const res = await usuariosRepository.superListarUsuariosEstado(payload, trace);

      if (res?.ok && Array.isArray(res.rows)) {
        for (const r of res.rows) {
          if (r && typeof r === "object") {
            if (r.foto_perfil_link) r.foto_perfil_link = await signUserMediaUrlIfNeeded(r.foto_perfil_link);
            if (r.foto_portada_link) r.foto_portada_link = await signUserMediaUrlIfNeeded(r.foto_portada_link);
          }
        }
      }
      return res;
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.superListarUsuariosEstado",
        message: err?.message,
        trace,
      });
      throw err;
    }
  },

  async obtenerUsuarioTerapeuta(payload, trace) {
    try {
      const res = await usuariosRepository.obtenerUsuarioTerapeuta(payload, trace);

      const row0 = res?.rows?.[0];
      const json = row0 && typeof row0 === "object" ? Object.values(row0)[0] : null;

      if (json && typeof json === "object") {
        await deepSignUserMediaLinks(json);

        const k = row0 ? Object.keys(row0)[0] : null;
        if (k) res.rows[0][k] = json;
      }

      return res;
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.obtenerUsuarioTerapeuta",
        message: err?.message,
        trace,
      });
      throw err;
    }
  },

  async obtenerUsuarioAdmin(payload, trace) {
    try {
      const res = await usuariosRepository.obtenerUsuarioAdmin(payload, trace);

      const row0 = res?.rows?.[0];
      const json = row0 && typeof row0 === "object" ? Object.values(row0)[0] : null;

      if (json && typeof json === "object") {
        await deepSignUserMediaLinks(json);

        const k = row0 ? Object.keys(row0)[0] : null;
        if (k) res.rows[0][k] = json;
      }

      return res;
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.obtenerUsuarioAdmin",
        message: err?.message,
        trace,
      });
      throw err;
    }
  },

  async requestPasswordRecoveryPin(payload, trace) {
    try {
      const b = payload || {};
      const email = pick(b, ["p_email", "email", "correo", "mail"]);

      if (!email) {
        return {
          ok: true,
          rows: [{ status: "error", type_error: "MISSING_EMAIL", message: "Falta email", data: null }],
        };
      }

      const args = {
        p_email: email,
        ...(b.p_life_time ? { p_life_time: b.p_life_time } : {}),
        ...(b.p_contexto ? { p_contexto: b.p_contexto } : {}),
        ...(b.p_metadata ? { p_metadata: b.p_metadata } : {}),
      };

      const result = await usuariosRepository.requestPasswordRecoveryPin(args, trace);

      try {
        const row = result?.rows?.[0];
        if (row?.status === "ok") {
          const data = row.data || {};

          await enqueueMessage({
            tipo: "EMAIL_RECUPERACION_PASSWORD_PIN",
            canal: "EMAIL",
            prioridad: 5,
            para: data.email,
            templateKey: "password_recovery_pin",
            payload: {
              email: data.email,
              userId: data.user_id,
              pin: data.pin_code,
              contexto: data.contexto,
              expiresAt: data.expires_at,
            },
          });
        }
      } catch (e) {
        console.error("[service:warn]", {
          action: "usuarios.requestPasswordRecoveryPin.enqueueMessage",
          message: e?.message || String(e),
          trace,
        });
      }

      return result;
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.requestPasswordRecoveryPin",
        message: err?.message,
        trace,
      });
      throw err;
    }
  },

  async updatePasswordRecovery(payload, trace) {
    try {
      return await usuariosRepository.updatePasswordRecovery(payload, trace);
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.updatePasswordRecovery",
        message: err?.message,
        trace,
      });
      throw err;
    }
  },

  async actualizarUsuarioArchivoConArchivo(args, trace, file) {
    try {
      const p_actor_user_id = Number(args?.p_actor_user_id);
      const p_id_sesion = Number(args?.p_id_sesion);
      const p_target_user_id = Number(args?.p_target_user_id ?? args?.p_user_id ?? args?.user_id);
      const p_rol = String(args?.p_rol || "PERFIL").toUpperCase();

      if (!p_actor_user_id || !p_id_sesion || !p_target_user_id) {
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: "Faltan campos: p_actor_user_id, p_id_sesion, p_target_user_id (o p_user_id/user_id)",
        };
      }

      if (!file || !file.buffer) {
        return {
          ok: false,
          error: "MISSING_FILE",
          message: "Falta archivo (file). Debes enviar multipart/form-data con el campo 'file'",
        };
      }

      await tryEnsureUserFolders({ userId: p_target_user_id, trace }).catch(() => {});

      const targetPath = pickUserMediaTargetPath({
        userId: p_target_user_id,
        originalName: file.originalname,
      });

      const gcs = getGcsForKey("user_media");
      if (!gcs) throw new Error("GCS_REGISTRY_KEY_NOT_FOUND:user_media");

      const uploadRes = await gcs.uploadBufferAtPath({
        targetPath,
        buffer: file.buffer,
        contentType: file.mimetype || "application/octet-stream",
        ensureFolders: true,
        publicRead: false,
        cacheControl: "private, max-age=3600",
      });

      const bucketName = gcs?.bucketName;
      const baseUrl = bucketName ? `https://storage.googleapis.com/${bucketName}/${targetPath}` : null;

      const reg = await usuariosRepository.archivoRegistrar(
        {
          p_storage_key: "user_media",
          p_path: targetPath,
          p_url: baseUrl, // ✅ URL base estable
          p_nombre_original: file.originalname || null,
          p_mime_type: file.mimetype || null,
          p_bytes: Number(file.size || file.buffer.length || 0),
          p_checksum_sha256: null,
          p_metadata: {
            targetPath,
            bucket: uploadRes?.bucket,
            objectName: uploadRes?.objectName,
            gcsUri: uploadRes?.gcsUri,
            rol: p_rol,
            storage_key: "user_media",
          },
        },
        trace
      );

      const id_archivo = reg?.rows?.[0]?.id_archivo ?? null;
      if (!id_archivo) {
        return {
          ok: false,
          error: "INTERNAL_ERROR",
          message: "No se pudo obtener id_archivo desde infraestructura.fn_archivo_registrar",
          upload: uploadRes,
          db: reg,
        };
      }

      const linked = await usuariosRepository.usuarioSetArchivo(
        {
          p_actor_user_id,
          p_id_sesion,
          p_target_user_id,
          p_id_archivo: Number(id_archivo),
          p_rol,
          p_metadata: { source: "actualizarUsuarioArchivoConArchivo", targetPath },
        },
        trace
      );

      const signed = await gcs.getSignedReadUrlByPath({ targetPath });
      const archivo_url = signed?.url || null;

      return {
        ok: true,
        upload: { targetPath, ...uploadRes },
        archivo: { id_archivo: Number(id_archivo), url: archivo_url },
        link: linked,
      };
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.actualizarUsuarioArchivoConArchivo",
        message: err?.message,
        trace,
      });
      throw err;
    }
  },
  async updateAdminFull(payload, trace) {
    try {
      return await usuariosRepository.updateAdminFull(payload, trace);
    } catch (err) {
      console.error("[service:error]", {
        action: "usuarios.updateAdminFull",
        message: err?.message,
      });
      throw err;
    }
  },
};

module.exports = { usuariosService };
