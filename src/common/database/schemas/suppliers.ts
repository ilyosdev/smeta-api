import { relations } from 'drizzle-orm';
import { boolean, double, mysqlEnum, mysqlTable, text, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { organizations } from './organizations';
import { projects } from './projects';
import { users } from './users';
import { smetaItems } from './smeta-items';

export enum SupplyOrderStatus {
  ORDERED = 'ORDERED',
  DELIVERED = 'DELIVERED',
  PARTIAL = 'PARTIAL',
  CANCELLED = 'CANCELLED',
}

export const suppliers = mysqlTable('suppliers', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  orgId: varchar('org_id', { length: 36 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  address: varchar('address', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .onUpdateNow()
    .notNull(),
});

export const supplyOrders = mysqlTable('supply_orders', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  supplierId: varchar('supplier_id', { length: 36 })
    .references(() => suppliers.id, { onDelete: 'cascade' })
    .notNull(),
  projectId: varchar('project_id', { length: 36 })
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  status: mysqlEnum('status', [
    SupplyOrderStatus.ORDERED,
    SupplyOrderStatus.DELIVERED,
    SupplyOrderStatus.PARTIAL,
    SupplyOrderStatus.CANCELLED,
  ]).default(SupplyOrderStatus.ORDERED).notNull(),
  totalCost: double('total_cost').default(0).notNull(),
  note: text('note'),
  orderedById: varchar('ordered_by_id', { length: 36 })
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at'),
});

export const supplyOrderItems = mysqlTable('supply_order_items', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  orderId: varchar('order_id', { length: 36 })
    .references(() => supplyOrders.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  quantity: double('quantity').notNull(),
  unitPrice: double('unit_price').notNull(),
  totalCost: double('total_cost').notNull(),
  smetaItemId: varchar('smeta_item_id', { length: 36 }).references(() => smetaItems.id),
});

export const supplierDebts = mysqlTable('supplier_debts', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  supplierId: varchar('supplier_id', { length: 36 })
    .references(() => suppliers.id, { onDelete: 'cascade' })
    .notNull(),
  amount: double('amount').notNull(),
  reason: text('reason'),
  orderId: varchar('order_id', { length: 36 }).references(() => supplyOrders.id, { onDelete: 'set null' }),
  isPaid: boolean('is_paid').default(false).notNull(),
  paidAt: timestamp('paid_at'),
  paidById: varchar('paid_by_id', { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [suppliers.orgId],
    references: [organizations.id],
  }),
  orders: many(supplyOrders),
  debts: many(supplierDebts),
}));

export const supplyOrdersRelations = relations(supplyOrders, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [supplyOrders.supplierId],
    references: [suppliers.id],
  }),
  project: one(projects, {
    fields: [supplyOrders.projectId],
    references: [projects.id],
  }),
  orderedBy: one(users, {
    fields: [supplyOrders.orderedById],
    references: [users.id],
  }),
  items: many(supplyOrderItems),
}));

export const supplyOrderItemsRelations = relations(supplyOrderItems, ({ one }) => ({
  order: one(supplyOrders, {
    fields: [supplyOrderItems.orderId],
    references: [supplyOrders.id],
  }),
  smetaItem: one(smetaItems, {
    fields: [supplyOrderItems.smetaItemId],
    references: [smetaItems.id],
  }),
}));

export const supplierDebtsRelations = relations(supplierDebts, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierDebts.supplierId],
    references: [suppliers.id],
  }),
  order: one(supplyOrders, {
    fields: [supplierDebts.orderId],
    references: [supplyOrders.id],
  }),
  paidBy: one(users, {
    fields: [supplierDebts.paidById],
    references: [users.id],
  }),
}));

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type SupplyOrder = typeof supplyOrders.$inferSelect;
export type NewSupplyOrder = typeof supplyOrders.$inferInsert;
export type SupplyOrderItem = typeof supplyOrderItems.$inferSelect;
export type NewSupplyOrderItem = typeof supplyOrderItems.$inferInsert;
export type SupplierDebt = typeof supplierDebts.$inferSelect;
export type NewSupplierDebt = typeof supplierDebts.$inferInsert;
