import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/common/pagination/pagination.dto';

const PUBLICATION_STATUS_ALIASES: Record<string, string> = {
  DRAFT: 'DRAFT',
  BORRADOR: 'DRAFT',
  IN_REVIEW: 'IN_REVIEW',
  EN_REVISION: 'IN_REVIEW',
  REVISION: 'IN_REVIEW',
  SCHEDULED: 'SCHEDULED',
  PROGRAMADO: 'SCHEDULED',
  PROGRAMADA: 'SCHEDULED',
  PUBLISHED: 'PUBLISHED',
  PUBLICADO: 'PUBLISHED',
  PUBLICADA: 'PUBLISHED',
  ACTIVE: 'PUBLISHED',
  ACTIVO: 'PUBLISHED',
  ACTIVA: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
  ARCHIVADO: 'ARCHIVED',
  ARCHIVADA: 'ARCHIVED',
  INACTIVE: 'ARCHIVED',
  INACTIVO: 'ARCHIVED',
  INACTIVA: 'ARCHIVED',
};

function normalizeToken(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function normalizePublicationStatus(value: unknown) {
  const token = normalizeToken(value);
  return token ? (PUBLICATION_STATUS_ALIASES[token] ?? token) : undefined;
}

export class ContentPublicationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['NEWS', 'COLUMN', 'OPINION', 'INTERVIEW', 'REPORT', 'ANALYSIS'] })
  @IsOptional()
  @Transform(({ value }) => normalizeToken(value))
  @IsIn(['NEWS', 'COLUMN', 'OPINION', 'INTERVIEW', 'REPORT', 'ANALYSIS'])
  publicationType?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional()
  @Transform(({ value }) => normalizePublicationStatus(value))
  @IsIn(['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'])
  status?: string;

  @ApiPropertyOptional({ enum: ['PUBLIC', 'PREMIUM', 'INTERNAL_ONLY'] })
  @IsOptional()
  @Transform(({ value }) => normalizeToken(value))
  @IsIn(['PUBLIC', 'PREMIUM', 'INTERNAL_ONLY'])
  accessType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tagSlug?: string;

  @ApiPropertyOptional({
    description: 'Slug de página pública donde debe aparecer/incrustarse la publicación.',
  })
  @IsOptional()
  @IsString()
  pageSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  authorId?: string;
}

export class PublicContentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tagSlug?: string;

  @ApiPropertyOptional({
    description: 'Slug de página pública donde debe aparecer/incrustarse la publicación.',
  })
  @IsOptional()
  @IsString()
  pageSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}
