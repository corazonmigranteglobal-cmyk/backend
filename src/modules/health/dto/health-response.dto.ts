import { ApiProperty } from '@nestjs/swagger';

/**
 * Formas de respuesta de las sondas de salud.
 *
 * @see src/modules/health/health.service.ts
 */
export class HealthChecksDto {
  @ApiProperty({
    enum: ['ok', 'down'],
    example: 'ok',
    description: 'Resultado de un `SELECT 1` contra PostgreSQL.',
  })
  database!: 'ok' | 'down';

  @ApiProperty({
    enum: ['ok', 'down'],
    example: 'ok',
    description: 'Resultado del `PING` a Redis. Devuelve `down` si Redis está desactivado.',
  })
  redis!: 'ok' | 'down';
}

export class HealthStatusDto {
  @ApiProperty({
    enum: ['ok', 'degraded'],
    example: 'ok',
    description:
      'Es `ok` sólo si todas las comprobaciones pasan. Si Redis está caído pero PostgreSQL responde, ' +
      'el servicio sigue siendo útil y devuelve `degraded`, no un fallo: la caché es prescindible, ' +
      'la base de datos no.',
  })
  status!: 'ok' | 'degraded';

  @ApiProperty({ type: HealthChecksDto })
  checks!: HealthChecksDto;

  @ApiProperty({
    example: '1.0.0',
    description: 'Versión del paquete. `unknown` si no está fijada.',
  })
  version!: string;

  @ApiProperty({
    example: '4b50289',
    description:
      'Commit desplegado, tomado de `GIT_COMMIT`. `unknown` si no se inyectó al construir.',
  })
  commit!: string;

  @ApiProperty({ example: 'production' })
  env!: string;

  @ApiProperty({ example: 3672, description: 'Segundos que lleva el proceso en marcha.' })
  uptime!: number;

  @ApiProperty({ format: 'date-time', example: '2026-08-03T22:45:12.345Z' })
  timestamp!: string;
}

export class VersionDto {
  @ApiProperty({ example: '1.0.0' })
  version!: string;

  @ApiProperty({ example: '4b50289', description: 'Tomado de `GIT_COMMIT`.' })
  commit!: string;

  @ApiProperty({
    example: '2026-08-03T22:00:00Z',
    description: 'Tomado de `BUILD_AT`. `unknown` si no se inyectó al construir la imagen.',
  })
  buildAt!: string;

  @ApiProperty({ example: 'production' })
  env!: string;
}
