import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  Account,
  AccountGroup,
  AccountingEntry,
  AccountingTransaction,
  Appointment,
  CostCenter,
} from '@/database/models';
import {
  PaginationQueryDto,
  buildPagination,
  toLimitOffset,
} from '@/common/pagination/pagination.dto';
import { AuditService } from '../audit/audit.service';
import {
  CreateAccountDto,
  CreateAccountGroupDto,
  CreateCostCenterDto,
  CreateSaleFromAppointmentDto,
  CreateTransactionDto,
} from './dto/accounting.dto';

@Injectable()
export class AccountingService {
  constructor(
    @InjectModel(AccountGroup) private readonly groupModel: typeof AccountGroup,
    @InjectModel(Account) private readonly accountModel: typeof Account,
    @InjectModel(CostCenter) private readonly costCenterModel: typeof CostCenter,
    @InjectModel(AccountingTransaction) private readonly txModel: typeof AccountingTransaction,
    @InjectModel(AccountingEntry) private readonly entryModel: typeof AccountingEntry,
    @InjectModel(Appointment) private readonly appointmentModel: typeof Appointment,
    private readonly audit: AuditService,
  ) {}
  listGroups(query: PaginationQueryDto) {
    return this.groupModel
      .findAndCountAll({ ...toLimitOffset(query), order: [['code', 'ASC']] })
      .then(({ rows, count }) => ({ items: rows, pagination: buildPagination(query, count) }));
  }
  createGroup(actorUserId: string, dto: CreateAccountGroupDto) {
    return this.groupModel.sequelize!.transaction(async (transaction) => {
      const row = await this.groupModel.create({ ...dto, status: 'ACTIVE' } as any, {
        transaction,
      });
      await this.audit.log(
        {
          actorUserId,
          action: 'accounting.create_group',
          entityType: 'AccountGroup',
          entityId: row.id,
          after: row.toJSON(),
        },
        { transaction },
      );
      return row;
    });
  }
  listAccounts(query: PaginationQueryDto) {
    return this.accountModel
      .findAndCountAll({ ...toLimitOffset(query), order: [['code', 'ASC']] })
      .then(({ rows, count }) => ({ items: rows, pagination: buildPagination(query, count) }));
  }
  createAccount(actorUserId: string, dto: CreateAccountDto) {
    return this.accountModel.sequelize!.transaction(async (transaction) => {
      const row = await this.accountModel.create({ ...dto, status: 'ACTIVE' } as any, {
        transaction,
      });
      await this.audit.log(
        {
          actorUserId,
          action: 'accounting.create_account',
          entityType: 'Account',
          entityId: row.id,
          after: row.toJSON(),
        },
        { transaction },
      );
      return row;
    });
  }
  listCostCenters(query: PaginationQueryDto) {
    return this.costCenterModel
      .findAndCountAll({ ...toLimitOffset(query), order: [['code', 'ASC']] })
      .then(({ rows, count }) => ({ items: rows, pagination: buildPagination(query, count) }));
  }
  createCostCenter(actorUserId: string, dto: CreateCostCenterDto) {
    return this.costCenterModel.sequelize!.transaction(async (transaction) => {
      const row = await this.costCenterModel.create({ ...dto, status: 'ACTIVE' } as any, {
        transaction,
      });
      await this.audit.log(
        {
          actorUserId,
          action: 'accounting.create_cost_center',
          entityType: 'CostCenter',
          entityId: row.id,
          after: row.toJSON(),
        },
        { transaction },
      );
      return row;
    });
  }
  listTransactions(query: PaginationQueryDto) {
    return this.txModel
      .findAndCountAll({
        ...toLimitOffset(query),
        include: [{ model: this.entryModel }],
        order: [['date', 'DESC']],
      })
      .then(({ rows, count }) => ({ items: rows, pagination: buildPagination(query, count) }));
  }
  async createTransaction(actorUserId: string, dto: CreateTransactionDto) {
    const debit = dto.entries.reduce((sum, e) => sum + Number(e.debit), 0);
    const credit = dto.entries.reduce((sum, e) => sum + Number(e.credit), 0);
    if (Math.round(debit * 100) !== Math.round(credit * 100))
      throw new BadRequestException({
        code: 'ACCOUNTING_UNBALANCED_TRANSACTION',
        message: 'La transacción debe estar balanceada.',
      });
    if (dto.entries.length < 2)
      throw new BadRequestException({
        code: 'ACCOUNTING_MINIMUM_ENTRIES',
        message: 'Se requieren al menos dos asientos.',
      });
    return this.txModel.sequelize!.transaction(async (transaction) => {
      const created = await this.txModel.create(
        {
          date: dto.date,
          description: dto.description,
          reference: dto.reference,
          status: 'POSTED',
          createdByUserId: actorUserId,
        } as any,
        { transaction },
      );
      await this.entryModel.bulkCreate(
        dto.entries.map((e) => ({
          transactionId: created.id,
          accountId: e.accountId,
          costCenterId: e.costCenterId,
          debit: e.debit,
          credit: e.credit,
        })) as any,
        { transaction },
      );
      await this.audit.log(
        {
          actorUserId,
          action: 'accounting.create_transaction',
          entityType: 'AccountingTransaction',
          entityId: created.id,
          after: { debit, credit },
        },
        { transaction },
      );
      return created;
    });
  }

