import { ApiProperty } from '@nestjs/swagger';

export class ProjectSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  budget: number;

  @ApiProperty()
  totalIncome: number;

  @ApiProperty()
  totalExpense: number;

  @ApiProperty()
  balance: number;

  @ApiProperty()
  completionPercentage: number;
}

export class SupplierDebtSummaryDto {
  @ApiProperty()
  supplierId: string;

  @ApiProperty()
  supplierName: string;

  @ApiProperty()
  totalDebt: number;

  @ApiProperty()
  unpaidCount: number;
}

export class WorkerDebtSummaryDto {
  @ApiProperty()
  workerId: string;

  @ApiProperty()
  workerName: string;

  @ApiProperty()
  totalEarned: number;

  @ApiProperty()
  totalPaid: number;

  @ApiProperty()
  debt: number;
}

export class WarehouseValueDto {
  @ApiProperty()
  warehouseId: string;

  @ApiProperty()
  warehouseName: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  projectName: string;

  @ApiProperty()
  itemCount: number;

  @ApiProperty()
  totalQuantity: number;
}

export class WorkCompletionDto {
  @ApiProperty()
  projectId: string;

  @ApiProperty()
  projectName: string;

  @ApiProperty()
  totalWorkLogs: number;

  @ApiProperty()
  validatedWorkLogs: number;

  @ApiProperty()
  validationPercentage: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  validatedAmount: number;
}

export class ProfitLossDto {
  @ApiProperty()
  projectId: string;

  @ApiProperty()
  projectName: string;

  @ApiProperty()
  budget: number;

  @ApiProperty()
  totalIncome: number;

  @ApiProperty()
  totalExpense: number;

  @ApiProperty()
  netProfitLoss: number;

  @ApiProperty()
  budgetUtilizationPercentage: number;
}

export class AccountBalanceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  type: 'ACCOUNT' | 'CASH_REGISTER';

  @ApiProperty()
  balance: number;
}

export class DashboardSummaryDto {
  @ApiProperty()
  totalProjects: number;

  @ApiProperty()
  activeProjects: number;

  @ApiProperty()
  totalBudget: number;

  @ApiProperty()
  totalIncome: number;

  @ApiProperty()
  totalExpense: number;

  @ApiProperty()
  totalSupplierDebt: number;

  @ApiProperty()
  totalWorkerDebt: number;

  @ApiProperty()
  totalAccountBalance: number;

  @ApiProperty()
  totalCashRegisterBalance: number;

  @ApiProperty({ type: [ProjectSummaryDto] })
  projects: ProjectSummaryDto[];
}

export class SupplierDebtsSummaryDto {
  @ApiProperty()
  totalDebt: number;

  @ApiProperty()
  supplierCount: number;

  @ApiProperty({ type: [SupplierDebtSummaryDto] })
  suppliers: SupplierDebtSummaryDto[];
}

export class WorkerDebtsSummaryDto {
  @ApiProperty()
  totalDebt: number;

  @ApiProperty()
  workerCount: number;

  @ApiProperty({ type: [WorkerDebtSummaryDto] })
  workers: WorkerDebtSummaryDto[];
}

export class WarehouseValueSummaryDto {
  @ApiProperty()
  totalWarehouses: number;

  @ApiProperty()
  totalItems: number;

  @ApiProperty({ type: [WarehouseValueDto] })
  warehouses: WarehouseValueDto[];
}

export class WorkCompletionSummaryDto {
  @ApiProperty()
  overallValidationPercentage: number;

  @ApiProperty()
  totalValidatedAmount: number;

  @ApiProperty({ type: [WorkCompletionDto] })
  projects: WorkCompletionDto[];
}

export class ProfitLossSummaryDto {
  @ApiProperty()
  totalBudget: number;

  @ApiProperty()
  totalIncome: number;

  @ApiProperty()
  totalExpense: number;

  @ApiProperty()
  netProfitLoss: number;

  @ApiProperty({ type: [ProfitLossDto] })
  projects: ProfitLossDto[];
}

export class AccountBalancesSummaryDto {
  @ApiProperty()
  totalAccountBalance: number;

  @ApiProperty()
  totalCashRegisterBalance: number;

  @ApiProperty()
  grandTotal: number;

  @ApiProperty({ type: [AccountBalanceDto] })
  accounts: AccountBalanceDto[];
}
