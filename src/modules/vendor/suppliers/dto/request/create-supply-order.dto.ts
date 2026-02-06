import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class CreateSupplyOrderItemDto {
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

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  smetaItemId?: string;
}

export class CreateSupplyOrderDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({ type: [CreateSupplyOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSupplyOrderItemDto)
  items: CreateSupplyOrderItemDto[];
}
