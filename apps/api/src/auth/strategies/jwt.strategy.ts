import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { resolveJwtSecret } from '../jwt-secret.util';

export interface JwtTokenPayload {
  sub: string;
  role: string;
  sid: string;
  tokenType?: 'access' | 'refresh';
  iat?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config, 'JWT_SECRET', 'owoc-dev-jwt-secret-change-in-prod'),
    });
  }

  async validate(payload: JwtTokenPayload) {
    if (payload.tokenType === 'refresh') {
      throw new UnauthorizedException('Token không hợp lệ cho truy cập API');
    }

    const [isBlacklisted, pwdChangedRaw, user] = await Promise.all([
      this.redis.exists(`blacklist:session:${payload.sid}`),
      this.redis.get<string>(`pwdChangedAt:${payload.sub}`),
      this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, isBanned: true, bannedUntil: true, deletedAt: true },
      }),
    ]);

    if (isBlacklisted) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hiệu lực');
    }

    if (pwdChangedRaw && payload.iat && payload.iat * 1000 < Number(pwdChangedRaw)) {
      throw new UnauthorizedException('Mật khẩu đã thay đổi, vui lòng đăng nhập lại');
    }

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }

    if (user.isBanned) {
      if (user.bannedUntil && user.bannedUntil <= new Date()) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { isBanned: false, bannedReason: null, bannedUntil: null },
        });
      } else {
        throw new UnauthorizedException('Tài khoản đã bị khóa');
      }
    }

    return {
      sub: user.id,
      role: user.role,
      sid: payload.sid,
    };
  }
}
