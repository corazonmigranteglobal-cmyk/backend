// timezone.service.js (CommonJS)
// Resuelve zona horaria IANA desde (pais, ciudad) con cache en DB.

const https = require("https");
const tzLookup = require("tz-lookup");
const { geoTimezoneRepository } = require("../repository/geo_timezone.repository");

function norm(s) {
  return String(s || "").trim();
}

function httpGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data || "null");
          resolve({ statusCode: res.statusCode, json });
        } catch (e) {
          reject(new Error(`Respuesta no-JSON desde ${url}: ${e.message}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error(`Timeout consultando ${url}`));
    });
  });
}

async function resolveTimeZoneFromCityCountry({ pais, ciudad }, trace = {}) {
  const country = norm(pais);
  const city = norm(ciudad);

  if (!country || !city) {
    return { time_zone: null, source: "missing_city_or_country" };
  }

  // 1) cache DB
  const cached = await geoTimezoneRepository.cacheGet(
    { p_pais: country, p_ciudad: city },
    trace
  );

  const row = cached?.rows?.[0];
  if (row?.time_zone) {
    return {
      time_zone: row.time_zone,
      lat: row.lat ?? null,
      lon: row.lon ?? null,
      source: "db_cache",
    };
  }

  // 2) servicio: Nominatim (OSM) => lat/lon
  const base = process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
  const q = encodeURIComponent(`${city}, ${country}`);
  const url = `${base}/search?format=json&limit=1&q=${q}`;

  // Nominatim pide User-Agent válido
  const ua = process.env.NOMINATIM_USER_AGENT || "corazon-migrante/1.0 (timezone-resolver)";

  const { statusCode, json } = await httpGetJson(url, {
    "User-Agent": ua,
    "Accept": "application/json",
  });

  if (statusCode < 200 || statusCode >= 300) {
    return { time_zone: null, source: `nominatim_http_${statusCode || "err"}` };
  }

  const first = Array.isArray(json) ? json[0] : null;
  const lat = first ? Number(first.lat) : NaN;
  const lon = first ? Number(first.lon) : NaN;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { time_zone: null, source: "nominatim_no_result" };
  }

  // 3) tz-lookup offline => IANA
  let timeZone;
  try {
    timeZone = tzLookup(lat, lon);
  } catch (e) {
    return { time_zone: null, lat, lon, source: `tz_lookup_error:${e.message}` };
  }

  // 4) upsert cache
  await geoTimezoneRepository.cacheUpsert(
    {
      p_pais: country,
      p_ciudad: city,
      p_time_zone: timeZone,
      p_lat: lat,
      p_lon: lon,
      p_provider: "nominatim+tz-lookup",
    },
    trace
  );

  return { time_zone: timeZone, lat, lon, source: "nominatim+tz-lookup" };
}

module.exports = { resolveTimeZoneFromCityCountry };
