import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import {
  ApprovalStatus,
  ComicStatus,
  ComicType,
  ContentRating,
  ModerationTargetType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { getCultivationInfo, normalizeSearchText } from 'shared';
import slugify from 'slugify';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ModerationService } from '../moderation/moderation.service';
import { GenreService } from '../genre/genre.service';
import {
  ComicQueryDto,
  CreateComicDto,
  RankingsQueryDto,
  RecommendationQueryDto,
  UpdateComicDto,
} from './dto/comic.dto';

const RESERVED_COMIC_SLUGS = new Set([
  'create',
  'new',
  'search',
  'rankings',
  'popular',
  'latest',
  'manage',
  'edit',
  'admin',
  'studio',
]);

@Injectable()
export class ComicService {
  private readonly logger = new Logger(ComicService.name);

  private readonly baseInclude = {
    author: {
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        level: true,
        isVerified: true,
        isTrusted: true,
      },
    },
    genres: { include: { genre: true } },
    chapters: {
      where: { deletedAt: null, approvalStatus: ApprovalStatus.APPROVED },
      orderBy: { number: 'desc' as const },
      take: 2,
      select: {
        id: true,
        number: true,
        title: true,
        isPremium: true,
        priceCoins: true,
        publishedAt: true,
      },
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly moderationService: ModerationService,
    private readonly genreService: GenreService,
  ) {}

  private buildSearchText(parts: Array<string | string[] | null | undefined>): string {
    const raw = parts
      .flatMap((p) => (Array.isArray(p) ? p : p ? [p] : []))
      .join(' ');
    return normalizeSearchText(raw);
  }

