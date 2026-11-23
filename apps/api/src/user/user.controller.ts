import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { UpdateBannerPositionDto, UpdateProfileDto, SubmitAuthorApplicationDto } from './dto/user.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiBearerAuth()
  @Put('me')
  updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(userId, dto);
  }

  @ApiBearerAuth()
  @Get('me/author-application')
  getMyAuthorApplication(@CurrentUser('sub') userId: string) {
    return this.userService.getMyAuthorApplication(userId);
  }

  @ApiBearerAuth()
  @Post('me/author-application')
  submitAuthorApplication(
    @CurrentUser('sub') userId: string,
    @Body() dto: SubmitAuthorApplicationDto,
  ) {
    return this.userService.submitAuthorApplication(userId, dto);
  }

  @ApiBearerAuth()
  @Patch('me/banner-position')
  updateBannerPosition(@CurrentUser('sub') userId: string, @Body() dto: UpdateBannerPositionDto) {
    return this.userService.updateBannerPosition(userId, dto);
  }

  @ApiBearerAuth()
  @Delete('me/banner')
  removeBanner(@CurrentUser('sub') userId: string) {
    return this.userService.removeBanner(userId);
  }

  @ApiBearerAuth()
  @Get('me/stats')
  getMyStats(@CurrentUser('sub') userId: string) {
    return this.userService.getStats(userId);
  }

  @Public()
  @Get(':username')
  getPublicProfile(@Param('username') username: string, @CurrentUser('sub') viewerId?: string) {
    return this.userService.getPublicProfile(username, viewerId);
  }

  @ApiBearerAuth()
  @Post(':id/follow')
  followUser(
    @CurrentUser('sub') followerId: string,
    @Param('id', new ParseUUIDPipe()) followingId: string,
  ) {
    return this.userService.followUser(followerId, followingId);
  }

  @ApiBearerAuth()
  @Delete(':id/follow')
  unfollowUser(
    @CurrentUser('sub') followerId: string,
    @Param('id', new ParseUUIDPipe()) followingId: string,
  ) {
    return this.userService.unfollowUser(followerId, followingId);
  }

  @Public()
  @Get(':id/followers')
  getFollowers(
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.userService.getFollowers(userId, Number(page) || 1, Number(limit) || 20);
  }

  @Public()
  @Get(':id/following')
  getFollowing(
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.userService.getFollowing(userId, Number(page) || 1, Number(limit) || 20);
  }
}
