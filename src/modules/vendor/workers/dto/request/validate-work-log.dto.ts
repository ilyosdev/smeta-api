import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class ValidateWorkLogDto {
  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalAmount?: number;
}
