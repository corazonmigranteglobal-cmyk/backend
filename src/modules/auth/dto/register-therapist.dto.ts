import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class RegisterTherapistDto {
  @ApiProperty({ example: 'terapeuta@example.com' })
  @Transform(({ value }) => String(value).toLowerCase().trim())
  @IsEmail()
  @MaxLength(254)
  email: string;
  @ApiProperty({ example: 'Demo123456!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
  @ApiProperty({ example: 'Luc\u00eda' }) @IsString() @MaxLength(100) firstName: string;
  @ApiProperty({ example: 'Mendoza' }) @IsString() @MaxLength(100) lastName: string;
  @ApiPropertyOptional({ example: '+59170000001' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
  @ApiProperty({ example: 'Psic\u00f3loga' }) @IsString() @MaxLength(120) title: string;
  @ApiProperty({ example: 'Terapia familiar' }) @IsString() @MaxLength(180) mainSpecialty: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) bio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) personalPhrase?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl() @MaxLength(500) youtubeUrl?: string;
  @ApiPropertyOptional({ example: 'MAT-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  licenseNumber?: string;
  @ApiPropertyOptional({ example: 'Bolivia' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
  @ApiPropertyOptional({ example: 'Santa Cruz de la Sierra' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  city?: string;
  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000)
  baseSessionPrice?: number;
}
