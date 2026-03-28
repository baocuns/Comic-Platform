import { IsOptional, IsString, MaxLength, IsObject, IsNumber, Min, Max } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;
}

export class UpdateBannerPositionDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  position!: number;
}
