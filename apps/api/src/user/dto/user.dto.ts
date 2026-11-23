import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimOptionalUrl = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class UpdateProfileDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Tên hiển thị không được để trống' })
  @MinLength(2, { message: 'Tên hiển thị cần tối thiểu 2 ký tự' })
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}

export class UpdateBannerPositionDto {
  @IsInt()
  @Min(0)
  @Max(100)
  position!: number;
}

export class SubmitAuthorApplicationDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập bút danh' })
  @MinLength(2, { message: 'Bút danh cần tối thiểu 2 ký tự' })
  @MaxLength(100)
  penName!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng giới thiệu bản thân và định hướng sáng tác' })
  @MinLength(20, { message: 'Phần giới thiệu cần tối thiểu 20 ký tự' })
  @MaxLength(1500)
  bio!: string;

  @IsOptional()
  @Transform(trimOptionalUrl)
  @IsString()
  @Matches(/^https?:\/\/\S+$/i, {
    message: 'Đường dẫn Portfolio phải bắt đầu bằng http:// hoặc https://',
  })
  @MaxLength(500)
  portfolioUrl?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(255)
  sampleWorkTitle?: string;

  @IsOptional()
  @Transform(trimOptionalUrl)
  @IsString()
  @Matches(/^https?:\/\/\S+$/i, {
    message: 'Đường dẫn bản mẫu phải bắt đầu bằng http:// hoặc https://',
  })
  @MaxLength(500)
  sampleWorkLink?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1000)
  experience?: string;
}
