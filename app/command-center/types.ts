export type CommandCenterSeverity = 'critical' | 'high' | 'medium' | 'low';

export type CommandCenterSourceModule =
  | 'shortages'
  | 'lost_sales'
  | 'cash_tracker'
  | 'cash_flow'
  | 'hr'
  | 'quality_feedback'
  | 'spin_win'
  | 'delivery_coverage';

export type OperationalAlertStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';
export type ActionQueueStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';
export type BranchHealthStatus = 'healthy' | 'watch' | 'risk' | 'critical' | 'insufficient_data';

export interface OperationalAlert {
  id: string;
  sourceModule: CommandCenterSourceModule;
  type: string;
  severity: CommandCenterSeverity;
  branchId?: string;
  branchName?: string;
  title: string;
  message: string;
  recommendedAction: string;
  ownerRole?: string;
  status: OperationalAlertStatus;
  createdAt: string;
  dueAt?: string;
  relatedRecordId?: string;
  relatedRecordType?: string;
}

export interface TodayRisk {
  id: string;
  riskType: string;
  branchId?: string;
  branchName?: string;
  severity: CommandCenterSeverity;
  title?: string;
  message: string;
  recommendedAction: string;
  owner?: string;
  ownerRole?: string;
  status?: OperationalAlertStatus;
  sourceModule: CommandCenterSourceModule;
  createdAt?: string;
  dueAt?: string;
  relatedRecordId?: string;
  relatedRecordType?: string;
}

export interface ActionQueueItem {
  id: string;
  taskId?: string;
  title: string;
  branchId?: string;
  branchName?: string;
  severity: CommandCenterSeverity;
  priority: CommandCenterSeverity;
  recommendedAction: string;
  nextStep: string;
  owner?: string;
  ownerRole?: string;
  status: ActionQueueStatus;
  sourceModule: CommandCenterSourceModule;
  createdAt?: string;
  dueAt?: string;
  relatedAlertId?: string;
  relatedRecordId?: string;
  relatedRecordType?: string;
  queueSource?: 'saved_task' | 'suggested_action';
}

export interface BranchHealthScore {
  branchId: string;
  branchName: string;
  score: number;
  status: BranchHealthStatus;
  severity: CommandCenterSeverity;
  riskCount: number;
  pendingCount: number;
  signals: string[];
  topReasons: string[];
  hasSufficientData: boolean;
}

export interface PendingItem {
  id: string;
  label: string;
  count: number;
  sourceModule: CommandCenterSourceModule;
  severity: CommandCenterSeverity;
}

export interface CommandCenterDigestItem {
  name: string;
  count: number;
  value?: number;
  status?: string;
}

export interface YesterdayBranchDigest {
  date: string;
  dateLabel: string;
  scope: 'branch' | 'all_visible';
  branchId?: string | null;
  branchName: string;
  lostSalesCount: number;
  lostSalesUnits: number;
  lostSalesValue: number;
  shortageCount: number;
  criticalShortageCount: number;
  outOfStockCount: number;
  topLostItems: CommandCenterDigestItem[];
  topShortageItems: CommandCenterDigestItem[];
}

export interface OperationsTask {
  id: string;
  sourceModule: CommandCenterSourceModule;
  title: string;
  description?: string | null;
  severity: CommandCenterSeverity;
  priority: CommandCenterSeverity;
  status: ActionQueueStatus;
  branchId?: string | null;
  branchName?: string | null;
  ownerRole?: string | null;
  assignedTo?: string | null;
  recommendedAction?: string | null;
  nextStep?: string | null;
  relatedRecordId?: string | null;
  relatedRecordType?: string | null;
  createdBy?: string | null;
  resolvedBy?: string | null;
  dueAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperationsTaskEvent {
  id: string;
  taskId: string;
  eventType: string;
  oldStatus?: ActionQueueStatus | null;
  newStatus?: ActionQueueStatus | null;
  comment?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface CreateOperationsTaskInput {
  sourceModule: CommandCenterSourceModule;
  title: string;
  description?: string | null;
  severity: CommandCenterSeverity;
  priority: CommandCenterSeverity;
  branchId?: string | null;
  branchName?: string | null;
  ownerRole?: string | null;
  assignedTo?: string | null;
  recommendedAction?: string | null;
  nextStep?: string | null;
  relatedRecordId?: string | null;
  relatedRecordType?: string | null;
  dueAt?: string | null;
}

export interface UpdateOperationsTaskStatusInput {
  taskId: string;
  status: ActionQueueStatus;
  comment?: string;
}

export interface AddOperationsTaskCommentInput {
  taskId: string;
  comment: string;
}

export interface CommandCenterSummary {
  generatedAt: string;
  alerts: OperationalAlert[];
  operationsTasks: OperationsTask[];
  yesterdayDigest: YesterdayBranchDigest | null;
  todaysRisks: TodayRisk[];
  actionQueue: ActionQueueItem[];
  branchHealth: BranchHealthScore[];
  pendingItems: PendingItem[];
  dataWarnings: string[];
}
