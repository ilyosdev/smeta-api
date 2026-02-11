import { relations } from 'drizzle-orm';
import { double, mysqlEnum, mysqlTable, text, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { users } from './users';
import { projects } from './projects';
import { RequestStatus } from './purchase-requests';
import { DataSource } from './smeta-items';

export const cashRequests = mysqlTable('cash_requests', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  projectId: varchar('project_id', { length: 36 })
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  requestedById: varchar('requested_by_id', { length: 36 })
    .references(() => users.id)
    .notNull(),
  amount: double('amount').notNull(),
  reason: text('reason'),
  neededBy: timestamp('needed_by'),
  status: mysqlEnum('status', [
    RequestStatus.PENDING,
    RequestStatus.APPROVED,
    RequestStatus.REJECTED,
    RequestStatus.FULFILLED,
  ]).default(RequestStatus.PENDING).notNull(),
  approvedById: varchar('approved_by_id', { length: 36 }).references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectionReason: varchar('rejection_reason', { length: 1000 }),
  source: mysqlEnum('source', [DataSource.DASHBOARD, DataSource.TELEGRAM]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .onUpdateNow()
    .notNull(),
});

export const cashRequestsRelations = relations(cashRequests, ({ one }) => ({
  project: one(projects, {
    fields: [cashRequests.projectId],
    references: [projects.id],
  }),
  requestedBy: one(users, {
    fields: [cashRequests.requestedById],
    references: [users.id],
    relationName: 'cashRequestedBy',
  }),
  approvedBy: one(users, {
    fields: [cashRequests.approvedById],
    references: [users.id],
    relationName: 'cashApprovedBy',
  }),
}));

export type CashRequest = typeof cashRequests.$inferSelect;
export type NewCashRequest = typeof cashRequests.$inferInsert;
