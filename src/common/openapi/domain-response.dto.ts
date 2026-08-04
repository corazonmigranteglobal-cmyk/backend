import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Formas de respuesta de publicidad, CMS, portada, archivos y contabilidad.
 *
 * Reflejan las columnas de los modelos tal y como las serializa Sequelize. Si
 * cambia una columna, hay que cambiarla aquí en el mismo commit: el contrato no
 * puede detectar esa deriva por sí solo.
 */

// --------------------------------------------------------------- Publicidad
export class AdsCompanyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Migrantes Unidos S.R.L.', description: 'Razón social.' })
  businessName!: string;

  @ApiProperty({ example: 'Migrantes Unidos', description: 'Nombre comercial.' })
  commercialName!: string;

  @ApiPropertyOptional({ description: 'Identificación fiscal.' })
  taxId?: string;

  @ApiPropertyOptional()
  contactName?: string;

  @ApiPropertyOptional({ format: 'email' })
  contactEmail?: string;

  @ApiPropertyOptional()
  contactPhone?: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown>;
}

export class AdsPlacementDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    example: 'HOME_SIDEBAR_TOP',
    description: 'Código estable con el que el frontend pide el anuncio de este hueco.',
  })
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ example: 'HOMEPAGE', description: 'Zona del sitio en la que aparece.' })
  context!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Medidas esperadas de la creatividad, para validar lo que se sube.',
  })
  dimensions!: Record<string, unknown>;
}

export class AdsCampaignDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  createdByUserId?: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: 'BRAND_AWARENESS' })
  objective!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({
    format: 'date-time',
    description:
      'Una campaña no puede terminar antes de empezar: lo valida `campaign-date.policy.ts`.',
  })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty({
    example: '5000.00',
    description: 'Presupuesto. Sequelize serializa `DECIMAL` como cadena para no perder precisión.',
  })
  budgetAmount!: string;

  @ApiProperty({ example: 'BOB', maxLength: 3 })
  currency!: string;

  @ApiProperty({
    example: 5,
    description: 'Prioridad frente a otras campañas del mismo emplazamiento.',
  })
  priority!: number;

  @ApiProperty({ example: 'EVEN', description: 'Ritmo de reparto del presupuesto.' })
  pacing!: string;

  @ApiPropertyOptional()
  notes?: string;
}

export class AdsCreativeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  campaignId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Archivo asociado, si se subió por la API.' })
  fileId?: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ example: 'IMAGE' })
  mediaType!: string;

  @ApiProperty({ format: 'uri', description: 'URL desde la que se sirve la pieza.' })
  assetUrl!: string;

  @ApiProperty({ format: 'uri', description: 'Destino al que lleva el clic.' })
  destinationUrl!: string;

  @ApiProperty({
    description: 'Texto alternativo. Es obligatorio: sin él la pieza no es accesible.',
  })
  altText!: string;

  @ApiPropertyOptional()
  mimeType?: string;

  @ApiPropertyOptional({ example: 300 })
  width?: number;

  @ApiPropertyOptional({ example: 250 })
  height?: number;

  @ApiProperty({ example: 48213 })
  sizeBytes!: number;

  @ApiProperty({ example: 'APPROVED' })
  approvalStatus!: string;

  @ApiProperty({ example: false, description: 'La pieza principal de la campaña.' })
  isPrimary!: boolean;
}

// ---------------------------------------------------------------------- CMS
export class CmsPageDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'quienes-somos' })
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({
    example: 'PUBLISHED',
    description: 'El listado público sólo devuelve las publicadas.',
  })
  status!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  seoMetadata!: Record<string, unknown>;

  @ApiPropertyOptional({ format: 'date-time' })
  publishedAt?: string;
}

export class CmsElementDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  pageId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  fileId?: string;

  @ApiProperty({
    example: 0,
    description:
      'Orden dentro de la página. Una página es un contenedor de elementos ordenados, no un bloque de HTML: así el frontend decide cómo renderizar cada tipo.',
  })
  sortOrder!: number;
}

