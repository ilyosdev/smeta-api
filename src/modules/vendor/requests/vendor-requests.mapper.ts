import { Injectable } from '@nestjs/common';

import { PaginatedRequestResponseDto, RequestResponseDto } from './dto';
import { RequestWithRelations } from './vendor-requests.repository';

@Injectable()
export class VendorRequestsMapper {
  mapRequest(request: RequestWithRelations): RequestResponseDto {
    return {
      id: request.id,
      smetaItemId: request.smetaItemId,
      requestedQty: request.requestedQty,
      requestedAmount: request.requestedAmount,
      note: request.note ?? undefined,
      status: request.status,
      source: request.source,
      isOverrun: request.isOverrun,
      overrunQty: request.overrunQty ?? undefined,
      overrunPercent: request.overrunPercent ?? undefined,
      rejectionReason: request.rejectionReason ?? undefined,
      approvedAt: request.approvedAt ?? undefined,
      requestedBy: request.requestedBy,
      approvedBy: request.approvedBy ?? undefined,
      smetaItem: request.smetaItem,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  mapPaginatedRequests(result: {
    data: RequestWithRelations[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedRequestResponseDto {
    return {
      total: result.total,
      page: result.page,
      limit: result.limit,
      data: result.data.map((r) => this.mapRequest(r)),
    };
  }
}
