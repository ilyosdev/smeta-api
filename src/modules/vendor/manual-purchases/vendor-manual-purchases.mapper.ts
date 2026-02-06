import { Injectable } from '@nestjs/common';

import { ManualPurchaseResponseDto, PaginatedManualPurchaseResponseDto } from './dto';
import { ManualPurchaseWithRelations } from './vendor-manual-purchases.repository';

@Injectable()
export class VendorManualPurchasesMapper {
  mapManualPurchase(manualPurchase: ManualPurchaseWithRelations): ManualPurchaseResponseDto {
    return {
      id: manualPurchase.id,
      smetaItemId: manualPurchase.smetaItemId,
      quantity: manualPurchase.quantity,
      amount: manualPurchase.amount,
      receiptUrl: manualPurchase.receiptUrl,
      note: manualPurchase.note,
      submittedById: manualPurchase.submittedById,
      source: manualPurchase.source,
      createdAt: manualPurchase.createdAt,
      smetaItem: manualPurchase.smetaItem,
      submittedBy: manualPurchase.submittedBy,
    };
  }

  mapPaginatedManualPurchases(result: {
    data: ManualPurchaseWithRelations[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedManualPurchaseResponseDto {
    return {
      data: result.data.map((mp) => this.mapManualPurchase(mp)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
