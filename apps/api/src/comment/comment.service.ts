import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, ComicStatus, NotificationType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationService } from '../notification/notification.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

const MAX_STICKERS_PER_COMMENT = 5;

@Injectable()
export class CommentService {
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
    role: true,
  };

  private formatPreview(raw: string, maxLen = 100): string {
    return (raw || '')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[Sticker]')
      .replace(/\[sticker:[^\]]+\]/g, '[Sticker]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLen);
  }

  private assertStickerCap(content: string) {
    const mdStickers = content.match(/!\[[^\]]*\]\([^)]+\)/g)?.length || 0;
    const tagStickers = content.match(/\[sticker:[^\]]+\]/g)?.length || 0;
    if (mdStickers + tagStickers > MAX_STICKERS_PER_COMMENT) {
      throw new BadRequestException(`Tối đa ${MAX_STICKERS_PER_COMMENT} sticker trong mỗi bình luận`);
    }
  }

  private async assertPublicChapterAccess(
    chapterId: string,
    viewerId?: string,
    viewerRole?: UserRole,
  ) {
    const now = new Date();
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true,
        comicId: true,
        number: true,
        deletedAt: true,
        approvalStatus: true,
        scheduledAt: true,
        isPremium: true,
        priceCoins: true,
        comic: {
          select: {
            id: true,
            slug: true,
            title: true,
            authorId: true,
            deletedAt: true,
            approvalStatus: true,
            status: true,
          },
        },
      },
    });

    if (
      !chapter ||
      chapter.deletedAt ||
      chapter.comic.deletedAt ||
      chapter.approvalStatus !== ApprovalStatus.APPROVED ||
      chapter.comic.approvalStatus !== ApprovalStatus.APPROVED ||
      chapter.comic.status === ComicStatus.DRAFT ||
      (chapter.scheduledAt && chapter.scheduledAt > now)
    ) {
      throw new NotFoundException('Không tìm thấy chương truyện');
    }

    const isStaff = viewerRole === UserRole.ADMIN || viewerRole === UserRole.MODERATOR;
    const isAuthor = !!viewerId && chapter.comic.authorId === viewerId;
    if (chapter.isPremium && chapter.priceCoins > 0 && !isAuthor && !isStaff) {
      if (!viewerId) {
        throw new ForbiddenException('Vui lòng mở khóa chương để truy cập bình luận');
      }
      const unlocked = await this.prisma.chapterUnlock.findUnique({
        where: { userId_chapterId: { userId: viewerId, chapterId } },
        select: { id: true },
      });
      if (!unlocked) {
        throw new ForbiddenException('Vui lòng mở khóa chương để truy cập bình luận');
      }
    }

    return chapter;
  }

  async createForComic(userId: string, comicId: string, dto: CreateCommentDto) {
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

    return this.createCommentRecord(userId, comicId, null, comic, dto);
  }

  async createForChapter(
    userId: string,
    role: UserRole,
    chapterId: string,
    dto: CreateCommentDto,
  ) {
    const chapter = await this.assertPublicChapterAccess(chapterId, userId, role);

    return this.createCommentRecord(
      userId,
      chapter.comicId,
      chapter.id,
      chapter.comic,
      dto,
      Number(chapter.number),
    );
  }

  private async createCommentRecord(
    userId: string,
    comicId: string,
    chapterId: string | null,
    comic: { id: string; slug: string; title: string; authorId: string },
    dto: CreateCommentDto,
    chapterNumber?: number,
  ) {
    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Nội dung bình luận không được để trống');
    }
    this.assertStickerCap(content);

    let parentUserId: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: {
          id: true,
          userId: true,
          comicId: true,
          chapterId: true,
          parentId: true,
          deletedAt: true,
        },
      });
      if (!parent || parent.deletedAt) {
        throw new NotFoundException('Bình luận gốc không tồn tại hoặc đã bị xóa');
      }
      if (parent.comicId !== comicId || parent.chapterId !== chapterId) {
        throw new BadRequestException('Bình luận trả lời không thuộc cùng phạm vi');
      }
      if (parent.parentId !== null) {
        throw new BadRequestException('Chỉ hỗ trợ trả lời tối đa 1 cấp');
      }
      parentUserId = parent.userId;
    }

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          userId,
          comicId,
          chapterId,
          parentId: dto.parentId || null,
          content,
          isSpoiler: dto.isSpoiler || false,
        },
        include: {
          user: { select: this.userSelect },
          chapter: { select: { id: true, number: true, title: true } },
        },
      });

      const activeCount = await tx.comment.count({
        where: { comicId, deletedAt: null },
      });
      await tx.comic.update({
        where: { id: comicId },
        data: { totalComments: activeCount },
      });

      return created;
    });

    await this.redis.del(`comic:${comic.slug}`);

    if (comic.authorId !== userId) {
      this.gamification.awardComment(userId, comment.id).catch(() => {});
    }

    const actionUrl = chapterId ? `/read/${chapterId}` : `/comics/${comic.slug}`;

    if (parentUserId) {
      if (parentUserId !== userId) {
        this.notificationService
          .createPersonal({
            userId: parentUserId,
            actorId: userId,
            type: NotificationType.COMMENT_REPLY,
            title: `${comment.user.displayName} đã trả lời bình luận của bạn`,
            content: this.formatPreview(content, 100),
            actionUrl,
            data: { commentId: comment.id, comicId, chapterId },
          })
          .catch(() => {});
      }
    } else if (comic.authorId !== userId) {
      this.notificationService
        .createPersonal({
          userId: comic.authorId,
          actorId: userId,
          type: NotificationType.COMMENT_REPLY,
          title: chapterNumber
            ? `${comment.user.displayName} bình luận ở Chương ${chapterNumber}`
            : `${comment.user.displayName} bình luận trên "${comic.title}"`,
          content: this.formatPreview(content, 100),
          actionUrl,
          data: { commentId: comment.id, comicId, chapterId },
        })
        .catch(() => {});
    }

    return {
      ...comment,
      chapter: comment.chapter ? { ...comment.chapter, number: Number(comment.chapter.number) } : null,
      isLiked: false,
      replies: [],
      _count: { replies: 0 },
    };
  }

  async findByComic(
    comicId: string,
    page = 1,
    limit = 20,
    sort: 'newest' | 'top' = 'newest',
    scope: 'all' | 'comic' | 'chapters' = 'all',
    viewerId?: string,
  ) {
    const comic = await this.prisma.comic.findFirst({
      where: {
        id: comicId,
        deletedAt: null,
        approvalStatus: ApprovalStatus.APPROVED,
        status: { not: ComicStatus.DRAFT },
      },
      select: { id: true },
    });
    if (!comic) {
      throw new NotFoundException('Không tìm thấy truyện');
    }

    const where: Prisma.CommentWhereInput = {
      comicId,
      parentId: null,
      deletedAt: null,
      ...(scope === 'comic' && { chapterId: null }),
      ...(scope === 'chapters' && { chapterId: { not: null } }),
    };

    return this.paginateComments(where, page, limit, sort, viewerId);
  }

  async findByChapter(
    chapterId: string,
    page = 1,
    limit = 20,
    sort: 'newest' | 'top' = 'newest',
    viewerId?: string,
    viewerRole?: UserRole,
  ) {
    await this.assertPublicChapterAccess(chapterId, viewerId, viewerRole);

    const where: Prisma.CommentWhereInput = {
      chapterId,
      parentId: null,
      deletedAt: null,
    };

    return this.paginateComments(where, page, limit, sort, viewerId);
  }

  private async paginateComments(
    where: Prisma.CommentWhereInput,
    page: number,
    limit: number,
    sort: 'newest' | 'top',
    viewerId?: string,
  ) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safeLimit = Math.min(Math.max(1, Math.floor(Number(limit) || 20)), 50);
    const skip = (safePage - 1) * safeLimit;
    const orderBy: Prisma.CommentOrderByWithRelationInput[] =
      sort === 'top'
        ? [{ isPinned: 'desc' }, { likesCount: 'desc' }, { createdAt: 'desc' }]
        : [{ isPinned: 'desc' }, { createdAt: 'desc' }];

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        orderBy,
        skip,
        take: safeLimit,
        include: {
          user: { select: this.userSelect },
          chapter: { select: { id: true, number: true, title: true } },
          replies: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            take: 10,
            include: { user: { select: this.userSelect } },
          },
          _count: { select: { replies: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.comment.count({ where }),
    ]);

    let likedSet = new Set<string>();
    if (viewerId && comments.length > 0) {
      const commentIds = comments.flatMap((c) => [c.id, ...c.replies.map((r) => r.id)]);
      const likes = await this.prisma.commentLike.findMany({
        where: { userId: viewerId, commentId: { in: commentIds } },
        select: { commentId: true },
      });
      likedSet = new Set(likes.map((l) => l.commentId));
    }

    return {
      data: comments.map((c) => ({
        ...c,
        chapter: c.chapter ? { ...c.chapter, number: Number(c.chapter.number) } : null,
        isLiked: likedSet.has(c.id),
        replies: c.replies.map((r) => ({ ...r, isLiked: likedSet.has(r.id) })),
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

  async toggleLike(commentId: string, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<
        Array<{
          id: string;
          user_id: string;
          comic_id: string;
          chapter_id: string | null;
          content: string;
          deleted_at: Date | null;
        }>
      >`
        SELECT id, user_id, comic_id, chapter_id, content, deleted_at
        FROM comments
        WHERE id = ${commentId}::uuid
        FOR UPDATE
      `;
      if (!locked || locked.deleted_at) {
        throw new NotFoundException('Không tìm thấy bình luận');
      }

      const existing = await tx.commentLike.findUnique({
        where: { userId_commentId: { userId, commentId } },
      });

      if (existing) {
        await tx.commentLike.delete({ where: { userId_commentId: { userId, commentId } } });
      } else {
        await tx.commentLike.create({ data: { userId, commentId } });
      }

      const likesCount = await tx.commentLike.count({ where: { commentId } });
      await tx.comment.update({
        where: { id: commentId },
        data: { likesCount },
      });

      const comic = !existing && locked.user_id !== userId
        ? await tx.comic.findUnique({ where: { id: locked.comic_id }, select: { slug: true } })
        : null;

      return {
        liked: !existing,
        likesCount,
        ownerId: locked.user_id,
        chapterId: locked.chapter_id,
        content: locked.content,
        comicSlug: comic?.slug || null,
      };
    });

    if (result.liked && result.ownerId !== userId && result.comicSlug) {
      const dedupeKey = `comment:like-notif:${commentId}:${userId}`;
      const alreadyNotified = await this.redis.exists(dedupeKey);
      if (!alreadyNotified) {
        await this.redis.set(dedupeKey, '1', 3600);
        const liker = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { displayName: true },
        });
        this.notificationService
          .createPersonal({
            userId: result.ownerId,
            actorId: userId,
            type: NotificationType.COMMENT_LIKE,
            title: `${liker?.displayName || 'Ai đó'} đã thích bình luận của bạn`,
            content: this.formatPreview(result.content, 80),
            actionUrl: result.chapterId ? `/read/${result.chapterId}` : `/comics/${result.comicSlug}`,
          })
          .catch(() => {});
      }
    }

    return { liked: result.liked, likesCount: result.likesCount };
  }

  async update(commentId: string, userId: string, role: UserRole, dto: UpdateCommentDto) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { comic: { select: { authorId: true } } },
    });
    if (!comment || comment.deletedAt) throw new NotFoundException('Không tìm thấy bình luận');

    const isOwner = comment.userId === userId;
    const isAuthorOrMod =
      comment.comic.authorId === userId || role === UserRole.ADMIN || role === UserRole.MODERATOR;

    if (dto.isPinned !== undefined && !isAuthorOrMod) {
      throw new ForbiddenException('Chỉ tác giả hoặc quản trị viên mới có thể ghim bình luận');
    }
    if (dto.content !== undefined && !isOwner) {
      throw new ForbiddenException('Chỉ tác giả bình luận mới có thể chỉnh sửa nội dung');
    }
    if (dto.isSpoiler !== undefined && !isOwner && !isAuthorOrMod) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa bình luận này');
    }

    let nextContent: string | undefined;
    if (dto.content !== undefined) {
      nextContent = dto.content.trim();
      if (!nextContent) {
        throw new BadRequestException('Nội dung bình luận không được để trống');
      }
      this.assertStickerCap(nextContent);
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: {
        ...(nextContent !== undefined && { content: nextContent }),
        ...(dto.isSpoiler !== undefined && { isSpoiler: dto.isSpoiler }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
      },
      include: { user: { select: this.userSelect } },
    });
  }

  async remove(commentId: string, userId: string, role: UserRole) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { comic: { select: { authorId: true, slug: true } } },
    });
    if (!comment || comment.deletedAt) throw new NotFoundException('Không tìm thấy bình luận');

    const canDelete =
      comment.userId === userId ||
      comment.comic.authorId === userId ||
      role === UserRole.ADMIN ||
      role === UserRole.MODERATOR;

    if (!canDelete) {
      throw new ForbiddenException('Bạn không có quyền xóa bình luận này');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id: commentId },
        data: { deletedAt: now },
      });
      await tx.comment.updateMany({
        where: { parentId: commentId, deletedAt: null },
        data: { deletedAt: now },
      });

      const activeCount = await tx.comment.count({
        where: { comicId: comment.comicId, deletedAt: null },
      });
      await tx.comic.update({
        where: { id: comment.comicId },
        data: { totalComments: activeCount },
      });
    });

    await this.redis.del(`comic:${comment.comic.slug}`);
    return { deleted: true };
  }
}