// ------------------------------------------------------------------ Portada
export class HomepageSectionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'DESTACADOS', description: 'Código estable de la sección.' })
  code!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ example: 'PUBLICATIONS', description: 'Qué tipo de elementos agrupa.' })
  type!: string;

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown>;
}

export class HomepageFeaturedItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  sectionId!: string;

  @ApiProperty({
    example: 'PUBLICATION',
    description: 'Qué dominio posee el elemento destacado. La portada sólo compone; no crea nada.',
  })
  itemType!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Identificador del elemento en su dominio de origen.',
  })
  itemId!: string;

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown>;
}

// ----------------------------------------------------------------- Archivos
export class FileAssetDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  ownerUserId!: string;

  @ApiProperty({ example: 'content', maxLength: 60, description: 'Módulo que posee el archivo.' })
  module!: string;

  @ApiPropertyOptional({ maxLength: 80 })
  entityType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  entityId?: string;

  @ApiProperty({
    enum: ['LOCAL', 'GCS', 'CLOUDINARY'],
    example: 'CLOUDINARY',
    description: 'Proveedor donde reside el objeto. Lo decide `STORAGE_PROVIDER` al subirlo.',
  })
  storageProvider!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  bucket?: string;

  @ApiProperty({ maxLength: 500, description: 'Clave del objeto dentro del proveedor.' })
  objectKey!: string;

  @ApiProperty({ maxLength: 255 })
  originalName!: string;

  @ApiProperty({ example: 'application/pdf', maxLength: 120 })
  mimeType!: string;

  @ApiProperty({ example: 184320 })
  sizeBytes!: number;

  @ApiPropertyOptional({ maxLength: 128 })
  checksum?: string;

  @ApiProperty({
    enum: ['PRIVATE', 'PUBLIC'],
    example: 'PRIVATE',
    description:
      'Los privados sólo se sirven mediante URL firmada temporal. Todo acceso queda en `file_access_log`.',
  })
  visibility!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown>;
}

export class SignedUrlDto {
  @ApiProperty({
    format: 'uri',
    description: 'URL temporal de descarga directa desde el proveedor.',
  })
  url!: string;

  @ApiProperty({
    example: 900,
    description:
      'Segundos de validez (`FILE_SIGNED_URL_EXPIRES_SECONDS`). La URL es transferible durante ese plazo: lo que autoriza es el enlace, no la sesión.',
  })
  expiresIn!: number;
}

// ------------------------------------------------------------- Contabilidad
export class AccountGroupDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '1', description: 'Código dentro del plan de cuentas.' })
  code!: string;

  @ApiProperty({ example: 'Activo' })
  name!: string;

  @ApiProperty({ example: 'ASSET' })
  type!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;
}

export class AccountDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Grupo del plan de cuentas al que pertenece.' })
  groupId!: string;

  @ApiProperty({ example: '1101' })
  code!: string;

  @ApiProperty({ example: 'Caja' })
  name!: string;

  @ApiProperty({
    enum: ['DEBIT', 'CREDIT'],
    example: 'DEBIT',
    description: 'Saldo natural de la cuenta.',
  })
  normalBalance!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;
}

export class CostCenterDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CC-01' })
  code!: string;

  @ApiProperty({ example: 'Consulta terapéutica' })
  name!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;
}

export class AccountingEntryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  transactionId!: string;

  @ApiProperty({ format: 'uuid' })
  accountId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  costCenterId?: string;

  @ApiProperty({ example: '150.00', description: 'Importe al debe.' })
  debit!: string;

  @ApiProperty({ example: '0.00', description: 'Importe al haber.' })
  credit!: string;
}

export class AccountingTransactionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date', description: 'Fecha contable, no la de registro.' })
  date!: string;

  @ApiProperty()
  description!: string;

  @ApiPropertyOptional({ description: 'Referencia externa: número de factura o recibo.' })
  reference?: string;

  @ApiProperty({ example: 'POSTED' })
  status!: string;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiPropertyOptional({
    type: [AccountingEntryDto],
    description:
      'Asientos que la componen, cuando la operación los incluye. Una transacción descuadrada no se persiste: la partida doble es real.',
  })
  entries?: AccountingEntryDto[];
}
