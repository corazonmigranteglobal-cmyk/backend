import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class UploadFileDto {
  @ApiProperty({ enum: ['USER_PROFILE', 'THERAPY_CATALOG', 'CMS', 'APPOINTMENT'] })
  @IsIn(['USER_PROFILE', 'THERAPY_CATALOG', 'CMS', 'APPOINTMENT'])
  module: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ enum: ['PRIVATE', 'PUBLIC'] })
  @IsOptional()
  @IsIn(['PRIVATE', 'PUBLIC'])
  visibility?: string;
}

export class UpdateFileDto {
  @ApiPropertyOptional({ enum: ['USER_PROFILE', 'THERAPY_CATALOG', 'CMS', 'APPOINTMENT'] })
  @IsOptional()
  @IsIn(['USER_PROFILE', 'THERAPY_CATALOG', 'CMS', 'APPOINTMENT'])
  module?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ enum: ['PRIVATE', 'PUBLIC'] })
  @IsOptional()
  @IsIn(['PRIVATE', 'PUBLIC'])
  visibility?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originalName?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CloudinaryUploadSignatureDto {
  @ApiProperty({ enum: ['USER_PROFILE', 'THERAPY_CATALOG', 'CMS', 'APPOINTMENT'] })
  @IsIn(['USER_PROFILE', 'THERAPY_CATALOG', 'CMS', 'APPOINTMENT'])
  module: string;

  @ApiProperty()
  @IsString()
  originalName: string;

  @ApiProperty({ enum: ['image/png', 'image/jpeg', 'image/webp'] })
  @IsIn(['image/png', 'image/jpeg', 'image/webp'])
  mimeType: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  sizeBytes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ enum: ['PRIVATE', 'PUBLIC'] })
  @IsOptional()
  @IsIn(['PRIVATE', 'PUBLIC'])
  visibility?: string;
}

export class CompleteCloudinaryUploadDto {
  @ApiProperty()
  @IsString()
  uploadToken: string;

  @ApiProperty()
  @IsString()
  publicId: string;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  secureUrl: string;

  @ApiProperty()
  @IsString()
  assetId: string;

  @ApiProperty()
  @IsString()
  version: string;

  @ApiProperty()
  @IsString()
  format: string;

  @ApiProperty()
  @IsString()
  resourceType: string;

  @ApiProperty()
  @IsString()
  signature: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  bytes: number;
}
