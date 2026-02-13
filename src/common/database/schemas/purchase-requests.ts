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
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  RECEIVED = 'RECEIVED',
  FULFILLED = 'FULFILLED',
}

export const purchaseRequests = mysqlTable('purchase_requests', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  // Batch ID to group requests created together by Prorab
  batchId: varchar('batch_id', { length: 36 }),
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
    RequestStatus.IN_TRANSIT,
    RequestStatus.DELIVERED,
    RequestStatus.RECEIVED,
    RequestStatus.FULFILLED,
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
  fulfilledQty: double('fulfilled_qty'),
  fulfilledAmount: double('fulfilled_amount'),
  supplierName: varchar('supplier_name', { length: 255 }),
  proofPhotoFileId: varchar('proof_photo_file_id', { length: 255 }),
  fulfilledById: varchar('fulfilled_by_id', { length: 36 }).references(() => users.id),
  fulfilledAt: timestamp('fulfilled_at'),
  // Driver assignment (set by SNABJENIYA when approving)
  assignedDriverId: varchar('assigned_driver_id', { length: 36 }).references(() => users.id),
  assignedAt: timestamp('assigned_at'),
  approvedQty: double('approved_qty'),
  approvedAmount: double('approved_amount'),
  // Driver collection (set by HAYDOVCHI)
  collectedQty: double('collected_qty'),
  collectedAt: timestamp('collected_at'),
  collectionNote: varchar('collection_note', { length: 1000 }),
  collectionPhotoFileId: varchar('collection_photo_file_id', { length: 255 }),
  // Driver delivery (set by HAYDOVCHI)
  deliveredQty: double('delivered_qty'),
  deliveredAt: timestamp('delivered_at'),
  deliveryNote: varchar('delivery_note', { length: 1000 }),
  deliveryPhotoFileId: varchar('delivery_photo_file_id', { length: 255 }),
  // Warehouse receipt (set by SKLAD)
  receivedQty: double('received_qty'),
  receivedById: varchar('received_by_id', { length: 36 }).references(() => users.id),
  receivedAt: timestamp('received_at'),
  receiptNote: varchar('receipt_note', { length: 1000 }),
  receiptPhotoFileId: varchar('receipt_photo_file_id', { length: 255 }),
  // Moderator finalization (set by MODERATOR - final price entry)
  finalAmount: double('final_amount'),
  finalUnitPrice: double('final_unit_price'),
  finalizedById: varchar('finalized_by_id', { length: 36 }).references(() => users.id),
  finalizedAt: timestamp('finalized_at'),
  finalizationNote: varchar('finalization_note', { length: 1000 }),
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
  fulfilledBy: one(users, {
    fields: [purchaseRequests.fulfilledById],
    references: [users.id],
    relationName: 'fulfilledBy',
  }),
  assignedDriver: one(users, {
    fields: [purchaseRequests.assignedDriverId],
    references: [users.id],
    relationName: 'assignedDriver',
  }),
  receivedBy: one(users, {
    fields: [purchaseRequests.receivedById],
    references: [users.id],
    relationName: 'receivedBy',
  }),
  finalizedBy: one(users, {
    fields: [purchaseRequests.finalizedById],
    references: [users.id],
    relationName: 'finalizedBy',
  }),
}));

export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type NewPurchaseRequest = typeof purchaseRequests.$inferInsert;
