import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UpdateProfileDto, UpdateBannerPositionDto } from './dto/user.dto';

interface BannerData {
  url?: string;
  position?: number;
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Profile ──

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.socialLinks !== undefined && { socialLinks: dto.socialLinks }),
      },
    });

    return this.sanitizeUser(updated);
  }

  async getPublicProfile(username: string, viewerId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');

    const queries: Promise<any>[] = [
      this.getStatsById(user.id),
      this.prisma.follow.count({ where: { followingId: user.id } }),
      this.prisma.follow.count({ where: { followerId: user.id } }),
      viewerId
        ? this.prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
          })
        : Promise.resolve(null),
    ];

    // If the user is an AUTHOR, also fetch their published comics
    const isAuthor = user.role === 'AUTHOR' || user.role === 'ADMIN';
    if (isAuthor) {
      queries.push(
        this.prisma.comic.findMany({
          where: { authorId: user.id, deletedAt: null, status: { not: 'DRAFT' } },
          select: {
            id: true,
            title: true,
            slug: true,
            coverUrl: true,
            status: true,
            totalChapters: true,
            totalViews: true,
            avgRating: true,
            lastChapterAt: true,
          },
          orderBy: { lastChapterAt: 'desc' },
        }),
      );
    }

    const results = await Promise.all(queries);
    const [stats, followerCount, followingCount, isFollowing] = results;

    return {
      user: this.sanitizePublicUser(user),
      stats: { ...stats, followerCount, followingCount },
      isFollowing: !!isFollowing,
      isOwnProfile: viewerId === user.id,
      ...(isAuthor && { authorComics: results[4] || [] }),
    };
  }

  // ── Banner ──

  async updateBannerPosition(userId: string, dto: UpdateBannerPositionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const banner = (user.banner as BannerData) || {};
    if (!banner.url) throw new BadRequestException('No banner to reposition');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { banner: { ...banner, position: dto.position } },
    });

    return this.sanitizeUser(updated);
  }

  async removeBanner(userId: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { banner: Prisma.DbNull },
    });

    return this.sanitizeUser(updated);
  }

  // ── Follow ──

  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) throw new BadRequestException('Cannot follow yourself');

    const target = await this.prisma.user.findUnique({ where: { id: followingId } });
    if (!target || target.deletedAt) throw new NotFoundException('User not found');

    try {
      await this.prisma.follow.create({
        data: { followerId, followingId },
      });
    } catch {
      throw new ConflictException('Already following');
    }

    return { success: true };
  }

  async unfollowUser(followerId: string, followingId: string) {
    try {
      await this.prisma.follow.delete({
        where: { followerId_followingId: { followerId, followingId } },
      });
    } catch {
      throw new NotFoundException('Not following');
    }

    return { success: true };
  }

  // ── Followers / Following lists ──

  async getFollowers(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [follows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followingId: userId },
        include: {
          follower: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, role: true, level: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.follow.count({ where: { followingId: userId } }),
    ]);
    return {
      items: follows.map((f) => f.follower),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFollowing(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [follows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId },
        include: {
          following: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, role: true, level: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);
    return {
      items: follows.map((f) => f.following),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Stats ──

  async getStats(userId: string) {
    const [stats, followerCount, followingCount] = await Promise.all([
      this.getStatsById(userId),
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);

    return { ...stats, followerCount, followingCount };
  }

  private async getStatsById(userId: string) {
    const [bookmarkCount, commentCount, ratingCount] = await Promise.all([
      this.prisma.bookmark.count({ where: { userId } }),
      this.prisma.comment.count({ where: { userId, deletedAt: null } }),
      this.prisma.rating.count({ where: { userId } }),
    ]);

    return { bookmarkCount, commentCount, ratingCount };
  }

  // ── Sanitize ──

  private sanitizeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      banner: user.banner || null,
      role: user.role,
      bio: user.bio,
      socialLinks: user.socialLinks,
      coins: user.coins,
      experience: user.experience,
      level: user.level,
      createdAt: user.createdAt,
    };
  }

  private sanitizePublicUser(user: any) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      banner: user.banner || null,
      role: user.role,
      bio: user.bio,
      socialLinks: user.socialLinks,
      level: user.level,
      createdAt: user.createdAt,
    };
  }
}
