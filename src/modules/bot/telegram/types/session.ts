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
  /** Driver: pending batch first request ID for collect batch conversation */
  pendingCollectBatchId?: string;
  /** Driver: pending batch first request ID for deliver batch conversation */
  pendingDeliverBatchId?: string;
  /** Supply: pending request ID for approve conversation */
  pendingApproveRequestId?: string;
  /** Warehouse: pending request ID for receive conversation */
  pendingReceiveRequestId?: string;
  /** Moderator: pending request ID for finalize conversation */
  pendingFinalizeRequestId?: string;
  /** Supply: current index for one-by-one request navigation */
  supplyRequestIndex?: number;
  /** Supply: cached pending request IDs for navigation */
  supplyPendingRequestIds?: string[];
  /** Supply: pending request ID for edit quantity conversation */
  pendingEditRequestId?: string;
  /** Supply: pending request ID for reject conversation */
  pendingRejectRequestId?: string;
  /** Supply: pending batch request IDs for batch approve */
  pendingApproveBatchIds?: string;
  /** Supply: pending batch request IDs for batch reject */
  pendingRejectBatchIds?: string;

  // === Driver carousel ===
  /** Driver: current index for assigned requests navigation */
  driverAssignedIndex?: number;
  /** Driver: cached assigned request IDs for navigation */
  driverAssignedIds?: string[];
  /** Driver: current index for active deliveries navigation */
  driverActiveIndex?: number;
  /** Driver: cached active delivery IDs for navigation */
  driverActiveIds?: string[];
  /** Driver: current index for delivery history navigation */
  driverHistoryIndex?: number;
  /** Driver: cached delivery history IDs for navigation */
  driverHistoryIds?: string[];

  // === Warehouse carousel ===
  /** Warehouse: current index for pending deliveries navigation */
  whPendingIndex?: number;
  /** Warehouse: cached pending delivery IDs for navigation */
  whPendingIds?: string[];
  /** Warehouse: current index for inventory navigation */
  whInventoryIndex?: number;
  /** Warehouse: cached inventory item IDs for navigation */
  whInventoryIds?: string[];

  // === Supply carousel (orders/payments) ===
  /** Supply: current index for orders navigation */
  supplyOrderIndex?: number;
  /** Supply: cached order IDs for navigation */
  supplyOrderIds?: string[];
  /** Supply: current index for payments navigation */
  supplyPaymentIndex?: number;
  /** Supply: cached payment IDs for navigation */
  supplyPaymentIds?: string[];

  // === Foreman carousel ===
  /** Foreman: current index for request history navigation */
  foremanReqHistIndex?: number;
  /** Foreman: cached request history IDs for navigation */
  foremanReqHistIds?: string[];

  // === Boss carousel ===
  /** Boss: current index for debts navigation */
  bossDebtsIndex?: number;
  /** Boss: cached debt IDs for navigation */
  bossDebtIds?: string[];
  /** Boss: current index for pending navigation */
  bossPendingIndex?: number;
  /** Boss: cached pending item IDs for navigation */
  bossPendingIds?: string[];
  /** Boss: pending item type (request/cash/expense) */
  bossPendingType?: string;
}
