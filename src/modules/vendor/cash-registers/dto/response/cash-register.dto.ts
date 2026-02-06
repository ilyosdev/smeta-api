import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { CashTransactionType } from 'src/common/database/schemas/cash-registers';

export class CashRegisterResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  balance: number;

  @ApiProperty()
  totalIn: number;

  @ApiProperty()
  totalOut: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  user?: {
    id: string;
    name: string;
  };
}

export class PaginatedCashRegisterResponseDto {
  @ApiProperty({ type: [CashRegisterResponseDto] })
  data: CashRegisterResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class CashTransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  cashRegisterId: string;

  @ApiProperty({ enum: CashTransactionType })
  type: CashTransactionType;

  @ApiProperty()
  amount: number;

  @ApiPropertyOptional()
  note: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class PaginatedCashTransactionResponseDto {
  @ApiProperty({ type: [CashTransactionResponseDto] })
  data: CashTransactionResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
