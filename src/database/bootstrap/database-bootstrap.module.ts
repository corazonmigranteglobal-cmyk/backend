import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseBootstrapService } from './database-bootstrap.service';
import { DatabaseMigrationService } from './database-migration.service';
import { DatabaseSeedService } from './database-seed.service';

/**
 * Registra el bootstrap idempotente de base de datos (migraciones + seeds) para que
 * corra al arrancar la app. Depende de que `DatabaseModule` (SequelizeModule) ya haya
 * provisto la instancia de `Sequelize` en el contenedor raíz.
 */
@Module({
  imports: [ConfigModule],
  providers: [DatabaseMigrationService, DatabaseSeedService, DatabaseBootstrapService],
  exports: [DatabaseMigrationService, DatabaseSeedService],
})
export class DatabaseBootstrapModule {}
