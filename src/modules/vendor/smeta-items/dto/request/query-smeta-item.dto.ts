import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { SmetaItemCategory } from 'src/common/database/schemas';

export class QuerySmetaItemDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  smetaId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ enum: SmetaItemCategory })
  @IsEnum(SmetaItemCategory)
  @IsOptional()
  itemType?: SmetaItemCategory;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number = 50;
}