  async create(authorId: string, dto: CreateComicDto) {
    const slug = await this.generateUniqueSlug(dto.title);
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { displayName: true },
    });

    const searchText = this.buildSearchText([
      dto.title,
      dto.alternativeTitles,
      dto.tags,
      dto.artistName,
      dto.originalAuthor,
      author?.displayName,
    ]);

    const comic = await this.prisma.comic.create({
      data: {
        authorId,
        title: dto.title.trim(),
        slug,
        alternativeTitles: dto.alternativeTitles || [],
        searchText,
        description: dto.description,
        artistName: dto.artistName,
        originalAuthor: dto.originalAuthor,
        type: dto.type || ComicType.VIETNAM,
        contentRating: dto.contentRating || ContentRating.EVERYONE,
        originalLanguage: dto.originalLanguage || 'vi',
        releaseYear: dto.releaseYear,
        tags: dto.tags || [],
        status: ComicStatus.DRAFT,
        approvalStatus: ApprovalStatus.DRAFT,
        ...(dto.genreIds?.length && {
          genres: {
            create: dto.genreIds.map((genreId) => ({ genreId })),
          },
        }),
      },
      include: this.baseInclude,
    });

    this.logger.log(`Comic created: ${comic.title} by ${authorId}`);
    return this.formatComic(comic, true);
  }

  async findAll(query: ComicQueryDto) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(Math.max(1, Math.floor(Number(query.limit) || 20)), 50);
    const skip = (page - 1) * limit;

    if (query.status === ComicStatus.DRAFT) {
      return {
        data: [],
        meta: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
        },
      };
    }

    const where: Prisma.ComicWhereInput = {
      deletedAt: null,
      approvalStatus: ApprovalStatus.APPROVED,
      status: query.status || { not: ComicStatus.DRAFT },
    };

    if (query.type) where.type = query.type;
    if (query.contentRating) where.contentRating = query.contentRating;

    const includeSlugs = [
      ...(query.genre ? [query.genre.trim()] : []),
      ...(query.genres ? query.genres.split(',').map((s) => s.trim()).filter(Boolean) : []),
    ]
      .filter(Boolean)
      .slice(0, 10);
    const excludeSlugs = query.excludeGenres
      ? query.excludeGenres.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10)
      : [];

    const andConditions: Prisma.ComicWhereInput[] = [];
    for (const slug of includeSlugs) {
      andConditions.push({ genres: { some: { genre: { slug } } } });
    }
    if (excludeSlugs.length > 0) {
      andConditions.push({ genres: { none: { genre: { slug: { in: excludeSlugs } } } } });
    }

    if (query.search && query.search.trim().length > 0) {
      const normalized = normalizeSearchText(query.search);
      const tokens = normalized.split(' ').filter(Boolean).slice(0, 8);
      for (const token of tokens) {
        andConditions.push({ searchText: { contains: token, mode: 'insensitive' } });
      }
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    let orderBy: Prisma.ComicOrderByWithRelationInput | Prisma.ComicOrderByWithRelationInput[] = [
      { lastChapterAt: { sort: 'desc', nulls: 'last' } },
      { updatedAt: 'desc' },
    ];
    switch (query.sort) {
      case 'popular':
        orderBy = [{ totalViews: 'desc' }, { avgRating: 'desc' }];
        break;
      case 'weekly':
        orderBy = [{ weeklyViews: 'desc' }, { totalViews: 'desc' }];
        break;
      case 'monthly':
        orderBy = [{ monthlyViews: 'desc' }, { totalViews: 'desc' }];
        break;
      case 'rating':
        orderBy = [{ avgRating: 'desc' }, { totalRatings: 'desc' }];
        break;
      case 'newest':
        orderBy = [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }];
        break;
      case 'bookmarks':
        orderBy = [{ totalBookmarks: 'desc' }, { totalViews: 'desc' }];
        break;
      default:
        orderBy = [{ lastChapterAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }];
    }

    const [comics, total] = await Promise.all([
      this.prisma.comic.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: this.baseInclude,
      }),
      this.prisma.comic.count({ where }),
    ]);

    return {
      data: comics.map((c) => this.formatComic(c)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
      },
    };
  }

  async getHomepageSections(takeParam = 12) {
    const take = Math.max(4, Math.min(Number(takeParam) || 12, 30));
    const cacheKey = `homepage:v2:${take}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const baseWhere: Prisma.ComicWhereInput = {
      deletedAt: null,
      approvalStatus: ApprovalStatus.APPROVED,
      status: { not: ComicStatus.DRAFT },
    };

    const [featuredRaw, trendingRaw, latestRaw, topRatedRaw] = await Promise.all([
      this.prisma.comic.findMany({
        where: { ...baseWhere, isFeatured: true },
        orderBy: [{ totalViews: 'desc' }],
        take: 5,
        include: this.baseInclude,
      }),
      this.prisma.comic.findMany({
        where: baseWhere,
        orderBy: [{ weeklyViews: 'desc' }, { totalViews: 'desc' }],
        take,
        include: this.baseInclude,
      }),
      this.prisma.comic.findMany({
        where: baseWhere,
        orderBy: [{ lastChapterAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
        take,
        include: this.baseInclude,
      }),
      this.prisma.comic.findMany({
        where: { ...baseWhere, totalRatings: { gte: 1 } },
        orderBy: [{ avgRating: 'desc' }, { totalRatings: 'desc' }],
        take: 8,
        include: this.baseInclude,
      }),
    ]);

    const featured =
      featuredRaw.length >= 3
        ? featuredRaw
        : trendingRaw.slice(0, 5);

    const result = {
      featured: featured.map((c) => this.formatComic(c)),
      trending: trendingRaw.map((c) => this.formatComic(c)),
      latest: latestRaw.map((c) => this.formatComic(c)),
      topRated: topRatedRaw.map((c) => this.formatComic(c)),
    };

    await this.redis.set(cacheKey, result, 180);
    return result;
  }

  async getRankings(query: RankingsQueryDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 5), 50);
    const cacheKey = `rankings:${query.period || 'week'}:${query.metric || 'views'}:${query.type || 'all'}:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const where: Prisma.ComicWhereInput = {
      deletedAt: null,
      approvalStatus: ApprovalStatus.APPROVED,
      status: { not: ComicStatus.DRAFT },
      ...(query.type && { type: query.type }),
    };

    let orderBy: Prisma.ComicOrderByWithRelationInput[];
    if (query.metric === 'rating') {
      orderBy = [{ avgRating: 'desc' }, { totalRatings: 'desc' }, { totalViews: 'desc' }];
    } else if (query.metric === 'bookmarks') {
      orderBy = [{ totalBookmarks: 'desc' }, { totalViews: 'desc' }];
    } else if (query.metric === 'newest') {
      orderBy = [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { totalViews: 'desc' }];
    } else {
      if (query.period === 'day') orderBy = [{ dailyViews: 'desc' }, { totalViews: 'desc' }];
      else if (query.period === 'week') orderBy = [{ weeklyViews: 'desc' }, { totalViews: 'desc' }];
      else if (query.period === 'month') orderBy = [{ monthlyViews: 'desc' }, { totalViews: 'desc' }];
      else orderBy = [{ totalViews: 'desc' }];
    }

    const comics = await this.prisma.comic.findMany({
      where,
      orderBy,
      take: limit,
      include: this.baseInclude,
    });

    const formatted = comics.map((c, index) => ({
      rank: index + 1,
      ...this.formatComic(c),
    }));

    await this.redis.set(cacheKey, formatted, 180);
    return formatted;
  }

  async search(query: string, page = 1) {
    if (!query || query.trim().length < 1) {
      return {
        data: [],
        meta: { page, limit: 20, total: 0, totalPages: 0, hasNext: false },
      };
    }
    return this.findAll({ search: query, page, limit: 20, sort: 'popular' });
  }

  async findBySlug(slug: string, userId?: string) {
    const cacheKey = `comic:${slug}`;
    let baseComic = await this.redis.get<any>(cacheKey);
    const now = new Date();

    if (!baseComic) {
      const comic = await this.prisma.comic.findUnique({
        where: { slug },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              level: true,
              isVerified: true,
              isTrusted: true,
            },
          },
          genres: { include: { genre: true } },
          chapters: {
            where: {
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
          },
        },
      });

      if (
        !comic ||
        comic.deletedAt ||
        comic.approvalStatus !== ApprovalStatus.APPROVED ||
        comic.status === ComicStatus.DRAFT
      ) {
        throw new NotFoundException('Không tìm thấy bộ truyện này');
      }

      const ratingGroups = await this.prisma.rating.groupBy({
        by: ['score'],
        where: { comicId: comic.id },
        _count: { score: true },
      });

      const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const g of ratingGroups) {
        if (g.score >= 1 && g.score <= 5) {
          ratingBreakdown[g.score as 1 | 2 | 3 | 4 | 5] = g._count.score;
        }
      }

      baseComic = {
        ...this.formatComic(comic),
        artistName: comic.artistName,
        originalAuthor: comic.originalAuthor,
        chapters: comic.chapters.map((ch) => ({
          ...ch,
          number: Number(ch.number),
        })),
        ratingBreakdown,
      };

      await this.redis.set(cacheKey, baseComic, 240);
    }

    const visibleChapters = (baseComic.chapters || []).filter(
      (ch: any) => !ch.scheduledAt || new Date(ch.scheduledAt) <= now,
    );
    const normalizedBase = { ...baseComic, chapters: visibleChapters };

    if (!userId) {
      return normalizedBase;
    }

    const [bookmark, unlocks, historyRows, myRating, follow] = await Promise.all([
      this.prisma.bookmark.findUnique({
        where: { userId_comicId: { userId, comicId: baseComic.id } },
      }),
      this.prisma.chapterUnlock.findMany({
        where: { userId, chapter: { comicId: baseComic.id } },
        select: { chapterId: true },
      }),
      this.prisma.readingHistory.findMany({
        where: { userId, comicId: baseComic.id },
        orderBy: { readAt: 'desc' },
        select: { chapterId: true, lastPage: true },
      }),
      this.prisma.rating.findUnique({
        where: { userId_comicId: { userId, comicId: baseComic.id } },
        select: { id: true, score: true, review: true },
      }),
      this.prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: userId, followingId: baseComic.author.id } },
      }),
    ]);

    const unlockedChapterIds = unlocks.map((u) => u.chapterId);
    const readChapterIds = historyRows.map((h) => h.chapterId);
    const latestHistory = historyRows[0];

    return {
      ...normalizedBase,
      chapters: normalizedBase.chapters.map((ch: any) => ({
        ...ch,
        isUnlocked:
          !ch.isPremium ||
          ch.priceCoins === 0 ||
          unlockedChapterIds.includes(ch.id) ||
          normalizedBase.author.id === userId,
        isRead: readChapterIds.includes(ch.id),
      })),
      userState: {
        isBookmarked: !!bookmark,
        readingStatus: bookmark?.status || null,
        isFavorite: bookmark?.isFavorite || false,
        notifyUpdate: bookmark?.notifyUpdate ?? true,
        lastChapterId: bookmark?.lastChapterId || latestHistory?.chapterId || null,
        lastPage: bookmark?.lastPage || latestHistory?.lastPage || null,
        unlockedChapterIds,
        readChapterIds,
        myRating: myRating || null,
        isFollowingAuthor: !!follow,
      },
    };
  }

  async findByIdForStudio(comicId: string, userId: string, role: UserRole) {
    const comic = await this.prisma.comic.findUnique({
      where: { id: comicId },
      include: {
        ...this.baseInclude,
        chapters: {
          where: { deletedAt: null },
          orderBy: { number: 'desc' },
        },
      },
    });
    if (!comic || comic.deletedAt) throw new NotFoundException('Không tìm thấy truyện');
    if (comic.authorId !== userId && role !== UserRole.ADMIN && role !== UserRole.MODERATOR) {
      throw new ForbiddenException('Bạn không có quyền truy cập truyện này');
    }

    return {
      ...this.formatComic(comic, true),
      artistName: comic.artistName,
      originalAuthor: comic.originalAuthor,
      chapters: comic.chapters.map((ch) => ({ ...ch, number: Number(ch.number) })),
    };
  }

  async findByAuthor(authorId: string) {
    const comics = await this.prisma.comic.findMany({
      where: { authorId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: this.baseInclude,
    });
    return comics.map((c) => this.formatComic(c, true));
  }

  async update(comicId: string, userId: string, role: UserRole, dto: UpdateComicDto) {
    const comic = await this.prisma.comic.findUnique({
      where: { id: comicId },
      include: {
        author: { select: { displayName: true } },
        genres: { select: { genreId: true } },
      },
    });
    if (!comic || comic.deletedAt) throw new NotFoundException('Không tìm thấy truyện');
    if (comic.authorId !== userId && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa truyện này');
    }

    if (
      comic.contentRating === ContentRating.MATURE &&
      dto.contentRating !== undefined &&
      dto.contentRating !== ContentRating.MATURE &&
      role !== UserRole.ADMIN &&
      role !== UserRole.MODERATOR
    ) {
      throw new ForbiddenException('Chỉ quản trị viên hoặc kiểm duyệt viên mới có thể hạ nhãn nội dung 18+');
    }

    const data: Prisma.ComicUpdateInput = {};
    const nextTitle = dto.title?.trim() || comic.title;
    if (dto.title && dto.title.trim() !== comic.title) {
      data.title = nextTitle;
      data.slug = await this.generateUniqueSlug(nextTitle, comicId);
    }
    if (dto.alternativeTitles !== undefined) data.alternativeTitles = dto.alternativeTitles;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.artistName !== undefined) data.artistName = dto.artistName;
    if (dto.originalAuthor !== undefined) data.originalAuthor = dto.originalAuthor;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.contentRating !== undefined) data.contentRating = dto.contentRating;
    if (dto.originalLanguage !== undefined) data.originalLanguage = dto.originalLanguage;
    if (dto.releaseYear !== undefined) data.releaseYear = dto.releaseYear;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.bannerPosition !== undefined) data.bannerPosition = Math.max(0, Math.min(100, dto.bannerPosition));
    if (dto.isFeatured !== undefined && (role === UserRole.ADMIN || role === UserRole.MODERATOR)) {
      data.isFeatured = dto.isFeatured;
    }

    data.searchText = this.buildSearchText([
      nextTitle,
      dto.alternativeTitles ?? comic.alternativeTitles,
      dto.tags ?? comic.tags,
      dto.artistName ?? comic.artistName,
      dto.originalAuthor ?? comic.originalAuthor,
      comic.author?.displayName,
    ]);

    const oldGenreIds = comic.genres.map((g) => g.genreId);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.genreIds) {
        await tx.comicGenre.deleteMany({ where: { comicId } });
        if (dto.genreIds.length > 0) {
          await tx.comicGenre.createMany({
            data: dto.genreIds.map((genreId) => ({ comicId, genreId })),
          });
        }
      }

      return tx.comic.update({
        where: { id: comicId },
        data,
        include: this.baseInclude,
      });
    });

    const draftToggled =
      dto.status !== undefined &&
      (comic.status === ComicStatus.DRAFT) !== (updated.status === ComicStatus.DRAFT);

    if (dto.genreIds || draftToggled) {
      const affected = Array.from(new Set([...oldGenreIds, ...(dto.genreIds ?? oldGenreIds)]));
      if (affected.length > 0) {
        await this.genreService.recalculateCounts(affected).catch(() => {});
      }
    }

    await Promise.all([
      this.redis.del(`comic:${comic.slug}`),
      updated.slug !== comic.slug ? this.redis.del(`comic:${updated.slug}`) : Promise.resolve(),
      this.redis.deletePattern('homepage*'),
      this.redis.deletePattern('rankings*'),
      this.redis.deletePattern('rec:*'),
    ]);

    return this.formatComic(updated, true);
  }

  async remove(comicId: string, userId: string, role: UserRole) {
    const comic = await this.prisma.comic.findUnique({
      where: { id: comicId },
      include: { genres: { select: { genreId: true } } },
    });
    if (!comic || comic.deletedAt) throw new NotFoundException('Không tìm thấy truyện');
    if (comic.authorId !== userId && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Bạn không có quyền xóa truyện này');
    }

    await this.prisma.comic.update({
      where: { id: comicId },
      data: { deletedAt: new Date() },
    });

    await this.genreService.recalculateCounts(comic.genres.map((g) => g.genreId)).catch(() => {});
    await this.redis.del(`comic:${comic.slug}`);
    await this.redis.deletePattern('homepage*');
    await this.redis.deletePattern('rankings*');
    return { deleted: true };
  }

  async publish(comicId: string, userId: string) {
    return this.moderationService.submitForReview(userId, ModerationTargetType.COMIC, comicId);
  }

  async recordSearch(userId?: string, query?: string) {
    if (!query || query.trim().length < 2 || !userId) return;
    const clean = query.trim().toLowerCase();
    const key = `user:search:${userId}`;
    const existing = (await this.redis.get<string[]>(key)) || [];
    const updated = [clean, ...existing.filter((q) => q !== clean)].slice(0, 10);
    await this.redis.set(key, updated, 30 * 86400);
  }

  async getRecommendations(userId: string | undefined, query: RecommendationQueryDto) {
    const limit = Math.min(Number(query.limit) || 6, 20);
    const comicId = query.comicId;
    const guestGenres = query.genres
      ? query.genres.split(',').map((g) => g.trim().toLowerCase()).filter(Boolean)
      : [];

    const cacheKey = `rec:${userId || 'guest'}:${comicId || 'none'}:${guestGenres.sort().join('_') || 'none'}:${limit}`;
    const cached = await this.redis.get<{ data: unknown[]; reason: string }>(cacheKey);
    if (cached) return cached;

    const baseWhere: Prisma.ComicWhereInput = {
      deletedAt: null,
      approvalStatus: ApprovalStatus.APPROVED,
      status: { not: ComicStatus.DRAFT },
    };

    const recommended: any[] = [];
    let reason = 'Tác phẩm nổi bật dành cho bạn';
    const excludeIds = new Set<string>(comicId ? [comicId] : []);

    if (userId) {
      const [history, bookmarks, ratings] = await Promise.all([
        this.prisma.readingHistory.findMany({
          where: { userId },
          orderBy: { readAt: 'desc' },
          take: 25,
          select: {
            comicId: true,
            comic: { select: { genres: { select: { genre: { select: { id: true, name: true } } } } } },
          },
        }),
        this.prisma.bookmark.findMany({
          where: { userId },
          select: {
            comicId: true,
            comic: { select: { genres: { select: { genre: { select: { id: true, name: true } } } } } },
          },
        }),
        this.prisma.rating.findMany({
          where: { userId, score: { gte: 4 } },
          select: {
            comicId: true,
            comic: { select: { genres: { select: { genre: { select: { id: true, name: true } } } } } },
          },
        }),
      ]);

      const scores = new Map<string, { id: string; name: string; score: number }>();
      const addScore = (g: { id: string; name: string }, pts: number) => {
        const cur = scores.get(g.id) || { ...g, score: 0 };
        cur.score += pts;
        scores.set(g.id, cur);
      };

      for (const h of history) {
        excludeIds.add(h.comicId);
        h.comic.genres.forEach((cg) => addScore(cg.genre, 2));
      }
      for (const b of bookmarks) {
        excludeIds.add(b.comicId);
        b.comic.genres.forEach((cg) => addScore(cg.genre, 4));
      }
      for (const r of ratings) {
        excludeIds.add(r.comicId);
        r.comic.genres.forEach((cg) => addScore(cg.genre, 3));
      }

      const topGenres = Array.from(scores.values()).sort((a, b) => b.score - a.score).slice(0, 3);
      if (topGenres.length > 0) {
        reason = `Hợp gu của bạn (${topGenres.slice(0, 2).map((g) => g.name).join(', ')})`;
        const matches = await this.prisma.comic.findMany({
          where: {
            ...baseWhere,
            id: { notIn: Array.from(excludeIds) },
            genres: { some: { genreId: { in: topGenres.map((g) => g.id) } } },
          },
          orderBy: [{ avgRating: 'desc' }, { totalViews: 'desc' }],
          take: limit,
          include: this.baseInclude,
        });
        for (const m of matches) {
          recommended.push(m);
          excludeIds.add(m.id);
        }
      }
    }

    if (recommended.length < limit && (comicId || guestGenres.length > 0)) {
      let targetGenreIds: string[] = [];
      if (comicId) {
        const current = await this.prisma.comic.findFirst({
          where: {
            id: comicId,
            deletedAt: null,
            approvalStatus: ApprovalStatus.APPROVED,
            status: { not: ComicStatus.DRAFT },
          },
          include: { genres: true },
        });
        targetGenreIds = current?.genres.map((g) => g.genreId) || [];
      } else if (guestGenres.length > 0) {
        const matched = await this.prisma.genre.findMany({
          where: { slug: { in: guestGenres.slice(0, 10) } },
          select: { id: true },
        });
        targetGenreIds = matched.map((g) => g.id);
      }

      if (targetGenreIds.length > 0) {
        if (!userId) reason = 'Cùng thể loại có thể bạn sẽ thích';
        const similar = await this.prisma.comic.findMany({
          where: {
            ...baseWhere,
            id: { notIn: Array.from(excludeIds) },
            genres: { some: { genreId: { in: targetGenreIds } } },
          },
          orderBy: [{ totalViews: 'desc' }, { avgRating: 'desc' }],
          take: limit - recommended.length,
          include: this.baseInclude,
        });
        for (const s of similar) {
          recommended.push(s);
          excludeIds.add(s.id);
        }
      }
    }

    if (recommended.length < limit) {
      const popular = await this.prisma.comic.findMany({
        where: {
          ...baseWhere,
          id: { notIn: Array.from(excludeIds) },
        },
        orderBy: [{ totalViews: 'desc' }, { avgRating: 'desc' }],
        take: limit - recommended.length,
        include: this.baseInclude,
      });
      recommended.push(...popular);
    }

    const result = {
      data: recommended.map((c) => ({ ...this.formatComic(c), recommendReason: reason })),
      reason,
    };

    await this.redis.set(cacheKey, result, 180);
    return result;
  }

  private formatComic(comic: any, includePrivate = false) {
    return {
      id: comic.id,
      title: comic.title,
      slug: comic.slug,
      alternativeTitles: comic.alternativeTitles || [],
      description: comic.description,
      coverUrl: comic.coverUrl,
      bannerUrl: comic.bannerUrl,
      bannerPosition: comic.bannerPosition ?? 50,
      type: comic.type,
      status: comic.status,
      approvalStatus: comic.approvalStatus,
      ...(includePrivate ? { rejectionReason: comic.rejectionReason } : {}),
      contentRating: comic.contentRating,
      originalLanguage: comic.originalLanguage,
      releaseYear: comic.releaseYear,
      tags: comic.tags || [],
      isFeatured: comic.isFeatured,
      author: comic.author
        ? {
            ...comic.author,
            cultivation: comic.author.level ? getCultivationInfo(comic.author.level, 0) : undefined,
          }
        : null,
      genres:
        comic.genres?.map((cg: any) => ({
          id: cg.genre.id,
          name: cg.genre.name,
          slug: cg.genre.slug,
          icon: cg.genre.icon,
          color: cg.genre.color,
        })) || [],
      latestChapters:
        comic.chapters?.slice(0, 2).map((ch: any) => ({
          id: ch.id,
          number: Number(ch.number),
          title: ch.title,
          isPremium: ch.isPremium,
          priceCoins: ch.priceCoins,
          publishedAt: ch.publishedAt,
        })) || [],
      stats: {
        totalViews: comic.totalViews,
        dailyViews: comic.dailyViews,
        weeklyViews: comic.weeklyViews,
        monthlyViews: comic.monthlyViews,
        avgRating: Number(comic.avgRating),
        totalRatings: comic.totalRatings,
        totalBookmarks: comic.totalBookmarks,
        totalChapters: comic.totalChapters,
        totalComments: comic.totalComments,
      },
      publishedAt: comic.publishedAt,
      lastChapterAt: comic.lastChapterAt,
    };
  }

  private async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title, { lower: true, strict: true, locale: 'vi' }) || 'comic';
    let counter = 1;
    let slug = RESERVED_COMIC_SLUGS.has(base) ? `${base}-${counter++}` : base;
    while (true) {
      if (!RESERVED_COMIC_SLUGS.has(slug)) {
        const existing = await this.prisma.comic.findUnique({ where: { slug } });
        if (!existing || (excludeId && existing.id === excludeId)) {
          return slug;
        }
      }
      slug = `${base}-${counter++}`;
    }
  }
}
