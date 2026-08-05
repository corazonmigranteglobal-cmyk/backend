#!/usr/bin/env node
/**
 * Descarga una copia de todos los archivos alojados en Cloudinary.
 *
 * Existe porque **el volcado de PostgreSQL no contiene los archivos**: la tabla
 * `files` guarda metadatos y el contenido vive en el proveedor. Restaurar la
 * base no los recupera, y aquí hay documentación clínica.
 *
 * Cloudinary no ofrece una copia gestionada en todos los planes, así que este
 * script hace lo que sí está siempre disponible: recorrer la Admin API,
 * descargar cada recurso a un directorio local y escribir un manifiesto con la
 * correspondencia entre `public_id` y archivo.
 *
 * Uso:
 *   node scripts/backup-cloudinary.mjs --out=./backup-archivos
 *   node scripts/backup-cloudinary.mjs --out=./backup-archivos --check
 *
 *   --check   No descarga: sólo lista lo que hay y lo contrasta con la base.
 *
 * Requiere `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y
 * `CLOUDINARY_API_SECRET`. Es reanudable: no vuelve a descargar lo que ya está
 * en el destino con el mismo tamaño.
 */
import 'dotenv/config';
import { Client } from 'pg';
import { mkdirSync, createWriteStream, existsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? '').split('=')[1];
const OUT = arg('out') ?? './backup-archivos';
const CHECK = process.argv.includes('--check');

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.error(
    'Faltan credenciales de Cloudinary. Se necesitan CLOUDINARY_CLOUD_NAME,\n' +
      'CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.',
  );
  process.exit(2);
}

// La Admin API usa autenticación básica con la clave y el secreto.
const auth = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
const TIMEOUT = Number(process.env.FILE_PROVIDER_TIMEOUT_MS ?? 30_000);

/**
 * Recorre un tipo de recurso completo.
 *
 * La Admin API pagina con cursor y limita a 500 por página; hay que seguir el
 * `next_cursor` hasta agotarlo o la copia quedaría truncada en silencio.
 */
async function listAll(resourceType) {
  const found = [];
  let cursor;

  do {
    const url = new URL(`https://api.cloudinary.com/v1_1/${cloudName}/resources/${resourceType}`);
    url.searchParams.set('max_results', '500');
    if (cursor) url.searchParams.set('next_cursor', cursor);

    const response = await fetch(url, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(TIMEOUT),
    });

    if (response.status === 404) return found; // Ese tipo no existe en la cuenta.
    if (!response.ok) {
      throw new Error(`Cloudinary HTTP ${response.status} al listar ${resourceType}`);
    }

    const payload = await response.json();
    for (const resource of payload.resources ?? []) {
      found.push({
        publicId: resource.public_id,
        resourceType: resource.resource_type,
        format: resource.format,
        bytes: resource.bytes,
        url: resource.secure_url,
        createdAt: resource.created_at,
      });
    }
    cursor = payload.next_cursor;
  } while (cursor);

  return found;
}

console.log(`Inventariando Cloudinary (${cloudName})…`);

const resources = [];
for (const type of ['image', 'video', 'raw']) {
  const batch = await listAll(type);
  if (batch.length) console.log(`  ${type}: ${batch.length}`);
  resources.push(...batch);
}

const totalBytes = resources.reduce((sum, r) => sum + (r.bytes ?? 0), 0);
console.log(
  `Total: ${resources.length} recursos, ${(totalBytes / 1024 / 1024).toFixed(1)} MB\n`,
);

// ---- Contraste con la base de datos ---------------------------------------
// Interesa en ambos sentidos: un metadato sin objeto sirve un enlace roto; un
// objeto sin metadato es almacenamiento que se paga y nadie referencia.
let orphanMetadata = [];
let orphanObjects = [];

if (process.env.DATABASE_HOST || process.env.DATABASE_URL) {
  const db = new Client(
    process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: process.env.DATABASE_HOST,
          port: Number(process.env.DATABASE_PORT ?? 5432),
          user: process.env.DATABASE_USER,
          password: process.env.DATABASE_PASSWORD,
          database: process.env.DATABASE_NAME,
          ssl:
            process.env.DATABASE_SSL === 'true'
              ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
              : undefined,
        },
  );
  await db.connect();
  const { rows } = await db.query(
    `SELECT object_key, original_name FROM files
     WHERE deleted_at IS NULL AND storage_provider = 'CLOUDINARY'`,
  );
  await db.end();

  const inCloudinary = new Set(resources.map((r) => r.publicId));
  const inDatabase = new Set(rows.map((r) => r.object_key));

  orphanMetadata = rows.filter((r) => !inCloudinary.has(r.object_key));
  orphanObjects = resources.filter((r) => !inDatabase.has(r.publicId));

  console.log(`Referenciados por la base: ${rows.length}`);
  console.log(`  Metadatos sin objeto: ${orphanMetadata.length}`);
  console.log(`  Objetos sin metadato: ${orphanObjects.length}\n`);
} else {
  console.log('Sin conexión a la base: se omite el contraste de coherencia.\n');
}

if (CHECK) {
  if (orphanMetadata.length) {
    console.log('METADATOS SIN OBJETO (la API servirá enlaces rotos):');
    for (const row of orphanMetadata.slice(0, 25)) {
      console.log(`  ${row.object_key}  ${row.original_name}`);
    }
    if (orphanMetadata.length > 25) console.log(`  … y ${orphanMetadata.length - 25} más`);
  }
  process.exit(orphanMetadata.length ? 1 : 0);
}

// ---- Descarga --------------------------------------------------------------
mkdirSync(OUT, { recursive: true });

let downloaded = 0;
let skipped = 0;
const failed = [];

for (const resource of resources) {
  // El `public_id` puede llevar carpetas: se respeta la jerarquía para que el
  // manifiesto y el árbol de archivos se puedan leer sin traducir nada.
  const extension = resource.format ? `.${resource.format}` : '';
  const target = join(OUT, resource.resourceType, `${resource.publicId}${extension}`);

  if (existsSync(target) && statSync(target).size === resource.bytes) {
    skipped += 1;
    continue;
  }

  try {
    const response = await fetch(resource.url, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    mkdirSync(dirname(target), { recursive: true });
    await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
    downloaded += 1;
    if (downloaded % 50 === 0) console.log(`  descargados ${downloaded}…`);
  } catch (error) {
    failed.push({ publicId: resource.publicId, error: String(error) });
  }
}

// El manifiesto es lo que permite reconstruir la correspondencia entre lo que
// guarda la base (`object_key`) y el archivo del disco.
writeFileSync(
  join(OUT, 'manifiesto.json'),
  JSON.stringify(
    { cloudName, generadoEn: new Date().toISOString(), total: resources.length, resources },
    null,
    2,
  ) + '\n',
  'utf8',
);

console.log(`\nDescargados: ${downloaded}`);
console.log(`Ya presentes: ${skipped}`);
console.log(`Manifiesto: ${join(OUT, 'manifiesto.json')}`);

if (failed.length) {
  console.error(`\nFALLARON ${failed.length} descargas:`);
  for (const f of failed.slice(0, 20)) console.error(`  ${f.publicId}: ${f.error}`);
  process.exit(1);
}
if (orphanMetadata.length) {
  console.error(
    `\nAVISO: ${orphanMetadata.length} metadato(s) apuntan a objetos que ya no existen.`,
  );
  process.exit(1);
}
console.log('\nCopia completa y coherente con la base.');
