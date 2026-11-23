import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ComicStatus, ComicType, ContentRating } from '@prisma/client';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateComicDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên truyện' })
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  alternativeTitles?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(150)
  artistName?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(150)
  originalAuthor?: string;

  @IsOptional()
  @IsEnum(ComicType)
  type?: ComicType;

  @IsOptional()
  @IsEnum(ContentRating)
  contentRating?: ContentRating;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(10)
  originalLanguage?: string;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  releaseYear?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  genreIds?: string[];
}

export class UpdateComicDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Tên truyện không được để trống' })
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  alternativeTitles?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(150)
  artistName?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(150)
  originalAuthor?: string;

  @IsOptional()
  @IsEnum(ComicType)
  type?: ComicType;

  @IsOptional()
  @IsEnum(ComicStatus)
  status?: ComicStatus;

  @IsOptional()
  @IsEnum(ContentRating)
  contentRating?: ContentRating;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(10)
  originalLanguage?: string;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  releaseYear?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bannerPosition?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  genreIds?: string[];

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

export class ComicQueryDto {
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
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  genre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  genres?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  excludeGenres?: string;

  @IsOptional()
  @IsEnum(ComicType)
  type?: ComicType;

  @IsOptional()
  @IsEnum(ComicStatus)
  status?: ComicStatus;

  @IsOptional()
  @IsEnum(ContentRating)
  contentRating?: ContentRating;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(['updated', 'popular', 'weekly', 'monthly', 'rating', 'newest', 'bookmarks'])
  sort?: 'updated' | 'popular' | 'weekly' | 'monthly' | 'rating' | 'newest' | 'bookmarks' = 'updated';
}

export class RankingsQueryDto {
  @IsOptional()
  @IsIn(['day', 'week', 'month', 'all'])
  period?: 'day' | 'week' | 'month' | 'all' = 'week';

  @IsOptional()
  @IsIn(['views', 'rating', 'bookmarks', 'newest'])
  metric?: 'views' | 'rating' | 'bookmarks' | 'newest' = 'views';

  @IsOptional()
  @IsEnum(ComicType)
  type?: ComicType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class RecommendationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 6;

  @IsOptional()
  @IsUUID()
  comicId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  genres?: string;
}

export class RecordSearchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  query!: string;
}
