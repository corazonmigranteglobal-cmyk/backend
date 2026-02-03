const { call_db } = require("../core/db/call_db.cjs");

function wrapError(scope, err, extra = {}) {
  const e = new Error(`[${scope}] ${err.message}`);
  e.cause = err;
  e.extra = extra;
  throw e;
}

const terapiaRepository = {
  // ===== ENFOQUES =====
  listarEnfoques: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_listar_enfoques", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.listarEnfoques", err, { fn: "terapia.fn_listar_enfoques", args });
    }
  },

  crearEnfoque: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_crear_enfoque", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.crearEnfoque", err, { fn: "terapia.fn_crear_enfoque", args });
    }
  },

  updateEnfoque: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_update_enfoque", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.updateEnfoque", err, { fn: "terapia.fn_update_enfoque", args });
    }
  },

  setEnfoqueArchivo: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_enfoque_set_archivo", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.setEnfoqueArchivo", err, {
        fn: "terapia.fn_enfoque_set_archivo",
        args,
      });
    }
  },

  // ===== PRODUCTOS =====
  listarProductos: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_listar_productos", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.listarProductos", err, { fn: "terapia.fn_listar_productos", args });
    }
  },

  crearProducto: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_crear_producto", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.crearProducto", err, { fn: "terapia.fn_crear_producto", args });
    }
  },

  updateProducto: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_update_producto", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.updateProducto", err, { fn: "terapia.fn_update_producto", args });
    }
  },

  // ===== HORARIOS =====
  obtenerHorariosTerapeuta: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_obtener_horarios_terapeuta", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.obtenerHorariosTerapeuta", err, { fn: "terapia.fn_obtener_horarios_terapeuta", args });
    }
  },

  crearHorarioTerapeuta: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_crear_horario_terapeuta", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.crearHorarioTerapeuta", err, { fn: "terapia.fn_crear_horario_terapeuta", args });
    }
  },

  actualizarHorarioTerapeutaVersionado: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_actualizar_horario_terapeuta_versionado", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.actualizarHorarioTerapeutaVersionado", err, { fn: "terapia.fn_actualizar_horario_terapeuta_versionado", args });
    }
  },

  // ===== BLOQUEOS AGENDA =====
  crearBloqueoAgenda: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_crear_bloqueo_agenda", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.crearBloqueoAgenda", err, { fn: "terapia.fn_crear_bloqueo_agenda", args });
    }
  },

  // ===== CITAS =====
  registrarCita: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_registrar_cita", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.registrarCita", err, { fn: "terapia.fn_registrar_cita", args });
    }
  },

  actualizarDetalleCita: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_actualizar_detalle_cita", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.actualizarDetalleCita", err, { fn: "terapia.fn_actualizar_detalle_cita", args });
    }
  },

  actualizarEstadoCita: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_actualizar_estado_cita", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.actualizarEstadoCita", err, { fn: "terapia.fn_actualizar_estado_cita", args });
    }
  },

  // ===== ADMIN =====
  listarSolicitudesCitaAdmin: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_listar_solicitudes_cita_admin", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.listarSolicitudesCitaAdmin", err, { fn: "terapia.fn_listar_solicitudes_cita_admin", args });
    }
  },

  obtenerDisponibilidadHorarios: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.obtener_horarios_disponibles_2_semanas", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.obtenerDisponibilidadHorarios", err, { fn: "terapia.obtener_horarios_disponibles_2_semanas", args });
    }
  },

  obtenerProducto: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.api_producto_obtener", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.obtenerProducto", err, { fn: "terapia.api_producto_obtener", args });
    }
  },

    obtenerEnfoque: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.api_enfoque_obtener", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.obtenerEnfoque", err, { fn: "terapia.api_enfoque_obtener", args });
    }
  },

  
  // ===== BOOTSTRAPS =====
  
  bookingBootstrap: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_booking_bootstrap", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.bookingBootstrap", err, { fn: "terapia.fn_booking_bootstrap", args });
    }
  },

  bootstrapEnfoqueProducto: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_enfoque_producto_bootstrap", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.bootstrapEnfoqueProducto", err, {
        fn: "terapia.fn_enfoque_producto_bootstrap",
        args
      });
    }
  },
  apagarEnfoque: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_apagar_enfoque", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.apagarEnfoque", err, { fn: "terapia.fn_apagar_enfoque", args });
    }
  },

  apagarProducto: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_apagar_producto", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.apagarProducto", err, { fn: "terapia.fn_apagar_producto", args });
    }
  },

  apagarHorarioTerapeuta: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_apagar_horario_terapeuta", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.apagarHorarioTerapeuta", err, { fn: "terapia.fn_apagar_horario_terapeuta", args });
    }
  },

  apagarBloqueoAgenda: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_apagar_bloqueo_agenda", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.apagarBloqueoAgenda", err, { fn: "terapia.fn_apagar_bloqueo_agenda", args });
    }
  },
  apagarCita: async (args, meta) => {
    try {
      return await call_db({ fnName: "terapia.fn_apagar_cita", args, meta });
    } catch (err) {
      wrapError("terapiaRepository.apagarCita", err, { fn: "terapia.fn_apagar_cita", args });
    }
  },

};

module.exports = { terapiaRepository };
