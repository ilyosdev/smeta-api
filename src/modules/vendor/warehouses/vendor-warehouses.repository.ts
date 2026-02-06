import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import {
  NewWarehouse,
  NewWarehouseItem,
  NewWarehouseTransfer,
  Warehouse,
  WarehouseItem,
  WarehouseTransfer,
  WarehouseTransferStatus,
  warehouses,
  warehouseItems,
  warehouseTransfers,
  projects,
  users,
} from 'src/common/database/schemas';

export type WarehouseWithRelations = Warehouse & {
  project?: { id: string; name: string };
};

export type WarehouseTransferWithRelations = WarehouseTransfer & {
  fromWarehouse?: { id: string; name: string };
  toWarehouse?: { id: string; name: string };
  createdBy?: { id: string; name: string };
};

@Injectable()
export class VendorWarehousesRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async createWarehouse(data: NewWarehouse): Promise<Warehouse> {
    const id = randomUUID();
    await this.db.insert(warehouses).values({ ...data, id });
    const [result] = await this.db.select().from(warehouses).where(eq(warehouses.id, id));
    return result;
  }

  async findAllWarehouses(
    orgId: string,
    params: { page: number; limit: number; projectId?: string },
  ): Promise<{ data: WarehouseWithRelations[]; total: number }> {
    const { page, limit, projectId } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [eq(projects.orgId, orgId)];
    if (projectId) {
      conditions.push(eq(warehouses.projectId, projectId));
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(warehouses)
      .innerJoin(projects, eq(warehouses.projectId, projects.id))
      .where(and(...conditions));

    const results = await this.db
      .select({
        warehouse: warehouses,
        project: { id: projects.id, name: projects.name },
      })
      .from(warehouses)
      .innerJoin(projects, eq(warehouses.projectId, projects.id))
      .where(and(...conditions))
      .orderBy(desc(warehouses.createdAt))
      .limit(limit)
      .offset(offset);

    const data: WarehouseWithRelations[] = results.map((r) => ({
      ...r.warehouse,
      project: r.project,
    }));

    return { data, total: Number(countResult.count) };
  }

  async findWarehouseById(id: string, orgId: string): Promise<WarehouseWithRelations | null> {
    const results = await this.db
      .select({
        warehouse: warehouses,
        project: { id: projects.id, name: projects.name },
      })
      .from(warehouses)
      .innerJoin(projects, eq(warehouses.projectId, projects.id))
      .where(and(eq(warehouses.id, id), eq(projects.orgId, orgId)));

    if (results.length === 0) return null;

    const r = results[0];
    return { ...r.warehouse, project: r.project };
  }

  async updateWarehouse(id: string, data: Partial<NewWarehouse>): Promise<Warehouse> {
    await this.db.update(warehouses).set(data).where(eq(warehouses.id, id));
    const [result] = await this.db.select().from(warehouses).where(eq(warehouses.id, id));
    return result;
  }

  async deleteWarehouse(id: string): Promise<void> {
    await this.db.delete(warehouses).where(eq(warehouses.id, id));
  }

  async createWarehouseItem(data: NewWarehouseItem): Promise<WarehouseItem> {
    const id = randomUUID();
    await this.db.insert(warehouseItems).values({ ...data, id });
    const [result] = await this.db.select().from(warehouseItems).where(eq(warehouseItems.id, id));
    return result;
  }

  async findWarehouseItems(
    warehouseId: string,
    params: { page: number; limit: number },
  ): Promise<{ data: WarehouseItem[]; total: number }> {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(warehouseItems)
      .where(eq(warehouseItems.warehouseId, warehouseId));

    const data = await this.db
      .select()
      .from(warehouseItems)
      .where(eq(warehouseItems.warehouseId, warehouseId))
      .orderBy(desc(warehouseItems.updatedAt))
      .limit(limit)
      .offset(offset);

    return { data, total: Number(countResult.count) };
  }

  async findWarehouseItemById(id: string): Promise<WarehouseItem | null> {
    const [result] = await this.db.select().from(warehouseItems).where(eq(warehouseItems.id, id));
    return result ?? null;
  }

  async updateWarehouseItem(id: string, data: Partial<NewWarehouseItem>): Promise<WarehouseItem> {
    await this.db.update(warehouseItems).set(data).where(eq(warehouseItems.id, id));
    const [result] = await this.db.select().from(warehouseItems).where(eq(warehouseItems.id, id));
    return result;
  }

  async deleteWarehouseItem(id: string): Promise<void> {
    await this.db.delete(warehouseItems).where(eq(warehouseItems.id, id));
  }

  async createTransfer(data: NewWarehouseTransfer): Promise<WarehouseTransfer> {
    const id = randomUUID();
    await this.db.insert(warehouseTransfers).values({ ...data, id });
    const [result] = await this.db.select().from(warehouseTransfers).where(eq(warehouseTransfers.id, id));
    return result;
  }

  async findTransfers(
    orgId: string,
    params: { page: number; limit: number; warehouseId?: string },
  ): Promise<{ data: WarehouseTransferWithRelations[]; total: number }> {
    const { page, limit, warehouseId } = params;
    const offset = (page - 1) * limit;

    const fromWarehouses = this.db.$with('from_warehouses').as(
      this.db.select({ id: warehouses.id, name: warehouses.name, projectId: warehouses.projectId }).from(warehouses),
    );
    const toWarehouses = this.db.$with('to_warehouses').as(
      this.db.select({ id: warehouses.id, name: warehouses.name, projectId: warehouses.projectId }).from(warehouses),
    );

    const baseConditions: ReturnType<typeof eq>[] = [];
    if (warehouseId) {
      baseConditions.push(eq(warehouseTransfers.fromWarehouseId, warehouseId));
    }

    const results = await this.db
      .select({
        transfer: warehouseTransfers,
        fromWarehouse: { id: warehouses.id, name: warehouses.name },
        createdBy: { id: users.id, name: users.name },
      })
      .from(warehouseTransfers)
      .innerJoin(warehouses, eq(warehouseTransfers.fromWarehouseId, warehouses.id))
      .innerJoin(projects, eq(warehouses.projectId, projects.id))
      .innerJoin(users, eq(warehouseTransfers.createdById, users.id))
      .where(and(eq(projects.orgId, orgId), ...baseConditions))
      .orderBy(desc(warehouseTransfers.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(warehouseTransfers)
      .innerJoin(warehouses, eq(warehouseTransfers.fromWarehouseId, warehouses.id))
      .innerJoin(projects, eq(warehouses.projectId, projects.id))
      .where(and(eq(projects.orgId, orgId), ...baseConditions));

    const data: WarehouseTransferWithRelations[] = [];
    for (const r of results) {
      const [toWarehouseResult] = await this.db
        .select({ id: warehouses.id, name: warehouses.name })
        .from(warehouses)
        .where(eq(warehouses.id, r.transfer.toWarehouseId));

      data.push({
        ...r.transfer,
        fromWarehouse: r.fromWarehouse,
        toWarehouse: toWarehouseResult,
        createdBy: r.createdBy,
      });
    }

    return { data, total: Number(countResult.count) };
  }

  async findTransferById(id: string, orgId: string): Promise<WarehouseTransferWithRelations | null> {
    const results = await this.db
      .select({
        transfer: warehouseTransfers,
        fromWarehouse: { id: warehouses.id, name: warehouses.name },
        createdBy: { id: users.id, name: users.name },
      })
      .from(warehouseTransfers)
      .innerJoin(warehouses, eq(warehouseTransfers.fromWarehouseId, warehouses.id))
      .innerJoin(projects, eq(warehouses.projectId, projects.id))
      .innerJoin(users, eq(warehouseTransfers.createdById, users.id))
      .where(and(eq(warehouseTransfers.id, id), eq(projects.orgId, orgId)));

    if (results.length === 0) return null;

    const r = results[0];
    const [toWarehouseResult] = await this.db
      .select({ id: warehouses.id, name: warehouses.name })
      .from(warehouses)
      .where(eq(warehouses.id, r.transfer.toWarehouseId));

    return {
      ...r.transfer,
      fromWarehouse: r.fromWarehouse,
      toWarehouse: toWarehouseResult,
      createdBy: r.createdBy,
    };
  }

  async updateTransfer(id: string, data: Partial<NewWarehouseTransfer>): Promise<WarehouseTransfer> {
    await this.db.update(warehouseTransfers).set(data).where(eq(warehouseTransfers.id, id));
    const [result] = await this.db.select().from(warehouseTransfers).where(eq(warehouseTransfers.id, id));
    return result;
  }

  async getProjectOrgId(projectId: string): Promise<string | null> {
    const [result] = await this.db.select({ orgId: projects.orgId }).from(projects).where(eq(projects.id, projectId));
    return result?.orgId ?? null;
  }

  async getWarehouseOrgId(warehouseId: string): Promise<string | null> {
    const results = await this.db
      .select({ orgId: projects.orgId })
      .from(warehouses)
      .innerJoin(projects, eq(warehouses.projectId, projects.id))
      .where(eq(warehouses.id, warehouseId));
    return results.length > 0 ? results[0].orgId : null;
  }
}
