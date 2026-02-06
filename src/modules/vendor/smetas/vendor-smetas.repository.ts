import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, like, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import { NewSmeta, projects, Smeta, SmetaType, smetas } from 'src/common/database/schemas';

export type SmetaWithProject = Smeta & { project: { name: string } };

@Injectable()
export class VendorSmetasRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async create(data: NewSmeta): Promise<Smeta> {
    const id = randomUUID();
    await this.db.insert(smetas).values({ ...data, id });
    const [result] = await this.db.select().from(smetas).where(eq(smetas.id, id));
    return result;
  }

  async findAll(
    orgId: string,
    params: { page: number; limit: number; projectId?: string; search?: string; type?: SmetaType },
  ): Promise<{ data: SmetaWithProject[]; total: number }> {
    const { page, limit, projectId, search, type } = params;
    const offset = (page - 1) * limit;

    const orgProjectIds = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.orgId, orgId));
    
    const projectIdList = orgProjectIds.map((o) => o.id);
    
    if (projectIdList.length === 0) {
      return { data: [], total: 0 };
    }

    const conditions = [inArray(smetas.projectId, projectIdList)];
    if (projectId) {
      conditions.push(eq(smetas.projectId, projectId));
    }
    if (search) {
      conditions.push(like(smetas.name, `%${search}%`));
    }
    if (type) {
      conditions.push(eq(smetas.type, type));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(smetas)
      .where(whereClause);

    const data = await this.db.query.smetas.findMany({
      where: whereClause,
      with: {
        project: true,
      },
      limit,
      offset,
      orderBy: [desc(smetas.createdAt)],
    });

    return {
      data: data.map((s) => ({ ...s, project: { name: s.project.name } })),
      total: Number(countResult.count),
    };
  }

  async findById(id: string, orgId: string): Promise<SmetaWithProject | null> {
    const result = await this.db.query.smetas.findFirst({
      where: eq(smetas.id, id),
      with: {
        project: true,
      },
    });

    if (!result || result.project.orgId !== orgId) {
      return null;
    }

    return { ...result, project: { name: result.project.name } };
  }

  async update(id: string, data: Partial<NewSmeta>): Promise<Smeta> {
    await this.db.update(smetas).set(data).where(eq(smetas.id, id));
    const [result] = await this.db.select().from(smetas).where(eq(smetas.id, id));
    return result;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(smetas).where(eq(smetas.id, id));
  }
}
