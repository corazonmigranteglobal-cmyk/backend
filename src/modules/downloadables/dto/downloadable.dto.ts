import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export const DOWNLOADABLE_VISIBILITIES = [
  'PUBLIC',
  'PREMIUM',
  'PRIVATE',
  'PURCHASE_REQUIRED',
  'UNLISTED',
] as const;

export const DOWNLOADABLE_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
  'REJECTED',
] as const;

export class CreateDownloadableDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  originalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  mimeType?: string;

  @ApiPropertyOptional({ enum: DOWNLOADABLE_VISIBILITIES })
  @IsOptional()
  @IsIn(DOWNLOADABLE_VISIBILITIES as unknown as string[])
  visibility?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresPremium?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresPurchase?: boolean;
}

export class UpdateDownloadableDto extends PartialType(CreateDownloadableDto) {
  @ApiPropertyOptional({ enum: DOWNLOADABLE_STATUSES })
  @IsOptional()
  @IsIn(DOWNLOADABLE_STATUSES as unknown as string[])
  status?: string;
}

export class HotmartConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  hotmartProductId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  hotmartOfferId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  hotmartCheckoutUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  externalReference?: string;
}

export class CreateVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  changeReason?: string;
}

export class ReviewCommentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  comment?: string;
}

export class GrantEntitlementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  subjectEmail?: string;
}

export class AttachPublicationDto {
  @ApiProperty()
  @IsString()
  resourceId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  sortOrder?: number;
}

export class HotmartNotificationDto {
  @ApiProperty()
  @IsString()
  eventId: string;

  @ApiProperty()
  @IsString()
  productId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buyerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buyerUserId?: string;

  @ApiProperty()
  @IsString()
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalReference?: string;
}
