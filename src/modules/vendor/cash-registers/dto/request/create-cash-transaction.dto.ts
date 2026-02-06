import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

import { CashTransactionType } from 'src/common/database/schemas/cash-registers';

export class CreateCashTransactionDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  cashRegisterId: string;

  @ApiProperty({ enum: CashTransactionType })
  @IsEnum(CashTransactionType)
  @IsNotEmpty()
  type: CashTransactionType;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;
}
