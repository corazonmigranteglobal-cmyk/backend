import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  buildPagination,
  buildSafeOrder,
  PaginationQueryDto,
  toLimitOffset,
} from '@/common/pagination/pagination.dto';
import { FileAsset } from '@/database/models';
import { AuditService } from '../audit/audit.service';
import { UpdateFileDto } from './dto/file.dto';
import { toFileResponse } from './file-response.mapper';
import { FileStorageService } from './file-storage.service';

@Injectable()
export class FilesAdminService {
  constructor(
    @InjectModel(FileAsset) private readonly fileModel: typeof FileAsset,
    private readonly config: ConfigService,
    private readonly storage: FileStorageService,
    private readonly audit: AuditService,
  ) {}

  async list(query: PaginationQueryDto) {
    const search = String(query.search ?? '').trim();
    const where = search
      ? {
          [Op.or]: [
            { module: { [Op.iLike]: `%${search}%` } },
            { entityType: { [Op.iLike]: `%${search}%` } },
            { originalName: { [Op.iLike]: `%${search}%` } },
            { mimeType: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : undefined;
    const { rows, count } = await this.fileModel.findAndCountAll({
      where,
      ...toLimitOffset(query),
      order: buildSafeOrder(
        query,
        {
          id: 'id',
          module: 'module',
          entityType: 'entityType',
          entity_type: 'entityType',
          originalName: 'originalName',
          original_name: 'originalName',
          mimeType: 'mimeType',
          mime_type: 'mimeType',
          storageProvider: 'storageProvider',
          storage_provider: 'storageProvider',
          visibility: 'visibility',
          status: 'status',
          createdAt: 'createdAt',
          created_at: 'createdAt',
          updatedAt: 'updatedAt',
          updated_at: 'updatedAt',
        },
        'createdAt',
      ),
    });
    return {
      items: rows.map((row) => toFileResponse(this.config, row)),
      pagination: buildPagination(query, count),
    };
  }

  async get(id: string) {
    return toFileResponse(this.config, await this.find(id));
  }

  async update(actorUserId: string, id: string, dto: UpdateFileDto) {
    const record = await this.find(id);
    const before = record.toJSON();
    const payload: Record<string, unknown> = {};
    if (dto.module !== undefined) payload.module = dto.module;
    if (dto.entityType !== undefined) payload.entityType = dto.entityType || null;
    if (dto.entityId !== undefined) payload.entityId = dto.entityId || null;
    if (dto.visibility !== undefined) payload.visibility = dto.visibility;
    if (dto.status !== undefined) payload.status = dto.status;
    if (dto.originalName !== undefined) payload.originalName = dto.originalName;
    if (dto.metadata !== undefined) {
      payload.metadata = { ...(record.metadata ?? {}), ...dto.metadata };
    }
    await record.update(payload as never);
    await this.audit.log({
      actorUserId,
      action: 'files.update',
      entityType: 'FileAsset',
      entityId: record.id,
      before,
      after: record.toJSON(),
    });
    return toFileResponse(this.config, record);
  }

  async delete(actorUserId: string, id: string) {
    const record = await this.find(id);
    const before = record.toJSON();
    await this.storage.deleteObject(record.storageProvider, record.bucket, record.objectKey);
    await record.destroy();
    await this.audit.log({
      actorUserId,
      action: 'files.delete',
      entityType: 'FileAsset',
      entityId: id,
      before,
      after: { deleted: true },
    });
    return { id, deleted: true };
  }

  private async find(id: string) {
    const record = await this.fileModel.findByPk(id);
    if (!record) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'Archivo no encontrado.' });
    }
    return record;
  }
}
