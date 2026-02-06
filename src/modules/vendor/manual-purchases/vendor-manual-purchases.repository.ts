import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import {
  ManualPurchase,
  NewManualPurchase,
  manualPurchases,
  projects,
  smetaItems,
  smetas,
  users,
} from 'src/common/database/schemas';

export type ManualPurchaseWithRelations = ManualPurchase & {
  smetaItem?: { id: string; name: string };
  submittedBy?: { id: string; name: string };
};

@Injectable()
export class VendorManualPurchasesRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async createManualPurchase(data: NewManualPurchase): Promise<ManualPurchase> {
    const id = randomUUID();
    await this.db.insert(manualPurchases).values({ ...data, id });
    const [result] = await this.db.select().from(manualPurchases).where(eq(manualPurchases.id, id));
    return result;
  }

  async findAllManualPurchases(
    orgId: string,
    params: { page: number; limit: number; smetaItemId?: string },
  ): Promise<{ data: ManualPurchaseWithRelations[]; total: number }> {
    const { page, limit, smetaItemId } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [eq(projects.orgId, orgId)];
    if (smetaItemId) {
      conditions.push(eq(manualPurchases.smetaItemId, smetaItemId));
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(manualPurchases)
      .innerJoin(smetaItems, eq(manualPurchases.smetaItemId, smetaItems.id))
      .innerJoin(smetas, eq(smetaItems.smetaId, smetas.id))
      .innerJoin(projects, eq(smetas.projectId, projects.id))
      .where(and(...conditions));

    const results = await this.db
      .select({
        manualPurchase: manualPurchases,
        smetaItem: { id: smetaItems.id, name: smetaItems.name },
        submittedBy: { id: users.id, name: users.name },
      })
      .from(manualPurchases)
      .innerJoin(smetaItems, eq(manualPurchases.smetaItemId, smetaItems.id))
      .innerJoin(smetas, eq(smetaItems.smetaId, smetas.id))
      .innerJoin(projects, eq(smetas.projectId, projects.id))
      .innerJoin(users, eq(manualPurchases.submittedById, users.id))
      .where(and(...conditions))
      .orderBy(desc(manualPurchases.createdAt))
      .limit(limit)
      .offset(offset);

    const data: ManualPurchaseWithRelations[] = results.map((r) => ({
      ...r.manualPurchase,
      smetaItem: r.smetaItem,
      submittedBy: r.submittedBy,
    }));

    return { data, total: Number(countResult.count) };
  }

  async findManualPurchaseById(id: string, orgId: string): Promise<ManualPurchaseWithRelations | null> {
    const results = await this.db
      .select({
        manualPurchase: manualPurchases,
        smetaItem: { id: smetaItems.id, name: smetaItems.name },
        submittedBy: { id: users.id, name: users.name },
      })
      .from(manualPurchases)
      .innerJoin(smetaItems, eq(manualPurchases.smetaItemId, smetaItems.id))
      .innerJoin(smetas, eq(smetaItems.smetaId, smetas.id))
      .innerJoin(projects, eq(smetas.projectId, projects.id))
      .innerJoin(users, eq(manualPurchases.submittedById, users.id))
      .where(and(eq(manualPurchases.id, id), eq(projects.orgId, orgId)));

    if (results.length === 0) return null;

    const r = results[0];
    return {
      ...r.manualPurchase,
      smetaItem: r.smetaItem,
      submittedBy: r.submittedBy,
    };
  }

  async updateManualPurchase(
    id: string,
    data: Partial<Pick<ManualPurchase, 'quantity' | 'amount' | 'receiptUrl' | 'note'>>,
  ): Promise<void> {
    await this.db.update(manualPurchases).set(data).where(eq(manualPurchases.id, id));
  }

  async deleteManualPurchase(id: string): Promise<void> {
    await this.db.delete(manualPurchases).where(eq(manualPurchases.id, id));
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
