import { UserRole } from 'src/common/database/schemas';

export const ROLES_KEY = 'roles';

export const Roles = UserRole;
export type Roles = UserRole;

export interface IUser {
  id: string;
  orgId: string;
  role: UserRole;
  telegramId?: string;
  name: string;
}
