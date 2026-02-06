import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ExpenseCategory, PaymentType } from 'src/common/database/schemas';

export class ExpenseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  recipient: string;

  @ApiProperty({ enum: PaymentType })
  paymentType: PaymentType;

  @ApiProperty({ enum: ExpenseCategory })
  category: ExpenseCategory;

  @ApiPropertyOptional()
  note: string | null;

  @ApiPropertyOptional()
  smetaItemId: string | null;

  @ApiProperty()
  recordedById: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  project?: {
    id: string;
    name: string;
  };

  @ApiPropertyOptional()
  recordedBy?: {
    id: string;
    name: string;
  };

  @ApiPropertyOptional()
  smetaItem?: {
    id: string;
    name: string;
  };
}

export class PaginatedExpenseResponseDto {
  @ApiProperty({ type: [ExpenseResponseDto] })
  data: ExpenseResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
