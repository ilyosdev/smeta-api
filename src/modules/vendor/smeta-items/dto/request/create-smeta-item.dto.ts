import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

import { DataSource, SmetaItemCategory } from 'src/common/database/schemas';

export class CreateSmetaItemDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  smetaId: string;

  @ApiPropertyOptional({ enum: SmetaItemCategory })
  @IsEnum(SmetaItemCategory)
  @IsOptional()
  itemType?: SmetaItemCategory;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice: number;

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

  @ApiPropertyOptional({ enum: DataSource })
  @IsEnum(DataSource)
  @IsOptional()
  source?: DataSource;
}
