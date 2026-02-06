import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, like, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import { NewProject, Project, ProjectStatus, projects } from 'src/common/database/schemas';

@Injectable()
export class VendorProjectsRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async create(data: NewProject): Promise<Project> {
    const id = randomUUID();
    await this.db.insert(projects).values({ ...data, id });
    const [result] = await this.db.select().from(projects).where(eq(projects.id, id));
    return result;
  }

  async findAll(
    orgId: string,
    params: { page: number; limit: number; search?: string; status?: ProjectStatus },
  ): Promise<{ data: Project[]; total: number }> {
    const { page, limit, search, status } = params;
    const offset = (page - 1) * limit;

    const conditions = [eq(projects.orgId, orgId)];
    if (search) {
      conditions.push(like(projects.name, `%${search}%`));
    }
    if (status) {
      conditions.push(eq(projects.status, status));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(whereClause);

    const data = await this.db.query.projects.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(projects.createdAt)],
    });

    return { data, total: Number(countResult.count) };
  }

  async findById(id: string, orgId: string): Promise<Project | null> {
    const result = await this.db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.orgId, orgId)),
    });
    return result ?? null;
  }

  async update(id: string, orgId: string, data: Partial<NewProject>): Promise<Project> {
    await this.db
      .update(projects)
      .set(data)
      .where(and(eq(projects.id, id), eq(projects.orgId, orgId)));
    const [result] = await this.db.select().from(projects).where(eq(projects.id, id));
    return result;
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.delete(projects).where(and(eq(projects.id, id), eq(projects.orgId, orgId)));
  }
}
