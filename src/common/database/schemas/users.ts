import { relations } from 'drizzle-orm';
import { boolean, mysqlEnum, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import { organizations } from './organizations';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  OPERATOR = 'OPERATOR',
  BOSS = 'BOSS',
  DIREKTOR = 'DIREKTOR',
  BUGALTERIYA = 'BUGALTERIYA',
  PTO = 'PTO',
  SNABJENIYA = 'SNABJENIYA',
  SKLAD = 'SKLAD',
  PRORAB = 'PRORAB',
  HAYDOVCHI = 'HAYDOVCHI',
  MODERATOR = 'MODERATOR',
  WORKER = 'WORKER',
  POSTAVSHIK = 'POSTAVSHIK',
}

export const userRoleEnum = mysqlEnum('role', [
  UserRole.SUPER_ADMIN,
  UserRole.OPERATOR,
  UserRole.BOSS,
  UserRole.DIREKTOR,
  UserRole.BUGALTERIYA,
  UserRole.PTO,
  UserRole.SNABJENIYA,
  UserRole.SKLAD,
  UserRole.PRORAB,
  UserRole.HAYDOVCHI,
  UserRole.MODERATOR,
  UserRole.WORKER,
  UserRole.POSTAVSHIK,
]);

export const users = mysqlTable('users', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  orgId: varchar('org_id', { length: 36 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  telegramId: varchar('telegram_id', { length: 100 }).unique(),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }).unique(),
  password: varchar('password', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  role: mysqlEnum('role', [
    UserRole.SUPER_ADMIN,
    UserRole.OPERATOR,
    UserRole.BOSS,
    UserRole.DIREKTOR,
    UserRole.BUGALTERIYA,
    UserRole.PTO,
    UserRole.SNABJENIYA,
    UserRole.SKLAD,
    UserRole.PRORAB,
    UserRole.HAYDOVCHI,
    UserRole.MODERATOR,
    UserRole.WORKER,
    UserRole.POSTAVSHIK,
  ]).default(UserRole.PRORAB).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .onUpdateNow()
    .notNull(),
});

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
