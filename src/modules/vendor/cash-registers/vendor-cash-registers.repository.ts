import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import {
  CashRegister,
  CashTransaction,
  NewCashRegister,
  NewCashTransaction,
  cashRegisters,
  cashTransactions,
  users,
} from 'src/common/database/schemas';

export type CashRegisterWithRelations = CashRegister & {
  user?: { id: string; name: string };
};

@Injectable()
export class VendorCashRegistersRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async createCashRegister(data: NewCashRegister): Promise<CashRegister> {
    const id = randomUUID();
    await this.db.insert(cashRegisters).values({ ...data, id });
    const [result] = await this.db.select().from(cashRegisters).where(eq(cashRegisters.id, id));
    return result;
  }

  async findAllCashRegisters(
    orgId: string,
    params: { page: number; limit: number },
  ): Promise<{ data: CashRegisterWithRelations[]; total: number }> {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(cashRegisters)
      .innerJoin(users, eq(cashRegisters.userId, users.id))
      .where(eq(users.orgId, orgId));

    const results = await this.db
      .select({
        cashRegister: cashRegisters,
        user: { id: users.id, name: users.name },
      })
      .from(cashRegisters)
      .innerJoin(users, eq(cashRegisters.userId, users.id))
      .where(eq(users.orgId, orgId))
      .orderBy(desc(cashRegisters.createdAt))
      .limit(limit)
      .offset(offset);

    const data: CashRegisterWithRelations[] = results.map((r) => ({
      ...r.cashRegister,
      user: r.user,
    }));

    return { data, total: Number(countResult.count) };
  }

  async findCashRegisterById(id: string, orgId: string): Promise<CashRegisterWithRelations | null> {
    const results = await this.db
      .select({
        cashRegister: cashRegisters,
        user: { id: users.id, name: users.name },
      })
      .from(cashRegisters)
      .innerJoin(users, eq(cashRegisters.userId, users.id))
      .where(and(eq(cashRegisters.id, id), eq(users.orgId, orgId)));

    if (results.length === 0) return null;

    const r = results[0];
    return { ...r.cashRegister, user: r.user };
  }

  async updateCashRegister(id: string, data: Partial<NewCashRegister>): Promise<CashRegister> {
    await this.db.update(cashRegisters).set(data).where(eq(cashRegisters.id, id));
    const [result] = await this.db.select().from(cashRegisters).where(eq(cashRegisters.id, id));
    return result;
  }

  async deleteCashRegister(id: string): Promise<void> {
    await this.db.delete(cashRegisters).where(eq(cashRegisters.id, id));
  }

  async createCashTransaction(data: NewCashTransaction): Promise<CashTransaction> {
    const id = randomUUID();
    await this.db.insert(cashTransactions).values({ ...data, id });
    const [result] = await this.db.select().from(cashTransactions).where(eq(cashTransactions.id, id));
    return result;
  }

  async findCashTransactions(
    cashRegisterId: string,
    params: { page: number; limit: number },
  ): Promise<{ data: CashTransaction[]; total: number }> {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(cashTransactions)
      .where(eq(cashTransactions.cashRegisterId, cashRegisterId));

    const data = await this.db
      .select()
      .from(cashTransactions)
      .where(eq(cashTransactions.cashRegisterId, cashRegisterId))
      .orderBy(desc(cashTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, total: Number(countResult.count) };
  }

  async getCashRegisterOrgId(cashRegisterId: string): Promise<string | null> {
    const results = await this.db
      .select({ orgId: users.orgId })
      .from(cashRegisters)
      .innerJoin(users, eq(cashRegisters.userId, users.id))
      .where(eq(cashRegisters.id, cashRegisterId));
    return results.length > 0 ? results[0].orgId : null;
  }

  async getUserOrgId(userId: string): Promise<string | null> {
    const [result] = await this.db.select({ orgId: users.orgId }).from(users).where(eq(users.id, userId));
    return result?.orgId ?? null;
  }
}
