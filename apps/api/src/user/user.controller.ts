import { Controller, Put, Get, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from './user.service';
import { UpdateProfileDto, UpdateBannerPositionDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Request } from 'express';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  // ── Self profile ──

  @Put('me')
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.userService.updateProfile(userId, dto);
    return { success: true, data: user };
  }

  @Get('me/stats')
  async getStats(@CurrentUser('sub') userId: string) {
    const stats = await this.userService.getStats(userId);
    return { success: true, data: stats };
  }

  // ── Banner ──

  @Put('me/banner')
  async updateBannerPosition(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateBannerPositionDto,
  ) {
    const user = await this.userService.updateBannerPosition(userId, dto);
    return { success: true, data: user };
  }

  @Delete('me/banner')
  async removeBanner(@CurrentUser('sub') userId: string) {
    const user = await this.userService.removeBanner(userId);
    return { success: true, data: user };
  }

  // ── Public profile ──

  @Public()
  @Get(':username/profile')
  async getPublicProfile(
    @Param('username') username: string,
    @Req() req: Request,
  ) {
    // Extract viewer ID from JWT if present (optional auth)
    let viewerId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const decoded = this.jwtService.verify(token) as any;
        viewerId = decoded.sub;
      } catch {
        // Invalid token, proceed as anonymous
      }
    }

    const profile = await this.userService.getPublicProfile(username, viewerId);
    return { success: true, data: profile };
  }

  // ── Follow ──

  @Post(':userId/follow')
  async follow(
    @CurrentUser('sub') followerId: string,
    @Param('userId') followingId: string,
  ) {
    await this.userService.followUser(followerId, followingId);
    return { success: true, data: { message: 'Followed' } };
  }

  @Delete(':userId/follow')
  async unfollow(
    @CurrentUser('sub') followerId: string,
    @Param('userId') followingId: string,
  ) {
    await this.userService.unfollowUser(followerId, followingId);
    return { success: true, data: { message: 'Unfollowed' } };
  }
}
