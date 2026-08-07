import { Module } from '@nestjs/common';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { ModerationModule } from '../moderation/moderation.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [ModerationModule, NotificationModule],
  controllers: [NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
