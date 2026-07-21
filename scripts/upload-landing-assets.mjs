#!/usr/bin/env node
/**
 * Sube las imágenes de la landing a Cloudinary usando las credenciales del
 * .env del BACKEND (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
 * CLOUDINARY_API_SECRET, CLOUDINARY_FOLDER).
 *
 * Uso (desde la raíz del backend, donde hay salida a internet):
 *   node scripts/upload-landing-assets.mjs
 *
 * Sube a la carpeta:  <CLOUDINARY_FOLDER>/landing_page/media/<nombre>
 * que es exactamente la ruta que la landing del frontend construye a partir de
 * NEXT_PUBLIC_FILE_SERVER_PUBLIC_ASSETS_BASE_URL.
 *
 * No requiere dependencias externas: firma la petición con el crypto nativo de
 * Node y sube vía fetch (Node >= 18).
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ASSETS_DIR = join(ROOT, "assets", "landing");

function loadEnv() {
  const out = {
    cloud: process.env.CLOUDINARY_CLOUD_NAME,
    key: process.env.CLOUDINARY_API_KEY,
    secret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER,
  };
  const envPath = join(ROOT, ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*(CLOUDINARY_[A-Z_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const v = m[2].trim().replace(/^["']|["']$/g, "");
      if (m[1] === "CLOUDINARY_CLOUD_NAME") out.cloud ||= v;
      if (m[1] === "CLOUDINARY_API_KEY") out.key ||= v;
      if (m[1] === "CLOUDINARY_API_SECRET") out.secret ||= v;
      if (m[1] === "CLOUDINARY_FOLDER") out.folder ||= v;
    }
  }
  out.folder ||= "corazon-migrante";
  return out;
}

async function uploadOne(file, cfg, targetFolder) {
  const publicId = basename(file, extname(file)); // p.ej. "carrusel-1"
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    folder: targetFolder,
    public_id: publicId,
    overwrite: "true",
    timestamp: String(timestamp),
  };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const signature = createHash("sha1").update(toSign + cfg.secret).digest("hex");

  const form = new FormData();
  const buf = readFileSync(join(ASSETS_DIR, file));
  form.append("file", new Blob([buf]), file);
  form.append("api_key", cfg.key);
  form.append("timestamp", String(timestamp));
  form.append("folder", targetFolder);
  form.append("public_id", publicId);
  form.append("overwrite", "true");
  form.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cfg.cloud}/image/upload`,
    { method: "POST", body: form },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || res.statusText);
  return json.secure_url;
}

async function main() {
  const cfg = loadEnv();
  if (!cfg.cloud || !cfg.key || !cfg.secret) {
    console.error(
      "Faltan credenciales CLOUDINARY_* en el .env del backend (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).",
    );
    process.exit(1);
  }
  if (!existsSync(ASSETS_DIR)) {
    console.error("No existe la carpeta de imágenes:", ASSETS_DIR);
    process.exit(1);
  }

  const targetFolder = `${cfg.folder}/landing_page/media`;
  console.log("Cloud:", cfg.cloud);
  console.log("Carpeta destino:", targetFolder);
  console.log("Origen:", ASSETS_DIR, "\n");

  const files = readdirSync(ASSETS_DIR).filter((f) =>
    /\.(webp|jpg|jpeg|png|avif)$/i.test(f),
  );
  const urls = {};
  for (const f of files) {
    try {
      urls[basename(f, extname(f))] = await uploadOne(f, cfg, targetFolder);
      console.log("OK  ", f);
    } catch (e) {
      console.error("FALLÓ", f, "-", e.message);
    }
  }

  console.log("\n=== URLs en Cloudinary ===");
  console.log(JSON.stringify(urls, null, 2));
  console.log(
    "\nLa landing ya construye estas URLs automáticamente a partir de\n" +
      "NEXT_PUBLIC_FILE_SERVER_PUBLIC_ASSETS_BASE_URL (…/" + cfg.folder + "). No hay que hacer nada más.",
  );
}

main();
