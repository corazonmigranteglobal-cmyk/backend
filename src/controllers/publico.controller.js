const { publicoService } = require("../services/publico.service.js");

function pickArgsMeta(req) {
  const body = req.body || {};
  const args = body.args ?? body;
  const meta = body.meta ?? {};
  return { args, meta };
}

function wrapError(scope, err, extra = {}) {
  const e = new Error(`[${scope}] ${err.message}`);
  e.cause = err;
  e.extra = extra;
  throw e;
}

function parseJsonMaybe(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return fallback;

  const s = value.trim();
  if (!s) return fallback;

  try {
    return JSON.parse(s);
  } catch (_) {
    return fallback;
  }
}

const publicoController = {
  listarElementosUi: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await publicoService.listarElementosUi(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("publicoController.listarElementosUi", err);
    }
  },

  obtenerElementoUi: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await publicoService.obtenerElementoUi(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("publicoController.obtenerElementoUi", err);
    }
  },

  crearElementoUi: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await publicoService.crearElementoUi(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("publicoController.crearElementoUi", err);
    }
  },

  actualizarElementoUi: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await publicoService.actualizarElementoUi(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("publicoController.actualizarElementoUi", err);
    }
  },

  listarServidoresArchivos: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await publicoService.listarServidoresArchivos(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("publicoController.listarServidoresArchivos", err);
    }
  },

  uiBootstrap: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await publicoService.uiBootstrap(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("publicoController.uiBootstrap", err);
    }
  },
  apagarElementoUi: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await publicoService.apagarElementoUi(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("publicoController.apagarElementoUi", err);
    }
  },

    listarPaginasUi: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await publicoService.listarPaginasUi(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("publicoController.listarPaginasUi", err);
    }
  },

  obtenerPaginaUi: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await publicoService.obtenerPaginaUi(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("publicoController.obtenerPaginaUi", err);
    }
  },

  crearPaginaUi: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await publicoService.crearPaginaUi(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("publicoController.crearPaginaUi", err);
    }
  },

  actualizarPaginaUi: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await publicoService.actualizarPaginaUi(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("publicoController.actualizarPaginaUi", err);
    }
  },

  apagarPaginaUi: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await publicoService.apagarPaginaUi(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("publicoController.apagarPaginaUi", err);
    }
  },
  actualizarElementoUiConArchivo: async (req, res) => {
    try {
      const body = req.body || {};

      const args =
        parseJsonMaybe(body.args, null) ??
        parseJsonMaybe(body.payload, null) ??
        body;

      const meta = parseJsonMaybe(body.meta, {}) ?? {};

      const result = await publicoService.actualizarElementoUiConArchivo(args, meta, req.file);
      return res.json(result);
    } catch (err) {
      wrapError("publicoController.actualizarElementoUiConArchivo", err);
    }
  },
};

module.exports = { publicoController };
