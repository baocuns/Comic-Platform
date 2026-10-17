import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ComicService } from './comic.service';
import { CreateComicDto, UpdateComicDto, ComicQueryDto, RecommendationQueryDto, RecordSearchDto } from './dto/comic.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('comics')
export class ComicController {
  constructor(private readonly comicService: ComicService) {}

  @Public()
  @Get()
  async findAll(@Query() query: ComicQueryDto) {
    const result = await this.comicService.findAll(query);
    return { success: true, ...result };
  }

  @Public()
  @Get('homepage')
  async homepage() {
    const data = await this.comicService.getHomepageSections();
    return { success: true, data };
  }

  @Public()
  @Get('search')
  async search(
    @Query('q') q: string,
    @Query('page') page?: string,
    @CurrentUser('sub') userId?: string,
  ) {
    if (q && q.trim().length >= 2) {
      this.comicService.recordSearch(userId, q).catch(() => {});
    }
    const result = await this.comicService.search(q, Number(page) || 1);
    return { success: true, ...result };
  }

  @Public()
  @Get('genres')
  async getGenres() {
    const genres = await this.comicService.getGenres();
    return { success: true, data: genres };
  }

  @Get('author/my-comics')
  @UseGuards(JwtAuthGuard)
  async myComics(@CurrentUser('sub') userId: string) {
    const comics = await this.comicService.findByAuthor(userId);
    return { success: true, data: comics };
  }

  @Public()
  @Get('recommendations')
  async getRecommendations(
    @Query() query: RecommendationQueryDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.comicService.getRecommendations(userId, query);
    return { success: true, data: result.data, reason: result.reason };
  }

  @Public()
  @Post('search/record')
  async recordSearch(
    @Body() dto: RecordSearchDto,
    @CurrentUser('sub') userId?: string,
  ) {
    await this.comicService.recordSearch(userId, dto.query);
    return { success: true };
  }

  // ⚠️ Wildcard :slug route MUST be after all named routes
  @Public()
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const comic = await this.comicService.findBySlug(slug);
    return { success: true, data: comic };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.AUTHOR)
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateComicDto) {
    const comic = await this.comicService.create(userId, dto);
    return { success: true, data: comic };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateComicDto,
  ) {
    const comic = await this.comicService.update(id, userId, dto);
    return { success: true, data: comic };
  }

  @Post(':id/submit-review')
  @UseGuards(JwtAuthGuard)
  async submitReview(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    const result = await this.comicService.submitReview(id, userId);
    return { success: true, data: result };
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  async publish(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    const comic = await this.comicService.publish(id, userId);
    return { success: true, data: comic };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    await this.comicService.remove(id, userId);
    return { success: true, data: { message: 'Comic deleted' } };
  }
}

