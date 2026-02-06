import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import {
  NewPurchaseRequest,
  PurchaseRequest,
  RequestStatus,
  purchaseRequests,
  smetaItems,
  smetas,
  projects,
  users,
} from 'src/common/database/schemas';

export type RequestWithRelations = PurchaseRequest & {
  smetaItem?: {
    id: string;
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
  };
  requestedBy?: {
    id: string;
    name: string;
  };
  approvedBy?: {
    id: string;
    name: string;
  } | null;
};

@Injectable()
export class VendorRequestsRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async create(data: NewPurchaseRequest): Promise<PurchaseRequest> {
    const id = randomUUID();
    await this.db.insert(purchaseRequests).values({ ...data, id });
    const [result] = await this.db.select().from(purchaseRequests).where(eq(purchaseRequests.id, id));
    return result;
  }

  async findAll(
    orgId: string,
    params: {
      page: number;
      limit: number;
      status?: RequestStatus;
      smetaItemId?: string;
      projectId?: string;
    },
  ): Promise<{ data: RequestWithRelations[]; total: number }> {
    const { page, limit, status, smetaItemId, projectId } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];
    
    if (status) {
      conditions.push(eq(purchaseRequests.status, status));
    }
    if (smetaItemId) {
      conditions.push(eq(purchaseRequests.smetaItemId, smetaItemId));
    }

    const baseQuery = this.db
      .select({
        request: purchaseRequests,
        smetaItem: {
          id: smetaItems.id,
          name: smetaItems.name,
          unit: smetaItems.unit,
          quantity: smetaItems.quantity,
          unitPrice: smetaItems.unitPrice,
        },
        smeta: {
          id: smetas.id,
          projectId: smetas.projectId,
        },
        project: {
          id: projects.id,
          orgId: projects.orgId,
        },
        requestedBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(purchaseRequests)
      .innerJoin(smetaItems, eq(purchaseRequests.smetaItemId, smetaItems.id))
      .innerJoin(smetas, eq(smetaItems.smetaId, smetas.id))
      .innerJoin(projects, eq(smetas.projectId, projects.id))
      .innerJoin(users, eq(purchaseRequests.requestedById, users.id))
      .where(
        and(
          eq(projects.orgId, orgId),
          ...(projectId ? [eq(projects.id, projectId)] : []),
          ...conditions,
        ),
      );

    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseRequests)
      .innerJoin(smetaItems, eq(purchaseRequests.smetaItemId, smetaItems.id))
      .innerJoin(smetas, eq(smetaItems.smetaId, smetas.id))
      .innerJoin(projects, eq(smetas.projectId, projects.id))
      .where(
        and(
          eq(projects.orgId, orgId),
          ...(projectId ? [eq(projects.id, projectId)] : []),
          ...conditions,
        ),
      );

    const [countResult] = await countQuery;

    const results = await baseQuery
      .orderBy(desc(purchaseRequests.createdAt))
      .limit(limit)
      .offset(offset);

    const data: RequestWithRelations[] = results.map((r) => ({
      ...r.request,
      smetaItem: r.smetaItem,
      requestedBy: r.requestedBy,
      approvedBy: null,
    }));

    return { data, total: Number(countResult.count) };
  }

  async findById(id: string, orgId: string): Promise<RequestWithRelations | null> {
    const results = await this.db
      .select({
        request: purchaseRequests,
        smetaItem: {
          id: smetaItems.id,
          name: smetaItems.name,
          unit: smetaItems.unit,
          quantity: smetaItems.quantity,
          unitPrice: smetaItems.unitPrice,
        },
        project: {
          id: projects.id,
          orgId: projects.orgId,
        },
        requestedBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(purchaseRequests)
      .innerJoin(smetaItems, eq(purchaseRequests.smetaItemId, smetaItems.id))
      .innerJoin(smetas, eq(smetaItems.smetaId, smetas.id))
      .innerJoin(projects, eq(smetas.projectId, projects.id))
      .innerJoin(users, eq(purchaseRequests.requestedById, users.id))
      .where(and(eq(purchaseRequests.id, id), eq(projects.orgId, orgId)));

    if (results.length === 0) {
      return null;
    }

    const r = results[0];
    return {
      ...r.request,
      smetaItem: r.smetaItem,
      requestedBy: r.requestedBy,
      approvedBy: null,
    };
  }

  async update(id: string, data: Partial<NewPurchaseRequest>): Promise<PurchaseRequest> {
    await this.db
      .update(purchaseRequests)
      .set(data)
      .where(eq(purchaseRequests.id, id));
    const [result] = await this.db.select().from(purchaseRequests).where(eq(purchaseRequests.id, id));
    return result;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(purchaseRequests).where(eq(purchaseRequests.id, id));
  }

  async getSmetaItemOrgId(smetaItemId: string): Promise<string | null> {
    const results = await this.db
      .select({ orgId: projects.orgId })
      .from(smetaItems)
      .innerJoin(smetas, eq(smetaItems.smetaId, smetas.id))
      .innerJoin(projects, eq(smetas.projectId, projects.id))
      .where(eq(smetaItems.id, smetaItemId));

    return results.length > 0 ? results[0].orgId : null;
  }
}
