import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
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
  UserRole,
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
  fulfilledBy?: {
    id: string;
    name: string;
  } | null;
  assignedDriver?: {
    id: string;
    name: string;
  } | null;
  receivedBy?: {
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
      statuses?: RequestStatus[];
      smetaItemId?: string;
      projectId?: string;
    },
  ): Promise<{ data: RequestWithRelations[]; total: number }> {
    const { page, limit, status, statuses, smetaItemId, projectId } = params;
    const offset = (page - 1) * limit;

    const fulfilledByUser = alias(users, 'fulfilled_by_user');

    const conditions: ReturnType<typeof eq>[] = [];

    if (statuses && statuses.length > 0) {
      conditions.push(or(...statuses.map((s) => eq(purchaseRequests.status, s)))!);
    } else if (status) {
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
        fulfilledBy: {
          id: fulfilledByUser.id,
          name: fulfilledByUser.name,
        },
      })
      .from(purchaseRequests)
      .innerJoin(smetaItems, eq(purchaseRequests.smetaItemId, smetaItems.id))
      .innerJoin(smetas, eq(smetaItems.smetaId, smetas.id))
      .innerJoin(projects, eq(smetas.projectId, projects.id))
      .innerJoin(users, eq(purchaseRequests.requestedById, users.id))
      .leftJoin(fulfilledByUser, eq(purchaseRequests.fulfilledById, fulfilledByUser.id))
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
      fulfilledBy: r.fulfilledBy?.id ? r.fulfilledBy : null,
    }));

    return { data, total: Number(countResult.count) };
  }

  async findById(id: string, orgId: string): Promise<RequestWithRelations | null> {
    const fulfilledByUser = alias(users, 'fulfilled_by_user');

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
        fulfilledBy: {
          id: fulfilledByUser.id,
          name: fulfilledByUser.name,
        },
      })
      .from(purchaseRequests)
      .innerJoin(smetaItems, eq(purchaseRequests.smetaItemId, smetaItems.id))
      .innerJoin(smetas, eq(smetaItems.smetaId, smetas.id))
      .innerJoin(projects, eq(smetas.projectId, projects.id))
      .innerJoin(users, eq(purchaseRequests.requestedById, users.id))
      .leftJoin(fulfilledByUser, eq(purchaseRequests.fulfilledById, fulfilledByUser.id))
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
      fulfilledBy: r.fulfilledBy?.id ? r.fulfilledBy : null,
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

  async findByDriver(
    driverId: string,
    orgId: string,
    status?: RequestStatus,
  ): Promise<{ data: RequestWithRelations[]; total: number }> {
    const conditions: ReturnType<typeof eq>[] = [
      eq(purchaseRequests.assignedDriverId, driverId),
    ];

    if (status) {
      conditions.push(eq(purchaseRequests.status, status));
    }

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
      .where(and(eq(projects.orgId, orgId), ...conditions))
      .orderBy(desc(purchaseRequests.createdAt));

    const data: RequestWithRelations[] = results.map((r) => ({
      ...r.request,
      smetaItem: r.smetaItem,
      requestedBy: r.requestedBy,
      approvedBy: null,
      fulfilledBy: null,
      assignedDriver: null,
      receivedBy: null,
    }));

    return { data, total: data.length };
  }

  async findDrivers(orgId: string): Promise<{ id: string; name: string }[]> {
    const results = await this.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(users.role, UserRole.HAYDOVCHI), eq(users.isActive, true)));

    return results;
  }
}
