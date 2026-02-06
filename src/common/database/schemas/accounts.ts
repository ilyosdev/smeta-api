import { relations } from 'drizzle-orm';
import { double, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { organizations } from './organizations';

export const accounts = mysqlTable('accounts', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  orgId: varchar('org_id', { length: 36 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  balance: double('balance').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .onUpdateNow()
    .notNull(),
});

export const accountsRelations = relations(accounts, ({ one }) => ({
  organization: one(organizations, {
    fields: [accounts.orgId],
    references: [organizations.id],
  }),
}));

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
