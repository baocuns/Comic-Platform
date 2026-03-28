import { Controller, Post, Get, Param, Query, UseGuards } from '@nestjs/common';
import { BookmarkService } from './bookmark.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('bookmarks')
@UseGuards(JwtAuthGuard)
export class BookmarkController {
  constructor(private readonly bookmarkService: BookmarkService) {}

  @Post('toggle/:comicId')
  async toggle(@CurrentUser('sub') userId: string, @Param('comicId') comicId: string) {
    const result = await this.bookmarkService.toggle(userId, comicId);
    return { success: true, data: result };
  }

  @Post('favorite/:comicId')
  async toggleFavorite(@CurrentUser('sub') userId: string, @Param('comicId') comicId: string) {
    const result = await this.bookmarkService.toggleFavorite(userId, comicId);
    return { success: true, data: result };
  }

  @Get()
  async myBookmarks(@CurrentUser('sub') userId: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    const result = await this.bookmarkService.getUserBookmarks(userId, Number(page) || 1, Number(limit) || 20);
    return { success: true, ...result };
  }

  @Get('check/:comicId')
  async isBookmarked(@CurrentUser('sub') userId: string, @Param('comicId') comicId: string) {
    const result = await this.bookmarkService.isBookmarked(userId, comicId);
    return { success: true, data: result };
  }
}
