import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, ComicStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { UpsertHistoryDto } from './dto/history.dto';

@Injectable()
export class HistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async upsert(userId: string, dto: UpsertHistoryDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: dto.chapterId },
      select: {
        id: true,
        comicId: true,
        totalPages: true,
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

    const now = new Date();
    if (
      !chapter ||
      chapter.deletedAt ||
      chapter.comic.deletedAt ||
      chapter.comicId !== dto.comicId ||
      chapter.approvalStatus !== ApprovalStatus.APPROVED ||
      chapter.comic.approvalStatus !== ApprovalStatus.APPROVED ||
      chapter.comic.status === ComicStatus.DRAFT ||
      (chapter.scheduledAt && chapter.scheduledAt > now)
    ) {
      throw new NotFoundException('Không tìm thấy chương truyện hợp lệ');
    }

    const isOwnComic = chapter.comic.authorId === userId;
    if (chapter.isPremium && chapter.priceCoins > 0 && !isOwnComic) {
      const unlocked = await this.prisma.chapterUnlock.findUnique({
        where: { userId_chapterId: { userId, chapterId: dto.chapterId } },
        select: { id: true },
      });
      if (!unlocked) {
        throw new ForbiddenException('Chương này chưa được mở khóa');
      }
    }

    const existing = await this.prisma.readingHistory.findUnique({
      where: { userId_chapterId: { userId, chapterId: dto.chapterId } },
    });

    const totalPages = chapter.totalPages || dto.totalPages || 0;
    const boundedLastPage =
      totalPages > 0 ? Math.min(Math.max(1, dto.lastPage), totalPages) : Math.max(1, dto.lastPage);
    const readingTimeIncrement = Math.min(Math.max(0, dto.readingTimeSeconds || 0), 86400);
    const isCompleted = dto.isCompleted ?? (totalPages > 0 && boundedLastPage >= totalPages);

    const record = await this.prisma.readingHistory.upsert({
      where: { userId_chapterId: { userId, chapterId: dto.chapterId } },
      update: {
        lastPage: boundedLastPage,
        totalPages,
        isCompleted: existing?.isCompleted || isCompleted,
        readingTimeSeconds: { increment: readingTimeIncrement },
        readAt: now,
      },
      create: {
        userId,
        comicId: dto.comicId,
        chapterId: dto.chapterId,
        lastPage: boundedLastPage,
        totalPages,
        isCompleted,
        readingTimeSeconds: readingTimeIncrement,
      },
    });

    // Keep Bookmark progress synced if user bookmarked this comic
    await this.prisma.bookmark.updateMany({
      where: { userId, comicId: dto.comicId },
      data: { lastChapterId: dto.chapterId, lastPage: boundedLastPage },
    });

    if (!existing && !isOwnComic) {
      const awarded = await this.gamification.awardReadChapter(userId, dto.chapterId).catch(() => false);
      if (awarded) {
        await this.prisma.user
          .update({
            where: { id: userId },
            data: { chaptersReadCount: { increment: 1 } },
          })
          .catch(() => {});
      }
    }

    return record;
  }

  async syncMany(userId: string, items: UpsertHistoryDto[]) {
    let synced = 0;
    for (const item of items.slice(0, 30)) {
      const ok = await this.upsert(userId, item)
        .then(() => true)
        .catch(() => false);
      if (ok) synced++;
    }
    return { synced };
  }

  async getUserHistory(userId: string, page = 1, limit = 24) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safeLimit = Math.min(Math.max(1, Math.floor(Number(limit) || 24)), 50);
    const skip = (safePage - 1) * safeLimit;

    const where = {
      userId,
      comic: {
        deletedAt: null,
        approvalStatus: ApprovalStatus.APPROVED,
        status: { not: ComicStatus.DRAFT },
      },
      chapter: { deletedAt: null },
    };

    const [items, total] = await Promise.all([
      this.prisma.readingHistory.findMany({
        where,
        orderBy: { readAt: 'desc' },
        skip,
        take: safeLimit,
        include: {
          comic: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverUrl: true,
              type: true,
              totalChapters: true,
            },
          },
          chapter: {
            select: {
              id: true,
              number: true,
              title: true,
              totalPages: true,
            },
          },
        },
      }),
      this.prisma.readingHistory.count({ where }),
    ]);

    return {
      data: items.map((item) => ({
        ...item,
        chapter: {
          ...item.chapter,
          number: Number(item.chapter.number),
        },
      })),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
        hasNext: skip + safeLimit < total,
      },
    };
  }

  async getComicProgress(userId: string, comicId: string) {
    const latest = await this.prisma.readingHistory.findFirst({
      where: { userId, comicId },
      orderBy: { readAt: 'desc' },
      include: { chapter: { select: { id: true, number: true, title: true } } },
    });
    return latest
      ? { ...latest, chapter: { ...latest.chapter, number: Number(latest.chapter.number) } }
      : null;
  }

  async clearAll(userId: string) {
    await this.prisma.readingHistory.deleteMany({ where: { userId } });
    return { cleared: true };
  }

  async removeItem(userId: string, historyId: string) {
    await this.prisma.readingHistory.deleteMany({ where: { id: historyId, userId } });
    return { deleted: true };
  }
}
