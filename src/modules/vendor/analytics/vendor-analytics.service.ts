import { Injectable } from '@nestjs/common';

import { IUser } from 'src/common/consts/auth';

import {
  DashboardSummaryDto,
  SupplierDebtsSummaryDto,
  WorkerDebtsSummaryDto,
  WarehouseValueSummaryDto,
  WorkCompletionSummaryDto,
  ProfitLossSummaryDto,
  AccountBalancesSummaryDto,
} from './dto';
import { VendorAnalyticsRepository } from './vendor-analytics.repository';

@Injectable()
export class VendorAnalyticsService {
  constructor(private readonly repository: VendorAnalyticsRepository) {}

  async getDashboardSummary(user: IUser): Promise<DashboardSummaryDto> {
    const totals = await this.repository.getDashboardTotals(user.orgId);
    const projects = await this.repository.getProjectsSummary(user.orgId);

    return {
      ...totals,
      projects,
    };
  }

  async getSupplierDebts(user: IUser): Promise<SupplierDebtsSummaryDto> {
    const suppliers = await this.repository.getSupplierDebtsSummary(user.orgId);
    const totalDebt = suppliers.reduce((sum, s) => sum + s.totalDebt, 0);

    return {
      totalDebt,
      supplierCount: suppliers.length,
      suppliers,
    };
  }

  async getWorkerDebts(user: IUser): Promise<WorkerDebtsSummaryDto> {
    const workers = await this.repository.getWorkerDebtsSummary(user.orgId);
    const totalDebt = workers.reduce((sum, w) => sum + w.debt, 0);

    return {
      totalDebt,
      workerCount: workers.length,
      workers,
    };
  }

  async getWarehouseValue(user: IUser): Promise<WarehouseValueSummaryDto> {
    const warehouses = await this.repository.getWarehouseValueSummary(user.orgId);
    const totalItems = warehouses.reduce((sum, w) => sum + w.itemCount, 0);

    return {
      totalWarehouses: warehouses.length,
      totalItems,
      warehouses,
    };
  }

  async getWorkCompletion(user: IUser): Promise<WorkCompletionSummaryDto> {
    const projects = await this.repository.getWorkCompletionSummary(user.orgId);

    const totalWorkLogs = projects.reduce((sum, p) => sum + p.totalWorkLogs, 0);
    const totalValidated = projects.reduce((sum, p) => sum + p.validatedWorkLogs, 0);
    const totalValidatedAmount = projects.reduce((sum, p) => sum + p.validatedAmount, 0);

    return {
      overallValidationPercentage: totalWorkLogs > 0 ? Math.round((totalValidated / totalWorkLogs) * 100) : 0,
      totalValidatedAmount,
      projects,
    };
  }

  async getProfitLoss(user: IUser): Promise<ProfitLossSummaryDto> {
    const projects = await this.repository.getProfitLossSummary(user.orgId);

    const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
    const totalIncome = projects.reduce((sum, p) => sum + p.totalIncome, 0);
    const totalExpense = projects.reduce((sum, p) => sum + p.totalExpense, 0);

    return {
      totalBudget,
      totalIncome,
      totalExpense,
      netProfitLoss: totalIncome - totalExpense,
      projects,
    };
  }

  async getAccountBalances(user: IUser): Promise<AccountBalancesSummaryDto> {
    const accounts = await this.repository.getAccountBalancesSummary(user.orgId);

    const totalAccountBalance = accounts
      .filter((a) => a.type === 'ACCOUNT')
      .reduce((sum, a) => sum + a.balance, 0);

    const totalCashRegisterBalance = accounts
      .filter((a) => a.type === 'CASH_REGISTER')
      .reduce((sum, a) => sum + a.balance, 0);

    return {
      totalAccountBalance,
      totalCashRegisterBalance,
      grandTotal: totalAccountBalance + totalCashRegisterBalance,
      accounts,
    };
  }
}
