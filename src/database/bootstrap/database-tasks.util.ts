import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import type { Logger } from '@nestjs/common';
import { Sequelize as SequelizeLib } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';

/**
 * Utilidades compartidas para correr migraciones y seeders EN PROCESO al arrancar.
 *
 * Mismo contrato que `sequelize-cli` / `scripts/deploy-db.mjs`:
 * - Cada archivo `.js` exporta `up(queryInterface, Sequelize)` (y opcionalmente `down`).
 * - Lo ya aplicado se registra en una tabla de metadatos (una por categoría) y se salta.
 * - Idempotencia en dos capas: el runner salta lo registrado y, además, los propios
 *   archivos usan SQL idempotente (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, etc.),
 *   por lo que reejecutarlos con `force` también es seguro.
 */

// createRequire nos da un require() clásico incluso cuando el bundle final es CJS,
// para cargar dinámicamente los .js de migraciones/seeders por ruta absoluta.
const requireModule = createRequire(__filename);

export interface DatabaseTask {
  up?: (queryInterface: unknown, sequelize: unknown) => Promise<unknown> | unknown;
  down?: (queryInterface: unknown, sequelize: unknown) => Promise<unknown> | unknown;
}

export interface RunTasksResult {
  applied: string[];
  skipped: string[];
}

/** Devuelve el primer directorio existente de la lista de candidatos, o null. */
export function resolveExistingDir(candidates: Array<string | undefined>): string | null {
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

function listJsFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => file.endsWith('.js'))
    .sort();
}

function loadTask(absolutePath: string): DatabaseTask {
  const mod = requireModule(absolutePath) as DatabaseTask & { default?: DatabaseTask };
  return mod.default ?? mod;
}

async function ensureMetaTable(sequelize: Sequelize, tableName: string): Promise<void> {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "${tableName}" (name VARCHAR(255) NOT NULL PRIMARY KEY);`,
  );
}

async function getExecuted(sequelize: Sequelize, tableName: string): Promise<Set<string>> {
  const [rows] = await sequelize.query(`SELECT name FROM "${tableName}";`);
  return new Set((rows as Array<{ name: string }>).map((row) => row.name));
}

async function markExecuted(sequelize: Sequelize, tableName: string, name: string): Promise<void> {
  await sequelize.query(
    `INSERT INTO "${tableName}" (name) VALUES (:name) ON CONFLICT (name) DO NOTHING;`,
    { replacements: { name } },
  );
}

/**
 * Corre, en orden alfabético, los archivos `.js` pendientes de `directory`.
 *
 * @param force  Si es true, reejecuta también los ya registrados (confía en la
 *               idempotencia interna de cada archivo). Útil para reinyectar seeds.
 */
export async function runPendingTasks(params: {
  sequelize: Sequelize;
  directory: string;
  metaTable: string;
  logger: Logger;
  label: string;
  force?: boolean;
}): Promise<RunTasksResult> {
  const { sequelize, directory, metaTable, logger, label, force = false } = params;
  const result: RunTasksResult = { applied: [], skipped: [] };

  const files = listJsFiles(directory);
  if (files.length === 0) {
    logger.warn(`[${label}] No se encontraron archivos en ${directory}.`);
    return result;
  }

  await ensureMetaTable(sequelize, metaTable);
  const executed = await getExecuted(sequelize, metaTable);
  const queryInterface = sequelize.getQueryInterface();

  for (const file of files) {
    if (!force && executed.has(file)) {
      result.skipped.push(file);
      continue;
    }

    const task = loadTask(join(directory, file));
    if (typeof task.up !== 'function') {
      throw new Error(`El archivo ${file} de "${label}" no exporta una función up().`);
    }

    logger.log(`[${label}] Aplicando: ${file}`);
    await task.up(queryInterface, SequelizeLib);
    await markExecuted(sequelize, metaTable, file);
    result.applied.push(file);
  }

  logger.log(
    `[${label}] Completado. Aplicados: ${result.applied.length}, ya presentes: ${result.skipped.length}.`,
  );
  return result;
}
