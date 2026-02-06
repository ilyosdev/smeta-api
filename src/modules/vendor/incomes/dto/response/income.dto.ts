import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PaymentType } from 'src/common/database/schemas';

export class IncomeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  source: string;

  @ApiProperty({ enum: PaymentType })
  paymentType: PaymentType;

  @ApiPropertyOptional()
  note: string | null;

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
}

export class PaginatedIncomeResponseDto {
  @ApiProperty({ type: [IncomeResponseDto] })
  data: IncomeResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
