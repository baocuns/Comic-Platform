import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ChapterService } from './chapter.service';
import { CreateChapterDto, UpdateChapterDto } from './dto/chapter.dto';
import { ReorderPagesDto } from './dto/reorder-pages.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller()
export class ChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  @Public()
  @Get('comics/:comicId/chapters')
  async findByComic(@Param('comicId') comicId: string) {
    const chapters = await this.chapterService.findByComic(comicId);
    return { success: true, data: chapters };
  }

  @Public()
  @Get('chapters/:id')
  async findOne(@Param('id') id: string) {
    const chapter = await this.chapterService.findOne(id);
    return { success: true, data: chapter };
  }

  @Public()
  @Get('chapters/:id/navigation')
  async getNavigation(@Param('id') id: string) {
    const nav = await this.chapterService.getNavigation(id);
    return { success: true, data: nav };
  }

  @Post('comics/:comicId/chapters')
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('comicId') comicId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateChapterDto,
  ) {
    const chapter = await this.chapterService.create(comicId, userId, dto);
    return { success: true, data: chapter };
  }

  @Put('chapters/:id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateChapterDto,
  ) {
    const chapter = await this.chapterService.update(id, userId, dto);
    return { success: true, data: chapter };
  }

  @Post('chapters/:id/publish')
  @UseGuards(JwtAuthGuard)
  async publish(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    const chapter = await this.chapterService.publish(id, userId);
    return { success: true, data: chapter };
  }

  @Delete('chapters/:id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    await this.chapterService.remove(id, userId);
    return { success: true, data: { message: 'Chapter deleted' } };
  }

  // ── Page Management ──

  @Put('chapters/:id/pages/reorder')
  @UseGuards(JwtAuthGuard)
  async reorderPages(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: ReorderPagesDto,
  ) {
    await this.chapterService.reorderPages(id, userId, dto.orders);
    return { success: true, data: { message: 'Pages reordered' } };
  }

  @Delete('chapters/:chapterId/pages/:pageId')
  @UseGuards(JwtAuthGuard)
  async removePage(
    @Param('chapterId') chapterId: string,
    @Param('pageId') pageId: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.chapterService.removePage(chapterId, pageId, userId);
    return { success: true, data: { message: 'Page deleted' } };
  }
}
