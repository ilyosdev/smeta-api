import { Injectable } from '@nestjs/common';

import { WarehouseItem } from 'src/common/database/schemas';

import {
  PaginatedWarehouseItemResponseDto,
  PaginatedWarehouseResponseDto,
  PaginatedWarehouseTransferResponseDto,
  WarehouseItemResponseDto,
  WarehouseResponseDto,
  WarehouseTransferResponseDto,
} from './dto';
import { WarehouseTransferWithRelations, WarehouseWithRelations } from './vendor-warehouses.repository';

@Injectable()
export class VendorWarehousesMapper {
  mapWarehouse(warehouse: WarehouseWithRelations): WarehouseResponseDto {
    return {
      id: warehouse.id,
      projectId: warehouse.projectId,
      name: warehouse.name,
      location: warehouse.location,
      createdAt: warehouse.createdAt,
      updatedAt: warehouse.updatedAt,
      project: warehouse.project,
    };
  }

  mapPaginatedWarehouses(result: {
    data: WarehouseWithRelations[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedWarehouseResponseDto {
    return {
      data: result.data.map((w) => this.mapWarehouse(w)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  mapWarehouseItem(item: WarehouseItem): WarehouseItemResponseDto {
    return {
      id: item.id,
      warehouseId: item.warehouseId,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      smetaItemId: item.smetaItemId,
      updatedAt: item.updatedAt,
    };
  }

  mapPaginatedWarehouseItems(result: {
    data: WarehouseItem[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedWarehouseItemResponseDto {
    return {
      data: result.data.map((i) => this.mapWarehouseItem(i)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  mapTransfer(transfer: WarehouseTransferWithRelations): WarehouseTransferResponseDto {
    return {
      id: transfer.id,
      fromWarehouseId: transfer.fromWarehouseId,
      toWarehouseId: transfer.toWarehouseId,
      itemName: transfer.itemName,
      unit: transfer.unit,
      quantity: transfer.quantity,
      status: transfer.status,
      createdById: transfer.createdById,
      createdAt: transfer.createdAt,
      completedAt: transfer.completedAt,
      fromWarehouse: transfer.fromWarehouse,
      toWarehouse: transfer.toWarehouse,
      createdBy: transfer.createdBy,
    };
  }

  mapPaginatedTransfers(result: {
    data: WarehouseTransferWithRelations[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedWarehouseTransferResponseDto {
    return {
      data: result.data.map((t) => this.mapTransfer(t)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
