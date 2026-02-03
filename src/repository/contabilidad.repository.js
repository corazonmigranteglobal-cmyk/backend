const { call_db } = require("../core/db/call_db.cjs");

function wrapError(scope, err, extra = {}) {
  const e = new Error(`[${scope}] ${err.message}`);
  e.cause = err;
  e.extra = extra;
  throw e;
}

const contabilidadRepository = {
  // ===== GRUPO CUENTA =====
  listarGruposCuenta: async (args, meta) => {
    try {
      return await call_db({ fnName: "contabilidad.fn_listar_grupos_cuenta", args, meta });
    } catch (err) {
      wrapError("contabilidadRepository.listarGruposCuenta", err, { fn: "contabilidad.fn_listar_grupos_cuenta", args });
    }
  },

  crearGrupoCuenta: async (args, meta) => {
    try {
      return await call_db({ fnName: "contabilidad.fn_registrar_grupo_cuenta", args, meta });
    } catch (err) {
      wrapError("contabilidadRepository.crearGrupoCuenta", err, { fn: "contabilidad.fn_registrar_grupo_cuenta", args });
    }
  },

  editarGrupoCuenta: async (args, meta) => {
    try {
      return await call_db({ fnName: "contabilidad.fn_editar_grupo_cuenta", args, meta });
    } catch (err) {
      wrapError("contabilidadRepository.editarGrupoCuenta", err, { fn: "contabilidad.fn_editar_grupo_cuenta", args });
    }
  },

  // ===== CUENTA =====
  listarCuentas: async (args, meta) => {
    try {
      return await call_db({ fnName: "contabilidad.fn_listar_cuentas", args, meta });
    } catch (err) {
      wrapError("contabilidadRepository.listarCuentas", err, { fn: "contabilidad.fn_listar_cuentas", args });
    }
  },

  crearCuenta: async (args, meta) => {
    try {
      return await call_db({ fnName: "contabilidad.fn_registrar_cuenta", args, meta });
    } catch (err) {
      wrapError("contabilidadRepository.crearCuenta", err, { fn: "contabilidad.fn_registrar_cuenta", args });
    }
  },

  editarCuenta: async (args, meta) => {
    try {
      return await call_db({ fnName: "contabilidad.fn_editar_cuenta", args, meta });
    } catch (err) {
      wrapError("contabilidadRepository.editarCuenta", err, { fn: "contabilidad.fn_editar_cuenta", args });
    }
  },

  // ===== CENTRO COSTO =====
  listarCentrosCosto: async (args, meta) => {
    try {
      return await call_db({ fnName: "contabilidad.fn_listar_centros_costo", args, meta });
    } catch (err) {
      wrapError("contabilidadRepository.listarCentrosCosto", err, { fn: "contabilidad.fn_listar_centros_costo", args });
    }
  },

  crearCentroCosto: async (args, meta) => {
    try {
      return await call_db({ fnName: "contabilidad.fn_registrar_centro_costo", args, meta });
    } catch (err) {
      wrapError("contabilidadRepository.crearCentroCosto", err, { fn: "contabilidad.fn_registrar_centro_costo", args });
    }
  },

  editarCentroCosto: async (args, meta) => {
    try {
      return await call_db({ fnName: "contabilidad.fn_editar_centro_costo", args, meta });
    } catch (err) {
      wrapError("contabilidadRepository.editarCentroCosto", err, { fn: "contabilidad.fn_editar_centro_costo", args });
    }
  },

  // ===== TRANSACCIONES =====
  listarTransacciones: async (args, meta) => {
    try {
      return await call_db({ fnName: "contabilidad.fn_listar_transacciones", args, meta });
    } catch (err) {
      wrapError("contabilidadRepository.listarTransacciones", err, { fn: "contabilidad.fn_listar_transacciones", args });
    }
  },

  crearTransaccionesBatch: async (args, meta) => {
    try {
      const { p_transacciones, ...rest } = args || {};

      return await call_db({
        fnName: "contabilidad.fn_registrar_transacciones_batch",
        args: rest,
        bulk: { paramName: "p_transacciones", rows: p_transacciones || [] },
        meta,
      });
    } catch (err) {
      wrapError("contabilidadRepository.crearTransaccionesBatch", err, {
        fn: "contabilidad.fn_registrar_transacciones_batch",
        args,
      });
    }
  },
    // ===== GRUPOS CUENTA =====
  listarGruposCuenta: async (args, meta) => {
    return await call_db({ fnName: "contabilidad.fn_listar_grupos_cuenta", args, meta });
  },

  crearGrupoCuenta: async (args, meta) => {
    return await call_db({ fnName: "contabilidad.fn_registrar_grupo_cuenta", args, meta });
  },

  editarGrupoCuenta: async (args, meta) => {
    return await call_db({ fnName: "contabilidad.fn_editar_grupo_cuenta", args, meta });
  },

  apagarGrupoCuenta: async (args, meta) => {
    try {
      return await call_db({ fnName: "contabilidad.fn_apagar_grupo_cuenta", args, meta });
    } catch (err) {
      wrapError("contabilidadRepository.apagarGrupoCuenta", err, { fn: "contabilidad.fn_apagar_grupo_cuenta", args });
    }
  },

  apagarCuenta: async (args, meta) => {
    try {
      return await call_db({ fnName: "contabilidad.fn_apagar_cuenta", args, meta });
    } catch (err) {
      wrapError("contabilidadRepository.apagarCuenta", err, { fn: "contabilidad.fn_apagar_cuenta", args });
    }
  },

  apagarCentroCosto: async (args, meta) => {
    try {
      return await call_db({ fnName: "contabilidad.fn_apagar_centro_costo", args, meta });
    } catch (err) {
      wrapError("contabilidadRepository.apagarCentroCosto", err, { fn: "contabilidad.fn_apagar_centro_costo", args });
    }
  },

  apagarTransaccion: async (args, meta) => {
    try {
      return await call_db({ fnName: "contabilidad.fn_apagar_transaccion", args, meta });
    } catch (err) {
      wrapError("contabilidadRepository.apagarTransaccion", err, { fn: "contabilidad.fn_apagar_transaccion", args });
    }
  },

};

module.exports = { contabilidadRepository };
