import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('history')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Post()
  async saveProgress(
    @CurrentUser('sub') userId: string,
    @Body() body: { comicId: string; chapterId: string; lastPage: number },
  ) {
    const result = await this.historyService.upsert(userId, body.comicId, body.chapterId, body.lastPage);
    return { success: true, data: result };
  }

  @Get()
  async myHistory(@CurrentUser('sub') userId: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    const result = await this.historyService.getUserHistory(userId, Number(page) || 1, Number(limit) || 20);
    return { success: true, ...result };
  }
}
