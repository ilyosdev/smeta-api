import { relations } from 'drizzle-orm';
import { double, mysqlEnum, mysqlTable, timestamp, unique, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { projects } from './projects';
import { users } from './users';
import { smetaItems } from './smeta-items';

export enum WarehouseTransferStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const warehouses = mysqlTable('warehouses', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  projectId: varchar('project_id', { length: 36 })
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  location: varchar('location', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .onUpdateNow()
    .notNull(),
});

export const warehouseItems = mysqlTable(
  'warehouse_items',
  {
    id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    warehouseId: varchar('warehouse_id', { length: 36 })
      .references(() => warehouses.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    unit: varchar('unit', { length: 50 }).notNull(),
    quantity: double('quantity').notNull(),
    smetaItemId: varchar('smeta_item_id', { length: 36 }).references(() => smetaItems.id),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  (table) => [unique().on(table.warehouseId, table.name, table.unit)],
);

export const warehouseTransfers = mysqlTable('warehouse_transfers', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  fromWarehouseId: varchar('from_warehouse_id', { length: 36 })
    .references(() => warehouses.id)
    .notNull(),
  toWarehouseId: varchar('to_warehouse_id', { length: 36 })
    .references(() => warehouses.id)
    .notNull(),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  quantity: double('quantity').notNull(),
  status: mysqlEnum('status', [
    WarehouseTransferStatus.PENDING,
    WarehouseTransferStatus.COMPLETED,
    WarehouseTransferStatus.CANCELLED,
  ]).default(WarehouseTransferStatus.PENDING).notNull(),
  createdById: varchar('created_by_id', { length: 36 })
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  project: one(projects, {
    fields: [warehouses.projectId],
    references: [projects.id],
  }),
  items: many(warehouseItems),
  transfersFrom: many(warehouseTransfers, { relationName: 'fromWarehouse' }),
  transfersTo: many(warehouseTransfers, { relationName: 'toWarehouse' }),
}));

export const warehouseItemsRelations = relations(warehouseItems, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [warehouseItems.warehouseId],
    references: [warehouses.id],
  }),
  smetaItem: one(smetaItems, {
    fields: [warehouseItems.smetaItemId],
    references: [smetaItems.id],
  }),
}));

export const warehouseTransfersRelations = relations(warehouseTransfers, ({ one }) => ({
  fromWarehouse: one(warehouses, {
    fields: [warehouseTransfers.fromWarehouseId],
    references: [warehouses.id],
    relationName: 'fromWarehouse',
  }),
  toWarehouse: one(warehouses, {
    fields: [warehouseTransfers.toWarehouseId],
    references: [warehouses.id],
    relationName: 'toWarehouse',
  }),
  createdBy: one(users, {
    fields: [warehouseTransfers.createdById],
    references: [users.id],
  }),
}));

export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;
export type WarehouseItem = typeof warehouseItems.$inferSelect;
export type NewWarehouseItem = typeof warehouseItems.$inferInsert;
export type WarehouseTransfer = typeof warehouseTransfers.$inferSelect;
export type NewWarehouseTransfer = typeof warehouseTransfers.$inferInsert;
