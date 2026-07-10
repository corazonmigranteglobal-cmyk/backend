import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
export class CreateAppointmentDto {
  @ApiProperty() @IsUUID() therapistUserId: string;
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty() @IsISO8601() scheduledStartAt: string;
  @ApiProperty({ example: 'America/La_Paz' }) @IsString() timezone: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notesForTherapist?: string;
  @ApiPropertyOptional({
    description:
      'Solo para booking asistido (ADMIN/SUPER_ADMIN/THERAPIST vía POST /appointments/admin): ID del paciente para el que se registra la cita.',
  })
  @IsOptional()
  @IsUUID()
  patientUserId?: string;
}
export class CreateAppointmentForPatientDto extends CreateAppointmentDto {
  @ApiProperty({ description: 'ID del paciente para el que se registra la cita.' })
  @IsUUID()
  patientUserId: string;
}
export class UpdateAppointmentStatusDto {
  @ApiProperty({
    enum: [
      'CONFIRMED',
      'COMPLETED',
      'CANCELLED_BY_PATIENT',
      'CANCELLED_BY_ADMIN',
      'CANCELLED_BY_THERAPIST',
      'NO_SHOW',
    ],
  })
  @IsIn([
    'CONFIRMED',
    'COMPLETED',
    'CANCELLED_BY_PATIENT',
    'CANCELLED_BY_ADMIN',
    'CANCELLED_BY_THERAPIST',
    'NO_SHOW',
  ])
  status: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}
export class UpdateAppointmentAdminDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() therapistUserId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() scheduledStartAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() scheduledEndAt?: string;
  @ApiPropertyOptional({
    enum: [
      'REQUESTED',
      'CONFIRMED',
      'COMPLETED',
      'CANCELLED_BY_PATIENT',
      'CANCELLED_BY_ADMIN',
      'CANCELLED_BY_THERAPIST',
      'NO_SHOW',
    ],
  })
  @IsOptional()
  @IsIn([
    'REQUESTED',
    'CONFIRMED',
    'COMPLETED',
    'CANCELLED_BY_PATIENT',
    'CANCELLED_BY_ADMIN',
    'CANCELLED_BY_THERAPIST',
    'NO_SHOW',
  ])
  status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adminNotes?: string;
}
export class UpdateAppointmentPaymentDto {
  @ApiProperty({ description: 'true si la cita ya fue pagada, false para revertirlo.' })
  @IsBoolean()
  isPaid: boolean;
}
