#!/usr/bin/env node
/*
 * Backup job: PostgreSQL principal -> uno o varios destinos de respaldo.
 *
 * Este script NO contiene credenciales. Lee todo desde variables de entorno.
 * Requiere tener disponibles los binarios: pg_dump y pg_restore.
 * En Render/Nixpacks se agregan con nixpacks.toml -> postgresql_16.
 *
 * Destinos soportados (se pueden usar ambos a la vez):
 *   - Neon:      NEON_BACKUP_DATABASE_URL / BACKUP_TARGET_DATABASE_URL
 *   - VPS local: VPS_BACKUP_DATABASE_URL
 */

const { spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, writeFileSync, readdirSync, statSync, unlinkSync, readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const loadDotEnvIfPresent = () => {
  if (!existsSync('.env')) return;

  try {
    // Usa dotenv cuando ya se instalaron dependencias.
    require('dotenv').config();
    return;
  } catch {
    // Fallback mínimo para que el script también pueda validarse antes de npm install.
    const lines = readFileSync('.env', 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
};

loadDotEnvIfPresent();

const bool = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).toLowerCase());
};

const required = (name) => {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Falta la variable obligatoria ${name}.`);
  }
  return value;
};

const maskUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    if (url.password) url.password = '***';
    if (url.username) url.username = `${url.username.slice(0, 2)}***`;
    return url.toString();
  } catch {
    return '[URL inválida u oculta]';
  }
};

const buildSourceDatabaseUrl = () => {
  if (process.env.SOURCE_DATABASE_URL) return process.env.SOURCE_DATABASE_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const host = required('DATABASE_HOST');
  const port = process.env.DATABASE_PORT || '5432';
  const name = required('DATABASE_NAME');
  const user = required('DATABASE_USER');
  const password = required('DATABASE_PASSWORD');
  const ssl = bool(process.env.DATABASE_SSL, false);

  const url = new URL(`postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}`);
  if (ssl) url.searchParams.set('sslmode', 'require');
  return url.toString();
};

const parseUrl = (name, rawUrl) => {
  try {
    return new URL(rawUrl);
  } catch (error) {
    throw new Error(`${name} no es una URL PostgreSQL válida. Valor recibido: ${maskUrl(rawUrl)}`);
  }
};

const run = (command, args, options = {}) => {
  const printable = [command, ...args.map((arg) => (arg.includes('postgres') ? maskUrl(arg) : arg))].join(' ');
  console.log(`\n$ ${printable}`);

  if (bool(process.env.BACKUP_DRY_RUN, false)) {
    console.log('BACKUP_DRY_RUN=true: comando validado, no ejecutado.');
    return;
  }

  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`El comando ${command} terminó con código ${result.status}.`);
  }
};

const cleanupOldBackups = (backupDir, retentionDays) => {
  if (!retentionDays || retentionDays <= 0 || !existsSync(backupDir)) return;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  for (const file of readdirSync(backupDir)) {
    if (!file.endsWith('.dump') && !file.endsWith('.manifest.json')) continue;
    const fullPath = join(backupDir, file);
    const stats = statSync(fullPath);
    if (stats.mtimeMs < cutoff) {
      unlinkSync(fullPath);
      console.log(`Backup local antiguo eliminado: ${file}`);
    }
  }
};

// Cada destino habilitado exige su propia URL + su propia confirmación explícita,
// para evitar restaurar por accidente en la base equivocada.
const collectTargets = () => {
  const allowNonNeonTarget = bool(process.env.ALLOW_NON_NEON_BACKUP_TARGET, false);
  const targets = [];

  const vpsUrl = process.env.VPS_BACKUP_DATABASE_URL;
  if (vpsUrl && bool(process.env.BACKUP_RESTORE_TO_VPS, true)) {
    if (!bool(process.env.BACKUP_CONFIRM_REMOTE_VPS, false)) {
      throw new Error('Para restaurar en el Postgres del VPS debes definir BACKUP_CONFIRM_REMOTE_VPS=true.');
    }
    targets.push({ label: 'VPS', name: 'VPS_BACKUP_DATABASE_URL', rawUrl: vpsUrl, requireNeonHost: false });
  }

  const neonUrl = process.env.NEON_BACKUP_DATABASE_URL || process.env.BACKUP_TARGET_DATABASE_URL;
  if (neonUrl && bool(process.env.BACKUP_RESTORE_TO_NEON, true)) {
    if (!bool(process.env.BACKUP_CONFIRM_REMOTE_NEON, false)) {
      throw new Error('Para restaurar en Neon debes definir BACKUP_CONFIRM_REMOTE_NEON=true.');
    }
    targets.push({
      label: 'Neon',
      name: 'NEON_BACKUP_DATABASE_URL',
      rawUrl: neonUrl,
      requireNeonHost: !allowNonNeonTarget,
    });
  }

  return targets;
};

const main = () => {
  const sourceDatabaseUrl = buildSourceDatabaseUrl();
  const source = parseUrl('SOURCE_DATABASE_URL/DATABASE_URL', sourceDatabaseUrl);

  const targets = collectTargets().map((target) => ({
    ...target,
    url: parseUrl(target.name, target.rawUrl),
  }));

  if (targets.length === 0) {
    throw new Error(
      'No hay ningún destino de backup habilitado. Define VPS_BACKUP_DATABASE_URL y/o NEON_BACKUP_DATABASE_URL (con sus respectivos BACKUP_RESTORE_TO_* y BACKUP_CONFIRM_REMOTE_*).',
    );
  }

  for (const target of targets) {
    if (source.toString() === target.url.toString()) {
      throw new Error(`La base origen y el destino "${target.label}" son iguales. Se detiene para evitar sobreescribir producción.`);
    }
    if (target.requireNeonHost && !target.url.hostname.includes('neon.tech')) {
      throw new Error(
        `${target.name} no parece apuntar a Neon. Si de verdad quieres otro destino, usa ALLOW_NON_NEON_BACKUP_TARGET=true.`,
      );
    }
  }

  const backupDir = resolve(process.env.BACKUP_DIR || 'backups');
  const retentionDays = Number(process.env.BACKUP_LOCAL_RETENTION_DAYS || '7');

  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dumpPath = join(backupDir, `corazon_migrante_${timestamp}.dump`);
  const manifestPath = join(backupDir, `corazon_migrante_${timestamp}.manifest.json`);

  console.log('Iniciando backup PostgreSQL');
  console.log(`Origen:  ${maskUrl(sourceDatabaseUrl)}`);
  for (const target of targets) {
    console.log(`Destino (${target.label}): ${maskUrl(target.rawUrl)}`);
  }
  console.log(`Archivo: ${dumpPath}`);

  run('pg_dump', [
    '--format=custom',
    '--compress=9',
    '--no-owner',
    '--no-acl',
    '--verbose',
    '--file',
    dumpPath,
    sourceDatabaseUrl,
  ]);

  for (const target of targets) {
    run('pg_restore', [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-acl',
      '--verbose',
      '--dbname',
      target.rawUrl,
      dumpPath,
    ]);
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    source: {
      host: source.hostname,
      database: source.pathname.replace(/^\//, ''),
      sslmode: source.searchParams.get('sslmode') || null,
    },
    targets: targets.map((target) => ({
      label: target.label,
      host: target.url.hostname,
      database: target.url.pathname.replace(/^\//, ''),
      sslmode: target.url.searchParams.get('sslmode') || null,
    })),
    localDumpFile: dumpPath,
    retentionDays,
  };

  if (!bool(process.env.BACKUP_DRY_RUN, false)) {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    cleanupOldBackups(backupDir, retentionDays);
  }

  console.log('\nBackup finalizado correctamente.');
};

try {
  main();
} catch (error) {
  console.error(`\nERROR EN BACKUP: ${error.message}`);
  process.exit(1);
}
