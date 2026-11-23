import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { NewsService } from './news.service';
import { CreateNewsCommentDto, CreateNewsDto, NewsQueryDto, UpdateNewsDto } from './dto/news.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('News')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Public()
  @Get('featured')
  findFeatured() {
    return this.newsService.findFeatured();
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Get('studio')
  findStudioNews(
    @Query() query: NewsQueryDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.newsService.findStudioNews(query, userId, role);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Get('studio/:id')
  findByIdForStudio(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.newsService.findByIdForStudio(id, userId, role);
  }

  @Public()
  @Get()
  findAll(@Query() query: NewsQueryDto) {
    return this.newsService.findAll(query);
  }

  @Public()
  @Get(':slug')
  findBySlug(
    @Param('slug') slug: string,
    @Req() req: Request,
    @CurrentUser('sub') userId?: string,
  ) {
    return this.newsService.findBySlug(slug, userId, req.ip);
  }

  @Public()
  @Get(':slug/related')
  findRelated(@Param('slug') slug: string) {
    return this.newsService.findRelated(slug);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Post()
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateNewsDto) {
    return this.newsService.create(userId, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: UpdateNewsDto,
  ) {
    return this.newsService.update(id, userId, role, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Post(':id/publish')
  publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.newsService.publish(id, userId, role);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.newsService.remove(id, userId, role);
  }

  @ApiBearerAuth()
  @Post(':id/like')
  toggleLike(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.newsService.toggleLike(userId, id);
  }

  @Public()
  @Get(':id/comments')
  getComments(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.newsService.getComments(id, Number(page) || 1, Number(limit) || 20);
  }

  @ApiBearerAuth()
  @Post(':id/comments')
  createComment(
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateNewsCommentDto,
  ) {
    return this.newsService.createComment(userId, id, dto);
  }

  @ApiBearerAuth()
  @Delete('comments/:commentId')
  deleteComment(
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.newsService.deleteComment(commentId, userId, role);
  }
}
