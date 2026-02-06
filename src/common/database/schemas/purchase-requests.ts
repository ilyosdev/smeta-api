import { relations } from 'drizzle-orm';
import { boolean, double, mysqlEnum, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { smetaItems } from './smeta-items';
import { users } from './users';
import { DataSource } from './smeta-items';

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export const purchaseRequests = mysqlTable('purchase_requests', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  smetaItemId: varchar('smeta_item_id', { length: 36 })
    .references(() => smetaItems.id, { onDelete: 'cascade' })
    .notNull(),
  requestedQty: double('requested_qty').notNull(),
  requestedAmount: double('requested_amount').notNull(),
  note: varchar('note', { length: 1000 }),
  status: mysqlEnum('status', [
    RequestStatus.PENDING,
    RequestStatus.APPROVED,
    RequestStatus.REJECTED,
  ]).default(RequestStatus.PENDING).notNull(),
  requestedById: varchar('requested_by_id', { length: 36 })
    .references(() => users.id)
    .notNull(),
  approvedById: varchar('approved_by_id', { length: 36 }).references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectionReason: varchar('rejection_reason', { length: 1000 }),
  source: mysqlEnum('source', [DataSource.DASHBOARD, DataSource.TELEGRAM]).notNull(),
  isOverrun: boolean('is_overrun').default(false).notNull(),
  overrunQty: double('overrun_qty'),
  overrunPercent: double('overrun_percent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .onUpdateNow()
    .notNull(),
});

export const purchaseRequestsRelations = relations(purchaseRequests, ({ one }) => ({
  smetaItem: one(smetaItems, {
    fields: [purchaseRequests.smetaItemId],
    references: [smetaItems.id],
  }),
  requestedBy: one(users, {
    fields: [purchaseRequests.requestedById],
    references: [users.id],
    relationName: 'requestedBy',
  }),
  approvedBy: one(users, {
    fields: [purchaseRequests.approvedById],
    references: [users.id],
    relationName: 'approvedBy',
  }),
}));

export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type NewPurchaseRequest = typeof purchaseRequests.$inferInsert;
