import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

import { SmetaItemCategory } from 'src/common/database/schemas';

export class UpdateSmetaItemDto {
  @ApiPropertyOptional({ enum: SmetaItemCategory })
  @IsEnum(SmetaItemCategory)
  @IsOptional()
  itemType?: SmetaItemCategory;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  usedQuantity?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  usedAmount?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  percentRate?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  machineType?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  laborHours?: number;
}
