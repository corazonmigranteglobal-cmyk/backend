#!/usr/bin/env node
/**
 * Copia los archivos subidos y comprueba que la base y el almacenamiento
 * coinciden.
 *
 * Existe porque el volcado de PostgreSQL **no contiene los archivos**: la tabla
 * `files` guarda metadatos y el contenido vive en Google Cloud Storage o en
 * Cloudinary. Restaurar la base no los recupera, y en un sistema que custodia
 * documentación clínica esa pérdida es irreversible.
 *
 * Modos:
 *
 *   --check    Sólo comprueba coherencia entre la tabla `files` y el bucket.
 *              No escribe nada. Es lo que conviene programar a diario.
 *   --replicate --target=<bucket>
 *              Copia a un bucket secundario los objetos que no estén ya allí.
 *
 * Uso:
 *   node scripts/backup-file-storage.mjs --check
 *   node scripts/backup-file-storage.mjs --replicate --target=cm-archivos-copia
 *
 * Limitación: sólo cubre Google Cloud Storage. Cloudinary no expone una API de
 * copia equivalente; su respaldo depende del plan contratado y se documenta en
 * `docs/data/backup-and-restore.md`.
 */
import 'dotenv/config';
import { Client } from 'pg';
import { Storage } from '@google-cloud/storage';

const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? '').split('=')[1];
const CHECK = process.argv.includes('--check');
const REPLICATE = process.argv.includes('--replicate');
const TARGET = arg('target');

if (!CHECK && !REPLICATE) {
  console.error('Indica --check o --replicate --target=<bucket>.');
  process.exit(2);
}
if (REPLICATE && !TARGET) {
  console.error('--replicate necesita --target=<bucket-destino>.');
  process.exit(2);
}

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

// Sólo los archivos vivos: `paranoid` conserva los borrados con `deleted_at`.
const { rows: files } = await db.query(`
  SELECT id, bucket, object_key, storage_provider, size_bytes, original_name
  FROM files
  WHERE deleted_at IS NULL
`);

const byProvider = files.reduce((acc, f) => {
  acc[f.storage_provider] = (acc[f.storage_provider] ?? 0) + 1;
  return acc;
}, {});

console.log(`Archivos vivos en la base: ${files.length}`);
for (const [provider, count] of Object.entries(byProvider)) {
  console.log(`  ${provider}: ${count}`);
}
console.log('');

const gcsFiles = files.filter((f) => f.storage_provider === 'GCS');
const otherFiles = files.filter((f) => f.storage_provider !== 'GCS');

if (otherFiles.length) {
  console.log(
    `AVISO: ${otherFiles.length} archivo(s) no están en GCS y este script no puede copiarlos.\n` +
      '       Su respaldo depende del proveedor correspondiente. Ver docs/data/backup-and-restore.md.\n',
  );
}

if (gcsFiles.length === 0) {
  console.log('No hay archivos en GCS que comprobar.');
  await db.end();
  process.exit(0);
}

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  ...(process.env.GOOGLE_CREDENTIALS_BASE64
    ? {
        credentials: JSON.parse(
          Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8'),
        ),
      }
    : {}),
});

const missing = [];
let verified = 0;
let replicated = 0;
let alreadyThere = 0;

for (const file of gcsFiles) {
  const bucketName = file.bucket ?? process.env.GCS_BUCKET;
  if (!bucketName) {
    missing.push({ ...file, reason: 'sin bucket en la fila ni GCS_BUCKET configurado' });
    continue;
  }

  const source = storage.bucket(bucketName).file(file.object_key);
  const [exists] = await source.exists();

  if (!exists) {
    // Metadato huérfano: la base promete un archivo que ya no está. El sistema
    // servirá un enlace roto y nadie se entera hasta que alguien lo pulsa.
    missing.push({ ...file, reason: 'el objeto no existe en el bucket' });
    continue;
  }
  verified += 1;

  if (!REPLICATE) continue;

  const destination = storage.bucket(TARGET).file(file.object_key);
  const [copied] = await destination.exists();
  if (copied) {
    alreadyThere += 1;
    continue;
  }
  await source.copy(destination);
  replicated += 1;
}

console.log(`Objetos verificados en GCS: ${verified}/${gcsFiles.length}`);
if (REPLICATE) {
  console.log(`Copiados a ${TARGET}: ${replicated}`);
  console.log(`Ya presentes en el destino: ${alreadyThere}`);
}

if (missing.length) {
  console.log(`\nMETADATOS HUÉRFANOS (${missing.length}):`);
  console.log('La base referencia archivos que no están en el almacenamiento.');
  for (const m of missing.slice(0, 25)) {
    console.log(`  ${m.id}  ${m.original_name}  (${m.reason})`);
  }
  if (missing.length > 25) console.log(`  … y ${missing.length - 25} más`);
}

await db.end();

if (missing.length) {
  console.log('\nRevisión necesaria: hay referencias rotas entre la base y el almacenamiento.');
  process.exit(1);
}
console.log('\nBase y almacenamiento coinciden.');
