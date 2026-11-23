import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
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
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { ModerationService } from '../moderation/moderation.service';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationService } from '../notification/notification.service';
import { CreateChapterDto, UpdateChapterDto } from './dto/chapter.dto';

@Injectable()
export class ChapterService {
  private readonly logger = new Logger(ChapterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly moderationService: ModerationService,
    private readonly gamification: GamificationService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(comicId: string, userId: string, role: UserRole, dto: CreateChapterDto) {
    const comic = await this.prisma.comic.findUnique({ where: { id: comicId } });
    if (!comic || comic.deletedAt) throw new NotFoundException('Không tìm thấy truyện');
    if (comic.authorId !== userId && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Bạn không phải tác giả của truyện này');
    }

    const existing = await this.prisma.chapter.findFirst({
      where: { comicId, number: new Decimal(dto.number), deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`Chương ${dto.number} đã tồn tại`);
    }

    const isPremium = Boolean(dto.isPremium);
    const priceCoins = isPremium ? Math.max(1, dto.priceCoins ?? 10) : 0;

    const chapter = await this.prisma.chapter.create({
      data: {
        comicId,
        number: new Decimal(dto.number),
        title: dto.title?.trim() || null,
        isPremium,
        priceCoins,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        approvalStatus: ApprovalStatus.DRAFT,
      },
    });

    await this.redis.del(`comic:${comic.slug}`);
    return { ...chapter, number: Number(chapter.number) };
  }

  async findByComicPublic(comicId: string, userId?: string) {
    const comic = await this.prisma.comic.findFirst({
      where: {
        id: comicId,
        deletedAt: null,
        approvalStatus: ApprovalStatus.APPROVED,
        status: { not: ComicStatus.DRAFT },
      },
      select: { id: true, authorId: true },
    });
    if (!comic) {
      throw new NotFoundException('Không tìm thấy truyện');
    }

    const now = new Date();
    const chapters = await this.prisma.chapter.findMany({
      where: {
        comicId,
        deletedAt: null,
        approvalStatus: ApprovalStatus.APPROVED,
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
      },
      orderBy: { number: 'asc' },
      select: {
        id: true,
        comicId: true,
        number: true,
        title: true,
        totalPages: true,
        isPremium: true,
        priceCoins: true,
        views: true,
        approvalStatus: true,
        scheduledAt: true,
        publishedAt: true,
        createdAt: true,
      },
    });

    let unlockedIds = new Set<string>();
    let readIds = new Set<string>();

    if (userId) {
      const [unlocks, history] = await Promise.all([
        this.prisma.chapterUnlock.findMany({
          where: { userId, chapter: { comicId } },
          select: { chapterId: true },
        }),
        this.prisma.readingHistory.findMany({
          where: { userId, comicId },
          select: { chapterId: true },
        }),
      ]);
      unlockedIds = new Set(unlocks.map((u) => u.chapterId));
      readIds = new Set(history.map((h) => h.chapterId));
    }

    return chapters.map((ch) => ({
      ...ch,
      number: Number(ch.number),
      isUnlocked: !ch.isPremium || ch.priceCoins === 0 || (!!userId && (unlockedIds.has(ch.id) || comic.authorId === userId)),
      isRead: readIds.has(ch.id),
    }));
  }

  async findByComicForStudio(comicId: string, userId: string, role: UserRole) {
    const comic = await this.prisma.comic.findUnique({ where: { id: comicId } });
    if (!comic || comic.deletedAt) throw new NotFoundException('Không tìm thấy truyện');
    if (comic.authorId !== userId && role !== UserRole.ADMIN && role !== UserRole.MODERATOR) {
      throw new ForbiddenException('Bạn không có quyền truy cập');
    }

    const chapters = await this.prisma.chapter.findMany({
      where: { comicId, deletedAt: null },
      orderBy: { number: 'desc' },
    });

    return chapters.map((ch) => ({ ...ch, number: Number(ch.number) }));
  }

  async findOneForStudio(chapterId: string, userId: string, role: UserRole) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        comic: {
          select: {
            id: true,
            title: true,
            slug: true,
            coverUrl: true,
            type: true,
            status: true,
            authorId: true,
            approvalStatus: true,
            deletedAt: true,
            author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
        pages: {
          orderBy: { pageNumber: 'asc' },
          select: {
            id: true,
            pageNumber: true,
            imageUrl: true,
            thumbnailUrl: true,
            width: true,
            height: true,
            fileSize: true,
          },
        },
      },
    });

    if (!chapter || chapter.deletedAt || chapter.comic.deletedAt) {
      throw new NotFoundException('Không tìm thấy chương truyện');
    }

    if (
      chapter.comic.authorId !== userId &&
      role !== UserRole.ADMIN &&
      role !== UserRole.MODERATOR
    ) {
      throw new ForbiddenException('Bạn không có quyền truy cập chương này');
    }

    const navigation = await this.getNavigation(
      chapter.comicId,
      chapter.number,
      true,
      userId,
      chapter.comic.authorId,
    );

    return {
      ...chapter,
      number: Number(chapter.number),
      isLocked: false,
      navigation,
    };
  }

