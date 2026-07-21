import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'downloadable_resource_versions', underscored: true, timestamps: true, paranoid: false })
export class DownloadableResourceVersion extends Model<DownloadableResourceVersion> {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'resource_id' })
  resourceId: string;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'version_number' })
  versionNumber: number;

  @Column({ type: DataType.STRING(30), allowNull: false, defaultValue: 'DRAFT' })
  status: string;

  @Column({ type: DataType.STRING(200), allowNull: true })
  title?: string | null;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  metadata: Record<string, unknown>;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'file_url' })
  fileUrl?: string | null;

  @Column({ type: DataType.STRING(400), allowNull: true, field: 'file_object_key' })
  fileObjectKey?: string | null;

  @Column({ type: DataType.STRING(400), allowNull: true, field: 'change_reason' })
  changeReason?: string | null;

  @Column({ type: DataType.STRING(600), allowNull: true, field: 'review_comment' })
  reviewComment?: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_published' })
  isPublished: boolean;

  @Column({ type: DataType.UUID, allowNull: true, field: 'author_id' })
  authorId?: string | null;

  @Column({ type: DataType.UUID, allowNull: true, field: 'reviewed_by' })
  reviewedBy?: string | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'reviewed_at' })
  reviewedAt?: Date | null;
}
