import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdatePatientProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() birthDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() occupation?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() avatarFileId?: string;
}

export class UpdateTherapistProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mainSpecialty?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() personalPhrase?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() licenseNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() avatarFileId?: string;
}

export class UpdateUserAvatarDto {
  @ApiProperty({ description: 'Id del archivo creado por POST /api/v1/files.' })
  @IsUUID()
  avatarFileId: string;
}

export class UpdateUserStatusDto {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING'] })
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING'])
  status: string;
}
