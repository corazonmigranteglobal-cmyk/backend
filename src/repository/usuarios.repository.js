// usuarios.repository.js (CommonJS)
const { call_db } = require("../core/db/call_db.cjs");

// Función helper para estandarizar errores (igual que en tu otro repo)
function wrapError(scope, err, extra = {}) {
  const e = new Error(`[${scope}] ${err.message}`);
  e.cause = err;
  e.extra = extra;
  throw e;
}

const usuariosRepository = {

  loginPassword: async (args, meta) => {
    try {
      return await call_db({ fnName: "usuarios.fn_login_password", args, meta });
    } catch (err) {
      wrapError("usuariosRepository.loginPassword", err, { fn: "usuarios.fn_login_password", args });
    }
  },

  signupAdmin: async (args, meta) => {
    try {
      return await call_db({
        fnName: "usuarios.fn_signup_admin_with_verification_pin",
        args,
        meta,
      });
    } catch (err) {
      wrapError("usuariosRepository.signupAdmin", err, { fn: "usuarios.fn_signup_admin_with_verification_pin", args });
    }
  },

  signupPaciente: async (args, meta) => {
    try {
      return await call_db({
        fnName: "usuarios.fn_signup_paciente_with_verification_pin",
        args,
        meta,
      });
    } catch (err) {
      wrapError("usuariosRepository.signupPaciente", err, { fn: "usuarios.fn_signup_paciente_with_verification_pin", args });
    }
  },

  signupTerapeuta: async (args, meta) => {
    try {
      return await call_db({
        fnName: "usuarios.fn_signup_terapeuta_with_verification_pin",
        args,
        meta,
      });
    } catch (err) {
      wrapError("usuariosRepository.signupTerapeuta", err, { fn: "usuarios.fn_signup_terapeuta_with_verification_pin", args });
    }
  },

  verifyAuthPin: async (args, meta) => {
    try {
      return await call_db({ fnName: "seguridad.fn_verificar_auth_pin", args, meta });
    } catch (err) {
      wrapError("usuariosRepository.verifyAuthPin", err, { fn: "seguridad.fn_verificar_auth_pin", args });
    }
  },

  requestNewAuthPin: async (args, meta) => {
    try {
      return await call_db({ fnName: "seguridad.fn_solicitar_nuevo_auth_pin", args, meta });
    } catch (err) {
      wrapError("usuariosRepository.requestNewAuthPin", err, { fn: "seguridad.fn_solicitar_nuevo_auth_pin", args });
    }
  },

  updatePacienteFull: async (args, meta) => {
    try {
      return await call_db({ fnName: "usuarios.fn_update_paciente_full", args, meta });
    } catch (err) {
      wrapError("usuariosRepository.updatePacienteFull", err, { fn: "usuarios.fn_update_paciente_full", args });
    }
  },

  updateTerapeutaFull: async (args, meta) => {
    try {
      return await call_db({ fnName: "usuarios.fn_update_terapeuta_full", args, meta });
    } catch (err) {
      wrapError("usuariosRepository.updateTerapeutaFull", err, { fn: "usuarios.fn_update_terapeuta_full", args });
    }
  },

  getTerapeutasSinAdminActivo: async (args, meta) => {
    try {
      return await call_db({
        fnName: "usuarios.api_get_terapeutas_sin_admin_activo",
        args,
        meta,
      });
    } catch (err) {
      wrapError("usuariosRepository.getTerapeutasSinAdminActivo", err, { fn: "usuarios.api_get_terapeutas_sin_admin_activo", args });
    }
  },

  superSetUsuarioEstado: async (args, meta) => {
    try {
      return await call_db({ fnName: "usuarios.fn_super_set_usuario_estado", args, meta });
    } catch (err) {
      wrapError("usuariosRepository.superSetUsuarioEstado", err, { fn: "usuarios.fn_super_set_usuario_estado", args });
    }
  },

  superListarUsuariosEstado: async (args, meta) => {
    try {
      return await call_db({ fnName: "usuarios.fn_super_listar_usuarios_estado", args, meta });
    } catch (err) {
      wrapError("usuariosRepository.superListarUsuariosEstado", err, { fn: "usuarios.fn_super_listar_usuarios_estado", args });
    }
  },

  obtenerUsuarioTerapeuta: async (args, meta) => {
    try {
      return await call_db({ fnName: "usuarios.api_usuario_terapeuta_obtener", args, meta });
    } catch (err) {
      wrapError("usuariosRepository.obtenerUsuarioTerapeuta", err, { fn: "usuarios.api_usuario_terapeuta_obtener", args });
    }
  },

  obtenerUsuarioAdmin: async (args, meta) => {
    try {
      return await call_db({ fnName: "usuarios.api_usuario_admin_obtener", args, meta });
    } catch (err) {
      wrapError("usuariosRepository.obtenerUsuarioAdmin", err, { fn: "usuarios.api_usuario_admin_obtener", args });
    }
  },
    requestPasswordRecoveryPin: async (args, meta) => {
    try {
      return await call_db({ fnName: "seguridad.fn_solicitar_pin_recuperacion_password", args, meta });
    } catch (err) {
      wrapError("usuariosRepository.requestPasswordRecoveryPin", err, { fn: "seguridad.fn_solicitar_pin_recuperacion_password", args });
    }
  },
  updatePasswordRecovery: async (args, meta) => {
    try {
      return await call_db({ fnName: "seguridad.fn_actualizar_password_recuperacion", args, meta });
    } catch (err) {
      wrapError("usuariosRepository.updatePasswordRecovery", err, {
        fn: "seguridad.fn_actualizar_password_recuperacion",
        args,
      });
    }
  },
  usuarioSetArchivo: async (args, meta) => {
    try {
      return await call_db({ fnName: "usuarios.fn_usuario_set_archivo", args, meta });
    } catch (err) {
      wrapError("usuariosRepository.usuarioSetArchivo", err, { fn: "usuarios.fn_usuario_set_archivo", args });
    }
  },



    archivoRegistrar: async (args, meta) => {
    try {
      return await call_db({ fnName: "infraestructura.fn_archivo_registrar", args, meta });
    } catch (err) {
      wrapError("usuariosRepository.archivoRegistrar", err, { fn: "infraestructura.fn_archivo_registrar", args });
    }
  },

};

module.exports = { usuariosRepository };