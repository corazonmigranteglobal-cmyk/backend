import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'downloadable_publication_links', underscored: true, timestamps: false, paranoid: false })
export class DownloadablePublicationLink extends Model<DownloadablePublicationLink> {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'publication_id' })
  publicationId: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'resource_id' })
  resourceId: string;

  @Column({ type: DataType.STRING(120), allowNull: true })
  label?: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_primary' })
  isPrimary: boolean;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' })
  sortOrder: number;

  @Column({ type: DataType.UUID, allowNull: true, field: 'created_by' })
  createdBy?: string | null;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW, field: 'created_at' })
  createdAt: Date;
}
