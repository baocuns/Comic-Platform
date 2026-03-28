import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CommentService } from './comment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Public()
  @Get('comic/:comicId')
  async findByComic(@Param('comicId') comicId: string, @Query('page') page?: string) {
    const result = await this.commentService.findByComic(comicId, Number(page) || 1);
    return { success: true, ...result };
  }

  @Public()
  @Get('chapter/:chapterId')
  async findByChapter(@Param('chapterId') chapterId: string, @Query('page') page?: string) {
    const result = await this.commentService.findByChapter(chapterId, Number(page) || 1);
    return { success: true, ...result };
  }

  @Post('chapter/:chapterId')
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser('sub') userId: string,
    @Param('chapterId') chapterId: string,
    @Body() body: { content: string; parentId?: string },
  ) {
    const comment = await this.commentService.create(userId, chapterId, body.content, body.parentId);
    return { success: true, data: comment };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    await this.commentService.remove(id, userId);
    return { success: true, data: { message: 'Comment deleted' } };
  }
}
