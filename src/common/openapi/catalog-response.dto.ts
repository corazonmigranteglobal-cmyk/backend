import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Formas de respuesta de los módulos transversales y de administración.
 *
 * Se agrupan aquí porque son entidades que varios módulos consultan y porque
 * ninguna de ellas tiene un DTO de entrada del que colgar. Cada clase refleja
 * las columnas del modelo tal y como las serializa Sequelize; si cambia una
 * columna, hay que cambiarla aquí en el mismo commit.
 */

// ------------------------------------------------------------------ Auditoría
export class AuditLogDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Cuenta que ejecutó la acción. Vacío en acciones del sistema.',
  })
  actorUserId?: string;

  @ApiProperty({ example: 'appointment.status_changed', maxLength: 100 })
  action!: string;

  @ApiProperty({ example: 'Appointment', maxLength: 100 })
  entityType!: string;

  @ApiPropertyOptional({ maxLength: 100 })
  entityId?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Estado anterior, **redactado**: los campos sensibles se eliminan antes de persistir.',
  })
  before?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Estado posterior, redactado.',
  })
  after?: Record<string, unknown>;

  @ApiPropertyOptional({ maxLength: 80 })
  ipAddress?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  userAgent?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

// ------------------------------------------------------------------ Analítica
export class UiEventDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({
    maxLength: 120,
    description:
      'Sesión anónima del navegador. **No identifica a una persona**: los eventos sirven para agregados, no para seguimiento individual.',
  })
  sessionId?: string;

  @ApiProperty({ example: 'homepage.cta_clicked', maxLength: 120 })
  eventName!: string;

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Datos del evento.' })
  payload!: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

// ------------------------------------------------------------- Notificaciones
export class AdminNotificationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'appointment.created', maxLength: 100 })
  type!: string;

  @ApiPropertyOptional({ example: 'Appointment', maxLength: 100 })
  entityType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  entityId?: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  payload!: Record<string, unknown>;

  @ApiProperty({ example: false })
  isRead!: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  readAt?: string | null;

  @ApiProperty({
    example: 'ADMIN',
    maxLength: 50,
    description: 'Rol al que va dirigida. Las notificaciones nunca son visibles para pacientes.',
  })
  recipientRole!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

// ---------------------------------------------------------------- Mensajería
export class OutboxMessageDto {
  @ApiProperty({
    example: 1042,
    description:
      'Identificador secuencial. Es `BIGINT`, así que puede exceder el entero seguro de JavaScript.',
  })
  id!: number;

  @ApiProperty({ example: 'EMAIL' })
  channel!: string;

  @ApiProperty({ example: 'persona@example.com', description: 'Destinatario del mensaje.' })
  recipient!: string;

  @ApiProperty({
    enum: [
      'WELCOME_PATIENT',
      'PASSWORD_RESET_PIN',
      'APPOINTMENT_REQUESTED',
      'APPOINTMENT_STATUS_CHANGED',
      'SMOKE_TEST_EMAIL',
    ],
    example: 'APPOINTMENT_REQUESTED',
    description:
      'Tipo de mensaje. Decide la plantilla y la forma de `payload`. El contrato AsyncAPI (`asyncapi/asyncapi.yaml`) es la referencia y `yarn docs:asyncapi:lint` falla si aparece un tipo nuevo sin declarar.',
  })
  templateCode!: string;

  @ApiPropertyOptional()
  templateKey?: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Variables de la plantilla.',
  })
  payload!: Record<string, unknown>;

  @ApiProperty({
    enum: ['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED'],
    example: 'PENDING',
    description:
      'Estado del envío. La API lo traduce desde el valor almacenado, que está en español por motivos históricos. Los mensajes agotados se quedan en este mismo almacén con estado `FAILED`: no hay cola de fallidos aparte.',
  })
  status!: string;

  @ApiProperty({ example: 5, description: 'Prioridad. Menor se procesa antes.' })
  priority!: number;

  @ApiProperty({ example: 0 })
  attempts!: number;

  @ApiProperty({ example: 6, description: 'Intentos máximos antes de darlo por fallido.' })
  maxAttempts!: number;

  @ApiProperty({
    format: 'date-time',
    description:
      'Momento a partir del cual el worker puede tomarlo. Lo desplaza el retroceso exponencial.',
  })
  scheduledAt!: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Cuándo lo bloqueó un worker. Caduca a los `OUTBOX_STALE_LOCK_MS`.',
  })
  lockedAt?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  lockedBy?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Último error devuelto por el proveedor.',
  })
  lastError?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  sentAt?: string | null;
}

// ------------------------------------------------------------------- Agenda
export class TherapistScheduleDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  therapistUserId!: string;

  @ApiProperty({
    example: 1,
    minimum: 0,
    maximum: 6,
    description: 'Día de la semana. Define el horario **recurrente** que se ofrece.',
  })
  weekday!: number;

  @ApiProperty({
    example: '09:00:00',
    description: 'Hora local de inicio, en la zona de `timezone`.',
  })
  startTime!: string;

  @ApiProperty({ example: '13:00:00' })
  endTime!: string;

  @ApiProperty({ example: 'America/La_Paz' })
  timezone!: string;

  @ApiProperty({ format: 'date', description: 'Fecha desde la que rige este horario.' })
  effectiveFrom!: string;

  @ApiPropertyOptional({ format: 'date', description: 'Vacío si sigue vigente.' })
  effectiveTo?: string;

  @ApiProperty({
    example: 1,
    description: 'Versión del horario. Cambiarlo crea una versión nueva en vez de sobrescribir.',
  })
  version!: number;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;
}

export class TherapistBlockedTimeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  therapistUserId!: string;

  @ApiProperty({ format: 'date-time', description: 'Inicio del bloqueo, en UTC.' })
  startAt!: string;

  @ApiProperty({ format: 'date-time', description: 'Fin del bloqueo, en UTC.' })
  endAt!: string;

  @ApiPropertyOptional({ maxLength: 255, description: 'Motivo, para uso interno.' })
  reason?: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;
}

// ------------------------------------------------------------------ Cuentas
export class UserAccountDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email', maxLength: 180 })
  email!: string;

  @ApiProperty({
    example: 'ACTIVE',
    description: 'Un terapeuta permanece en `PENDING_APPROVAL` hasta que se le aprueba.',
  })
  status!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  emailVerifiedAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  lastLoginAt?: string;
}
