import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { User } from './user.model';

@Table({ tableName: 'content_subscribers', underscored: true, timestamps: true, paranoid: true })
export class ContentSubscriber extends Model<ContentSubscriber> {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true }) id: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, field: 'user_id' })
  userId?: string;

  @Column({ type: DataType.STRING(180), allowNull: false })
  email: string;

  @Column({ type: DataType.STRING(180), field: 'display_name' })
  displayName?: string;

  @Column({ type: DataType.STRING(40), allowNull: false, defaultValue: 'ACTIVE' })
  status: string;

  @Column({
    type: DataType.STRING(40),
    allowNull: false,
    defaultValue: 'FREE',
    field: 'subscription_tier',
  })
  subscriptionTier: string;

  @Column({ type: DataType.DATE, field: 'premium_until' })
  premiumUntil?: Date;

  @Column({ type: DataType.STRING(80), allowNull: false, defaultValue: 'PUBLIC_FORM' })
  source: string;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {}, field: 'consent_metadata' })
  consentMetadata: Record<string, unknown>;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  metadata: Record<string, unknown>;

  @BelongsTo(() => User)
  user?: User;
}
