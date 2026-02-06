import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateRequestDto {
  @ApiPropertyOptional({ description: 'Requested quantity', example: 100 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  requestedQty?: number;

  @ApiPropertyOptional({ description: 'Requested amount', example: 50000 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  requestedAmount?: number;

  @ApiPropertyOptional({ description: 'Note', example: 'Urgent order needed' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Is overrun request' })
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
