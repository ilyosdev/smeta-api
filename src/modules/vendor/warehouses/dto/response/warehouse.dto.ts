import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { WarehouseTransferStatus } from 'src/common/database/schemas';

export class WarehouseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  location: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  project?: {
    id: string;
    name: string;
  };
}

export class PaginatedWarehouseResponseDto {
  @ApiProperty({ type: [WarehouseResponseDto] })
  data: WarehouseResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class WarehouseItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  warehouseId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  unit: string;

  @ApiProperty()
  quantity: number;

  @ApiPropertyOptional()
  smetaItemId: string | null;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedWarehouseItemResponseDto {
  @ApiProperty({ type: [WarehouseItemResponseDto] })
  data: WarehouseItemResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class WarehouseTransferResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fromWarehouseId: string;

  @ApiProperty()
  toWarehouseId: string;

  @ApiProperty()
  itemName: string;

  @ApiProperty()
  unit: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty({ enum: WarehouseTransferStatus })
  status: WarehouseTransferStatus;

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  completedAt: Date | null;

  @ApiPropertyOptional()
  fromWarehouse?: {
    id: string;
    name: string;
  };

  @ApiPropertyOptional()
  toWarehouse?: {
    id: string;
    name: string;
  };

  @ApiPropertyOptional()
  createdBy?: {
    id: string;
    name: string;
  };
}

export class PaginatedWarehouseTransferResponseDto {
  @ApiProperty({ type: [WarehouseTransferResponseDto] })
  data: WarehouseTransferResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
