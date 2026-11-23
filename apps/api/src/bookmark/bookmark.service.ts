import { Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, ComicStatus, Prisma, ReadingListStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GamificationService } from '../gamification/gamification.service';
import { BookmarkQueryDto, UpsertBookmarkDto } from './dto/bookmark.dto';

@Injectable()
export class BookmarkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gamification: GamificationService,
  ) {}

  private async getPublicComic(comicId: string) {
    const comic = await this.prisma.comic.findFirst({
      where: {
        id: comicId,
        deletedAt: null,
        approvalStatus: ApprovalStatus.APPROVED,
        status: { not: ComicStatus.DRAFT },
      },
      select: { id: true, slug: true, authorId: true },
    });
    if (!comic) throw new NotFoundException('Không tìm thấy truyện');
    return comic;
  }

  async toggle(userId: string, comicId: string, status: ReadingListStatus = ReadingListStatus.READING) {
    const comic = await this.getPublicComic(comicId);

    const outcome = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.bookmark.findUnique({
        where: { userId_comicId: { userId, comicId } },
      });

      if (existing) {
        await tx.bookmark.delete({ where: { id: existing.id } });
        await this.syncBookmarkCount(tx, comicId);
        return { bookmarked: false as const, status: null };
      }

      const created = await tx.bookmark.create({
        data: { userId, comicId, status },
      });
      await this.syncBookmarkCount(tx, comicId);
      return { bookmarked: true as const, status: created.status };
    });

    await this.invalidateComicCaches(comic.slug);
    if (outcome.bookmarked && comic.authorId !== userId) {
      this.gamification.awardBookmark(userId, comicId).catch(() => {});
    }

    return outcome;
  }

  async upsert(userId: string, comicId: string, dto: UpsertBookmarkDto) {
    const comic = await this.getPublicComic(comicId);

    const { bookmark, isNew } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.bookmark.findUnique({
        where: { userId_comicId: { userId, comicId } },
      });

      const saved = await tx.bookmark.upsert({
        where: { userId_comicId: { userId, comicId } },
        update: {
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.isFavorite !== undefined && { isFavorite: dto.isFavorite }),
          ...(dto.notifyUpdate !== undefined && { notifyUpdate: dto.notifyUpdate }),
        },
        create: {
          userId,
          comicId,
          status: dto.status || ReadingListStatus.READING,
          isFavorite: dto.isFavorite || false,
          notifyUpdate: dto.notifyUpdate ?? true,
        },
      });

      if (!existing) {
        await this.syncBookmarkCount(tx, comicId);
      }

      return { bookmark: saved, isNew: !existing };
    });

    if (isNew) {
      await this.invalidateComicCaches(comic.slug);
      if (comic.authorId !== userId) {
        this.gamification.awardBookmark(userId, comicId).catch(() => {});
      }
    }

    return bookmark;
  }

  async remove(userId: string, comicId: string) {
    const comic = await this.prisma.comic.findUnique({ where: { id: comicId }, select: { slug: true } });
    const deletedCount = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.bookmark.deleteMany({
        where: { userId, comicId },
      });
      if (deleted.count > 0 && comic) {
        await this.syncBookmarkCount(tx, comicId);
      }
      return deleted.count;
    });
    if (deletedCount > 0 && comic) {
      await this.invalidateComicCaches(comic.slug);
    }
    return { bookmarked: false };
  }

  async getUserBookmarks(userId: string, query: BookmarkQueryDto) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(Math.max(1, Math.floor(Number(query.limit) || 24)), 50);
    const skip = (page - 1) * limit;

    const where: Prisma.BookmarkWhereInput = {
      userId,
      comic: {
        deletedAt: null,
        approvalStatus: ApprovalStatus.APPROVED,
        status: { not: ComicStatus.DRAFT },
      },
    };
    if (query.status) where.status = query.status;
    if (query.favoriteOnly === 'true') where.isFavorite = true;

    const [bookmarks, total] = await Promise.all([
      this.prisma.bookmark.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          comic: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverUrl: true,
              type: true,
              status: true,
              totalChapters: true,
              avgRating: true,
              lastChapterAt: true,
              author: { select: { id: true, username: true, displayName: true } },
              chapters: {
                where: { deletedAt: null, approvalStatus: ApprovalStatus.APPROVED },
                orderBy: { number: 'desc' },
                take: 1,
                select: { id: true, number: true },
              },
            },
          },
        },
      }),
      this.prisma.bookmark.count({ where }),
    ]);

    return {
      data: bookmarks.map((b) => ({
        ...b,
        comic: {
          ...b.comic,
          avgRating: Number(b.comic.avgRating),
          latestChapter: b.comic.chapters[0]
            ? { id: b.comic.chapters[0].id, number: Number(b.comic.chapters[0].number) }
            : null,
        },
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

  async check(userId: string, comicId: string) {
    const bookmark = await this.prisma.bookmark.findUnique({
      where: { userId_comicId: { userId, comicId } },
    });
    return {
      bookmarked: !!bookmark,
      status: bookmark?.status || null,
      isFavorite: bookmark?.isFavorite || false,
      notifyUpdate: bookmark?.notifyUpdate ?? true,
    };
  }

  private async syncBookmarkCount(tx: Prisma.TransactionClient, comicId: string) {
    const count = await tx.bookmark.count({ where: { comicId } });
    await tx.comic.update({
      where: { id: comicId },
      data: { totalBookmarks: count },
    });
  }

  private async invalidateComicCaches(slug: string) {
    await Promise.all([
      this.redis.del(`comic:${slug}`),
      this.redis.deletePattern('homepage*'),
      this.redis.deletePattern('rankings*'),
    ]);
  }
}
