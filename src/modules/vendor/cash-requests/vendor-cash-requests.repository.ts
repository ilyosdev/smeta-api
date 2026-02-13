import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import {
  NewCashRequest,
  CashRequest,
  CashRequestStatus,
  cashRequests,
  projects,
  users,
} from 'src/common/database/schemas';

export type CashRequestWithRelations = CashRequest & {
  project?: { id: string; name: string };
  requestedBy?: { id: string; name: string };
  approvedBy?: { id: string; name: string } | null;
};

@Injectable()
export class VendorCashRequestsRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async create(data: NewCashRequest): Promise<CashRequest> {
    const id = randomUUID();
    await this.db.insert(cashRequests).values({ ...data, id });
    const [result] = await this.db.select().from(cashRequests).where(eq(cashRequests.id, id));
    return result;
  }

  async findAll(
    orgId: string,
    params: {
      page: number;
      limit: number;
      status?: CashRequestStatus;
      projectId?: string;
    },
  ): Promise<{ data: CashRequestWithRelations[]; total: number }> {
    const { page, limit, status, projectId } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];
    if (status) {
      conditions.push(eq(cashRequests.status, status));
    }
    if (projectId) {
      conditions.push(eq(cashRequests.projectId, projectId));
    }

    const baseQuery = this.db
      .select({
        cashRequest: cashRequests,
        project: {
          id: projects.id,
          name: projects.name,
        },
        requestedBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(cashRequests)
      .innerJoin(projects, eq(cashRequests.projectId, projects.id))
      .innerJoin(users, eq(cashRequests.requestedById, users.id))
      .where(and(eq(projects.orgId, orgId), ...conditions));

    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(cashRequests)
      .innerJoin(projects, eq(cashRequests.projectId, projects.id))
      .where(and(eq(projects.orgId, orgId), ...conditions));

    const [countResult] = await countQuery;

    const results = await baseQuery
      .orderBy(desc(cashRequests.createdAt))
      .limit(limit)
      .offset(offset);

    const data: CashRequestWithRelations[] = results.map((r) => ({
      ...r.cashRequest,
      project: r.project,
      requestedBy: r.requestedBy,
      approvedBy: null,
    }));

    return { data, total: Number(countResult.count) };
  }

  async findById(id: string, orgId: string): Promise<CashRequestWithRelations | null> {
    const results = await this.db
      .select({
        cashRequest: cashRequests,
        project: {
          id: projects.id,
          name: projects.name,
        },
        requestedBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(cashRequests)
      .innerJoin(projects, eq(cashRequests.projectId, projects.id))
      .innerJoin(users, eq(cashRequests.requestedById, users.id))
      .where(and(eq(cashRequests.id, id), eq(projects.orgId, orgId)));

    if (results.length === 0) return null;

    const r = results[0];
    return {
      ...r.cashRequest,
      project: r.project,
      requestedBy: r.requestedBy,
      approvedBy: null,
    };
  }

  async update(id: string, data: Partial<NewCashRequest>): Promise<CashRequest> {
    await this.db.update(cashRequests).set(data).where(eq(cashRequests.id, id));
    const [result] = await this.db.select().from(cashRequests).where(eq(cashRequests.id, id));
    return result;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(cashRequests).where(eq(cashRequests.id, id));
  }

  async getProjectOrgId(projectId: string): Promise<string | null> {
    const results = await this.db
      .select({ orgId: projects.orgId })
      .from(projects)
      .where(eq(projects.id, projectId));
    return results.length > 0 ? results[0].orgId : null;
  }
}
