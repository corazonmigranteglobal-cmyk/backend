import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Formas de respuesta del catálogo terapéutico.
 *
 * Reflejan las columnas de `TherapyApproach` y `TherapyProduct` tal y como las
 * serializa Sequelize (nombres en camelCase, no los de la tabla). Si cambia
 * alguna columna, hay que cambiar estas clases en el mismo commit.
 *
 * @see src/database/models/therapy-approach.model.ts
 * @see src/database/models/therapy-product.model.ts
 */
export class TherapyApproachDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Terapia cognitivo-conductual', maxLength: 180 })
  name!: string;

  @ApiProperty({
    example: 'terapia-cognitivo-conductual',
    maxLength: 200,
    description: 'Identificador estable y legible. Es único en todo el catálogo.',
  })
  slug!: string;

  @ApiPropertyOptional({ description: 'Descripción larga para el sitio público.' })
  description?: string;

  @ApiProperty({
    example: 'ACTIVE',
    description: 'El catálogo público sólo devuelve los enfoques en `ACTIVE`.',
  })
  status!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Archivo de imagen asociado. Se resuelve con el módulo de archivos.',
  })
  imageFileId?: string;

  @ApiProperty({ example: 0, description: 'Orden de presentación. Menor va primero.' })
  sortOrder!: number;
}

export class TherapyProductDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Enfoque terapéutico al que pertenece.' })
  approachId!: string;

  @ApiProperty({ example: 'Sesión individual de 60 minutos', maxLength: 180 })
  name!: string;

  @ApiProperty({ example: 'sesion-individual-60', maxLength: 200 })
  slug!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({
    example: 60,
    description:
      'Duración en minutos. Es el dato que usa `scheduling` para calcular si un hueco da cabida a este producto.',
  })
  durationMinutes!: number;

  @ApiProperty({
    example: '150.00',
    description:
      'Precio con dos decimales. Sequelize serializa `DECIMAL` como cadena para no perder precisión: **no lo trates como número en el cliente sin convertirlo**.',
  })
  price!: string;

  @ApiProperty({ example: 'BOB', maxLength: 3, description: 'Código ISO 4217.' })
  currency!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  imageFileId?: string;

  @ApiProperty({ example: 0 })
  sortOrder!: number;
}
