import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class BookmarkService {
  private readonly logger = new Logger(BookmarkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async toggle(userId: string, comicId: string) {
    const existing = await this.prisma.bookmark.findUnique({
      where: { userId_comicId: { userId, comicId } },
    });

    if (existing) {
      await this.prisma.bookmark.delete({ where: { id: existing.id } });
      await this.prisma.comic.update({ where: { id: comicId }, data: { totalBookmarks: { decrement: 1 } } });
      return { bookmarked: false };
    }

    await this.prisma.bookmark.create({ data: { userId, comicId } });
    await this.prisma.comic.update({ where: { id: comicId }, data: { totalBookmarks: { increment: 1 } } });
    return { bookmarked: true };
  }

  async toggleFavorite(userId: string, comicId: string) {
    const bookmark = await this.prisma.bookmark.findUnique({
      where: { userId_comicId: { userId, comicId } },
    });
    if (!bookmark) throw new NotFoundException('Bookmark not found. Add bookmark first.');

    const updated = await this.prisma.bookmark.update({
      where: { id: bookmark.id },
      data: { isFavorite: !bookmark.isFavorite },
    });
    return { isFavorite: updated.isFavorite };
  }

  async getUserBookmarks(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [bookmarks, total] = await Promise.all([
      this.prisma.bookmark.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          comic: {
            select: {
              id: true, title: true, slug: true, coverUrl: true, status: true,
              totalChapters: true, lastChapterAt: true,
              author: { select: { displayName: true } },
            },
          },
        },
      }),
      this.prisma.bookmark.count({ where: { userId } }),
    ]);
    return { data: bookmarks, meta: { page, limit, total, hasNext: skip + limit < total } };
  }

  async isBookmarked(userId: string, comicId: string) {
    const bookmark = await this.prisma.bookmark.findUnique({
      where: { userId_comicId: { userId, comicId } },
    });
    return { bookmarked: !!bookmark, isFavorite: bookmark?.isFavorite || false };
  }
}
