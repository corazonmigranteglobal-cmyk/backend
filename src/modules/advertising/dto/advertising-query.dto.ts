import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/common/pagination/pagination.dto';

const CAMPAIGN_STATUS_ALIASES: Record<string, string> = {
  ACTIVO: 'ACTIVE',
  ACTIVA: 'ACTIVE',
  ACTIVE: 'ACTIVE',
  BORRADOR: 'DRAFT',
  DRAFT: 'DRAFT',
  PAUSADO: 'PAUSED',
  PAUSADA: 'PAUSED',
  PAUSED: 'PAUSED',
  FINALIZADO: 'ENDED',
  FINALIZADA: 'ENDED',
  ENDED: 'ENDED',
  CANCELADO: 'CANCELLED',
  CANCELADA: 'CANCELLED',
  CANCELLED: 'CANCELLED',
  RECHAZADO: 'REJECTED',
  RECHAZADA: 'REJECTED',
  REJECTED: 'REJECTED',
};

function normalizeCampaignStatus(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  const token = String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return CAMPAIGN_STATUS_ALIASES[token] ?? token;
}

export class AdvertisingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED', 'REJECTED'] })
  @IsOptional()
  @Transform(({ value }) => normalizeCampaignStatus(value))
  @IsIn(['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED', 'REJECTED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;
}

export class PublicAdSlotsQueryDto {
  @ApiPropertyOptional({ example: 'home_hero' })
  @IsOptional()
  @IsString()
  placementCode?: string;

  @ApiPropertyOptional({ example: 'article_sidebar', description: 'Alias público compatible con placement.' })
  @IsOptional()
  @IsString()
  placement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  publicationId?: string;

  @ApiPropertyOptional({ description: 'Alias público compatible con postId.' })
  @IsOptional()
  @IsUUID()
  postId?: string;

  @ApiPropertyOptional({ description: 'Slug de página pública donde se está solicitando publicidad.' })
  @IsOptional()
  @IsString()
  pageSlug?: string;
}
