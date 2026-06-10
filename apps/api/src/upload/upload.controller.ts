import {
  Controller, Post, Param, UseGuards, UseInterceptors,
  UploadedFile, UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('comics/:comicId/cover')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCover(
    @Param('comicId') comicId: string,
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const url = await this.uploadService.uploadCover(comicId, userId, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });
    return { success: true, data: { url } };
  }

  @Post('comics/:comicId/banner')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBanner(
    @Param('comicId') comicId: string,
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const url = await this.uploadService.uploadBanner(comicId, userId, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });
    return { success: true, data: { url } };
  }

  @Post('chapters/:chapterId/pages')
  @UseInterceptors(FilesInterceptor('files', 100))
  async uploadPages(
    @Param('chapterId') chapterId: string,
    @CurrentUser('sub') userId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const uploadedFiles = files.map((f) => ({
      buffer: f.buffer,
      originalname: f.originalname,
      mimetype: f.mimetype,
    }));
    const urls = await this.uploadService.uploadPages(chapterId, userId, uploadedFiles);
    return { success: true, data: { urls, count: urls.length } };
  }

  @Post('chapters/:chapterId/pages/append')
  @UseInterceptors(FilesInterceptor('files', 100))
  async appendPages(
    @Param('chapterId') chapterId: string,
    @CurrentUser('sub') userId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const uploadedFiles = files.map((f) => ({
      buffer: f.buffer,
      originalname: f.originalname,
      mimetype: f.mimetype,
    }));
    const urls = await this.uploadService.appendPages(chapterId, userId, uploadedFiles);
    return { success: true, data: { urls, count: urls.length } };
  }

  @Post('users/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadUserAvatar(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const url = await this.uploadService.uploadUserAvatar(userId, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });
    return { success: true, data: { url } };
  }

  @Post('users/banner')
  @UseInterceptors(FileInterceptor('file'))
  async uploadUserBanner(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const url = await this.uploadService.uploadUserBanner(userId, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });
    return { success: true, data: { url } };
  }
}

