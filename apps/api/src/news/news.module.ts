import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';

@Module({
  imports: [ModerationModule],
  controllers: [NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
