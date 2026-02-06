import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { DataSource, SmetaItemCategory } from 'src/common/database/schemas';

export class SmetaItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  smetaId: string;

  @ApiProperty({ enum: SmetaItemCategory })
  itemType: SmetaItemCategory;

  @ApiProperty()
  category: string;

  @ApiPropertyOptional()
  code: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  unit: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  usedQuantity: number;

  @ApiProperty()
  usedAmount: number;

  @ApiPropertyOptional()
  percentRate: number | null;

  @ApiPropertyOptional()
  machineType: string | null;

  @ApiPropertyOptional()
  laborHours: number | null;

  @ApiProperty({ enum: DataSource })
  source: DataSource;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  smeta?: {
    id: string;
    name: string;
  };
}

export class PaginatedSmetaItemResponseDto {
  @ApiProperty({ type: [SmetaItemResponseDto] })
  data: SmetaItemResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
