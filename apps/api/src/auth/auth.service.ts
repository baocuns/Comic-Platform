import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Prisma, UserRole } from '@prisma/client';
import { getCultivationInfo } from 'shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { resolveJwtSecret } from './jwt-secret.util';

interface TokenPayload {
  sub: string;
  role: UserRole;
  sid: string;
  tokenType: 'access' | 'refresh';
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly gamification: GamificationService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private disconnectUserSockets(userId: string) {
    try {
      const gateway = this.moduleRef.get(NotificationGateway, { strict: false });
      gateway?.disconnectUser(userId);
    } catch {
      // Gateway may not be initialized in standalone test contexts
    }
  }

  private disconnectSessionSockets(sid: string) {
    try {
      const gateway = this.moduleRef.get(NotificationGateway, { strict: false });
      gateway?.disconnectSession(sid);
    } catch {
      // Gateway may not be initialized in standalone test contexts
    }
  }

  async register(dto: RegisterDto, meta?: RequestMeta) {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();
    const displayName = dto.displayName.trim();

    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('Email này đã được đăng ký');
      }
      throw new ConflictException('Tên đăng nhập này đã có người sử dụng');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const welcomeCoins = this.gamification.getConfigValue('coin_welcome', 30);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          username,
          passwordHash,
          displayName,
          role: UserRole.READER,
          coins: welcomeCoins,
          lastLoginAt: new Date(),
        },
      });

      await tx.rewardTransaction.create({
        data: {
          userId: created.id,
          currency: 'COIN',
          amount: welcomeCoins,
          source: 'welcome_bonus',
          balanceAfter: created.coins,
          note: 'Quà tặng gia nhập OWOC',
        },
      });

      return created;
    });

    const tokens = await this.issueTokens(user.id, user.role, meta);
    this.logger.log(`User registered: ${user.email}`);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto, meta?: RequestMeta) {
    const identifier = dto.identifier.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (!user || !user.passwordHash || user.deletedAt) {
      throw new UnauthorizedException('Email/tên đăng nhập hoặc mật khẩu không đúng');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email/tên đăng nhập hoặc mật khẩu không đúng');
    }

    await this.assertNotBanned(user);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    try {
      await this.gamification.processDailyCheckIn(user.id, true);
    } catch (e: unknown) {
      this.logger.warn(`Daily login reward skipped: ${(e as Error).message}`);
    }

    const updatedUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    const tokens = await this.issueTokens(user.id, user.role, meta);

    return {
      user: this.sanitizeUser(updatedUser || user),
      ...tokens,
    };
  }

  async googleLogin(
    profile: { email: string; displayName: string; avatarUrl: string; googleId: string },
    meta?: RequestMeta,
  ) {
    if (!profile.googleId) {
      throw new BadRequestException('Thông tin Google OAuth không hợp lệ');
    }

    const email = profile.email.trim().toLowerCase();
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { oauthProvider: 'google', oauthId: profile.googleId }],
      },
    });

    if (!user) {
      const welcomeCoins = this.gamification.getConfigValue('coin_welcome', 30);
      for (let attempt = 0; attempt < 3; attempt++) {
        const username =
          attempt === 0
            ? await this.generateUniqueUsername(profile.displayName || email.split('@')[0])
            : await this.generateUniqueUsername(
                `${profile.displayName || email.split('@')[0]}_${crypto.randomBytes(2).toString('hex')}`,
              );
        try {
          user = await this.prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
              data: {
                email,
                username,
                displayName: (profile.displayName || username).trim().slice(0, 100),
                avatarUrl: profile.avatarUrl || null,
                oauthProvider: 'google',
                oauthId: profile.googleId,
                role: UserRole.READER,
                isVerified: true,
                emailVerifiedAt: new Date(),
                coins: welcomeCoins,
                lastLoginAt: new Date(),
              },
            });
            await tx.rewardTransaction.create({
              data: {
                userId: created.id,
                currency: 'COIN',
                amount: welcomeCoins,
                source: 'welcome_bonus',
                balanceAfter: created.coins,
                note: 'Quà tân thủ đăng ký qua Google',
              },
            });
            return created;
          });
          break;
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002' &&
            attempt < 2
          ) {
            user = await this.prisma.user.findFirst({
              where: {
                OR: [{ email }, { oauthProvider: 'google', oauthId: profile.googleId }],
              },
            });
            if (user) break;
            continue;
          }
          throw err;
        }
      }
      if (!user) {
        throw new ConflictException('Không thể khởi tạo tài khoản Google, vui lòng thử lại');
      }
    } else {
      if (user.deletedAt) {
        throw new UnauthorizedException('Tài khoản đã bị xóa hoặc không còn tồn tại');
      }
      await this.assertNotBanned(user);

      // If linking Google to an unverified password account, clear unverified password & old sessions to prevent takeover
      const shouldClearUnverifiedPassword = !user.isVerified && !!user.passwordHash;
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user!.id },
          data: {
            oauthProvider: user!.oauthProvider || 'google',
            oauthId: user!.oauthId || profile.googleId,
            avatarUrl: user!.avatarUrl || profile.avatarUrl || null,
            isVerified: true,
            emailVerifiedAt: user!.emailVerifiedAt || new Date(),
            lastLoginAt: new Date(),
            ...(shouldClearUnverifiedPassword ? { passwordHash: null } : {}),
          },
        });
        if (shouldClearUnverifiedPassword) {
          await tx.refreshSession.updateMany({
            where: { userId: user!.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      });
      if (shouldClearUnverifiedPassword) {
        this.disconnectUserSockets(user.id);
      }
    }

    try {
      await this.gamification.processDailyCheckIn(user.id, true);
    } catch {
      // Non-fatal
    }

    const updatedUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    const tokens = await this.issueTokens(user.id, user.role, meta);

    return {
      user: this.sanitizeUser(updatedUser || user),
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string, meta?: RequestMeta) {
    let payload: TokenPayload;
    try {
      payload = this.jwt.verify<TokenPayload>(refreshToken, {
        secret: resolveJwtSecret(
          this.config,
          'JWT_REFRESH_SECRET',
          'owoc-dev-refresh-secret-change-in-prod',
        ),
      });
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }

    if (payload.tokenType === 'access') {
      throw new UnauthorizedException('Token không hợp lệ để làm mới phiên');
    }

    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Phiên làm việc không hợp lệ hoặc đã hết hạn');
    }

    if (session.revokedAt) {
      await this.prisma.refreshSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.disconnectUserSockets(session.userId);
      throw new UnauthorizedException('Phiên làm việc đã bị thu hồi, vui lòng đăng nhập lại');
    }

    if (!session.user || session.user.deletedAt) {
      throw new UnauthorizedException('Tài khoản không khả dụng');
    }
    await this.assertNotBanned(session.user, true);

    // Atomic rotation check
    const revoked = await this.prisma.refreshSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (revoked.count === 0) {
      await this.prisma.refreshSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.disconnectUserSockets(session.userId);
      throw new UnauthorizedException('Phiên làm việc không hợp lệ hoặc đã bị thu hồi');
    }

    const tokens = await this.issueTokens(session.user.id, session.user.role, meta);
    return {
      user: this.sanitizeUser(session.user),
      ...tokens,
    };
  }

  async logout(sessionId?: string, refreshToken?: string) {
    if (sessionId) {
      await Promise.all([
        this.redis.set(`blacklist:session:${sessionId}`, '1', 900),
        this.prisma.refreshSession.updateMany({
          where: { id: sessionId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);
      this.disconnectSessionSockets(sessionId);
    }
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      const found = await this.prisma.refreshSession.findUnique({
        where: { tokenHash },
        select: { id: true },
      });
      await this.prisma.refreshSession.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (found && found.id !== sessionId) {
        await this.redis.set(`blacklist:session:${found.id}`, '1', 900);
        this.disconnectSessionSockets(found.id);
      }
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Không tìm thấy tài khoản');
    }

    return this.sanitizeUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Không tìm thấy tài khoản');
    }

    if (user.passwordHash) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Vui lòng nhập mật khẩu hiện tại');
      }
      const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!isValid) {
        throw new BadRequestException('Mật khẩu hiện tại không chính xác');
      }
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    const now = Date.now();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      }),
      this.prisma.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.redis.set(`pwdChangedAt:${userId}`, String(now), 900);
    this.disconnectUserSockets(userId);

    return { message: 'Đổi mật khẩu thành công' };
  }

  private async issueTokens(userId: string, role: UserRole, meta?: RequestMeta): Promise<AuthTokens> {
    const sessionId = crypto.randomUUID();
    const accessPayload: TokenPayload = { sub: userId, role, sid: sessionId, tokenType: 'access' };
    const refreshPayload: TokenPayload = { sub: userId, role, sid: sessionId, tokenType: 'refresh' };

    const accessSecret = resolveJwtSecret(
      this.config,
      'JWT_SECRET',
      'owoc-dev-jwt-secret-change-in-prod',
    );
    const refreshSecret = resolveJwtSecret(
      this.config,
      'JWT_REFRESH_SECRET',
      'owoc-dev-refresh-secret-change-in-prod',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, { secret: accessSecret, expiresIn: '15m' }),
      this.jwt.signAsync(refreshPayload, { secret: refreshSecret, expiresIn: '7d' }),
    ]);

    await this.prisma.refreshSession.create({
      data: {
        id: sessionId,
        userId,
        tokenHash: this.hashToken(refreshToken),
        userAgent: meta?.userAgent?.slice(0, 480),
        ipAddress: meta?.ipAddress?.slice(0, 90),
        expiresAt: new Date(Date.now() + this.REFRESH_TTL_MS),
      },
    });

    return { accessToken, refreshToken, expiresIn: 900 };
  }

  sanitizeUser(user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    bannerPosition: number;
    role: UserRole;
    bio: string | null;
    socialLinks: unknown;
    isVerified: boolean;
    isTrusted: boolean;
    isBanned: boolean;
    coins: number;
    experience: number;
    totalExperience: number;
    level: number;
    loginStreak: number;
    longestStreak: number;
    lastStreakDate: Date | null;
    chaptersReadCount: number;
    preferences: unknown;
    createdAt: Date;
  }) {
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
      socialLinks: (user.socialLinks as Record<string, string>) || {},
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

  private async generateUniqueUsername(displayName: string): Promise<string> {
    const base =
      displayName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 28) || 'reader';

    let username = base;
    let counter = 1;
    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${base}_${counter++}`;
    }
    return username;
  }

  private async assertNotBanned(
    user: { id: string; isBanned: boolean; bannedReason: string | null; bannedUntil: Date | null },
    asUnauthorized = false,
  ) {
    if (!user.isBanned) return;
    if (user.bannedUntil && user.bannedUntil <= new Date()) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isBanned: false, bannedReason: null, bannedUntil: null },
      });
      user.isBanned = false;
      user.bannedReason = null;
      user.bannedUntil = null;
      return;
    }
    const untilText = user.bannedUntil
      ? ` đến ${user.bannedUntil.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
      : '';
    const reasonText = user.bannedReason ? `: ${user.bannedReason}` : '';
    const message = `Tài khoản đã bị khóa${untilText}${reasonText}`;
    if (asUnauthorized) {
      throw new UnauthorizedException(message);
    }
    throw new ForbiddenException(message);
  }
}
