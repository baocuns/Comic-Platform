import { IsArray, ValidateNested, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class PageOrderItem {
  @IsString()
  pageId!: string;

  @IsNumber()
  newOrder!: number;
}

export class ReorderPagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageOrderItem)
  orders!: PageOrderItem[];
}
