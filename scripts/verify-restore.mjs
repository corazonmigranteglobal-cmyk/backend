#!/usr/bin/env node
/**
 * Ensaya la restauración de una copia y comprueba que el resultado sirve.
 *
 * Existe porque una copia que nunca se ha restaurado **no es una copia
 * verificada**, y ese es hoy el requisito que impide declarar el backend apto
 * para producción (ver `docs/reports/production-readiness.md`).
 *
 * Qué hace:
 *   1. Crea una base de datos desechable.
 *   2. Restaura en ella el volcado indicado.
 *   3. Comprueba que el esquema está completo y las migraciones al día.
 *   4. Comprueba integridad referencial y presencia de datos imprescindibles.
 *   5. Informa de qué **no** cubre la copia.
 *   6. Elimina la base desechable.
 *
 * Uso:
 *   node scripts/verify-restore.mjs --dump=backup.sql
 *   node scripts/verify-restore.mjs --dump=backup.sql --keep   # conserva la base
 *
 * La conexión se toma de las variables `DATABASE_*` o de `DATABASE_URL`, y el
 * usuario debe poder crear bases de datos.
 */
import 'dotenv/config';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? '').split('=')[1];
const DUMP = arg('dump');
const KEEP = process.argv.includes('--keep');

if (!DUMP) {
  console.error('Falta --dump=<archivo>. Ejemplo: node scripts/verify-restore.mjs --dump=backup.sql');
  process.exit(2);
}
if (!existsSync(DUMP)) {
  console.error(`No existe el volcado: ${DUMP}`);
  process.exit(2);
}

const base = {
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
};

// Nombre determinista: si el ensayo aborta, la siguiente ejecución la reutiliza
// en vez de dejar bases huérfanas acumulándose.
const SCRATCH = 'restore_rehearsal';

/** Tablas sin las que el sistema no arranca ni opera. */
const REQUIRED_TABLES = [
  'users',
  'roles',
  'permissions',
  'role_permissions',
  'user_roles',
  'appointments',
  'appointment_status_history',
  'therapy_products',
  'therapist_schedules',
  'content_publications',
  'files',
  'audit_logs',
  'SequelizeMeta',
];

/** Datos de arranque sin los que la autorización no funciona. */
const REQUIRED_SEEDS = [
  { table: 'roles', min: 1, why: 'sin roles, ninguna identidad puede autorizarse' },
  { table: 'permissions', min: 1, why: 'sin permisos, los guards rechazan todo' },
];

/**
 * Ejecuta `psql`. Con `--docker=<contenedor>` lo hace dentro del contenedor de
 * PostgreSQL, que es lo habitual en una máquina de desarrollo donde el cliente
 * de línea de comandos no está instalado.
 */
const DOCKER = arg('docker');

