import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateChapterDto, UpdateChapterDto } from './dto/chapter.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ChapterService {
  private readonly logger = new Logger(ChapterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

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
        publishedAt: true,
        createdAt: true,
      },
    });
  }

  // ── Get Chapter with Pages ──

  async findOne(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId, deletedAt: null },
      include: {
        comic: { select: { id: true, title: true, slug: true, authorId: true } },
        pages: {
          orderBy: { pageNumber: 'asc' },
        },
      },
    });

    if (!chapter) throw new NotFoundException('Chapter not found');

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
        where: { comicId: chapter.comicId, orderIndex: { lt: chapter.orderIndex }, deletedAt: null },
        orderBy: { orderIndex: 'desc' },
        select: { id: true, number: true, title: true },
      }),
      this.prisma.chapter.findFirst({
        where: { comicId: chapter.comicId, orderIndex: { gt: chapter.orderIndex }, deletedAt: null },
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

  // ── Publish Chapter ──

  async publish(chapterId: string, userId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { comic: { select: { authorId: true, slug: true } } },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    if (chapter.comic.authorId !== userId) throw new ForbiddenException('Not the author');

    const updated = await this.prisma.chapter.update({
      where: { id: chapterId },
      data: { publishedAt: new Date() },
    });

    await this.redis.del(`comic:${chapter.comic.slug}`);
    return updated;
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
}
