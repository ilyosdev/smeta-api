import { relations } from 'drizzle-orm';
import { mysqlTable, timestamp, varchar, uniqueIndex } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { users } from './users';
import { organizations } from './organizations';

export const operatorOrganizations = mysqlTable(
  'operator_organizations',
  {
    id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    operatorId: varchar('operator_id', { length: 36 })
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    orgId: varchar('org_id', { length: 36 })
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('operator_org_unique').on(table.operatorId, table.orgId),
  ],
);

export const operatorOrganizationsRelations = relations(operatorOrganizations, ({ one }) => ({
  operator: one(users, {
    fields: [operatorOrganizations.operatorId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [operatorOrganizations.orgId],
    references: [organizations.id],
  }),
}));

export type OperatorOrganization = typeof operatorOrganizations.$inferSelect;
export type NewOperatorOrganization = typeof operatorOrganizations.$inferInsert;
