import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto, GoogleAuthDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    this.setRefreshTokenCookie(res, result.refreshToken);
    return {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    this.setRefreshTokenCookie(res, result.refreshToken);
    return {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleAuth(
    @Body() body: GoogleAuthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const googleProfile = await this.verifyGoogleToken(body.token);
    const result = await this.authService.googleLogin(googleProfile, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    this.setRefreshTokenCookie(res, result.refreshToken);
    return {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('Không tìm thấy phiên đăng nhập');
    }

    const tokens = await this.authService.refreshTokens(refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      user: tokens.user,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('sid') sessionId: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'];
    await this.authService.logout(sessionId, refreshToken);
    res.clearCookie('refresh_token', this.getRefreshCookieOptions());
    return { message: 'Đăng xuất thành công' };
  }

  @ApiBearerAuth()
  @Get('me')
  async getMe(@CurrentUser('sub') userId: string) {
    return this.authService.getProfile(userId);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch('password')
  async changePassword(@CurrentUser('sub') userId: string, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(userId, dto);
  }

  private getRefreshCookieOptions(): CookieOptions {
    const rawSameSite = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
    const sameSite: 'lax' | 'strict' | 'none' =
      rawSameSite === 'strict' || rawSameSite === 'none' ? rawSameSite : 'lax';
    return {
      httpOnly: true,
      secure: sameSite === 'none' ? true : process.env.NODE_ENV === 'production',
      sameSite,
      path: '/v1/auth',
    };
  }

  private setRefreshTokenCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      ...this.getRefreshCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private async verifyGoogleToken(token: string) {
    const expectedClientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!expectedClientId) {
      throw new ServiceUnavailableException('Đăng nhập Google chưa được cấu hình trên hệ thống');
    }

    try {
      // 1. Verify Google ID Token (JWT from Google Identity Services)
      const idTokenRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (idTokenRes.ok) {
        const data = await idTokenRes.json();
        if (!data.sub || !data.email) {
          throw new BadRequestException('Google token thiếu thông tin định danh');
        }
        if (data.aud !== expectedClientId) {
          throw new UnauthorizedException('Google token không khớp Client ID của hệ thống');
        }
        if (data.email_verified !== 'true' && data.email_verified !== true) {
          throw new UnauthorizedException('Email Google chưa được xác minh');
        }
        return {
          email: data.email as string,
          displayName: (data.name as string) || (data.email as string).split('@')[0],
          avatarUrl: (data.picture as string) || '',
          googleId: String(data.sub),
        };
      }

      // 2. Fallback: Verify OAuth2 Access Token audience via tokeninfo BEFORE reading userinfo
      const accessInfoRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (accessInfoRes.ok) {
        const ti = await accessInfoRes.json();
        const matchesAudience = ti.aud === expectedClientId || ti.azp === expectedClientId;
        if (!matchesAudience) {
          throw new UnauthorizedException('Google token không khớp Client ID của hệ thống');
        }
        if (ti.email_verified !== 'true' && ti.email_verified !== true) {
          throw new UnauthorizedException('Email Google chưa được xác minh');
        }

        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        });
        if (userInfoRes.ok) {
          const data = await userInfoRes.json();
          if (!data.sub || !data.email) {
            throw new BadRequestException('Google token thiếu thông tin định danh');
          }
          if (data.email_verified !== 'true' && data.email_verified !== true) {
            throw new UnauthorizedException('Email Google chưa được xác minh');
          }
          return {
            email: data.email as string,
            displayName: (data.name as string) || (data.email as string).split('@')[0],
            avatarUrl: (data.picture as string) || '',
            googleId: String(data.sub),
          };
        }
      }
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof UnauthorizedException ||
        err instanceof ServiceUnavailableException
      ) {
        throw err;
      }
      throw new UnauthorizedException('Không thể xác thực token với Google');
    }

    throw new UnauthorizedException('Token Google không hợp lệ');
  }
}
