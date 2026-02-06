import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class CreateWarehouseTransferDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  fromWarehouseId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  toWarehouseId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  itemName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  quantity: number;
}
