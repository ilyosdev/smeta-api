import { relations } from 'drizzle-orm';
import { double, mysqlEnum, mysqlTable, text, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { projects } from './projects';
import { users } from './users';

export enum PaymentType {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
}

export enum IncomeTargetType {
  CASH_REGISTER = 'CASH_REGISTER',
  ACCOUNT = 'ACCOUNT',
}

export const incomes = mysqlTable('incomes', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  projectId: varchar('project_id', { length: 36 })
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  amount: double('amount').notNull(),
  source: varchar('source', { length: 255 }).notNull(),
  paymentType: mysqlEnum('payment_type', [PaymentType.CASH, PaymentType.TRANSFER]).notNull(),
  targetType: mysqlEnum('target_type', [IncomeTargetType.CASH_REGISTER, IncomeTargetType.ACCOUNT]),
  /**
   * Polymorphic foreign key - references different tables based on targetType:
   * - When targetType = 'CASH_REGISTER': references cash_registers.id
   * - When targetType = 'ACCOUNT': references accounts.id
   *
   * Note: Drizzle/SQL cannot enforce polymorphic FKs at the database level.
   * Referential integrity must be enforced at the application layer.
   */
  targetId: varchar('target_id', { length: 36 }),
  note: text('note'),
  recordedById: varchar('recorded_by_id', { length: 36 })
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const incomesRelations = relations(incomes, ({ one }) => ({
  project: one(projects, {
    fields: [incomes.projectId],
    references: [projects.id],
  }),
  recordedBy: one(users, {
    fields: [incomes.recordedById],
    references: [users.id],
  }),
}));

export type Income = typeof incomes.$inferSelect;
export type NewIncome = typeof incomes.$inferInsert;
