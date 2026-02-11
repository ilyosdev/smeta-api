import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
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
} from 'src/common/database/schemas';

@Injectable()
export class BotAdminRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async findAllOperators(
    page: number,
    limit: number,
  ): Promise<{ data: (User & { orgName: string })[]; total: number }> {
    const offset = (page - 1) * limit;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, UserRole.OPERATOR));

    const rows = await this.db
      .select({
        user: users,
        orgName: organizations.name,
      })
      .from(users)
      .leftJoin(organizations, eq(users.orgId, organizations.id))
      .where(eq(users.role, UserRole.OPERATOR))
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const data = rows.map((r) => ({
      ...r.user,
      orgName: r.orgName ?? 'N/A',
    }));

    return { data, total: Number(countResult.count) };
  }

  async findAllOrganizations(
    page: number,
    limit: number,
  ): Promise<{ data: (Organization & { userCount: number; projectCount: number })[]; total: number }> {
    const offset = (page - 1) * limit;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(organizations);

    const rows = await this.db
      .select({
        org: organizations,
        userCount: sql<number>`(SELECT COUNT(*) FROM users WHERE users.org_id = organizations.id)`,
        projectCount: sql<number>`(SELECT COUNT(*) FROM projects WHERE projects.org_id = organizations.id)`,
      })
      .from(organizations)
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

  async findOrganizationById(orgId: string): Promise<Organization | null> {
    const result = await this.db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });
    return result ?? null;
  }

  async createOrganization(name: string, phone?: string): Promise<Organization> {
    const id = randomUUID();
    await this.db.insert(organizations).values({ id, name, phone: phone || null });
    const [result] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id));
    return result;
  }

  async createUser(data: NewUser): Promise<User> {
    const id = randomUUID();
    await this.db.insert(users).values({ ...data, id });
    const [result] = await this.db.select().from(users).where(eq(users.id, id));
    return result;
  }

  async assignUserToProject(userId: string, projectId: string): Promise<void> {
    const existing = await this.db.query.userProjects.findFirst({
      where: and(
        eq(userProjects.userId, userId),
        eq(userProjects.projectId, projectId),
      ),
    });
    if (existing) return;

    const id = randomUUID();
    await this.db.insert(userProjects).values({ id, userId, projectId });
  }

  async getUserProjectAssignments(
    userId: string,
  ): Promise<{ projectId: string; projectName: string }[]> {
    const rows = await this.db
      .select({
        projectId: userProjects.projectId,
        projectName: projects.name,
      })
      .from(userProjects)
      .innerJoin(projects, eq(userProjects.projectId, projects.id))
      .where(eq(userProjects.userId, userId));

    return rows;
  }

  async createProject(
    orgId: string,
    data: { name: string; address?: string; floors?: number; budget?: number },
  ): Promise<Project> {
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

  async findAllUsers(
    orgId: string,
    page: number,
    limit: number,
  ): Promise<{ data: User[]; total: number }> {
    const offset = (page - 1) * limit;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.orgId, orgId));

    const data = await this.db.query.users.findMany({
      where: eq(users.orgId, orgId),
      limit,
      offset,
      orderBy: [desc(users.createdAt)],
    });

    return { data, total: Number(countResult.count) };
  }

  async findAllProjects(
    orgId: string,
    page: number,
    limit: number,
  ): Promise<{ data: Project[]; total: number }> {
    const offset = (page - 1) * limit;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.orgId, orgId));

    const data = await this.db.query.projects.findMany({
      where: eq(projects.orgId, orgId),
      limit,
      offset,
      orderBy: [desc(projects.createdAt)],
    });

    return { data, total: Number(countResult.count) };
  }
}
