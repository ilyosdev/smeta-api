import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

import { ExpenseCategory, PaymentType } from 'src/common/database/schemas';

export class CreateExpenseDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  recipient: string;

  @ApiProperty({ enum: PaymentType })
  @IsEnum(PaymentType)
  @IsNotEmpty()
  paymentType: PaymentType;

  @ApiProperty({ enum: ExpenseCategory })
  @IsEnum(ExpenseCategory)
  @IsNotEmpty()
  category: ExpenseCategory;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  smetaItemId?: string;
}
