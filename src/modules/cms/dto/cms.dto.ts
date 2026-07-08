import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
export class CreatePageDto {
  @ApiProperty() @IsString() slug: string;
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED'])
  status?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() seoMetadata?: Record<string, unknown>;
}
export class CreateElementDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() type: string;
  @ApiProperty() @IsObject() content: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() sortOrder?: number;
}

export class UpdatePageDto extends PartialType(CreatePageDto) {}

export class AttachPublicationToPageDto {
  @ApiProperty()
  @IsUUID()
  publicationId: string;
}
