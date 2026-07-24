import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateComicDto, UpdateComicDto, ComicQueryDto } from './dto/comic.dto';
import { ComicStatus, ContentRating, Prisma } from '@prisma/client';
import slugify from 'slugify';

@Injectable()
export class ComicService {
  private readonly logger = new Logger(ComicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
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
      status: query.status || { not: ComicStatus.DRAFT },
    };

    // Genre filter
    if (query.genre) {
      where.genres = { some: { genre: { slug: query.genre } } };
    }

    // Search
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
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
          where: { deletedAt: null, publishedAt: { not: null } },
          orderBy: { orderIndex: 'asc' },
          select: { id: true, number: true, title: true, totalPages: true, isPremium: true, views: true, publishedAt: true },
        },
      },
    });

    if (!comic) throw new NotFoundException('Comic not found');

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
      data.title = dto.title;
      data.slug = await this.generateUniqueSlug(dto.title);
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
    if (dto.title) await this.redis.del(`comic:${updated.slug}`);

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

  // ── Publish Comic ──

  async publish(comicId: string, userId: string) {
    const comic = await this.prisma.comic.findUnique({ where: { id: comicId } });
    if (!comic) throw new NotFoundException('Comic not found');
    if (comic.authorId !== userId) throw new ForbiddenException('Not the author');

    return this.prisma.comic.update({
      where: { id: comicId },
      data: { status: ComicStatus.ONGOING, publishedAt: comic.publishedAt || new Date() },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
        genres: { include: { genre: true } },
      },
    });
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

    return comics.map(this.formatComic);
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
    const baseWhere = { deletedAt: null, status: { not: notDraft } };

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
    const where: Prisma.ComicWhereInput = {
      deletedAt: null,
      status: { not: ComicStatus.DRAFT },
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    };

    const [comics, total] = await Promise.all([
      this.prisma.comic.findMany({
        where,
        orderBy: { totalViews: 'desc' },
        skip,
        take: limit,
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
          genres: { include: { genre: true } },
        },
      }),
      this.prisma.comic.count({ where }),
    ]);

    return { data: comics.map(this.formatComic), meta: { page, limit, total, hasNext: skip + limit < total } };
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

  private async generateUniqueSlug(title: string): Promise<string> {
    const base = slugify(title, { lower: true, strict: true, locale: 'vi' });
    let slug = base;
    let counter = 1;

    while (await this.prisma.comic.findUnique({ where: { slug } })) {
      slug = `${base}-${counter}`;
      counter++;
    }

    return slug;
  }
}
