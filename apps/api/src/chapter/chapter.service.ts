import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { CreateChapterDto, UpdateChapterDto } from './dto/chapter.dto';
import { ApprovalStatus, ModerationTargetType } from '@prisma/client';
import { ModerationService } from '../moderation/moderation.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ChapterService {
  private readonly logger = new Logger(ChapterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly moderationService: ModerationService,
  ) {}

  // ── Submit Chapter Review ──

  async submitReview(chapterId: string, userId: string) {
    return this.moderationService.submitForReview(userId, ModerationTargetType.CHAPTER, chapterId);
  }

  // ── Create Chapter ──

  async create(comicId: string, userId: string, dto: CreateChapterDto) {
    const comic = await this.prisma.comic.findUnique({ where: { id: comicId } });
    if (!comic) throw new NotFoundException('Comic not found');
    if (comic.authorId !== userId) throw new ForbiddenException('Not the author');

    const chapter = await this.prisma.chapter.create({
      data: {
        comicId,
        number: new Decimal(dto.number),
        title: dto.title,
        orderIndex: dto.number,
        isPremium: dto.isPremium || false,
        priceCoins: dto.priceCoins || 0,
        approvalStatus: ApprovalStatus.DRAFT,
      },
    });

    // Update comic chapter count
    await this.prisma.comic.update({
      where: { id: comicId },
      data: {
        totalChapters: { increment: 1 },
        lastChapterAt: new Date(),
      },
    });

    // Invalidate cache
    await this.redis.del(`comic:${comic.slug}`);

    this.logger.log(`Chapter ${dto.number} created for comic ${comicId}`);
    return chapter;
  }

  // ── Get All Chapters for a Comic ──

  async findByComic(comicId: string) {
    return this.prisma.chapter.findMany({
      where: { comicId, deletedAt: null },
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        number: true,
        title: true,
        totalPages: true,
        views: true,
        isPremium: true,
        priceCoins: true,
        approvalStatus: true,
        rejectionReason: true,
        publishedAt: true,
        createdAt: true,
      },
    });
  }

  // ── Get Chapter with Pages ──

  async findOne(chapterId: string, userId?: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId, deletedAt: null },
      include: {
        comic: { select: { id: true, title: true, slug: true, authorId: true, approvalStatus: true } },
        pages: {
          orderBy: { pageNumber: 'asc' },
        },
      },
    });

    if (!chapter) throw new NotFoundException('Chapter not found');

    // Check approval status unless the requester is the author or an admin/moderator
    if (chapter.approvalStatus !== ApprovalStatus.APPROVED || chapter.comic.approvalStatus !== ApprovalStatus.APPROVED) {
      let canAccess = false;
      if (userId) {
        if (chapter.comic.authorId === userId) {
          canAccess = true;
        } else {
          const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
          if (user && (user.role === 'ADMIN' || user.role === 'MODERATOR')) {
            canAccess = true;
          }
        }
      }
      if (!canAccess) {
        throw new NotFoundException('Chapter not found or not published');
      }
    }

    // Increment view count (fire and forget)
    this.prisma.chapter.update({
      where: { id: chapterId },
      data: { views: { increment: 1 } },
    }).catch(() => {});

    this.prisma.comic.update({
      where: { id: chapter.comicId },
      data: { totalViews: { increment: 1 } },
    }).catch(() => {});

    return chapter;
  }

  // ── Get Navigation Info (prev/next chapter) ──

  async getNavigation(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { comicId: true, orderIndex: true },
    });

    if (!chapter) throw new NotFoundException('Chapter not found');

    const [prev, next] = await Promise.all([
      this.prisma.chapter.findFirst({
        where: {
          comicId: chapter.comicId,
          orderIndex: { lt: chapter.orderIndex },
          deletedAt: null,
          approvalStatus: ApprovalStatus.APPROVED,
        },
        orderBy: { orderIndex: 'desc' },
        select: { id: true, number: true, title: true },
      }),
      this.prisma.chapter.findFirst({
        where: {
          comicId: chapter.comicId,
          orderIndex: { gt: chapter.orderIndex },
          deletedAt: null,
          approvalStatus: ApprovalStatus.APPROVED,
        },
        orderBy: { orderIndex: 'asc' },
        select: { id: true, number: true, title: true },
      }),
    ]);

    return { prev, next };
  }

  // ── Update Chapter ──

  async update(chapterId: string, userId: string, dto: UpdateChapterDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { comic: { select: { authorId: true, slug: true } } },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    if (chapter.comic.authorId !== userId) throw new ForbiddenException('Not the author');

    const updated = await this.prisma.chapter.update({
      where: { id: chapterId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.isPremium !== undefined && { isPremium: dto.isPremium }),
        ...(dto.priceCoins !== undefined && { priceCoins: dto.priceCoins }),
      },
    });

    await this.redis.del(`comic:${chapter.comic.slug}`);
    return updated;
  }

  // ── Publish Chapter (Submits for review / Auto approves if verified) ──

  async publish(chapterId: string, userId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { comic: { select: { authorId: true, slug: true } } },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    if (chapter.comic.authorId !== userId) throw new ForbiddenException('Not the author');

    return this.moderationService.submitForReview(userId, ModerationTargetType.CHAPTER, chapterId);
  }

  // ── Delete Chapter (soft) ──

  async remove(chapterId: string, userId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { comic: { select: { authorId: true, slug: true } } },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    if (chapter.comic.authorId !== userId) throw new ForbiddenException('Not the author');

    await this.prisma.chapter.update({
      where: { id: chapterId },
      data: { deletedAt: new Date() },
    });

    await this.prisma.comic.update({
      where: { id: chapter.comicId },
      data: { totalChapters: { decrement: 1 } },
    });

    await this.redis.del(`comic:${chapter.comic.slug}`);
  }

  // ── Reorder Pages ──

  async reorderPages(chapterId: string, userId: string, orders: { pageId: string; newOrder: number }[]) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { comic: { select: { authorId: true, slug: true } } },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    if (chapter.comic.authorId !== userId) throw new ForbiddenException('Not the author');

    // Two-phase update to avoid unique constraint [chapterId, pageNumber] conflicts:
    // Phase 1: Set all to negative temporary values
    // Phase 2: Set to correct positive values
    await this.prisma.$transaction([
      // Phase 1: offset to negative temporaries
      ...orders.map((o, i) =>
        this.prisma.page.update({
          where: { id: o.pageId },
          data: { pageNumber: -(i + 1) },
        }),
      ),
      // Phase 2: set correct values
      ...orders.map((o) =>
        this.prisma.page.update({
          where: { id: o.pageId },
          data: { pageNumber: o.newOrder },
        }),
      ),
    ]);

    await this.redis.del(`comic:${chapter.comic.slug}`);
    this.logger.log(`Pages reordered for chapter ${chapterId}`);
  }

  // ── Remove Single Page ──

  async removePage(chapterId: string, pageId: string, userId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { comic: { select: { authorId: true, slug: true } } },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    if (chapter.comic.authorId !== userId) throw new ForbiddenException('Not the author');

    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page || page.chapterId !== chapterId) throw new NotFoundException('Page not found');

    // Delete image from R2 storage
    try {
      const key = this.extractStorageKey(page.imageUrl);
      await this.storage.delete(key);
      this.logger.log(`Deleted R2 object: ${key}`);
    } catch (err) {
      this.logger.warn(`Failed to delete R2 object for page ${pageId}: ${err}`);
    }

    // Delete the page record
    await this.prisma.page.delete({ where: { id: pageId } });

    // Reindex remaining pages
    const remainingPages = await this.prisma.page.findMany({
      where: { chapterId },
      orderBy: { pageNumber: 'asc' },
    });

    await this.prisma.$transaction(
      remainingPages.map((p, i) =>
        this.prisma.page.update({
          where: { id: p.id },
          data: { pageNumber: i + 1 },
        }),
      ),
    );

    // Update chapter page count
    await this.prisma.chapter.update({
      where: { id: chapterId },
      data: { totalPages: remainingPages.length },
    });

    await this.redis.del(`comic:${chapter.comic.slug}`);
    this.logger.log(`Page ${pageId} removed from chapter ${chapterId}`);
  }

  // ── Helper: extract R2 key from public URL ──

  private extractStorageKey(imageUrl: string): string {
    // imageUrl format: https://pub-xxx.r2.dev/pages/chapterId/001.webp
    // We need to extract: pages/chapterId/001.webp
    try {
      const url = new URL(imageUrl);
      return url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    } catch {
      // Fallback: extract last 3 segments (e.g. pages/chapterId/001.webp)
      return imageUrl.split('/').slice(-3).join('/');
    }
  }
}
