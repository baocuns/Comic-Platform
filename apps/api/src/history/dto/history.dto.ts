import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpsertHistoryDto {
  @IsUUID()
  comicId!: string;

  @IsUUID()
  chapterId!: string;

  @IsInt()
  @Min(1)
  @Max(10000)
  lastPage!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  totalPages?: number;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  readingTimeSeconds?: number;
}

export class SyncHistoryDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => UpsertHistoryDto)
  items!: UpsertHistoryDto[];
}
