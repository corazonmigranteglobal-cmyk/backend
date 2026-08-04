import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Formas de respuesta del módulo de recursos descargables.
 *
 * @see src/database/models/downloadable-resource.model.ts
 * @see src/database/models/downloadable-entitlement.model.ts
 */
export class DownloadableResourceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    description: 'Identificador público del recurso, estable frente a cambios internos.',
  })
  publicId!: string;

  @ApiProperty({ example: 'guia-de-derechos-migratorios' })
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  shortDescription?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  description?: string | null;

  @ApiProperty({ example: 'PDF' })
  resourceType!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  category?: string | null;

  @ApiProperty({ type: [String], example: ['derechos', 'migracion'] })
  tags!: string[];

  @ApiPropertyOptional({ type: String, format: 'uri', nullable: true })
  coverUrl?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uri',
    nullable: true,
    description:
      'URL del archivo. **Sólo llega cuando la identidad tiene un derecho de acceso vigente**; en caso contrario viaja vacía.',
  })
  fileUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  originalName?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'application/pdf' })
  mimeType?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'pdf' })
  extension?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 2483712 })
  sizeBytes?: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Suma de verificación del archivo.',
  })
  checksum?: string | null;

  @ApiProperty({ enum: ['LOCAL', 'GCS', 'CLOUDINARY'], example: 'GCS' })
  storageProvider!: string;

  @ApiProperty({ example: false, description: 'Exige suscripción premium activa.' })
  requiresPremium!: boolean;

  @ApiProperty({
    example: true,
    description: 'Exige una compra confirmada. La confirma Hotmart, no este backend.',
  })
  requiresPurchase!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'HOTMART' })
  commercialProvider?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  hotmartProductId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  hotmartOfferId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uri', nullable: true })
  hotmartCheckoutUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  externalReference?: string | null;

  @ApiProperty({ example: 'OK', description: 'Estado de la integración comercial.' })
  integrationStatus!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  integrationLastError?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  publishedAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  expiresAt?: string | null;

  @ApiProperty({
    example: 3,
    description:
      'Versión vigente. Una descarga apunta a una versión concreta, para que actualizar el material no invalide lo que alguien ya compró.',
  })
  version!: number;

  @ApiProperty({ example: 128 })
  downloadCount!: number;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  createdBy?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  updatedBy?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  approvedBy?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  approvedAt?: string | null;
}

export class DownloadableEntitlementDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  resourceId!: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Cuenta beneficiaria. Vacío si el derecho se concedió sólo por correo.',
  })
  userId?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'email',
    nullable: true,
    description: 'Correo al que se concedió, cuando la compra llegó antes de existir la cuenta.',
  })
  subjectEmail?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Referencia del proveedor externo que originó la concesión.',
  })
  externalReference?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  externalTransaction?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Quién lo concedió a mano.',
  })
  grantedBy?: string | null;

  @ApiProperty({ format: 'date-time' })
  grantedAt!: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Fecha de revocación, típicamente tras un reembolso notificado por Hotmart.',
  })
  revokedAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  expiresAt?: string | null;
}

export class DownloadableAccessDto {
  @ApiProperty({
    example: true,
    description: 'Si la identidad tiene derecho de acceso vigente sobre el recurso.',
  })
  granted!: boolean;

  @ApiPropertyOptional({
    example: 'REQUIRES_PURCHASE',
    description: 'Motivo del rechazo cuando `granted` es falso.',
  })
  reason?: string;

  @ApiPropertyOptional({
    format: 'uri',
    description: 'Enlace de compra al que dirigir a la persona cuando falta el derecho.',
  })
  checkoutUrl?: string;
}
