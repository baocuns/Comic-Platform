import { IsOptional, IsEnum, IsNumberString, IsBooleanString } from 'class-validator';
import { NotificationType } from '@prisma/client';

export class NotificationQueryDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}
