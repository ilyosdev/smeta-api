import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class MarkCollectedDto {
  @ApiProperty({ description: 'Collected quantity' })
  @IsNumber()
  @Min(0)
  collectedQty: number;

  @ApiPropertyOptional({ description: 'Collection note' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Photo file ID from Telegram' })
  @IsString()
  @IsOptional()
  photoFileId?: string;
}
