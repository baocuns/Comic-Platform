import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ReadingListStatus } from '@prisma/client';

export class UpsertBookmarkDto {
  @IsOptional()
  @IsEnum(ReadingListStatus)
  status?: ReadingListStatus;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyUpdate?: boolean;
}

export class BookmarkQueryDto {
  @IsOptional()
  @IsEnum(ReadingListStatus)
  status?: ReadingListStatus;

  @IsOptional()
  @IsIn(['true', 'false'])
  favoriteOnly?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 24;
}
