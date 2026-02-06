import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

import { PaymentType } from 'src/common/database/schemas';

export class CreateIncomeDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  source: string;

  @ApiProperty({ enum: PaymentType })
  @IsEnum(PaymentType)
  @IsNotEmpty()
  paymentType: PaymentType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;
}
