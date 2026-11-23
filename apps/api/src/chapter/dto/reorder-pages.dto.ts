import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class PageOrderItem {
  @IsUUID()
  pageId!: string;

  @IsInt()
  @Min(1)
  newOrder!: number;
}

export class ReorderPagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PageOrderItem)
  orders!: PageOrderItem[];
}
