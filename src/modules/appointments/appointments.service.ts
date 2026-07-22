import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';
import { DateTime } from 'luxon';
import {
  Appointment,
  AppointmentStatusHistory,
  PatientProfile,
  TherapistProfile,
  TherapyApproach,
  TherapyProduct,
  User,
} from '@/database/models';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import {
  PaginationQueryDto,
  buildPagination,
  toLimitOffset,
} from '@/common/pagination/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentAdminDto,
  UpdateAppointmentPaymentDto,
  UpdateAppointmentStatusDto,
} from './dto/appointment.dto';
import { canTransitionAppointment } from './policies/status-transition.policy';

const SAFE_USER_ATTRIBUTES = { exclude: ['passwordHash'] };

/**
 * Attributes excluded from admin-facing appointment responses.
 * notesForTherapist is private patient→therapist communication; admins must not read it.
 */
const ADMIN_APPOINTMENT_ATTRIBUTES = { exclude: ['notesForTherapist'] };

const ADMIN_LIST_INCLUDE = [
  {
    model: User,
    as: 'patient',
    attributes: SAFE_USER_ATTRIBUTES,
    include: [{ model: PatientProfile }],
  },
  {
    model: User,
    as: 'therapist',
    attributes: SAFE_USER_ATTRIBUTES,
    include: [{ model: TherapistProfile }],
  },
  { model: TherapyProduct, as: 'product', include: [{ model: TherapyApproach }] },
];

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectModel(Appointment) private readonly appointmentModel: typeof Appointment,
    @InjectModel(AppointmentStatusHistory)
    private readonly historyModel: typeof AppointmentStatusHistory,
    @InjectModel(TherapyProduct) private readonly productModel: typeof TherapyProduct,
    private readonly scheduling: SchedulingService,
    private readonly audit: AuditService,
    private readonly messaging: MessagingService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Booking propio (rol PATIENT) y booking asistido (ADMIN/SUPER_ADMIN/THERAPIST vía
   * POST /appointments/admin) comparten este método: si el dto trae `patientUserId`
   * explícito (booking asistido) se usa ese; si no, se toma del JWT del actor.
   *
   * La verificación de disponibilidad ocurre DENTRO de la transacción con
   * bloqueo pesimista (SELECT … FOR UPDATE) para evitar race conditions.
   */
  async create(user: AuthenticatedUser, dto: CreateAppointmentDto) {
    const patientUserId = dto.patientUserId ?? user.sub;
    const isAssisted = Boolean(dto.patientUserId) && dto.patientUserId !== user.sub;
    const product = await this.productModel.findByPk(dto.productId);
    if (!product)
      throw new NotFoundException({
        code: 'THERAPY_PRODUCT_NOT_FOUND',
        message: 'Producto no encontrado.',
      });
    const startAt = DateTime.fromISO(dto.scheduledStartAt).toJSDate();
    const endAt = DateTime.fromJSDate(startAt)
      .plus({ minutes: product.durationMinutes })
      .toJSDate();

    const appointment = await this.appointmentModel.sequelize!.transaction(async (transaction) => {
      // Pessimistic lock: check availability inside the transaction so concurrent
      // requests for the same slot block each other at the DB level.
      const available = await this.scheduling.isSlotAvailable(
        dto.therapistUserId,
        startAt,
        endAt,
        transaction,
      );
      if (!available)
        throw new BadRequestException({
          code: 'APPOINTMENT_SLOT_NOT_AVAILABLE',
          message: 'El horario seleccionado ya no está disponible.',
        });

      const created = await this.appointmentModel.create(
        {
          patientUserId,
          therapistUserId: dto.therapistUserId,
          productId: dto.productId,
          scheduledStartAt: startAt,
          scheduledEndAt: endAt,
          timezone: dto.timezone,
          status: 'REQUESTED',
          price: Number(product.price),
          currency: product.currency,
          notesForTherapist: dto.notesForTherapist,
        } as any,
        { transaction },
      );
      await this.historyModel.create(
        {
          appointmentId: created.id,
          fromStatus: null,
          toStatus: 'REQUESTED',
          changedByUserId: user.sub,
          reason: isAssisted ? `Creación de cita asistida por ${user.email}` : 'Creación de cita',
        } as any,
        { transaction },
      );
      await this.audit.log(
        {
          actorUserId: user.sub,
          action: isAssisted ? 'appointments.create_for_patient' : 'appointments.create',
          entityType: 'Appointment',
          entityId: created.id,
          after: created.toJSON(),
        },
        { transaction },
      );
      await this.messaging.enqueue(
        {
          channel: 'EMAIL',
          recipient: user.email,
          templateCode: 'APPOINTMENT_REQUESTED',
          payload: { appointmentId: created.id },
        },
        { transaction },
      );
      return created;
    });

    // Emit domain event after transaction commits (non-blocking, best-effort)
    void this.notifications.emit({
      type: 'APPOINTMENT_REQUESTED',
      entityType: 'Appointment',
      entityId: appointment.id,
      payload: {
        patientUserId,
        therapistUserId: dto.therapistUserId,
        scheduledStartAt: startAt.toISOString(),
        isAssisted,
      },
    });

    return appointment;
  }

  async listMine(user: AuthenticatedUser, query: PaginationQueryDto) {
    const where: any = user.roles.includes('THERAPIST')
      ? { therapistUserId: user.sub }
      : { patientUserId: user.sub };
    const { rows, count } = await this.appointmentModel.findAndCountAll({
      where,
      ...toLimitOffset(query),
      order: [['scheduledStartAt', 'DESC']],
    });
    return { items: rows, pagination: buildPagination(query, count) };
  }

  async adminList(query: PaginationQueryDto) {
    const { rows, count } = await this.appointmentModel.findAndCountAll({
      attributes: ADMIN_APPOINTMENT_ATTRIBUTES,
      ...toLimitOffset(query),
      include: ADMIN_LIST_INCLUDE,
      order: [['scheduledStartAt', 'DESC']],
    });
    return { items: rows, pagination: buildPagination(query, count) };
  }

  async adminUpdate(user: AuthenticatedUser, id: string, dto: UpdateAppointmentAdminDto) {
    const appointment = await this.appointmentModel.findByPk(id);
    if (!appointment)
      throw new NotFoundException({
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Cita no encontrada.',
      });

    if (dto.status && !canTransitionAppointment(appointment.status, dto.status)) {
      throw new BadRequestException({
        code: 'APPOINTMENT_INVALID_TRANSITION',
        message: `No se puede pasar de ${appointment.status} a ${dto.status}.`,
      });
    }

    const before = appointment.toJSON();
    const payload: Record<string, unknown> = {};
    if (dto.therapistUserId !== undefined) payload.therapistUserId = dto.therapistUserId;
    if (dto.productId !== undefined) payload.productId = dto.productId;
    if (dto.scheduledStartAt !== undefined)
      payload.scheduledStartAt = new Date(dto.scheduledStartAt);
    if (dto.scheduledEndAt !== undefined) payload.scheduledEndAt = new Date(dto.scheduledEndAt);
    if (dto.status !== undefined) payload.status = dto.status;
    if (dto.adminNotes !== undefined) payload.adminNotes = dto.adminNotes;
    // notesForTherapist is intentionally NOT settable via admin endpoint

    const updated = await this.appointmentModel.sequelize!.transaction(async (transaction) => {
      await appointment.update(payload as any, { transaction });
      if (dto.status && dto.status !== before.status) {
        await this.historyModel.create(
          {
            appointmentId: appointment.id,
            fromStatus: before.status,
            toStatus: dto.status,
            changedByUserId: user.sub,
            reason: 'Editado por administrador',
          } as any,
          { transaction },
        );
      }
      await this.audit.log(
        {
          actorUserId: user.sub,
          action: 'appointments.admin_update',
          entityType: 'Appointment',
          entityId: id,
          before,
          after: payload,
        },
        { transaction },
      );
      return this.appointmentModel.findByPk(id, {
        attributes: ADMIN_APPOINTMENT_ATTRIBUTES,
        include: ADMIN_LIST_INCLUDE,
        transaction,
      });
    });

    // Emit domain event when status changes
    if (dto.status && dto.status !== before.status) {
      void this.notifications.emit({
        type: `APPOINTMENT_${dto.status}`,
        entityType: 'Appointment',
        entityId: id,
        payload: { fromStatus: before.status, toStatus: dto.status, changedByUserId: user.sub },
      });
    }

    return updated;
  }

  async updatePayment(user: AuthenticatedUser, id: string, dto: UpdateAppointmentPaymentDto) {
    const appointment = await this.appointmentModel.findByPk(id);
    if (!appointment)
      throw new NotFoundException({
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Cita no encontrada.',
      });
    if (!dto.isPaid && appointment.saleTransactionId)
      throw new BadRequestException({
        code: 'APPOINTMENT_PAYMENT_LINKED_TO_SALE',
        message:
          'No se puede desmarcar el pago: esta cita ya tiene una venta registrada en contabilidad.',
      });

    const before = appointment.toJSON();
    return this.appointmentModel.sequelize!.transaction(async (transaction) => {
      await appointment.update(
        { isPaid: dto.isPaid, paidAt: dto.isPaid ? new Date() : null } as any,
        { transaction },
      );
      await this.audit.log(
        {
          actorUserId: user.sub,
          action: 'appointments.update_payment',
          entityType: 'Appointment',
          entityId: id,
          before,
          after: { isPaid: dto.isPaid },
        },
        { transaction },
      );
      return appointment;
    });
  }

  async updateStatus(user: AuthenticatedUser, id: string, dto: UpdateAppointmentStatusDto) {
    const appointment = await this.appointmentModel.findByPk(id);
    if (!appointment)
      throw new NotFoundException({
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Cita no encontrada.',
      });
    const ownsAsPatient = appointment.patientUserId === user.sub;
    const ownsAsTherapist = appointment.therapistUserId === user.sub;
    const isAdmin = user.roles.some((r) => ['ADMIN', 'SUPER_ADMIN'].includes(r));
    if (!ownsAsPatient && !ownsAsTherapist && !isAdmin)
      throw new ForbiddenException({
        code: 'APPOINTMENT_FORBIDDEN',
        message: 'No puede modificar esta cita.',
      });
    if (!canTransitionAppointment(appointment.status, dto.status))
      throw new BadRequestException({
        code: 'APPOINTMENT_INVALID_TRANSITION',
        message: `No se puede pasar de ${appointment.status} a ${dto.status}.`,
      });
    const before = appointment.toJSON();

    await this.appointmentModel.sequelize!.transaction(async (transaction) => {
      await appointment.update({ status: dto.status } as any, { transaction });
      await this.historyModel.create(
        {
          appointmentId: appointment.id,
          fromStatus: before.status,
          toStatus: dto.status,
          changedByUserId: user.sub,
          reason: dto.reason,
        } as any,
        { transaction },
      );
      await this.audit.log(
        {
          actorUserId: user.sub,
          action: 'appointments.update_status',
          entityType: 'Appointment',
          entityId: id,
          before,
          after: { status: dto.status },
        },
        { transaction },
      );
      await this.messaging.enqueue(
        {
          channel: 'EMAIL',
          recipient: user.email,
          templateCode: 'APPOINTMENT_STATUS_CHANGED',
          payload: { appointmentId: appointment.id, status: dto.status },
        },
        { transaction },
      );
    });

    // Emit domain event after commit
    void this.notifications.emit({
      type: `APPOINTMENT_${dto.status}`,
      entityType: 'Appointment',
      entityId: id,
      payload: {
        fromStatus: before.status,
        toStatus: dto.status,
        changedByUserId: user.sub,
        patientUserId: appointment.patientUserId,
        therapistUserId: appointment.therapistUserId,
      },
    });

    return appointment;
  }
}
