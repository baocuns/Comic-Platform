import { Controller, Get, Post, Patch, Param, ParseUUIDPipe, Query, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CULTIVATION_REALMS } from 'shared';
import { GamificationService } from './gamification.service';
import { UpdateGamificationConfigDto } from './dto/gamification.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Gamification')
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Public()
  @Get('realms')
  getRealms() {
    return CULTIVATION_REALMS;
  }

  @Public()
  @Get('leaderboard')
  getLeaderboard(
    @Query('metric') metric: 'xp' | 'streak' | 'chapters' = 'xp',
    @Query('limit') limit = '20',
  ) {
    return this.gamification.getLeaderboard(metric, Number(limit) || 20);
  }

  @Public()
  @Get('quests')
  getQuests(@CurrentUser('sub') userId?: string) {
    return this.gamification.getQuestsForUser(userId);
  }

  @ApiBearerAuth()
  @Get('me')
  getMyCultivation(@CurrentUser('sub') userId: string) {
    return this.gamification.getMyCultivation(userId);
  }

  @ApiBearerAuth()
  @Post('check-in')
  checkIn(@CurrentUser('sub') userId: string) {
    return this.gamification.processDailyCheckIn(userId, false);
  }

  @ApiBearerAuth()
  @Post('quests/:questId/claim')
  claimQuest(
    @CurrentUser('sub') userId: string,
    @Param('questId', new ParseUUIDPipe()) questId: string,
  ) {
    return this.gamification.claimQuest(userId, questId);
  }

  @ApiBearerAuth()
  @Get('transactions')
  getTransactions(
    @CurrentUser('sub') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('currency') currency?: string,
  ) {
    return this.gamification.getTransactions(userId, Number(page) || 1, Number(limit) || 20, currency);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('config')
  getConfig() {
    return this.gamification.getAllConfig();
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('config')
  updateConfig(@Body() dto: UpdateGamificationConfigDto) {
    return this.gamification.updateConfigValues(dto.updates);
  }
}
