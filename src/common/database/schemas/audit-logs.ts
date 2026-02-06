import { relations } from 'drizzle-orm';
import { json, mysqlEnum, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { users } from './users';
import { DataSource } from './smeta-items';

export const auditLogs = mysqlTable('audit_logs', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: varchar('entity_id', { length: 100 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  oldValue: json('old_value'),
  newValue: json('new_value'),
  userId: varchar('user_id', { length: 36 })
    .references(() => users.id)
    .notNull(),
  source: mysqlEnum('source', [DataSource.DASHBOARD, DataSource.TELEGRAM]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
