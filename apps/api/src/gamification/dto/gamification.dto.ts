import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export const GAMIFICATION_CONFIG_BOUNDS: Record<string, { min: number; max: number }> = {
  xp_daily_login: { min: 0, max: 100_000 },
  coin_daily_login: { min: 0, max: 100_000 },
  xp_streak_bonus: { min: 0, max: 100_000 },
  coin_streak_7_bonus: { min: 0, max: 100_000 },
  streak_max_days: { min: 1, max: 365 },
  xp_read_chapter: { min: 0, max: 100_000 },
  coin_read_chapter: { min: 0, max: 100_000 },
  xp_comment: { min: 0, max: 100_000 },
  xp_rate: { min: 0, max: 100_000 },
  coin_rate: { min: 0, max: 100_000 },
  xp_bookmark: { min: 0, max: 100_000 },
  coin_level_up: { min: 0, max: 100_000 },
  coin_welcome: { min: 0, max: 100_000 },
  author_revenue_percent: { min: 0, max: 100 },
};

export const ALLOWED_GAMIFICATION_KEYS = Object.keys(GAMIFICATION_CONFIG_BOUNDS);

export class GamificationConfigUpdateItemDto {
  @IsString()
  @IsIn(ALLOWED_GAMIFICATION_KEYS, { message: 'Khóa cấu hình không hợp lệ' })
  key!: string;

  @IsInt({ message: 'Giá trị cấu hình phải là số nguyên' })
  @Min(0)
  value!: number;
}

export class UpdateGamificationConfigDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => GamificationConfigUpdateItemDto)
  updates!: GamificationConfigUpdateItemDto[];
}
