import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationQueryDto } from './dto/notification.dto';

export interface CreatePersonalNotificationInput {
  userId: string;
  actorId?: string;
  type: NotificationType;
  title: string;
  content?: string;
  actionUrl?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationGateway,
  ) {}

  async getAll(userId: string, query: NotificationQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 50);
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { userId };
    if (query.type) where.type = query.type;
    if (query.unreadOnly === true) {
      where.isRead = false;
    }

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
      },
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markAsRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true, isRead: true },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    if (!existing.isRead) {
      await this.prisma.notification.update({
        where: { id: existing.id },
        data: { isRead: true, readAt: new Date() },
      });
    }
    return this.getUnreadCount(userId);
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { count: 0 };
  }

  async deleteNotification(userId: string, notificationId: string) {
    const res = await this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
    if (res.count === 0) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    return { deleted: true };
  }

  async createPersonal(input: CreatePersonalNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        actorId: input.actorId,
        type: input.type,
        title: input.title,
        content: input.content,
        actionUrl: input.actionUrl,
        data: (input.data || {}) as Prisma.InputJsonValue,
      },
    });

    this.gateway.sendToUser(input.userId, 'notification:new', notification);
    const { count } = await this.getUnreadCount(input.userId);
    this.gateway.sendToUser(input.userId, 'notification:unread-count', { count });

    return notification;
  }

  async notifyComicFollowers(
    comicId: string,
    payload: {
      actorId?: string;
      title: string;
      content: string;
      actionUrl: string;
      data?: Record<string, unknown>;
    },
  ) {
    const followers = await this.prisma.bookmark.findMany({
      where: {
        comicId,
        notifyUpdate: true,
        user: { deletedAt: null, isBanned: false },
      },
      select: { userId: true },
    });
    const recipientIds = followers
      .map((f) => f.userId)
      .filter((uid) => uid !== payload.actorId);

    if (recipientIds.length === 0) return;

    const BATCH_SIZE = 500;
    const onlineCreated: Array<{
      id: string;
      userId: string;
      actorId: string | null;
      type: NotificationType;
      title: string;
      content: string | null;
      actionUrl: string | null;
      data: Prisma.JsonValue;
      isRead: boolean;
      createdAt: Date;
    }> = [];

    for (let i = 0; i < recipientIds.length; i += BATCH_SIZE) {
      const batch = recipientIds.slice(i, i + BATCH_SIZE);
      const created = await this.prisma.notification.createManyAndReturn({
        data: batch.map((uid) => ({
          userId: uid,
          actorId: payload.actorId,
          type: NotificationType.NEW_CHAPTER,
          title: payload.title,
          content: payload.content,
          actionUrl: payload.actionUrl,
          data: (payload.data || {}) as Prisma.InputJsonValue,
        })),
      });
      for (const row of created) {
        if (this.gateway.isUserOnline(row.userId)) {
          onlineCreated.push(row);
        }
      }
    }

    if (onlineCreated.length > 0) {
      const onlineIds = Array.from(new Set(onlineCreated.map((r) => r.userId)));
      const unreadGroups = await this.prisma.notification.groupBy({
        by: ['userId'],
        where: { userId: { in: onlineIds }, isRead: false },
        _count: { _all: true },
      });
      const unreadMap = new Map(unreadGroups.map((g) => [g.userId, g._count._all]));

      for (const notif of onlineCreated) {
        this.gateway.sendToUser(notif.userId, 'notification:new', notif);
        this.gateway.sendToUser(notif.userId, 'notification:unread-count', {
          count: unreadMap.get(notif.userId) ?? 1,
        });
      }
    }

    this.logger.log(
      `Sent NEW_CHAPTER notifications to ${recipientIds.length} followers of comic ${comicId}`,
    );
  }
}
