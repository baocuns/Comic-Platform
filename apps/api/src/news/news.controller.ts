import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { NewsService } from './news.service';
import { CreateNewsDto, UpdateNewsDto, NewsQueryDto } from './dto/news.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Public()
  @Get()
  async findAll(@Query() query: NewsQueryDto) {
    const result = await this.newsService.findAll(query);
    return { success: true, ...result };
  }

  @Get('studio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.AUTHOR)
  async findStudioNews(
    @Query() query: NewsQueryDto,
    @CurrentUser() user: { sub: string; role: UserRole },
  ) {
    const result = await this.newsService.findStudioNews(query, user);
    return { success: true, ...result };
  }

  @Public()
  @Get('featured')
  async featured() {
    const data = await this.newsService.findFeatured();
    return { success: true, data };
  }

  // ⚠️ Named routes MUST be before wildcard :slug route
  @Get('id/:id')
  @UseGuards(JwtAuthGuard)
  async findById(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    const data = await this.newsService.findById(id, userId);
    return { success: true, data };
  }

  @Public()
  @Get(':slug/related')
  async related(@Param('slug') slug: string) {
    const data = await this.newsService.findRelated(slug);
    return { success: true, data };
  }

  @Public()
  @UseGuards(JwtAuthGuard)
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string, @CurrentUser('sub') userId?: string) {
    const data = await this.newsService.findBySlug(slug, userId);
    return { success: true, data };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.AUTHOR)
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateNewsDto) {
    const article = await this.newsService.create(userId, dto);
    return { success: true, data: article };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.AUTHOR)
  async update(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateNewsDto,
  ) {
    const article = await this.newsService.update(id, userId, dto);
    return { success: true, data: article };
  }

  @Post(':id/submit-review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.AUTHOR)
  async submitReview(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    const result = await this.newsService.submitReview(id, userId);
    return { success: true, data: result };
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.AUTHOR)
  async publish(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    const article = await this.newsService.publish(id, userId);
    return { success: true, data: article };
  }

  @Get(':id/events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.AUTHOR)
  async getEvents(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    const result = await this.newsService.getArticleEvents(id, userId);
    return { success: true, ...result };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.AUTHOR)
  async remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    await this.newsService.remove(id, userId);
    return { success: true, data: { message: 'Article deleted' } };
  }

  // ── Comments ──

  @Public()
  @Get(':articleId/comments')
  async getComments(@Param('articleId') articleId: string, @Query('page') page?: string) {
    const result = await this.newsService.getComments(articleId, Number(page) || 1);
    return { success: true, ...result };
  }

  @Post(':articleId/comments')
  @UseGuards(JwtAuthGuard)
  async createComment(
    @CurrentUser('sub') userId: string,
    @Param('articleId') articleId: string,
    @Body() body: { content: string; parentId?: string },
  ) {
    const comment = await this.newsService.createComment(userId, articleId, body.content, body.parentId);
    return { success: true, data: comment };
  }

  @Delete('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  async deleteComment(@Param('commentId') commentId: string, @CurrentUser('sub') userId: string) {
    await this.newsService.deleteComment(commentId, userId);
    return { success: true, data: { message: 'Comment deleted' } };
  }

  // ── Likes ──

  @Post(':articleId/like')
  @UseGuards(JwtAuthGuard)
  async toggleLike(@CurrentUser('sub') userId: string, @Param('articleId') articleId: string) {
    const result = await this.newsService.toggleLike(userId, articleId);
    return { success: true, data: result };
  }
}
