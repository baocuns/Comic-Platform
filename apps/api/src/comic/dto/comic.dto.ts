import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum, IsNumber, MaxLength } from 'class-validator';
import { ComicStatus, ContentRating } from '@prisma/client';

export class CreateComicDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  genreIds?: string[];

  @IsEnum(ContentRating)
  @IsOptional()
  contentRating?: ContentRating;

  @IsString()
  @IsOptional()
  originalLanguage?: string;
}

export class UpdateComicDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  genreIds?: string[];

  @IsEnum(ComicStatus)
  @IsOptional()
  status?: ComicStatus;

  @IsEnum(ContentRating)
  @IsOptional()
  contentRating?: ContentRating;

  @IsNumber()
  @IsOptional()
  bannerPosition?: number;
}

export class ComicQueryDto {
  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsEnum(ComicStatus)
  status?: ComicStatus;

  @IsOptional()
  @IsString()
  sort?: 'latest' | 'popular' | 'rating' | 'updated';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}

export class RecommendationQueryDto {
  @IsOptional()
  @IsString()
  comicId?: string;

  @IsOptional()
  @IsString()
  genres?: string;

  @IsOptional()
  limit?: number;
}

export class RecordSearchDto {
  @IsString()
  @IsNotEmpty()
  query!: string;
}

