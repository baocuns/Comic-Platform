import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum, IsBoolean, MaxLength } from 'class-validator';
import { NewsCategory } from '@prisma/client';

export class CreateNewsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  excerpt?: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsString()
  @IsOptional()
  coverUrl?: string;

  @IsEnum(NewsCategory)
  @IsOptional()
  category?: NewsCategory;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

export class UpdateNewsDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  excerpt?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  coverUrl?: string;

  @IsEnum(NewsCategory)
  @IsOptional()
  category?: NewsCategory;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

export class NewsQueryDto {
  @IsOptional()
  @IsEnum(NewsCategory)
  category?: NewsCategory;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  authorId?: string;

  @IsOptional()
  includeDrafts?: boolean | string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
