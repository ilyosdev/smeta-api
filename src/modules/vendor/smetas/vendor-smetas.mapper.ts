import { Injectable } from '@nestjs/common';

import { SmetaResponseDto, PaginatedSmetaResponseDto } from './dto';
import { SmetaWithProject } from './vendor-smetas.repository';

@Injectable()
export class VendorSmetasMapper {
  mapSmeta(smeta: SmetaWithProject): SmetaResponseDto {
    return {
      id: smeta.id,
      projectId: smeta.projectId,
      projectName: smeta.project.name,
      name: smeta.name,
      type: smeta.type,
      currentVersion: smeta.currentVersion,
      totalWorkAmount: smeta.totalWorkAmount,
      totalMachineAmount: smeta.totalMachineAmount,
      totalMaterialAmount: smeta.totalMaterialAmount,
      totalOtherAmount: smeta.totalOtherAmount,
      grandTotal: smeta.grandTotal,
      overheadPercent: smeta.overheadPercent,
      createdAt: smeta.createdAt,
      updatedAt: smeta.updatedAt,
    };
  }

  mapPaginatedSmetas(result: {
    data: SmetaWithProject[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedSmetaResponseDto {
    return {
      total: result.total,
      page: result.page,
      limit: result.limit,
      data: result.data.map((s) => this.mapSmeta(s)),
    };
  }
}
