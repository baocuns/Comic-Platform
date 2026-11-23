import { Controller, Get, Post, Put, Delete, Param, Body, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookmarkService } from './bookmark.service';
import { BookmarkQueryDto, UpsertBookmarkDto } from './dto/bookmark.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Bookmarks')
@ApiBearerAuth()
@Controller('bookmarks')
export class BookmarkController {
  constructor(private readonly bookmarkService: BookmarkService) {}

  @Get()
  getMyBookmarks(@CurrentUser('sub') userId: string, @Query() query: BookmarkQueryDto) {
    return this.bookmarkService.getUserBookmarks(userId, query);
  }

  @Get('check/:comicId')
  check(
    @CurrentUser('sub') userId: string,
    @Param('comicId', new ParseUUIDPipe()) comicId: string,
  ) {
    return this.bookmarkService.check(userId, comicId);
  }

  @Post('toggle/:comicId')
  toggle(
    @CurrentUser('sub') userId: string,
    @Param('comicId', new ParseUUIDPipe()) comicId: string,
  ) {
    return this.bookmarkService.toggle(userId, comicId);
  }

  @Put(':comicId')
  upsert(
    @CurrentUser('sub') userId: string,
    @Param('comicId', new ParseUUIDPipe()) comicId: string,
    @Body() dto: UpsertBookmarkDto,
  ) {
    return this.bookmarkService.upsert(userId, comicId, dto);
  }

  @Delete(':comicId')
  remove(
    @CurrentUser('sub') userId: string,
    @Param('comicId', new ParseUUIDPipe()) comicId: string,
  ) {
    return this.bookmarkService.remove(userId, comicId);
  }
}
