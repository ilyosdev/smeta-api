import { Injectable } from '@nestjs/common';

import { CashRequestResponseDto, PaginatedCashRequestResponseDto } from './dto';
import { CashRequestWithRelations } from './vendor-cash-requests.repository';

@Injectable()
export class VendorCashRequestsMapper {
  mapCashRequest(cr: CashRequestWithRelations): CashRequestResponseDto {
    return {
      id: cr.id,
      projectId: cr.projectId,
      requestedById: cr.requestedById,
      amount: cr.amount,
      reason: cr.reason,
      neededBy: cr.neededBy,
      status: cr.status,
      approvedById: cr.approvedById,
      approvedAt: cr.approvedAt,
      rejectionReason: cr.rejectionReason,
      source: cr.source,
      createdAt: cr.createdAt,
      updatedAt: cr.updatedAt,
      project: cr.project,
      requestedBy: cr.requestedBy,
      approvedBy: cr.approvedBy,
    };
  }

  mapPaginatedCashRequests(result: {
    data: CashRequestWithRelations[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedCashRequestResponseDto {
    return {
      data: result.data.map((cr) => this.mapCashRequest(cr)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
