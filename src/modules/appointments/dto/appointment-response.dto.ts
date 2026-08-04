import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Forma de respuesta de una cita, tal y como la serializa Sequelize.
 *
 * @see src/database/models/appointment.model.ts
 */
export class AppointmentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Cuenta de la persona paciente.' })
  patientUserId!: string;

  @ApiProperty({ format: 'uuid', description: 'Cuenta de la terapeuta que atiende.' })
  therapistUserId!: string;

  @ApiProperty({ format: 'uuid', description: 'Producto terapéutico reservado.' })
  productId!: string;

  @ApiProperty({
    format: 'date-time',
    description: 'Inicio programado, en UTC. La zona horaria de presentación va en `timezone`.',
  })
  scheduledStartAt!: string;

  @ApiProperty({ format: 'date-time', description: 'Fin programado, en UTC.' })
  scheduledEndAt!: string;

  @ApiProperty({
    example: 'America/La_Paz',
    description:
      'Zona horaria en la que se acordó la cita. Se persiste porque el centro atiende a personas en husos distintos y una hora sin huso es ambigua.',
  })
  timezone!: string;

  @ApiProperty({
    example: 'REQUESTED',
    description:
      'Estado actual. Las transiciones válidas las decide `policies/status-transition.policy.ts` y cada cambio queda en `appointment_status_history`.',
  })
  status!: string;

  @ApiProperty({
    example: '150.00',
    description:
      'Precio acordado, congelado en el momento de reservar. Sequelize serializa `DECIMAL` como cadena.',
  })
  price!: string;

  @ApiProperty({ example: 'BOB', maxLength: 3 })
  currency!: string;

  @ApiPropertyOptional({
    description: 'Notas que la persona paciente dirige a la terapeuta. **Dato clínico sensible.**',
  })
  notesForTherapist?: string;

  @ApiPropertyOptional({
    description: 'Notas internas de administración. No se muestran a la persona paciente.',
  })
  adminNotes?: string;

  @ApiProperty({ example: false })
  isPaid!: boolean;

  @ApiPropertyOptional({ format: 'date-time' })
  paidAt?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Transacción contable generada al facturar la cita atendida.',
  })
  saleTransactionId?: string;
}
