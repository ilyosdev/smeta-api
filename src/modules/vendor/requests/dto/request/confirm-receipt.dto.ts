import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ConfirmReceiptDto {
  @ApiProperty({ description: 'Received quantity' })
  @IsNumber()
  @Min(0)
  receivedQty: number;

  @ApiPropertyOptional({ description: 'Receipt note' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Photo file ID from Telegram' })
  @IsString()
  @IsOptional()
  photoFileId?: string;
}
