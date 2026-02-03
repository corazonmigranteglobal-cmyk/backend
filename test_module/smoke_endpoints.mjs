#!/usr/bin/env node
/**
 * Smoke test - Corazón Migrante backend
 *
 * Ejecutar:
 *   node test_module/smoke_endpoints.mjs
 * o:
 *   npm run smoke
 *
 * ENV opcionales:
 *   BASE_URL=http://localhost:3003
 *   API_KEY=... (x-api-key para /api/email/* y /api/files/*)
 *
 * Recomendado para evitar "ACCOUNT_NOT_ACTIVE":
 *   SMOKE_ADMIN_EMAIL=wf_admin_2@example.com
 *   SMOKE_ADMIN_PASSWORD=TU_PASSWORD_REAL
 */

import http from "http";
import https from "https";
import { URL } from "url";
import crypto from "crypto";

// ===== Config =====
const BASE_URL = process.env.BASE_URL || "http://localhost:3003";
const API_KEY = process.env.API_KEY || process.env.EMAIL_SEND_API_KEY || ""; // compat
const REQUEST_ID = crypto.randomUUID();

const SMOKE_ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || "";
const SMOKE_ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || "";

// Timeouts
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

// ===== Helpers HTTP =====
function httpClientFor(urlObj) {
  return urlObj.protocol === "https:" ? https : http;
}

function normalizeJson(x) {
  try {
    return typeof x === "string" ? JSON.parse(x) : x;
  } catch {
    return x;
  }
}

function stringifyErr(e) {
  if (!e) return "unknown error";
  // AggregateError (Node fetch / multi connect) etc.
  if (e?.name === "AggregateError" && Array.isArray(e?.errors)) {
    return `AggregateError: ${e.errors.map((er) => er?.message || String(er)).join(" | ")}`;
  }
  return e?.message ? `${e.name || "Error"}: ${e.message}` : String(e);
}

