import { Controller, Get, Post, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HistoryService } from './history.service';
import { SyncHistoryDto, UpsertHistoryDto } from './dto/history.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('History')
@ApiBearerAuth()
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  getHistory(
    @CurrentUser('sub') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '24',
  ) {
    return this.historyService.getUserHistory(userId, Number(page) || 1, Number(limit) || 24);
  }

  @Get('comic/:comicId')
  getComicProgress(
    @CurrentUser('sub') userId: string,
    @Param('comicId', new ParseUUIDPipe()) comicId: string,
  ) {
    return this.historyService.getComicProgress(userId, comicId);
  }

  @Post()
  upsert(@CurrentUser('sub') userId: string, @Body() dto: UpsertHistoryDto) {
    return this.historyService.upsert(userId, dto);
  }

  @Post('sync')
  sync(@CurrentUser('sub') userId: string, @Body() dto: SyncHistoryDto) {
    return this.historyService.syncMany(userId, dto.items || []);
  }

  @Delete(':id')
  removeItem(
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.historyService.removeItem(userId, id);
  }

  @Delete()
  clearAll(@CurrentUser('sub') userId: string) {
    return this.historyService.clearAll(userId);
  }
}
