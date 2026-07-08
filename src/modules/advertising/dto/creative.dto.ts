import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Min,
} from 'class-validator';

export class CreateAdsCreativeDto {
  @ApiProperty()
  @IsString()
  @Length(2, 180)
  title: string;

  @ApiPropertyOptional({ enum: ['IMAGE', 'VIDEO', 'HTML', 'NATIVE_CARD'] })
  @IsOptional()
  @IsIn(['IMAGE', 'VIDEO', 'HTML', 'NATIVE_CARD'])
  mediaType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fileId?: string;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  assetUrl: string;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  destinationUrl: string;

  @ApiProperty()
  @IsString()
  @Length(2, 220)
  altText: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateAdsCreativeDto extends PartialType(CreateAdsCreativeDto) {}


export class CreateAdsAdDto extends CreateAdsCreativeDto {
  @ApiProperty()
  @IsUUID()
  campaignId: string;

  @ApiPropertyOptional({ description: 'Publicación específica donde se mostrará este anuncio.' })
  @IsOptional()
  @IsUUID()
  publicationId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Publicaciones específicas donde se mostrará este anuncio.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  @Type(() => String)
  publicationIds?: string[];

  @ApiPropertyOptional({ description: 'Categoría editorial donde se mostrará este anuncio.' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Categorías editoriales donde se mostrará este anuncio.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  @Type(() => String)
  categoryIds?: string[];

  @ApiPropertyOptional({ description: 'Ubicación publicitaria donde se mostrará este anuncio.' })
  @IsOptional()
  @IsUUID()
  placementId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Ubicaciones publicitarias donde se mostrará este anuncio.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  @Type(() => String)
  placementIds?: string[];

  @ApiPropertyOptional({ description: 'Página pública donde se mostrará este anuncio.' })
  @IsOptional()
  @IsString()
  pageSlug?: string;

  @ApiPropertyOptional({ type: [String], description: 'Páginas públicas donde se mostrará este anuncio.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Type(() => String)
  pageSlugs?: string[];
}
