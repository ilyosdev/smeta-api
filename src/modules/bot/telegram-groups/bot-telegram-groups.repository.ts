import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import {
  NewTelegramGroup,
  TelegramGroup,
  telegramGroups,
  projects,
} from 'src/common/database/schemas';

export type TelegramGroupWithRelations = TelegramGroup & {
  project?: { id: string; name: string };
};

@Injectable()
export class BotTelegramGroupsRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async createTelegramGroup(data: NewTelegramGroup): Promise<TelegramGroup> {
    const id = randomUUID();
    await this.db.insert(telegramGroups).values({ ...data, id });
    const [result] = await this.db.select().from(telegramGroups).where(eq(telegramGroups.id, id));
    return result;
  }

  async findAllTelegramGroups(
    orgId: string,
    params: { page: number; limit: number; projectId?: string },
  ): Promise<{ data: TelegramGroupWithRelations[]; total: number }> {
    const { page, limit, projectId } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [eq(projects.orgId, orgId)];
    if (projectId) {
      conditions.push(eq(telegramGroups.projectId, projectId));
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(telegramGroups)
      .innerJoin(projects, eq(telegramGroups.projectId, projects.id))
      .where(and(...conditions));

    const results = await this.db
      .select({
        telegramGroup: telegramGroups,
        project: { id: projects.id, name: projects.name },
      })
      .from(telegramGroups)
      .innerJoin(projects, eq(telegramGroups.projectId, projects.id))
      .where(and(...conditions))
      .orderBy(desc(telegramGroups.joinedAt))
      .limit(limit)
      .offset(offset);

    const data: TelegramGroupWithRelations[] = results.map((r) => ({
      ...r.telegramGroup,
      project: r.project,
    }));

    return { data, total: Number(countResult.count) };
  }

  async findTelegramGroupById(id: string, orgId: string): Promise<TelegramGroupWithRelations | null> {
    const results = await this.db
      .select({
        telegramGroup: telegramGroups,
        project: { id: projects.id, name: projects.name },
      })
      .from(telegramGroups)
      .innerJoin(projects, eq(telegramGroups.projectId, projects.id))
      .where(and(eq(telegramGroups.id, id), eq(projects.orgId, orgId)));

    if (results.length === 0) return null;

    const r = results[0];
    return { ...r.telegramGroup, project: r.project };
  }

  async findByChatId(chatId: string): Promise<TelegramGroupWithRelations | null> {
    const results = await this.db
      .select({
        telegramGroup: telegramGroups,
        project: { id: projects.id, name: projects.name },
      })
      .from(telegramGroups)
      .innerJoin(projects, eq(telegramGroups.projectId, projects.id))
      .where(eq(telegramGroups.chatId, chatId));

    if (results.length === 0) return null;

    const r = results[0];
    return { ...r.telegramGroup, project: r.project };
  }

  async updateTelegramGroup(id: string, data: Partial<NewTelegramGroup>): Promise<TelegramGroup> {
    await this.db
      .update(telegramGroups)
      .set(data)
      .where(eq(telegramGroups.id, id));
    const [result] = await this.db.select().from(telegramGroups).where(eq(telegramGroups.id, id));
    return result;
  }

  async deleteTelegramGroup(id: string): Promise<void> {
    await this.db.delete(telegramGroups).where(eq(telegramGroups.id, id));
  }

  async getProjectOrgId(projectId: string): Promise<string | null> {
    const [result] = await this.db.select({ orgId: projects.orgId }).from(projects).where(eq(projects.id, projectId));
    return result?.orgId ?? null;
  }
}
