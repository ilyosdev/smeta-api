import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

import { DataSource } from 'src/common/database/schemas';

export class CreateRequestDto {
  @ApiPropertyOptional({ description: 'Batch ID to group multiple requests', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  batchId?: string;

  @ApiProperty({ description: 'Smeta item ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  smetaItemId: string;

  @ApiProperty({ description: 'Requested quantity', example: 100 })
  @IsNumber()
  @Min(0)
  requestedQty: number;

  @ApiProperty({ description: 'Requested amount', example: 50000 })
  @IsNumber()
  @Min(0)
  requestedAmount: number;

  @ApiPropertyOptional({ description: 'Note', example: 'Urgent order needed' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({ enum: DataSource, description: 'Source of request' })
  @IsEnum(DataSource)
  source: DataSource;

  @ApiPropertyOptional({ description: 'Is overrun request', default: false })
  @IsBoolean()
  @IsOptional()
  isOverrun?: boolean;

  @ApiPropertyOptional({ description: 'Overrun quantity', example: 10 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  overrunQty?: number;

  @ApiPropertyOptional({ description: 'Overrun percentage', example: 5.5 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  overrunPercent?: number;
}
