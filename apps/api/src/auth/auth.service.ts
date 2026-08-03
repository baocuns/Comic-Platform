import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { UserRole } from '@prisma/client';
import { GamificationService } from '../gamification/gamification.service';

interface TokenPayload {
  sub: string;
  role: UserRole;
  sid: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly gamification: GamificationService,
  ) {}

  // ── Register ──

  async register(dto: RegisterDto) {
    // Check duplicates
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === dto.email) {
        throw new ConflictException('Email already registered');
      }
      throw new ConflictException('Username already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        displayName: dto.displayName,
        role: UserRole.READER,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.role);

    this.logger.log(`New user registered: ${user.email}`);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // ── Login ──

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Award daily login (await so response includes updated data)
    try {
      await this.gamification.awardDailyLogin(user.id);
    } catch (e) {
      this.logger.warn(`Daily login reward failed for ${user.id}: ${(e as Error).message}`);
    }

    // Re-fetch user to get updated XP/coins/streak
    const updatedUser = await this.prisma.user.findUnique({ where: { id: user.id } });

    const tokens = await this.generateTokens(user.id, user.role);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      user: this.sanitizeUser(updatedUser || user),
      ...tokens,
    };
  }

  // ── Google OAuth ──

  async googleLogin(profile: { email: string; displayName: string; avatarUrl: string; googleId: string }) {
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: profile.email },
          { oauthProvider: 'google', oauthId: profile.googleId },
        ],
      },
    });

    if (!user) {
      // Create new user from Google profile
      const username = await this.generateUniqueUsername(profile.displayName);
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          oauthProvider: 'google',
          oauthId: profile.googleId,
          role: UserRole.READER,
          isVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
      this.logger.log(`New Google user: ${user.email}`);
    } else if (!user.oauthId) {
      // Link Google to existing account
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          oauthProvider: 'google',
          oauthId: profile.googleId,
          avatarUrl: user.avatarUrl || profile.avatarUrl,
          isVerified: true,
          emailVerifiedAt: user.emailVerifiedAt || new Date(),
        },
      });
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Award daily login for Google OAuth users too
    try {
      await this.gamification.awardDailyLogin(user.id);
    } catch (e) {
      this.logger.warn(`Daily login reward failed for ${user.id}: ${(e as Error).message}`);
    }

    // Re-fetch user to get updated XP/coins/streak
    const updatedUser = await this.prisma.user.findUnique({ where: { id: user.id } });

    const tokens = await this.generateTokens(user.id, user.role);

    return {
      user: this.sanitizeUser(updatedUser || user),
      ...tokens,
    };
  }

  // ── Refresh Token ──

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwt.verify<TokenPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });

      // Check if refresh token is blacklisted
      const isBlacklisted = await this.redis.exists(`blacklist:refresh:${payload.sid}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      // Blacklist old refresh token to prevent reuse
      await this.redis.set(`blacklist:refresh:${payload.sid}`, '1', 7 * 24 * 60 * 60);

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.deletedAt) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user.id, user.role);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // ── Logout ──

  async logout(sessionId: string) {
    // Blacklist the session for both access token and refresh token
    await this.redis.set(`blacklist:session:${sessionId}`, '1', 7 * 24 * 60 * 60);
    await this.redis.set(`blacklist:refresh:${sessionId}`, '1', 7 * 24 * 60 * 60);
  }

  // ── Get Current User ──

  async getProfile(userId: string) {
    // Award daily login on profile fetch (handles hydrate/refresh visits)
    try {
      await this.gamification.awardDailyLogin(userId);
    } catch (e) {
      this.logger.warn(`Daily login reward failed for ${userId}: ${(e as Error).message}`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.sanitizeUser(user);
  }

  // ── Helpers ──

  private async generateTokens(userId: string, role: UserRole): Promise<AuthTokens> {
    const sessionId = crypto.randomUUID();
    const payload: TokenPayload = { sub: userId, role, sid: sessionId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    // Store session in Redis
    await this.redis.set(
      `session:${sessionId}`,
      { userId, role },
      7 * 24 * 60 * 60,
    );

    return { accessToken, refreshToken, expiresIn: 900 };
  }

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
      loginStreak: user.loginStreak,
      createdAt: user.createdAt,
    };
  }

  private async generateUniqueUsername(displayName: string): Promise<string> {
    const base = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 30);

    let username = base;
    let counter = 1;

    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${base}_${counter}`;
      counter++;
    }

    return username;
  }
}
