import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseSchemaBootstrapService } from './database-schema-bootstrap.service';
import { PublicCmsBootstrapService } from './public-cms-bootstrap.service';

/**
 * Orquestador pequeño: no contiene DDL ni datos demo.
 * Solo decide si ejecutar bootstrap de esquema y seed mínimo al arrancar.
 */
@Injectable()
export class DatabaseBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseBootstrapService.name);
  private executed = false;

  constructor(
    private readonly config: ConfigService,
    private readonly schemaBootstrap: DatabaseSchemaBootstrapService,
    private readonly publicCmsBootstrap: PublicCmsBootstrapService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.executed || !this.config.get<boolean>('database.bootstrapOnStartup')) {
      return;
    }

    this.executed = true;

    try {
      this.logger.log('Iniciando bootstrap idempotente de base de datos.');
      await this.schemaBootstrap.ensureSchema();

      if (this.config.get<boolean>('database.seedPublicCmsOnStartup')) {
        await this.publicCmsBootstrap.ensureDefaults();
      }

      this.logger.log('Bootstrap idempotente de base de datos finalizado.');
    } catch (error) {
      const failFast = this.config.get<boolean>('database.bootstrapFailFast');
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`Falló el bootstrap idempotente de base de datos: ${message}`);

      if (failFast) {
        throw error;
      }
    }
  }
}
