import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class RatingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async rate(userId: string, comicId: string, score: number, review?: string) {
    const existing = await this.prisma.rating.findUnique({
      where: { userId_comicId: { userId, comicId } },
    });

    let rating;
    const isFirstRating = !existing;

    if (existing) {
      rating = await this.prisma.rating.update({
        where: { id: existing.id },
        data: { score, review },
        include: { user: { select: { id: true, displayName: true, avatarUrl: true, username: true } } },
      });
    } else {
      rating = await this.prisma.rating.create({
        data: { userId, comicId, score, review },
        include: { user: { select: { id: true, displayName: true, avatarUrl: true, username: true } } },
      });

      await this.prisma.comic.update({
        where: { id: comicId },
        data: { totalRatings: { increment: 1 } },
      });
    }

    // Recalculate average
    const agg = await this.prisma.rating.aggregate({
      where: { comicId },
      _avg: { score: true },
    });

    await this.prisma.comic.update({
      where: { id: comicId },
      data: { avgRating: new Decimal(agg._avg.score || 0) },
    });

    // Award XP on first rating only
    if (isFirstRating) {
      this.gamification.awardRate(userId, comicId).catch(() => {});
    }

    return rating;
  }

  async findByComic(comicId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [ratings, total] = await Promise.all([
      this.prisma.rating.findMany({
        where: { comicId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, displayName: true, avatarUrl: true, username: true } } },
      }),
      this.prisma.rating.count({ where: { comicId } }),
    ]);
    return { data: ratings, meta: { page, limit, total, hasNext: skip + limit < total } };
  }

  async getUserRating(userId: string, comicId: string) {
    return this.prisma.rating.findUnique({
      where: { userId_comicId: { userId, comicId } },
    });
  }
}
