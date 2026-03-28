import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'fallback-secret',
    });
  }

  async validate(payload: { sub: string; role: string; sid: string }) {
    // Check if session is blacklisted (logged out)
    const isBlacklisted = await this.redis.exists(`blacklist:${payload.sid}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Session has been revoked');
    }

    return {
      sub: payload.sub,
      role: payload.role,
      sid: payload.sid,
    };
  }
}
