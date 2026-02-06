import { relations } from 'drizzle-orm';
import { double, int, mysqlEnum, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { organizations } from './organizations';

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
}

export const projects = mysqlTable('projects', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  orgId: varchar('org_id', { length: 36 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 1000 }),
  budget: double('budget'),
  status: mysqlEnum('status', [
    ProjectStatus.PLANNING,
    ProjectStatus.ACTIVE,
    ProjectStatus.ON_HOLD,
    ProjectStatus.COMPLETED,
  ]).default(ProjectStatus.PLANNING).notNull(),
  address: varchar('address', { length: 500 }),
  floors: int('floors'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .onUpdateNow()
    .notNull(),
});

export const projectsRelations = relations(projects, ({ one }) => ({
  organization: one(organizations, {
    fields: [projects.orgId],
    references: [organizations.id],
  }),
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
