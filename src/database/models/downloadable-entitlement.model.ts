import { Column, DataType, Model, Table } from 'sequelize-typescript';

export type EntitlementSource = 'ADMIN_GRANT' | 'PREMIUM' | 'PURCHASE' | 'ROLE' | 'TEAM' | 'PROMOTION' | 'TEMPORARY';
export type EntitlementStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

@Table({ tableName: 'downloadable_entitlements', underscored: true, timestamps: false, paranoid: false })
export class DownloadableEntitlement extends Model<DownloadableEntitlement> {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'resource_id' })
  resourceId: string;

  @Column({ type: DataType.UUID, allowNull: true, field: 'user_id' })
  userId?: string | null;

  @Column({ type: DataType.STRING(180), allowNull: true, field: 'subject_email' })
  subjectEmail?: string | null;

  @Column({ type: DataType.STRING(40), allowNull: false, defaultValue: 'ADMIN_GRANT' })
  source: EntitlementSource;

  @Column({ type: DataType.STRING(30), allowNull: false, defaultValue: 'ACTIVE' })
  status: EntitlementStatus;

  @Column({ type: DataType.STRING(180), allowNull: true, field: 'external_reference' })
  externalReference?: string | null;

  @Column({ type: DataType.STRING(180), allowNull: true, field: 'external_transaction' })
  externalTransaction?: string | null;

  @Column({ type: DataType.UUID, allowNull: true, field: 'granted_by' })
  grantedBy?: string | null;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW, field: 'granted_at' })
  grantedAt: Date;

  @Column({ type: DataType.DATE, allowNull: true, field: 'revoked_at' })
  revokedAt?: Date | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'expires_at' })
  expiresAt?: Date | null;
}
