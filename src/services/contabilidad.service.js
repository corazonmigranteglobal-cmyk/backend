const { contabilidadRepository } = require("../repository/contabilidad.repository.js");
const { redisReady, redisGetJson, redisSetJson } = require("../core/cache/redis.js");

function cacheKey(base, args) {
  const entries = Object.entries(args || {}).sort(([a], [b]) => a.localeCompare(b));
  const suffix = entries.map(([k, v]) => `${k}=${v === undefined ? "" : JSON.stringify(v)}`).join("&");
  return `${base}?${suffix}`;
}

async function getOrSet(baseKey, args, ttlSeconds, getter) {
  try {
    if (redisReady()) {
      const k = cacheKey(baseKey, args);
      const cached = await redisGetJson(k);
      if (cached) return cached;

      const fresh = await getter();
      if (fresh && fresh.ok) await redisSetJson(k, fresh, ttlSeconds);
      return fresh;
    }
  } catch (e) {
    console.warn("[contabilidad.service:cache_warn]", e?.message || String(e));
  }
  return getter();
}

const contabilidadService = {
  // ===== GRUPOS DE CUENTA =====
  listarGruposCuenta: async (args, meta) =>
    getOrSet("contabilidad:grupos_cuenta:listar", args, 15, () =>
      contabilidadRepository.listarGruposCuenta(args, meta)
    ),

  crearGrupoCuenta: async (args, meta) => contabilidadRepository.crearGrupoCuenta(args, meta),
  editarGrupoCuenta: async (args, meta) => contabilidadRepository.editarGrupoCuenta(args, meta),

  // ===== CUENTAS =====
  listarCuentas: async (args, meta) =>
    getOrSet("contabilidad:cuentas:listar", args, 15, () =>
      contabilidadRepository.listarCuentas(args, meta)
    ),

  crearCuenta: async (args, meta) => contabilidadRepository.crearCuenta(args, meta),
  editarCuenta: async (args, meta) => contabilidadRepository.editarCuenta(args, meta),

  // ===== CENTROS COSTO =====
  listarCentrosCosto: async (args, meta) =>
    getOrSet("contabilidad:centros_costo:listar", args, 15, () =>
      contabilidadRepository.listarCentrosCosto(args, meta)
    ),

  crearCentroCosto: async (args, meta) => contabilidadRepository.crearCentroCosto(args, meta),
  editarCentroCosto: async (args, meta) => contabilidadRepository.editarCentroCosto(args, meta),

   // ===== GRUPOS CUENTA =====
  listarGruposCuenta: async (args, meta) =>
    getOrSet("contabilidad:grupos_cuenta:listar", args, 15, () =>
      contabilidadRepository.listarGruposCuenta(args, meta)
    ),

  crearGrupoCuenta: async (args, meta) =>
    contabilidadRepository.crearGrupoCuenta(args, meta),

  editarGrupoCuenta: async (args, meta) =>
    contabilidadRepository.editarGrupoCuenta(args, meta),

  // ===== TRANSACCIONES =====
  listarTransacciones: async (args, meta) =>
    getOrSet("contabilidad:transacciones:listar", args, 5, () =>
      contabilidadRepository.listarTransacciones(args, meta)
    ),

  crearTransaccionesBatch: async (args, meta) => contabilidadRepository.crearTransaccionesBatch(args, meta),

  apagarGrupoCuenta: async (args, meta) => contabilidadRepository.apagarGrupoCuenta(args, meta),
  apagarCuenta: async (args, meta) => contabilidadRepository.apagarCuenta(args, meta),
  apagarCentroCosto: async (args, meta) => contabilidadRepository.apagarCentroCosto(args, meta),
  apagarTransaccion: async (args, meta) => contabilidadRepository.apagarTransaccion(args, meta),

};

module.exports = { contabilidadService };
