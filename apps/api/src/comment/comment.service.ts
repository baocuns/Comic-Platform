import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(userId: string, chapterId: string, content: string, parentId?: string) {
    const comment = await this.prisma.comment.create({
      data: { userId, chapterId, content, parentId },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true, username: true } } },
    });

    // Update comic comment count
    const chapter = await this.prisma.chapter.findUnique({ where: { id: chapterId }, select: { comicId: true, comic: { select: { slug: true, title: true } } } });
    if (chapter) {
      await this.prisma.comic.update({ where: { id: chapter.comicId }, data: { totalComments: { increment: 1 } } });
    }

    // Award XP
    this.gamification.awardComment(userId, comment.id).catch(() => {});

    // Send COMMENT_REPLY notification (if replying to someone else's comment)
    if (parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: parentId },
        select: { userId: true },
      });

      if (parentComment && parentComment.userId !== userId) {
        this.notificationService.createPersonal({
          userId: parentComment.userId,
          type: NotificationType.COMMENT_REPLY,
          title: `${comment.user.displayName} đã trả lời bình luận của bạn`,
          content: content.length > 100 ? content.substring(0, 100) + '...' : content,
          data: {
            commentId: comment.id,
            chapterId,
            comicId: chapter?.comicId,
            comicSlug: chapter?.comic?.slug,
            actorId: userId,
            actorName: comment.user.displayName,
            actorAvatar: comment.user.avatarUrl,
          },
        }).catch(() => {});
      }
    }

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