function requestJson({ method, path, body, headers = {} }) {
  return new Promise((resolve) => {
    const urlObj = new URL(path, BASE_URL);
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body), "utf8");

    const req = httpClientFor(urlObj).request(
      urlObj,
      {
        method,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-request-id": REQUEST_ID,
          ...(data ? { "content-length": String(data.length) } : {}),
          ...headers,
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          const parsed = normalizeJson(raw);
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
            raw,
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`));
    });

    req.on("error", (err) => {
      resolve({
        ok: false,
        status: 0,
        headers: {},
        body: { error: stringifyErr(err) },
        raw: "",
      });
    });

    if (data) req.write(data);
    req.end();
  });
}

/**
 * Multipart para /api/files/upload-at-path (multer)
 * - fields: targetPath, contentType
 * - file: "file"
 */
function requestMultipartUpload({ path, apiKey, targetPath, contentType, filename, fileBuffer }) {
  return new Promise((resolve) => {
    const urlObj = new URL(path, BASE_URL);
    const boundary = "----NodeBoundary" + crypto.randomBytes(12).toString("hex");

    const parts = [];

    function pushField(name, value) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
            `${value}\r\n`,
          "utf8"
        )
      );
    }

    function pushFile(name, filename_, ctype, buf) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${name}"; filename="${filename_}"\r\n` +
            `Content-Type: ${ctype}\r\n\r\n`,
          "utf8"
        )
      );
      parts.push(buf);
      parts.push(Buffer.from("\r\n", "utf8"));
    }

    pushField("targetPath", targetPath);
    pushField("contentType", contentType);
    pushFile("file", filename, contentType, fileBuffer);
    parts.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));

    const body = Buffer.concat(parts);

    const req = httpClientFor(urlObj).request(
      urlObj,
      {
        method: "POST",
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          "content-length": String(body.length),
          "x-request-id": REQUEST_ID,
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          const parsed = normalizeJson(raw);
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
            raw,
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`));
    });

    req.on("error", (err) => {
      resolve({
        ok: false,
        status: 0,
        headers: {},
        body: { error: stringifyErr(err) },
        raw: "",
      });
    });

    req.write(body);
    req.end();
  });
}

// ===== Mock generator (basado en DB_FUNCTIONS) =====
function randSuffix() {
  return crypto.randomBytes(3).toString("hex");
}

function mockValueByType(pgType, name) {
  const t = String(pgType || "").toLowerCase().trim();
  const suf = randSuffix();

  if (t === "text" || t.includes("varchar") || t.includes("character varying")) {
    if (String(name).toLowerCase().includes("email")) return `test_${suf}@example.com`;
    if (String(name).toLowerCase().includes("telefono")) return `700${Math.floor(Math.random() * 1000000)}`.slice(0, 8);
    return `test_${name}_${suf}`;
  }

  if (t === "integer" || t === "int" || t === "int4") return 1;
  if (t === "bigint" || t === "int8") return 1;
  if (t === "numeric" || t === "decimal") return 100.5;
  if (t === "boolean" || t === "bool") return true;
  if (t === "date") return "1998-01-15";
  if (t.startsWith("timestamp")) return new Date().toISOString();
  if (t === "jsonb" || t === "json") return { mock: true, field: name, at: new Date().toISOString() };
  if (t === "interval") return "15 minutes";

  return `test_${name}_${suf}`;
}

async function buildArgsFromDbFunctions(fnName, overrides = {}) {
  const mod = await import(new URL("../src/config/db_functions.js", import.meta.url));
  const DB_FUNCTIONS = mod.DB_FUNCTIONS;

  const meta = DB_FUNCTIONS?.[fnName];
  if (!meta) throw new Error(`No existe meta para ${fnName} en src/config/db_functions.js`);

  const args = {};
  for (const p of meta.params) {
    if (!p.hasDefault) args[p.name] = mockValueByType(p.type, p.name);
  }
  for (const [k, v] of Object.entries(overrides)) args[k] = v;
  return args;
}

// ===== Runner =====
const results = [];

async function runStep(name, fn, { debugOnFail = true } = {}) {
  const started = Date.now();
  try {
    const res = await fn();
    const ms = Date.now() - started;

    results.push({ name, ok: res.ok, status: res.status, ms, body: res.body });

    if (res.ok) {
      console.log(`✅ ${name}  [${res.status}] (${ms} ms)`);
    } else {
      console.log(`❌ ${name}  [${res.status}] (${ms} ms)`);
      if (debugOnFail) {
        console.log("   ↳ response body:", typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2));
      }
    }
    return res;
  } catch (e) {
    const ms = Date.now() - started;
    const msg = stringifyErr(e);
    results.push({ name, ok: false, status: 0, ms, body: { error: msg } });
    console.log(`❌ ${name}  [ERROR] (${ms} ms)`);
    console.log("   ↳ exception:", msg);
    return { ok: false, status: 0, body: { error: msg } };
  }
}

// ===== Extractors (para respuestas estilo call_db) =====
function deepFind(obj, keys) {
  if (!obj || typeof obj !== "object") return null;

  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }

  if (obj.data) {
    const v = deepFind(obj.data, keys);
    if (v !== null) return v;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const v = deepFind(item, keys);
      if (v !== null) return v;
    }
  }

  for (const v of Object.values(obj)) {
    const found = deepFind(v, keys);
    if (found !== null) return found;
  }

  return null;
}

function getFnRow(body) {
  const rows = body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

function isFnOk(body) {
  const row = getFnRow(body);
  if (!body?.ok || !row) return false;
  const st = String(row.status || "").toLowerCase();
  return st === "ok" || st === "success";
}

function getFnError(body) {
  const row = getFnRow(body);
  if (!row) return { type_error: "NO_ROW", message: "No rows returned" };
  return {
    status: row.status,
    type_error: row.type_error,
    message: row.message,
    data: row.data,
  };
}

function getFnData(body) {
  const row = getFnRow(body);
  return row?.data ?? null;
}

function tryGetUserIdFromFn(body) {
  // a veces viene como data.user_id o data.id_usuario
  return deepFind(getFnData(body) ?? body, ["user_id", "id_usuario", "id", "p_user_id", "id_usuario_paciente", "id_usuario_terapeuta"]);
}

function tryGetSessionIdFromFn(body) {
  return deepFind(getFnData(body) ?? body, ["id_sesion", "session_id", "sesion_id", "idSesion", "idSession"]);
}

// ===== Main =====
(async function main() {
  console.log("=======================================");
  console.log("SMOKE TEST - Corazón Migrante Backend");
  console.log("BASE_URL:", BASE_URL);
  console.log("API_KEY:", API_KEY ? "(set)" : "(not set)");
  console.log("REQUEST_ID:", REQUEST_ID);
  console.log("ADMIN ENV:", SMOKE_ADMIN_EMAIL ? "(set)" : "(not set)");
  console.log("=======================================\n");

  // 1) Health (si falla, aborta temprano)
  const rHealth = await runStep("GET /health", () => requestJson({ method: "GET", path: "/health" }));
  if (!rHealth.ok) {
    throw new Error(`Backend no responde en ${BASE_URL}. Revisa que esté corriendo y el puerto.`);
  }

  // 2) Crear paciente (solo para tener user_id)
  const pacienteEmail = `paciente_${randSuffix()}@example.com`;
  const pacientePassword = `Pass_${randSuffix()}_123`;

  const signupPacienteArgs = await buildArgsFromDbFunctions("usuarios.fn_signup_paciente_with_verification_pin", {
    p_email: pacienteEmail,
    p_password: pacientePassword,
    p_nombre: "Paciente",
    p_apellido: "Prueba",
    p_telefono: "70000001",
    p_pais: "Bolivia",
    p_ciudad: "Santa Cruz",
    p_pin_contexto: "smoke_test",
    p_pin_metadata: { smoke: true },
  });

  const rSignupPaciente = await runStep("POST /api/usuarios/signup/paciente", () =>
    requestJson({ method: "POST", path: "/api/usuarios/signup/paciente", body: signupPacienteArgs })
  );

  if (!rSignupPaciente.ok || !rSignupPaciente.body?.ok) {
    throw new Error("Signup paciente falló a nivel HTTP/servidor.");
  }

  const pacienteUserId = tryGetUserIdFromFn(rSignupPaciente.body);
  if (!pacienteUserId) {
    console.log("DEBUG signup(paciente) body =", JSON.stringify(rSignupPaciente.body, null, 2));
    throw new Error("No pude extraer pacienteUserId del signup paciente");
  }

  // 3) Login paciente (puede fallar por ACCOUNT_NOT_ACTIVE; NO abortamos todo)
  const loginPacienteArgs = await buildArgsFromDbFunctions("usuarios.fn_login_password", {
    p_email: pacienteEmail,
    p_password: pacientePassword,
    p_tipo_login: "PASSWORD",
  });

  const rLoginPaciente = await runStep("POST /api/usuarios/login (paciente)", () =>
    requestJson({ method: "POST", path: "/api/usuarios/login", body: loginPacienteArgs })
  );

  let idSesionPaciente = null;
  if (isFnOk(rLoginPaciente.body)) {
    idSesionPaciente = tryGetSessionIdFromFn(rLoginPaciente.body);
  } else {
    const err = getFnError(rLoginPaciente.body);
    console.log("⚠️ Paciente login no OK (esto puede ser normal si queda Pendiente):", JSON.stringify(err, null, 2));
  }

  // 4) Crear terapeuta (para obtener user_id)
  const terapeutaEmail = `terapeuta_${randSuffix()}@example.com`;
  const terapeutaPassword = `Pass_${randSuffix()}_456`;

  const signupTerapeutaArgs = await buildArgsFromDbFunctions("usuarios.fn_signup_terapeuta_with_verification_pin", {
    p_email: terapeutaEmail,
    p_password: terapeutaPassword,
    p_nombre: "Terapeuta",
    p_apellido: "Prueba",
    p_telefono: "70000002",
    p_pais: "Bolivia",
    p_ciudad: "Santa Cruz",
    p_valor_sesion_base: 120.0,
    p_pin_contexto: "smoke_test",
    p_pin_metadata: { smoke: true },
  });

  const rSignupTerapeuta = await runStep("POST /api/usuarios/signup/terapeuta", () =>
    requestJson({ method: "POST", path: "/api/usuarios/signup/terapeuta", body: signupTerapeutaArgs })
  );

  const terapeutaUserId = tryGetUserIdFromFn(rSignupTerapeuta.body);
  if (!terapeutaUserId) {
    console.log("DEBUG signup(terapeuta) body =", JSON.stringify(rSignupTerapeuta.body, null, 2));
    throw new Error("No pude extraer terapeutaUserId del signup terapeuta");
  }

  // 5) Conseguir SESIÓN ADMIN (clave para el resto)
  let adminUserId = null;
  let idSesionAdmin = null;

  if (SMOKE_ADMIN_EMAIL && SMOKE_ADMIN_PASSWORD) {
    const loginAdminArgs = await buildArgsFromDbFunctions("usuarios.fn_login_password", {
      p_email: SMOKE_ADMIN_EMAIL,
      p_password: SMOKE_ADMIN_PASSWORD,
      p_tipo_login: "PASSWORD",
    });

    const rLoginAdmin = await runStep("POST /api/usuarios/login (admin existente)", () =>
      requestJson({ method: "POST", path: "/api/usuarios/login", body: loginAdminArgs })
    );

    if (!isFnOk(rLoginAdmin.body)) {
      const err = getFnError(rLoginAdmin.body);
      throw new Error(`Login admin falló: ${err?.type_error || "UNKNOWN"} - ${err?.message || ""}`);
    }

    adminUserId = tryGetUserIdFromFn(rLoginAdmin.body);
    idSesionAdmin = tryGetSessionIdFromFn(rLoginAdmin.body);

    if (!adminUserId || !idSesionAdmin) {
      console.log("DEBUG login(admin) body =", JSON.stringify(rLoginAdmin.body, null, 2));
      throw new Error("Login admin OK pero no encontré adminUserId o idSesionAdmin");
    }
  } else {
    // fallback: crear admin (PERO probablemente quedará Pendiente)
    const adminEmail = `admin_${randSuffix()}@example.com`;
    const adminPassword = `Pass_${randSuffix()}_789`;

    const signupAdminArgs = await buildArgsFromDbFunctions("usuarios.fn_signup_admin_with_verification_pin", {
      p_email: adminEmail,
      p_password: adminPassword,
      p_nombre: "Admin",
      p_apellido: "Prueba",
      p_is_super_admin: true,
      p_can_manage_files: true,
      p_is_accounter: true,
      p_pin_contexto: "smoke_test",
      p_pin_metadata: { smoke: true },
    });

    const rSignupAdmin = await runStep("POST /api/usuarios/signup/admin", () =>
      requestJson({ method: "POST", path: "/api/usuarios/signup/admin", body: signupAdminArgs })
    );

    adminUserId = tryGetUserIdFromFn(rSignupAdmin.body);

    const loginAdminArgs = await buildArgsFromDbFunctions("usuarios.fn_login_password", {
      p_email: adminEmail,
      p_password: adminPassword,
      p_tipo_login: "PASSWORD",
    });

    const rLoginAdmin = await runStep("POST /api/usuarios/login (admin creado)", () =>
      requestJson({ method: "POST", path: "/api/usuarios/login", body: loginAdminArgs })
    );

    if (isFnOk(rLoginAdmin.body)) {
      idSesionAdmin = tryGetSessionIdFromFn(rLoginAdmin.body);
    } else {
      const err = getFnError(rLoginAdmin.body);
      throw new Error(
        `No pude obtener sesión admin. Solución: setea SMOKE_ADMIN_EMAIL/SMOKE_ADMIN_PASSWORD con un admin Activo. Detalle: ${err?.type_error} - ${err?.message}`
      );
    }
  }

  // =========================
  // Terapia (usa sesión admin)
  // =========================
  const idSesion = idSesionAdmin;

  // ENFOQUES: listar
  const listarEnfoquesArgs = await buildArgsFromDbFunctions("terapia.fn_listar_enfoques", {
    p_actor_user_id: adminUserId,
    p_id_sesion: idSesion,
    p_limit: 10,
    p_offset: 0,
    p_only_activos: true,
  });

  await runStep("POST /api/terapia/enfoques/listar", () =>
    requestJson({ method: "POST", path: "/api/terapia/enfoques/listar", body: listarEnfoquesArgs })
  );

  // ENFOQUES: crear
  const crearEnfoqueArgs = await buildArgsFromDbFunctions("terapia.fn_crear_enfoque", {
    p_actor_user_id: adminUserId,
    p_id_sesion: idSesion,
    p_nombre: `Enfoque_${randSuffix()}`,
    p_descripcion: "Creado por smoke test",
    p_activo: true,
  });

  const rCrearEnfoque = await runStep("POST /api/terapia/enfoques/crear", () =>
    requestJson({ method: "POST", path: "/api/terapia/enfoques/crear", body: crearEnfoqueArgs })
  );

  const enfoqueId =
    deepFind(getFnData(rCrearEnfoque.body) ?? rCrearEnfoque.body, ["id_enfoque", "enfoque_id", "id"]) || 1;

  // ENFOQUES: update
  const updateEnfoqueArgs = await buildArgsFromDbFunctions("terapia.fn_update_enfoque", {
    p_actor_user_id: adminUserId,
    p_id_sesion: idSesion,
    p_id_enfoque: enfoqueId,
    p_nombre: `EnfoqueUpd_${randSuffix()}`,
    p_descripcion: "Actualizado por smoke test",
    p_activo: true,
  });

  await runStep("POST /api/terapia/enfoques/update", () =>
    requestJson({ method: "POST", path: "/api/terapia/enfoques/update", body: updateEnfoqueArgs })
  );

  // PRODUCTOS: listar
  const listarProductosArgs = await buildArgsFromDbFunctions("terapia.fn_listar_productos", {
    p_actor_user_id: adminUserId,
    p_id_sesion: idSesion,
    p_limit: 10,
    p_offset: 0,
    p_only_activos: true,
  });

  await runStep("POST /api/terapia/productos/listar", () =>
    requestJson({ method: "POST", path: "/api/terapia/productos/listar", body: listarProductosArgs })
  );

  // PRODUCTOS: crear
  const crearProductoArgs = await buildArgsFromDbFunctions("terapia.fn_crear_producto", {
    p_actor_user_id: adminUserId,
    p_id_sesion: idSesion,
    p_nombre: `Producto_${randSuffix()}`,
    p_descripcion: "Producto creado por smoke test",
    p_precio: 80.0,
    p_activo: true,
  });

  const rCrearProducto = await runStep("POST /api/terapia/productos/crear", () =>
    requestJson({ method: "POST", path: "/api/terapia/productos/crear", body: crearProductoArgs })
  );

  const productoId =
    deepFind(getFnData(rCrearProducto.body) ?? rCrearProducto.body, ["id_producto", "producto_id", "id"]) || 1;

  // PRODUCTOS: update
  const updateProductoArgs = await buildArgsFromDbFunctions("terapia.fn_update_producto", {
    p_actor_user_id: adminUserId,
    p_id_sesion: idSesion,
    p_id_producto: productoId,
    p_nombre: `ProductoUpd_${randSuffix()}`,
    p_descripcion: "Actualizado por smoke test",
    p_precio: 90.0,
    p_activo: true,
  });

  await runStep("POST /api/terapia/productos/update", () =>
    requestJson({ method: "POST", path: "/api/terapia/productos/update", body: updateProductoArgs })
  );

  // HORARIOS: obtener
  const obtenerHorariosArgs = await buildArgsFromDbFunctions("terapia.fn_obtener_horarios_terapeuta", {
    p_actor_user_id: adminUserId,
    p_id_sesion: idSesion,
    p_terapeuta_user_id: terapeutaUserId,
  });

  await runStep("POST /api/terapia/horarios/obtener", () =>
    requestJson({ method: "POST", path: "/api/terapia/horarios/obtener", body: obtenerHorariosArgs })
  );

  // CITAS: registrar (admin actor)
  const registrarCitaArgs = await buildArgsFromDbFunctions("terapia.fn_registrar_cita", {
    p_actor_user_id: adminUserId,
    p_id_sesion: idSesion,
    p_paciente_user_id: pacienteUserId,
    p_terapeuta_user_id: terapeutaUserId,
    p_fecha: "2026-01-06",
    p_hora_inicio: "10:00",
    p_hora_fin: "11:00",
    p_id_producto: productoId,
    p_motivo: "Cita creada por smoke test",
  });

  const rRegistrarCita = await runStep("POST /api/terapia/citas/registrar", () =>
    requestJson({ method: "POST", path: "/api/terapia/citas/registrar", body: registrarCitaArgs })
  );

  const citaId = deepFind(getFnData(rRegistrarCita.body) ?? rRegistrarCita.body, ["id_cita", "cita_id", "id"]) || 1;

  // ADMIN solicitudes
  const solicitudesArgs = await buildArgsFromDbFunctions("terapia.fn_listar_solicitudes_cita_admin", {
    p_actor_user_id: adminUserId,
    p_id_sesion: idSesion,
    p_limit: 10,
    p_offset: 0,
  });

  await runStep("POST /api/terapia/admin/citas/solicitudes/listar", () =>
    requestJson({ method: "POST", path: "/api/terapia/admin/citas/solicitudes/listar", body: solicitudesArgs })
  );

  // =========================
  // Email / Files (si hay API_KEY)
  // =========================
  await runStep("POST /api/email/send (simple)", () =>
    requestJson({
      method: "POST",
      path: "/api/email/send",
      headers: API_KEY ? { "x-api-key": API_KEY } : {},
      body: { to: "someone@example.com", message: "Mensaje de prueba desde smoke test" },
    })
  );

  const userIdForFiles = String(pacienteUserId);
  const testPathBase = `users/${userIdForFiles}/smoke_test/${Date.now()}`;

  await runStep("POST /api/files/users/:userId/ensure-folders", () =>
    requestJson({
      method: "POST",
      path: `/api/files/users/${userIdForFiles}/ensure-folders`,
      headers: API_KEY ? { "x-api-key": API_KEY } : {},
      body: {},
    })
  );

  const uploadTargetPath = `${testPathBase}/hello.txt`;
  await runStep("POST /api/files/upload-at-path (multipart)", () =>
    requestMultipartUpload({
      path: "/api/files/upload-at-path",
      apiKey: API_KEY,
      targetPath: uploadTargetPath,
      contentType: "text/plain",
      filename: "hello.txt",
      fileBuffer: Buffer.from("Hello from smoke test!", "utf8"),
    })
  );

  // ===== Reporte final =====
  console.log("\n=======================================");
  console.log("REPORTE FINAL");
  console.log("=======================================");
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  console.log(`Total: ${results.length} | OK: ${okCount} | FAIL: ${failCount}\n`);
  for (const r of results) {
    const status = r.status ? String(r.status).padStart(3, " ") : "ERR";
    console.log(`${r.ok ? "✅" : "❌"} [${status}] ${r.name} (${r.ms} ms)`);
  }

  console.log("\nNotas:");
  console.log("- Si email/files dan 401, setea API_KEY o EMAIL_SEND_API_KEY.");
  console.log("- Si login admin falla por inactive, usa un admin Activo via SMOKE_ADMIN_EMAIL/SMOKE_ADMIN_PASSWORD.");
  console.log("Fin.\n");
})().catch((e) => {
  console.error("\n💥 SMOKE TEST ABORTADO:", stringifyErr(e));
  process.exit(1);
});
