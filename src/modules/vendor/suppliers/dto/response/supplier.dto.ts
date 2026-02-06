import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { SupplyOrderStatus } from 'src/common/database/schemas';

export class SupplierResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orgId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  phone: string | null;

  @ApiPropertyOptional()
  address: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  totalDebt?: number;
}

export class PaginatedSupplierResponseDto {
  @ApiProperty({ type: [SupplierResponseDto] })
  data: SupplierResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class SupplyOrderItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  unit: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  totalCost: number;

  @ApiPropertyOptional()
  smetaItemId: string | null;
}

export class SupplyOrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  supplierId: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty({ enum: SupplyOrderStatus })
  status: SupplyOrderStatus;

  @ApiProperty()
  totalCost: number;

  @ApiPropertyOptional()
  note: string | null;

  @ApiProperty()
  orderedById: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  deliveredAt: Date | null;

  @ApiPropertyOptional()
  supplier?: {
    id: string;
    name: string;
  };

  @ApiPropertyOptional()
  project?: {
    id: string;
    name: string;
  };

  @ApiPropertyOptional()
  orderedBy?: {
    id: string;
    name: string;
  };

  @ApiPropertyOptional({ type: [SupplyOrderItemResponseDto] })
  items?: SupplyOrderItemResponseDto[];
}

export class PaginatedSupplyOrderResponseDto {
  @ApiProperty({ type: [SupplyOrderResponseDto] })
  data: SupplyOrderResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class SupplierDebtResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  supplierId: string;

  @ApiProperty()
  amount: number;

  @ApiPropertyOptional()
  reason: string | null;

  @ApiPropertyOptional()
  orderId: string | null;

  @ApiProperty()
  isPaid: boolean;

  @ApiPropertyOptional()
  paidAt: Date | null;

  @ApiPropertyOptional()
  paidById: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  supplier?: {
    id: string;
    name: string;
  };
}

export class PaginatedSupplierDebtResponseDto {
  @ApiProperty({ type: [SupplierDebtResponseDto] })
  data: SupplierDebtResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
