import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateComicDto, UpdateComicDto, ComicQueryDto, RecommendationQueryDto } from './dto/comic.dto';
import { ComicStatus, ContentRating, ApprovalStatus, Prisma, ModerationTargetType } from '@prisma/client';
import { ModerationService } from '../moderation/moderation.service';
import slugify from 'slugify';

@Injectable()
export class ComicService {
  private readonly logger = new Logger(ComicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly moderationService: ModerationService,
  ) {}

  // ── Create Comic ──

  async create(authorId: string, dto: CreateComicDto) {
    const slug = await this.generateUniqueSlug(dto.title);

    const comic = await this.prisma.comic.create({
      data: {
        authorId,
        title: dto.title,
        slug,
        description: dto.description,
        contentRating: dto.contentRating || ContentRating.EVERYONE,
        originalLanguage: dto.originalLanguage || 'vi',
        status: ComicStatus.DRAFT,
        approvalStatus: ApprovalStatus.DRAFT,
        ...(dto.genreIds && {
          genres: {
            create: dto.genreIds.map((genreId) => ({ genreId })),
          },
        }),
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
        genres: { include: { genre: true } },
      },
    });

    this.logger.log(`Comic created: ${comic.title} by ${authorId}`);
    return this.formatComic(comic);
  }

  // ── Get All Comics (paginated, filtered) ──

