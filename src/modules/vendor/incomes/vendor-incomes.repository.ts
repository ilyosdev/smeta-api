import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import { Income, NewIncome, incomes, projects, users } from 'src/common/database/schemas';

export type IncomeWithRelations = Income & {
  project?: { id: string; name: string };
  recordedBy?: { id: string; name: string };
};

@Injectable()
export class VendorIncomesRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async createIncome(data: NewIncome): Promise<Income> {
    const id = randomUUID();
    await this.db.insert(incomes).values({ ...data, id });
    const [result] = await this.db.select().from(incomes).where(eq(incomes.id, id));
    return result;
  }

  async findAllIncomes(
    orgId: string,
    params: { page: number; limit: number; projectId?: string },
  ): Promise<{ data: IncomeWithRelations[]; total: number }> {
    const { page, limit, projectId } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [eq(projects.orgId, orgId)];
    if (projectId) {
      conditions.push(eq(incomes.projectId, projectId));
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(incomes)
      .innerJoin(projects, eq(incomes.projectId, projects.id))
      .where(and(...conditions));

    const results = await this.db
      .select({
        income: incomes,
        project: { id: projects.id, name: projects.name },
        recordedBy: { id: users.id, name: users.name },
      })
      .from(incomes)
      .innerJoin(projects, eq(incomes.projectId, projects.id))
      .innerJoin(users, eq(incomes.recordedById, users.id))
      .where(and(...conditions))
      .orderBy(desc(incomes.createdAt))
      .limit(limit)
      .offset(offset);

    const data: IncomeWithRelations[] = results.map((r) => ({
      ...r.income,
      project: r.project,
      recordedBy: r.recordedBy,
    }));

    return { data, total: Number(countResult.count) };
  }

  async findIncomeById(id: string, orgId: string): Promise<IncomeWithRelations | null> {
    const results = await this.db
      .select({
        income: incomes,
        project: { id: projects.id, name: projects.name },
        recordedBy: { id: users.id, name: users.name },
      })
      .from(incomes)
      .innerJoin(projects, eq(incomes.projectId, projects.id))
      .innerJoin(users, eq(incomes.recordedById, users.id))
      .where(and(eq(incomes.id, id), eq(projects.orgId, orgId)));

    if (results.length === 0) return null;

    const r = results[0];
    return { ...r.income, project: r.project, recordedBy: r.recordedBy };
  }

  async deleteIncome(id: string): Promise<void> {
    await this.db.delete(incomes).where(eq(incomes.id, id));
  }

  async getProjectOrgId(projectId: string): Promise<string | null> {
    const [result] = await this.db.select({ orgId: projects.orgId }).from(projects).where(eq(projects.id, projectId));
    return result?.orgId ?? null;
  }
}
