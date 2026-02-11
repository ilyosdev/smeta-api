import { Injectable } from '@nestjs/common';

import { IUser } from 'src/common/consts/auth';
import { HandledException } from 'src/common/error/http.error';

import { CreateExpenseDto, QueryExpenseDto } from './dto';
import { ExpenseWithRelations, VendorExpensesRepository } from './vendor-expenses.repository';

@Injectable()
export class VendorExpensesService {
  constructor(private readonly repository: VendorExpensesRepository) {}

  async createExpense(dto: CreateExpenseDto, user: IUser): Promise<ExpenseWithRelations> {
    const projectOrgId = await this.repository.getProjectOrgId(dto.projectId);
    if (!projectOrgId || projectOrgId !== user.orgId) {
      HandledException.throw('PROJECT_NOT_FOUND', 404);
    }

    const expense = await this.repository.createExpense({
      projectId: dto.projectId,
      amount: dto.amount,
      recipient: dto.recipient,
      paymentType: dto.paymentType,
      category: dto.category,
      note: dto.note,
      smetaItemId: dto.smetaItemId,
      recordedById: user.id,
      ...(dto.isPaid !== undefined ? { isPaid: dto.isPaid } : {}),
    });

    return this.findOneExpense(expense.id, user);
  }

  async findAllExpenses(
    query: QueryExpenseDto & { isPaid?: boolean },
    user: IUser,
  ): Promise<{ data: ExpenseWithRelations[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, projectId, category, isPaid } = query;
    const result = await this.repository.findAllExpenses(user.orgId, { page, limit, projectId, category, isPaid });
    return { ...result, page, limit };
  }

  async findOneExpense(id: string, user: IUser): Promise<ExpenseWithRelations> {
    const result = await this.repository.findExpenseById(id, user.orgId);
    if (!result) {
      HandledException.throw('EXPENSE_NOT_FOUND', 404);
    }
    return result;
  }

  async approveExpense(id: string, user: IUser): Promise<ExpenseWithRelations> {
    await this.findOneExpense(id, user);
    await this.repository.updateExpense(id, { isPaid: true, paidAt: new Date() });
    return this.findOneExpense(id, user);
  }

  async rejectExpense(id: string, user: IUser): Promise<void> {
    await this.findOneExpense(id, user);
    await this.repository.deleteExpense(id);
  }

  async removeExpense(id: string, user: IUser): Promise<void> {
    await this.findOneExpense(id, user);
    await this.repository.deleteExpense(id);
  }
}
