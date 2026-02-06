import { relations } from 'drizzle-orm';
import { double, mysqlEnum, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { smetaItems } from './smeta-items';
import { users } from './users';
import { DataSource } from './smeta-items';

export const manualPurchases = mysqlTable('manual_purchases', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  smetaItemId: varchar('smeta_item_id', { length: 36 })
    .references(() => smetaItems.id, { onDelete: 'cascade' })
    .notNull(),
  quantity: double('quantity').notNull(),
  amount: double('amount').notNull(),
  receiptUrl: varchar('receipt_url', { length: 500 }),
  note: varchar('note', { length: 1000 }),
  submittedById: varchar('submitted_by_id', { length: 36 })
    .references(() => users.id)
    .notNull(),
  source: mysqlEnum('source', [DataSource.DASHBOARD, DataSource.TELEGRAM]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const manualPurchasesRelations = relations(manualPurchases, ({ one }) => ({
  smetaItem: one(smetaItems, {
    fields: [manualPurchases.smetaItemId],
    references: [smetaItems.id],
  }),
  submittedBy: one(users, {
    fields: [manualPurchases.submittedById],
    references: [users.id],
  }),
}));

export type ManualPurchase = typeof manualPurchases.$inferSelect;
export type NewManualPurchase = typeof manualPurchases.$inferInsert;
