// geo_timezone.repository.js (CommonJS)
// Cache de zona horaria por (pais, ciudad) en DB.

const { call_db } = require("../core/db/call_db.cjs");

function wrapError(scope, err, extra = {}) {
  const e = new Error(`[${scope}] ${err.message}`);
  e.cause = err;
  e.extra = extra;
  throw e;
}

const geoTimezoneRepository = {
  /**
   * Obtiene cache por país/ciudad (case-insensitive, se normaliza en SQL).
   * @returns {Promise<{ok:boolean, rows:any[]}>}
   */
  cacheGet: async (args, meta) => {
    try {
      return await call_db({ fnName: "usuarios.fn_geo_timezone_cache_get", args, meta });
    } catch (err) {
      wrapError("geoTimezoneRepository.cacheGet", err, {
        fn: "usuarios.fn_geo_timezone_cache_get",
        args,
      });
    }
  },

  /**
   * Upsert cache por país/ciudad.
   */
  cacheUpsert: async (args, meta) => {
    try {
      return await call_db({ fnName: "usuarios.fn_geo_timezone_cache_upsert", args, meta });
    } catch (err) {
      wrapError("geoTimezoneRepository.cacheUpsert", err, {
        fn: "usuarios.fn_geo_timezone_cache_upsert",
        args,
      });
    }
  },
};

module.exports = { geoTimezoneRepository };
