import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import {
  NewSmetaItem,
  SmetaItem,
  SmetaItemCategory,
  smetaItems,
  smetas,
  projects,
} from 'src/common/database/schemas';

export type SmetaItemWithRelations = SmetaItem & {
  smeta?: {
    id: string;
    name: string;
  };
};

@Injectable()
export class VendorSmetaItemsRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async create(data: NewSmetaItem): Promise<SmetaItem> {
    const id = randomUUID();
    const totalAmount = data.quantity * data.unitPrice;
    await this.db.insert(smetaItems).values({ ...data, id, totalAmount });
    const [result] = await this.db.select().from(smetaItems).where(eq(smetaItems.id, id));
    return result;
  }

  async findAll(
    orgId: string,
    params: {
      page: number;
      limit: number;
      smetaId?: string;
      projectId?: string;
      itemType?: SmetaItemCategory;
    },
  ): Promise<{ data: SmetaItemWithRelations[]; total: number }> {
    const { page, limit, smetaId, projectId, itemType } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];

    if (smetaId) {
      conditions.push(eq(smetaItems.smetaId, smetaId));
    }
    if (projectId) {
      conditions.push(eq(smetas.projectId, projectId));
    }
    if (itemType) {
      conditions.push(eq(smetaItems.itemType, itemType));
    }

    const baseQuery = this.db
      .select({
        smetaItem: smetaItems,
        smeta: {
          id: smetas.id,
          name: smetas.name,
        },
      })
      .from(smetaItems)
      .innerJoin(smetas, eq(smetaItems.smetaId, smetas.id))
      .innerJoin(projects, eq(smetas.projectId, projects.id))
      .where(and(eq(projects.orgId, orgId), ...conditions));

    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(smetaItems)
      .innerJoin(smetas, eq(smetaItems.smetaId, smetas.id))
      .innerJoin(projects, eq(smetas.projectId, projects.id))
      .where(and(eq(projects.orgId, orgId), ...conditions));

    const [countResult] = await countQuery;

    const results = await baseQuery
      .orderBy(desc(smetaItems.createdAt))
      .limit(limit)
      .offset(offset);

    const data: SmetaItemWithRelations[] = results.map((r) => ({
      ...r.smetaItem,
      smeta: r.smeta,
    }));

    return { data, total: Number(countResult.count) };
  }

  async findById(id: string, orgId: string): Promise<SmetaItemWithRelations | null> {
    const results = await this.db
      .select({
        smetaItem: smetaItems,
        smeta: {
          id: smetas.id,
          name: smetas.name,
        },
      })
      .from(smetaItems)
      .innerJoin(smetas, eq(smetaItems.smetaId, smetas.id))
      .innerJoin(projects, eq(smetas.projectId, projects.id))
      .where(and(eq(smetaItems.id, id), eq(projects.orgId, orgId)));

    if (results.length === 0) {
      return null;
    }

    const r = results[0];
    return {
      ...r.smetaItem,
      smeta: r.smeta,
    };
  }

  async update(id: string, data: Partial<NewSmetaItem>): Promise<SmetaItem> {
    const updateData = { ...data };

    if (data.quantity !== undefined || data.unitPrice !== undefined) {
      const existing = await this.db
        .select({ quantity: smetaItems.quantity, unitPrice: smetaItems.unitPrice })
        .from(smetaItems)
        .where(eq(smetaItems.id, id));

      if (existing.length > 0) {
        const quantity = data.quantity ?? existing[0].quantity;
        const unitPrice = data.unitPrice ?? existing[0].unitPrice;
        (updateData as Record<string, unknown>).totalAmount = quantity * unitPrice;
      }
    }

    await this.db
      .update(smetaItems)
      .set(updateData)
      .where(eq(smetaItems.id, id));
    const [result] = await this.db.select().from(smetaItems).where(eq(smetaItems.id, id));
    return result;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(smetaItems).where(eq(smetaItems.id, id));
  }

  async getSmetaOrgId(smetaId: string): Promise<string | null> {
    const results = await this.db
      .select({ orgId: projects.orgId })
      .from(smetas)
      .innerJoin(projects, eq(smetas.projectId, projects.id))
      .where(eq(smetas.id, smetaId));

    return results.length > 0 ? results[0].orgId : null;
  }
}
