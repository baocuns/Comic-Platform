import { Controller, Get, Post, Delete, Param, Body, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RatingService } from './rating.service';
import { UpsertRatingDto } from './dto/rating.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Ratings')
@Controller('ratings')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Public()
  @Get('comics/:comicId')
  findByComic(
    @Param('comicId', new ParseUUIDPipe()) comicId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @CurrentUser('sub') viewerId?: string,
  ) {
    return this.ratingService.findByComic(comicId, Number(page) || 1, Number(limit) || 10, viewerId);
  }

  @ApiBearerAuth()
  @Get('comics/:comicId/mine')
  getMine(
    @CurrentUser('sub') userId: string,
    @Param('comicId', new ParseUUIDPipe()) comicId: string,
  ) {
    return this.ratingService.getUserRating(userId, comicId);
  }

  @ApiBearerAuth()
  @Post('comics/:comicId')
  rate(
    @CurrentUser('sub') userId: string,
    @Param('comicId', new ParseUUIDPipe()) comicId: string,
    @Body() dto: UpsertRatingDto,
  ) {
    return this.ratingService.rate(userId, comicId, dto);
  }

  @ApiBearerAuth()
  @Post(':ratingId/helpful')
  toggleHelpful(
    @Param('ratingId', new ParseUUIDPipe()) ratingId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.ratingService.toggleHelpful(ratingId, userId);
  }

  @ApiBearerAuth()
  @Delete(':ratingId')
  remove(
    @Param('ratingId', new ParseUUIDPipe()) ratingId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.ratingService.remove(ratingId, userId, role);
  }
}
