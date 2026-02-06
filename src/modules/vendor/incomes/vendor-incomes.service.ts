import { Injectable } from '@nestjs/common';

import { IUser } from 'src/common/consts/auth';
import { HandledException } from 'src/common/error/http.error';

import { CreateIncomeDto, QueryIncomeDto } from './dto';
import { IncomeWithRelations, VendorIncomesRepository } from './vendor-incomes.repository';

@Injectable()
export class VendorIncomesService {
  constructor(private readonly repository: VendorIncomesRepository) {}

  async createIncome(dto: CreateIncomeDto, user: IUser): Promise<IncomeWithRelations> {
    const projectOrgId = await this.repository.getProjectOrgId(dto.projectId);
    if (!projectOrgId || projectOrgId !== user.orgId) {
      HandledException.throw('PROJECT_NOT_FOUND', 404);
    }

    const income = await this.repository.createIncome({
      projectId: dto.projectId,
      amount: dto.amount,
      source: dto.source,
      paymentType: dto.paymentType,
      note: dto.note,
      recordedById: user.id,
    });

    return this.findOneIncome(income.id, user);
  }

  async findAllIncomes(
    query: QueryIncomeDto,
    user: IUser,
  ): Promise<{ data: IncomeWithRelations[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, projectId } = query;
    const result = await this.repository.findAllIncomes(user.orgId, { page, limit, projectId });
    return { ...result, page, limit };
  }

  async findOneIncome(id: string, user: IUser): Promise<IncomeWithRelations> {
    const result = await this.repository.findIncomeById(id, user.orgId);
    if (!result) {
      HandledException.throw('INCOME_NOT_FOUND', 404);
    }
    return result;
  }

  async removeIncome(id: string, user: IUser): Promise<void> {
    await this.findOneIncome(id, user);
    await this.repository.deleteIncome(id);
  }
}
