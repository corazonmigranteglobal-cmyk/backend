#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const nodeEnv = process.env.NODE_ENV || 'production';

for (const file of [`.env.${nodeEnv}.local`, '.env.local', `.env.${nodeEnv}`, '.env']) {
  const fullPath = path.join(rootDir, file);
  if (existsSync(fullPath)) dotenv.config({ path: fullPath, override: false });
}

function hasArg(name) {
  return process.argv.includes(name);
}

function boolEnv(name, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function clean(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return undefined;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function required(...names) {
  for (const name of names) {
    const value = clean(process.env[name]);
    if (value) return value;
  }
  throw new Error(`Falta variable de base de datos: ${names.join(' o ')}`);
}

function makeSequelize() {
  const ssl = boolEnv('DATABASE_SSL', false) || boolEnv('DB_SSL', false);
  const logging = boolEnv('DATABASE_LOGGING', false) || boolEnv('DB_LOGGING', false);
  const dialectOptions = ssl ? { ssl: { require: true, rejectUnauthorized: false } } : undefined;
  const databaseUrl = clean(process.env.DATABASE_URL);

  if (databaseUrl) {
    return new Sequelize(databaseUrl, {
      dialect: 'postgres',
      logging: logging ? console.log : false,
      dialectOptions,
    });
  }

  return new Sequelize({
    dialect: 'postgres',
    host: required('DATABASE_HOST', 'DB_HOST'),
    port: Number(clean(process.env.DATABASE_PORT) ?? clean(process.env.DB_PORT) ?? 5432),
    database: required('DATABASE_NAME', 'DB_NAME'),
    username: required('DATABASE_USER', 'DB_USER'),
    password: required('DATABASE_PASSWORD', 'DB_PASSWORD'),
    logging: logging ? console.log : false,
    dialectOptions,
  });
}

async function ensureMetaTable(sequelize, tableName) {
  await sequelize.query(`CREATE TABLE IF NOT EXISTS "${tableName}" (name VARCHAR(255) NOT NULL PRIMARY KEY);`);
}

async function executedNames(sequelize, tableName) {
  const [rows] = await sequelize.query(`SELECT name FROM "${tableName}";`);
  return new Set(rows.map((row) => row.name));
}

function jsFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((file) => file.endsWith('.js')).sort();
}

async function runMigrations(sequelize) {
  const migrationsDir = path.join(rootDir, 'src', 'database', 'migrations');
  const files = jsFiles(migrationsDir);
  if (!files.length) {
    console.log('[db:deploy] No se encontraron migraciones.');
    return;
  }

  await ensureMetaTable(sequelize, 'SequelizeMeta');
  const executed = await executedNames(sequelize, 'SequelizeMeta');
  const queryInterface = sequelize.getQueryInterface();

  for (const file of files) {
    if (executed.has(file)) {
      console.log(`[db:deploy] Migración ya aplicada: ${file}`);
      continue;
    }

    console.log(`[db:deploy] Aplicando migración: ${file}`);
    const migration = (await import(pathToFileURL(path.join(migrationsDir, file)).href)).default ?? (await import(pathToFileURL(path.join(migrationsDir, file)).href));
    if (typeof migration.up !== 'function') throw new Error(`La migración ${file} no exporta up().`);
    await migration.up(queryInterface, Sequelize);
    await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (:name) ON CONFLICT (name) DO NOTHING;', {
      replacements: { name: file },
    });
  }
}

async function runSeeders(sequelize) {
  const runSeeders = hasArg('--seeders') || boolEnv('DATABASE_DEPLOY_RUN_SEEDERS', false);
  const rerunSeeders = hasArg('--rerun-seeders') || boolEnv('DATABASE_DEPLOY_RERUN_IDEMPOTENT_SEEDERS', false);
  if (!runSeeders && !rerunSeeders) {
    console.log('[db:deploy] Seeders omitidos. Activa DATABASE_DEPLOY_RUN_SEEDERS=true si quieres ejecutarlos en despliegue.');
    return;
  }

  const seedersDir = path.join(rootDir, 'src', 'database', 'seeders');
  const files = jsFiles(seedersDir);
  if (!files.length) return;

  await ensureMetaTable(sequelize, 'SequelizeData');
  const executed = await executedNames(sequelize, 'SequelizeData');
  const queryInterface = sequelize.getQueryInterface();

  for (const file of files) {
    if (!rerunSeeders && executed.has(file)) {
      console.log(`[db:deploy] Seeder ya aplicado: ${file}`);
      continue;
    }

    console.log(`[db:deploy] Ejecutando seeder idempotente: ${file}`);
    const seeder = (await import(pathToFileURL(path.join(seedersDir, file)).href)).default ?? (await import(pathToFileURL(path.join(seedersDir, file)).href));
    if (typeof seeder.up !== 'function') throw new Error(`El seeder ${file} no exporta up().`);
    await seeder.up(queryInterface, Sequelize);
    await sequelize.query('INSERT INTO "SequelizeData" (name) VALUES (:name) ON CONFLICT (name) DO NOTHING;', {
      replacements: { name: file },
    });
  }
}

async function main() {
  if (!hasArg('--force') && boolEnv('DATABASE_DEPLOY_ON_STARTUP', true) === false) {
    console.log('[db:deploy] Omitido por DATABASE_DEPLOY_ON_STARTUP=false.');
    return;
  }

  const sequelize = makeSequelize();
  try {
    await sequelize.authenticate();
    console.log('[db:deploy] Conexión DB OK.');
    await runMigrations(sequelize);
    await runSeeders(sequelize);
    console.log('[db:deploy] Base de datos lista.');
  } finally {
    await sequelize.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('[db:deploy] Error aplicando cambios de base de datos. El despliegue se detiene para evitar una versión incompatible.');
  console.error(error);
  process.exit(1);
});
