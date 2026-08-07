import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class RatingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
    private readonly notificationService: NotificationService,
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

      // Send RATING_RECEIVED notification to comic author
      const comic = await this.prisma.comic.findUnique({
        where: { id: comicId },
        select: { authorId: true, title: true, slug: true },
      });

      if (comic && comic.authorId !== userId) {
        this.notificationService.createPersonal({
          userId: comic.authorId,
          type: NotificationType.RATING_RECEIVED,
          title: `${rating.user.displayName} đã đánh giá ${score}⭐ truyện của bạn`,
          content: review ? (review.length > 100 ? review.substring(0, 100) + '...' : review) : undefined,
          data: {
            comicId,
            comicSlug: comic.slug,
            comicTitle: comic.title,
            score,
            actorId: userId,
            actorName: rating.user.displayName,
            actorAvatar: rating.user.avatarUrl,
          },
        }).catch(() => {});
      }
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
