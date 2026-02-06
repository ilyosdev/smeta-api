import { relations } from 'drizzle-orm';
import { int, mysqlTable, timestamp, unique, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { smetas } from './smetas';
import { users } from './users';

export const smetaVersions = mysqlTable(
  'smeta_versions',
  {
    id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    smetaId: varchar('smeta_id', { length: 36 })
      .references(() => smetas.id, { onDelete: 'cascade' })
      .notNull(),
    version: int('version').notNull(),
    fileUrl: varchar('file_url', { length: 500 }),
    changeNote: varchar('change_note', { length: 1000 }),
    createdById: varchar('created_by_id', { length: 36 })
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.smetaId, table.version)],
);

export const smetaVersionsRelations = relations(smetaVersions, ({ one }) => ({
  smeta: one(smetas, {
    fields: [smetaVersions.smetaId],
    references: [smetas.id],
  }),
  createdBy: one(users, {
    fields: [smetaVersions.createdById],
    references: [users.id],
  }),
}));

export type SmetaVersion = typeof smetaVersions.$inferSelect;
export type NewSmetaVersion = typeof smetaVersions.$inferInsert;
