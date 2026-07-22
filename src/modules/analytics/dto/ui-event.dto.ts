import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
export class CreateUiEventDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) sessionId?: string;
  @ApiProperty() @IsString() @MaxLength(120) eventName: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() payload?: Record<string, unknown>;
}
