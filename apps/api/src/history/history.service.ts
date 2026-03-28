import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(userId: string, comicId: string, chapterId: string, lastPage: number) {
    return this.prisma.readingHistory.upsert({
      where: { userId_chapterId: { userId, chapterId } },
      update: { lastPage, readAt: new Date() },
      create: { userId, comicId, chapterId, lastPage },
    });
  }

  async getUserHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.readingHistory.findMany({
        where: { userId },
        orderBy: { readAt: 'desc' },
        skip,
        take: limit,
        include: {
          chapter: {
            select: {
              id: true, number: true, title: true, totalPages: true,
              comic: { select: { id: true, title: true, slug: true, coverUrl: true } },
            },
          },
        },
      }),
      this.prisma.readingHistory.count({ where: { userId } }),
    ]);
    return { data: items, meta: { page, limit, total, hasNext: skip + limit < total } };
  }

  async getProgress(userId: string, comicId: string) {
    return this.prisma.readingHistory.findMany({
      where: { userId, comicId },
      orderBy: { readAt: 'desc' },
      take: 1,
      include: { chapter: { select: { id: true, number: true, title: true } } },
    });
  }
}
