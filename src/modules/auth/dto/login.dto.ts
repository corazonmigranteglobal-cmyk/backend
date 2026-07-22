import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'paciente.demo@corazonmigrante.test' })
  @Transform(({ value }) => String(value).toLowerCase().trim())
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Demo123456!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
