import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({
  tableName: 'admin_notifications',
  underscored: true,
  timestamps: false,
  paranoid: false,
})
export class AdminNotification extends Model<AdminNotification> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id: string;

  /** Event type, e.g. APPOINTMENT_REQUESTED, USER_REGISTERED, etc. */
  @Column({ type: DataType.STRING(100), allowNull: false })
  type: string;

  /** Entity class name related to the event */
  @Column({ type: DataType.STRING(100), allowNull: true })
  entityType?: string;

  /** Entity primary key */
  @Column({ type: DataType.UUID, allowNull: true, field: 'entity_id' })
  entityId?: string;

  /** Arbitrary JSON payload for rendering the notification */
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  payload: Record<string, unknown>;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_read' })
  isRead: boolean;

  @Column({ type: DataType.DATE, allowNull: true, field: 'read_at' })
  readAt?: Date | null;

  /** Which admin role should receive this notification */
  @Column({ type: DataType.STRING(50), allowNull: false, defaultValue: 'ADMIN', field: 'recipient_role' })
  recipientRole: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'created_at',
  })
  createdAt: Date;
}
