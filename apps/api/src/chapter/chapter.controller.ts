import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { ChapterService } from './chapter.service';
import { CreateChapterDto, UpdateChapterDto } from './dto/chapter.dto';
import { ReorderPagesDto } from './dto/reorder-pages.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Chapters')
@Controller()
export class ChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  @Public()
  @Get('comics/:comicId/chapters')
  findByComic(
    @Param('comicId', new ParseUUIDPipe()) comicId: string,
    @CurrentUser('sub') userId?: string,
  ) {
    return this.chapterService.findByComicPublic(comicId, userId);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Get('comics/:comicId/chapters/manage')
  findByComicStudio(
    @Param('comicId', new ParseUUIDPipe()) comicId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.chapterService.findByComicForStudio(comicId, userId, role);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Post('comics/:comicId/chapters')
  create(
    @Param('comicId', new ParseUUIDPipe()) comicId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: CreateChapterDto,
  ) {
    return this.chapterService.create(comicId, userId, role, dto);
  }

  @ApiBearerAuth()
  @Get('chapters/purchases')
  getMyPurchases(
    @CurrentUser('sub') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.chapterService.getUserPurchases(userId, Number(page) || 1, Number(limit) || 20, search);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Get('chapters/:id/manage')
  findOneForStudio(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.chapterService.findOneForStudio(id, userId, role);
  }

  @Public()
  @Get('chapters/:id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string | undefined,
    @Req() req: Request,
  ) {
    return this.chapterService.findOne(id, userId, req.ip);
  }

  @ApiBearerAuth()
  @Post('chapters/:id/unlock')
  unlock(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.chapterService.unlockChapter(id, userId);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Put('chapters/:id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.chapterService.update(id, userId, role, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Post('chapters/:id/publish')
  publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.chapterService.publish(id, userId);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Delete('chapters/:id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.chapterService.remove(id, userId, role);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Put('chapters/:id/pages/reorder')
  reorderPages(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: ReorderPagesDto,
  ) {
    return this.chapterService.reorderPages(id, userId, role, dto.orders);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Delete('chapters/:id/pages/:pageId')
  removePage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('pageId', new ParseUUIDPipe()) pageId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.chapterService.removePage(id, pageId, userId, role);
  }
}
