import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { GenreModule } from '../genre/genre.module';
import { ComicController } from './comic.controller';
import { ComicService } from './comic.service';

@Module({
  imports: [ModerationModule, GenreModule],
  controllers: [ComicController],
  providers: [ComicService],
  exports: [ComicService],
})
export class ComicModule {}
