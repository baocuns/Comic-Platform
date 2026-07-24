import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async create(userId: string, chapterId: string, content: string, parentId?: string) {
    const comment = await this.prisma.comment.create({
      data: { userId, chapterId, content, parentId },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true, username: true } } },
    });

    // Update comic comment count
    const chapter = await this.prisma.chapter.findUnique({ where: { id: chapterId }, select: { comicId: true } });
    if (chapter) {
      await this.prisma.comic.update({ where: { id: chapter.comicId }, data: { totalComments: { increment: 1 } } });
    }

    // Award XP
    this.gamification.awardComment(userId, comment.id).catch(() => {});

    return comment;
  }

  async findByChapter(chapterId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { chapterId, parentId: null, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
          replies: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            take: 3,
            include: { user: { select: { id: true, displayName: true, avatarUrl: true, username: true } } },
          },
          _count: { select: { replies: true } },
        },
      }),
      this.prisma.comment.count({ where: { chapterId, parentId: null, deletedAt: null } }),
    ]);

    return { data: comments, meta: { page, limit, total, hasNext: skip + limit < total } };
  }

  async findByComic(comicId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const chapterIds = await this.prisma.chapter.findMany({
      where: { comicId },
      select: { id: true },
    });
    const ids = chapterIds.map((c) => c.id);

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { chapterId: { in: ids }, parentId: null, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
          chapter: { select: { number: true, title: true } },
          replies: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            take: 3,
            include: { user: { select: { id: true, displayName: true, avatarUrl: true, username: true } } },
          },
          _count: { select: { replies: true } },
        },
      }),
      this.prisma.comment.count({ where: { chapterId: { in: ids }, parentId: null, deletedAt: null } }),
    ]);

    return { data: comments, meta: { page, limit, total, hasNext: skip + limit < total } };
  }

  async remove(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException('Not the author');

    await this.prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  }
}
