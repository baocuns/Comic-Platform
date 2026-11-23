import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ApprovalStatus, ComicStatus } from '@prisma/client';
import slugify from 'slugify';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateGenreDto, UpdateGenreDto } from './dto/genre.dto';

@Injectable()
export class GenreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll(includeInactive = false) {
    if (!includeInactive) {
      const cached = await this.redis.get('genres:active');
      if (cached) return cached;
    }

    const genres = await this.prisma.genre.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    if (!includeInactive) {
      await this.redis.set('genres:active', genres, 1800);
    }

    return genres;
  }

  async create(dto: CreateGenreDto) {
    const slug =
      dto.slug?.trim() ||
      slugify(dto.name, { lower: true, strict: true, locale: 'vi' }) ||
      `genre-${Date.now()}`;

    const existing = await this.prisma.genre.findFirst({
      where: { OR: [{ name: dto.name.trim() }, { slug }] },
    });
    if (existing) {
      throw new ConflictException('Thể loại hoặc slug đã tồn tại');
    }

    const genre = await this.prisma.genre.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        displayOrder: dto.displayOrder ?? 0,
      },
    });

    await this.redis.del('genres:active');
    return genre;
  }

  async update(id: string, dto: UpdateGenreDto) {
    const existing = await this.prisma.genre.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy thể loại');

    const updated = await this.prisma.genre.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.invalidateGenreCaches();
    return updated;
  }

  async remove(id: string) {
    const existing = await this.prisma.genre.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy thể loại');

    await this.prisma.genre.delete({ where: { id } });
    await this.invalidateGenreCaches();
    return { deleted: true };
  }

  private async invalidateGenreCaches() {
    await Promise.all([
      this.redis.del('genres:active'),
      this.redis.deletePattern('comic:*'),
      this.redis.deletePattern('homepage*'),
      this.redis.deletePattern('rankings*'),
      this.redis.deletePattern('rec:*'),
    ]);
  }

  async recalculateCounts(genreIds?: string[]) {
    const targetIds = genreIds?.length
      ? genreIds
      : (await this.prisma.genre.findMany({ select: { id: true } })).map((g) => g.id);

    for (const genreId of targetIds) {
      const count = await this.prisma.comicGenre.count({
        where: {
          genreId,
          comic: {
            deletedAt: null,
            approvalStatus: ApprovalStatus.APPROVED,
            status: { not: ComicStatus.DRAFT },
          },
        },
      });
      await this.prisma.genre.update({
        where: { id: genreId },
        data: { comicCount: count },
      });
    }

    await this.redis.del('genres:active');
  }
}
