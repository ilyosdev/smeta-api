import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, like, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import {
  NewSupplier,
  NewSupplierDebt,
  NewSupplyOrder,
  NewSupplyOrderItem,
  Supplier,
  SupplierDebt,
  SupplyOrder,
  SupplyOrderItem,
  SupplyOrderStatus,
  suppliers,
  supplierDebts,
  supplyOrders,
  supplyOrderItems,
  users,
  projects,
} from 'src/common/database/schemas';

export type SupplierWithDebt = Supplier & {
  totalDebt?: number;
};

export type SupplyOrderWithRelations = SupplyOrder & {
  supplier?: { id: string; name: string };
  project?: { id: string; name: string };
  orderedBy?: { id: string; name: string };
  items?: SupplyOrderItem[];
};

export type SupplierDebtWithRelations = SupplierDebt & {
  supplier?: { id: string; name: string };
};

@Injectable()
export class VendorSuppliersRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async createSupplier(data: NewSupplier): Promise<Supplier> {
    const id = randomUUID();
    await this.db.insert(suppliers).values({ ...data, id });
    const [result] = await this.db.select().from(suppliers).where(eq(suppliers.id, id));
    return result;
  }

  async findAllSuppliers(
    orgId: string,
    params: { page: number; limit: number; search?: string },
  ): Promise<{ data: SupplierWithDebt[]; total: number }> {
    const { page, limit, search } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [eq(suppliers.orgId, orgId)];
    if (search) {
      conditions.push(like(suppliers.name, `%${search}%`));
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(suppliers)
      .where(and(...conditions));

    const results = await this.db
      .select({
        supplier: suppliers,
        totalDebt: sql<number>`coalesce(sum(case when ${supplierDebts.isPaid} = false then ${supplierDebts.amount} else 0 end), 0)`,
      })
      .from(suppliers)
      .leftJoin(supplierDebts, eq(supplierDebts.supplierId, suppliers.id))
      .where(and(...conditions))
      .groupBy(suppliers.id)
      .orderBy(desc(suppliers.createdAt))
      .limit(limit)
      .offset(offset);

    const data: SupplierWithDebt[] = results.map((r) => ({
      ...r.supplier,
      totalDebt: Number(r.totalDebt),
    }));

    return { data, total: Number(countResult.count) };
  }

  async findSupplierById(id: string, orgId: string): Promise<SupplierWithDebt | null> {
    const [result] = await this.db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.orgId, orgId)));

    if (!result) return null;

    const [debtResult] = await this.db
      .select({ total: sql<number>`coalesce(sum(${supplierDebts.amount}), 0)` })
      .from(supplierDebts)
      .where(and(eq(supplierDebts.supplierId, id), eq(supplierDebts.isPaid, false)));

    return { ...result, totalDebt: Number(debtResult.total) };
  }

  async updateSupplier(id: string, data: Partial<NewSupplier>): Promise<Supplier> {
    await this.db.update(suppliers).set(data).where(eq(suppliers.id, id));
    const [result] = await this.db.select().from(suppliers).where(eq(suppliers.id, id));
    return result;
  }

  async deleteSupplier(id: string): Promise<void> {
    await this.db.delete(suppliers).where(eq(suppliers.id, id));
  }

  async createSupplyOrder(data: NewSupplyOrder, items: NewSupplyOrderItem[]): Promise<SupplyOrder> {
    const id = randomUUID();
    const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
    await this.db.insert(supplyOrders).values({ ...data, id, totalCost });

    if (items.length > 0) {
      await this.db.insert(supplyOrderItems).values(items.map((item) => ({ ...item, id: randomUUID(), orderId: id })));
    }

    const [order] = await this.db.select().from(supplyOrders).where(eq(supplyOrders.id, id));
    return order;
  }

  async findAllSupplyOrders(
    orgId: string,
    params: { page: number; limit: number; supplierId?: string; projectId?: string; status?: SupplyOrderStatus },
  ): Promise<{ data: SupplyOrderWithRelations[]; total: number }> {
    const { page, limit, supplierId, projectId, status } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [eq(suppliers.orgId, orgId)];
    if (supplierId) conditions.push(eq(supplyOrders.supplierId, supplierId));
    if (projectId) conditions.push(eq(supplyOrders.projectId, projectId));
    if (status) conditions.push(eq(supplyOrders.status, status));

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(supplyOrders)
      .innerJoin(suppliers, eq(supplyOrders.supplierId, suppliers.id))
      .where(and(...conditions));

    const results = await this.db
      .select({
        order: supplyOrders,
        supplier: { id: suppliers.id, name: suppliers.name },
        project: { id: projects.id, name: projects.name },
        orderedBy: { id: users.id, name: users.name },
      })
      .from(supplyOrders)
      .innerJoin(suppliers, eq(supplyOrders.supplierId, suppliers.id))
      .innerJoin(projects, eq(supplyOrders.projectId, projects.id))
      .innerJoin(users, eq(supplyOrders.orderedById, users.id))
      .where(and(...conditions))
      .orderBy(desc(supplyOrders.createdAt))
      .limit(limit)
      .offset(offset);

    const data: SupplyOrderWithRelations[] = [];
    for (const r of results) {
      const items = await this.db
        .select()
        .from(supplyOrderItems)
        .where(eq(supplyOrderItems.orderId, r.order.id));

      data.push({
        ...r.order,
        supplier: r.supplier,
        project: r.project,
        orderedBy: r.orderedBy,
        items,
      });
    }

    return { data, total: Number(countResult.count) };
  }

  async findSupplyOrderById(id: string, orgId: string): Promise<SupplyOrderWithRelations | null> {
    const results = await this.db
      .select({
        order: supplyOrders,
        supplier: { id: suppliers.id, name: suppliers.name },
        project: { id: projects.id, name: projects.name },
        orderedBy: { id: users.id, name: users.name },
      })
      .from(supplyOrders)
      .innerJoin(suppliers, eq(supplyOrders.supplierId, suppliers.id))
      .innerJoin(projects, eq(supplyOrders.projectId, projects.id))
      .innerJoin(users, eq(supplyOrders.orderedById, users.id))
      .where(and(eq(supplyOrders.id, id), eq(suppliers.orgId, orgId)));

    if (results.length === 0) return null;

    const r = results[0];
    const items = await this.db.select().from(supplyOrderItems).where(eq(supplyOrderItems.orderId, id));

    return {
      ...r.order,
      supplier: r.supplier,
      project: r.project,
      orderedBy: r.orderedBy,
      items,
    };
  }

  async updateSupplyOrder(id: string, data: Partial<NewSupplyOrder>): Promise<SupplyOrder> {
    await this.db.update(supplyOrders).set(data).where(eq(supplyOrders.id, id));
    const [result] = await this.db.select().from(supplyOrders).where(eq(supplyOrders.id, id));
    return result;
  }

  async deleteSupplyOrder(id: string): Promise<void> {
    await this.db.delete(supplyOrders).where(eq(supplyOrders.id, id));
  }

  async createSupplierDebt(data: NewSupplierDebt): Promise<SupplierDebt> {
    const id = randomUUID();
    await this.db.insert(supplierDebts).values({ ...data, id });
    const [result] = await this.db.select().from(supplierDebts).where(eq(supplierDebts.id, id));
    return result;
  }

  async findSupplierDebts(
    supplierId: string,
    orgId: string,
    params: { page: number; limit: number },
  ): Promise<{ data: SupplierDebtWithRelations[]; total: number }> {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(supplierDebts)
      .innerJoin(suppliers, eq(supplierDebts.supplierId, suppliers.id))
      .where(and(eq(supplierDebts.supplierId, supplierId), eq(suppliers.orgId, orgId)));

    const results = await this.db
      .select({
        debt: supplierDebts,
        supplier: { id: suppliers.id, name: suppliers.name },
      })
      .from(supplierDebts)
      .innerJoin(suppliers, eq(supplierDebts.supplierId, suppliers.id))
      .where(and(eq(supplierDebts.supplierId, supplierId), eq(suppliers.orgId, orgId)))
      .orderBy(desc(supplierDebts.createdAt))
      .limit(limit)
      .offset(offset);

    const data: SupplierDebtWithRelations[] = results.map((r) => ({
      ...r.debt,
      supplier: r.supplier,
    }));

    return { data, total: Number(countResult.count) };
  }

  async paySupplierDebt(debtId: string, paidById: string): Promise<SupplierDebt> {
    await this.db
      .update(supplierDebts)
      .set({ isPaid: true, paidAt: new Date(), paidById })
      .where(eq(supplierDebts.id, debtId));
    const [result] = await this.db.select().from(supplierDebts).where(eq(supplierDebts.id, debtId));
    return result;
  }

  async findSupplierDebtsByFilter(
    orgId: string,
    params: { supplierId?: string; isPaid?: boolean; dateFrom?: Date; dateTo?: Date; page: number; limit: number },
  ): Promise<{ data: SupplierDebtWithRelations[]; total: number }> {
    const { supplierId, isPaid, dateFrom, dateTo, page, limit } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [eq(suppliers.orgId, orgId)];
    if (supplierId) conditions.push(eq(supplierDebts.supplierId, supplierId));
    if (isPaid !== undefined) conditions.push(eq(supplierDebts.isPaid, isPaid));
    if (dateFrom) conditions.push(sql`${supplierDebts.createdAt} >= ${dateFrom}`);
    if (dateTo) conditions.push(sql`${supplierDebts.createdAt} <= ${dateTo}`);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(supplierDebts)
      .innerJoin(suppliers, eq(supplierDebts.supplierId, suppliers.id))
      .where(and(...conditions));

    const results = await this.db
      .select({
        debt: supplierDebts,
        supplier: { id: suppliers.id, name: suppliers.name },
      })
      .from(supplierDebts)
      .innerJoin(suppliers, eq(supplierDebts.supplierId, suppliers.id))
      .where(and(...conditions))
      .orderBy(desc(supplierDebts.createdAt))
      .limit(limit)
      .offset(offset);

    const data: SupplierDebtWithRelations[] = results.map((r) => ({
      ...r.debt,
      supplier: r.supplier,
    }));

    return { data, total: Number(countResult.count) };
  }

  async findPaidDebts(
    orgId: string,
    params: { projectId?: string; dateFrom?: Date; dateTo?: Date; page: number; limit: number },
  ): Promise<{ data: SupplierDebtWithRelations[]; total: number }> {
    const { dateFrom, dateTo, page, limit } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [
      eq(suppliers.orgId, orgId),
      eq(supplierDebts.isPaid, true),
    ];
    if (dateFrom) conditions.push(sql`${supplierDebts.paidAt} >= ${dateFrom}`);
    if (dateTo) conditions.push(sql`${supplierDebts.paidAt} <= ${dateTo}`);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(supplierDebts)
      .innerJoin(suppliers, eq(supplierDebts.supplierId, suppliers.id))
      .where(and(...conditions));

    const results = await this.db
      .select({
        debt: supplierDebts,
        supplier: { id: suppliers.id, name: suppliers.name },
      })
      .from(supplierDebts)
      .innerJoin(suppliers, eq(supplierDebts.supplierId, suppliers.id))
      .where(and(...conditions))
      .orderBy(desc(supplierDebts.paidAt))
      .limit(limit)
      .offset(offset);

    const data: SupplierDebtWithRelations[] = results.map((r) => ({
      ...r.debt,
      supplier: r.supplier,
    }));

    return { data, total: Number(countResult.count) };
  }

  async findSupplierByUserId(userId: string, orgId: string): Promise<SupplierWithDebt | null> {
    const [result] = await this.db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.userId, userId), eq(suppliers.orgId, orgId)));

    if (!result) return null;

    const [debtResult] = await this.db
      .select({ total: sql<number>`coalesce(sum(${supplierDebts.amount}), 0)` })
      .from(supplierDebts)
      .where(and(eq(supplierDebts.supplierId, result.id), eq(supplierDebts.isPaid, false)));

    return { ...result, totalDebt: Number(debtResult.total) };
  }

  async getSupplierOrgId(supplierId: string): Promise<string | null> {
    const [result] = await this.db.select({ orgId: suppliers.orgId }).from(suppliers).where(eq(suppliers.id, supplierId));
    return result?.orgId ?? null;
  }

  async getProjectOrgId(projectId: string): Promise<string | null> {
    const [result] = await this.db.select({ orgId: projects.orgId }).from(projects).where(eq(projects.id, projectId));
    return result?.orgId ?? null;
  }
}
