import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, like, sql, SQL } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import {
  NewUser,
  User,
  UserRole,
  users,
  organizations,
  Organization,
  projects,
  Project,
  userProjects,
  operatorOrganizations,
} from 'src/common/database/schemas';
import { ProjectStatus } from 'src/common/database/schemas/projects';

@Injectable()
export class AdminRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  // ─── Organizations ──────────────────────────────

  async findAllOrganizations(
    params: { page: number; limit: number; search?: string },
    operatorId?: string,
  ): Promise<{ data: (Organization & { userCount: number; projectCount: number })[]; total: number }> {
    const { page, limit, search } = params;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (search) {
      conditions.push(like(organizations.name, `%${search}%`));
    }

    // If operatorId is provided, filter to only their assigned orgs
    let orgIds: string[] | undefined;
    if (operatorId) {
      const assignments = await this.db
        .select({ orgId: operatorOrganizations.orgId })
        .from(operatorOrganizations)
        .where(eq(operatorOrganizations.operatorId, operatorId));
      orgIds = assignments.map((a) => a.orgId);
      if (orgIds.length === 0) {
        return { data: [], total: 0 };
      }
      conditions.push(inArray(organizations.id, orgIds));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(organizations)
      .where(whereClause);

    const rows = await this.db
      .select({
        org: organizations,
        userCount: sql<number>`(SELECT COUNT(*) FROM users WHERE users.org_id = organizations.id)`,
        projectCount: sql<number>`(SELECT COUNT(*) FROM projects WHERE projects.org_id = organizations.id)`,
      })
      .from(organizations)
      .where(whereClause)
      .orderBy(desc(organizations.createdAt))
      .limit(limit)
      .offset(offset);

    const data = rows.map((r) => ({
      ...r.org,
      userCount: Number(r.userCount),
      projectCount: Number(r.projectCount),
    }));

    return { data, total: Number(countResult.count) };
  }

  async findOrganizationById(orgId: string): Promise<(Organization & { userCount: number; projectCount: number }) | null> {
    const rows = await this.db
      .select({
        org: organizations,
        userCount: sql<number>`(SELECT COUNT(*) FROM users WHERE users.org_id = organizations.id)`,
        projectCount: sql<number>`(SELECT COUNT(*) FROM projects WHERE projects.org_id = organizations.id)`,
      })
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (rows.length === 0) return null;

    return {
      ...rows[0].org,
      userCount: Number(rows[0].userCount),
      projectCount: Number(rows[0].projectCount),
    };
  }

  async createOrganization(name: string, phone?: string): Promise<Organization> {
    const id = randomUUID();
    await this.db.insert(organizations).values({ id, name, phone: phone || null });
    const [result] = await this.db.select().from(organizations).where(eq(organizations.id, id));
    return result;
  }

  async updateOrganization(id: string, data: Partial<{ name: string; phone: string | null; isActive: boolean }>): Promise<Organization> {
    await this.db.update(organizations).set(data).where(eq(organizations.id, id));
    const [result] = await this.db.select().from(organizations).where(eq(organizations.id, id));
    return result;
  }

  async deleteOrganization(id: string): Promise<void> {
    await this.db.delete(organizations).where(eq(organizations.id, id));
  }

  // ─── Operator-Organization assignments ──────────

  async assignOperatorToOrg(operatorId: string, orgId: string): Promise<void> {
    const existing = await this.db.query.operatorOrganizations.findFirst({
      where: and(
        eq(operatorOrganizations.operatorId, operatorId),
        eq(operatorOrganizations.orgId, orgId),
      ),
    });
    if (existing) return;
    const id = randomUUID();
    await this.db.insert(operatorOrganizations).values({ id, operatorId, orgId });
  }

  async getOperatorOrgIds(operatorId: string): Promise<string[]> {
    const rows = await this.db
      .select({ orgId: operatorOrganizations.orgId })
      .from(operatorOrganizations)
      .where(eq(operatorOrganizations.operatorId, operatorId));
    return rows.map((r) => r.orgId);
  }

  async isOperatorAssignedToOrg(operatorId: string, orgId: string): Promise<boolean> {
    const row = await this.db.query.operatorOrganizations.findFirst({
      where: and(
        eq(operatorOrganizations.operatorId, operatorId),
        eq(operatorOrganizations.orgId, orgId),
      ),
    });
    return !!row;
  }

  // ─── Operators ──────────────────────────────────

  async findAllOperators(
    params: { page: number; limit: number; search?: string },
  ): Promise<{ data: (User & { orgCount: number })[]; total: number }> {
    const { page, limit, search } = params;
    const offset = (page - 1) * limit;

    const conditions = [eq(users.role, UserRole.OPERATOR)];
    if (search) {
      conditions.push(like(users.name, `%${search}%`));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);

    const rows = await this.db
      .select({
        user: users,
        orgCount: sql<number>`(SELECT COUNT(*) FROM operator_organizations WHERE operator_organizations.operator_id = users.id)`,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const data = rows.map((r) => ({
      ...r.user,
      orgCount: Number(r.orgCount),
    }));

    return { data, total: Number(countResult.count) };
  }

  async findOperatorById(id: string): Promise<User | null> {
    const result = await this.db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.role, UserRole.OPERATOR)),
    });
    return result ?? null;
  }

  // ─── Users ──────────────────────────────────────

  async findUserByPhone(phone: string): Promise<User | null> {
    const result = await this.db.query.users.findFirst({
      where: eq(users.phone, phone),
    });
    return result ?? null;
  }

  async findUserByTelegramId(telegramId: string): Promise<User | null> {
    const result = await this.db.query.users.findFirst({
      where: eq(users.telegramId, telegramId),
    });
    return result ?? null;
  }

  async createUser(data: NewUser): Promise<User> {
    const id = randomUUID();
    await this.db.insert(users).values({ ...data, id });
    const [result] = await this.db.select().from(users).where(eq(users.id, id));
    return result;
  }

  async findUserById(id: string, orgId?: string): Promise<User | null> {
    const conditions = [eq(users.id, id)];
    if (orgId) conditions.push(eq(users.orgId, orgId));
    const result = await this.db.query.users.findFirst({
      where: and(...conditions),
    });
    return result ?? null;
  }

  async updateUser(id: string, data: Partial<NewUser>, orgId?: string): Promise<User> {
    const conditions = [eq(users.id, id)];
    if (orgId) conditions.push(eq(users.orgId, orgId));
    await this.db.update(users).set(data).where(and(...conditions));
    const [result] = await this.db.select().from(users).where(eq(users.id, id));
    return result;
  }

  async deleteUser(id: string, orgId?: string): Promise<void> {
    const conditions = [eq(users.id, id)];
    if (orgId) conditions.push(eq(users.orgId, orgId));
    await this.db.delete(users).where(and(...conditions));
  }

  async findAllUsers(
    orgId: string,
    params: { page: number; limit: number; search?: string },
  ): Promise<{ data: User[]; total: number }> {
    const { page, limit, search } = params;
    const offset = (page - 1) * limit;

    const conditions = [eq(users.orgId, orgId)];
    if (search) {
      conditions.push(like(users.name, `%${search}%`));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);

    const data = await this.db.query.users.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(users.createdAt)],
    });

    return { data, total: Number(countResult.count) };
  }

  // ─── Projects ───────────────────────────────────

  async findAllProjects(
    orgId: string,
    params: { page: number; limit: number; search?: string },
  ): Promise<{ data: Project[]; total: number }> {
    const { page, limit, search } = params;
    const offset = (page - 1) * limit;

    const conditions = [eq(projects.orgId, orgId)];
    if (search) {
      conditions.push(like(projects.name, `%${search}%`));
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

  async findProjectById(id: string, orgId: string): Promise<Project | null> {
    const result = await this.db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.orgId, orgId)),
    });
    return result ?? null;
  }

  async createProject(orgId: string, data: { name: string; address?: string; floors?: number; budget?: number }): Promise<Project> {
    const id = randomUUID();
    await this.db.insert(projects).values({
      id,
      orgId,
      name: data.name,
      address: data.address || null,
      floors: data.floors || null,
      budget: data.budget || null,
    });
    const [result] = await this.db.select().from(projects).where(eq(projects.id, id));
    return result;
  }

  async updateProject(id: string, orgId: string, data: Partial<{ name: string; address: string | null; floors: number | null; budget: number | null; status: ProjectStatus }>): Promise<Project> {
    await this.db.update(projects).set(data).where(and(eq(projects.id, id), eq(projects.orgId, orgId)));
    const [result] = await this.db.select().from(projects).where(eq(projects.id, id));
    return result;
  }

  async deleteProject(id: string, orgId: string): Promise<void> {
    await this.db.delete(projects).where(and(eq(projects.id, id), eq(projects.orgId, orgId)));
  }

  // ─── User-Project assignments ───────────────────

  async getUserProjectAssignments(userId: string): Promise<{ projectId: string; projectName: string }[]> {
    return this.db
      .select({
        projectId: userProjects.projectId,
        projectName: projects.name,
      })
      .from(userProjects)
      .innerJoin(projects, eq(userProjects.projectId, projects.id))
      .where(eq(userProjects.userId, userId));
  }

  async assignUserToProject(userId: string, projectId: string): Promise<void> {
    const existing = await this.db.query.userProjects.findFirst({
      where: and(eq(userProjects.userId, userId), eq(userProjects.projectId, projectId)),
    });
    if (existing) return;
    const id = randomUUID();
    await this.db.insert(userProjects).values({ id, userId, projectId });
  }

  async unassignUserFromProject(userId: string, projectId: string): Promise<void> {
    await this.db.delete(userProjects).where(
      and(eq(userProjects.userId, userId), eq(userProjects.projectId, projectId)),
    );
  }

  // ─── Stats ──────────────────────────────────────

  async getStats(operatorId?: string): Promise<{
    totalOrganizations: number;
    totalOperators: number;
    totalUsers: number;
    totalProjects: number;
  }> {
    let orgIds: string[] | undefined;
    if (operatorId) {
      orgIds = await this.getOperatorOrgIds(operatorId);
    }

    const orgCondition = orgIds?.length ? inArray(organizations.id, orgIds) : undefined;
    const userCondition = orgIds?.length ? inArray(users.orgId, orgIds) : undefined;
    const projectCondition = orgIds?.length ? inArray(projects.orgId, orgIds) : undefined;

    const [orgCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(organizations)
      .where(orgCondition);

    const [opCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, UserRole.OPERATOR));

    const [userCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(userCondition);

    const [projectCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(projectCondition);

    return {
      totalOrganizations: Number(orgCount.count),
      totalOperators: Number(opCount.count),
      totalUsers: Number(userCount.count),
      totalProjects: Number(projectCount.count),
    };
  }
}
