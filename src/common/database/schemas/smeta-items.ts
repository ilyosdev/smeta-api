import { relations } from 'drizzle-orm';
import { double, mysqlEnum, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { smetas } from './smetas';
import { users } from './users';

export enum SmetaItemCategory {
  WORK = 'WORK',
  MACHINE = 'MACHINE',
  MATERIAL = 'MATERIAL',
  OTHER = 'OTHER',
}

export enum DataSource {
  DASHBOARD = 'DASHBOARD',
  TELEGRAM = 'TELEGRAM',
}

export const smetaItems = mysqlTable('smeta_items', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  smetaId: varchar('smeta_id', { length: 36 })
    .references(() => smetas.id, { onDelete: 'cascade' })
    .notNull(),
  itemType: mysqlEnum('item_type', [
    SmetaItemCategory.WORK,
    SmetaItemCategory.MACHINE,
    SmetaItemCategory.MATERIAL,
    SmetaItemCategory.OTHER,
  ]).default(SmetaItemCategory.MATERIAL).notNull(),
  category: varchar('category', { length: 255 }).notNull(),
  code: varchar('code', { length: 100 }),
  name: varchar('name', { length: 500 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  quantity: double('quantity').notNull(),
  unitPrice: double('unit_price').notNull(),
  totalAmount: double('total_amount').notNull(),
  usedQuantity: double('used_quantity').default(0).notNull(),
  usedAmount: double('used_amount').default(0).notNull(),
  percentRate: double('percent_rate'),
  machineType: varchar('machine_type', { length: 255 }),
  laborHours: double('labor_hours'),
  updatedBy: varchar('updated_by', { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  source: mysqlEnum('source', [DataSource.DASHBOARD, DataSource.TELEGRAM]).default(DataSource.DASHBOARD).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .onUpdateNow()
    .notNull(),
});

export const smetaItemsRelations = relations(smetaItems, ({ one }) => ({
  smeta: one(smetas, {
    fields: [smetaItems.smetaId],
    references: [smetas.id],
  }),
  updatedByUser: one(users, {
    fields: [smetaItems.updatedBy],
    references: [users.id],
  }),
}));

export type SmetaItem = typeof smetaItems.$inferSelect;
export type NewSmetaItem = typeof smetaItems.$inferInsert;
