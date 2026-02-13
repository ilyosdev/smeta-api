import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class FinalizeRequestDto {
  @ApiProperty({ description: 'Final total amount (price)' })
  @IsNumber()
  @Min(0)
  finalAmount: number;

  @ApiPropertyOptional({ description: 'Final unit price' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  finalUnitPrice?: number;

  @ApiPropertyOptional({ description: 'Finalization note' })
  @IsString()
  @IsOptional()
  note?: string;
}
