import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { DataSource } from 'src/common/database/schemas';

export class ManualPurchaseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  smetaItemId: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  amount: number;

  @ApiPropertyOptional()
  receiptUrl: string | null;

  @ApiPropertyOptional()
  note: string | null;

  @ApiProperty()
  submittedById: string;

  @ApiProperty({ enum: DataSource })
  source: DataSource;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  smetaItem?: {
    id: string;
    name: string;
  };

  @ApiPropertyOptional()
  submittedBy?: {
    id: string;
    name: string;
  };
}

export class PaginatedManualPurchaseResponseDto {
  @ApiProperty({ type: [ManualPurchaseResponseDto] })
  data: ManualPurchaseResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
