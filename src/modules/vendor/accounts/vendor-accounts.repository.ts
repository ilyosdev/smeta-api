import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, like, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import { Account, NewAccount, accounts } from 'src/common/database/schemas';

@Injectable()
export class VendorAccountsRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async createAccount(data: NewAccount): Promise<Account> {
    const id = randomUUID();
    await this.db.insert(accounts).values({ ...data, id });
    const [result] = await this.db.select().from(accounts).where(eq(accounts.id, id));
    return result;
  }

  async findAllAccounts(
    orgId: string,
    params: { page: number; limit: number; search?: string },
  ): Promise<{ data: Account[]; total: number }> {
    const { page, limit, search } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [eq(accounts.orgId, orgId)];
    if (search) {
      conditions.push(like(accounts.name, `%${search}%`));
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(accounts)
      .where(and(...conditions));

    const data = await this.db
      .select()
      .from(accounts)
      .where(and(...conditions))
      .orderBy(desc(accounts.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, total: Number(countResult.count) };
  }

  async findAccountById(id: string, orgId: string): Promise<Account | null> {
    const [result] = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.orgId, orgId)));
    return result ?? null;
  }

  async updateAccount(id: string, data: Partial<NewAccount>): Promise<Account> {
    await this.db.update(accounts).set(data).where(eq(accounts.id, id));
    const [result] = await this.db.select().from(accounts).where(eq(accounts.id, id));
    return result;
  }

  async deleteAccount(id: string): Promise<void> {
    await this.db.delete(accounts).where(eq(accounts.id, id));
  }
}
