import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNewsDto, UpdateNewsDto, NewsQueryDto } from './dto/news.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private async ensureUniqueSlug(slug: string): Promise<string> {
    let uniqueSlug = slug;
    let counter = 0;
    while (await this.prisma.newsArticle.findUnique({ where: { slug: uniqueSlug } })) {
      counter++;
      uniqueSlug = `${slug}-${counter}`;
    }
    return uniqueSlug;
  }

  async create(userId: string, dto: CreateNewsDto) {
    const slug = await this.ensureUniqueSlug(this.generateSlug(dto.title));
    const isPublished = dto.isPublished !== undefined ? dto.isPublished : false;

    const article = await this.prisma.newsArticle.create({
      data: {
        authorId: userId,
        title: dto.title,
        slug,
        excerpt: dto.excerpt,
        content: dto.content,
        coverUrl: dto.coverUrl,
        category: dto.category,
        tags: dto.tags || [],
        isPinned: dto.isPinned || false,
        isPublished,
        publishedAt: isPublished ? new Date() : null,
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
      },
    });

    return article;
  }

  private async checkOwnershipOrAdmin(articleAuthorId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) throw new ForbiddenException('User not found');
    if (user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR) return;
    if (articleAuthorId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this article');
    }
  }

  async findById(id: string, userId: string) {
    const article = await this.prisma.newsArticle.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
      },
    });
    if (!article || article.deletedAt) throw new NotFoundException('Article not found');
    await this.checkOwnershipOrAdmin(article.authorId, userId);
    return article;
  }

  async update(id: string, userId: string, dto: UpdateNewsDto) {
    const article = await this.prisma.newsArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    await this.checkOwnershipOrAdmin(article.authorId, userId);

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) {
      data.title = dto.title;
      data.slug = await this.ensureUniqueSlug(this.generateSlug(dto.title));
    }
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.coverUrl !== undefined) data.coverUrl = dto.coverUrl;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.isPinned !== undefined) data.isPinned = dto.isPinned;
    if (dto.isPublished !== undefined) {
      data.isPublished = dto.isPublished;
      data.publishedAt = dto.isPublished ? (article.publishedAt || new Date()) : null;
    }

    return this.prisma.newsArticle.update({
      where: { id },
      data,
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
      },
    });
  }

  async publish(id: string, userId: string) {
    const article = await this.prisma.newsArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    await this.checkOwnershipOrAdmin(article.authorId, userId);

    return this.prisma.newsArticle.update({
      where: { id },
      data: {
        isPublished: !article.isPublished,
        publishedAt: article.isPublished ? null : new Date(),
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
      },
    });
  }

  async remove(id: string, userId: string) {
    const article = await this.prisma.newsArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    await this.checkOwnershipOrAdmin(article.authorId, userId);

    await this.prisma.newsArticle.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findAll(query: NewsQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 12, 50);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      isPublished: true,
      deletedAt: null,
    };

    if (query.category) where.category = query.category;
    if (query.tag) where.tags = { has: query.tag };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { excerpt: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [articles, total] = await Promise.all([
      this.prisma.newsArticle.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        skip,
        take: limit,
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
        },
      }),
      this.prisma.newsArticle.count({ where }),
    ]);

    return {
      data: articles,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: skip + limit < total },
    };
  }

  async findStudioNews(query: NewsQueryDto, user: { sub: string; role: UserRole }) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 12, 50);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    // AUTHOR role only sees their own articles! MODERATOR/ADMIN can see all (or filter by authorId)
    if (user.role === UserRole.AUTHOR) {
      where.authorId = user.sub;
    } else if (query.authorId) {
      where.authorId = query.authorId;
    }

    if (query.status === 'published') where.isPublished = true;
    else if (query.status === 'draft') where.isPublished = false;
    else if (query.status === 'pinned') where.isPinned = true;

    if (query.category) where.category = query.category;
    if (query.tag) where.tags = { has: query.tag };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { excerpt: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [articles, total] = await Promise.all([
      this.prisma.newsArticle.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
        },
      }),
      this.prisma.newsArticle.count({ where }),
    ]);

    return {
      data: articles,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: skip + limit < total },
    };
  }

  async findBySlug(slug: string, userId?: string) {
    const article = await this.prisma.newsArticle.findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
        _count: { select: { comments: true, likes: true } },
      },
    });

    if (!article || article.deletedAt) throw new NotFoundException('Article not found');
    if (!article.isPublished) throw new NotFoundException('Article not found');

    // Increment view count
    await this.prisma.newsArticle.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    });

    // Check if user has liked this article
    let isLiked = false;
    if (userId) {
      const like = await this.prisma.newsLike.findUnique({
        where: { userId_articleId: { userId, articleId: article.id } },
      });
      isLiked = !!like;
    }

    return { ...article, isLiked };
  }

  async findFeatured() {
    // Get pinned article or the latest one as the featured
    const featured = await this.prisma.newsArticle.findFirst({
      where: { isPublished: true, deletedAt: null },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
      },
    });

    // Get 4 latest articles excluding the featured
    const latest = await this.prisma.newsArticle.findMany({
      where: {
        isPublished: true,
        deletedAt: null,
        ...(featured ? { id: { not: featured.id } } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      take: 4,
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
      },
    });

    return { featured, latest };
  }

  async findRelated(slug: string) {
    const article = await this.prisma.newsArticle.findUnique({ where: { slug } });
    if (!article) return [];

    return this.prisma.newsArticle.findMany({
      where: {
        isPublished: true,
        deletedAt: null,
        id: { not: article.id },
        category: article.category,
      },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
      },
    });
  }

  // ── Comments ──

  async getComments(articleId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [comments, total] = await Promise.all([
      this.prisma.newsComment.findMany({
        where: { articleId, parentId: null, deletedAt: null },
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
      this.prisma.newsComment.count({ where: { articleId, parentId: null, deletedAt: null } }),
    ]);

    return { data: comments, meta: { page, limit, total, hasNext: skip + limit < total } };
  }

  async createComment(userId: string, articleId: string, content: string, parentId?: string) {
    const article = await this.prisma.newsArticle.findUnique({ where: { id: articleId } });
    if (!article || article.deletedAt) throw new NotFoundException('Article not found');

    const comment = await this.prisma.newsComment.create({
      data: { userId, articleId, content, parentId },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true, username: true } } },
    });

    // Update comment count
    await this.prisma.newsArticle.update({
      where: { id: articleId },
      data: { commentsCount: { increment: 1 } },
    });

    return comment;
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.prisma.newsComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException('Not the author');

    await this.prisma.newsComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }

  // ── Likes ──

  async toggleLike(userId: string, articleId: string) {
    const article = await this.prisma.newsArticle.findUnique({ where: { id: articleId } });
    if (!article || article.deletedAt) throw new NotFoundException('Article not found');

    const existing = await this.prisma.newsLike.findUnique({
      where: { userId_articleId: { userId, articleId } },
    });

    if (existing) {
      await this.prisma.newsLike.delete({ where: { id: existing.id } });
      await this.prisma.newsArticle.update({
        where: { id: articleId },
        data: { likesCount: { decrement: 1 } },
      });
      return { liked: false };
    } else {
      await this.prisma.newsLike.create({ data: { userId, articleId } });
      await this.prisma.newsArticle.update({
        where: { id: articleId },
        data: { likesCount: { increment: 1 } },
      });
      return { liked: true };
    }
  }
}
