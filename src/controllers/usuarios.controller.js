// usuarios.controller.js (CommonJS)
const { usuariosService } = require("../services/usuarios.service");

function traceFromReq(req) {
  return {
    requestId: req.headers["x-request-id"] || null,
    ip: req.ip,
    userAgent: req.headers["user-agent"] || null,
    route: `${req.method} ${req.originalUrl}`,
  };
}

function parseJsonMaybe(v, fallback = null) {
  if (v == null) return fallback;
  if (typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return fallback; }
  }
  return fallback;
}

function toIntOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function resolveUserId(req) {
  return toIntOrNull(
    req.params?.user_id ??
    req.body?.p_user_id ??
    req.body?.user_id ??
    req.body?.id_usuario
  );
}


const usuariosController = {
  async loginPassword(req, res) {
    try {
      const result = await usuariosService.loginPassword(req.body, traceFromReq(req));
      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", { route: "loginPassword", message: err?.message });
      throw err;
    }
  },

  async signupAdmin(req, res) {
    try {
      const result = await usuariosService.signupAdmin(req.body, traceFromReq(req));
      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", { route: "signupAdmin", message: err?.message });
      throw err;
    }
  },

  async signupPaciente(req, res) {
    try {
      const result = await usuariosService.signupPaciente(req.body, traceFromReq(req));
      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", { route: "signupPaciente", message: err?.message });
      throw err;
    }
  },

  async signupTerapeuta(req, res) {
    try {
      const result = await usuariosService.signupTerapeuta(req.body, traceFromReq(req));
      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", { route: "signupTerapeuta", message: err?.message });
      throw err;
    }
  },

  async verifyAuthPin(req, res) {
    try {
      const result = await usuariosService.verifyAuthPin(req.body, traceFromReq(req));
      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", { route: "verifyAuthPin", message: err?.message });
      throw err;
    }
  },

    async requestNewAuthPin(req, res) {
    try {
      const body = req.body || {};
      const p_email = body.p_email;

      if (!p_email) {
        return res.status(400).json({
          ok: false,
          error: "MISSING_PARAM",
          message: "Falta p_email",
        });
      }

      const result = await usuariosService.requestNewAuthPin(
        { p_email },
        traceFromReq(req)
      );

      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", {
        route: "requestNewAuthPin",
        message: err?.message,
      });
      throw err;
    }
  },

  async updatePacienteFull(req, res) {
    try {
      const userId = resolveUserId(req);
      if (!userId) {
        return res.status(400).json({
          ok: false,
          error: "BAD_REQUEST",
          message: "user_id inválido o faltante (envía /paciente/:user_id o incluye p_user_id en el body)",
        });
      }

      const payload = { ...req.body, p_user_id: userId };
      const result = await usuariosService.updatePacienteFull(payload, traceFromReq(req));
      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", { route: "updatePacienteFull", message: err?.message });
      throw err;
    }
  },

  async updateTerapeutaFull(req, res) {
    try {
      const userId = resolveUserId(req);
      if (!userId) {
        return res.status(400).json({
          ok: false,
          error: "BAD_REQUEST",
          message: "user_id inválido o faltante (envía /terapeuta/:user_id o incluye p_user_id en el body)",
        });
      }

      const payload = { ...req.body, p_user_id: userId };
      const result = await usuariosService.updateTerapeutaFull(payload, traceFromReq(req));
      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", { route: "updateTerapeutaFull", message: err?.message });
      throw err;
    }
  },

  async getTerapeutasSinAdminActivo(req, res) {
      try {
      const result = await usuariosService.getTerapeutasSinAdminActivo(traceFromReq(req));
      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", { route: "getTerapeutasSinAdminActivo", message: err?.message });
      throw err;
    }
  },
  
  async superSetUsuarioEstado(req, res) {
    try {
      const payload = { ...req.body, p_target_user_id: Number(req.params.user_id) };
      const result = await usuariosService.superSetUsuarioEstado(payload, traceFromReq(req));
      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", { route: "superSetUsuarioEstado", message: err?.message });
      throw err;
    }
  },

  async superListarUsuariosEstado(req, res) {
    try {
      const payload = { ...req.body };
      if (req.query.limit !== undefined) payload.p_limit = Number(req.query.limit);

      const result = await usuariosService.superListarUsuariosEstado(payload, traceFromReq(req));
      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", { route: "superListarUsuariosEstado", message: err?.message });
      throw err;
    }
  },

  async obtenerUsuarioTerapeuta(req, res) {
    try {
      const payload = { ...req.body };
      if (req.query.limit !== undefined) payload.p_limit = Number(req.query.limit);

      const result = await usuariosService.obtenerUsuarioTerapeuta(payload, traceFromReq(req));
      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", { route: "obtenerUsuarioTerapeuta", message: err?.message });
      throw err;
    }
  },

  async obtenerUsuarioAdmin(req, res) {
    try {
      const payload = { ...req.body };
      if (req.query.limit !== undefined) payload.p_limit = Number(req.query.limit);

      const result = await usuariosService.obtenerUsuarioAdmin(payload, traceFromReq(req));
      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", { route: "obtenerUsuarioAdmin", message: err?.message });
      throw err;
    }
  },
  
  async requestPasswordRecoveryPin(req, res) {
    try {
      const result = await usuariosService.requestPasswordRecoveryPin(req.body, traceFromReq(req));
      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", { route: "requestPasswordRecoveryPin", message: err?.message });
      throw err;
    }
  },

  async updatePasswordRecovery(req, res) {
    try {
      const body = req.body || {};
      const p_email = body.p_email;
      const p_password = body.p_password;

      if (!p_email) {
        return res.status(400).json({ ok: false, error: "MISSING_PARAM", message: "Falta p_email" });
      }
      if (!p_password) {
        return res.status(400).json({ ok: false, error: "MISSING_PARAM", message: "Falta p_password" });
      }

      const result = await usuariosService.updatePasswordRecovery({ p_email, p_password }, traceFromReq(req));
      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", { route: "updatePasswordRecovery", message: err?.message });
      throw err;
    }
  },
 async actualizarUsuarioArchivoConArchivo(req, res) {
    try {
      const args = parseJsonMaybe(req.body?.args, req.body || {});
      const meta = parseJsonMaybe(req.body?.meta, {});

      const file = req.file;

      const result = await usuariosService.actualizarUsuarioArchivoConArchivo(
        args,
        { ...traceFromReq(req), ...meta },
        file
      );

      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", { route: "actualizarUsuarioArchivoConArchivo", message: err?.message });
      throw err;
    }
  },
  
  async updateTerapeutaFullConArchivo(req, res) {
    try {
      // multipart: args/meta vienen como strings
      const args = parseJsonMaybe(req.body?.args, req.body || {});
      const meta = parseJsonMaybe(req.body?.meta, {});

      // forzamos el user_id desde la URL (igual que tu updateTerapeutaFull)
      args.p_user_id = Number(req.params.user_id);

      const file = req.file;

      const result = await usuariosService.updateTerapeutaFullConArchivo(
        args,
        { ...traceFromReq(req), ...meta },
        file
      );

      return res.json(result);
    } catch (err) {
      console.error("[controller:error]", { route: "updateTerapeutaFullConArchivo", message: err?.message });
      throw err;
    }
  },

};

module.exports = { usuariosController };
