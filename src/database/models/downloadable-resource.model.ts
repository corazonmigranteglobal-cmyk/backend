import { Column, DataType, Model, Table } from 'sequelize-typescript';

export type DownloadableVisibility =
  'PUBLIC' | 'PREMIUM' | 'PRIVATE' | 'PURCHASE_REQUIRED' | 'UNLISTED';

export type DownloadableStatus =
  'DRAFT' | 'IN_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED' | 'REJECTED';

@Table({
  tableName: 'downloadable_resources',
  underscored: true,
  timestamps: true,
  paranoid: true,
})
export class DownloadableResource extends Model<DownloadableResource> {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Column({ type: DataType.STRING(60), allowNull: false, field: 'public_id' })
  publicId: string;

  @Column({ type: DataType.STRING(180), allowNull: false })
  slug: string;

  @Column({ type: DataType.STRING(200), allowNull: false })
  title: string;

  @Column({ type: DataType.STRING(400), allowNull: true, field: 'short_description' })
  shortDescription?: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  description?: string | null;

  @Column({
    type: DataType.STRING(60),
    allowNull: false,
    defaultValue: 'FILE',
    field: 'resource_type',
  })
  resourceType: string;

  @Column({ type: DataType.STRING(120), allowNull: true })
  category?: string | null;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  tags: string[];

  @Column({ type: DataType.TEXT, allowNull: true, field: 'cover_url' })
  coverUrl?: string | null;

  @Column({ type: DataType.STRING(400), allowNull: true, field: 'cover_object_key' })
  coverObjectKey?: string | null;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'file_url' })
  fileUrl?: string | null;

  @Column({ type: DataType.STRING(400), allowNull: true, field: 'file_object_key' })
  fileObjectKey?: string | null;

  @Column({ type: DataType.STRING(300), allowNull: true, field: 'original_name' })
  originalName?: string | null;

  @Column({ type: DataType.STRING(160), allowNull: true, field: 'mime_type' })
  mimeType?: string | null;

  @Column({ type: DataType.STRING(20), allowNull: true })
  extension?: string | null;

  @Column({ type: DataType.BIGINT, allowNull: true, field: 'size_bytes' })
  sizeBytes?: number | null;

  @Column({ type: DataType.STRING(128), allowNull: true })
  checksum?: string | null;

  @Column({
    type: DataType.STRING(40),
    allowNull: false,
    defaultValue: 'CLOUDINARY',
    field: 'storage_provider',
  })
  storageProvider: string;

  @Column({ type: DataType.STRING(30), allowNull: false, defaultValue: 'DRAFT' })
  status: DownloadableStatus;

  @Column({ type: DataType.STRING(30), allowNull: false, defaultValue: 'PUBLIC' })
  visibility: DownloadableVisibility;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'requires_premium',
  })
  requiresPremium: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'requires_purchase',
  })
  requiresPurchase: boolean;

  @Column({ type: DataType.STRING(40), allowNull: true, field: 'commercial_provider' })
  commercialProvider?: string | null;

  @Column({ type: DataType.STRING(120), allowNull: true, field: 'hotmart_product_id' })
  hotmartProductId?: string | null;

  @Column({ type: DataType.STRING(120), allowNull: true, field: 'hotmart_offer_id' })
  hotmartOfferId?: string | null;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'hotmart_checkout_url' })
  hotmartCheckoutUrl?: string | null;

  @Column({ type: DataType.STRING(180), allowNull: true, field: 'external_reference' })
  externalReference?: string | null;

  @Column({
    type: DataType.STRING(40),
    allowNull: false,
    defaultValue: 'NONE',
    field: 'integration_status',
  })
  integrationStatus: string;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'integration_last_error' })
  integrationLastError?: string | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'published_at' })
  publishedAt?: Date | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'expires_at' })
  expiresAt?: Date | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 })
  version: number;

  @Column({ type: DataType.BIGINT, allowNull: false, defaultValue: 0, field: 'download_count' })
  downloadCount: number;

  @Column({ type: DataType.UUID, allowNull: true, field: 'created_by' })
  createdBy?: string | null;

  @Column({ type: DataType.UUID, allowNull: true, field: 'updated_by' })
  updatedBy?: string | null;

  @Column({ type: DataType.UUID, allowNull: true, field: 'approved_by' })
  approvedBy?: string | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'approved_at' })
  approvedAt?: Date | null;
}
