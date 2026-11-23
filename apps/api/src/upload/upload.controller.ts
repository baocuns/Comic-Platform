import {
  Controller,
  Post,
  Param,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { UploadService, UploadedFilePayload } from './upload.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const SINGLE_IMAGE_LIMITS = { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } };
const BULK_PAGE_LIMITS = { limits: { fileSize: MAX_IMAGE_BYTES, files: 50 } };

@ApiTags('Uploads')
@ApiBearerAuth()
@Throttle({ default: { limit: 40, ttl: 60000 } })
@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Roles(UserRole.AUTHOR)
  @Post('comics/:comicId/cover')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', SINGLE_IMAGE_LIMITS))
  uploadCover(
    @Param('comicId', new ParseUUIDPipe()) comicId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
    @UploadedFile() file: UploadedFilePayload,
  ) {
    return this.uploadService.uploadCover(comicId, userId, role, file);
  }

  @Roles(UserRole.AUTHOR)
  @Post('comics/:comicId/banner')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', SINGLE_IMAGE_LIMITS))
  uploadBanner(
    @Param('comicId', new ParseUUIDPipe()) comicId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
    @UploadedFile() file: UploadedFilePayload,
  ) {
    return this.uploadService.uploadBanner(comicId, userId, role, file);
  }

  @Roles(UserRole.AUTHOR)
  @Post('chapters/:chapterId/pages')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 50, BULK_PAGE_LIMITS))
  uploadPages(
    @Param('chapterId', new ParseUUIDPipe()) chapterId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
    @UploadedFiles() files: UploadedFilePayload[],
  ) {
    return this.uploadService.uploadPages(chapterId, userId, role, files, false);
  }

  @Roles(UserRole.AUTHOR)
  @Post('chapters/:chapterId/pages/append')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 50, BULK_PAGE_LIMITS))
  appendPages(
    @Param('chapterId', new ParseUUIDPipe()) chapterId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
    @UploadedFiles() files: UploadedFilePayload[],
  ) {
    return this.uploadService.uploadPages(chapterId, userId, role, files, true);
  }

  @Post('users/me/avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', SINGLE_IMAGE_LIMITS))
  uploadAvatar(@CurrentUser('sub') userId: string, @UploadedFile() file: UploadedFilePayload) {
    return this.uploadService.uploadUserAvatar(userId, file);
  }

  @Post('users/me/banner')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', SINGLE_IMAGE_LIMITS))
  uploadUserBanner(@CurrentUser('sub') userId: string, @UploadedFile() file: UploadedFilePayload) {
    return this.uploadService.uploadUserBanner(userId, file);
  }

  @Roles(UserRole.AUTHOR)
  @Post('news/cover')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', SINGLE_IMAGE_LIMITS))
  uploadNewsCover(@UploadedFile() file: UploadedFilePayload) {
    return this.uploadService.uploadNewsCover(file);
  }

  @Roles(UserRole.AUTHOR)
  @Post('news/content')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', SINGLE_IMAGE_LIMITS))
  uploadNewsContentImage(@UploadedFile() file: UploadedFilePayload) {
    return this.uploadService.uploadNewsContentImage(file);
  }
}
