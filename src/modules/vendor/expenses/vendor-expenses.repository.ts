import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import {
  Expense,
  ExpenseCategory,
  NewExpense,
  expenses,
  projects,
  users,
  smetaItems,
} from 'src/common/database/schemas';

export type ExpenseWithRelations = Expense & {
  project?: { id: string; name: string };
  recordedBy?: { id: string; name: string };
  smetaItem?: { id: string; name: string } | null;
};

@Injectable()
export class VendorExpensesRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async createExpense(data: NewExpense): Promise<Expense> {
    const id = randomUUID();
    await this.db.insert(expenses).values({ ...data, id });
    const [result] = await this.db.select().from(expenses).where(eq(expenses.id, id));
    return result;
  }

  async findAllExpenses(
    orgId: string,
    params: { page: number; limit: number; projectId?: string; category?: ExpenseCategory },
  ): Promise<{ data: ExpenseWithRelations[]; total: number }> {
    const { page, limit, projectId, category } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [eq(projects.orgId, orgId)];
    if (projectId) {
      conditions.push(eq(expenses.projectId, projectId));
    }
    if (category) {
      conditions.push(eq(expenses.category, category));
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(expenses)
      .innerJoin(projects, eq(expenses.projectId, projects.id))
      .where(and(...conditions));

    const results = await this.db
      .select({
        expense: expenses,
        project: { id: projects.id, name: projects.name },
        recordedBy: { id: users.id, name: users.name },
      })
      .from(expenses)
      .innerJoin(projects, eq(expenses.projectId, projects.id))
      .innerJoin(users, eq(expenses.recordedById, users.id))
      .where(and(...conditions))
      .orderBy(desc(expenses.createdAt))
      .limit(limit)
      .offset(offset);

    const data: ExpenseWithRelations[] = [];
    for (const r of results) {
      let smetaItem: { id: string; name: string } | null = null;
      if (r.expense.smetaItemId) {
        const [smetaItemResult] = await this.db
          .select({ id: smetaItems.id, name: smetaItems.name })
          .from(smetaItems)
          .where(eq(smetaItems.id, r.expense.smetaItemId));
        smetaItem = smetaItemResult || null;
      }

      data.push({
        ...r.expense,
        project: r.project,
        recordedBy: r.recordedBy,
        smetaItem,
      });
    }

    return { data, total: Number(countResult.count) };
  }

  async findExpenseById(id: string, orgId: string): Promise<ExpenseWithRelations | null> {
    const results = await this.db
      .select({
        expense: expenses,
        project: { id: projects.id, name: projects.name },
        recordedBy: { id: users.id, name: users.name },
      })
      .from(expenses)
      .innerJoin(projects, eq(expenses.projectId, projects.id))
      .innerJoin(users, eq(expenses.recordedById, users.id))
      .where(and(eq(expenses.id, id), eq(projects.orgId, orgId)));

    if (results.length === 0) return null;

    const r = results[0];
    let smetaItem: { id: string; name: string } | null = null;
    if (r.expense.smetaItemId) {
      const [smetaItemResult] = await this.db
        .select({ id: smetaItems.id, name: smetaItems.name })
        .from(smetaItems)
        .where(eq(smetaItems.id, r.expense.smetaItemId));
      smetaItem = smetaItemResult || null;
    }

    return { ...r.expense, project: r.project, recordedBy: r.recordedBy, smetaItem };
  }

  async deleteExpense(id: string): Promise<void> {
    await this.db.delete(expenses).where(eq(expenses.id, id));
  }

  async getProjectOrgId(projectId: string): Promise<string | null> {
    const [result] = await this.db.select({ orgId: projects.orgId }).from(projects).where(eq(projects.id, projectId));
    return result?.orgId ?? null;
  }
}