  async createSaleFromAppointment(
    actorUserId: string,
    appointmentId: string,
    dto: CreateSaleFromAppointmentDto,
  ) {
    const appointment = await this.appointmentModel.findByPk(appointmentId);
    if (!appointment)
      throw new NotFoundException({
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Cita no encontrada.',
      });
    if (!appointment.isPaid)
      throw new BadRequestException({
        code: 'APPOINTMENT_NOT_PAID',
        message:
          'Solo se pueden registrar como venta las citas que ya fueron marcadas como pagadas.',
      });
    if (appointment.saleTransactionId)
      throw new BadRequestException({
        code: 'APPOINTMENT_SALE_ALREADY_REGISTERED',
        message: 'Esta cita ya tiene una venta registrada en contabilidad.',
      });

    const amount = Number(appointment.price);
    const date = dto.date ?? new Date().toISOString().slice(0, 10);
    const description = dto.description ?? `Venta por cita del ${date} (cita ${appointment.id})`;

    return this.txModel.sequelize!.transaction(async (transaction) => {
      // Las comprobaciones anteriores son sólo para dar un error temprano y
      // claro. La garantía real está aquí: se recarga la cita con FOR UPDATE
      // dentro de la transacción, para que dos peticiones simultáneas no
      // registren dos veces la misma venta.
      const locked = await this.appointmentModel.findByPk(appointmentId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!locked)
        throw new NotFoundException({
          code: 'APPOINTMENT_NOT_FOUND',
          message: 'Cita no encontrada.',
        });
      if (!locked.isPaid)
        throw new BadRequestException({
          code: 'APPOINTMENT_NOT_PAID',
          message:
            'Solo se pueden registrar como venta las citas que ya fueron marcadas como pagadas.',
        });
      if (locked.saleTransactionId)
        throw new BadRequestException({
          code: 'APPOINTMENT_SALE_ALREADY_REGISTERED',
          message: 'Esta cita ya tiene una venta registrada en contabilidad.',
        });

      const created = await this.txModel.create(
        {
          date,
          description,
          reference: appointment.id,
          status: 'POSTED',
          createdByUserId: actorUserId,
        } as any,
        { transaction },
      );
      await this.entryModel.bulkCreate(
        [
          {
            transactionId: created.id,
            accountId: dto.debitAccountId,
            costCenterId: dto.costCenterId,
            debit: amount,
            credit: 0,
          },
          {
            transactionId: created.id,
            accountId: dto.creditAccountId,
            costCenterId: dto.costCenterId,
            debit: 0,
            credit: amount,
          },
        ] as any,
        { transaction },
      );
      await locked.update({ saleTransactionId: created.id } as any, { transaction });
      await this.audit.log(
        {
          actorUserId,
          action: 'accounting.create_sale_from_appointment',
          entityType: 'AccountingTransaction',
          entityId: created.id,
          after: { appointmentId: appointment.id, amount },
        },
        { transaction },
      );
      return created;
    });
  }
}
