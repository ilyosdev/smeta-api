import { relations } from 'drizzle-orm';
import { boolean, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';

export const organizations = mysqlTable('organizations', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .onUpdateNow()
    .notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
