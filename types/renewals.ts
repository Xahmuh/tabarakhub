// ============================================================================
// OPERATIONAL RENEWALS & COMPLIANCE TYPES
// ============================================================================

export type OperationalRenewalType =
  | 'CR'
  | 'CHAMBER_OF_COMMERCE'
  | 'NHRA_PHARMACY'
  | 'NHRA_PHARMACIST'
  | 'NHRA'
  | 'WORK_PERMIT'
  | 'FLEET_VEHICLE'
  | 'OTHER';

export type OperationalEntityType = 'COMPANY' | 'BRANCH' | 'EMPLOYEE' | 'VEHICLE' | 'OTHER';

export type RenewalWorkflowStatus =
  | 'NOT_STARTED'
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'AWAITING_APPROVAL'
  | 'RENEWED'
  | 'CANCELLED';

export type AlertSeverity =
  | 'NORMAL'
  | 'UPCOMING'
  | 'WARNING'
  | 'URGENT'
  | 'CRITICAL'
  | 'EXPIRED';

export interface OperationalRenewalRecord {
  id: string;
  renewalType: OperationalRenewalType;
  entityType: OperationalEntityType;
  entityId?: string;
  entityName: string;
  documentType: string;
  documentNumber: string;
  branchId?: string;
  branchName?: string;
  issueDate?: string;
  expiryDate: string;
  renewalStatus: RenewalWorkflowStatus;
  priority?: AlertSeverity;
  responsibleUserId?: string;
  responsibleUserName?: string;
  notes?: string;
  isActive: boolean;
  metadata?: Record<string, any>;
  attachmentsCount?: number;
  historyCount?: number;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  costCenterCode?: string;
  costCenterName?: string;
  estimatedCost?: number;
  actualCost?: number;
  currency?: string;
  paymentStatus?: 'UNPAID' | 'SCHEDULED' | 'PAID' | 'WAIVED';
  plannedPaymentDate?: string;
  paidAt?: string;
  paymentMethod?: 'BENEFIT_PAY' | 'SADAD_GOV' | 'CREDIT_CARD' | 'BANK_TRANSFER' | 'PETTY_CASH' | 'OTHER';
  paymentReference?: string;
  renewalDurationMonths?: number;
  daysRemaining: number;
  severity: AlertSeverity;
}

export interface OperationalRenewalInput {
  renewalType: OperationalRenewalType;
  entityType: OperationalEntityType;
  entityId?: string;
  entityName: string;
  documentType: string;
  documentNumber: string;
  branchId?: string;
  branchName?: string;
  issueDate?: string;
  expiryDate: string;
  renewalStatus?: RenewalWorkflowStatus;
  priority?: AlertSeverity;
  responsibleUserId?: string;
  responsibleUserName?: string;
  notes?: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
  costCenterCode?: string;
  costCenterName?: string;
  estimatedCost?: number;
  actualCost?: number;
  currency?: string;
  paymentStatus?: 'UNPAID' | 'SCHEDULED' | 'PAID' | 'WAIVED';
  plannedPaymentDate?: string;
  paidAt?: string;
  paymentMethod?: 'BENEFIT_PAY' | 'SADAD_GOV' | 'CREDIT_CARD' | 'BANK_TRANSFER' | 'PETTY_CASH' | 'OTHER';
  paymentReference?: string;
  renewalDurationMonths?: number;
}

export interface OperationalRenewalHistory {
  id: string;
  renewalId: string;
  entityName?: string;
  renewalType?: OperationalRenewalType;
  documentNumber?: string;
  previousExpiryDate?: string;
  newExpiryDate?: string;
  previousDocumentNumber?: string;
  newDocumentNumber?: string;
  action: string;
  performedBy?: string;
  performedAt: string;
  cost?: number;
  paidAt?: string;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  attachmentUrl?: string;
}

export interface OperationalRenewalAttachment {
  id: string;
  renewalId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  uploadedBy?: string;
  uploadedAt: string;
  notes?: string;
}

export interface OperationalRenewalActivity {
  id: string;
  renewalId: string;
  action: string;
  fieldName?: string;
  previousValue?: string;
  newValue?: string;
  performedBy?: string;
  performedAt: string;
  notes?: string;
}

export interface OperationalRenewalSettings {
  id?: string;
  criticalDays: number;
  urgentDays: number;
  warningDays: number;
  upcomingDays: number;
  reminderIntervals: number[];
  enabledTypes: OperationalRenewalType[];
  defaultResponsibleUserId?: string;
  defaultResponsibleUserName?: string;
}

export interface OperationalRenewalFilters {
  renewalType?: OperationalRenewalType | 'ALL';
  severity?: AlertSeverity | 'ALL';
  renewalStatus?: RenewalWorkflowStatus | 'ALL';
  branchId?: string;
  responsibleUserId?: string;
  search?: string;
  expiryPeriod?: 'ALL' | 'EXPIRED' | 'TODAY' | 'NEXT_7_DAYS' | 'NEXT_30_DAYS' | 'NEXT_60_DAYS' | 'NEXT_90_DAYS' | 'CUSTOM';
  startDate?: string;
  endDate?: string;
  includeArchived?: boolean;
}

export interface OperationalRenewalKpis {
  totalActive: number;
  criticalCount: number;
  expiredCount: number;
  expiringSoonCount: number;
  renewalInProgressCount: number;
  renewedCount: number;
  distribution: Record<AlertSeverity, number>;
}

export type RenewalCostCenterType = 'BRANCH' | 'DEPARTMENT' | 'REGULATORY' | 'HOLDING';

export interface RenewalCostCenter {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  type: RenewalCostCenterType;
  branchId?: string;
  branchCode?: string;
  isActive: boolean;
}

export interface RenewalMonthlyBudget {
  monthKey: string;
  monthLabel: string;
  year: number;
  month: number;
  renewalCount: number;
  estimatedTotal: number;
  paidTotal: number;
  pendingTotal: number;
}

export interface RenewalCostCenterBudget {
  costCenterCode: string;
  costCenterName: string;
  type: RenewalCostCenterType;
  renewalCount: number;
  estimatedTotal: number;
  paidTotal: number;
  pendingTotal: number;
  paymentCompletionPercentage: number;
}

export interface RenewalBudgetSummary {
  totalRenewals: number;
  totalEstimatedCost: number;
  totalPaidAmount: number;
  totalPendingAmount: number;
  dueIn30Days: number;
  dueIn60Days: number;
  dueIn90Days: number;
  monthlyBreakdown: RenewalMonthlyBudget[];
  costCenterBreakdown: RenewalCostCenterBudget[];
}

export type WPDurationMonths = 6 | 12 | 24;

export interface RenewalTariffRule {
  id: string;
  renewalType: OperationalRenewalType;
  label: string;
  labelAr?: string;
  baseCostBHD: number;
  durationMonths?: number;
  entityPattern?: string;
  branchCode?: string;
  documentTypePattern?: string;
  paymentLeadDays?: number;
  targetPaymentDate?: string;
  isDefault?: boolean;
  isActive?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TariffLookupResult {
  cost: number;
  matchedRule?: RenewalTariffRule;
  ruleLabel: string;
  isCustomOverride: boolean;
  paymentLeadDays?: number;
  targetPaymentDate?: string;
}

// ============================================================================
// OPERATIONAL EXPENSES TYPES
// ============================================================================
