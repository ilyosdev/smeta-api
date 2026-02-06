import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateManualPurchaseDto {
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  receiptUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;
}
