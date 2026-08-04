import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({
  tableName: 'downloadable_external_events',
  underscored: true,
  timestamps: false,
  paranoid: false,
})
export class DownloadableExternalEvent extends Model<DownloadableExternalEvent> {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Column({ type: DataType.STRING(40), allowNull: false, defaultValue: 'HOTMART' })
  provider: string;

  @Column({ type: DataType.STRING(180), allowNull: false, field: 'event_id' })
  eventId: string;

  @Column({ type: DataType.STRING(120), allowNull: true, field: 'product_id' })
  productId?: string | null;

  @Column({ type: DataType.STRING(40), allowNull: true })
  status?: string | null;

  @Column({ type: DataType.STRING(180), allowNull: true, field: 'external_reference' })
  externalReference?: string | null;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  payload: Record<string, unknown>;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  processed: boolean;

  @Column({ type: DataType.STRING(40), allowNull: true })
  result?: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'created_at',
  })
  createdAt: Date;
}
