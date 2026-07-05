import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';
import { AuditLog } from '@/database/models';
import {
  PaginationQueryDto,
  buildPagination,
  buildSafeOrder,
  toLimitOffset,
} from '@/common/pagination/pagination.dto';

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog) private readonly auditModel: typeof AuditLog) {}

  async log(
    input: {
      actorUserId?: string;
      action: string;
      entityType: string;
      entityId?: string;
      before?: unknown;
      after?: unknown;
      ipAddress?: string;
      userAgent?: string;
    },
    options: { transaction?: Transaction } = {},
  ) {
    return this.auditModel.create(input as any, { transaction: options.transaction });
  }

  async list(query: PaginationQueryDto) {
    const { rows, count } = await this.auditModel.findAndCountAll({
      ...toLimitOffset(query),
      order: buildSafeOrder(
        query,
        {
          id: 'id',
          action: 'action',
          entityType: 'entityType',
          entity_type: 'entityType',
          entityId: 'entityId',
          entity_id: 'entityId',
          actorUserId: 'actorUserId',
          actor_user_id: 'actorUserId',
          createdAt: 'createdAt',
          created_at: 'createdAt',
        },
        'createdAt',
      ),
    });
    return { items: rows, pagination: buildPagination(query, count) };
  }
}
