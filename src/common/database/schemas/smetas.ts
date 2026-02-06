import { relations } from 'drizzle-orm';
import { double, int, mysqlEnum, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { projects } from './projects';

export enum SmetaType {
  CONSTRUCTION = 'CONSTRUCTION',
  ELECTRICAL = 'ELECTRICAL',
  PLUMBING = 'PLUMBING',
  HVAC = 'HVAC',
  FINISHING = 'FINISHING',
  OTHER = 'OTHER',
}

export const smetas = mysqlTable('smetas', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  projectId: varchar('project_id', { length: 36 })
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  type: mysqlEnum('type', [
    SmetaType.CONSTRUCTION,
    SmetaType.ELECTRICAL,
    SmetaType.PLUMBING,
    SmetaType.HVAC,
    SmetaType.FINISHING,
    SmetaType.OTHER,
  ]).default(SmetaType.CONSTRUCTION).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  currentVersion: int('current_version').default(1).notNull(),
  totalWorkAmount: double('total_work_amount').default(0).notNull(),
  totalMachineAmount: double('total_machine_amount').default(0).notNull(),
  totalMaterialAmount: double('total_material_amount').default(0).notNull(),
  totalOtherAmount: double('total_other_amount').default(0).notNull(),
  grandTotal: double('grand_total').default(0).notNull(),
  overheadPercent: double('overhead_percent').default(17.27).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .onUpdateNow()
    .notNull(),
});

export const smetasRelations = relations(smetas, ({ one }) => ({
  project: one(projects, {
    fields: [smetas.projectId],
    references: [projects.id],
  }),
}));

export type Smeta = typeof smetas.$inferSelect;
export type NewSmeta = typeof smetas.$inferInsert;