  async findOne(chapterId: string, userId?: string, viewerIp?: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        comic: {
          select: {
            id: true,
            title: true,
            slug: true,
            coverUrl: true,
            type: true,
            status: true,
            authorId: true,
            approvalStatus: true,
            deletedAt: true,
            author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
        pages: {
          orderBy: { pageNumber: 'asc' },
          select: {
            id: true,
            pageNumber: true,
            imageUrl: true,
            thumbnailUrl: true,
            width: true,
            height: true,
            fileSize: true,
          },
        },
      },
    });

    if (!chapter || chapter.deletedAt || chapter.comic.deletedAt) {
      throw new NotFoundException('Không tìm thấy chương truyện');
    }

    const isAuthor = !!userId && chapter.comic.authorId === userId;
    let isPrivileged = isAuthor;
    if (userId && !isAuthor) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (user && (user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR)) {
        isPrivileged = true;
      }
    }

    const now = new Date();
    const isScheduledFuture = Boolean(chapter.scheduledAt && chapter.scheduledAt > now);
    const isPubliclyVisible =
      chapter.approvalStatus === ApprovalStatus.APPROVED &&
      chapter.comic.approvalStatus === ApprovalStatus.APPROVED &&
      chapter.comic.status !== ComicStatus.DRAFT &&
      !isScheduledFuture;

    if (!isPrivileged && !isPubliclyVisible) {
      throw new NotFoundException('Chương truyện chưa được xuất bản');
    }

    const canBypassPaywall =
      isAuthor || (isPrivileged && chapter.approvalStatus !== ApprovalStatus.APPROVED);

    let isLocked = false;
    if (chapter.isPremium && chapter.priceCoins > 0 && !canBypassPaywall) {
      if (!userId) {
        isLocked = true;
      } else {
        const unlock = await this.prisma.chapterUnlock.findUnique({
          where: { userId_chapterId: { userId, chapterId: chapter.id } },
        });
        isLocked = !unlock;
      }
    }

    const navigation = await this.getNavigation(
      chapter.comicId,
      chapter.number,
      isPrivileged,
      userId,
      chapter.comic.authorId,
    );

    // Throttled view counter (15-min window per viewer, published unlocked chapters only)
    if (!isLocked && isPubliclyVisible) {
      const viewerKey = userId || viewerIp || 'anon';
      const throttleKey = `view:chapter:${chapterId}:${viewerKey}`;
      const alreadyCounted = await this.redis.exists(throttleKey);
      if (!alreadyCounted) {
        await this.redis.set(throttleKey, '1', 900);
        Promise.all([
          this.prisma.chapter.update({ where: { id: chapterId }, data: { views: { increment: 1 } } }),
          this.prisma.comic.update({
            where: { id: chapter.comicId },
            data: {
              totalViews: { increment: 1 },
              dailyViews: { increment: 1 },
              weeklyViews: { increment: 1 },
              monthlyViews: { increment: 1 },
            },
          }),
        ]).catch(() => {});
      }
    }

    return {
      id: chapter.id,
      comicId: chapter.comicId,
      number: Number(chapter.number),
      title: chapter.title,
      totalPages: chapter.totalPages,
      isPremium: chapter.isPremium,
      priceCoins: chapter.priceCoins,
      views: chapter.views,
      approvalStatus: chapter.approvalStatus,
      publishedAt: chapter.publishedAt,
      isLocked,
      comic: chapter.comic,
      pages: isLocked ? [] : chapter.pages,
      navigation,
    };
  }

  private async getNavigation(
    comicId: string,
    currentNumber: Decimal,
    includeDrafts = false,
    userId?: string,
    comicAuthorId?: string,
  ) {
    const now = new Date();
    const baseFilter: Prisma.ChapterWhereInput = {
      comicId,
      deletedAt: null,
      ...(!includeDrafts && {
        approvalStatus: ApprovalStatus.APPROVED,
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
      }),
    };

    const navSelect = {
      id: true,
      number: true,
      title: true,
      isPremium: true,
      priceCoins: true,
      approvalStatus: true,
    };

    const [prev, next] = await Promise.all([
      this.prisma.chapter.findFirst({
        where: { ...baseFilter, number: { lt: currentNumber } },
        orderBy: { number: 'desc' },
        select: navSelect,
      }),
      this.prisma.chapter.findFirst({
        where: { ...baseFilter, number: { gt: currentNumber } },
        orderBy: { number: 'asc' },
        select: navSelect,
      }),
    ]);

    const premiumTargetIds = [prev, next]
      .filter((c): c is NonNullable<typeof prev> => Boolean(c && c.isPremium && c.priceCoins > 0))
      .map((c) => c.id);

    let unlockedSet = new Set<string>();
    if (userId && premiumTargetIds.length > 0) {
      const unlocks = await this.prisma.chapterUnlock.findMany({
        where: { userId, chapterId: { in: premiumTargetIds } },
        select: { chapterId: true },
      });
      unlockedSet = new Set(unlocks.map((u) => u.chapterId));
    }

    const formatNav = (ch: typeof prev) => {
      if (!ch) return null;
      const isUnlocked =
        !ch.isPremium ||
        ch.priceCoins === 0 ||
        (!!userId && comicAuthorId === userId) ||
        (includeDrafts && ch.approvalStatus !== ApprovalStatus.APPROVED) ||
        unlockedSet.has(ch.id);

      return {
        id: ch.id,
        number: Number(ch.number),
        title: ch.title,
        isPremium: ch.isPremium,
        priceCoins: ch.priceCoins,
        isUnlocked,
      };
    };

    return {
      prev: formatNav(prev),
      next: formatNav(next),
    };
  }

  async getUserPurchases(userId: string, page = 1, limit = 20, search?: string) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safeLimit = Math.min(Math.max(1, Math.floor(Number(limit) || 20)), 50);
    const skip = (safePage - 1) * safeLimit;

    const trimmed = search?.trim();
    const parsedNum = trimmed ? Number(trimmed) : NaN;
    const numericSearch =
      trimmed && Number.isFinite(parsedNum) && parsedNum >= 0 && parsedNum <= 99999999.99
        ? parsedNum
        : null;

    const where: Prisma.ChapterUnlockWhereInput = {
      userId,
      ...(trimmed && {
        chapter: {
          OR: [
            { title: { contains: trimmed, mode: 'insensitive' } },
            { comic: { title: { contains: trimmed, mode: 'insensitive' } } },
            ...(numericSearch !== null ? [{ number: new Decimal(numericSearch) }] : []),
          ],
        },
      }),
    };

    const [rows, total, user, agg, distinctComicRows] = await Promise.all([
      this.prisma.chapterUnlock.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
        include: {
          chapter: {
            select: {
              id: true,
              number: true,
              title: true,
              totalPages: true,
              priceCoins: true,
              comic: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  coverUrl: true,
                  author: {
                    select: { id: true, username: true, displayName: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.chapterUnlock.count({ where }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { coins: true },
      }),
      this.prisma.chapterUnlock.aggregate({
        where: { userId },
        _count: { _all: true },
        _sum: { coinsSpent: true },
      }),
      this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(DISTINCT c.comic_id)::int AS count
        FROM chapter_unlocks u
        JOIN chapters c ON c.id = u.chapter_id
        WHERE u.user_id = ${userId}::uuid
      `,
    ]);

    const uniqueComicsCount = Number(distinctComicRows?.[0]?.count ?? 0);

    return {
      items: rows.map((r) => ({
        id: r.id,
        chapterId: r.chapterId,
        coinsSpent: r.coinsSpent,
        createdAt: r.createdAt,
        chapter: {
          ...r.chapter,
          number: Number(r.chapter.number),
        },
      })),
      summary: {
        currentCoins: user?.coins ?? 0,
        totalUnlockedChapters: agg._count._all,
        totalCoinsSpent: agg._sum.coinsSpent ?? 0,
        uniqueComicsCount,
      },
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
        hasNext: skip + safeLimit < total,
      },
    };
  }

  async unlockChapter(chapterId: string, userId: string) {
    const chapterMeta = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true,
        deletedAt: true,
        approvalStatus: true,
        scheduledAt: true,
        isPremium: true,
        priceCoins: true,
        comic: {
          select: {
            id: true,
            authorId: true,
            deletedAt: true,
            approvalStatus: true,
            status: true,
          },
        },
      },
    });
    if (!chapterMeta || chapterMeta.deletedAt || chapterMeta.comic.deletedAt) {
      throw new NotFoundException('Không tìm thấy chương truyện');
    }
    const now = new Date();
    if (
      chapterMeta.comic.status === ComicStatus.DRAFT ||
      chapterMeta.approvalStatus !== ApprovalStatus.APPROVED ||
      chapterMeta.comic.approvalStatus !== ApprovalStatus.APPROVED ||
      (chapterMeta.scheduledAt && chapterMeta.scheduledAt > now)
    ) {
      throw new NotFoundException('Chương truyện chưa được xuất bản');
    }

    if (!chapterMeta.isPremium || chapterMeta.priceCoins <= 0 || chapterMeta.comic.authorId === userId) {
      return { unlocked: true, coinsSpent: 0 };
    }

    const txResult = await this.prisma.$transaction(async (tx) => {
      const lockIds = Array.from(new Set([userId, chapterMeta.comic.authorId])).sort();
      for (const uid of lockIds) {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${uid}::uuid FOR UPDATE`;
      }

      const chapter = await tx.chapter.findUnique({
        where: { id: chapterId },
        include: {
          comic: {
            select: {
              id: true,
              title: true,
              slug: true,
              authorId: true,
              deletedAt: true,
              approvalStatus: true,
              status: true,
            },
          },
        },
      });
      if (!chapter || chapter.deletedAt || chapter.comic.deletedAt) {
        throw new NotFoundException('Không tìm thấy chương truyện');
      }
      const txNow = new Date();
      if (
        chapter.comic.status === ComicStatus.DRAFT ||
        chapter.approvalStatus !== ApprovalStatus.APPROVED ||
        chapter.comic.approvalStatus !== ApprovalStatus.APPROVED ||
        (chapter.scheduledAt && chapter.scheduledAt > txNow)
      ) {
        throw new NotFoundException('Chương truyện chưa được xuất bản');
      }

      if (!chapter.isPremium || chapter.priceCoins <= 0 || chapter.comic.authorId === userId) {
        return { unlocked: true, coinsSpent: 0, authorShare: 0, notifyAuthor: false as const };
      }

      const existing = await tx.chapterUnlock.findUnique({
        where: { userId_chapterId: { userId, chapterId } },
      });
      if (existing) {
        return {
          unlocked: true,
          coinsSpent: 0,
          alreadyUnlocked: true,
          authorShare: 0,
          notifyAuthor: false as const,
        };
      }

      const revPercent = Math.min(
        100,
        Math.max(0, this.gamification.getConfigValue('author_revenue_percent', 70)),
      );
      const authorShare = Math.floor((chapter.priceCoins * revPercent) / 100);

      const remainingCoins = await this.gamification.spendCoins(
        tx,
        userId,
        chapter.priceCoins,
        'unlock_chapter',
        chapterId,
        `Mở khóa Chương ${chapter.number} — ${chapter.comic.title}`,
      );

      await tx.chapterUnlock.create({
        data: {
          userId,
          chapterId,
          coinsSpent: chapter.priceCoins,
        },
      });

      if (authorShare > 0 && chapter.comic.authorId !== userId) {
        const authorUpdated = await tx.user.update({
          where: { id: chapter.comic.authorId },
          data: { coins: { increment: authorShare } },
          select: { coins: true },
        });
        await tx.rewardTransaction.create({
          data: {
            userId: chapter.comic.authorId,
            currency: 'COIN',
            amount: authorShare,
            source: 'author_revenue',
            sourceId: chapterId,
            balanceAfter: authorUpdated.coins,
            note: `Doanh thu mở khóa Chương ${chapter.number} (${chapter.comic.title})`,
          },
        });
      }

      return {
        unlocked: true,
        coinsSpent: chapter.priceCoins,
        remainingCoins,
        authorShare,
        notifyAuthor: authorShare > 0 && chapter.comic.authorId !== userId,
        authorId: chapter.comic.authorId,
        chapterNumber: Number(chapter.number),
        comicTitle: chapter.comic.title,
      };
    });

    if (txResult.notifyAuthor && txResult.authorId) {
      this.notificationService
        .createPersonal({
          userId: txResult.authorId,
          actorId: userId,
          type: NotificationType.CHAPTER_UNLOCKED,
          title: `Độc giả vừa mở khóa Chương ${txResult.chapterNumber}!`,
          content: `Bạn nhận được +${txResult.authorShare} Xu doanh thu tác giả từ "${txResult.comicTitle}".`,
          actionUrl: '/studio',
        })
        .catch(() => {});
    }

    return {
      unlocked: txResult.unlocked,
      coinsSpent: txResult.coinsSpent,
      ...(txResult.alreadyUnlocked ? { alreadyUnlocked: true } : {}),
      ...(txResult.remainingCoins !== undefined ? { remainingCoins: txResult.remainingCoins } : {}),
    };
  }

  async update(chapterId: string, userId: string, role: UserRole, dto: UpdateChapterDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { comic: { select: { authorId: true, slug: true, deletedAt: true } } },
    });
    if (!chapter || chapter.deletedAt || chapter.comic.deletedAt) {
      throw new NotFoundException('Không tìm thấy chương');
    }
    if (chapter.comic.authorId !== userId && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa chương này');
    }

    if (dto.number !== undefined && Number(chapter.number) !== dto.number) {
      const dup = await this.prisma.chapter.findFirst({
        where: { comicId: chapter.comicId, number: new Decimal(dto.number), deletedAt: null, id: { not: chapterId } },
      });
      if (dup) throw new ConflictException(`Chương ${dto.number} đã tồn tại`);
    }

    const isPremium = dto.isPremium !== undefined ? dto.isPremium : chapter.isPremium;
    const rawPrice = dto.priceCoins ?? (isPremium ? chapter.priceCoins || 10 : 0);
    const priceCoins = isPremium ? Math.max(1, rawPrice) : 0;

    if (role !== UserRole.ADMIN) {
      const unlockCount = await this.prisma.chapterUnlock.count({ where: { chapterId } });
      if (unlockCount > 0) {
        if ((!chapter.isPremium || chapter.priceCoins === 0) && isPremium) {
          throw new ForbiddenException('Không thể bật thu phí cho chương đã có độc giả mở khóa');
        }
        if (priceCoins > chapter.priceCoins) {
          throw new ForbiddenException('Không thể tăng giá Xu cho chương đã có độc giả mở khóa');
        }
      }
    }

    const updated = await this.prisma.chapter.update({
      where: { id: chapterId },
      data: {
        ...(dto.number !== undefined && { number: new Decimal(dto.number) }),
        ...(dto.title !== undefined && { title: dto.title.trim() || null }),
        isPremium,
        priceCoins,
        ...(dto.scheduledAt !== undefined && { scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null }),
      },
    });

    await this.redis.del(`comic:${chapter.comic.slug}`);
    return { ...updated, number: Number(updated.number) };
  }

  async publish(chapterId: string, userId: string) {
    return this.moderationService.submitForReview(userId, ModerationTargetType.CHAPTER, chapterId);
  }

  async remove(chapterId: string, userId: string, role: UserRole) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { comic: { select: { authorId: true, slug: true, deletedAt: true } } },
    });
    if (!chapter || chapter.deletedAt || chapter.comic.deletedAt) {
      throw new NotFoundException('Không tìm thấy chương');
    }
    if (chapter.comic.authorId !== userId && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Bạn không có quyền xóa chương này');
    }

    await this.prisma.chapter.update({
      where: { id: chapterId },
      data: { deletedAt: new Date() },
    });

    const [approvedCount, latestApproved] = await Promise.all([
      this.prisma.chapter.count({
        where: { comicId: chapter.comicId, deletedAt: null, approvalStatus: ApprovalStatus.APPROVED },
      }),
      this.prisma.chapter.findFirst({
        where: { comicId: chapter.comicId, deletedAt: null, approvalStatus: ApprovalStatus.APPROVED },
        orderBy: [{ publishedAt: 'desc' }, { number: 'desc' }],
        select: { publishedAt: true, createdAt: true },
      }),
    ]);

    await this.prisma.comic.update({
      where: { id: chapter.comicId },
      data: {
        totalChapters: approvedCount,
        lastChapterAt: latestApproved ? (latestApproved.publishedAt ?? latestApproved.createdAt) : null,
      },
    });

    await Promise.all([
      this.redis.del(`comic:${chapter.comic.slug}`),
      this.redis.deletePattern('homepage*'),
      this.redis.deletePattern('rankings*'),
    ]);
    return { deleted: true };
  }

  async reorderPages(
    chapterId: string,
    userId: string,
    role: UserRole,
    orders: { pageId: string; newOrder: number }[],
  ) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { comic: { select: { authorId: true, slug: true, deletedAt: true } } },
    });
    if (!chapter || chapter.deletedAt || chapter.comic.deletedAt) {
      throw new NotFoundException('Không tìm thấy chương');
    }
    if (chapter.comic.authorId !== userId && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Bạn không có quyền sắp xếp lại trang');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM chapters WHERE id = ${chapterId}::uuid FOR UPDATE`;

      const actualPages = await tx.page.findMany({
        where: { chapterId },
        select: { id: true },
      });
      const actualIds = new Set(actualPages.map((p) => p.id));
      const uniqueInputIds = new Set(orders.map((o) => o.pageId));

      if (
        orders.length !== actualPages.length ||
        uniqueInputIds.size !== orders.length ||
        orders.some((o) => !actualIds.has(o.pageId))
      ) {
        throw new BadRequestException('Danh sách trang không hợp lệ');
      }

      const sortedNewOrders = orders.map((o) => o.newOrder).sort((a, b) => a - b);
      if (!sortedNewOrders.every((val, idx) => val === idx + 1)) {
        throw new BadRequestException('Thứ tự trang phải liên tục từ 1 đến tổng số trang');
      }

      for (let i = 0; i < orders.length; i++) {
        await tx.page.update({
          where: { id: orders[i].pageId },
          data: { pageNumber: -(i + 1) },
        });
      }
      for (const order of orders) {
        await tx.page.update({
          where: { id: order.pageId },
          data: { pageNumber: order.newOrder },
        });
      }
    });

    await this.redis.del(`comic:${chapter.comic.slug}`);
    return { reordered: true };
  }

  async removePage(chapterId: string, pageId: string, userId: string, role: UserRole) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { comic: { select: { authorId: true, slug: true, deletedAt: true } } },
    });
    if (!chapter || chapter.deletedAt || chapter.comic.deletedAt) {
      throw new NotFoundException('Không tìm thấy chương');
    }
    if (chapter.comic.authorId !== userId && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Bạn không có quyền xóa trang');
    }

    if (role !== UserRole.ADMIN) {
      const unlockCount = await this.prisma.chapterUnlock.count({ where: { chapterId } });
      if (unlockCount > 0) {
        throw new ForbiddenException('Không thể xóa trang của chương đã có độc giả mở khóa');
      }
    }

    const deletedResult = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM chapters WHERE id = ${chapterId}::uuid FOR UPDATE`;

      const page = await tx.page.findUnique({ where: { id: pageId } });
      if (!page || page.chapterId !== chapterId) {
        throw new NotFoundException('Không tìm thấy trang');
      }

      await tx.page.delete({ where: { id: pageId } });

      const remaining = await tx.page.findMany({
        where: { chapterId },
        orderBy: { pageNumber: 'asc' },
        select: { id: true, pageNumber: true },
      });

      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].pageNumber !== i + 1) {
          await tx.page.update({
            where: { id: remaining[i].id },
            data: { pageNumber: i + 1 },
          });
        }
      }

      await tx.chapter.update({
        where: { id: chapterId },
        data: { totalPages: remaining.length },
      });

      return {
        imageUrl: page.imageUrl,
        thumbnailUrl: page.thumbnailUrl,
        totalPages: remaining.length,
      };
    });

    await Promise.allSettled([
      this.storage.deleteByUrl(deletedResult.imageUrl),
      this.storage.deleteByUrl(deletedResult.thumbnailUrl),
    ]);
    await this.redis.del(`comic:${chapter.comic.slug}`);
    return { deleted: true, totalPages: deletedResult.totalPages };
  }
}
