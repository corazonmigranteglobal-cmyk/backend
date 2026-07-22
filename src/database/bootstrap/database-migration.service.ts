import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { resolveExistingDir, runPendingTasks, type RunTasksResult } from './database-tasks.util';

/**
 * Aplica las migraciones pendientes EN PROCESO al arrancar la app.
 *
 * Reemplaza el antiguo `sequelize.sync({ alter: false })`, que solo creaba tablas
 * faltantes pero NUNCA añadía columnas a tablas ya existentes; ese hueco provocaba
 * desfases esquema-vs-modelo (p. ej. columnas `is_paid`/`paid_at` ausentes) que
 * hacían fallar consultas con errores SQL opacos (HTTP 400).
 *
 * Las migraciones son la fuente de verdad del esquema y ya son idempotentes
 * (`ADD COLUMN IF NOT EXISTS`, guardas `to_regclass`, etc.); se registran en
 * `SequelizeMeta`, la misma tabla que usa `sequelize-cli`, así que el estado queda
 * consistente sin importar si se corrió por CLI, por `deploy-db` o al arrancar.
 */
@Injectable()
export class DatabaseMigrationService {
  private readonly logger = new Logger(DatabaseMigrationService.name);
  private static readonly META_TABLE = 'SequelizeMeta';

  constructor(private readonly sequelize: Sequelize) {}

  async run(): Promise<RunTasksResult> {
    await this.ensurePostgresPrerequisites();

    const directory = this.resolveMigrationsDir();
    if (!directory) {
      this.logger.warn(
        'No se localizó el directorio de migraciones; se omite la fase de migración.',
      );
      return { applied: [], skipped: [] };
    }

    return runPendingTasks({
      sequelize: this.sequelize,
      directory,
      metaTable: DatabaseMigrationService.META_TABLE,
      logger: this.logger,
      label: 'migraciones',
    });
  }

  /** Extensiones y esquemas que las migraciones/consultas dan por hechos. */
  private async ensurePostgresPrerequisites(): Promise<void> {
    await this.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await this.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    await this.sequelize.query('CREATE SCHEMA IF NOT EXISTS mensajeria;');
  }

  private resolveMigrationsDir(): string | null {
    return resolveExistingDir([
      process.env.DATABASE_MIGRATIONS_DIR,
      join(process.cwd(), 'src', 'database', 'migrations'),
    ]);
  }
}
