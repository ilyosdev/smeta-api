import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import {
  projects,
  ProjectStatus,
  incomes,
  expenses,
  suppliers,
  supplierDebts,
  workers,
  warehouses,
  warehouseItems,
  workLogs,
  accounts,
  cashRegisters,
} from 'src/common/database/schemas';

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  budget: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  completionPercentage: number;
}

export interface SupplierDebtSummary {
  supplierId: string;
  supplierName: string;
  totalDebt: number;
  unpaidCount: number;
}

export interface WorkerDebtSummary {
  workerId: string;
  workerName: string;
  totalEarned: number;
  totalPaid: number;
  debt: number;
}

export interface WarehouseValue {
  warehouseId: string;
  warehouseName: string;
  projectId: string;
  projectName: string;
  itemCount: number;
  totalQuantity: number;
}

export interface WorkCompletion {
  projectId: string;
  projectName: string;
  totalWorkLogs: number;
  validatedWorkLogs: number;
  validationPercentage: number;
  totalAmount: number;
  validatedAmount: number;
}

export interface ProfitLoss {
  projectId: string;
  projectName: string;
  budget: number;
  totalIncome: number;
  totalExpense: number;
  netProfitLoss: number;
  budgetUtilizationPercentage: number;
}

export interface AccountBalance {
  id: string;
  name: string;
  type: 'ACCOUNT' | 'CASH_REGISTER';
  balance: number;
}

@Injectable()
export class VendorAnalyticsRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async getProjectsSummary(orgId: string): Promise<ProjectSummary[]> {
    // Get all projects for the org
    const projectsList = await this.db
      .select()
      .from(projects)
      .where(eq(projects.orgId, orgId));

    if (projectsList.length === 0) {
      return [];
    }

    const projectIds = projectsList.map((p) => p.id);

    // Batch query: Get income totals per project
    const incomeTotals = await this.db
      .select({
        projectId: incomes.projectId,
        total: sql<number>`coalesce(sum(${incomes.amount}), 0)`,
      })
      .from(incomes)
      .where(sql`${incomes.projectId} IN (${sql.join(projectIds.map((id) => sql`${id}`), sql`, `)})`)
      .groupBy(incomes.projectId);

