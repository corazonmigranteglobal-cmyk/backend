import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseMigrationService } from './database-migration.service';
import { DatabaseSeedService } from './database-seed.service';

/**
 * Orquestador de arranque de base de datos. Al iniciar la app, y de forma idempotente:
 *
 *  1. Aplica migraciones pendientes (esquema = fuente de verdad).       -> siempre
 *  2. Inyecta boot seeds (datos requeridos por el frontend/negocio).    -> siempre
 *  3. Inyecta mockup seeds (datos demo).                                -> solo en dev
 *
 * Cada fase se puede activar/desactivar por configuración. Las migraciones y los boot
 * seeds fallan rápido por defecto (no queremos servir tráfico con un esquema o datos
 * base inconsistentes); los mockup seeds nunca tumban el arranque.
 */
@Injectable()
export class DatabaseBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseBootstrapService.name);
  private executed = false;

  constructor(
    private readonly config: ConfigService,
    private readonly migrations: DatabaseMigrationService,
    private readonly seeds: DatabaseSeedService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.executed) return;
    this.executed = true;

    const failFast = this.config.get<boolean>('database.bootstrapFailFast') !== false;
    this.logger.log('Iniciando bootstrap idempotente de base de datos.');

    if (this.config.get<boolean>('database.migrateOnStartup') !== false) {
      await this.runPhase('migraciones', failFast, () => this.migrations.run());
    } else {
      this.logger.warn('Migraciones al arrancar deshabilitadas (database.migrateOnStartup=false).');
    }

    if (this.config.get<boolean>('database.seedBootOnStartup') !== false) {
      await this.runPhase('boot seeds', failFast, () =>
        this.seeds.runBootSeeds({ force: this.config.get<boolean>('database.seedRerun') === true }),
      );
    } else {
      this.logger.warn('Boot seeds al arrancar deshabilitados (database.seedBootOnStartup=false).');
    }

    if (this.config.get<boolean>('database.seedMockupOnStartup') === true) {
      // Los mockup seeds nunca tumban el arranque: son una conveniencia de desarrollo.
      await this.runPhase('mockup seeds', false, () =>
        this.seeds.runMockupSeeds({
          force: this.config.get<boolean>('database.seedRerun') === true,
        }),
      );
    } else {
      this.logger.log('Mockup seeds omitidos (solo se inyectan en entornos de desarrollo).');
    }

    this.logger.log('Bootstrap idempotente de base de datos finalizado.');
  }

  private async runPhase(
    name: string,
    failFast: boolean,
    task: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await task();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falló la fase de ${name} del bootstrap: ${message}`);
      if (failFast) throw error;
    }
  }
}
