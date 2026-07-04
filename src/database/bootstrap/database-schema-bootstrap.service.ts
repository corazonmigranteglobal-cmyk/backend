import { Injectable, Logger } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';

/**
 * Crea solamente lo que falta en la base de datos.
 *
 * Esta clase existe para ambientes productivos donde Coolify/VPS puede arrancar
 * el backend antes de ejecutar `sequelize-cli db:migrate`. No reemplaza las
 * migraciones como fuente de verdad; solo evita caídas por tablas inexistentes
 * cuando la base está vacía o parcialmente creada.
 */
@Injectable()
export class DatabaseSchemaBootstrapService {
  private readonly logger = new Logger(DatabaseSchemaBootstrapService.name);

  constructor(private readonly sequelize: Sequelize) {}

  async ensureSchema(): Promise<void> {
    await this.ensurePostgresPrerequisites();
    await this.createMissingModelTables();
    await this.ensureMigrationMetadata();
  }

  private async ensurePostgresPrerequisites(): Promise<void> {
    await this.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await this.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    await this.sequelize.query('CREATE SCHEMA IF NOT EXISTS mensajeria;');
  }

  private async createMissingModelTables(): Promise<void> {
    this.logger.log('Validando tablas requeridas por los modelos registrados.');

    await this.sequelize.sync({
      force: false,
      alter: false,
      logging: false,
    });
  }

  private async ensureMigrationMetadata(): Promise<void> {
    await this.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
        name VARCHAR(255) NOT NULL PRIMARY KEY
      );
    `);

    await this.sequelize.query(`
      INSERT INTO "SequelizeMeta" (name)
      VALUES
        ('20260628000000-init-schema.js'),
        ('20260702010000-integrate-newspaper-content-advertising-homepage.js')
      ON CONFLICT (name) DO NOTHING;
    `);
  }
}
