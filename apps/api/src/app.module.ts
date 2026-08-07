import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { ComicModule } from './comic/comic.module';
import { ChapterModule } from './chapter/chapter.module';
import { UploadModule } from './upload/upload.module';
import { BookmarkModule } from './bookmark/bookmark.module';
import { HistoryModule } from './history/history.module';
import { CommentModule } from './comment/comment.module';
import { RatingModule } from './rating/rating.module';
import { UserModule } from './user/user.module';
import { GamificationModule } from './gamification/gamification.module';
import { NewsModule } from './news/news.module';
import { ModerationModule } from './moderation/moderation.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    PrismaModule,
    StorageModule,
    RedisModule,
    GamificationModule,
    AuthModule,
    ComicModule,
    ChapterModule,
    UploadModule,
    BookmarkModule,
    HistoryModule,
    CommentModule,
    RatingModule,
    UserModule,
    NewsModule,
    ModerationModule,
    NotificationModule,
  ],
  controllers: [AppController],
})
export class AppModule {}


