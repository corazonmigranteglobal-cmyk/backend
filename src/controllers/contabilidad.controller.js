const { contabilidadService } = require("../services/contabilidad.service.js");

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

const contabilidadController = {
  // ===== GRUPOS DE CUENTA =====
  listarGruposCuenta: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      return res.json(await contabilidadService.listarGruposCuenta(args, meta));
    } catch (err) {
      wrapError("contabilidadController.listarGruposCuenta", err);
    }
  },

  crearGrupoCuenta: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      return res.json(await contabilidadService.crearGrupoCuenta(args, meta));
    } catch (err) {
      wrapError("contabilidadController.crearGrupoCuenta", err);
    }
  },

  editarGrupoCuenta: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      return res.json(await contabilidadService.editarGrupoCuenta(args, meta));
    } catch (err) {
      wrapError("contabilidadController.editarGrupoCuenta", err);
    }
  },

  // ===== CUENTAS =====
  listarCuentas: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      return res.json(await contabilidadService.listarCuentas(args, meta));
    } catch (err) {
      wrapError("contabilidadController.listarCuentas", err);
    }
  },

  crearCuenta: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      return res.json(await contabilidadService.crearCuenta(args, meta));
    } catch (err) {
      wrapError("contabilidadController.crearCuenta", err);
    }
  },

  editarCuenta: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      return res.json(await contabilidadService.editarCuenta(args, meta));
    } catch (err) {
      wrapError("contabilidadController.editarCuenta", err);
    }
  },

  // ===== CENTROS DE COSTO =====
  listarCentrosCosto: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      return res.json(await contabilidadService.listarCentrosCosto(args, meta));
    } catch (err) {
      wrapError("contabilidadController.listarCentrosCosto", err);
    }
  },

  crearCentroCosto: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      return res.json(await contabilidadService.crearCentroCosto(args, meta));
    } catch (err) {
      wrapError("contabilidadController.crearCentroCosto", err);
    }
  },

  editarCentroCosto: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      return res.json(await contabilidadService.editarCentroCosto(args, meta));
    } catch (err) {
      wrapError("contabilidadController.editarCentroCosto", err);
    }
  },

  // ===== TRANSACCIONES =====
  listarTransacciones: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      return res.json(await contabilidadService.listarTransacciones(args, meta));
    } catch (err) {
      wrapError("contabilidadController.listarTransacciones", err);
    }
  },

  crearTransaccionesBatch: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      return res.json(await contabilidadService.crearTransaccionesBatch(args, meta));
    } catch (err) {
      wrapError("contabilidadController.crearTransaccionesBatch", err);
    }
  },
    // ===== GRUPOS DE CUENTA =====

  listarGruposCuenta: async (req, res) => {
    const { args, meta } = pickArgsMeta(req);
    const out = await contabilidadService.listarGruposCuenta(args, meta);
    return res.json(out);
  },

  crearGrupoCuenta: async (req, res) => {
    const { args, meta } = pickArgsMeta(req);
    const out = await contabilidadService.crearGrupoCuenta(args, meta);
    return res.json(out);
  },

  editarGrupoCuenta: async (req, res) => {
    const { args, meta } = pickArgsMeta(req);
    const out = await contabilidadService.editarGrupoCuenta(args, meta);
    return res.json(out);
  },

  apagarGrupoCuenta: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      return res.json(await contabilidadService.apagarGrupoCuenta(args, meta));
    } catch (err) {
      wrapError("contabilidadController.apagarGrupoCuenta", err);
    }
  },

  apagarCuenta: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      return res.json(await contabilidadService.apagarCuenta(args, meta));
    } catch (err) {
      wrapError("contabilidadController.apagarCuenta", err);
    }
  },

  apagarCentroCosto: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      return res.json(await contabilidadService.apagarCentroCosto(args, meta));
    } catch (err) {
      wrapError("contabilidadController.apagarCentroCosto", err);
    }
  },

  apagarTransaccion: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      return res.json(await contabilidadService.apagarTransaccion(args, meta));
    } catch (err) {
      wrapError("contabilidadController.apagarTransaccion", err);
    }
  },
};

module.exports = { contabilidadController };
