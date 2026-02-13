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
  /** Driver: pending request ID for collect conversation */
  pendingCollectRequestId?: string;
  /** Driver: pending request ID for deliver conversation */
  pendingDeliverRequestId?: string;
  /** Supply: pending request ID for approve conversation */
  pendingApproveRequestId?: string;
  /** Warehouse: pending request ID for receive conversation */
  pendingReceiveRequestId?: string;
  /** Moderator: pending request ID for finalize conversation */
  pendingFinalizeRequestId?: string;
}
