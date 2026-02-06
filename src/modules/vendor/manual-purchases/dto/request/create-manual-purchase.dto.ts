import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

import { DataSource } from 'src/common/database/schemas';

export class CreateManualPurchaseDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  smetaItemId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  receiptUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({ enum: DataSource })
  @IsEnum(DataSource)
  @IsNotEmpty()
  source: DataSource;
}
