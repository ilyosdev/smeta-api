import { IUser } from 'src/common/consts/auth';
import { UserRole } from 'src/common/database/schemas';
import { SessionData } from '../types/session';

export function sessionToUser(session: SessionData, telegramId: number): IUser {
  return {
    id: session.userId!,
    orgId: session.orgId!,
    role: session.role as UserRole,
    telegramId: String(telegramId),
    name: session.userName!,
  };
}

export function isAuthenticated(session?: SessionData): boolean {
  return !!(session && session.userId && session.orgId && session.role);
}
