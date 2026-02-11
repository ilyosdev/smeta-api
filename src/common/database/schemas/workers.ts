import { relations } from 'drizzle-orm';
import { boolean, double, mysqlTable, text, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { organizations } from './organizations';
import { projects } from './projects';
import { users } from './users';
import { smetaItems } from './smeta-items';

export const workers = mysqlTable('workers', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  orgId: varchar('org_id', { length: 36 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  userId: varchar('user_id', { length: 36 })
    .references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  specialty: varchar('specialty', { length: 255 }),
  totalEarned: double('total_earned').default(0).notNull(),
  totalPaid: double('total_paid').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .onUpdateNow()
    .notNull(),
});

export const workLogs = mysqlTable('work_logs', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  projectId: varchar('project_id', { length: 36 })
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  workerId: varchar('worker_id', { length: 36 }).references(() => workers.id),
  smetaItemId: varchar('smeta_item_id', { length: 36 }).references(() => smetaItems.id),
  workType: varchar('work_type', { length: 255 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  quantity: double('quantity').notNull(),
  unitPrice: double('unit_price'),
  totalAmount: double('total_amount'),
  date: timestamp('date').defaultNow().notNull(),
  loggedById: varchar('logged_by_id', { length: 36 })
    .references(() => users.id)
    .notNull(),
  isValidated: boolean('is_validated').default(false).notNull(),
  validatedById: varchar('validated_by_id', { length: 36 }).references(() => users.id),
  validatedAt: timestamp('validated_at'),
  isPaid: boolean('is_paid').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workerPayments = mysqlTable('worker_payments', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  workerId: varchar('worker_id', { length: 36 })
    .references(() => workers.id, { onDelete: 'cascade' })
    .notNull(),
  amount: double('amount').notNull(),
  note: text('note'),
  paidById: varchar('paid_by_id', { length: 36 })
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workersRelations = relations(workers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workers.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [workers.userId],
    references: [users.id],
  }),
  workLogs: many(workLogs),
  payments: many(workerPayments),
}));

export const workLogsRelations = relations(workLogs, ({ one }) => ({
  project: one(projects, {
    fields: [workLogs.projectId],
    references: [projects.id],
  }),
  worker: one(workers, {
    fields: [workLogs.workerId],
    references: [workers.id],
  }),
  smetaItem: one(smetaItems, {
    fields: [workLogs.smetaItemId],
    references: [smetaItems.id],
  }),
  loggedBy: one(users, {
    fields: [workLogs.loggedById],
    references: [users.id],
    relationName: 'loggedBy',
  }),
  validatedBy: one(users, {
    fields: [workLogs.validatedById],
    references: [users.id],
    relationName: 'validatedBy',
  }),
}));

export const workerPaymentsRelations = relations(workerPayments, ({ one }) => ({
  worker: one(workers, {
    fields: [workerPayments.workerId],
    references: [workers.id],
  }),
  paidBy: one(users, {
    fields: [workerPayments.paidById],
    references: [users.id],
  }),
}));

export type Worker = typeof workers.$inferSelect;
export type NewWorker = typeof workers.$inferInsert;
export type WorkLog = typeof workLogs.$inferSelect;
export type NewWorkLog = typeof workLogs.$inferInsert;
export type WorkerPayment = typeof workerPayments.$inferSelect;
export type NewWorkerPayment = typeof workerPayments.$inferInsert;
