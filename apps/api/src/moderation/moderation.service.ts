import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import {
  ApprovalStatus,
  ComicStatus,
  ModerationTargetType,
  NotificationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotificationService } from '../notification/notification.service';
import { GenreService } from '../genre/genre.service';
import { ModerationLogsQueryDto, PendingQueryDto } from './dto/moderation.dto';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.READER]: 0,
  [UserRole.AUTHOR]: 1,
  [UserRole.MODERATOR]: 2,
  [UserRole.ADMIN]: 3,
};

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notificationService: NotificationService,
    private readonly genreService: GenreService,
  ) {}

  async submitForReview(userId: string, targetType: ModerationTargetType, targetId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isTrusted: true, role: true },
    });

    const isAutoApproved =
      user?.isTrusted === true ||
      user?.role === UserRole.ADMIN ||
      user?.role === UserRole.MODERATOR;

    if (targetType === ModerationTargetType.COMIC) {
      const comic = await this.prisma.comic.findUnique({
        where: { id: targetId },
        include: { genres: { select: { genreId: true } } },
      });
      if (!comic || comic.deletedAt) throw new NotFoundException('Không tìm thấy truyện');
      if (comic.authorId !== userId && user?.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Bạn không phải tác giả của truyện này');
      }
      if (
        comic.approvalStatus === ApprovalStatus.APPROVED ||
        comic.approvalStatus === ApprovalStatus.PENDING_APPROVAL
      ) {
        throw new BadRequestException('Truyện này đã được duyệt hoặc đang chờ kiểm duyệt');
      }

      const nextStatus = isAutoApproved ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING_APPROVAL;
      const updated = await this.prisma.comic.update({
        where: { id: targetId },
        data: {
          approvalStatus: nextStatus,
          rejectionReason: null,
          ...(isAutoApproved && {
            status: comic.status === ComicStatus.DRAFT ? ComicStatus.ONGOING : comic.status,
            publishedAt: comic.publishedAt || new Date(),
          }),
        },
      });

      if (isAutoApproved) {
        await this.genreService.recalculateCounts(comic.genres.map((g) => g.genreId)).catch(() => {});
        await this.redis.deletePattern('rankings*');
      }
      await this.redis.del(`comic:${comic.slug}`);
      await this.redis.deletePattern('homepage*');

      return { autoApproved: isAutoApproved, status: nextStatus, data: updated };
    }

    if (targetType === ModerationTargetType.CHAPTER) {
      const chapter = await this.prisma.chapter.findUnique({
        where: { id: targetId },
        include: {
          comic: { select: { id: true, title: true, slug: true, authorId: true, deletedAt: true } },
        },
      });
      if (!chapter || chapter.deletedAt || chapter.comic.deletedAt) {
        throw new NotFoundException('Không tìm thấy chương');
      }
      if (chapter.comic.authorId !== userId && user?.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Bạn không phải tác giả của chương này');
      }
      if (chapter.totalPages <= 0) {
        throw new BadRequestException('Chương phải có ít nhất 1 trang ảnh trước khi gửi duyệt');
      }
      if (
        chapter.approvalStatus === ApprovalStatus.APPROVED ||
        chapter.approvalStatus === ApprovalStatus.PENDING_APPROVAL
      ) {
        throw new BadRequestException('Chương này đã được xuất bản hoặc đang chờ kiểm duyệt');
      }

      const nextStatus = isAutoApproved ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING_APPROVAL;
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

      if (isAutoApproved) {
        await this.syncComicOnChapterPublish(chapter.comicId);
        await this.notificationService
          .notifyComicFollowers(chapter.comicId, {
            actorId: chapter.comic.authorId,
            title: `${chapter.comic.title} vừa ra chương mới!`,
            content: `Chương ${chapter.number}${chapter.title ? `: ${chapter.title}` : ''} đã lên sóng.`,
            actionUrl: `/read/${chapter.id}`,
            data: { comicId: chapter.comicId, chapterId: chapter.id, slug: chapter.comic.slug },
          })
          .catch(() => {});
        await this.redis.deletePattern('rankings*');
      }

      await this.redis.del(`comic:${chapter.comic.slug}`);
      await this.redis.deletePattern('homepage*');

      return { autoApproved: isAutoApproved, status: nextStatus, data: updated };
    }

    if (targetType === ModerationTargetType.NEWS) {
      const article = await this.prisma.newsArticle.findUnique({ where: { id: targetId } });
      if (!article || article.deletedAt) throw new NotFoundException('Không tìm thấy bài viết');
      if (article.authorId !== userId && user?.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Bạn không có quyền gửi duyệt bài viết này');
      }
      if (
        article.approvalStatus === ApprovalStatus.APPROVED ||
        article.approvalStatus === ApprovalStatus.PENDING_APPROVAL
      ) {
        throw new BadRequestException('Bài viết này đã được duyệt hoặc đang chờ kiểm duyệt');
      }

      const nextStatus = isAutoApproved ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING_APPROVAL;
      const updated = await this.prisma.newsArticle.update({
        where: { id: targetId },
        data: {
          approvalStatus: nextStatus,
          rejectionReason: null,
          isPublished: isAutoApproved,
          ...(isAutoApproved && { publishedAt: article.publishedAt || new Date() }),
        },
      });

      return { autoApproved: isAutoApproved, status: nextStatus, data: updated };
    }

    throw new BadRequestException('Loại nội dung không hợp lệ');
  }

  async getPendingQueue(query: PendingQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 50);
    const singleType = Boolean(query.targetType);
    const skip = singleType ? (page - 1) * limit : 0;
    const take = singleType ? limit : Math.min(page * limit, 200);

    const comicWhere: Prisma.ComicWhereInput = {
      approvalStatus: ApprovalStatus.PENDING_APPROVAL,
      deletedAt: null,
    };
    const chapterWhere: Prisma.ChapterWhereInput = {
      approvalStatus: ApprovalStatus.PENDING_APPROVAL,
      deletedAt: null,
      comic: { deletedAt: null },
    };
    const newsWhere: Prisma.NewsArticleWhereInput = {
      approvalStatus: ApprovalStatus.PENDING_APPROVAL,
      deletedAt: null,
    };

    const includeComic = !query.targetType || query.targetType === ModerationTargetType.COMIC;
    const includeChapter = !query.targetType || query.targetType === ModerationTargetType.CHAPTER;
    const includeNews = !query.targetType || query.targetType === ModerationTargetType.NEWS;

    const [comics, comicTotal, chapters, chapterTotal, news, newsTotal] = await Promise.all([
      includeComic
        ? this.prisma.comic.findMany({
            where: comicWhere,
            orderBy: { updatedAt: 'desc' },
            skip,
            take,
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  isVerified: true,
                  isTrusted: true,
                },
              },
              genres: { include: { genre: true } },
            },
          })
        : [],
      includeComic ? this.prisma.comic.count({ where: comicWhere }) : 0,
      includeChapter
        ? this.prisma.chapter.findMany({
            where: chapterWhere,
            orderBy: { updatedAt: 'desc' },
            skip,
            take,
            include: {
              comic: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  coverUrl: true,
                  author: {
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      avatarUrl: true,
                      isVerified: true,
                      isTrusted: true,
                    },
                  },
                },
              },
              pages: { orderBy: { pageNumber: 'asc' }, take: 20 },
            },
          })
        : [],
      includeChapter ? this.prisma.chapter.count({ where: chapterWhere }) : 0,
      includeNews
        ? this.prisma.newsArticle.findMany({
            where: newsWhere,
            orderBy: { updatedAt: 'desc' },
            skip,
            take,
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  isVerified: true,
                  isTrusted: true,
                },
              },
            },
          })
        : [],
      includeNews ? this.prisma.newsArticle.count({ where: newsWhere }) : 0,
    ]);

    const items: Array<{
      targetType: ModerationTargetType;
      targetId: string;
      title: string;
      author: {
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
        isVerified: boolean;
        isTrusted: boolean;
      };
      createdAt: Date;
      updatedAt: Date;
      extraInfo: Record<string, unknown>;
    }> = [];

    for (const c of comics) {
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
          type: c.type,
          contentRating: c.contentRating,
          slug: c.slug,
          genres: c.genres.map((g) => g.genre.name),
        },
      });
    }

    for (const ch of chapters) {
      items.push({
        targetType: ModerationTargetType.CHAPTER,
        targetId: ch.id,
        title: `Chương ${ch.number}${ch.title ? `: ${ch.title}` : ''} — ${ch.comic.title}`,
        author: ch.comic.author,
        createdAt: ch.createdAt,
        updatedAt: ch.updatedAt,
        extraInfo: {
          comicId: ch.comic.id,
          comicTitle: ch.comic.title,
          comicSlug: ch.comic.slug,
          comicCoverUrl: ch.comic.coverUrl,
          number: Number(ch.number),
          totalPages: ch.totalPages,
          isPremium: ch.isPremium,
          priceCoins: ch.priceCoins,
          pages: ch.pages.map((p) => ({ pageNumber: p.pageNumber, imageUrl: p.imageUrl })),
        },
      });
    }

    for (const n of news) {
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
          slug: n.slug,
        },
      });
    }

    items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const startIndex = singleType ? 0 : (page - 1) * limit;
    const paginated = items.slice(startIndex, startIndex + limit);
    const total = comicTotal + chapterTotal + newsTotal;

    return {
      data: paginated,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: (page - 1) * limit + paginated.length < total,
      },
    };
  }

  async approveItem(moderatorId: string, targetType: ModerationTargetType, targetId: string) {
    if (targetType === ModerationTargetType.COMIC) {
      const comic = await this.prisma.comic.findUnique({
        where: { id: targetId },
        include: { genres: { select: { genreId: true } } },
      });
      if (!comic || comic.deletedAt) throw new NotFoundException('Không tìm thấy truyện');

      const updated = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.comic.updateMany({
          where: {
            id: targetId,
            deletedAt: null,
            approvalStatus: ApprovalStatus.PENDING_APPROVAL,
          },
          data: {
            approvalStatus: ApprovalStatus.APPROVED,
            status: comic.status === ComicStatus.DRAFT ? ComicStatus.ONGOING : comic.status,
            publishedAt: comic.publishedAt || new Date(),
            rejectionReason: null,
          },
        });
        if (claimed.count === 0) {
          throw new BadRequestException('Truyện này không còn ở trạng thái chờ duyệt');
        }
        await tx.moderationLog.create({
          data: {
            targetType: ModerationTargetType.COMIC,
            targetId,
            targetTitle: comic.title,
            action: ApprovalStatus.APPROVED,
            moderatorId,
          },
        });
        return tx.comic.findUniqueOrThrow({ where: { id: targetId } });
      });

      await this.genreService.recalculateCounts(comic.genres.map((g) => g.genreId)).catch(() => {});
      await this.notificationService
        .createPersonal({
          userId: comic.authorId,
          actorId: moderatorId,
          type: NotificationType.CONTENT_APPROVED,
          title: 'Truyện của bạn đã được duyệt!',
          content: `Bộ truyện "${comic.title}" đã được phê duyệt và hiển thị công khai.`,
          actionUrl: `/comics/${comic.slug}`,
          data: { comicId: comic.id, slug: comic.slug },
        })
        .catch(() => {});

      await this.redis.del(`comic:${comic.slug}`);
      await this.redis.deletePattern('homepage*');
      await this.redis.deletePattern('rankings*');
      this.checkAndPromoteAuthorTrust(comic.authorId).catch(() => {});
      return updated;
    }

    if (targetType === ModerationTargetType.CHAPTER) {
      const chapter = await this.prisma.chapter.findUnique({
        where: { id: targetId },
        include: {
          comic: { select: { id: true, authorId: true, title: true, slug: true, deletedAt: true } },
        },
      });
      if (!chapter || chapter.deletedAt || chapter.comic.deletedAt) {
        throw new NotFoundException('Không tìm thấy chương');
      }

      const targetTitle = `Chương ${chapter.number}${chapter.title ? `: ${chapter.title}` : ''} — ${chapter.comic.title}`;

      const updated = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.chapter.updateMany({
          where: {
            id: targetId,
            deletedAt: null,
            approvalStatus: ApprovalStatus.PENDING_APPROVAL,
          },
          data: {
            approvalStatus: ApprovalStatus.APPROVED,
            publishedAt: chapter.publishedAt || new Date(),
            rejectionReason: null,
          },
        });
        if (claimed.count === 0) {
          throw new BadRequestException('Chương này không còn ở trạng thái chờ duyệt');
        }
        await tx.moderationLog.create({
          data: {
            targetType: ModerationTargetType.CHAPTER,
            targetId,
            targetTitle,
            action: ApprovalStatus.APPROVED,
            moderatorId,
          },
        });
        return tx.chapter.findUniqueOrThrow({ where: { id: targetId } });
      });

      await this.syncComicOnChapterPublish(chapter.comicId);

      await this.notificationService
        .createPersonal({
          userId: chapter.comic.authorId,
          actorId: moderatorId,
          type: NotificationType.CONTENT_APPROVED,
          title: 'Chương truyện đã được duyệt!',
          content: `Chương ${chapter.number} của "${chapter.comic.title}" đã xuất bản.`,
          actionUrl: `/read/${chapter.id}`,
          data: { comicId: chapter.comicId, chapterId: chapter.id, slug: chapter.comic.slug },
        })
        .catch(() => {});

      await this.notificationService
        .notifyComicFollowers(chapter.comicId, {
          actorId: chapter.comic.authorId,
          title: `${chapter.comic.title} vừa có chương mới!`,
          content: `Chương ${chapter.number}${chapter.title ? `: ${chapter.title}` : ''} đã sẵn sàng.`,
          actionUrl: `/read/${chapter.id}`,
          data: { comicId: chapter.comicId, chapterId: chapter.id, slug: chapter.comic.slug },
        })
        .catch(() => {});

      await this.redis.del(`comic:${chapter.comic.slug}`);
      await this.redis.deletePattern('homepage*');
      await this.redis.deletePattern('rankings*');
      this.checkAndPromoteAuthorTrust(chapter.comic.authorId).catch(() => {});
      return updated;
    }

    if (targetType === ModerationTargetType.NEWS) {
      const article = await this.prisma.newsArticle.findUnique({ where: { id: targetId } });
      if (!article || article.deletedAt) throw new NotFoundException('Không tìm thấy bài viết');

      const updated = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.newsArticle.updateMany({
          where: {
            id: targetId,
            deletedAt: null,
            approvalStatus: ApprovalStatus.PENDING_APPROVAL,
          },
          data: {
            approvalStatus: ApprovalStatus.APPROVED,
            isPublished: true,
            publishedAt: article.publishedAt || new Date(),
            rejectionReason: null,
          },
        });
        if (claimed.count === 0) {
          throw new BadRequestException('Bài viết này không còn ở trạng thái chờ duyệt');
        }
        await tx.moderationLog.create({
          data: {
            targetType: ModerationTargetType.NEWS,
            targetId,
            targetTitle: article.title,
            action: ApprovalStatus.APPROVED,
            moderatorId,
          },
        });
        return tx.newsArticle.findUniqueOrThrow({ where: { id: targetId } });
      });

      await this.notificationService
        .createPersonal({
          userId: article.authorId,
          actorId: moderatorId,
          type: NotificationType.CONTENT_APPROVED,
          title: 'Bài viết đã được duyệt!',
          content: `Bài viết "${article.title}" đã được xuất bản trên trang Tin tức.`,
          actionUrl: `/news/${article.slug}`,
          data: { newsId: article.id, slug: article.slug },
        })
        .catch(() => {});

      this.checkAndPromoteAuthorTrust(article.authorId).catch(() => {});
      return updated;
    }

    throw new BadRequestException('Loại nội dung không hợp lệ');
  }

  async rejectItem(
    moderatorId: string,
    targetType: ModerationTargetType,
    targetId: string,
    rawReason: string,
  ) {
    const reason = rawReason.trim();
    if (!reason) {
      throw new BadRequestException('Vui lòng nhập lý do từ chối');
    }

    if (targetType === ModerationTargetType.COMIC) {
      const comic = await this.prisma.comic.findUnique({
        where: { id: targetId },
        include: { genres: { select: { genreId: true } } },
      });
      if (!comic || comic.deletedAt) throw new NotFoundException('Không tìm thấy truyện');

      const updated = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.comic.updateMany({
          where: {
            id: targetId,
            deletedAt: null,
            approvalStatus: { in: [ApprovalStatus.PENDING_APPROVAL, ApprovalStatus.APPROVED] },
          },
          data: { approvalStatus: ApprovalStatus.REJECTED, rejectionReason: reason },
        });
        if (claimed.count === 0) {
          throw new BadRequestException('Truyện này không ở trạng thái có thể từ chối');
        }
        await tx.moderationLog.create({
          data: {
            targetType: ModerationTargetType.COMIC,
            targetId,
            targetTitle: comic.title,
            action: ApprovalStatus.REJECTED,
            reason,
            moderatorId,
          },
        });
        return tx.comic.findUniqueOrThrow({ where: { id: targetId } });
      });

      await this.genreService.recalculateCounts(comic.genres.map((g) => g.genreId)).catch(() => {});
      await this.notificationService
        .createPersonal({
          userId: comic.authorId,
          actorId: moderatorId,
          type: NotificationType.CONTENT_REJECTED,
          title: 'Truyện chưa đạt duyệt',
          content: `Truyện "${comic.title}" bị từ chối. Lý do: ${reason}`,
          actionUrl: `/studio/comics/${comic.id}`,
          data: { comicId: comic.id, reason },
        })
        .catch(() => {});

      await this.redis.del(`comic:${comic.slug}`);
      await this.redis.deletePattern('homepage*');
      await this.redis.deletePattern('rankings*');
      return updated;
    }

    if (targetType === ModerationTargetType.CHAPTER) {
      const chapter = await this.prisma.chapter.findUnique({
        where: { id: targetId },
        include: { comic: { select: { id: true, authorId: true, title: true, slug: true, deletedAt: true } } },
      });
      if (!chapter || chapter.deletedAt || chapter.comic.deletedAt) {
        throw new NotFoundException('Không tìm thấy chương');
      }

      const targetTitle = `Chương ${chapter.number} — ${chapter.comic.title}`;

      const updated = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.chapter.updateMany({
          where: {
            id: targetId,
            deletedAt: null,
            approvalStatus: { in: [ApprovalStatus.PENDING_APPROVAL, ApprovalStatus.APPROVED] },
          },
          data: { approvalStatus: ApprovalStatus.REJECTED, rejectionReason: reason },
        });
        if (claimed.count === 0) {
          throw new BadRequestException('Chương này không ở trạng thái có thể từ chối');
        }
        await tx.moderationLog.create({
          data: {
            targetType: ModerationTargetType.CHAPTER,
            targetId,
            targetTitle,
            action: ApprovalStatus.REJECTED,
            reason,
            moderatorId,
          },
        });
        return tx.chapter.findUniqueOrThrow({ where: { id: targetId } });
      });

      await this.syncComicOnChapterPublish(chapter.comicId);

      await this.notificationService
        .createPersonal({
          userId: chapter.comic.authorId,
          actorId: moderatorId,
          type: NotificationType.CONTENT_REJECTED,
          title: 'Chương truyện bị từ chối duyệt',
          content: `Chương ${chapter.number} của "${chapter.comic.title}": ${reason}`,
          actionUrl: `/studio/comics/${chapter.comicId}/chapters/${chapter.id}`,
          data: { comicId: chapter.comicId, chapterId: chapter.id, reason },
        })
        .catch(() => {});

      await this.redis.del(`comic:${chapter.comic.slug}`);
      await this.redis.deletePattern('homepage*');
      await this.redis.deletePattern('rankings*');
      return updated;
    }

    if (targetType === ModerationTargetType.NEWS) {
      const article = await this.prisma.newsArticle.findUnique({ where: { id: targetId } });
      if (!article || article.deletedAt) throw new NotFoundException('Không tìm thấy bài viết');

      const updated = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.newsArticle.updateMany({
          where: {
            id: targetId,
            deletedAt: null,
            approvalStatus: { in: [ApprovalStatus.PENDING_APPROVAL, ApprovalStatus.APPROVED] },
          },
          data: {
            approvalStatus: ApprovalStatus.REJECTED,
            rejectionReason: reason,
            isPublished: false,
          },
        });
        if (claimed.count === 0) {
          throw new BadRequestException('Bài viết này không ở trạng thái có thể từ chối');
        }
        await tx.moderationLog.create({
          data: {
            targetType: ModerationTargetType.NEWS,
            targetId,
            targetTitle: article.title,
            action: ApprovalStatus.REJECTED,
            reason,
            moderatorId,
          },
        });
        return tx.newsArticle.findUniqueOrThrow({ where: { id: targetId } });
      });

      await this.notificationService
        .createPersonal({
          userId: article.authorId,
          actorId: moderatorId,
          type: NotificationType.CONTENT_REJECTED,
          title: 'Bài viết bị từ chối duyệt',
          content: `Bài viết "${article.title}": ${reason}`,
          actionUrl: `/studio/news/${article.id}`,
          data: { newsId: article.id, reason },
        })
        .catch(() => {});

      return updated;
    }

    throw new BadRequestException('Loại nội dung không hợp lệ');
  }

  async getModerationLogs(query: ModerationLogsQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 50);
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
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      }),
      this.prisma.moderationLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
      },
    };
  }

  async setUserTrust(
    actorId: string,
    actorRole: UserRole,
    targetUserId: string,
    isTrusted: boolean,
    reason?: string,
  ) {
    if (actorId === targetUserId) {
      throw new ForbiddenException('Không thể tự thay đổi quyền Tác giả Uy tín của chính mình');
    }

    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user || user.deletedAt) throw new NotFoundException('Không tìm thấy người dùng');
    if (user.isBanned) throw new BadRequestException('Không thể thay đổi quyền của tài khoản đang bị khóa');

    if (
      actorRole !== UserRole.ADMIN &&
      ROLE_HIERARCHY[actorRole] <= ROLE_HIERARCHY[user.role]
    ) {
      throw new ForbiddenException(
        'Bạn không đủ quyền hạn để thay đổi chứng nhận của tài khoản ngang/cao quyền hơn',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        isTrusted,
        trustRevokedAt: isTrusted ? null : new Date(),
      },
      select: { id: true, username: true, displayName: true, isVerified: true, isTrusted: true },
    });

    await this.notificationService
      .createPersonal({
        userId: targetUserId,
        actorId,
        type: NotificationType.SYSTEM,
        title: isTrusted ? 'Bạn đã được cấp quyền Tác giả Uy tín' : 'Cập nhật quyền kiểm duyệt',
        content: isTrusted
          ? 'Các tác phẩm mới của bạn sẽ được tự động duyệt và xuất bản ngay.'
          : `Quyền Tác giả Uy tín đã bị thu hồi${reason ? `: ${reason}` : '.'}`,
        actionUrl: '/studio/comics',
      })
      .catch(() => {});

    return updated;
  }

  private async syncComicOnChapterPublish(comicId: string) {
    const approved = await this.prisma.chapter.findMany({
      where: { comicId, deletedAt: null, approvalStatus: ApprovalStatus.APPROVED },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    });
    await this.prisma.comic.update({
      where: { id: comicId },
      data: {
        totalChapters: approved.length,
        lastChapterAt: approved[0]?.publishedAt || null,
      },
    });
  }

  private async checkAndPromoteAuthorTrust(authorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { id: true, isTrusted: true, trustRevokedAt: true, isBanned: true, role: true },
    });
    if (!user || user.isTrusted || user.trustRevokedAt || user.isBanned) return;
    if (user.role === UserRole.READER) return;

    const [comics, chapters, news] = await Promise.all([
      this.prisma.comic.count({ where: { authorId, approvalStatus: ApprovalStatus.APPROVED, deletedAt: null } }),
      this.prisma.chapter.count({
        where: {
          comic: { authorId, deletedAt: null },
          approvalStatus: ApprovalStatus.APPROVED,
          deletedAt: null,
        },
      }),
      this.prisma.newsArticle.count({ where: { authorId, approvalStatus: ApprovalStatus.APPROVED, deletedAt: null } }),
    ]);

    if (comics + chapters + news >= 3) {
      await this.prisma.user.update({ where: { id: authorId }, data: { isTrusted: true } });
      await this.notificationService
        .createPersonal({
          userId: authorId,
          type: NotificationType.SYSTEM,
          title: 'Chứng nhận Tác giả Uy tín!',
          content: 'Bạn đã đạt mốc 3 nội dung được duyệt. Các tác phẩm tiếp theo sẽ tự động xuất bản.',
          actionUrl: '/studio/comics',
        })
        .catch(() => {});
      this.logger.log(`Auto-promoted author ${authorId} to Trusted Creator`);
    }
  }
}
