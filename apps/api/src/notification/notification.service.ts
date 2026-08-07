import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, Prisma } from '@prisma/client';
import { NotificationQueryDto } from './dto/notification.dto';
import { NotificationGateway } from './notification.gateway';

interface CreatePersonalDto {
  userId: string;
  type: NotificationType;
  title: string;
  content?: string;
  data?: Record<string, any>;
}

interface CreateBroadcastDto {
  type: NotificationType;
  title: string;
  content?: string;
  data?: Record<string, any>;
  targetType: string;   // "COMIC_FOLLOWERS" | "ALL_USERS"
  targetId?: string;    // comicId for COMIC_FOLLOWERS
  actorId?: string;
}

export interface UnifiedNotification {
  id: string;
  type: NotificationType;
  title: string;
  content: string | null;
  data: any;
  isRead: boolean;
  createdAt: Date;
  source: 'personal' | 'broadcast';
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private gateway: NotificationGateway,
  ) {}

  // ── Set gateway (for circular dependency) ──
  setGateway(gateway: NotificationGateway) {
    this.gateway = gateway;
  }

  // ── Get unified notifications (personal + broadcast merged) ──
  async getAll(userId: string, query: NotificationQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 50);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastBroadcastReadAt: true },
    });

    // 1. Get personal notifications
    const personalWhere: Prisma.NotificationWhereInput = { userId };
    if (query.type) personalWhere.type = query.type;

    const personalItems = await this.prisma.notification.findMany({
      where: personalWhere,
      orderBy: { createdAt: 'desc' },
    });

    const personalNotifications: UnifiedNotification[] = personalItems.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      data: n.data,
      isRead: n.isRead,
      createdAt: n.createdAt,
      source: 'personal' as const,
    }));

    // 2. Get broadcast events relevant to user
    const broadcastNotifications = await this.getBroadcastsForUser(
      userId,
      user?.lastBroadcastReadAt || null,
      query.type,
    );

    // 3. Merge and sort by createdAt desc
    const merged = [...personalNotifications, ...broadcastNotifications]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // 4. Paginate
    const total = merged.length;
    const startIndex = (page - 1) * limit;
    const paginated = merged.slice(startIndex, startIndex + limit);

    return {
      data: paginated,
      meta: { page, limit, total, hasNext: startIndex + limit < total },
    };
  }

  // ── Get broadcast events for a user ──
  private async getBroadcastsForUser(
    userId: string,
    lastBroadcastReadAt: Date | null,
    typeFilter?: NotificationType,
  ): Promise<UnifiedNotification[]> {
    // Get comic IDs the user is following (with notifyUpdate = true)
    const bookmarks = await this.prisma.bookmark.findMany({
      where: { userId, notifyUpdate: true },
      select: { comicId: true, createdAt: true },
    });

    const bookmarkMap = new Map(bookmarks.map((b) => [b.comicId, b.createdAt]));
    const comicIds = bookmarks.map((b) => b.comicId);

    // Build OR conditions for broadcast events
    const orConditions: Prisma.BroadcastEventWhereInput[] = [];

    // Broadcasts for comics user follows
    if (comicIds.length > 0) {
      orConditions.push({
        targetType: 'COMIC_FOLLOWERS',
        targetId: { in: comicIds },
      });
    }

    // Broadcasts for all users
    orConditions.push({ targetType: 'ALL_USERS' });

    if (orConditions.length === 0) return [];

    const where: Prisma.BroadcastEventWhereInput = {
      OR: orConditions,
      ...(typeFilter && { type: typeFilter }),
    };

    const broadcasts = await this.prisma.broadcastEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return broadcasts
      .filter((b) => {
        // For COMIC_FOLLOWERS, only show broadcasts created after user bookmarked
        if (b.targetType === 'COMIC_FOLLOWERS' && b.targetId) {
          const bookmarkDate = bookmarkMap.get(b.targetId);
          if (!bookmarkDate || b.createdAt < bookmarkDate) return false;
        }
        return true;
      })
      .map((b) => ({
        id: b.id,
        type: b.type,
        title: b.title,
        content: b.content,
        data: b.data,
        isRead: lastBroadcastReadAt ? b.createdAt <= lastBroadcastReadAt : false,
        createdAt: b.createdAt,
        source: 'broadcast' as const,
      }));
  }

  // ── Get unread count ──
  async getUnreadCount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastBroadcastReadAt: true },
    });

    // Count personal unread
    const personalUnread = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    // Count broadcast unread (simplified: count broadcasts after lastBroadcastReadAt)
    const bookmarks = await this.prisma.bookmark.findMany({
      where: { userId, notifyUpdate: true },
      select: { comicId: true, createdAt: true },
    });
    const comicIds = bookmarks.map((b) => b.comicId);

    const orConditions: Prisma.BroadcastEventWhereInput[] = [];
    if (comicIds.length > 0) {
      orConditions.push({
        targetType: 'COMIC_FOLLOWERS',
        targetId: { in: comicIds },
      });
    }
    orConditions.push({ targetType: 'ALL_USERS' });

    let broadcastUnread = 0;
    if (orConditions.length > 0) {
      const lastRead = user?.lastBroadcastReadAt;
      broadcastUnread = await this.prisma.broadcastEvent.count({
        where: {
          OR: orConditions,
          ...(lastRead && { createdAt: { gt: lastRead } }),
        },
      });
    }

    return personalUnread + broadcastUnread;
  }

  // ── Mark one personal notification as read ──
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) throw new ForbiddenException();

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ── Mark all as read (personal + broadcast) ──
  async markAllAsRead(userId: string) {
    await Promise.all([
      // Mark all personal as read
      this.prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      }),
      // Update broadcast read timestamp
      this.prisma.user.update({
        where: { id: userId },
        data: { lastBroadcastReadAt: new Date() },
      }),
    ]);
  }

  // ── Delete a personal notification ──
  async deleteNotification(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) throw new ForbiddenException();

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  // ── Create personal notification (1:1) ──
  async createPersonal(dto: CreatePersonalDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        data: dto.data || {},
      },
    });

    // Push via WebSocket
    this.gateway.sendToUser(dto.userId, 'notification:new', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      data: notification.data,
      isRead: false,
      createdAt: notification.createdAt,
      source: 'personal',
    });

    // Also push updated unread count
    const unreadCount = await this.getUnreadCount(dto.userId);
    this.gateway.sendToUser(dto.userId, 'notification:unread-count', { count: unreadCount });

    this.logger.log(`Personal notification created for user ${dto.userId}: ${dto.type}`);
    return notification;
  }

  // ── Create broadcast event (1:N) ──
  async createBroadcast(dto: CreateBroadcastDto) {
    const broadcast = await this.prisma.broadcastEvent.create({
      data: {
        type: dto.type,
        title: dto.title,
        content: dto.content,
        data: dto.data || {},
        targetType: dto.targetType,
        targetId: dto.targetId,
        actorId: dto.actorId,
      },
    });

    // Push to online users who should receive this
    if (dto.targetType === 'COMIC_FOLLOWERS' && dto.targetId) {
      const bookmarks = await this.prisma.bookmark.findMany({
        where: { comicId: dto.targetId, notifyUpdate: true },
        select: { userId: true },
      });

      const userIds = bookmarks.map((b) => b.userId);
      const payload = {
        id: broadcast.id,
        type: broadcast.type,
        title: broadcast.title,
        content: broadcast.content,
        data: broadcast.data,
        isRead: false,
        createdAt: broadcast.createdAt,
        source: 'broadcast',
      };

      this.gateway.sendToUsers(userIds, 'notification:new', payload);

      // Push unread counts to online users
      for (const uid of userIds) {
        if (this.gateway.isUserOnline(uid)) {
          const count = await this.getUnreadCount(uid);
          this.gateway.sendToUser(uid, 'notification:unread-count', { count });
        }
      }
    }

    this.logger.log(`Broadcast event created: ${dto.type} for ${dto.targetType}`);
    return broadcast;
  }
}
