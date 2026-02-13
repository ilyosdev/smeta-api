import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class MarkDeliveredDto {
  @ApiProperty({ description: 'Delivered quantity' })
  @IsNumber()
  @Min(0)
  deliveredQty: number;

  @ApiPropertyOptional({ description: 'Delivery note' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Photo file ID from Telegram' })
  @IsString()
  @IsOptional()
  photoFileId?: string;
}
