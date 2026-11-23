import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  ModerationTargetType,
  NewsCategory,
  NotificationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import slugify from 'slugify';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationService } from '../notification/notification.service';
import { CreateNewsCommentDto, CreateNewsDto, NewsQueryDto, UpdateNewsDto } from './dto/news.dto';

const RESERVED_NEWS_SLUGS = new Set(['create', 'new', 'manage', 'edit', 'studio']);

@Injectable()
export class NewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly moderationService: ModerationService,
    private readonly notificationService: NotificationService,
  ) {}

  private readonly authorSelect = {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
    level: true,
    role: true,
  };

  private readonly publicListSelect = {
    id: true,
    authorId: true,
    title: true,
    slug: true,
    excerpt: true,
    coverUrl: true,
    category: true,
    tags: true,
    readTimeMinutes: true,
    viewCount: true,
    likesCount: true,
    commentsCount: true,
    isPinned: true,
    isPublished: true,
    approvalStatus: true,
    publishedAt: true,
    createdAt: true,
    updatedAt: true,
    author: { select: this.authorSelect },
  };

  private computeReadTime(content: string): number {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }

  private async ensureUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title, { lower: true, strict: true, locale: 'vi' }) || 'tin-tuc';
    let counter = 1;
    let slug = RESERVED_NEWS_SLUGS.has(base) ? `${base}-${counter++}` : base;
    while (true) {
      if (!RESERVED_NEWS_SLUGS.has(slug)) {
        const existing = await this.prisma.newsArticle.findUnique({ where: { slug } });
        if (!existing || (excludeId && existing.id === excludeId)) {
          return slug;
        }
      }
      slug = `${base}-${counter++}`;
    }
  }

  async create(userId: string, dto: CreateNewsDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isVerified: true, isTrusted: true, role: true },
    });
    const isStaff = user?.role === UserRole.ADMIN || user?.role === UserRole.MODERATOR;

    if ((dto.isPinned || dto.category === NewsCategory.FEATURED) && !isStaff) {
      throw new ForbiddenException('Chỉ quản trị viên hoặc kiểm duyệt viên mới có thể ghim hoặc gắn nhãn Nổi bật');
    }

    const slug = await this.ensureUniqueSlug(dto.title);
    const isAutoApproved = (user?.isTrusted === true && user?.isVerified === true) || isStaff;

    let approvalStatus: ApprovalStatus = ApprovalStatus.DRAFT;
    let isPublished = false;
    if (dto.isPublished) {
      approvalStatus = isAutoApproved ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING_APPROVAL;
      isPublished = isAutoApproved;
    }

    return this.prisma.newsArticle.create({
      data: {
        authorId: userId,
        title: dto.title.trim(),
        slug,
        excerpt: dto.excerpt?.trim() || null,
        content: dto.content,
        coverUrl: dto.coverUrl || null,
        category: dto.category,
        tags: dto.tags || [],
        readTimeMinutes: this.computeReadTime(dto.content),
        isPinned: isStaff ? Boolean(dto.isPinned) : false,
        approvalStatus,
        isPublished,
        publishedAt: isPublished ? new Date() : null,
      },
      include: { author: { select: this.authorSelect } },
    });
  }

  async findByIdForStudio(id: string, userId: string, role: UserRole) {
    const article = await this.prisma.newsArticle.findUnique({
      where: { id },
      include: { author: { select: this.authorSelect } },
    });
    if (!article || article.deletedAt) throw new NotFoundException('Không tìm thấy bài viết');
    if (article.authorId !== userId && role !== UserRole.ADMIN && role !== UserRole.MODERATOR) {
      throw new ForbiddenException('Bạn không có quyền xem bài viết này');
    }
    return article;
  }

  async update(id: string, userId: string, role: UserRole, dto: UpdateNewsDto) {
    const article = await this.prisma.newsArticle.findUnique({ where: { id } });
    if (!article || article.deletedAt) throw new NotFoundException('Không tìm thấy bài viết');
    if (article.authorId !== userId && role !== UserRole.ADMIN && role !== UserRole.MODERATOR) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa bài viết này');
    }

    const isStaff = role === UserRole.ADMIN || role === UserRole.MODERATOR;
    if (
      (dto.isPinned === true ||
        (dto.isPinned !== undefined && dto.isPinned !== article.isPinned) ||
        dto.category === NewsCategory.FEATURED) &&
      !isStaff
    ) {
      throw new ForbiddenException('Chỉ quản trị viên hoặc kiểm duyệt viên mới có thể ghim hoặc gắn nhãn Nổi bật');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isVerified: true, isTrusted: true, role: true },
    });
    const isAutoApproved = (user?.isTrusted === true && user?.isVerified === true) || isStaff;

    const data: Prisma.NewsArticleUpdateInput = {};
    if (dto.title !== undefined && dto.title.trim() !== article.title) {
      data.title = dto.title.trim();
      data.slug = await this.ensureUniqueSlug(dto.title.trim(), id);
    }
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt || null;
    if (dto.content !== undefined) {
      data.content = dto.content;
      data.readTimeMinutes = this.computeReadTime(dto.content);
    }
    if (dto.coverUrl !== undefined) data.coverUrl = dto.coverUrl || null;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.isPinned !== undefined && isStaff) data.isPinned = dto.isPinned;

    let shouldLogStaffApprove = false;
    if (dto.isPublished !== undefined) {
      if (dto.isPublished) {
        data.approvalStatus = isAutoApproved ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING_APPROVAL;
        data.isPublished = isAutoApproved;
        if (isAutoApproved) {
          data.publishedAt = article.publishedAt || new Date();
          if (
            isStaff &&
            article.authorId !== userId &&
            article.approvalStatus !== ApprovalStatus.APPROVED
          ) {
            shouldLogStaffApprove = true;
          }
        }
      } else {
        data.isPublished = false;
      }
    }

    const substantiveModified =
      (dto.title !== undefined && dto.title.trim() !== article.title) ||
      (dto.content !== undefined && dto.content !== article.content) ||
      (dto.coverUrl !== undefined && (dto.coverUrl || null) !== article.coverUrl);

    if (!isAutoApproved && article.approvalStatus === ApprovalStatus.APPROVED && substantiveModified) {
      data.approvalStatus = ApprovalStatus.PENDING_APPROVAL;
      data.isPublished = false;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.newsArticle.update({
        where: { id },
        data,
        include: { author: { select: this.authorSelect } },
      });

      if (shouldLogStaffApprove) {
        await tx.moderationLog.create({
          data: {
            targetType: ModerationTargetType.NEWS,
            targetId: id,
            targetTitle: updated.title,
            action: ApprovalStatus.APPROVED,
            reason: 'Xuất bản trực tiếp từ trang chỉnh sửa',
            moderatorId: userId,
          },
        });
      }

      return updated;
    });
  }

  async publish(id: string, userId: string, role: UserRole) {
    const article = await this.prisma.newsArticle.findUnique({ where: { id } });
    if (!article || article.deletedAt) throw new NotFoundException('Không tìm thấy bài viết');
    if (article.authorId !== userId && role !== UserRole.ADMIN && role !== UserRole.MODERATOR) {
      throw new ForbiddenException('Bạn không có quyền thao tác bài viết này');
    }

    if (article.isPublished) {
      return this.prisma.newsArticle.update({
        where: { id },
        data: { isPublished: false },
        include: { author: { select: this.authorSelect } },
      });
    }

    return this.moderationService.submitForReview(userId, ModerationTargetType.NEWS, id);
  }

  async remove(id: string, userId: string, role: UserRole) {
    const article = await this.prisma.newsArticle.findUnique({ where: { id } });
    if (!article || article.deletedAt) throw new NotFoundException('Không tìm thấy bài viết');
    if (article.authorId !== userId && role !== UserRole.ADMIN && role !== UserRole.MODERATOR) {
      throw new ForbiddenException('Bạn không có quyền xóa bài viết này');
    }

    await this.prisma.newsArticle.update({
      where: { id },
      data: { deletedAt: new Date(), isPublished: false },
    });
    return { deleted: true };
  }

  async findAll(query: NewsQueryDto) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(Math.max(1, Math.floor(Number(query.limit) || 12)), 50);
    const skip = (page - 1) * limit;

    const where: Prisma.NewsArticleWhereInput = {
      isPublished: true,
      approvalStatus: ApprovalStatus.APPROVED,
      deletedAt: null,
      ...(query.category && { category: query.category }),
      ...(query.tag && { tags: { has: query.tag } }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { excerpt: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [articles, total] = await Promise.all([
      this.prisma.newsArticle.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        skip,
        take: limit,
        select: this.publicListSelect,
      }),
      this.prisma.newsArticle.count({ where }),
    ]);

    return {
      data: articles,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
      },
    };
  }

  async findStudioNews(query: NewsQueryDto, userId: string, role: UserRole) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(Math.max(1, Math.floor(Number(query.limit) || 12)), 50);
    const skip = (page - 1) * limit;

    const where: Prisma.NewsArticleWhereInput = {
      deletedAt: null,
      ...(role === UserRole.AUTHOR && { authorId: userId }),
      ...(query.status === 'published' && { isPublished: true }),
      ...(query.status === 'draft' && { isPublished: false }),
      ...(query.status === 'pinned' && { isPinned: true }),
      ...(query.category && { category: query.category }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { excerpt: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [articles, total] = await Promise.all([
      this.prisma.newsArticle.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: { author: { select: this.authorSelect } },
      }),
      this.prisma.newsArticle.count({ where }),
    ]);

    return {
      data: articles,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
      },
    };
  }

  async findFeatured() {
    const baseWhere: Prisma.NewsArticleWhereInput = {
      isPublished: true,
      approvalStatus: ApprovalStatus.APPROVED,
      deletedAt: null,
    };

    const featured = await this.prisma.newsArticle.findFirst({
      where: baseWhere,
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      select: this.publicListSelect,
    });

    const latest = await this.prisma.newsArticle.findMany({
      where: {
        ...baseWhere,
        ...(featured && { id: { not: featured.id } }),
      },
      orderBy: { publishedAt: 'desc' },
      take: 4,
      select: this.publicListSelect,
    });

    return { featured, latest };
  }

  async findBySlug(slug: string, userId?: string, viewerIp?: string) {
    const article = await this.prisma.newsArticle.findUnique({
      where: { slug },
      include: { author: { select: this.authorSelect } },
    });
    if (!article || article.deletedAt) throw new NotFoundException('Không tìm thấy bài viết');

    const isPubliclyVisible = article.isPublished && article.approvalStatus === ApprovalStatus.APPROVED;
    let isStaffOrAuthor = false;
    if (userId) {
      if (article.authorId === userId) isStaffOrAuthor = true;
      else {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (user && (user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR)) {
          isStaffOrAuthor = true;
        }
      }
    }

    if (!isPubliclyVisible && !isStaffOrAuthor) {
      throw new NotFoundException('Bài viết chưa được xuất bản');
    }

    if (isPubliclyVisible) {
      const viewerKey = userId || viewerIp || 'anon';
      const throttleKey = `news:view:${article.id}:${viewerKey}`;
      const alreadyViewed = await this.redis.exists(throttleKey);
      if (!alreadyViewed) {
        await this.redis.set(throttleKey, '1', 900);
        await this.prisma.newsArticle
          .update({
            where: { id: article.id },
            data: { viewCount: { increment: 1 } },
          })
          .catch(() => {});
      }
    }

    let isLiked = false;
    if (userId) {
      const like = await this.prisma.newsLike.findUnique({
        where: { userId_articleId: { userId, articleId: article.id } },
      });
      isLiked = !!like;
    }

    const { rejectionReason, ...publicArticle } = article;
    return {
      ...(isStaffOrAuthor ? { ...publicArticle, rejectionReason } : publicArticle),
      isLiked,
    };
  }

  async findRelated(slug: string) {
    const article = await this.prisma.newsArticle.findFirst({
      where: {
        slug,
        isPublished: true,
        approvalStatus: ApprovalStatus.APPROVED,
        deletedAt: null,
      },
      select: { id: true, category: true },
    });
    if (!article) return [];

    return this.prisma.newsArticle.findMany({
      where: {
        isPublished: true,
        approvalStatus: ApprovalStatus.APPROVED,
        deletedAt: null,
        id: { not: article.id },
        category: article.category,
      },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      select: this.publicListSelect,
    });
  }

  async toggleLike(userId: string, articleId: string) {
    const article = await this.prisma.newsArticle.findFirst({
      where: {
        id: articleId,
        deletedAt: null,
        isPublished: true,
        approvalStatus: ApprovalStatus.APPROVED,
      },
      select: { id: true, authorId: true, title: true, slug: true },
    });
    if (!article) throw new NotFoundException('Không tìm thấy bài viết');

    const { liked, likesCount } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM news_articles WHERE id = ${articleId}::uuid FOR UPDATE`;

      const existing = await tx.newsLike.findUnique({
        where: { userId_articleId: { userId, articleId } },
      });

      if (existing) {
        await tx.newsLike.delete({ where: { id: existing.id } });
      } else {
        await tx.newsLike.create({ data: { userId, articleId } });
      }

      const count = await tx.newsLike.count({ where: { articleId } });
      await tx.newsArticle.update({ where: { id: articleId }, data: { likesCount: count } });
      return { liked: !existing, likesCount: count };
    });

    if (liked && article.authorId !== userId) {
      const dedupeKey = `news:like-notif:${articleId}:${userId}`;
      const alreadyNotified = await this.redis.exists(dedupeKey);
      if (!alreadyNotified) {
        await this.redis.set(dedupeKey, '1', 3600);
        const liker = await this.prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
        this.notificationService
          .createPersonal({
            userId: article.authorId,
            actorId: userId,
            type: NotificationType.NEWS_LIKE,
            title: `${liker?.displayName || 'Độc giả'} đã thích bài viết của bạn`,
            content: article.title,
            actionUrl: `/news/${article.slug}`,
          })
          .catch(() => {});
      }
    }

    return { liked, likesCount };
  }

  async getComments(articleId: string, page = 1, limit = 20) {
    const article = await this.prisma.newsArticle.findFirst({
      where: {
        id: articleId,
        deletedAt: null,
        isPublished: true,
        approvalStatus: ApprovalStatus.APPROVED,
      },
      select: { id: true },
    });
    if (!article) throw new NotFoundException('Không tìm thấy bài viết');

    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safeLimit = Math.min(Math.max(1, Math.floor(Number(limit) || 20)), 50);
    const skip = (safePage - 1) * safeLimit;
    const [comments, total] = await Promise.all([
      this.prisma.newsComment.findMany({
        where: { articleId, parentId: null, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
        include: {
          user: { select: this.authorSelect },
          replies: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            take: 10,
            include: { user: { select: this.authorSelect } },
          },
          _count: { select: { replies: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.newsComment.count({ where: { articleId, parentId: null, deletedAt: null } }),
    ]);

    return {
      data: comments,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
        hasNext: skip + safeLimit < total,
      },
    };
  }

  async createComment(userId: string, articleId: string, dto: CreateNewsCommentDto) {
    const article = await this.prisma.newsArticle.findFirst({
      where: {
        id: articleId,
        deletedAt: null,
        isPublished: true,
        approvalStatus: ApprovalStatus.APPROVED,
      },
      select: { id: true, authorId: true, title: true, slug: true },
    });
    if (!article) throw new NotFoundException('Không tìm thấy bài viết');

    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Nội dung bình luận không được để trống');
    }

    if (dto.parentId) {
      const parent = await this.prisma.newsComment.findUnique({
        where: { id: dto.parentId },
        select: { id: true, articleId: true, parentId: true, deletedAt: true },
      });
      if (!parent || parent.deletedAt) {
        throw new NotFoundException('Bình luận gốc không tồn tại hoặc đã bị xóa');
      }
      if (parent.articleId !== articleId) {
        throw new BadRequestException('Bình luận trả lời không thuộc bài viết này');
      }
      if (parent.parentId !== null) {
        throw new BadRequestException('Chỉ hỗ trợ trả lời tối đa 1 cấp');
      }
    }

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.newsComment.create({
        data: {
          userId,
          articleId,
          content,
          parentId: dto.parentId || null,
        },
        include: { user: { select: this.authorSelect } },
      });

      const commentsCount = await tx.newsComment.count({
        where: { articleId, deletedAt: null },
      });
      await tx.newsArticle.update({ where: { id: articleId }, data: { commentsCount } });
      return created;
    });

    if (article.authorId !== userId) {
      this.notificationService
        .createPersonal({
          userId: article.authorId,
          actorId: userId,
          type: NotificationType.NEWS_COMMENT,
          title: `${comment.user.displayName} đã bình luận trên "${article.title}"`,
          content: content
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[Sticker]')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 100),
          actionUrl: `/news/${article.slug}`,
        })
        .catch(() => {});
    }

    return { ...comment, replies: [], _count: { replies: 0 } };
  }

  async deleteComment(commentId: string, userId: string, role: UserRole) {
    const comment = await this.prisma.newsComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) throw new NotFoundException('Không tìm thấy bình luận');
    if (comment.userId !== userId && role !== UserRole.ADMIN && role !== UserRole.MODERATOR) {
      throw new ForbiddenException('Bạn không có quyền xóa bình luận này');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.newsComment.update({
        where: { id: commentId },
        data: { deletedAt: now },
      });
      await tx.newsComment.updateMany({
        where: { parentId: commentId, deletedAt: null },
        data: { deletedAt: now },
      });

      const commentsCount = await tx.newsComment.count({
        where: { articleId: comment.articleId, deletedAt: null },
      });
      await tx.newsArticle.update({
        where: { id: comment.articleId },
        data: { commentsCount },
      });
    });

    return { deleted: true };
  }
}
