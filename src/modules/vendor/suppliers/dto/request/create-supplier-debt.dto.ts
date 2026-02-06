import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateSupplierDebtDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  orderId?: string;
}
