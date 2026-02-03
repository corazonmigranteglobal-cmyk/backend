const { terapiaService } = require("../services/terapia.service.js");

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

const terapiaController = {
  // ===== ENFOQUES =====
  listarEnfoques: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.listarEnfoques(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.listarEnfoques", err);
    }
  },

  crearEnfoque: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.crearEnfoque(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.crearEnfoque", err);
    }
  },

  updateEnfoque: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.updateEnfoque(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.updateEnfoque", err);
    }
  },

  // ===== PRODUCTOS =====
  listarProductos: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.listarProductos(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.listarProductos", err);
    }
  },

  crearProducto: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.crearProducto(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.crearProducto", err);
    }
  },

  updateProducto: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.updateProducto(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.updateProducto", err);
    }
  },

  // ===== HORARIOS =====
  obtenerHorariosTerapeuta: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.obtenerHorariosTerapeuta(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.obtenerHorariosTerapeuta", err);
    }
  },

  crearHorarioTerapeuta: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.crearHorarioTerapeuta(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.crearHorarioTerapeuta", err);
    }
  },

  actualizarHorarioTerapeutaVersionado: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.actualizarHorarioTerapeutaVersionado(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.actualizarHorarioTerapeutaVersionado", err);
    }
  },

  // ===== BLOQUEOS AGENDA =====
  crearBloqueoAgenda: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.crearBloqueoAgenda(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.crearBloqueoAgenda", err);
    }
  },

  // ===== CITAS =====
  registrarCita: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.registrarCita(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.registrarCita", err);
    }
  },

  actualizarDetalleCita: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.actualizarDetalleCita(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.actualizarDetalleCita", err);
    }
  },

  // ===== ADMIN =====
  listarSolicitudesCitaAdmin: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.listarSolicitudesCitaAdmin(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.listarSolicitudesCitaAdmin", err);
    }
  },

  actualizarEstadoCita: async (req, res) => {
    try{
      const { args, meta} = pickArgsMeta(req); 
      const result  = await terapiaService.actualizarEstadoCita(args, meta);
      return res.json(result);
    } catch (err) {  
      wrapError("terapiaController.actualizarEstadoCita", err);
    }
  },

  
  obtenerDisponibilidadHorarios: async (req, res) => {
    try{
      const { args, meta} = pickArgsMeta(req); 
      const result  = await terapiaService.obtenerDisponibilidadHorarios(args, meta);
      return res.json(result);
    } catch (err) {  
      wrapError("terapiaController.obtenerDisponibilidadHorarios", err);
    }
  },

  obtenerProducto: async (req, res) => {
    try{
      const { args, meta} = pickArgsMeta(req); 
      const result  = await terapiaService.obtenerProducto(args, meta);
      return res.json(result);
    } catch (err) {  
      wrapError("terapiaController.obtenerProducto", err);
    }
  },
  
  obtenerEnfoque: async (req, res) => {
    try{
      const { args, meta} = pickArgsMeta(req); 
      const result  = await terapiaService.obtenerEnfoque(args, meta);
      return res.json(result);
    } catch (err) {  
      wrapError("terapiaController.obtenerEnfoque", err);
    }
  },


  bookingBootstrap: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.bookingBootstrap(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.bookingBootstrap", err);
    }
  },
  bootstrapEnfoqueProducto: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.bootstrapEnfoqueProducto(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.bootstrapEnfoqueProducto", err);
    }
  },
  apagarEnfoque: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.apagarEnfoque(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.apagarEnfoque", err);
    }
  },

  apagarProducto: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.apagarProducto(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.apagarProducto", err);
    }
  },

  apagarHorarioTerapeuta: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.apagarHorarioTerapeuta(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.apagarHorarioTerapeuta", err);
    }
  },

  apagarBloqueoAgenda: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.apagarBloqueoAgenda(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.apagarBloqueoAgenda", err);
    }
  },
  apagarCita: async (req, res) => {
    try {
      const { args, meta } = pickArgsMeta(req);
      const result = await terapiaService.apagarCita(args, meta);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.apagarCita", err);
    }
  },

  crearEnfoqueConArchivo: async (req, res) => {
    try {
      const body = req.body || {};

      const args =
        parseJsonMaybe(body.args, null) ??
        parseJsonMaybe(body.payload, null) ??
        body;

      const meta = parseJsonMaybe(body.meta, {}) ?? {};

      const result = await terapiaService.crearEnfoqueConArchivo(args, meta, req.file);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.crearEnfoqueConArchivo", err);
    }
  },

  updateEnfoqueConArchivo: async (req, res) => {
    try {
      const body = req.body || {};

      const args =
        parseJsonMaybe(body.args, null) ??
        parseJsonMaybe(body.payload, null) ??
        body;

      const meta = parseJsonMaybe(body.meta, {}) ?? {};

      const result = await terapiaService.updateEnfoqueConArchivo(args, meta, req.file);
      return res.json(result);
    } catch (err) {
      wrapError("terapiaController.updateEnfoqueConArchivo", err);
    }
  },
};

module.exports = { terapiaController };
