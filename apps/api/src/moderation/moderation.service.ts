import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ApprovalStatus, ModerationTargetType, NotificationType, ComicStatus, Prisma, UserRole } from '@prisma/client';
import { PendingQueryDto, ModerationLogsQueryDto } from './dto/moderation.dto';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ── Auto Approval Helper ──
  async submitForReview(userId: string, targetType: ModerationTargetType, targetId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isVerified: true, isTrusted: true, role: true },
    });

    const isAutoApproved =
      (user?.isTrusted === true && user?.isVerified === true) ||
      user?.role === UserRole.ADMIN ||
      user?.role === UserRole.MODERATOR;
    const nextStatus = isAutoApproved ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING_APPROVAL;

    if (targetType === ModerationTargetType.COMIC) {
      const comic = await this.prisma.comic.findUnique({ where: { id: targetId } });
      if (!comic) throw new NotFoundException('Comic not found');
      if (comic.authorId !== userId) throw new BadRequestException('Not the author');

      const updated = await this.prisma.comic.update({
        where: { id: targetId },
        data: {
          approvalStatus: nextStatus,
          rejectionReason: null,
          ...(isAutoApproved && {
            status: ComicStatus.ONGOING,
            publishedAt: comic.publishedAt || new Date(),
          }),
        },
      });

      await this.redis.del(`comic:${comic.slug}`);
      return { autoApproved: isAutoApproved, status: nextStatus, data: updated };
    }

    if (targetType === ModerationTargetType.CHAPTER) {
      const chapter = await this.prisma.chapter.findUnique({
        where: { id: targetId },
        include: { comic: { select: { authorId: true, slug: true } } },
      });
      if (!chapter) throw new NotFoundException('Chapter not found');
      if (chapter.comic.authorId !== userId) throw new BadRequestException('Not the author');

      const updated = await this.prisma.chapter.update({
        where: { id: targetId },
        data: {
          approvalStatus: nextStatus,
          rejectionReason: null,
          ...(isAutoApproved && {
            publishedAt: chapter.publishedAt || new Date(),
          }),
        },
      });

      await this.redis.del(`comic:${chapter.comic.slug}`);
      return { autoApproved: isAutoApproved, status: nextStatus, data: updated };
    }

    if (targetType === ModerationTargetType.NEWS) {
      const article = await this.prisma.newsArticle.findUnique({ where: { id: targetId } });
      if (!article) throw new NotFoundException('News article not found');
      if (article.authorId !== userId) throw new BadRequestException('Not the author');

      const updated = await this.prisma.newsArticle.update({
        where: { id: targetId },
        data: {
          approvalStatus: nextStatus,
          rejectionReason: null,
          ...(isAutoApproved && {
            isPublished: true,
            publishedAt: article.publishedAt || new Date(),
          }),
        },
      });

      return { autoApproved: isAutoApproved, status: nextStatus, data: updated };
    }

    throw new BadRequestException('Invalid target type');
  }

  // ── Get Pending Queue for Admin / Moderator ──
  async getPendingQueue(query: PendingQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 50);

    const items: Array<{
      targetType: ModerationTargetType;
      targetId: string;
      title: string;
      author: { id: string; displayName: string; avatarUrl: string | null; username: string };
      createdAt: Date;
      updatedAt: Date;
      previewUrl?: string;
      extraInfo?: Record<string, any>;
    }> = [];

    if (!query.targetType || query.targetType === ModerationTargetType.COMIC) {
      const comics = await this.prisma.comic.findMany({
        where: { approvalStatus: ApprovalStatus.PENDING_APPROVAL, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true, username: true, isVerified: true, isTrusted: true } },
          genres: { include: { genre: true } },
        },
      });
      comics.forEach((c) =>
        items.push({
          targetType: ModerationTargetType.COMIC,
          targetId: c.id,
          title: c.title,
          author: c.author,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          extraInfo: {
            coverUrl: c.coverUrl,
            bannerUrl: c.bannerUrl,
            description: c.description,
            contentRating: c.contentRating,
            originalLanguage: c.originalLanguage,
            slug: c.slug,
            totalChapters: c.totalChapters,
            genres: c.genres?.map((cg) => cg.genre.name) || [],
          },
        }),
      );
    }

    if (!query.targetType || query.targetType === ModerationTargetType.CHAPTER) {
      const chapters = await this.prisma.chapter.findMany({
        where: { approvalStatus: ApprovalStatus.PENDING_APPROVAL, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        include: {
          comic: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverUrl: true,
              author: { select: { id: true, displayName: true, avatarUrl: true, username: true, isVerified: true, isTrusted: true } },
            },
          },
          pages: { orderBy: { pageNumber: 'asc' } },
        },
      });
      chapters.forEach((ch) =>
        items.push({
          targetType: ModerationTargetType.CHAPTER,
          targetId: ch.id,
          title: `Chương ${ch.number}${ch.title ? `: ${ch.title}` : ''} - ${ch.comic.title}`,
          author: ch.comic.author,
          createdAt: ch.createdAt,
          updatedAt: ch.updatedAt,
          extraInfo: {
            comicTitle: ch.comic.title,
            comicSlug: ch.comic.slug,
            comicCoverUrl: ch.comic.coverUrl,
            chapterId: ch.id,
            number: ch.number,
            chapterTitle: ch.title,
            totalPages: ch.totalPages,
            pages: ch.pages.map((p) => ({ pageNumber: p.pageNumber, imageUrl: p.imageUrl })),
          },
        }),
      );
    }

    if (!query.targetType || query.targetType === ModerationTargetType.NEWS) {
      const news = await this.prisma.newsArticle.findMany({
        where: { approvalStatus: ApprovalStatus.PENDING_APPROVAL, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        include: { author: { select: { id: true, displayName: true, avatarUrl: true, username: true, isVerified: true, isTrusted: true } } },
      });
      news.forEach((n) =>
        items.push({
          targetType: ModerationTargetType.NEWS,
          targetId: n.id,
          title: n.title,
          author: n.author,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
          extraInfo: {
            coverUrl: n.coverUrl,
            category: n.category,
            excerpt: n.excerpt,
            content: n.content,
            tags: n.tags,
            slug: n.slug,
          },
        }),
      );
    }

    // Sort all combined items by updatedAt desc
    items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const total = items.length;
    const startIndex = (page - 1) * limit;
    const paginated = items.slice(startIndex, startIndex + limit);

    return {
      data: paginated,
      meta: { page, limit, total, hasNext: startIndex + limit < total },
    };
  }

  // ── Approve Item ──
  async approveItem(moderatorId: string, targetType: ModerationTargetType, targetId: string) {
    if (targetType === ModerationTargetType.COMIC) {
      const comic = await this.prisma.comic.findUnique({ where: { id: targetId } });
      if (!comic) throw new NotFoundException('Comic not found');

      const updated = await this.prisma.comic.update({
        where: { id: targetId },
        data: {
          approvalStatus: ApprovalStatus.APPROVED,
          status: ComicStatus.ONGOING,
          publishedAt: comic.publishedAt || new Date(),
          rejectionReason: null,
        },
      });

      await this.prisma.moderationLog.create({
        data: {
          targetType: ModerationTargetType.COMIC,
          targetId,
          action: ApprovalStatus.APPROVED,
          moderatorId,
        },
      });

      await this.prisma.notification.create({
        data: {
          userId: comic.authorId,
          type: NotificationType.CONTENT_APPROVED,
          title: 'Truyện đã được duyệt!',
          content: `Truyện "${comic.title}" của bạn đã được ban quản trị phê duyệt và xuất bản.`,
          data: { comicId: comic.id, slug: comic.slug },
        },
      });

      await this.redis.del(`comic:${comic.slug}`);
      this.checkAndPromoteAuthorTrust(comic.authorId).catch(() => {});
      return updated;
    }

    if (targetType === ModerationTargetType.CHAPTER) {
      const chapter = await this.prisma.chapter.findUnique({
        where: { id: targetId },
        include: { comic: { select: { authorId: true, title: true, slug: true } } },
      });
      if (!chapter) throw new NotFoundException('Chapter not found');

      const updated = await this.prisma.chapter.update({
        where: { id: targetId },
        data: {
          approvalStatus: ApprovalStatus.APPROVED,
          publishedAt: chapter.publishedAt || new Date(),
          rejectionReason: null,
        },
      });

      await this.prisma.moderationLog.create({
        data: {
          targetType: ModerationTargetType.CHAPTER,
          targetId,
          action: ApprovalStatus.APPROVED,
          moderatorId,
        },
      });

      await this.prisma.notification.create({
        data: {
          userId: chapter.comic.authorId,
          type: NotificationType.CONTENT_APPROVED,
          title: 'Chương truyện đã được duyệt!',
          content: `Chương ${chapter.number} của truyện "${chapter.comic.title}" đã được duyệt thành công.`,
          data: { comicId: chapter.comicId, chapterId: chapter.id, slug: chapter.comic.slug },
        },
      });

      await this.redis.del(`comic:${chapter.comic.slug}`);
      this.checkAndPromoteAuthorTrust(chapter.comic.authorId).catch(() => {});
      return updated;
    }

    if (targetType === ModerationTargetType.NEWS) {
      const article = await this.prisma.newsArticle.findUnique({ where: { id: targetId } });
      if (!article) throw new NotFoundException('News article not found');

      const updated = await this.prisma.newsArticle.update({
        where: { id: targetId },
        data: {
          approvalStatus: ApprovalStatus.APPROVED,
          isPublished: true,
          publishedAt: article.publishedAt || new Date(),
          rejectionReason: null,
        },
      });

      await this.prisma.moderationLog.create({
        data: {
          targetType: ModerationTargetType.NEWS,
          targetId,
          action: ApprovalStatus.APPROVED,
          moderatorId,
        },
      });

      await this.prisma.notification.create({
        data: {
          userId: article.authorId,
          type: NotificationType.CONTENT_APPROVED,
          title: 'Bài viết đã được duyệt!',
          content: `Bài viết "${article.title}" của bạn đã được phê duyệt và xuất bản.`,
          data: { newsId: article.id, slug: article.slug },
        },
      });

      this.checkAndPromoteAuthorTrust(article.authorId).catch(() => {});
      return updated;
    }

    throw new BadRequestException('Invalid target type');
  }

  // ── Reject Item ──
  async rejectItem(moderatorId: string, targetType: ModerationTargetType, targetId: string, reason: string) {
    if (targetType === ModerationTargetType.COMIC) {
      const comic = await this.prisma.comic.findUnique({ where: { id: targetId } });
      if (!comic) throw new NotFoundException('Comic not found');

      const updated = await this.prisma.comic.update({
        where: { id: targetId },
        data: {
          approvalStatus: ApprovalStatus.REJECTED,
          rejectionReason: reason,
        },
      });

      await this.prisma.moderationLog.create({
        data: {
          targetType: ModerationTargetType.COMIC,
          targetId,
          action: ApprovalStatus.REJECTED,
          reason,
          moderatorId,
        },
      });

      await this.prisma.notification.create({
        data: {
          userId: comic.authorId,
          type: NotificationType.CONTENT_REJECTED,
          title: 'Truyện bị từ chối phê duyệt',
          content: `Truyện "${comic.title}" chưa được duyệt. Lý do: ${reason}`,
          data: { comicId: comic.id },
        },
      });

      await this.redis.del(`comic:${comic.slug}`);
      return updated;
    }

    if (targetType === ModerationTargetType.CHAPTER) {
      const chapter = await this.prisma.chapter.findUnique({
        where: { id: targetId },
        include: { comic: { select: { authorId: true, title: true, slug: true } } },
      });
      if (!chapter) throw new NotFoundException('Chapter not found');

      const updated = await this.prisma.chapter.update({
        where: { id: targetId },
        data: {
          approvalStatus: ApprovalStatus.REJECTED,
          rejectionReason: reason,
        },
      });

      await this.prisma.moderationLog.create({
        data: {
          targetType: ModerationTargetType.CHAPTER,
          targetId,
          action: ApprovalStatus.REJECTED,
          reason,
          moderatorId,
        },
      });

      await this.prisma.notification.create({
        data: {
          userId: chapter.comic.authorId,
          type: NotificationType.CONTENT_REJECTED,
          title: 'Chương truyện bị từ chối phê duyệt',
          content: `Chương ${chapter.number} của truyện "${chapter.comic.title}" chưa được duyệt. Lý do: ${reason}`,
          data: { comicId: chapter.comicId, chapterId: chapter.id },
        },
      });

      await this.redis.del(`comic:${chapter.comic.slug}`);
      return updated;
    }

    if (targetType === ModerationTargetType.NEWS) {
      const article = await this.prisma.newsArticle.findUnique({ where: { id: targetId } });
      if (!article) throw new NotFoundException('News article not found');

      const updated = await this.prisma.newsArticle.update({
        where: { id: targetId },
        data: {
          approvalStatus: ApprovalStatus.REJECTED,
          rejectionReason: reason,
          isPublished: false,
        },
      });

      await this.prisma.moderationLog.create({
        data: {
          targetType: ModerationTargetType.NEWS,
          targetId,
          action: ApprovalStatus.REJECTED,
          reason,
          moderatorId,
        },
      });

      await this.prisma.notification.create({
        data: {
          userId: article.authorId,
          type: NotificationType.CONTENT_REJECTED,
          title: 'Bài viết bị từ chối phê duyệt',
          content: `Bài viết "${article.title}" chưa được duyệt. Lý do: ${reason}`,
          data: { newsId: article.id },
        },
      });

      return updated;
    }

    throw new BadRequestException('Invalid target type');
  }

  // ── Get Moderation History Logs ──
  async getModerationLogs(query: ModerationLogsQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.ModerationLogWhereInput = {};
    if (query.targetType) where.targetType = query.targetType;
    if (query.action) where.action = query.action;

    const [logs, total] = await Promise.all([
      this.prisma.moderationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          moderator: {
            select: { id: true, displayName: true, avatarUrl: true, username: true },
          },
        },
      }),
      this.prisma.moderationLog.count({ where }),
    ]);

    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        let title = 'Nội dung';
        let extraInfo: Record<string, any> = {};

        if (log.targetType === ModerationTargetType.COMIC) {
          const comic = await this.prisma.comic.findUnique({
            where: { id: log.targetId },
            select: { title: true, slug: true, coverUrl: true, author: { select: { displayName: true } } },
          });
          if (comic) {
            title = comic.title;
            extraInfo = { coverUrl: comic.coverUrl, slug: comic.slug, authorName: comic.author?.displayName };
          }
        } else if (log.targetType === ModerationTargetType.CHAPTER) {
          const chapter = await this.prisma.chapter.findUnique({
            where: { id: log.targetId },
            select: { number: true, title: true, comic: { select: { title: true, slug: true } } },
          });
          if (chapter) {
            title = `Chương ${chapter.number}${chapter.title ? `: ${chapter.title}` : ''} - ${chapter.comic.title}`;
            extraInfo = { comicTitle: chapter.comic.title, comicSlug: chapter.comic.slug };
          }
        } else if (log.targetType === ModerationTargetType.NEWS) {
          const article = await this.prisma.newsArticle.findUnique({
            where: { id: log.targetId },
            select: { title: true, slug: true, coverUrl: true },
          });
          if (article) {
            title = article.title;
            extraInfo = { coverUrl: article.coverUrl, slug: article.slug };
          }
        }

        return {
          id: log.id,
          targetType: log.targetType,
          targetId: log.targetId,
          title,
          action: log.action,
          reason: log.reason,
          createdAt: log.createdAt,
          moderator: log.moderator,
          extraInfo,
        };
      }),
    );

    return {
      data: enrichedLogs,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: skip + limit < total },
    };
  }

  // ── Auto-promote Author to Trusted after Milestones ──
  private async checkAndPromoteAuthorTrust(authorId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: authorId },
        select: { id: true, isTrusted: true, isVerified: true },
      });
      if (!user || user.isTrusted || !user.isVerified) return;

      const [approvedComics, approvedChapters, approvedNews] = await Promise.all([
        this.prisma.comic.count({ where: { authorId, approvalStatus: ApprovalStatus.APPROVED, deletedAt: null } }),
        this.prisma.chapter.count({
          where: { comic: { authorId }, approvalStatus: ApprovalStatus.APPROVED, deletedAt: null },
        }),
        this.prisma.newsArticle.count({ where: { authorId, approvalStatus: ApprovalStatus.APPROVED, deletedAt: null } }),
      ]);

      const totalApproved = approvedComics + approvedChapters + approvedNews;
      // Milestone: 3 approved items
      if (totalApproved >= 3) {
        await this.prisma.user.update({
          where: { id: authorId },
          data: { isTrusted: true },
        });

        await this.prisma.notification.create({
          data: {
            userId: authorId,
            type: NotificationType.SYSTEM,
            title: 'Chứng nhận Tác giả Uy tín ⭐',
            content: 'Chúc mừng! Bạn đã đạt mốc 3 nội dung được phê duyệt thành công và được nâng cấp thành Tác giả Uy tín. Các truyện và chương tiếp theo của bạn sẽ được tự động xuất bản ngay lập tức.',
            data: { isTrusted: true, totalApproved },
          },
        });
        this.logger.log(`Author ${authorId} auto-promoted to Trusted Creator (Total approved: ${totalApproved})`);
      }
    } catch (err) {
      this.logger.error(`Failed to check/promote trust for author ${authorId}: ${(err as Error).message}`);
    }
  }

  // ── Manually Grant / Revoke Trusted Creator Status ──
  async setUserTrust(moderatorId: string, targetUserId: string, isTrusted: boolean, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isTrusted },
      select: { id: true, username: true, displayName: true, isVerified: true, isTrusted: true },
    });

    await this.prisma.notification.create({
      data: {
        userId: targetUserId,
        type: NotificationType.SYSTEM,
        title: isTrusted ? 'Bạn đã được cấp quyền Tác giả Uy tín ⭐' : 'Thông báo trạng thái kiểm duyệt',
        content: isTrusted
          ? 'Quản trị viên đã cấp quyền Tác giả Uy tín cho tài khoản của bạn. Các tác phẩm tiếp theo sẽ được tự động phê duyệt.'
          : `Trạng thái Tác giả Uy tín của bạn đã bị hủy${reason ? `: ${reason}` : '.'} Các tác phẩm mới sẽ cần được kiểm duyệt trước khi xuất bản.`,
        data: { isTrusted, reason },
      },
    });

    this.logger.log(`Moderator ${moderatorId} set isTrusted=${isTrusted} for user ${targetUserId}`);
    return updated;
  }
}
