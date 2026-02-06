import { relations } from 'drizzle-orm';
import { boolean, double, mysqlEnum, mysqlTable, text, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { projects } from './projects';
import { users } from './users';
import { smetaItems } from './smeta-items';
import { PaymentType } from './incomes';

export enum ExpenseCategory {
  MATERIAL = 'MATERIAL',
  LABOR = 'LABOR',
  EQUIPMENT = 'EQUIPMENT',
  TRANSPORT = 'TRANSPORT',
  OTHER = 'OTHER',
}

export enum ExpenseSourceType {
  CASH_REGISTER = 'CASH_REGISTER',
  ACCOUNT = 'ACCOUNT',
}

export const expenses = mysqlTable('expenses', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  projectId: varchar('project_id', { length: 36 })
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  amount: double('amount').notNull(),
  recipient: varchar('recipient', { length: 255 }).notNull(),
  paymentType: mysqlEnum('payment_type', [PaymentType.CASH, PaymentType.TRANSFER]).notNull(),
  category: mysqlEnum('category', [
    ExpenseCategory.MATERIAL,
    ExpenseCategory.LABOR,
    ExpenseCategory.EQUIPMENT,
    ExpenseCategory.TRANSPORT,
    ExpenseCategory.OTHER,
  ]).notNull(),
  sourceType: mysqlEnum('source_type', [ExpenseSourceType.CASH_REGISTER, ExpenseSourceType.ACCOUNT]),
  /**
   * Polymorphic foreign key - references different tables based on sourceType:
   * - When sourceType = 'CASH_REGISTER': references cash_registers.id
   * - When sourceType = 'ACCOUNT': references accounts.id
   *
   * Note: Drizzle/SQL cannot enforce polymorphic FKs at the database level.
   * Referential integrity must be enforced at the application layer.
   */
  sourceId: varchar('source_id', { length: 36 }),
  isPaid: boolean('is_paid').default(true).notNull(),
  paidAt: timestamp('paid_at'),
  note: text('note'),
  smetaItemId: varchar('smeta_item_id', { length: 36 }).references(() => smetaItems.id),
  recordedById: varchar('recorded_by_id', { length: 36 })
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const expensesRelations = relations(expenses, ({ one }) => ({
  project: one(projects, {
    fields: [expenses.projectId],
    references: [projects.id],
  }),
  smetaItem: one(smetaItems, {
    fields: [expenses.smetaItemId],
    references: [smetaItems.id],
  }),
  recordedBy: one(users, {
    fields: [expenses.recordedById],
    references: [users.id],
  }),
}));

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
