import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApprovalStatus, ComicStatus, NotificationType, Prisma, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationService } from '../notification/notification.service';
import { UpsertRatingDto } from './dto/rating.dto';

@Injectable()
export class RatingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gamification: GamificationService,
    private readonly notificationService: NotificationService,
  ) {}

  private readonly userSelect = {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
    level: true,
  };

  async rate(userId: string, comicId: string, dto: UpsertRatingDto) {
    const comic = await this.prisma.comic.findFirst({
      where: {
        id: comicId,
        deletedAt: null,
        approvalStatus: ApprovalStatus.APPROVED,
        status: { not: ComicStatus.DRAFT },
      },
      select: { id: true, slug: true, title: true, authorId: true },
    });
    if (!comic) throw new NotFoundException('Không tìm thấy truyện');

    if (comic.authorId === userId) {
      throw new ForbiddenException('Bạn không thể tự đánh giá tác phẩm của chính mình');
    }

    const { rating, isNew } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.rating.findUnique({
        where: { userId_comicId: { userId, comicId } },
      });

      const saved = existing
        ? await tx.rating.update({
            where: { id: existing.id },
            data: { score: dto.score, review: dto.review?.trim() || null },
            include: { user: { select: this.userSelect } },
          })
        : await tx.rating.create({
            data: { userId, comicId, score: dto.score, review: dto.review?.trim() || null },
            include: { user: { select: this.userSelect } },
          });

      await this.recalculateComicRating(tx, comicId);
      return { rating: saved, isNew: !existing };
    });

    await this.invalidateComicCaches(comic.slug);

    if (isNew) {
      this.gamification.awardRate(userId, comicId).catch(() => {});

      this.notificationService
        .createPersonal({
          userId: comic.authorId,
          actorId: userId,
          type: NotificationType.RATING_RECEIVED,
          title: `${rating.user.displayName} đã đánh giá ${dto.score} sao truyện "${comic.title}"`,
          content: dto.review ? dto.review.slice(0, 100) : undefined,
          actionUrl: `/comics/${comic.slug}`,
          data: { comicId, slug: comic.slug, score: dto.score },
        })
        .catch(() => {});
    }

    return rating;
  }

  async findByComic(comicId: string, page = 1, limit = 10, viewerId?: string) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safeLimit = Math.min(Math.max(1, Math.floor(Number(limit) || 10)), 50);
    const skip = (safePage - 1) * safeLimit;
    const [ratings, total] = await Promise.all([
      this.prisma.rating.findMany({
        where: { comicId },
        orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: safeLimit,
        include: { user: { select: this.userSelect } },
      }),
      this.prisma.rating.count({ where: { comicId } }),
    ]);

    let helpfulSet = new Set<string>();
    if (viewerId && ratings.length > 0) {
      const helpfuls = await this.prisma.ratingHelpful.findMany({
        where: { userId: viewerId, ratingId: { in: ratings.map((r) => r.id) } },
        select: { ratingId: true },
      });
      helpfulSet = new Set(helpfuls.map((h) => h.ratingId));
    }

    return {
      data: ratings.map((r) => ({ ...r, isHelpful: helpfulSet.has(r.id) })),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
        hasNext: skip + safeLimit < total,
      },
    };
  }

  async getUserRating(userId: string, comicId: string) {
    return this.prisma.rating.findUnique({
      where: { userId_comicId: { userId, comicId } },
    });
  }

  async toggleHelpful(ratingId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const [rating] = await tx.$queryRaw<Array<{ id: string; user_id: string }>>`
        SELECT id, user_id FROM ratings WHERE id = ${ratingId}::uuid FOR UPDATE
      `;
      if (!rating) throw new NotFoundException('Không tìm thấy đánh giá');
      if (rating.user_id === userId) {
        throw new ForbiddenException('Bạn không thể tự đánh dấu hữu ích đánh giá của mình');
      }

      const existing = await tx.ratingHelpful.findUnique({
        where: { userId_ratingId: { userId, ratingId } },
      });

      if (existing) {
        await tx.ratingHelpful.delete({ where: { userId_ratingId: { userId, ratingId } } });
      } else {
        await tx.ratingHelpful.create({ data: { userId, ratingId } });
      }

      const helpfulCount = await tx.ratingHelpful.count({ where: { ratingId } });
      await tx.rating.update({
        where: { id: ratingId },
        data: { helpfulCount },
      });

      return { isHelpful: !existing, helpfulCount };
    });
  }

  async remove(ratingId: string, userId: string, role: UserRole) {
    const rating = await this.prisma.rating.findUnique({
      where: { id: ratingId },
      include: { comic: { select: { slug: true } } },
    });
    if (!rating) throw new NotFoundException('Không tìm thấy đánh giá');
    if (rating.userId !== userId && role !== UserRole.ADMIN && role !== UserRole.MODERATOR) {
      throw new ForbiddenException('Bạn không có quyền xóa đánh giá này');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rating.delete({ where: { id: ratingId } });
      await this.recalculateComicRating(tx, rating.comicId);
    });

    await this.invalidateComicCaches(rating.comic.slug);
    return { deleted: true };
  }

  private async recalculateComicRating(tx: Prisma.TransactionClient, comicId: string) {
    const agg = await tx.rating.aggregate({
      where: { comicId },
      _avg: { score: true },
      _count: { score: true },
    });
    await tx.comic.update({
      where: { id: comicId },
      data: {
        avgRating: new Decimal(Number(agg._avg.score || 0).toFixed(2)),
        totalRatings: agg._count.score,
      },
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
