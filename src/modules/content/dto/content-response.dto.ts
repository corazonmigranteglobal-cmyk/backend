import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Formas de respuesta del módulo de contenido editorial.
 *
 * Reflejan las columnas de los modelos tal y como las serializa Sequelize.
 *
 * @see src/database/models/content-publication.model.ts
 * @see src/database/models/content-category.model.ts
 * @see src/database/models/content-tag.model.ts
 * @see src/database/models/content-author.model.ts
 */
export class ContentPublicationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  authorId!: string;

  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Imagen de portada, resuelta vía archivos.' })
  coverFileId?: string;

  @ApiProperty({
    example: 'nuevas-rutas-de-acompanamiento',
    description: 'Identificador estable en la URL pública. Es único.',
  })
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ description: 'Entradilla que se muestra en listados.' })
  summary!: string;

  @ApiProperty({ description: 'Cuerpo completo. En contenido premium sólo llega si hay acceso.' })
  body!: string;

  @ApiPropertyOptional({
    description: 'Transcripción del audio, cuando la publicación lo incluye.',
  })
  audioTranscript?: string;

  @ApiProperty({
    enum: ['NEWS', 'COLUMN', 'OPINION', 'INTERVIEW', 'REPORT', 'ANALYSIS'],
    example: 'NEWS',
  })
  publicationType!: string;

  @ApiProperty({
    enum: ['PUBLIC', 'PREMIUM', 'INTERNAL_ONLY'],
    example: 'PUBLIC',
    description:
      'Dimensión **independiente** del estado: una publicación puede estar `PUBLISHED` y ser `PREMIUM`, es decir publicada pero legible sólo con suscripción activa.',
  })
  accessType!: string;

  @ApiProperty({
    enum: ['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'],
    example: 'PUBLISHED',
    description: 'Las transiciones válidas las decide `policies/publication-status.policy.ts`.',
  })
  status!: string;

  @ApiProperty({ example: true })
  commentsEnabled!: boolean;

  @ApiProperty({ example: true })
  reactionsEnabled!: boolean;

  @ApiPropertyOptional({ format: 'date-time' })
  publishedAt?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Fecha de publicación programada, cuando el estado es `SCHEDULED`.',
  })
  scheduledAt?: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Metadatos de posicionamiento: título, descripción y etiquetas sociales.',
  })
  seoMetadata!: Record<string, unknown>;
}

export class ContentCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'salud-mental' })
  slug!: string;

  @ApiProperty({ example: 'Salud mental' })
  name!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 0, description: 'Orden de presentación. Menor va primero.' })
  sortOrder!: number;
}

export class ContentTagDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'migracion' })
  slug!: string;

  @ApiProperty({ example: 'Migración' })
  name!: string;
}

export class ContentAuthorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Cuenta asociada, si quien firma tiene acceso a la plataforma.',
  })
  userId?: string;

  @ApiProperty({ example: 'Lucía Fernández' })
  displayName!: string;

  @ApiPropertyOptional({ description: 'Titular corto que acompaña a la firma.' })
  headline?: string;

  @ApiPropertyOptional()
  bio?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  avatarFileId?: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown>;
}