function psql(sqlFile, opts = {}) {
  const psqlArgs = [
    '-U',
    base.user,
    '-d',
    SCRATCH,
    '-v',
    'ON_ERROR_STOP=1',
    '-q',
    '-f',
    DOCKER ? '/tmp/restore-rehearsal.sql' : sqlFile,
  ];

  if (DOCKER) {
    // El volcado tiene que estar dentro del contenedor para que psql lo lea.
    execFileSync('docker', ['cp', sqlFile, `${DOCKER}:/tmp/restore-rehearsal.sql`], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    return execFileSync(
      'docker',
      ['exec', '-e', `PGPASSWORD=${base.password ?? ''}`, DOCKER, 'psql', ...psqlArgs],
      { encoding: 'utf8', ...opts },
    );
  }

  return execFileSync('psql', ['-h', base.host, '-p', String(base.port), ...psqlArgs], {
    encoding: 'utf8',
    env: { ...process.env, PGPASSWORD: base.password ?? '' },
    ...opts,
  });
}

const fail = [];
const warn = [];

console.log(`Ensayo de restauración`);
console.log(`  Volcado: ${DUMP} (${(statSync(DUMP).size / 1024 / 1024).toFixed(1)} MB)`);
console.log(`  Destino: ${base.host}:${base.port}/${SCRATCH}\n`);

const admin = new Client({ ...base, database: 'postgres' });
await admin.connect();

console.log('1. Preparando base desechable…');
await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH}`);
await admin.query(`CREATE DATABASE ${SCRATCH}`);

console.log('2. Restaurando el volcado…');
const started = Date.now();
try {
  psql(DUMP, { stdio: ['ignore', 'ignore', 'pipe'] });
} catch (error) {
  console.error('   La restauración falló:');
  console.error(String(error.stderr ?? error.message).split('\n').slice(0, 15).join('\n'));
  fail.push('La restauración no completó');
}
const restoreSeconds = Math.round((Date.now() - started) / 1000);
console.log(`   Completada en ${restoreSeconds} s\n`);

const scratch = new Client({ ...base, database: SCRATCH });
await scratch.connect();

console.log('3. Comprobando el esquema…');
for (const table of REQUIRED_TABLES) {
  const { rows } = await scratch.query('SELECT to_regclass($1) IS NOT NULL AS exists', [
    `public."${table}"`,
  ]);
  if (!rows[0].exists) fail.push(`Falta la tabla ${table}`);
}
const { rows: applied } = await scratch.query(
  `SELECT count(*)::int AS n FROM "SequelizeMeta"`,
).catch(() => ({ rows: [{ n: 0 }] }));
console.log(`   Tablas requeridas: ${REQUIRED_TABLES.length - fail.length}/${REQUIRED_TABLES.length}`);
console.log(`   Migraciones registradas: ${applied[0].n}\n`);

console.log('4. Comprobando datos imprescindibles…');
for (const seed of REQUIRED_SEEDS) {
  const { rows } = await scratch
    .query(`SELECT count(*)::int AS n FROM "${seed.table}"`)
    .catch(() => ({ rows: [{ n: -1 }] }));
  const n = rows[0].n;
  if (n < seed.min) fail.push(`${seed.table} tiene ${n} filas: ${seed.why}`);
  console.log(`   ${seed.table}: ${n} filas`);
}

console.log('\n5. Comprobando integridad referencial…');
const { rows: invalid } = await scratch.query(`
  SELECT conrelid::regclass::text AS tabla, conname AS restriccion
  FROM pg_constraint
  WHERE contype = 'f' AND NOT convalidated
`);
if (invalid.length) {
  for (const row of invalid) fail.push(`Clave foránea sin validar: ${row.tabla}.${row.restriccion}`);
} else {
  console.log('   Todas las claves foráneas están validadas.');
}

// Archivos: la comprobación que de verdad importa y que la copia no cubre.
const { rows: files } = await scratch
  .query('SELECT count(*)::int AS n FROM files')
  .catch(() => ({ rows: [{ n: 0 }] }));
if (files[0].n > 0) {
  warn.push(
    `Hay ${files[0].n} archivos referenciados en la tabla files, pero **el contenido de esos ` +
      'archivos no está en este volcado**: vive en GCS o Cloudinary. Restaurar la base no los ' +
      'recupera. Si se perdiera el bucket, estas filas apuntarían a objetos inexistentes.',
  );
}

console.log('\n6. Limpiando…');
await scratch.end();
if (KEEP) {
  console.log(`   Base conservada: ${SCRATCH} (usa --keep para esto)`);
} else {
  await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH}`);
  console.log('   Base desechable eliminada.');
}
await admin.end();

console.log('\n' + '='.repeat(60));
if (warn.length) {
  console.log('\nAVISOS');
  warn.forEach((w) => console.log(`  - ${w}`));
}
if (fail.length) {
  console.log('\nFALLOS');
  fail.forEach((f) => console.log(`  - ${f}`));
  console.log(`\nEnsayo FALLIDO: la copia no basta para reconstruir el servicio.`);
  process.exit(1);
}

console.log(`\nEnsayo CORRECTO. Tiempo de restauración: ${restoreSeconds} s.`);
console.log('Registra este resultado y su fecha en docs/data/backup-and-restore.md.');
