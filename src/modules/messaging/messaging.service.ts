import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { randomInt } from 'node:crypto';
import { hostname } from 'node:os';
import { Op, Sequelize, Transaction } from 'sequelize';
import { sanitizeForLog } from '@/common/logging/log-sanitizer';
import {
  buildPagination,
  PaginationQueryDto,
  toLimitOffset,
} from '@/common/pagination/pagination.dto';
import { MessageOutbox, MessageSendLog } from '@/database/models';
import { SendTestEmailDto } from './dto/test-email.dto';
import { MessagingProviderService } from './messaging-provider.service';
import {
  MESSAGE_API_STATUS,
  MESSAGE_CHANNEL_EMAIL,
  MESSAGE_STATUS,
  NormalizedProviderError,
} from './messaging.types';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private readonly workerId: string;

  constructor(
    @InjectModel(MessageOutbox) private readonly outboxModel: typeof MessageOutbox,
    @InjectModel(MessageSendLog) private readonly logModel: typeof MessageSendLog,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly config: ConfigService,
    private readonly provider: MessagingProviderService,
  ) {
    this.workerId = process.env.OUTBOX_WORKER_ID?.trim() || `${hostname()}-${process.pid}`;
  }

  async enqueue(
    input: {
      channel: string;
      recipient: string;
      templateCode: string;
      payload: Record<string, unknown>;
      scheduledAt?: Date;
    },
    options: { transaction?: Transaction } = {},
  ) {
    return this.outboxModel.create(
      {
        channel: input.channel,
        recipient: input.recipient,
        templateCode: input.templateCode,
        payload: input.payload,
        scheduledAt: input.scheduledAt ?? new Date(),
        status: MESSAGE_STATUS.pending,
        priority: 5,
        attempts: 0,
        maxAttempts: 6,
      } as never,
      { transaction: options.transaction },
    );
  }

  async enqueueTestEmail(dto: SendTestEmailDto) {
    const timestamp = new Date().toISOString();
    return this.toApiOutbox(
      await this.enqueue({
        channel: MESSAGE_CHANNEL_EMAIL,
        recipient: dto.recipient,
        templateCode: 'SMOKE_TEST_EMAIL',
        payload: {
          subject: dto.subject ?? `Corazon Migrante - smoke test ${timestamp}`,
          text:
            dto.text ?? `Correo de prueba enviado por Corazon Migrante. Fecha UTC: ${timestamp}`,
          html: `<p>Correo de prueba enviado por <strong>Corazon Migrante</strong>.</p><p>Fecha UTC: ${timestamp}</p>`,
        },
      }),
    );
  }

  async list(query: PaginationQueryDto) {
    const { rows, count } = await this.outboxModel.findAndCountAll({
      ...toLimitOffset(query),
      order: [['createdAt', 'DESC']],
    });
    return {
      items: rows.map((row) => this.toApiOutbox(row)),
      pagination: buildPagination(query, count),
    };
  }

  async processPending(requestedLimit?: number) {
    const messages = await this.claimPendingMessages(this.normalizeLimit(requestedLimit));
    return this.processClaimedMessages(messages);
  }

  async processOne(id: string | number) {
    const message = await this.sequelize.transaction(async (transaction) => {
      const row = await this.outboxModel.findByPk(id as never, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!row) {
        throw new NotFoundException({
          code: 'OUTBOX_NOT_FOUND',
          message: 'No existe el mensaje solicitado.',
        });
      }
      if (row.status === MESSAGE_STATUS.processing) {
        throw new ConflictException({
          code: 'OUTBOX_ALREADY_PROCESSING',
          message: 'El mensaje ya está siendo procesado.',
        });
      }
      if (row.status !== MESSAGE_STATUS.pending || row.attempts >= row.maxAttempts) {
        throw new BadRequestException({
          code: 'OUTBOX_NOT_PROCESSABLE',
          message: 'El mensaje no se encuentra en un estado procesable.',
        });
      }

      await this.markClaimed(row, transaction);
      return row;
    });

    return this.processClaimedMessages([message]);
  }

  private async claimPendingMessages(limit: number): Promise<MessageOutbox[]> {
    return this.sequelize.transaction(async (transaction) => {
      await this.recoverStaleLocks(transaction, limit);
      const candidates = await this.outboxModel.findAll({
        where: {
          status: MESSAGE_STATUS.pending,
          scheduledAt: { [Op.lte]: new Date() },
        },
        limit,
        order: [
          ['priority', 'ASC'],
          ['scheduledAt', 'ASC'],
          ['id', 'ASC'],
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
        skipLocked: true,
      });

      const claimedMessages: MessageOutbox[] = [];
      for (const candidate of candidates) {
        if (candidate.attempts >= candidate.maxAttempts) {
          candidate.status = MESSAGE_STATUS.failed;
          candidate.lastError = 'Maximum delivery attempts reached.';
          await candidate.save({ transaction });
          continue;
        }
        await this.markClaimed(candidate, transaction);
        claimedMessages.push(candidate);
      }
      return claimedMessages;
    });
  }

  private async recoverStaleLocks(transaction: Transaction, limit: number) {
    const staleBefore = new Date(
      Date.now() - (this.config.get<number>('outbox.staleLockMs') ?? 300_000),
    );
    const staleMessages = await this.outboxModel.findAll({
      where: {
        status: MESSAGE_STATUS.processing,
        lockedAt: { [Op.lt]: staleBefore },
      },
      limit,
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
    });

    for (const staleMessage of staleMessages) {
      staleMessage.status =
        staleMessage.attempts >= staleMessage.maxAttempts
          ? MESSAGE_STATUS.failed
          : MESSAGE_STATUS.pending;
      staleMessage.lockedAt = undefined;
      staleMessage.lockedBy = undefined;
      staleMessage.lastError = 'Recovered stale outbox worker lock.';
      staleMessage.scheduledAt = new Date();
      await staleMessage.save({ transaction });
    }
  }

  private async markClaimed(message: MessageOutbox, transaction: Transaction) {
    message.status = MESSAGE_STATUS.processing;
    message.lockedAt = new Date();
    message.lockedBy = this.workerId;
    message.attempts += 1;
    await message.save({ transaction });
  }

  private async processClaimedMessages(messages: MessageOutbox[]) {
    let sent = 0;
    let failed = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const message of messages) {
      try {
        const providerResult = await this.provider.send(message);
        await this.markSent(message, providerResult);
        sent += 1;
        results.push({
          id: message.id,
          status: 'SENT',
          rawStatus: MESSAGE_STATUS.sent,
          provider: providerResult.provider,
          providerMessageId: providerResult.providerMessageId,
        });
      } catch (error) {
        const normalizedError = this.provider.normalizeError(error);
        const nextStatus = await this.markFailed(message, normalizedError);
        this.logger.error(
          `Message ${message.id} failed through ${normalizedError.metadata.provider ?? 'provider'}.`,
        );
        failed += 1;
        results.push({
          id: message.id,
          status: this.toApiStatus(nextStatus),
          rawStatus: nextStatus,
          lastError: normalizedError.message,
        });
      }
    }

    return { processed: messages.length, sent, failed, results };
  }

  private async markSent(
    message: MessageOutbox,
    result: {
      provider: string;
      providerMessageId?: string;
      metadata: Record<string, unknown>;
    },
  ) {
    await this.sequelize.transaction(async (transaction) => {
      const [updatedRows] = await this.outboxModel.update(
        {
          status: MESSAGE_STATUS.sent,
          sentAt: new Date(),
          lockedAt: null,
          lockedBy: null,
          lastError: null,
        },
        {
          where: {
            id: message.id,
            status: MESSAGE_STATUS.processing,
            lockedBy: this.workerId,
          },
          transaction,
        },
      );
      if (updatedRows !== 1) throw new Error('Outbox ownership was lost before completion.');

      await this.logModel.create(
        {
          outboxId: message.id,
          ok: true,
          providerMessageId: result.providerMessageId,
          responseMetadata: { provider: result.provider, ...result.metadata },
        } as never,
        { transaction },
      );
    });
  }

  private async markFailed(
    message: MessageOutbox,
    error: NormalizedProviderError,
  ): Promise<string> {
    const terminal = message.attempts >= message.maxAttempts;
    const nextStatus = terminal ? MESSAGE_STATUS.failed : MESSAGE_STATUS.pending;
    const nextRunAt = terminal
      ? message.scheduledAt
      : new Date(Date.now() + this.calculateRetryDelay(message.attempts));

    await this.sequelize.transaction(async (transaction) => {
      await this.outboxModel.update(
        {
          status: nextStatus,
          scheduledAt: nextRunAt,
          lockedAt: null,
          lockedBy: null,
          lastError: error.message,
        },
        {
          where: { id: message.id, lockedBy: this.workerId },
          transaction,
        },
      );
      await this.logModel.create(
        {
          outboxId: message.id,
          ok: false,
          responseMetadata: error.metadata,
          error: error.message,
        } as never,
        { transaction },
      );
    });

    return nextStatus;
  }

  private calculateRetryDelay(attempt: number) {
    const baseDelay = this.config.get<number>('outbox.retryBaseDelayMs') ?? 30_000;
    const maxDelay = this.config.get<number>('outbox.retryMaxDelayMs') ?? 3_600_000;
    const exponentialDelay = Math.min(baseDelay * 2 ** Math.max(0, attempt - 1), maxDelay);
    return Math.min(exponentialDelay + randomInt(0, Math.max(1, baseDelay / 4)), maxDelay);
  }

  private normalizeLimit(requestedLimit?: number) {
    const configuredLimit = this.config.get<number>('outbox.batchSize') ?? 50;
    return Math.max(1, Math.min(requestedLimit ?? configuredLimit, configuredLimit, 500));
  }

  private toApiOutbox(row: MessageOutbox) {
    return {
      id: row.id,
      channel: row.channel,
      recipient: row.recipient,
      templateCode: row.templateCode,
      payload: sanitizeForLog(row.payload),
      status: this.toApiStatus(row.status),
      rawStatus: row.status,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      scheduledAt: row.scheduledAt,
      lockedAt: row.lockedAt,
      lockedBy: row.lockedBy,
      lastError: row.lastError,
      createdAt: row.createdAt,
      sentAt: row.sentAt,
    };
  }

  private toApiStatus(status: string) {
    return MESSAGE_API_STATUS[status] ?? status;
  }
}
