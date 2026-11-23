import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ComicService } from './comic.service';
import {
  ComicQueryDto,
  CreateComicDto,
  RankingsQueryDto,
  RecommendationQueryDto,
  RecordSearchDto,
  UpdateComicDto,
} from './dto/comic.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Comics')
@Controller('comics')
export class ComicController {
  constructor(private readonly comicService: ComicService) {}

  @Public()
  @Get('homepage')
  getHomepage(@Query('limit') limit = '12') {
    const safeLimit = Math.min(Math.max(1, Number(limit) || 12), 30);
    return this.comicService.getHomepageSections(safeLimit);
  }

  @Public()
  @Get('rankings')
  getRankings(@Query() query: RankingsQueryDto) {
    return this.comicService.getRankings(query);
  }

  @Public()
  @Get('search')
  search(@Query('q') q = '', @Query('page') page = '1') {
    return this.comicService.search(q, Math.max(1, Number(page) || 1));
  }

  @Public()
  @Post('search/record')
  recordSearch(@CurrentUser('sub') userId: string | undefined, @Body() dto: RecordSearchDto) {
    return this.comicService.recordSearch(userId, dto.query);
  }

  @Public()
  @Get('recommendations')
  getRecommendations(@CurrentUser('sub') userId: string | undefined, @Query() query: RecommendationQueryDto) {
    return this.comicService.getRecommendations(userId, query);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Get('mine')
  getMyComics(@CurrentUser('sub') userId: string) {
    return this.comicService.findByAuthor(userId);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Get('id/:id')
  getComicByIdForStudio(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.comicService.findByIdForStudio(id, userId, role);
  }

  @Public()
  @Get()
  findAll(@Query() query: ComicQueryDto) {
    return this.comicService.findAll(query);
  }

  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string, @CurrentUser('sub') userId?: string) {
    return this.comicService.findBySlug(slug, userId);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Post()
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateComicDto) {
    return this.comicService.create(userId, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: UpdateComicDto,
  ) {
    return this.comicService.update(id, userId, role, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Post(':id/publish')
  publish(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser('sub') userId: string) {
    return this.comicService.publish(id, userId);
  }

  @ApiBearerAuth()
  @Roles(UserRole.AUTHOR)
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.comicService.remove(id, userId, role);
  }
}
