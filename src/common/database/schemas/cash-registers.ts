import { relations } from 'drizzle-orm';
import { double, mysqlEnum, mysqlTable, text, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { users } from './users';
import { projects } from './projects';

export enum CashTransactionType {
  IN = 'IN',
  OUT = 'OUT',
}

export const cashRegisters = mysqlTable('cash_registers', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  userId: varchar('user_id', { length: 36 })
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  projectId: varchar('project_id', { length: 36 })
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).default('Asosiy kashlok').notNull(),
  balance: double('balance').default(0).notNull(),
  totalIn: double('total_in').default(0).notNull(),
  totalOut: double('total_out').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .onUpdateNow()
    .notNull(),
});

export const cashTransactions = mysqlTable('cash_transactions', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  cashRegisterId: varchar('cash_register_id', { length: 36 })
    .references(() => cashRegisters.id, { onDelete: 'cascade' })
    .notNull(),
  type: mysqlEnum('type', [CashTransactionType.IN, CashTransactionType.OUT]).notNull(),
  amount: double('amount').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cashRegistersRelations = relations(cashRegisters, ({ one, many }) => ({
  user: one(users, {
    fields: [cashRegisters.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [cashRegisters.projectId],
    references: [projects.id],
  }),
  transactions: many(cashTransactions),
}));

export const cashTransactionsRelations = relations(cashTransactions, ({ one }) => ({
  cashRegister: one(cashRegisters, {
    fields: [cashTransactions.cashRegisterId],
    references: [cashRegisters.id],
  }),
}));

export type CashRegister = typeof cashRegisters.$inferSelect;
export type NewCashRegister = typeof cashRegisters.$inferInsert;
export type CashTransaction = typeof cashTransactions.$inferSelect;
export type NewCashTransaction = typeof cashTransactions.$inferInsert;
