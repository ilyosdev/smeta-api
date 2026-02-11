import { UserRole } from 'src/common/database/schemas';

export interface SessionData {
  userId?: string;
  orgId?: string;
  role?: UserRole;
  userName?: string;
  phone?: string;
  selectedProjectId?: string;
  selectedProjectName?: string;
  ptoPendingApproveId?: string;
  dirPendingApproveId?: string;
  /** Tester has explicitly confirmed their role */
  testerRoleConfirmed?: boolean;
}
