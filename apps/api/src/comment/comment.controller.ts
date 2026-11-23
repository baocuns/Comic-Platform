import { Controller, Get, Post, Patch, Delete, Param, Body, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CommentService } from './comment.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Comments')
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Public()
  @Get('comic/:comicId')
  findByComic(
    @Param('comicId', new ParseUUIDPipe()) comicId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('sort') sort: 'newest' | 'top' = 'newest',
    @Query('scope') scope: 'all' | 'comic' | 'chapters' = 'all',
    @CurrentUser('sub') viewerId?: string,
  ) {
    return this.commentService.findByComic(comicId, Number(page) || 1, Number(limit) || 20, sort, scope, viewerId);
  }

  @ApiBearerAuth()
  @Post('comic/:comicId')
  createForComic(
    @CurrentUser('sub') userId: string,
    @Param('comicId', new ParseUUIDPipe()) comicId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentService.createForComic(userId, comicId, dto);
  }

  @Public()
  @Get('chapter/:chapterId')
  findByChapter(
    @Param('chapterId', new ParseUUIDPipe()) chapterId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('sort') sort: 'newest' | 'top' = 'newest',
    @CurrentUser('sub') viewerId?: string,
    @CurrentUser('role') viewerRole?: UserRole,
  ) {
    return this.commentService.findByChapter(
      chapterId,
      Number(page) || 1,
      Number(limit) || 20,
      sort,
      viewerId,
      viewerRole,
    );
  }

  @ApiBearerAuth()
  @Post('chapter/:chapterId')
  createForChapter(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('chapterId', new ParseUUIDPipe()) chapterId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentService.createForChapter(userId, role, chapterId, dto);
  }

  @ApiBearerAuth()
  @Post(':id/like')
  toggleLike(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.commentService.toggleLike(id, userId);
  }

  @ApiBearerAuth()
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentService.update(id, userId, role, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.commentService.remove(id, userId, role);
  }
}
