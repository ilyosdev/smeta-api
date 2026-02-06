import { relations } from 'drizzle-orm';
import { boolean, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { projects } from './projects';

export const telegramGroups = mysqlTable('telegram_groups', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  projectId: varchar('project_id', { length: 36 })
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  chatId: varchar('chat_id', { length: 100 }).unique().notNull(),
  title: varchar('title', { length: 255 }),
  isActive: boolean('is_active').default(true).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const telegramGroupsRelations = relations(telegramGroups, ({ one }) => ({
  project: one(projects, {
    fields: [telegramGroups.projectId],
    references: [projects.id],
  }),
}));

export type TelegramGroup = typeof telegramGroups.$inferSelect;
export type NewTelegramGroup = typeof telegramGroups.$inferInsert;
