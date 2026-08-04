import { Column, DataType, Model, Table } from 'sequelize-typescript';

export type DownloadResult = 'REQUESTED' | 'AUTHORIZED' | 'DENIED' | 'COMPLETED' | 'FAILED';

/**
 * Auditoría de descargas. No guarda tokens ni URLs firmadas completas:
 * solo el resultado y el método de autorización.
 */
@Table({
  tableName: 'downloadable_download_events',
  underscored: true,
  timestamps: false,
  paranoid: false,
})
export class DownloadableDownloadEvent extends Model<DownloadableDownloadEvent> {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'resource_id' })
  resourceId: string;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'resource_version' })
  resourceVersion?: number | null;

  @Column({ type: DataType.UUID, allowNull: true, field: 'user_id' })
  userId?: string | null;

  @Column({ type: DataType.STRING(30), allowNull: false })
  result: DownloadResult;

  @Column({ type: DataType.STRING(40), allowNull: true, field: 'access_method' })
  accessMethod?: string | null;

  @Column({ type: DataType.STRING(30), allowNull: true })
  visibility?: string | null;

  @Column({ type: DataType.STRING(80), allowNull: true, field: 'correlation_id' })
  correlationId?: string | null;

  @Column({ type: DataType.STRING(128), allowNull: true, field: 'ip_hash' })
  ipHash?: string | null;

  @Column({ type: DataType.STRING(400), allowNull: true, field: 'user_agent' })
  userAgent?: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'created_at',
  })
  createdAt: Date;
}
