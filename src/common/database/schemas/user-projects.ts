import { relations } from 'drizzle-orm';
import { mysqlTable, timestamp, varchar, uniqueIndex } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { users } from './users';
import { projects } from './projects';

export const userProjects = mysqlTable(
  'user_projects',
  {
    id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    userId: varchar('user_id', { length: 36 })
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    projectId: varchar('project_id', { length: 36 })
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_project_unique').on(table.userId, table.projectId),
  ],
);

export const userProjectsRelations = relations(userProjects, ({ one }) => ({
  user: one(users, {
    fields: [userProjects.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [userProjects.projectId],
    references: [projects.id],
  }),
}));

export type UserProject = typeof userProjects.$inferSelect;
export type NewUserProject = typeof userProjects.$inferInsert;
