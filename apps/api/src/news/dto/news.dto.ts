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
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { NewsCategory } from '@prisma/client';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const optionalCoverUrl = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export class CreateNewsDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tiêu đề bài viết' })
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1000)
  excerpt?: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Nội dung không được để trống' })
  @MaxLength(200000)
  content!: string;

  @IsOptional()
  @Transform(optionalCoverUrl)
  @IsString()
  @Matches(/^(\/uploads\/|https?:\/\/)/i, {
    message: 'Đường dẫn ảnh bìa chỉ chấp nhận /uploads/... hoặc http(s)://',
  })
  @MaxLength(500)
  coverUrl?: string | null;

  @IsOptional()
  @IsEnum(NewsCategory)
  category?: NewsCategory;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateNewsDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề bài viết không được để trống' })
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1000)
  excerpt?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Nội dung không được để trống' })
  @MaxLength(200000)
  content?: string;

  @IsOptional()
  @Transform(optionalCoverUrl)
  @IsString()
  @Matches(/^(\/uploads\/|https?:\/\/)/i, {
    message: 'Đường dẫn ảnh bìa chỉ chấp nhận /uploads/... hoặc http(s)://',
  })
  @MaxLength(500)
  coverUrl?: string | null;

  @IsOptional()
  @IsEnum(NewsCategory)
  category?: NewsCategory;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class NewsQueryDto {
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
  limit?: number = 12;

  @IsOptional()
  @IsEnum(NewsCategory)
  category?: NewsCategory;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  tag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(['published', 'draft', 'pinned'])
  status?: 'published' | 'draft' | 'pinned';
}

export class CreateNewsCommentDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Nội dung bình luận không được để trống' })
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
