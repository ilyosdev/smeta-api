import { Injectable } from '@nestjs/common';

import { ExpenseResponseDto, PaginatedExpenseResponseDto } from './dto';
import { ExpenseWithRelations } from './vendor-expenses.repository';

@Injectable()
export class VendorExpensesMapper {
  mapExpense(expense: ExpenseWithRelations): ExpenseResponseDto {
    return {
      id: expense.id,
      projectId: expense.projectId,
      amount: expense.amount,
      recipient: expense.recipient,
      paymentType: expense.paymentType,
      category: expense.category,
      note: expense.note,
      smetaItemId: expense.smetaItemId,
      recordedById: expense.recordedById,
      createdAt: expense.createdAt,
      project: expense.project,
      recordedBy: expense.recordedBy,
      smetaItem: expense.smetaItem || undefined,
    };
  }

  mapPaginatedExpenses(result: {
    data: ExpenseWithRelations[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedExpenseResponseDto {
    return {
      data: result.data.map((e) => this.mapExpense(e)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
