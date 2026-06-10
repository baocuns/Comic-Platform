import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import * as sharp from 'sharp';

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

interface ProcessedImage {
  webp: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ── Upload Comic Cover ──

  async uploadCover(comicId: string, userId: string, file: UploadedFile): Promise<string> {
    const comic = await this.prisma.comic.findUnique({ where: { id: comicId } });
    if (!comic) throw new NotFoundException('Comic not found');
    if (comic.authorId !== userId) throw new ForbiddenException('Not the author');

    this.validateFile(file);

    const processed = await this.processImage(file.buffer, { width: 600, height: 850 });
    const key = `covers/${comicId}/cover.webp`;
    const url = await this.storage.upload(key, processed.webp, 'image/webp');

    // Upload thumbnail
    const thumbKey = `covers/${comicId}/thumb.webp`;
    await this.storage.upload(thumbKey, processed.thumbnail, 'image/webp');

    // Update comic
    await this.prisma.comic.update({
      where: { id: comicId },
      data: { coverUrl: url },
    });

    this.logger.log(`Cover uploaded for comic ${comicId}`);
    return url;
  }

  // ── Upload Comic Banner ──

  async uploadBanner(comicId: string, userId: string, file: UploadedFile): Promise<string> {
    const comic = await this.prisma.comic.findUnique({ where: { id: comicId } });
    if (!comic) throw new NotFoundException('Comic not found');
    if (comic.authorId !== userId) throw new ForbiddenException('Not the author');

    this.validateFile(file);

    // Resize to max width 1200px, preserve aspect ratio (no cropping)
    const webp = await sharp(file.buffer)
      .resize(1200, undefined, { withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const key = `banners/${comicId}/banner.webp`;
    const url = await this.storage.upload(key, webp, 'image/webp');

    await this.prisma.comic.update({
      where: { id: comicId },
      data: { bannerUrl: url },
    });

    this.logger.log(`Banner uploaded for comic ${comicId}`);
    return url;
  }

  // ── Upload Chapter Pages ──

  async uploadPages(chapterId: string, userId: string, files: UploadedFile[]): Promise<string[]> {
    if (!files.length) throw new BadRequestException('No files provided');

    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { comic: { select: { authorId: true } } },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    if (chapter.comic.authorId !== userId) throw new ForbiddenException('Not the author');

    // Delete existing pages if re-uploading
    const existingPages = await this.prisma.page.findMany({ where: { chapterId } });
    if (existingPages.length > 0) {
      for (const page of existingPages) {
        const key = page.imageUrl.split('/').slice(-3).join('/'); // extract key from URL
        await this.storage.delete(key).catch(() => {});
      }
      await this.prisma.page.deleteMany({ where: { chapterId } });
    }

    const urls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      this.validateFile(files[i]);

      const processed = await this.processImage(files[i].buffer, { width: 1200 });
      const key = `pages/${chapterId}/${String(i + 1).padStart(3, '0')}.webp`;
      const url = await this.storage.upload(key, processed.webp, 'image/webp');
      urls.push(url);

      // Create page record
      await this.prisma.page.create({
        data: {
          chapterId,
          pageNumber: i + 1,
          imageUrl: url,
          width: processed.width,
          height: processed.height,
        },
      });
    }

    // Update chapter page count
    await this.prisma.chapter.update({
      where: { id: chapterId },
      data: { totalPages: files.length },
    });

    this.logger.log(`${files.length} pages uploaded for chapter ${chapterId}`);
    return urls;
  }

  // ── Append Pages (add without deleting existing) ──

  async appendPages(chapterId: string, userId: string, files: UploadedFile[]): Promise<string[]> {
    if (!files.length) throw new BadRequestException('No files provided');

    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { comic: { select: { authorId: true } } },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    if (chapter.comic.authorId !== userId) throw new ForbiddenException('Not the author');

    // Get current max page number
    const existingPages = await this.prisma.page.findMany({
      where: { chapterId },
      orderBy: { pageNumber: 'desc' },
      take: 1,
    });
    const startNumber = existingPages.length > 0 ? existingPages[0].pageNumber + 1 : 1;

    const urls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      this.validateFile(files[i]);

      const pageNum = startNumber + i;
      const processed = await this.processImage(files[i].buffer, { width: 1200 });
      const key = `pages/${chapterId}/${String(pageNum).padStart(3, '0')}.webp`;
      const url = await this.storage.upload(key, processed.webp, 'image/webp');
      urls.push(url);

      await this.prisma.page.create({
        data: {
          chapterId,
          pageNumber: pageNum,
          imageUrl: url,
          width: processed.width,
          height: processed.height,
        },
      });
    }

    // Update chapter page count
    const totalPages = await this.prisma.page.count({ where: { chapterId } });
    await this.prisma.chapter.update({
      where: { id: chapterId },
      data: { totalPages },
    });

    this.logger.log(`${files.length} pages appended to chapter ${chapterId} (starting at page ${startNumber})`);
    return urls;
  }

  // ── Upload User Avatar ──

  async uploadUserAvatar(userId: string, file: UploadedFile): Promise<string> {
    this.validateFile(file);

    const processed = await this.processImage(file.buffer, { width: 400, height: 400 });
    const key = `avatars/${userId}/avatar.webp`;
    const url = await this.storage.upload(key, processed.webp, 'image/webp');

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url },
    });

    this.logger.log(`Avatar uploaded for user ${userId}`);
    return url;
  }

  // ── Upload User Banner ──

  async uploadUserBanner(userId: string, file: UploadedFile): Promise<string> {
    this.validateFile(file);

    const webp = await sharp(file.buffer)
      .resize(1400, undefined, { withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const key = `user-banners/${userId}/banner.webp`;
    const url = await this.storage.upload(key, webp, 'image/webp');

    await this.prisma.user.update({
      where: { id: userId },
      data: { banner: { url, position: 50 } },
    });

    this.logger.log(`Banner uploaded for user ${userId}`);
    return url;
  }

  // ── Image Processing ──

  private async processImage(buffer: Buffer, opts: { width: number; height?: number }): Promise<ProcessedImage> {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Main image → WebP
    const webp = await sharp(buffer)
      .resize(opts.width, opts.height, {
        fit: 'cover',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();

    // Thumbnail (300px wide)
    const thumbnail = await sharp(buffer)
      .resize(300, undefined, { withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    return {
      webp,
      thumbnail,
      width: metadata.width || opts.width,
      height: metadata.height || opts.height || 0,
    };
  }

  // ── Validation ──

  private validateFile(file: UploadedFile) {
    if (!this.ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type: ${file.mimetype}. Allowed: ${this.ALLOWED_TYPES.join(', ')}`);
    }
    if (file.buffer.length > this.MAX_FILE_SIZE) {
      throw new BadRequestException(`File too large. Max size: ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }
  }
}