    // Batch query: Get expense totals per project
    const expenseTotals = await this.db
      .select({
        projectId: expenses.projectId,
        total: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(sql`${expenses.projectId} IN (${sql.join(projectIds.map((id) => sql`${id}`), sql`, `)})`)
      .groupBy(expenses.projectId);

    // Batch query: Get work log stats per project
    const workStats = await this.db
      .select({
        projectId: workLogs.projectId,
        total: sql<number>`count(*)`,
        validated: sql<number>`sum(case when ${workLogs.isValidated} = true then 1 else 0 end)`,
      })
      .from(workLogs)
      .where(sql`${workLogs.projectId} IN (${sql.join(projectIds.map((id) => sql`${id}`), sql`, `)})`)
      .groupBy(workLogs.projectId);

    // Create lookup maps for O(1) access
    const incomeMap = new Map(incomeTotals.map((i) => [i.projectId, Number(i.total)]));
    const expenseMap = new Map(expenseTotals.map((e) => [e.projectId, Number(e.total)]));
    const workMap = new Map(workStats.map((w) => [w.projectId, { total: Number(w.total), validated: Number(w.validated) }]));

    // Build result using lookup maps
    return projectsList.map((project) => {
      const totalIncome = incomeMap.get(project.id) || 0;
      const totalExpense = expenseMap.get(project.id) || 0;
      const work = workMap.get(project.id) || { total: 0, validated: 0 };
      const completionPercentage = work.total > 0 ? Math.round((work.validated / work.total) * 100) : 0;

      return {
        id: project.id,
        name: project.name,
        status: project.status,
        budget: project.budget || 0,
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        completionPercentage,
      };
    });
  }

  async getSupplierDebtsSummary(orgId: string): Promise<SupplierDebtSummary[]> {
    // Single query with JOIN and GROUP BY
    const results = await this.db
      .select({
        supplierId: suppliers.id,
        supplierName: suppliers.name,
        totalDebt: sql<number>`coalesce(sum(${supplierDebts.amount}), 0)`,
        unpaidCount: sql<number>`count(${supplierDebts.id})`,
      })
      .from(suppliers)
      .leftJoin(
        supplierDebts,
        and(eq(supplierDebts.supplierId, suppliers.id), eq(supplierDebts.isPaid, false)),
      )
      .where(eq(suppliers.orgId, orgId))
      .groupBy(suppliers.id, suppliers.name);

    return results
      .filter((r) => Number(r.totalDebt) > 0)
      .map((r) => ({
        supplierId: r.supplierId,
        supplierName: r.supplierName,
        totalDebt: Number(r.totalDebt),
        unpaidCount: Number(r.unpaidCount),
      }));
  }

  async getWorkerDebtsSummary(orgId: string): Promise<WorkerDebtSummary[]> {
    // Single query - workers already have totalEarned/totalPaid columns
    const workersList = await this.db
      .select()
      .from(workers)
      .where(eq(workers.orgId, orgId));

    return workersList
      .map((worker) => ({
        workerId: worker.id,
        workerName: worker.name,
        totalEarned: worker.totalEarned,
        totalPaid: worker.totalPaid,
        debt: worker.totalEarned - worker.totalPaid,
      }))
      .filter((w) => w.debt > 0);
  }

  async getWarehouseValueSummary(orgId: string): Promise<WarehouseValue[]> {
    // Single query with JOIN and GROUP BY
    const results = await this.db
      .select({
        warehouseId: warehouses.id,
        warehouseName: warehouses.name,
        projectId: projects.id,
        projectName: projects.name,
        itemCount: sql<number>`count(${warehouseItems.id})`,
        totalQuantity: sql<number>`coalesce(sum(${warehouseItems.quantity}), 0)`,
      })
      .from(warehouses)
      .innerJoin(projects, eq(warehouses.projectId, projects.id))
      .leftJoin(warehouseItems, eq(warehouseItems.warehouseId, warehouses.id))
      .where(eq(projects.orgId, orgId))
      .groupBy(warehouses.id, warehouses.name, projects.id, projects.name);

    return results.map((r) => ({
      warehouseId: r.warehouseId,
      warehouseName: r.warehouseName,
      projectId: r.projectId,
      projectName: r.projectName,
      itemCount: Number(r.itemCount),
      totalQuantity: Number(r.totalQuantity),
    }));
  }

  async getWorkCompletionSummary(orgId: string): Promise<WorkCompletion[]> {
    // Single query with JOIN and GROUP BY - aggregates in SQL instead of fetching all rows
    const results = await this.db
      .select({
        projectId: projects.id,
        projectName: projects.name,
        totalWorkLogs: sql<number>`count(${workLogs.id})`,
        validatedWorkLogs: sql<number>`sum(case when ${workLogs.isValidated} = true then 1 else 0 end)`,
        totalAmount: sql<number>`coalesce(sum(${workLogs.totalAmount}), 0)`,
        validatedAmount: sql<number>`coalesce(sum(case when ${workLogs.isValidated} = true then ${workLogs.totalAmount} else 0 end), 0)`,
      })
      .from(projects)
      .leftJoin(workLogs, eq(workLogs.projectId, projects.id))
      .where(eq(projects.orgId, orgId))
      .groupBy(projects.id, projects.name);

    return results.map((r) => {
      const totalWorkLogs = Number(r.totalWorkLogs);
      const validatedWorkLogs = Number(r.validatedWorkLogs) || 0;
      return {
        projectId: r.projectId,
        projectName: r.projectName,
        totalWorkLogs,
        validatedWorkLogs,
        validationPercentage: totalWorkLogs > 0 ? Math.round((validatedWorkLogs / totalWorkLogs) * 100) : 0,
        totalAmount: Number(r.totalAmount),
        validatedAmount: Number(r.validatedAmount),
      };
    });
  }

  async getProfitLossSummary(orgId: string): Promise<ProfitLoss[]> {
    // Get all projects for the org
    const projectsList = await this.db
      .select()
      .from(projects)
      .where(eq(projects.orgId, orgId));

    if (projectsList.length === 0) {
      return [];
    }

    const projectIds = projectsList.map((p) => p.id);

    // Batch query: Get income totals per project
    const incomeTotals = await this.db
      .select({
        projectId: incomes.projectId,
        total: sql<number>`coalesce(sum(${incomes.amount}), 0)`,
      })
      .from(incomes)
      .where(sql`${incomes.projectId} IN (${sql.join(projectIds.map((id) => sql`${id}`), sql`, `)})`)
      .groupBy(incomes.projectId);

    // Batch query: Get expense totals per project
    const expenseTotals = await this.db
      .select({
        projectId: expenses.projectId,
        total: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(sql`${expenses.projectId} IN (${sql.join(projectIds.map((id) => sql`${id}`), sql`, `)})`)
      .groupBy(expenses.projectId);

    // Create lookup maps
    const incomeMap = new Map(incomeTotals.map((i) => [i.projectId, Number(i.total)]));
    const expenseMap = new Map(expenseTotals.map((e) => [e.projectId, Number(e.total)]));

    return projectsList.map((project) => {
      const totalIncome = incomeMap.get(project.id) || 0;
      const totalExpense = expenseMap.get(project.id) || 0;
      const budget = project.budget || 0;

      return {
        projectId: project.id,
        projectName: project.name,
        budget,
        totalIncome,
        totalExpense,
        netProfitLoss: totalIncome - totalExpense,
        budgetUtilizationPercentage: budget > 0 ? Math.round((totalExpense / budget) * 100) : 0,
      };
    });
  }

  async getAccountBalancesSummary(orgId: string): Promise<AccountBalance[]> {
    const accountsList = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.orgId, orgId));

    const accountBalances: AccountBalance[] = accountsList.map((acc) => ({
      id: acc.id,
      name: acc.name,
      type: 'ACCOUNT' as const,
      balance: acc.balance,
    }));

    // Get cash registers for projects in this org (use INNER JOIN to avoid null project issues)
    const cashRegistersList = await this.db
      .select({
        cashRegister: cashRegisters,
      })
      .from(cashRegisters)
      .innerJoin(projects, eq(cashRegisters.projectId, projects.id))
      .where(eq(projects.orgId, orgId));

    const cashRegisterBalances: AccountBalance[] = cashRegistersList.map((cr) => ({
      id: cr.cashRegister.id,
      name: cr.cashRegister.name,
      type: 'CASH_REGISTER' as const,
      balance: cr.cashRegister.balance,
    }));

    return [...accountBalances, ...cashRegisterBalances];
  }

  async getDashboardTotals(orgId: string) {
    const [projectsCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.orgId, orgId));

    const [activeProjectsCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(and(eq(projects.orgId, orgId), eq(projects.status, ProjectStatus.ACTIVE)));

    const [budgetResult] = await this.db
      .select({ total: sql<number>`coalesce(sum(${projects.budget}), 0)` })
      .from(projects)
      .where(eq(projects.orgId, orgId));

    const [incomeResult] = await this.db
      .select({ total: sql<number>`coalesce(sum(${incomes.amount}), 0)` })
      .from(incomes)
      .innerJoin(projects, eq(incomes.projectId, projects.id))
      .where(eq(projects.orgId, orgId));

    const [expenseResult] = await this.db
      .select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .innerJoin(projects, eq(expenses.projectId, projects.id))
      .where(eq(projects.orgId, orgId));

    const [supplierDebtResult] = await this.db
      .select({ total: sql<number>`coalesce(sum(${supplierDebts.amount}), 0)` })
      .from(supplierDebts)
      .innerJoin(suppliers, eq(supplierDebts.supplierId, suppliers.id))
      .where(and(eq(suppliers.orgId, orgId), eq(supplierDebts.isPaid, false)));

    // Use SQL aggregation for worker debt instead of fetching all rows
    const [workerDebtResult] = await this.db
      .select({
        total: sql<number>`coalesce(sum(greatest(0, ${workers.totalEarned} - ${workers.totalPaid})), 0)`,
      })
      .from(workers)
      .where(eq(workers.orgId, orgId));

    const [accountBalanceResult] = await this.db
      .select({ total: sql<number>`coalesce(sum(${accounts.balance}), 0)` })
      .from(accounts)
      .where(eq(accounts.orgId, orgId));

    // Get cash register balance for projects in this org (use INNER JOIN)
    const [cashRegisterBalanceResult] = await this.db
      .select({ total: sql<number>`coalesce(sum(${cashRegisters.balance}), 0)` })
      .from(cashRegisters)
      .innerJoin(projects, eq(cashRegisters.projectId, projects.id))
      .where(eq(projects.orgId, orgId));

    return {
      totalProjects: Number(projectsCount.count),
      activeProjects: Number(activeProjectsCount.count),
      totalBudget: Number(budgetResult.total),
      totalIncome: Number(incomeResult.total),
      totalExpense: Number(expenseResult.total),
      totalSupplierDebt: Number(supplierDebtResult.total),
      totalWorkerDebt: Number(workerDebtResult.total),
      totalAccountBalance: Number(accountBalanceResult.total),
      totalCashRegisterBalance: Number(cashRegisterBalanceResult?.total || 0),
    };
  }
}
