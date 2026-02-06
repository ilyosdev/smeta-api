import { Injectable } from '@nestjs/common';

import { PaginatedSmetaItemResponseDto, SmetaItemResponseDto } from './dto';
import { SmetaItemWithRelations } from './vendor-smeta-items.repository';

@Injectable()
export class VendorSmetaItemsMapper {
  mapSmetaItem(item: SmetaItemWithRelations): SmetaItemResponseDto {
    return {
      id: item.id,
      smetaId: item.smetaId,
      itemType: item.itemType,
      category: item.category,
      code: item.code,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalAmount: item.totalAmount,
      usedQuantity: item.usedQuantity,
      usedAmount: item.usedAmount,
      percentRate: item.percentRate,
      machineType: item.machineType,
      laborHours: item.laborHours,
      source: item.source,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      smeta: item.smeta,
    };
  }

  mapPaginatedSmetaItems(result: {
    data: SmetaItemWithRelations[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedSmetaItemResponseDto {
    return {
      data: result.data.map((item) => this.mapSmetaItem(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
