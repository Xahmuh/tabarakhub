
// Define Role type for consistent usage
export type Role = 'admin' | 'branch' | 'manager' | 'accounts';

export interface Branch {
  id: string;
  code: string;
  name: string;
  role: Role;
  googleMapsLink?: string;
  isSpinEnabled?: boolean;
  isItemsEntryEnabled?: boolean;
  isKPIDashboardEnabled?: boolean;
  whatsappNumber?: string;
  password?: string;
}

export interface Pharmacist {
  id: string;
  branchId: string;
  name: string;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  category?: string;
  agent?: string;
  defaultPrice: number;
  isManual: boolean;
  createdByBranch?: string;
  internalCode?: string;
  internationalCode?: string;
}

export interface LostSale {
  id: string;
  branchId: string;
  pharmacistId: string;
  pharmacistName?: string;
  productId?: string;
  productName: string;
  agentName?: string;
  // Fix: Added missing category property to LostSale interface to match POS requirements
  category?: string;
  unitPrice: number;
  quantity: number;
  priceSource: 'db' | 'manual';
  totalValue: number;
  lostDate: string;
  lostHour: number;
  timestamp: string;
  isManual: boolean;
  notes?: string;
  alternativeGiven?: boolean;
  internalTransfer?: boolean;
  internalCode?: string;
  sessionId?: string;
}

export interface AuthState {
  user: Branch | null;
  pharmacist: Pharmacist | null;
  permissions?: FeaturePermission[];
}

export type ShortageStatus = 'Low' | 'Critical' | 'Out of Stock';

export interface ShortageHistory {
  status: ShortageStatus;
  timestamp: string;
  pharmacistName: string;
}

export interface Shortage {
  id: string;
  branchId: string;
  pharmacistId: string;
  productId?: string;
  productName: string;
  agentName?: string;
  status: ShortageStatus;
  pharmacistName: string;
  timestamp: string;
  notes?: string;
  internalCode?: string;
  history?: ShortageHistory[];
}

export interface Customer {
  id: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  createdAt: string;
  lastReviewedAt?: string;
}

export interface SpinPrize {
  id: string;
  name: string;
  type: 'discount' | 'free_item' | 'gift';
  value: number;
  probabilityWeight: number;
  dailyLimit?: number;
  isActive: boolean;
  color?: string;
  createdAt: string;
}

export interface SpinSession {
  token: string;
  branchId: string;
  used: boolean;
  isMultiUse?: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface Spin {
  id: string;
  customerId: string;
  branchId: string;
  prizeId: string;
  voucherCode: string;
  createdAt: string;
  redeemedAt?: string;
  redeemedBranchId?: string;
}

export interface BranchReview {
  id: string;
  customerId: string;
  branchId: string;
  reviewedAt: string;
  reviewClicked: boolean;
}

export interface VoucherShare {
  id: string;
  voucherCode: string;
  fromCustomerId: string;
  branchId: string;
  sharedAt: string;
}

export interface HRRequest {
  id: string;
  refNum: string;
  employeeName: string;
  cpr: string;
  type?: 'Document' | 'Vacation Request';
  docTypes: string[];
  docReason?: string;
  reqDate?: string;
  deliveryMethod?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  timestamp: string;
  email?: string;
  passport?: string;
  passportName?: string;
  license?: string;
  sponsor?: string;
  joinDate?: string;
  salary?: string;
  otherDocType?: string;

  // Vacation Fields
  leaveType?: string;
  holidayFrom?: string;
  holidayTo?: string;
  daysCount?: number;
  flightOut?: string;
  flightReturn?: string;
  jobTitle?: string;
  department?: string;
  location?: string;
  mobile?: string;
  notes?: string;
  lastVacationDate?: string;
}

// --- Cash Flow Planner Types ---

export type Priority = 'Critical' | 'Normal' | 'Flexible' | 'High' | 'Medium' | 'Low';
export type ChequeStatus = 'Scheduled' | 'Paid' | 'Delayed';
export type FlexibilityLevel = 'High' | 'Medium' | 'Low';
export type ExpenseType = 'Fixed' | 'Variable';
export type ConfidenceLevel = 'High' | 'Medium' | 'Low';
export type RiskLevel = 'Safe' | 'Warning' | 'Critical';
export type PaymentType = 'Cash' | 'Visa';

export interface Supplier {
  id: string;
  name: string;
  flexibilityLevel: FlexibilityLevel;
  notes?: string;
}

export interface Cheque {
  id: string;
  supplierId: string;
  chequeNumber: string;
  amount: number;
  dueDate: string;
  priority: Priority;
  status: ChequeStatus;
  delayReason?: string;
  executionTime: string; // HH:mm
  createdAt: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  expenseDate: string;
  type: ExpenseType;
  delayAllowed: boolean;
  maxDelayDays: number;
  priority: Priority;
  notes?: string;
}

export interface ActualRevenue {
  id: string;
  revenueDate: string;
  amount: number;
  paymentType: PaymentType;
  settlementTime: string; // HH:mm
  createdAt: string;
}

export interface ExpectedRevenue {
  id: string;
  expectedDate: string;
  expectedAmount: number;
  confidence: ConfidenceLevel;
  expectedTime: string; // HH:mm
  reason?: string;
  createdAt: string;
}

export interface ForecastDay {
  date: string;
  openingBalance: number;
  inflow: number;
  outflow: number;
  morningBalance: number; // Balance after morning cheques/expenses (09:00)
  afternoonBalance: number; // Balance after afternoon visa/revenues (13:00)
  closingBalance: number;
  riskLevel: RiskLevel;
  morningRisk: RiskLevel;
  items: {
    type: 'cheque' | 'expense' | 'revenue_actual' | 'revenue_expected';
    name: string;
    amount: number;
    priority?: Priority;
    id: string;
    ref?: any;
  }[];
}

export interface CashFlowSettings {
  safeThreshold: number;
  initialBalance: number;
  forecastHorizon: number; // 30, 60, 90
}

// --- Branch Cash Difference Tracker Types ---

export type DifferenceStatus = 'Open' | 'Reviewed' | 'Closed';
export type DifferenceType = 'Increase' | 'Shortage';

export interface CashDifference {
  id: string;
  date: string;
  branchId: string;
  branchName?: string;
  pharmacistName: string;
  systemCash: number;
  actualCash: number;
  difference: number;
  differenceType: DifferenceType;
  reason?: string;
  hasInvoices?: boolean;
  invoiceReference?: string;
  status: DifferenceStatus;
  managerComment?: string;
  drawerBalance?: number;
  createdAt: string;
}

// --- Corporate Codex Types ---
export interface CodexEntry {
  id: string;
  title: string;
  description?: string;
  type: 'circular' | 'policy';
  priority: 'normal' | 'urgent' | 'critical';
  publishDate: string;
  pages: string[]; // Base64 strings or URLs
  isPublished: boolean;
  isPinned?: boolean;
  department?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// --- Feature Permissions Types ---
export interface FeaturePermission {
  id: string;
  branchId: string;
  featureName: string;
  accessLevel: 'read' | 'edit' | 'none';
}