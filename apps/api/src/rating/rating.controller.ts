import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { RatingService } from './rating.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('ratings')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Post('comics/:comicId')
  @UseGuards(JwtAuthGuard)
  async rate(
    @CurrentUser('sub') userId: string,
    @Param('comicId') comicId: string,
    @Body() body: { score: number; review?: string },
  ) {
    const rating = await this.ratingService.rate(userId, comicId, body.score, body.review);
    return { success: true, data: rating };
  }

  @Public()
  @Get('comics/:comicId')
  async findByComic(@Param('comicId') comicId: string, @Query('page') page?: string) {
    const result = await this.ratingService.findByComic(comicId, Number(page) || 1);
    return { success: true, ...result };
  }

  @Get('comics/:comicId/mine')
  @UseGuards(JwtAuthGuard)
  async myRating(@CurrentUser('sub') userId: string, @Param('comicId') comicId: string) {
    const rating = await this.ratingService.getUserRating(userId, comicId);
    return { success: true, data: rating };
  }
}
