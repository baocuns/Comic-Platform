import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as sharp from 'sharp';
import { ApprovalStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { RedisService } from '../redis/redis.service';
import { GenreService } from '../genre/genre.service';

export interface UploadedFilePayload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly MAX_FILE_SIZE = 12 * 1024 * 1024;
  private readonly MAX_INPUT_PIXELS = 25_000_000;
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  private readonly ALLOWED_SHARP_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif']);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly redis: RedisService,
    private readonly genreService: GenreService,
  ) {}

  private async validateImagePayload(file?: UploadedFilePayload) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Không có tệp ảnh nào được tải lên');
    }
    if (!this.ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Định dạng ảnh không hợp lệ (chỉ hỗ trợ JPG, PNG, WebP, GIF)');
    }
    if (file.buffer.length === 0 || file.buffer.length > this.MAX_FILE_SIZE) {
      throw new BadRequestException('Kích thước tệp vượt quá giới hạn 12MB');
    }

    try {
      const metadata = await sharp(file.buffer, {
        limitInputPixels: this.MAX_INPUT_PIXELS,
        failOn: 'error',
      }).metadata();
      if (!metadata.format || !this.ALLOWED_SHARP_FORMATS.has(metadata.format)) {
        throw new BadRequestException('Định dạng ảnh thực tế không được hỗ trợ (chỉ hỗ trợ JPG, PNG, WebP, GIF)');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Tệp ảnh bị hỏng, quá lớn độ phân giải hoặc không hợp lệ');
    }
  }

  private async transformImage(
    buffer: Buffer,
    width: number,
    height?: number,
    quality = 86,
    fit: keyof sharp.FitEnum = 'cover',
  ) {
    try {
      return await sharp(buffer, { limitInputPixels: this.MAX_INPUT_PIXELS, failOn: 'error' })
        .resize(width, height, height ? { fit, withoutEnlargement: true } : { withoutEnlargement: true })
        .webp({ quality })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new BadRequestException('Không thể xử lý tệp ảnh đã chọn');
    }
  }

  private async isAutoApproveExempt(userId: string, userRole: UserRole): Promise<boolean> {
    if (userRole === UserRole.ADMIN || userRole === UserRole.MODERATOR) return true;
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isTrusted: true },
    });
    return u?.isTrusted === true;
  }

  private async ensureComicOwnership(comicId: string, userId: string, userRole?: UserRole) {
    const comic = await this.prisma.comic.findUnique({
      where: { id: comicId },
      include: { genres: { select: { genreId: true } } },
    });
    if (!comic || comic.deletedAt) throw new NotFoundException('Không tìm thấy truyện');
    if (comic.authorId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa truyện này');
    }
    return comic;
  }

  async uploadCover(comicId: string, userId: string, userRole: UserRole, file: UploadedFilePayload) {
    const comic = await this.ensureComicOwnership(comicId, userId, userRole);
    await this.validateImagePayload(file);

    const { data: webp } = await this.transformImage(file.buffer, 600, 850, 88, 'cover');
    const key = `covers/${comicId}/${crypto.randomUUID()}.webp`;
    const url = await this.storage.upload(key, webp, 'image/webp');

    const requiresReReview =
      comic.approvalStatus === ApprovalStatus.APPROVED &&
      !(await this.isAutoApproveExempt(userId, userRole));

    try {
      await this.prisma.comic.update({
        where: { id: comicId },
        data: {
          coverUrl: url,
          ...(requiresReReview && {
            approvalStatus: ApprovalStatus.PENDING_APPROVAL,
            rejectionReason: null,
          }),
        },
      });
    } catch (err) {
      await this.storage.delete(key).catch(() => {});
      throw err;
    }

    await this.storage.deleteByUrl(comic.coverUrl);
    if (requiresReReview) {
      await this.genreService.recalculateCounts(comic.genres.map((g) => g.genreId)).catch(() => {});
      await this.redis.deletePattern('rankings*').catch(() => {});
    }
    await this.redis.del(`comic:${comic.slug}`);
    await this.redis.deletePattern('homepage*');

    return { url, requiresReReview };
  }

  async uploadBanner(comicId: string, userId: string, userRole: UserRole, file: UploadedFilePayload) {
    const comic = await this.ensureComicOwnership(comicId, userId, userRole);
    await this.validateImagePayload(file);

    const { data: webp } = await this.transformImage(file.buffer, 1400, undefined, 86);
    const key = `banners/${comicId}/${crypto.randomUUID()}.webp`;
    const url = await this.storage.upload(key, webp, 'image/webp');

    const requiresReReview =
      comic.approvalStatus === ApprovalStatus.APPROVED &&
      !(await this.isAutoApproveExempt(userId, userRole));

    try {
      await this.prisma.comic.update({
        where: { id: comicId },
        data: {
          bannerUrl: url,
          ...(requiresReReview && {
            approvalStatus: ApprovalStatus.PENDING_APPROVAL,
            rejectionReason: null,
          }),
        },
      });
    } catch (err) {
      await this.storage.delete(key).catch(() => {});
      throw err;
    }

    await this.storage.deleteByUrl(comic.bannerUrl);
    if (requiresReReview) {
      await this.genreService.recalculateCounts(comic.genres.map((g) => g.genreId)).catch(() => {});
      await this.redis.deletePattern('rankings*').catch(() => {});
    }
    await this.redis.del(`comic:${comic.slug}`);
    await this.redis.deletePattern('homepage*');

    return { url, requiresReReview };
  }

  async uploadPages(
    chapterId: string,
    userId: string,
    userRole: UserRole,
    files: UploadedFilePayload[],
    append = false,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một trang ảnh');
    }

    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { comic: { select: { id: true, authorId: true, slug: true, deletedAt: true } } },
    });
    if (!chapter || chapter.deletedAt || chapter.comic.deletedAt) {
      throw new NotFoundException('Không tìm thấy chương');
    }
    if (chapter.comic.authorId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Bạn không có quyền tải trang cho chương này');
    }

    // 1. Validate & encode ALL images before mutating storage or DB
    const processed: Array<{
      webp: Buffer;
      thumb: Buffer;
      width?: number;
      height?: number;
    }> = [];

    for (const f of files) {
      await this.validateImagePayload(f);
      try {
        const base = sharp(f.buffer, {
          limitInputPixels: this.MAX_INPUT_PIXELS,
          failOn: 'error',
        });
        const [{ data: webp, info }, { data: thumb }] = await Promise.all([
          base.clone().resize(1280, undefined, { withoutEnlargement: true }).webp({ quality: 86 }).toBuffer({ resolveWithObject: true }),
          base.clone().resize(280, undefined, { withoutEnlargement: true }).webp({ quality: 72 }).toBuffer({ resolveWithObject: true }),
        ]);
        processed.push({ webp, thumb, width: info.width, height: info.height });
      } catch {
        throw new BadRequestException(`Không thể xử lý tệp ảnh "${f.originalname || 'trang'}"`);
      }
    }

    // 2. Upload all new blobs; clean up all new keys on any upload or DB failure
    const uploadedKeys: string[] = [];
    const uploadedPages: Array<{
      imageUrl: string;
      thumbnailUrl: string;
      width?: number;
      height?: number;
      fileSize: number;
    }> = [];

    try {
      for (const item of processed) {
        const fileId = crypto.randomUUID();
        const mainKey = `pages/${chapterId}/${fileId}.webp`;
        const thumbKey = `pages/${chapterId}/${fileId}-thumb.webp`;
        const [imageUrl, thumbnailUrl] = await Promise.all([
          this.storage.upload(mainKey, item.webp, 'image/webp').then((u) => {
            uploadedKeys.push(mainKey);
            return u;
          }),
          this.storage.upload(thumbKey, item.thumb, 'image/webp').then((u) => {
            uploadedKeys.push(thumbKey);
            return u;
          }),
        ]);
        uploadedPages.push({
          imageUrl,
          thumbnailUrl,
          width: item.width,
          height: item.height,
          fileSize: item.webp.length,
        });
      }

      const requiresReReview =
        chapter.approvalStatus === ApprovalStatus.APPROVED &&
        !(await this.isAutoApproveExempt(userId, userRole));

      // 3. Atomic DB swap/append under row lock
      const dbResult = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM chapters WHERE id = ${chapterId}::uuid FOR UPDATE`;

        let oldUrls: string[] = [];
        let startNumber = 1;

        if (!append) {
          const existingPages = await tx.page.findMany({
            where: { chapterId },
            select: { imageUrl: true, thumbnailUrl: true },
          });
          oldUrls = existingPages.flatMap((p) =>
            [p.imageUrl, p.thumbnailUrl].filter((u): u is string => Boolean(u)),
          );
          await tx.page.deleteMany({ where: { chapterId } });
        } else {
          const lastPage = await tx.page.findFirst({
            where: { chapterId },
            orderBy: { pageNumber: 'desc' },
            select: { pageNumber: true },
          });
          startNumber = lastPage ? lastPage.pageNumber + 1 : 1;
        }

        await tx.page.createMany({
          data: uploadedPages.map((p, idx) => ({
            chapterId,
            pageNumber: startNumber + idx,
            imageUrl: p.imageUrl,
            thumbnailUrl: p.thumbnailUrl,
            width: p.width,
            height: p.height,
            fileSize: p.fileSize,
          })),
        });

        const createdPages = await tx.page.findMany({
          where: { chapterId, pageNumber: { gte: startNumber } },
          orderBy: { pageNumber: 'asc' },
        });
        const totalPages = await tx.page.count({ where: { chapterId } });

        await tx.chapter.update({
          where: { id: chapterId },
          data: {
            totalPages,
            ...(requiresReReview && {
              approvalStatus: ApprovalStatus.PENDING_APPROVAL,
              rejectionReason: null,
            }),
          },
        });

        if (requiresReReview) {
          const remainingApproved = await tx.chapter.findMany({
            where: {
              comicId: chapter.comic.id,
              deletedAt: null,
              approvalStatus: ApprovalStatus.APPROVED,
            },
            orderBy: { publishedAt: 'desc' },
            select: { publishedAt: true },
          });
          await tx.comic.update({
            where: { id: chapter.comic.id },
            data: {
              totalChapters: remainingApproved.length,
              lastChapterAt: remainingApproved[0]?.publishedAt || null,
            },
          });
        }

        return { createdPages, totalPages, oldUrls };
      });

      // 4. Delete superseded storage files AFTER transaction commits
      if (dbResult.oldUrls.length > 0) {
        await Promise.allSettled(dbResult.oldUrls.map((u) => this.storage.deleteByUrl(u)));
      }

      await this.redis.del(`comic:${chapter.comic.slug}`);
      if (requiresReReview) {
        await Promise.all([
          this.redis.deletePattern('homepage*').catch(() => {}),
          this.redis.deletePattern('rankings*').catch(() => {}),
        ]);
      }

      this.logger.log(
        `Uploaded ${dbResult.createdPages.length} pages to chapter ${chapterId} (append=${append})`,
      );

      return { pages: dbResult.createdPages, totalPages: dbResult.totalPages, requiresReReview };
    } catch (err) {
      await Promise.allSettled(uploadedKeys.map((k) => this.storage.delete(k)));
      throw err;
    }
  }

  async uploadUserAvatar(userId: string, file: UploadedFilePayload) {
    await this.validateImagePayload(file);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });

    const { data: webp } = await this.transformImage(file.buffer, 400, 400, 86, 'cover');
    const key = `avatars/${userId}/${crypto.randomUUID()}.webp`;
    const url = await this.storage.upload(key, webp, 'image/webp');

    try {
      await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: url } });
    } catch (err) {
      await this.storage.delete(key).catch(() => {});
      throw err;
    }
    await this.storage.deleteByUrl(user?.avatarUrl);

    return { url };
  }

  async uploadUserBanner(userId: string, file: UploadedFilePayload) {
    await this.validateImagePayload(file);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { bannerUrl: true } });

    const { data: webp } = await this.transformImage(file.buffer, 1400, undefined, 86);
    const key = `user-banners/${userId}/${crypto.randomUUID()}.webp`;
    const url = await this.storage.upload(key, webp, 'image/webp');

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { bannerUrl: url, bannerPosition: 50 },
      });
    } catch (err) {
      await this.storage.delete(key).catch(() => {});
      throw err;
    }
    await this.storage.deleteByUrl(user?.bannerUrl);

    return { url, position: 50 };
  }

  async uploadNewsCover(file: UploadedFilePayload) {
    await this.validateImagePayload(file);
    const { data: webp } = await this.transformImage(file.buffer, 1200, 675, 86, 'cover');
    const url = await this.storage.upload(`news/covers/${crypto.randomUUID()}.webp`, webp, 'image/webp');
    return { url };
  }

  async uploadNewsContentImage(file: UploadedFilePayload) {
    await this.validateImagePayload(file);
    const { data: webp } = await this.transformImage(file.buffer, 1400, undefined, 86);
    const url = await this.storage.upload(`news/content/${crypto.randomUUID()}.webp`, webp, 'image/webp');
    return { url };
  }
}
