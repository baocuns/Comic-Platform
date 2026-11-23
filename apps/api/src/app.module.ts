import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { NotificationModule } from './notification/notification.module';
import { GamificationModule } from './gamification/gamification.module';
import { GenreModule } from './genre/genre.module';
import { UserModule } from './user/user.module';
import { UploadModule } from './upload/upload.module';
import { ModerationModule } from './moderation/moderation.module';
import { ComicModule } from './comic/comic.module';
import { ChapterModule } from './chapter/chapter.module';
import { BookmarkModule } from './bookmark/bookmark.module';
import { HistoryModule } from './history/history.module';
import { CommentModule } from './comment/comment.module';
import { RatingModule } from './rating/rating.module';
import { NewsModule } from './news/news.module';
import { ReportModule } from './report/report.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 180,
      },
    ]),
    PrismaModule,
    StorageModule,
    RedisModule,
    AuthModule,
    NotificationModule,
    GamificationModule,
    GenreModule,
    UserModule,
    UploadModule,
    ModerationModule,
    ComicModule,
    ChapterModule,
    BookmarkModule,
    HistoryModule,
    CommentModule,
    RatingModule,
    NewsModule,
    ReportModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
