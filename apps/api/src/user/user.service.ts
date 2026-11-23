import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  AuthorApplicationStatus,
  ComicStatus,
  NotificationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { getCultivationInfo } from 'shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationService } from '../notification/notification.service';
import { GamificationService } from '../gamification/gamification.service';
import { SubmitAuthorApplicationDto, UpdateBannerPositionDto, UpdateProfileDto } from './dto/user.dto';

const ALLOWED_SOCIAL_KEYS = new Set([
  'facebook',
  'website',
  'twitter',
  'x',
  'instagram',
  'youtube',
  'tiktok',
  'discord',
]);

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notificationService: NotificationService,
    private readonly gamification: GamificationService,
  ) {}

  private sanitizeSocialLinksInput(
    raw: Record<string, string>,
  ): Record<string, string> {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!ALLOWED_SOCIAL_KEYS.has(k)) {
        throw new BadRequestException(`Liên kết mạng xã hội "${k}" không được hỗ trợ`);
      }
      if (typeof v !== 'string') {
        throw new BadRequestException(`Giá trị liên kết "${k}" không hợp lệ`);
      }
      const trimmed = v.trim();
      if (!trimmed) continue;
      if (trimmed.length > 500) {
        throw new BadRequestException(`Đường dẫn "${k}" quá dài (tối đa 500 ký tự)`);
      }
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error('bad protocol');
        }
        clean[k] = trimmed;
      } catch {
        throw new BadRequestException(`Đường dẫn "${k}" phải bắt đầu bằng http:// hoặc https://`);
      }
    }
    return clean;
  }

  private sanitizeSocialLinksForOutput(raw: unknown): Record<string, string> {
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!ALLOWED_SOCIAL_KEYS.has(k) || typeof v !== 'string') continue;
      try {
        const parsed = new URL(v.trim());
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          out[k] = v.trim();
        }
      } catch {
        // Skip invalid stored URLs defensively
      }
    }
    return out;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Không tìm thấy người dùng');

    let nextSocialLinks: Record<string, string> | undefined;
    if (dto.socialLinks !== undefined) {
      nextSocialLinks = this.sanitizeSocialLinksInput(dto.socialLinks);
    }

    let nextPreferences: Record<string, unknown> | undefined;
    if (dto.preferences !== undefined) {
      const merged = {
        ...((existing.preferences as Record<string, unknown>) || {}),
        ...dto.preferences,
      };
      if (JSON.stringify(merged).length > 8192) {
        throw new BadRequestException('Dữ liệu tùy chỉnh vượt quá kích thước cho phép (8KB)');
      }
      nextPreferences = merged;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName.trim() }),
        ...(dto.bio !== undefined && { bio: dto.bio.trim() }),
        ...(nextSocialLinks !== undefined && {
          socialLinks: nextSocialLinks as Prisma.InputJsonValue,
        }),
        ...(nextPreferences !== undefined && {
          preferences: nextPreferences as Prisma.InputJsonValue,
        }),
      },
    });

    return this.sanitizeSelfUser(updated);
  }

  async getMyAuthorApplication(userId: string) {
    return this.prisma.authorApplication.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: {
          select: { id: true, username: true, displayName: true },
        },
      },
    });
  }

  async submitAuthorApplication(userId: string, dto: SubmitAuthorApplicationDto) {
    const { user, application } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;

      const lockedUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true, username: true, role: true, deletedAt: true },
      });
      if (!lockedUser || lockedUser.deletedAt) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }

      if (lockedUser.role !== UserRole.READER) {
        throw new BadRequestException('Tài khoản của bạn đã có quyền Tác giả hoặc cao hơn');
      }

      const existingPending = await tx.authorApplication.findFirst({
        where: { userId, status: AuthorApplicationStatus.PENDING },
        select: { id: true },
      });
      if (existingPending) {
        throw new ConflictException('Bạn đã có đơn đăng ký Tác giả đang chờ Admin xét duyệt');
      }

      const created = await tx.authorApplication.create({
        data: {
          userId,
          penName: dto.penName.trim(),
          bio: dto.bio.trim(),
          portfolioUrl: dto.portfolioUrl?.trim() || null,
          sampleWorkTitle: dto.sampleWorkTitle?.trim() || null,
          sampleWorkLink: dto.sampleWorkLink?.trim() || null,
          experience: dto.experience?.trim() || null,
          status: AuthorApplicationStatus.PENDING,
        },
        include: {
          reviewer: {
            select: { id: true, username: true, displayName: true },
          },
        },
      });

      return { user: lockedUser, application: created };
    });

    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, deletedAt: null, isBanned: false },
      select: { id: true },
    });

    await Promise.all(
      admins.map((admin) =>
        this.notificationService
          .createPersonal({
            userId: admin.id,
            actorId: userId,
            type: NotificationType.SYSTEM,
            title: `${user.displayName} vừa gửi đơn đăng ký Tác giả`,
            content: `Bút danh: ${dto.penName.trim()}`,
            actionUrl: '/studio/moderation?tab=authors',
          })
          .catch(() => {}),
      ),
    );

    return application;
  }

  async getPublicProfile(username: string, viewerId?: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || user.deletedAt) throw new NotFoundException('Không tìm thấy người dùng');

    const [stats, followerCount, followingCount, followRecord, authorComics, publicBookmarks] =
      await Promise.all([
        this.getUserStatsById(user.id),
        this.prisma.follow.count({
          where: { followingId: user.id, follower: { deletedAt: null } },
        }),
        this.prisma.follow.count({
          where: { followerId: user.id, following: { deletedAt: null } },
        }),
        viewerId
          ? this.prisma.follow.findUnique({
              where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
            })
          : Promise.resolve(null),
        this.prisma.comic.findMany({
          where: {
            authorId: user.id,
            deletedAt: null,
            approvalStatus: ApprovalStatus.APPROVED,
            status: { not: ComicStatus.DRAFT },
          },
          select: {
            id: true,
            title: true,
            slug: true,
            coverUrl: true,
            type: true,
            status: true,
            totalChapters: true,
            totalViews: true,
            avgRating: true,
            lastChapterAt: true,
          },
          orderBy: { lastChapterAt: 'desc' },
        }),
        this.prisma.bookmark.findMany({
          where: {
            userId: user.id,
            comic: {
              deletedAt: null,
              approvalStatus: ApprovalStatus.APPROVED,
              status: { not: ComicStatus.DRAFT },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: 8,
          include: {
            comic: {
              select: {
                id: true,
                title: true,
                slug: true,
                coverUrl: true,
                type: true,
                status: true,
                totalChapters: true,
                avgRating: true,
              },
            },
          },
        }),
      ]);

    return {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
        bannerPosition: user.bannerPosition ?? 50,
        role: user.role,
        bio: user.bio,
        socialLinks: this.sanitizeSocialLinksForOutput(user.socialLinks),
        isVerified: user.isVerified,
        isTrusted: user.isTrusted,
        level: user.level,
        experience: user.experience,
        totalExperience: user.totalExperience,
        loginStreak: user.loginStreak,
        longestStreak: user.longestStreak,
        chaptersReadCount: user.chaptersReadCount,
        cultivation: getCultivationInfo(user.level, user.experience),
        createdAt: user.createdAt,
      },
      stats: { ...stats, followerCount, followingCount },
      isFollowing: !!followRecord,
      isOwnProfile: viewerId === user.id,
      authorComics: authorComics.map((c) => ({ ...c, avgRating: Number(c.avgRating) })),
      recentBookmarks: publicBookmarks.map((b) => ({
        id: b.id,
        status: b.status,
        comic: { ...b.comic, avgRating: Number(b.comic.avgRating) },
      })),
    };
  }

  async updateBannerPosition(userId: string, dto: UpdateBannerPositionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('Không tìm thấy người dùng');
    if (!user.bannerUrl) throw new BadRequestException('Chưa có ảnh bìa để căn chỉnh');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { bannerPosition: dto.position },
    });
    return this.sanitizeSelfUser(updated);
  }

  async removeBanner(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('Không tìm thấy người dùng');

    const oldBannerUrl = user.bannerUrl;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { bannerUrl: null, bannerPosition: 50 },
    });

    await this.storage.deleteByUrl(oldBannerUrl).catch(() => {});
    return this.sanitizeSelfUser(updated);
  }

  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('Không thể tự theo dõi chính mình');
    }

    const [follower, target] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: followerId },
        select: { id: true, username: true, displayName: true, deletedAt: true },
      }),
      this.prisma.user.findUnique({
        where: { id: followingId },
        select: { id: true, deletedAt: true },
      }),
    ]);

    if (!target || target.deletedAt) throw new NotFoundException('Không tìm thấy người dùng');

    try {
      await this.prisma.follow.create({ data: { followerId, followingId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Bạn đã theo dõi người dùng này rồi');
      }
      throw err;
    }

    this.gamification.awardFollow(followerId, followingId).catch(() => {});

    if (follower && !follower.deletedAt) {
      this.notificationService
        .createPersonal({
          userId: followingId,
          actorId: followerId,
          type: NotificationType.FOLLOW_NEW,
          title: `${follower.displayName} đã bắt đầu theo dõi bạn`,
          actionUrl: `/@${follower.username}`,
          data: { followerId, followerUsername: follower.username },
        })
        .catch(() => {});
    }

    return { following: true };
  }

  async unfollowUser(followerId: string, followingId: string) {
    const deleted = await this.prisma.follow.deleteMany({
      where: { followerId, followingId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Bạn chưa theo dõi người dùng này');
    }
    return { following: false };
  }

  async getFollowers(userId: string, page = 1, limit = 20) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safeLimit = Math.min(Math.max(1, Math.floor(Number(limit) || 20)), 50);
    const skip = (safePage - 1) * safeLimit;
    const where: Prisma.FollowWhereInput = {
      followingId: userId,
      follower: { deletedAt: null },
    };

    const [rows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where,
        include: {
          follower: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              role: true,
              level: true,
              experience: true,
              isVerified: true,
              isTrusted: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.follow.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        ...r.follower,
        cultivation: getCultivationInfo(r.follower.level, r.follower.experience),
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

  async getFollowing(userId: string, page = 1, limit = 20) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safeLimit = Math.min(Math.max(1, Math.floor(Number(limit) || 20)), 50);
    const skip = (safePage - 1) * safeLimit;
    const where: Prisma.FollowWhereInput = {
      followerId: userId,
      following: { deletedAt: null },
    };

    const [rows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where,
        include: {
          following: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              role: true,
              level: true,
              experience: true,
              isVerified: true,
              isTrusted: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.follow.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        ...r.following,
        cultivation: getCultivationInfo(r.following.level, r.following.experience),
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

  async getStats(userId: string) {
    const [stats, followerCount, followingCount] = await Promise.all([
      this.getUserStatsById(userId),
      this.prisma.follow.count({
        where: { followingId: userId, follower: { deletedAt: null } },
      }),
      this.prisma.follow.count({
        where: { followerId: userId, following: { deletedAt: null } },
      }),
    ]);
    return { ...stats, followerCount, followingCount };
  }

  private async getUserStatsById(userId: string) {
    const [bookmarkCount, commentCount, ratingCount] = await Promise.all([
      this.prisma.bookmark.count({
        where: { userId, comic: { deletedAt: null, approvalStatus: ApprovalStatus.APPROVED } },
      }),
      this.prisma.comment.count({ where: { userId, deletedAt: null } }),
      this.prisma.rating.count({ where: { userId } }),
    ]);
    return { bookmarkCount, commentCount, ratingCount };
  }

  private sanitizeSelfUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      bannerPosition: user.bannerPosition ?? 50,
      role: user.role,
      bio: user.bio,
      socialLinks: this.sanitizeSocialLinksForOutput(user.socialLinks),
      isVerified: user.isVerified,
      isTrusted: user.isTrusted,
      isBanned: user.isBanned,
      coins: user.coins,
      experience: user.experience,
      totalExperience: user.totalExperience,
      level: user.level,
      loginStreak: user.loginStreak,
      longestStreak: user.longestStreak,
      lastStreakDate: user.lastStreakDate,
      chaptersReadCount: user.chaptersReadCount,
      preferences: (user.preferences as Record<string, unknown>) || {},
      cultivation: getCultivationInfo(user.level, user.experience),
      createdAt: user.createdAt,
    };
  }
}
