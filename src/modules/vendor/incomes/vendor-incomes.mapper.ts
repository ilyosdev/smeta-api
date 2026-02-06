import { Injectable } from '@nestjs/common';

import { IncomeResponseDto, PaginatedIncomeResponseDto } from './dto';
import { IncomeWithRelations } from './vendor-incomes.repository';

@Injectable()
export class VendorIncomesMapper {
  mapIncome(income: IncomeWithRelations): IncomeResponseDto {
    return {
      id: income.id,
      projectId: income.projectId,
      amount: income.amount,
      source: income.source,
      paymentType: income.paymentType,
      note: income.note,
      recordedById: income.recordedById,
      createdAt: income.createdAt,
      project: income.project,
      recordedBy: income.recordedBy,
    };
  }

  mapPaginatedIncomes(result: {
    data: IncomeWithRelations[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedIncomeResponseDto {
    return {
      data: result.data.map((i) => this.mapIncome(i)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
