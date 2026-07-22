import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { resolveExistingDir, runPendingTasks, type RunTasksResult } from './database-tasks.util';

const EMPTY_RESULT: RunTasksResult = { applied: [], skipped: [] };

/**
 * Ejecuta los dos tipos de seeds, claramente separados por carpeta y por tabla de
 * metadatos, de forma idempotente:
 *
 * - **Boot seeds** (`src/database/seeders/boot`): datos que el frontend/negocio
 *   necesita para funcionar (páginas públicas, catálogo, RBAC...). Se aplican SIEMPRE,
 *   en cualquier entorno. Registro en `SequelizeDataBoot`.
 *
 * - **Mockup seeds** (`src/database/seeders/mockup`): datos demo/ficticios para pruebas.
 *   Se aplican SOLO en entornos de desarrollo. Registro en `SequelizeDataMockup`.
 *
 * `force` reinyecta lo ya registrado (los seeders son idempotentes internamente).
 */
@Injectable()
export class DatabaseSeedService {
  private readonly logger = new Logger(DatabaseSeedService.name);
  private static readonly BOOT_META_TABLE = 'SequelizeDataBoot';
  private static readonly MOCKUP_META_TABLE = 'SequelizeDataMockup';

  constructor(private readonly sequelize: Sequelize) {}

  runBootSeeds(options: { force?: boolean } = {}): Promise<RunTasksResult> {
    return this.runFolder({
      subdir: 'boot',
      metaTable: DatabaseSeedService.BOOT_META_TABLE,
      label: 'seeds-boot',
      force: options.force,
    });
  }

  runMockupSeeds(options: { force?: boolean } = {}): Promise<RunTasksResult> {
    return this.runFolder({
      subdir: 'mockup',
      metaTable: DatabaseSeedService.MOCKUP_META_TABLE,
      label: 'seeds-mockup',
      force: options.force,
    });
  }

  private runFolder(params: {
    subdir: 'boot' | 'mockup';
    metaTable: string;
    label: string;
    force?: boolean;
  }): Promise<RunTasksResult> {
    const directory = resolveExistingDir([
      process.env[`DATABASE_SEEDS_${params.subdir.toUpperCase()}_DIR`],
      join(process.cwd(), 'src', 'database', 'seeders', params.subdir),
    ]);

    if (!directory) {
      this.logger.warn(`No se localizó el directorio de seeds "${params.subdir}"; se omite.`);
      return Promise.resolve(EMPTY_RESULT);
    }

    return runPendingTasks({
      sequelize: this.sequelize,
      directory,
      metaTable: params.metaTable,
      logger: this.logger,
      label: params.label,
      force: params.force,
    });
  }
}
