const { call_db } = require("../core/db/call_db.cjs");

function wrapError(scope, err, extra = {}) {
  const e = new Error(`[${scope}] ${err.message}`);
  e.cause = err;
  e.extra = extra;
  throw e;
}

const publicoRepository = {
  listarElementosUi: async (args, meta) => {
    try {
      return await call_db({ fnName: "publico.fn_listar_elementos_ui", args, meta });
    } catch (err) {
      wrapError("publicoRepository.listarElementosUi", err, { fn: "publico.fn_listar_elementos_ui", args });
    }
  },

  obtenerElementoUi: async (args, meta) => {
    try {
      return await call_db({ fnName: "publico.fn_get_elemento_ui", args, meta });
    } catch (err) {
      wrapError("publicoRepository.obtenerElementoUi", err, { fn: "publico.fn_get_elemento_ui", args });
    }
  },

  crearElementoUi: async (args, meta) => {
    try {
      return await call_db({ fnName: "publico.fn_crear_elemento_ui", args, meta });
    } catch (err) {
      wrapError("publicoRepository.crearElementoUi", err, { fn: "publico.fn_crear_elemento_ui", args });
    }
  },

  actualizarElementoUi: async (args, meta) => {
    try {
      return await call_db({ fnName: "publico.fn_actualizar_elemento_ui", args, meta });
    } catch (err) {
      wrapError("publicoRepository.actualizarElementoUi", err, { fn: "publico.fn_actualizar_elemento_ui", args });
    }
  },

  listarServidoresArchivos: async (args, meta) => {
    try {
      return await call_db({ fnName: "infraestructura.fn_listar_servidor_archivos", args, meta });
    } catch (err) {
      wrapError("publicoRepository.listarServidoresArchivos", err, { fn: "infraestructura.fn_listar_servidor_archivos", args });
    }
  },

  uiBootstrap: async (args, meta) => {
    try {
      return await call_db({ fnName: "publico.fn_ui_bootstrap", args, meta });
    } catch (err) {
      wrapError("publicoRepository.uiBootstrap", err, { fn: "publico.fn_ui_bootstrap", args });
    }
  },
  
  apagarElementoUi: async (args, meta) => {
    try {
      return await call_db({ fnName: "publico.fn_apagar_elemento_ui", args, meta });
    } catch (err) {
      wrapError("publicoRepository.apagarElementoUi", err, { fn: "publico.fn_apagar_elemento_ui", args });
    }
  },
  listarPaginasUi: async (args, meta) => {
    try {
      return await call_db({ fnName: "publico.fn_listar_paginas_ui", args, meta });
    } catch (err) {
      wrapError("publicoRepository.listarPaginasUi", err, { fn: "publico.fn_listar_paginas_ui", args });
    }
  },

  obtenerPaginaUi: async (args, meta) => {
    try {
      return await call_db({ fnName: "publico.fn_get_pagina_ui", args, meta });
    } catch (err) {
      wrapError("publicoRepository.obtenerPaginaUi", err, { fn: "publico.fn_get_pagina_ui", args });
    }
  },

  crearPaginaUi: async (args, meta) => {
    try {
      return await call_db({ fnName: "publico.fn_crear_pagina_ui", args, meta });
    } catch (err) {
      wrapError("publicoRepository.crearPaginaUi", err, { fn: "publico.fn_crear_pagina_ui", args });
    }
  },

  actualizarPaginaUi: async (args, meta) => {
    try {
      return await call_db({ fnName: "publico.fn_actualizar_pagina_ui", args, meta });
    } catch (err) {
      wrapError("publicoRepository.actualizarPaginaUi", err, { fn: "publico.fn_actualizar_pagina_ui", args });
    }
  },

  apagarPaginaUi: async (args, meta) => {
    try {
      return await call_db({ fnName: "publico.fn_apagar_pagina_ui", args, meta });
    } catch (err) {
      wrapError("publicoRepository.apagarPaginaUi", err, { fn: "publico.fn_apagar_pagina_ui", args });
    }
  },

  getPaginaPublicaAssets: async (args, meta) => {
    try {
      return await call_db({ fnName: "publico.fn_get_pagina_publica_assets", args, meta });
    } catch (err) {
      wrapError("publicoRepository.getPaginaPublicaAssets", err, {
        fn: "publico.fn_get_pagina_publica_assets",
        args,
      });
    }
  },
};

module.exports = { publicoRepository };
