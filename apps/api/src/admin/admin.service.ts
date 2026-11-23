import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ApprovalStatus, AuthorApplicationStatus, NotificationType, Prisma, ReportStatus, UserRole } from '@prisma/client';
import { getCultivationInfo } from 'shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { AdminUserQueryDto, ReviewAuthorApplicationDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private disconnectUserSockets(userId: string) {
    try {
      const gateway = this.moduleRef.get(NotificationGateway, { strict: false });
      gateway?.disconnectUser(userId);
    } catch {
      // Gateway unavailable outside HTTP/WS bootstrap
    }
  }

  async getStudioOverview(userId: string) {
    const [comics, newsCount, revenueAgg, recentComics, userMeta, revConfig] = await Promise.all([
      this.prisma.comic.findMany({
        where: { authorId: userId, deletedAt: null },
        select: {
          id: true,
          title: true,
          slug: true,
          coverUrl: true,
          status: true,
          approvalStatus: true,
          totalViews: true,
          totalBookmarks: true,
          totalChapters: true,
          avgRating: true,
          totalRatings: true,
          updatedAt: true,
        },
        orderBy: { totalViews: 'desc' },
      }),
      this.prisma.newsArticle.count({ where: { authorId: userId, deletedAt: null } }),
      this.prisma.rewardTransaction.aggregate({
        where: { userId, source: 'author_revenue', currency: 'COIN' },
        _sum: { amount: true },
      }),
      this.prisma.chapter.findMany({
        where: { comic: { authorId: userId, deletedAt: null }, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          number: true,
          title: true,
          approvalStatus: true,
          views: true,
          isPremium: true,
          priceCoins: true,
          createdAt: true,
          comic: { select: { id: true, title: true, slug: true } },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { isTrusted: true, role: true },
      }),
      this.prisma.gamificationConfig.findUnique({
        where: { key: 'author_revenue_percent' },
        select: { value: true },
      }),
    ]);

    const totalViews = comics.reduce((acc, c) => acc + c.totalViews, 0);
    const totalBookmarks = comics.reduce((acc, c) => acc + c.totalBookmarks, 0);
    const totalChapters = comics.reduce((acc, c) => acc + c.totalChapters, 0);
    const ratedComics = comics.filter((c) => c.totalRatings > 0);
    const avgRating =
      ratedComics.length > 0
        ? ratedComics.reduce((acc, c) => acc + Number(c.avgRating), 0) / ratedComics.length
        : 0;

    const isAutoApproveEligible =
      userMeta?.isTrusted === true ||
      userMeta?.role === UserRole.ADMIN ||
      userMeta?.role === UserRole.MODERATOR;

    return {
      stats: {
        totalComics: comics.length,
        totalChapters,
        totalViews,
        totalBookmarks,
        totalNews: newsCount,
        totalRevenueCoins: revenueAgg._sum.amount || 0,
        avgRating: Number(avgRating.toFixed(2)),
        authorRevenuePercent: Math.min(100, Math.max(0, revConfig?.value ?? 70)),
        isAutoApproveEligible,
      },
      topComics: comics.slice(0, 5).map((c) => ({ ...c, avgRating: Number(c.avgRating) })),
      recentChapters: recentComics.map((ch) => ({ ...ch, number: Number(ch.number) })),
    };
  }

  async getAdminOverview() {
    const [
      totalUsers,
      totalComics,
      totalChapters,
      totalNews,
      pendingComics,
      pendingChapters,
      pendingNews,
      pendingReports,
      pendingAuthorApplications,
      viewsAgg,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.comic.count({ where: { deletedAt: null } }),
      this.prisma.chapter.count({ where: { deletedAt: null, comic: { deletedAt: null } } }),
      this.prisma.newsArticle.count({ where: { deletedAt: null } }),
      this.prisma.comic.count({ where: { approvalStatus: ApprovalStatus.PENDING_APPROVAL, deletedAt: null } }),
      this.prisma.chapter.count({
        where: {
          approvalStatus: ApprovalStatus.PENDING_APPROVAL,
          deletedAt: null,
          comic: { deletedAt: null },
        },
      }),
      this.prisma.newsArticle.count({ where: { approvalStatus: ApprovalStatus.PENDING_APPROVAL, deletedAt: null } }),
      this.prisma.report.count({ where: { status: ReportStatus.PENDING } }),
      this.prisma.authorApplication.count({ where: { status: AuthorApplicationStatus.PENDING } }),
      this.prisma.comic.aggregate({ where: { deletedAt: null }, _sum: { totalViews: true } }),
    ]);

    return {
      totalUsers,
      totalComics,
      totalChapters,
      totalNews,
      totalViews: viewsAgg._sum.totalViews || 0,
      pendingModerationCount: pendingComics + pendingChapters + pendingNews,
      pendingBreakdown: { comics: pendingComics, chapters: pendingChapters, news: pendingNews },
      pendingReportsCount: pendingReports,
      pendingAuthorApplicationsCount: pendingAuthorApplications,
    };
  }

  async listUsers(query: AdminUserQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 50);
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.role && { role: query.role }),
      ...(query.search && {
        OR: [
          { username: { contains: query.search, mode: 'insensitive' } },
          { displayName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          isVerified: true,
          isTrusted: true,
          isBanned: true,
          bannedReason: true,
          bannedUntil: true,
          level: true,
          experience: true,
          coins: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => ({
        ...u,
        cultivation: getCultivationInfo(u.level, u.experience),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
      },
    };
  }

  async updateUserRole(actorId: string, targetId: string, role: UserRole) {
    if (actorId === targetId && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Không thể tự hạ quyền Admin của chính mình');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target || target.deletedAt) throw new NotFoundException('Không tìm thấy người dùng');

    return this.prisma.user.update({
      where: { id: targetId },
      data: { role },
      select: { id: true, username: true, displayName: true, role: true },
    });
  }

  async banUser(
    actorId: string,
    targetId: string,
    isBanned: boolean,
    reason?: string,
    banDurationDays?: number,
  ) {
    if (actorId === targetId) {
      throw new ForbiddenException('Không thể tự khóa tài khoản của chính mình');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target || target.deletedAt) throw new NotFoundException('Không tìm thấy người dùng');
    if (isBanned && target.role === UserRole.ADMIN) {
      throw new ForbiddenException('Không thể khóa tài khoản Quản trị viên (Admin)');
    }

    const nextBannedUntil =
      isBanned && banDurationDays
        ? new Date(Date.now() + banDurationDays * 86_400_000)
        : null;

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: {
        isBanned,
        bannedReason: isBanned ? reason?.trim() || 'Vi phạm quy định nền tảng' : null,
        bannedUntil: isBanned ? nextBannedUntil : null,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        isBanned: true,
        bannedReason: true,
        bannedUntil: true,
      },
    });

    if (isBanned) {
      await this.prisma.refreshSession.updateMany({
        where: { userId: targetId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.disconnectUserSockets(targetId);
    }

    return updated;
  }

  async listAuthorApplications(
    status?: AuthorApplicationStatus | 'ALL',
    page = 1,
    limit = 50,
  ) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safeLimit = Math.min(Math.max(1, Math.floor(Number(limit) || 50)), 100);
    const skip = (safePage - 1) * safeLimit;
    const where: Prisma.AuthorApplicationWhereInput =
      status && status !== 'ALL' ? { status } : {};

    return this.prisma.authorApplication.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: safeLimit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            level: true,
            role: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });
  }

  async reviewAuthorApplication(
    adminId: string,
    id: string,
    dto: ReviewAuthorApplicationDto,
  ) {
    const app = await this.prisma.authorApplication.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, displayName: true, role: true, deletedAt: true, isBanned: true } },
      },
    });
    if (!app) throw new NotFoundException('Không tìm thấy đơn đăng ký Tác giả');
    if (app.status !== AuthorApplicationStatus.PENDING) {
      throw new BadRequestException('Đơn đăng ký này đã được xử lý trước đó');
    }
    if (dto.decision === 'APPROVED' && (!app.user || app.user.deletedAt || app.user.isBanned)) {
      throw new BadRequestException('Không thể phê duyệt tài khoản đã bị khóa hoặc bị xóa');
    }

    const note = dto.reviewNote?.trim() || null;
    if (dto.decision === 'REJECTED' && !note) {
      throw new BadRequestException('Vui lòng nhập lý do từ chối');
    }

    const nextStatus =
      dto.decision === 'APPROVED'
        ? AuthorApplicationStatus.APPROVED
        : AuthorApplicationStatus.REJECTED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.authorApplication.updateMany({
        where: { id, status: AuthorApplicationStatus.PENDING },
        data: {
          status: nextStatus,
          reviewerId: adminId,
          reviewNote: note,
          reviewedAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        throw new BadRequestException('Đơn đăng ký này đã được xử lý trước đó');
      }

      if (dto.decision === 'APPROVED') {
        await tx.user.updateMany({
          where: { id: app.userId, role: UserRole.READER, deletedAt: null },
          data: { role: UserRole.AUTHOR },
        });
      }

      return tx.authorApplication.findUniqueOrThrow({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              level: true,
              role: true,
            },
          },
          reviewer: {
            select: { id: true, username: true, displayName: true },
          },
        },
      });
    });

    await this.notificationService
      .createPersonal({
        userId: app.userId,
        actorId: adminId,
        type:
          dto.decision === 'APPROVED'
            ? NotificationType.CONTENT_APPROVED
            : NotificationType.CONTENT_REJECTED,
        title:
          dto.decision === 'APPROVED'
            ? 'Đơn đăng ký Tác giả đã được Admin phê duyệt!'
            : 'Đơn đăng ký Tác giả chưa được chấp thuận',
        content:
          dto.decision === 'APPROVED'
            ? note || `Chúc mừng bút danh "${app.penName}"! Bạn đã có quyền truy cập Author Studio để sáng tác.`
            : note!,
        actionUrl: '/studio',
      })
      .catch(() => {});

    return updated;
  }
}
