import { BelongsTo, Column, DataType, ForeignKey, Model, Table, HasMany } from 'sequelize-typescript';
import { User } from './user.model';
import { TherapyProduct } from './therapy-product.model';
import { AppointmentStatusHistory } from './appointment-status-history.model';

@Table({ tableName: 'appointments', underscored: true, timestamps: true, paranoid: true })
export class Appointment extends Model<Appointment> {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true }) id: string;
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'patient_user_id' })
  patientUserId: string;
  @BelongsTo(() => User, { foreignKey: 'patientUserId', as: 'patient' })
  patient?: User;
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'therapist_user_id' })
  therapistUserId: string;
  @BelongsTo(() => User, { foreignKey: 'therapistUserId', as: 'therapist' })
  therapist?: User;
  @ForeignKey(() => TherapyProduct)
  @Column({ type: DataType.UUID, allowNull: false, field: 'product_id' })
  productId: string;
  @BelongsTo(() => TherapyProduct, { foreignKey: 'productId', as: 'product' })
  product?: TherapyProduct;
  @Column({ type: DataType.DATE, allowNull: false, field: 'scheduled_start_at' })
  scheduledStartAt: Date;
  @Column({ type: DataType.DATE, allowNull: false, field: 'scheduled_end_at' })
  scheduledEndAt: Date;
  @Column({ type: DataType.STRING(80), allowNull: false }) timezone: string;
  @Column({ type: DataType.STRING(50), allowNull: false, defaultValue: 'REQUESTED' })
  status: string;
  @Column({ type: DataType.DECIMAL(12, 2), allowNull: false }) price: number;
  @Column({ type: DataType.STRING(3), allowNull: false, defaultValue: 'BOB' }) currency: string;
  @Column({ type: DataType.TEXT, field: 'notes_for_therapist' }) notesForTherapist?: string;
  @Column({ type: DataType.TEXT, field: 'admin_notes' }) adminNotes?: string;
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_paid' })
  isPaid: boolean;
  @Column({ type: DataType.DATE, field: 'paid_at' }) paidAt?: Date;
  @Column({ type: DataType.UUID, field: 'sale_transaction_id' }) saleTransactionId?: string;
  @HasMany(() => AppointmentStatusHistory) statusHistory?: AppointmentStatusHistory[];
}
