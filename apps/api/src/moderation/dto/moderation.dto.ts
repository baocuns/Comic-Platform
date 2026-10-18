import { IsEnum, IsOptional, IsString, IsNotEmpty, IsInt, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ModerationTargetType, ApprovalStatus } from '@prisma/client';

export class PendingQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(ModerationTargetType)
  targetType?: ModerationTargetType;
}

export class RejectDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ModerationLogsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(ModerationTargetType)
  targetType?: ModerationTargetType;

  @IsOptional()
  @IsEnum(ApprovalStatus)
  action?: ApprovalStatus;
}

export class SetTrustDto {
  @IsBoolean()
  isTrusted!: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}
