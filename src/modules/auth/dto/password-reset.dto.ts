import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';
export class RequestPasswordResetDto {
  @ApiProperty()
  @Transform(({ value }) => String(value).toLowerCase().trim())
  @IsEmail()
  @MaxLength(254)
  email: string;
}
export class ResetPasswordDto {
  @ApiProperty()
  @Transform(({ value }) => String(value).toLowerCase().trim())
  @IsEmail()
  @MaxLength(254)
  email: string;
  @ApiProperty({ example: '123456' }) @IsString() @Length(6, 6) pin: string;
  @ApiProperty({ example: 'NuevaClave123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
