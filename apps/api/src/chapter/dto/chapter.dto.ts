import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateChapterDto {
  @IsNumber()
  @Min(0)
  @Max(99999999)
  number!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  priceCoins?: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateChapterDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  number?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  priceCoins?: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
