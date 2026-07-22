import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Subject } from 'rxjs';
import { AdminNotification } from '@/database/models';
import { PaginationQueryDto, buildPagination, toLimitOffset } from '@/common/pagination/pagination.dto';

export interface NotificationEvent {
  id: string;
  type: string;
  entityType?: string;
  entityId?: string;
  payload: Record<string, unknown>;
  recipientRole: string;
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  /** In-process SSE bus — emits to all connected admin clients */
  private readonly bus$ = new Subject<NotificationEvent>();

  constructor(
    @InjectModel(AdminNotification)
    private readonly notificationModel: typeof AdminNotification,
  ) {}

  /** Observable stream for SSE subscriptions */
  get stream$() {
    return this.bus$.asObservable();
  }

  /**
   * Persist a domain event notification and push it to real-time subscribers.
   * Called by services after completing a meaningful business action.
   */
  async emit(event: {
    type: string;
    entityType?: string;
    entityId?: string;
    payload?: Record<string, unknown>;
    recipientRole?: string;
  }): Promise<void> {
    const notification = await this.notificationModel.create({
      type: event.type,
      entityType: event.entityType,
      entityId: event.entityId,
      payload: event.payload ?? {},
      recipientRole: event.recipientRole ?? 'ADMIN',
      isRead: false,
    } as any);

    this.bus$.next({
      id: notification.id,
      type: notification.type,
      entityType: notification.entityType,
      entityId: notification.entityId,
      payload: notification.payload,
      recipientRole: notification.recipientRole,
      createdAt: notification.createdAt,
    });
  }

  /** List notifications for admin panel with pagination */
  async list(query: PaginationQueryDto & { unreadOnly?: boolean }) {
    const where: any = {};
    if (query.unreadOnly) where.isRead = false;

    const { rows, count } = await this.notificationModel.findAndCountAll({
      where,
      ...toLimitOffset(query),
      order: [['createdAt', 'DESC']],
    });
    return { items: rows, pagination: buildPagination(query, count) };
  }

  /** Mark a single notification as read */
  async markRead(id: string): Promise<void> {
    await this.notificationModel.update(
      { isRead: true, readAt: new Date() } as any,
      { where: { id } },
    );
  }

  /** Mark all unread notifications as read */
  async markAllRead(): Promise<void> {
    await this.notificationModel.update(
      { isRead: true, readAt: new Date() } as any,
      { where: { isRead: false } },
    );
  }

  /** Count of unread notifications — used for badge */
  async unreadCount(): Promise<number> {
    return this.notificationModel.count({ where: { isRead: false } });
  }
}