  async findAll(query: ComicQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.ComicWhereInput = {
      deletedAt: null,
      approvalStatus: ApprovalStatus.APPROVED,
      status: query.status || { not: ComicStatus.DRAFT },
    };

    // Genre filter
    if (query.genre) {
      where.genres = { some: { genre: { slug: query.genre } } };
    }

    // Search
    if (query.search) {
      const searchPattern = `%${query.search}%`;
      const matchedComics = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "comics"
        WHERE (unaccent(title) ILIKE unaccent(${searchPattern}) OR unaccent(description) ILIKE unaccent(${searchPattern}))
          AND "deleted_at" IS NULL
      `;
      const matchedIds = matchedComics.map((c) => c.id);
      where.id = { in: matchedIds };
    }

    // Sort
    let orderBy: Prisma.ComicOrderByWithRelationInput = { lastChapterAt: 'desc' };
    switch (query.sort) {
      case 'popular': orderBy = { totalViews: 'desc' }; break;
      case 'rating': orderBy = { avgRating: 'desc' }; break;
      case 'latest': orderBy = { publishedAt: 'desc' }; break;
      case 'updated': orderBy = { lastChapterAt: 'desc' }; break;
    }

    const [comics, total] = await Promise.all([
      this.prisma.comic.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
          genres: { include: { genre: true } },
        },
      }),
      this.prisma.comic.count({ where }),
    ]);

    return {
      data: comics.map(this.formatComic),
      meta: { page, limit, total, hasNext: skip + limit < total },
    };
  }

  // ── Get Comic by Slug ──

  async findBySlug(slug: string) {
    // Try cache first (Upstash auto-deserializes JSON)
    const cached = await this.redis.get(`comic:${slug}`);
    if (cached) return cached;

    const comic = await this.prisma.comic.findUnique({
      where: { slug, deletedAt: null },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
        genres: { include: { genre: true } },
        chapters: {
          where: { deletedAt: null, approvalStatus: ApprovalStatus.APPROVED, publishedAt: { not: null } },
          orderBy: { orderIndex: 'asc' },
          select: { id: true, number: true, title: true, totalPages: true, isPremium: true, views: true, publishedAt: true },
        },
      },
    });

    if (!comic || comic.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new NotFoundException('Comic not found');
    }

    const result = {
      ...this.formatComic(comic),
      chapters: comic.chapters,
    };

    // Cache for 5 minutes (Upstash auto-serializes JSON)
    await this.redis.set(`comic:${slug}`, result, 300);

    return result;
  }

  // ── Update Comic ──

  async update(comicId: string, userId: string, dto: UpdateComicDto) {
    const comic = await this.prisma.comic.findUnique({ where: { id: comicId } });
    if (!comic) throw new NotFoundException('Comic not found');
    if (comic.authorId !== userId) throw new ForbiddenException('Not the author');

    const data: Prisma.ComicUpdateInput = {};
    if (dto.title) {
      data.title = dto.title.trim();
      data.slug = await this.generateUniqueSlug(dto.title.trim(), comicId);
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status) data.status = dto.status;
    if (dto.contentRating) data.contentRating = dto.contentRating;
    if (dto.bannerPosition !== undefined) data.bannerPosition = Math.max(0, Math.min(100, dto.bannerPosition));

    // Update genres
    if (dto.genreIds) {
      await this.prisma.comicGenre.deleteMany({ where: { comicId } });
      await this.prisma.comicGenre.createMany({
        data: dto.genreIds.map((genreId) => ({ comicId, genreId })),
      });
    }

    const updated = await this.prisma.comic.update({
      where: { id: comicId },
      data,
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
        genres: { include: { genre: true } },
      },
    });

    // Invalidate cache
    await this.redis.del(`comic:${comic.slug}`);
    if (updated.slug !== comic.slug) await this.redis.del(`comic:${updated.slug}`);

    return this.formatComic(updated);
  }

  // ── Delete Comic (soft) ──

  async remove(comicId: string, userId: string) {
    const comic = await this.prisma.comic.findUnique({ where: { id: comicId } });
    if (!comic) throw new NotFoundException('Comic not found');
    if (comic.authorId !== userId) throw new ForbiddenException('Not the author');

    await this.prisma.comic.update({
      where: { id: comicId },
      data: { deletedAt: new Date() },
    });

    await this.redis.del(`comic:${comic.slug}`);
  }

  // ── Submit Comic Review ──

  async submitReview(comicId: string, userId: string) {
    return this.moderationService.submitForReview(userId, ModerationTargetType.COMIC, comicId);
  }

  // ── Publish Comic (Submits for review / Auto approves if verified) ──

  async publish(comicId: string, userId: string) {
    const comic = await this.prisma.comic.findUnique({ where: { id: comicId } });
    if (!comic) throw new NotFoundException('Comic not found');
    if (comic.authorId !== userId) throw new ForbiddenException('Not the author');

    return this.moderationService.submitForReview(userId, ModerationTargetType.COMIC, comicId);
  }

  // ── Get Author's Comics ──

  async findByAuthor(authorId: string) {
    const comics = await this.prisma.comic.findMany({
      where: { authorId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
        genres: { include: { genre: true } },
      },
    });

    return comics.map((c) => this.formatComic(c));
  }

  // ── Homepage Sections ──

  async getHomepageSections() {
    // Upstash auto-deserializes JSON
    const cached = await this.redis.get('homepage');
    if (cached) return cached;

    const baseInclude = {
      author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
      genres: { include: { genre: true } },
    };
    const notDraft = ComicStatus.DRAFT;
    const baseWhere = { deletedAt: null, approvalStatus: ApprovalStatus.APPROVED, status: { not: notDraft } };

    const [trending, latest, topRated] = await Promise.all([
      this.prisma.comic.findMany({
        where: baseWhere,
        orderBy: { totalViews: 'desc' },
        take: 10,
        include: baseInclude,
      }),
      this.prisma.comic.findMany({
        where: baseWhere,
        orderBy: { publishedAt: 'desc' },
        take: 10,
        include: baseInclude,
      }),
      this.prisma.comic.findMany({
        where: { ...baseWhere, totalRatings: { gte: 1 } },
        orderBy: { avgRating: 'desc' },
        take: 10,
        include: baseInclude,
      }),
    ]);

    const result = {
      trending: trending.map(this.formatComic),
      latest: latest.map(this.formatComic),
      topRated: topRated.map(this.formatComic),
    };

    // Upstash auto-serializes JSON
    await this.redis.set('homepage', result, 300);
    return result;
  }

  // ── Search ──

  async search(query: string, page = 1) {
    if (!query || query.trim().length < 2) return { data: [], meta: { page, limit: 20, total: 0, hasNext: false } };

    const limit = 20;
    const skip = (page - 1) * limit;
    const searchPattern = `%${query}%`;

    const matchedComics = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "comics"
      WHERE (unaccent(title) ILIKE unaccent(${searchPattern}) OR unaccent(description) ILIKE unaccent(${searchPattern}))
        AND "deleted_at" IS NULL
        AND status::text != 'DRAFT'
      ORDER BY "total_views" DESC
    `;

    const total = matchedComics.length;
    if (total === 0) {
      return { data: [], meta: { page, limit, total: 0, hasNext: false } };
    }

    const paginatedIds = matchedComics
      .slice(skip, skip + limit)
      .map((item) => item.id);

    const comics = await this.prisma.comic.findMany({
      where: {
        id: { in: paginatedIds },
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
        genres: { include: { genre: true } },
      },
    });

    const sortedComics = paginatedIds
      .map((id) => comics.find((c) => c.id === id)!)
      .filter(Boolean);

    return {
      data: sortedComics.map(this.formatComic.bind(this)),
      meta: { page, limit, total, hasNext: skip + limit < total },
    };
  }

  // ── Get Genres ──

  async getGenres() {
    // Upstash auto-deserializes JSON
    const cached = await this.redis.get('genres');
    if (cached) return cached;

    const genres = await this.prisma.genre.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    // Upstash auto-serializes JSON
    await this.redis.set('genres', genres, 3600);
    return genres;
  }

  // ── Record Search Query ──

  async recordSearch(userId?: string, query?: string) {
    if (!query || query.trim().length < 2) return;
    const cleanQuery = query.trim().toLowerCase();

    try {
      if (userId) {
        const key = `user:search:${userId}`;
        const existing = (await this.redis.get<string[]>(key)) || [];
        const updated = [cleanQuery, ...existing.filter((q) => q !== cleanQuery)].slice(0, 10);
        await this.redis.set(key, updated, 30 * 86400); // 30 days TTL
      }
    } catch (err: any) {
      this.logger.warn(`Failed to record search query: ${err.message}`);
    }
  }

  // ── Get Personalized Recommendations ──

  async getRecommendations(userId: string | undefined, query: RecommendationQueryDto) {
    const limit = Math.min(Number(query.limit) || 5, 20);
    const comicId = query.comicId;
    const guestGenres = query.genres
      ? query.genres.split(',').map((g) => g.trim().toLowerCase()).filter(Boolean)
      : [];

    const cacheKey = `rec:${userId || 'guest'}:${comicId || 'none'}:${guestGenres.sort().join('_') || 'none'}:${limit}`;
    const cached = await this.redis.get<{ data: any[]; reason: string }>(cacheKey);
    if (cached) return cached;

    const baseInclude = {
      author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
      genres: { include: { genre: true } },
    };
    const baseWhere: any = {
      deletedAt: null,
      status: { not: ComicStatus.DRAFT },
      approvalStatus: ApprovalStatus.APPROVED,
    };

    let recommendedComics: any[] = [];
    let recommendationReason = 'Đề xuất dành riêng cho bạn';

    // 1. If User is logged in: Content-based Affinity Scoring
    if (userId) {
      try {
        const [recentHistory, bookmarks, highRatings, userSearches] = await Promise.all([
          // Recent 40 reads
          this.prisma.readingHistory.findMany({
            where: { userId },
            orderBy: { readAt: 'desc' },
            take: 40,
            select: {
              comicId: true,
              chapter: {
                select: {
                  comic: {
                    select: {
                      id: true,
                      genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
                    },
                  },
                },
              },
            },
          }),
          // Bookmarks
          this.prisma.bookmark.findMany({
            where: { userId },
            select: {
              comicId: true,
              comic: {
                select: {
                  id: true,
                  genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
                },
              },
            },
          }),
          // Ratings >= 4
          this.prisma.rating.findMany({
            where: { userId, score: { gte: 4 } },
            select: {
              comicId: true,
              comic: {
                select: {
                  id: true,
                  genres: { select: { genre: { select: { id: true, name: true, slug: true } } } },
                },
              },
            },
          }),
          // Search queries from Redis
          this.redis.get<string[]>(`user:search:${userId}`),
        ]);

        const genreScores = new Map<string, { id: string; name: string; score: number }>();
        const readComicIds = new Set<string>();

        if (comicId) readComicIds.add(comicId);

        const addGenreScore = (genre: { id: string; name: string }, points: number) => {
          const current = genreScores.get(genre.id) || { id: genre.id, name: genre.name, score: 0 };
          current.score += points;
          genreScores.set(genre.id, current);
        };

        // Score from reading history (+2 points per chap read)
        for (const item of recentHistory) {
          if (item.comicId) readComicIds.add(item.comicId);
          const genres = item.chapter?.comic?.genres || [];
          for (const g of genres) {
            addGenreScore(g.genre, 2);
          }
        }

        // Score from bookmarks (+5 points)
        for (const b of bookmarks) {
          if (b.comicId) readComicIds.add(b.comicId);
          const genres = b.comic?.genres || [];
          for (const g of genres) {
            addGenreScore(g.genre, 5);
          }
        }

        // Score from ratings (+4 points)
        for (const r of highRatings) {
          if (r.comicId) readComicIds.add(r.comicId);
          const genres = r.comic?.genres || [];
          for (const g of genres) {
            addGenreScore(g.genre, 4);
          }
        }

        // Score from search queries (+3 points if matches genre)
        if (userSearches && userSearches.length > 0) {
          const allGenres = await this.prisma.genre.findMany({
            where: { isActive: true },
            select: { id: true, name: true, slug: true },
          });
          for (const q of userSearches) {
            const matched = allGenres.filter(
              (g: any) =>
                g.slug.toLowerCase().includes(q) ||
                g.name.toLowerCase().includes(q) ||
                q.includes(g.name.toLowerCase()),
            );
            for (const mg of matched) {
              addGenreScore(mg, 3);
            }
          }
        }

        const sortedGenres = Array.from(genreScores.values()).sort((a, b) => b.score - a.score);

        if (sortedGenres.length > 0) {
          const topGenreIds = sortedGenres.slice(0, 4).map((g) => g.id);
          const topGenreNames = sortedGenres.slice(0, 2).map((g) => g.name).join(', ');
          recommendationReason = `Dựa trên sở thích: ${topGenreNames}`;

          const candidateWhere: any = {
            ...baseWhere,
            genres: { some: { genreId: { in: topGenreIds } } },
          };
          if (readComicIds.size > 0) {
            candidateWhere.id = { notIn: Array.from(readComicIds) };
          }

          const candidates = await this.prisma.comic.findMany({
            where: candidateWhere,
            take: limit * 4,
            include: baseInclude,
          });

          const scoredCandidates = candidates.map((c) => {
            const matchedCount = c.genres.filter((cg: any) => topGenreIds.includes(cg.genreId)).length;
            const qualityScore = Number(c.avgRating) * 2 + Math.log10(c.totalViews + 10);
            return {
              comic: c,
              score: matchedCount * 10 + qualityScore,
            };
          });

          scoredCandidates.sort((a, b) => b.score - a.score);
          recommendedComics = scoredCandidates.slice(0, limit).map((sc) => sc.comic);
        }
      } catch (err: any) {
        this.logger.error(`Personalized recommendation error: ${err.message}`);
      }
    }

    // 2. If Guest or Cold-start (recommendedComics not enough):
    if (recommendedComics.length < limit) {
      const remainingNeeded = limit - recommendedComics.length;
      const excludeIds = new Set<string>(recommendedComics.map((c) => c.id));
      if (comicId) excludeIds.add(comicId);

      let targetGenreIds: string[] = [];
      if (comicId) {
        const curComic = await this.prisma.comic.findUnique({
          where: { id: comicId },
          include: { genres: true },
        });
        if (curComic) {
          targetGenreIds = curComic.genres.map((cg) => cg.genreId);
        }
      }

      if (targetGenreIds.length === 0 && guestGenres.length > 0) {
        const matchedDbGenres = await this.prisma.genre.findMany({
          where: { slug: { in: guestGenres } },
          select: { id: true },
        });
        targetGenreIds = matchedDbGenres.map((g) => g.id);
      }

      if (targetGenreIds.length > 0) {
        if (!userId) {
          recommendationReason = 'Có thể bạn sẽ thích (cùng thể loại)';
        }
        const similarComics = await this.prisma.comic.findMany({
          where: {
            ...baseWhere,
            id: { notIn: Array.from(excludeIds) },
            genres: { some: { genreId: { in: targetGenreIds } } },
          },
          orderBy: [{ totalViews: 'desc' }, { avgRating: 'desc' }],
          take: remainingNeeded,
          include: baseInclude,
        });

        for (const sc of similarComics) {
          if (!excludeIds.has(sc.id)) {
            recommendedComics.push(sc);
            excludeIds.add(sc.id);
          }
        }
      }
    }

    // 3. Fallback: Popular comics
    if (recommendedComics.length < limit) {
      const remainingNeeded = limit - recommendedComics.length;
      const excludeIds = new Set<string>(recommendedComics.map((c) => c.id));
      if (comicId) excludeIds.add(comicId);

      const popularComics = await this.prisma.comic.findMany({
        where: {
          ...baseWhere,
          id: { notIn: Array.from(excludeIds) },
        },
        orderBy: [{ totalViews: 'desc' }, { avgRating: 'desc' }],
        take: remainingNeeded,
        include: baseInclude,
      });

      for (const pc of popularComics) {
        recommendedComics.push(pc);
      }
      if (!userId && !comicId) {
        recommendationReason = 'Truyện nổi bật được yêu thích';
      }
    }

    const formatted = recommendedComics.map((c) => ({
      ...this.formatComic(c),
      recommendReason: recommendationReason,
    }));

    const result = {
      data: formatted,
      reason: recommendationReason,
    };

    // Cache in Redis for 3 minutes (180s)
    await this.redis.set(cacheKey, result, 180);
    return result;
  }

  // ── Helpers ──

  private formatComic(comic: any) {
    return {
      id: comic.id,
      title: comic.title,
      slug: comic.slug,
      description: comic.description,
      coverUrl: comic.coverUrl,
      bannerUrl: comic.bannerUrl,
      bannerPosition: comic.bannerPosition ?? 50,
      status: comic.status,
      approvalStatus: comic.approvalStatus,
      rejectionReason: comic.rejectionReason,
      contentRating: comic.contentRating,
      originalLanguage: comic.originalLanguage,
      author: comic.author,
      genres: comic.genres?.map((cg: any) => ({
        id: cg.genre.id,
        name: cg.genre.name,
        slug: cg.genre.slug,
        icon: cg.genre.icon,
      })) || [],
      stats: {
        totalViews: comic.totalViews,
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

  private async generateUniqueSlug(title: string, excludeComicId?: string): Promise<string> {
    const base = slugify(title, { lower: true, strict: true, locale: 'vi' }) || 'comic';
    let slug = base;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.comic.findUnique({ where: { slug } });
      if (!existing || (excludeComicId && existing.id === excludeComicId)) {
        return slug;
      }
      slug = `${base}-${counter}`;
      counter++;
    }
  }
}
