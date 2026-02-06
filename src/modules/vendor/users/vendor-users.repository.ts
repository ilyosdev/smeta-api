import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, like, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import { NewUser, User, UserRole, users } from 'src/common/database/schemas';

@Injectable()
export class VendorUsersRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async create(data: NewUser): Promise<User> {
    const id = randomUUID();
    await this.db.insert(users).values({ ...data, id });
    const [result] = await this.db.select().from(users).where(eq(users.id, id));
    return result;
  }

  async findAll(
    orgId: string,
    params: { page: number; limit: number; search?: string; role?: UserRole; isActive?: boolean },
  ): Promise<{ data: User[]; total: number }> {
    const { page, limit, search, role, isActive } = params;
    const offset = (page - 1) * limit;

    const conditions = [eq(users.orgId, orgId)];
    if (search) {
      conditions.push(like(users.name, `%${search}%`));
    }
    if (role) {
      conditions.push(eq(users.role, role));
    }
    if (isActive !== undefined) {
      conditions.push(eq(users.isActive, isActive));
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

  async findById(id: string, orgId: string): Promise<User | null> {
    const result = await this.db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.orgId, orgId)),
    });
    return result ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });
    return result ?? null;
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    const result = await this.db.query.users.findFirst({
      where: eq(users.telegramId, telegramId),
    });
    return result ?? null;
  }

  async update(id: string, orgId: string, data: Partial<NewUser>): Promise<User> {
    await this.db
      .update(users)
      .set(data)
      .where(and(eq(users.id, id), eq(users.orgId, orgId)));
    const [result] = await this.db.select().from(users).where(eq(users.id, id));
    return result;
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.delete(users).where(and(eq(users.id, id), eq(users.orgId, orgId)));
  }
}
