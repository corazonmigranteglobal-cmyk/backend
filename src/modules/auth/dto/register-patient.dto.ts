import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterPatientDto {
  @ApiProperty({ example: 'nuevo@example.com' })
  @Transform(({ value }) => String(value).toLowerCase().trim())
  @IsEmail()
  @MaxLength(254)
  email: string;
  @ApiProperty({ example: 'Demo123456!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
  @ApiProperty({ example: 'Ana' }) @IsString() @MaxLength(100) firstName: string;
  @ApiProperty({ example: 'Rojas' }) @IsString() @MaxLength(100) lastName: string;
  @ApiPropertyOptional({ example: '+59170000000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
  @ApiPropertyOptional({ example: '1998-01-20' }) @IsOptional() @IsDateString() birthDate?: string;
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
  @ApiPropertyOptional({ example: 'Estudiante' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  occupation?: string;
}
