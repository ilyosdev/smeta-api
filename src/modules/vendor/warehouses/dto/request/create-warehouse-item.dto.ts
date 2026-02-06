import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateWarehouseItemDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

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

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  smetaItemId?: string;
}
