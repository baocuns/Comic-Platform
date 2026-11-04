import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
  Body,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { GamificationService, REALM_DEFINITIONS } from './gamification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('gamification')
export class GamificationController {
  constructor(
    private readonly gamificationService: GamificationService,
    private readonly jwtService: JwtService,
  ) {}

  // ── Cultivation Profile ──

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser('sub') userId: string) {
    const data = await this.gamificationService.getCultivationProfile(userId);
    return { success: true, data };
  }

  // ── Daily Check-in (Tọa Thiền Tụ Khí) ──

  @Post('daily-checkin')
  @UseGuards(JwtAuthGuard)
  async dailyCheckin(@CurrentUser('sub') userId: string) {
    const result = await this.gamificationService.awardDailyLogin(userId);
    return result;
  }

  // ── Breakthrough (Độ Kiếp Đột Phá) ──

  @Post('breakthrough')
  @UseGuards(JwtAuthGuard)
  async breakthrough(@CurrentUser('sub') userId: string) {
    const result = await this.gamificationService.breakthrough(userId);
    return result;
  }

  // ── Quests List & Claim ──

  @Get('quests')
  @UseGuards(JwtAuthGuard)
  async getQuests(@CurrentUser('sub') userId: string) {
    const data = await this.gamificationService.getDailyQuests(userId);
    return { success: true, data };
  }

  @Post('quests/:questId/claim')
  @UseGuards(JwtAuthGuard)
  async claimQuest(
    @CurrentUser('sub') userId: string,
    @Param('questId') questId: string,
  ) {
    const result = await this.gamificationService.claimQuest(userId, questId);
    return result;
  }

  @Post('quests/chests/:milestone/claim')
  @UseGuards(JwtAuthGuard)
  async claimChest(
    @CurrentUser('sub') userId: string,
    @Param('milestone') milestone: string,
  ) {
    const result = await this.gamificationService.claimChest(userId, parseInt(milestone, 10));
    return result;
  }

  // ── Achievements ──

  @Get('achievements')
  @UseGuards(JwtAuthGuard)
  async getAchievements(@CurrentUser('sub') userId: string) {
    const data = await this.gamificationService.getAchievements(userId);
    return { success: true, data };
  }

  // ── Realms Definition List (Public) ──

  @Public()
  @Get('realms')
  async getRealms() {
    return { success: true, data: REALM_DEFINITIONS };
  }

  // ── Cultivation History ──

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.gamificationService.getCultivationHistory(
      userId,
      limit ? parseInt(limit, 10) : 50,
    );
    return { success: true, data };
  }

  // ── Inventory & Shop ──

  @Get('inventory')
  @UseGuards(JwtAuthGuard)
  async getInventory(@CurrentUser('sub') userId: string) {
    const data = await this.gamificationService.getInventory(userId);
    return { success: true, data };
  }

  @Post('inventory/redeem')
  @UseGuards(JwtAuthGuard)
  async redeemItem(
    @CurrentUser('sub') userId: string,
    @Body('itemId') itemId: string,
  ) {
    const result = await this.gamificationService.redeemItem(userId, itemId);
    return result;
  }

  // ── Leaderboard (Public with optional Auth for user rank) ──

  @Public()
  @Get('leaderboard')
  async getLeaderboard(
    @Query('type') type: 'all' | 'weekly' | 'sect' = 'all',
    @Req() req: Request,
  ) {
    let currentUserId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const decoded = this.jwtService.verify(token) as any;
        currentUserId = decoded.sub;
      } catch {
        // Anonymous visitor
      }
    }

    const data = await this.gamificationService.getLeaderboard(type, currentUserId);
    return { success: true, data };
  }
}
