import { PartialType } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

function normalizeUpper(value: unknown, fallback?: string) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).trim().toUpperCase();
}

function cleanEmail(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export class UpsertContentSubscriberDto {
  @ApiPropertyOptional({ description: 'ID de usuario paciente asociado.' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ example: 'paciente@correo.com' })
  @Transform(({ value }) => cleanEmail(value))
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'Ana Rojas' })
  @IsOptional()
  @IsString()
  @Length(2, 180)
  displayName?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'PENDING', 'UNSUBSCRIBED', 'SUSPENDED'] })
  @IsOptional()
  @Transform(({ value }) => normalizeUpper(value, 'ACTIVE'))
  @IsIn(['ACTIVE', 'PENDING', 'UNSUBSCRIBED', 'SUSPENDED'])
  status?: string;

  @ApiPropertyOptional({ enum: ['FREE', 'PREMIUM'] })
  @IsOptional()
  @Transform(({ value }) => normalizeUpper(value, 'FREE'))
  @IsIn(['FREE', 'PREMIUM'])
  subscriptionTier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  premiumUntil?: string;

  @ApiPropertyOptional({ example: 'admin' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  consentMetadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateContentSubscriberDto extends PartialType(UpsertContentSubscriberDto) {}
