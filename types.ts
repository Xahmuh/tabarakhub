// Define Role type for consistent usage
export type Role = 'owner' | 'admin' | 'manager' | 'accounts' | 'supervisor' | 'warehouse' | 'branch' | 'driver' | 'worker';
export type SupervisorScopeMode = 'assigned_zones' | 'all_zones';

export interface Branch {
  id: string;
  userId?: string;
  code: string;
  name: string;
  role: Role;
  googleMapsLink?: string;
  isSpinEnabled?: boolean;
  isItemsEntryEnabled?: boolean;
  isKPIDashboardEnabled?: boolean;
  whatsappNumber?: string;
  nhraLicenseNo?: string;
  crNumber?: string;
  branchManagerName?: string;
  lat?: number | null;
  lng?: number | null;
  dutyRadiusM?: number | null;
  supervisorScopeMode?: SupervisorScopeMode | null;
  regionId?: string;
  regionName?: string;
  areaName?: string;
  is24Hour?: boolean;
  isActive?: boolean;
}

export interface BranchArea {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type DeliveryZoneClass = 'core' | 'standard' | 'extended' | 'outside_range' | 'unavailable';

export interface BranchDeliveryProfile {
  id?: string;
  branchId: string;
  branchCode?: string | null;
  branchName?: string | null;
  originBlockNumber: string;
  coreRadiusKm: number;
  standardRadiusKm: number;
  extendedRadiusKm: number;
  targetDeliveryMinutes: number;
  warningDeliveryMinutes: number;
  isDeliveryEnabled: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchDeliveryProfileInput {
  branchId: string;
  originBlockNumber: string;
  coreRadiusKm: number;
  standardRadiusKm: number;
  extendedRadiusKm: number;
  targetDeliveryMinutes: number;
  warningDeliveryMinutes: number;
  isDeliveryEnabled: boolean;
  notes?: string | null;
}

export interface DeliveryBlockZoneAnalysis {
  blockNumber: string;
  branchId?: string;
  branchName?: string;
  branchCode?: string;
  originBlockNumber?: string;
  zone: DeliveryZoneClass;
  distanceKm?: number | null;
  reason?: string;
  recommendedAction: string;
}

export interface DeliveryZoneQualityMetrics {
  totalBranchProfiles: number;
  mappedBranchMarkers: number;
  unmappedBranchMarkers: number;
  duplicateBranchBlockGroups: Array<{ originBlockNumber: string; branchCodes: string[] }>;
  missingOriginBlock: number;
  missingGeoJsonBlock: number;
  servedCoreBlocks: number;
  servedStandardBlocks: number;
  servedExtendedBlocks: number;
  servedOutsideRangeBlocks: number;
  unmappedServedBlocks: number;
  missingBranchProfiles: number;
  servedBlocksMapped: number;
  servedBlocksUnavailableZone: number;
  totalGeometryBlocks: number;
}

export interface Pharmacist {
  id: string;
  branchId: string;
  code?: string;
  name: string;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  category?: string;
  agent?: string;
  defaultPrice: number;
  vatEnabled?: boolean;
  vatRate?: number;
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
  rolePermissions?: RolePermission[];
}

export type BranchLoginApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export interface BranchLoginApproval {
  id: string;
  userId: string;
  userEmail?: string | null;
  branchId: string;
  branchCode?: string | null;
  branchName?: string | null;
  deviceFingerprintHash?: string | null;
  deviceLabel?: string | null;
  browserName?: string | null;
  osName?: string | null;
  userAgentHash?: string | null;
  lastIp?: string | null;
  status: BranchLoginApprovalStatus;
  requestedAt: string;
  expiresAt: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BranchLoginApprovalDeviceInfo {
  deviceFingerprintHash: string;
  deviceLabel: string;
  browserName: string;
  osName: string;
  userAgentHash: string;
}

export type ModuleDisplayBadgeStyle = 'hidden' | 'red';
export type ModuleDisplayGridColumns = 3 | 4;

export interface ModuleDisplayItemSetting {
  key: string;
  order: number;
  badge: string;
  badgeStyle: ModuleDisplayBadgeStyle;
}

export interface ModuleDisplaySettings {
  items: ModuleDisplayItemSetting[];
  gridColumns: ModuleDisplayGridColumns;
}

export interface MaintenanceSettings {
  id: 'global';
  isMaintenanceModeEnabled: boolean;
  maintenanceTitle: string;
  maintenanceMessage: string;
  posGuidelineEnabled: boolean;
  posGuidelineTitle: string;
  posGuidelineIntro: string;
  posGuidelineLostSalesEn: string;
  posGuidelineShortageEn: string;
  posGuidelineLostSalesAr: string;
  posGuidelineShortageAr: string;
  pharmacyLogoUrl: string;
  hubLogoUrl: string;
  browserIconUrl: string;
  loadingSpinnerUrl: string;
  footerLogoUrl: string;
  footerText: string;
  loginBadges: string[];
  branchLoginApprovalRequired: boolean;
  moduleDisplaySettings: ModuleDisplaySettings;
  updatedAt?: string;
  updatedBy?: string | null;
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
  nationality?: string;
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

// --- Employee Contributions Types ---
export type ContributionType = 'Tool' | 'Project' | 'Link' | 'Training' | 'SOP' | 'Dashboard' | 'Automation' | 'AI Prompt';

export interface EmployeeContribution {
  id: string;
  title: string;
  description?: string;
  type: ContributionType;
  url?: string;
  createdBy: string;
  branch: string;
  tags?: string[];
  thumbnail?: string;
  isPinned: boolean;
  isArchived: boolean;
  filePath?: string;
  createdAt: string;
}

// --- Feature Permissions Types ---
export interface FeaturePermission {
  id: string;
  branchId: string;
  featureName: string;
  accessLevel: 'read' | 'edit' | 'none';
}

export interface RolePermission {
  role: Role;
  featureName: string;
  accessLevel: 'read' | 'edit' | 'none';
}

export interface UserFeaturePermission {
  userId: string;
  featureName: string;
  accessLevel: 'read' | 'edit' | 'none';
}

export interface AppUser {
  userId: string;
  email: string;
  role: Role;
  branchId?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
  supervisorScopeMode?: SupervisorScopeMode | null;
  isActive: boolean;
  createdAt?: string;
}

export interface SupervisorBranchAssignment {
  supervisorUserId: string;
  branchId: string;
}

export interface BranchZone {
  id: string;
  code: string;
  name: string;
  supervisorUserId?: string | null;
  notes?: string;
  isActive: boolean;
  branchIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchStaffAssignment {
  branchId: string;
  pharmacistIds: string[];
  driverIds: string[];
}

// --- Delivery Recording & Traceability Types ---

export type Governorate = 'Capital' | 'Muharraq' | 'Northern' | 'Southern';
export type DeliveryPaymentType = string;

export interface DeliveryPaymentTypeConfig {
  code: DeliveryPaymentType;
  label: string;
  requiresBlock: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeliveryBlock {
  blockNumber: string;
  areaId?: string | null;
  areaName: string;
  governorate: Governorate;
  isActive: boolean;
}

export interface DeliveryArea {
  id: string;
  name: string;
  governorate: Governorate;
  supervisorId?: string | null;
  supervisorName?: string;
  supervisorUserId?: string | null;
  notes?: string;
  isActive: boolean;
}

export interface DeliverySupervisor {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  userId?: string | null;
  notes?: string;
  isActive: boolean;
}

export interface DeliveryDriver {
  id: string;
  driverCode?: string;
  name: string;
  phone?: string;
  notes?: string;
  isActive: boolean;
  branchIds?: string[];
  authUserId?: string | null;
  isOnline?: boolean;
  statusChangedAt?: string | null;
  lastSeenAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export type DeliveryLifecycleStatus = 'recorded' | 'assigned' | 'picked_up' | 'delivered' | 'cancelled';
export type DeliveryOrderKind = 'actual_delivery' | 'internal_transfer';
export type DeliveryPaymentCollectionStatus = 'paid' | 'collect_on_delivery' | 'partial';

export interface BranchClassification {
  branchId: string;
  areaId?: string | null;
  area?: string;
  supervisorId?: string | null;
  supervisorName?: string;
  supervisorUserId?: string | null;
  governorate?: Governorate | null;
}

export interface DeliveryCostSetting {
  id?: string;
  driverId: string;
  monthlyCostBhd: number;
  workingDaysPerMonth: number;
  targetOrdersPerDay: number;
  assumedMarginPct?: number | null;
}

export interface DeliveryMobileAppSettings {
  id: 'global';
  loginLogoUrl: string;
  footerLogoUrl: string;
  footerCredit: string;
  androidMinimumBuild: number;
  androidLatestBuild: number;
  androidLatestVersion: string;
  androidApkUrl: string;
  targetCardEnabled: boolean;
  forceUpdateEnabled: boolean;
  forceUpdateTitle: string;
  forceUpdateMessage: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface DeliveryDriverMonthlyTarget {
  id?: string;
  driverId: string;
  targetMonth: string;
  targetActualDeliveries: number;
  targetIncentiveBhd: number;
  overTargetIncentivePerOrderBhd: number;
  notes?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeliveryOrder {
  id: string;
  orderNumber?: string | null;
  branchId: string;
  branchName?: string;
  orderDate: string; // yyyy-mm-dd
  valueBhd: number;
  paymentType: DeliveryPaymentType;
  paymentCollectionStatus: DeliveryPaymentCollectionStatus;
  amountReceivedBhd: number;
  amountToCollectBhd: number;
  cashHandedToDriverBhd: number;
  benefitPayReceivedTime?: string | null;
  driverPaymentNote?: string | null;
  driverPaymentCollectedAt?: string | null;
  driverPaymentCollectedAmountBhd: number;
  driverReconciliationExpectedBhd: number;
  driverReconciliationReturnedBhd: number;
  driverReconciliationVarianceBhd: number;
  driverReconciledAt?: string | null;
  driverReconciledBy?: string | null;
  driverReconciliationNote?: string | null;
  orderKind: DeliveryOrderKind;
  pharmacistId?: string | null;
  pharmacistName?: string | null;
  driverId?: string | null;
  driverCode?: string | null;
  driverName?: string | null;
  transferFromBranchId?: string | null;
  transferFromBranchCode?: string | null;
  transferFromBranchName?: string | null;
  transferToBranchId?: string | null;
  transferToBranchCode?: string | null;
  transferToBranchName?: string | null;
  blockNumber?: string | null;
  areaName?: string | null;
  governorate?: Governorate | null;
  isOutsideGovernorate: boolean;
  notes?: string;
  createdAt: string;
  deliveryStatus: DeliveryLifecycleStatus;
  assignedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  cancelledReason?: string | null;
  pickupBatchId?: string | null;
  batchDeliverySequence?: number | null;
  lifecycleUpdatedAt?: string | null;
}

export type BhdAmountInput = number | string;

export interface DeliveryOrderInput {
  branchId: string;
  orderDate: string;
  valueBhd: BhdAmountInput;
  paymentType: DeliveryPaymentType;
  paymentCollectionStatus?: DeliveryPaymentCollectionStatus;
  amountReceivedBhd?: BhdAmountInput | null;
  cashHandedToDriverBhd?: BhdAmountInput | null;
  benefitPayReceivedTime?: string | null;
  driverPaymentNote?: string | null;
  orderKind?: DeliveryOrderKind;
  pharmacistId?: string | null;
  pharmacistName?: string | null;
  driverId?: string | null;
  transferFromBranchId?: string | null;
  transferToBranchId?: string | null;
  blockNumber?: string | null;
  notes?: string;
}

export interface DeliveryOrderLifecycleInput {
  orderId: string;
  nextStatus: DeliveryLifecycleStatus;
  driverId?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
}

export interface DeliveryOrderEvent {
  id: string;
  orderId?: string | null;
  branchId: string;
  branchName?: string | null;
  eventType: DeliveryLifecycleStatus;
  previousStatus?: DeliveryLifecycleStatus | null;
  newStatus: DeliveryLifecycleStatus;
  driverId?: string | null;
  driverCode?: string | null;
  driverName?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type BenefitPayTransferType = 'AFS' | 'CREDIMAX' | 'IBAN';
export type BenefitPayTransferSource = 'manual' | 'delivery';

export interface BenefitPayTransfer {
  id: string;
  serialNumber: string;
  sequenceNo: number;
  branchId: string;
  branchCode?: string | null;
  branchName?: string | null;
  transferDate: string;
  pharmacistId?: string | null;
  pharmacistName?: string | null;
  transferType: BenefitPayTransferType;
  valueBhd: number;
  transferTime: string;
  source: BenefitPayTransferSource;
  deliveryOrderId?: string | null;
  deliveryOrderNumber?: string | null;
  deliveryOrderStatus?: DeliveryLifecycleStatus | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedBy?: string | null;
  updatedAt: string;
}

export interface BenefitPayTransferInput {
  branchId: string;
  transferDate: string;
  pharmacistId: string;
  transferType: BenefitPayTransferType;
  valueBhd: BhdAmountInput;
  transferTime: string;
  notes?: string | null;
}

export interface DeliveryNotificationPayload {
  orderId?: string | null;
  orderNumber?: string | null;
  orderDate?: string | null;
  orderKind?: DeliveryOrderKind | string | null;
  paymentType?: string | null;
  blockNumber?: string | null;
  areaName?: string | null;
  governorate?: Governorate | string | null;
  branchId?: string | null;
  branchName?: string | null;
  branchCode?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  driverCode?: string | null;
  deliveredAt?: string | null;
  eventId?: string | null;
}

export interface DeliveryNotification {
  id: string;
  notificationType: 'delivery_delivered';
  orderId: string;
  eventId: string;
  branchId: string;
  branchName?: string | null;
  branchCode?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  driverCode?: string | null;
  title: string;
  body: string;
  payload: DeliveryNotificationPayload;
  isRead: boolean;
  readAt?: string | null;
  readBy?: string | null;
  createdAt: string;
}

export interface DeliveryDriverDutyReportRow {
  driverId: string;
  driverCode?: string | null;
  driverName: string;
  statDate: string;
  firstOnlineAt?: string | null;
  lastOfflineAt?: string | null;
  startedBranchName?: string | null;
  startedLat?: number | null;
  startedLng?: number | null;
  startedDistanceM?: number | null;
  shiftCount: number;
  totalWorkingMinutes: number;
  assignedCount: number;
  pickedUpCount: number;
  deliveredCount: number;
  cancelledCount: number;
  actualDeliveryCount: number;
  internalTransferCount: number;
  notes?: string;
  isMissingPunch?: boolean;
}

// --- Delivery Coverage Analytics (manager Bahrain block coverage) ---

export type DeliveryCoverageTrend = 'up' | 'down' | 'stable' | 'insufficient_data';

export interface DeliveryBlockBranchBreakdown {
  branchId: string;
  branchName: string;
  orderCount: number;
}

export interface DeliveryBlockMetric {
  blockNumber: string;
  areaName?: string | null;
  governorate?: Governorate | null;
  /** Block number is recorded but not present in the delivery_blocks directory. */
  unresolved: boolean;
  orderCount: number;
  branchBreakdown: DeliveryBlockBranchBreakdown[];
  dominantBranchId?: string;
  dominantBranchName?: string;
  shareOfTotal: number; // fraction of known-block orders
  trend: DeliveryCoverageTrend;
}

export interface BranchDeliveryCoverageMetric {
  branchId: string;
  branchName: string;
  orderCount: number;
  knownBlockOrders: number;
  unknownBlockOrders: number;
  uniqueBlocksServed: number;
  topBlockNumber?: string;
  topBlockOrders: number;
  outsideGovernorateOrders: number;
}

export interface DeliveryGovernorateCoverage {
  governorate: Governorate | 'Unknown';
  orderCount: number;
  uniqueBlocks: number;
}

export type PurchasePowerBand = 'high' | 'medium' | 'low' | 'unavailable';

export interface GovernoratePerformanceKpi {
  governorate: Governorate | 'Unknown';
  ordersCount: number;
  totalValue: number | null;
  averageOrderValue: number | null;
  servedBlocksCount: number;
  valuePerServedBlock: number | null;
  ordersPerServedBlock: number;
  purchasePowerProxyScore: number | null;
  purchasePowerBand: PurchasePowerBand;
}

export interface BranchGovernoratePerformanceKpi {
  branchId: string;
  branchCode: string;
  branchName: string;
  governorate: Governorate | 'Unknown';
  ordersCount: number;
  totalValue: number | null;
  averageOrderValue: number | null;
  servedBlocksCount: number;
  branchValueSharePercent: number | null;
  governorateValueSharePercent: number | null;
  branchOrderSharePercent: number;
  governorateOrderSharePercent: number;
}

export interface DeliveryGovernorateKpiQuality {
  totalOrdersAnalyzed: number;
  ordersWithMappedGovernorate: number;
  ordersWithUnmappedGovernorate: number;
  ordersWithValue: number;
  ordersMissingValue: number;
  blocksWithGovernorateMapping: number;
  blocksWithoutGovernorateMapping: number;
  governorateMappingSource: 'delivery_orders_snapshot_and_delivery_blocks' | 'geojson' | 'unavailable';
  orderValueField: 'value_bhd' | 'unavailable';
}

export type DeliveryCoverageRecommendationType =
  | 'marketing_opportunity'
  | 'strong_service_area'
  | 'under_served_area'
  | 'data_quality_issue'
  | 'expansion_candidate';

export interface DeliveryCoverageRecommendation {
  type: DeliveryCoverageRecommendationType;
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  branchId?: string;
  branchName?: string;
  blockNumber?: string;
  recommendedAction: string;
}

export interface DeliveryCoverageSummary {
  dateFrom: string;
  dateTo: string;
  totalOrders: number;
  /** Non-Talabat orders — the only orders that carry a block. */
  mappableOrders: number;
  /** Talabat orders have no block by design; excluded from block coverage. */
  talabatOrders: number;
  knownBlockOrders: number;
  unknownBlockOrders: number;
  unknownBlockRate: number; // unknown / mappable
  /** Orders whose block number is not in the delivery_blocks directory. */
  unresolvedBlockOrders: number;
  uniqueBlocksServed: number;
  topBlocks: DeliveryBlockMetric[];
  lowBlocks: DeliveryBlockMetric[];
  blocks: DeliveryBlockMetric[];
  branchCoverage: BranchDeliveryCoverageMetric[];
  governorateCoverage: DeliveryGovernorateCoverage[];
  governoratePerformanceKpis: GovernoratePerformanceKpi[];
  branchGovernoratePerformanceKpis: BranchGovernoratePerformanceKpi[];
  governorateKpiQuality: DeliveryGovernorateKpiQuality;
  recommendedActions: DeliveryCoverageRecommendation[];
  topBlock?: DeliveryBlockMetric;
  topBranch?: BranchDeliveryCoverageMetric;
}

/**
 * Future hook for an exact Bahrain block map. No real coordinates ship today —
 * see docs/DELIVERY_COVERAGE_ANALYTICS.md for how to add a GeoJSON dataset.
 */
export interface BahrainBlockGeometry {
  blockNumber: string;
  governorate?: string;
  centroidLat?: number;
  centroidLng?: number;
  polygonGeoJson?: unknown;
}

// --- Advanced Delivery Coverage Analytics ---

export type DeliveryCoverageInsightSeverity = 'low' | 'medium' | 'high' | 'critical';

export type DeliveryCoverageInsightType =
  | 'campaign_opportunity'
  | 'strong_service_area'
  | 'weak_service_area'
  | 'branch_catchment'
  | 'branch_overlap'
  | 'white_space'
  | 'expansion_candidate'
  | 'capacity_pressure'
  | 'data_quality_issue'
  | 'sla_delay'
  | 'repeat_customer_signal'
  | 'product_demand_signal';

export type DeliveryDemandTrendClass =
  | 'increasing'
  | 'decreasing'
  | 'stable'
  | 'new_demand'
  | 'insufficient_data';

export type DeliveryConfidence = 'low' | 'medium' | 'high';

/** A coverage insight that a manager can convert into an operations task. */
export interface DeliveryCoverageAction {
  insightId: string; // stable id, e.g. "campaign:405" or "capacity:branch:<uuid>"
  insightType: DeliveryCoverageInsightType;
  relatedRecordType: 'delivery_block' | 'branch_coverage' | 'delivery_insight';
  relatedRecordId: string; // block number or branch id
  taskTitle: string;
  branchId?: string;
  branchName?: string;
  blockNumber?: string;
  severity: DeliveryCoverageInsightSeverity;
  recommendedAction: string;
}

export interface DeliveryCampaignOpportunity {
  insightId: string;
  blockNumber: string;
  areaName?: string | null;
  governorate?: Governorate | null;
  orderCount: number;
  trend: DeliveryDemandTrendClass;
  severity: DeliveryCoverageInsightSeverity;
  confidence: DeliveryConfidence;
  reason: string;
  recommendedAction: string;
}

export interface DeliveryDemandTrend {
  scope: 'block' | 'branch';
  key: string; // block number or branch id
  label: string;
  firstHalf: number;
  secondHalf: number;
  changePct: number | null;
  classification: DeliveryDemandTrendClass;
}

export interface DeliveryBranchCatchmentBlock {
  blockNumber: string;
  areaName?: string | null;
  orderCount: number;
  shareOfBranch: number;
  tier: 'primary' | 'secondary' | 'weak';
}

export interface DeliveryBranchCatchment {
  branchId: string;
  branchName: string;
  totalOrders: number;
  totalValueBhd: number;
  uniqueBlocks: number;
  shareOfTotal: number;
  outsideGovernorateOrders: number;
  primaryBlocks: DeliveryBranchCatchmentBlock[];
  secondaryBlocks: DeliveryBranchCatchmentBlock[];
  weakBlocks: DeliveryBranchCatchmentBlock[];
}

export interface DeliveryBranchOverlap {
  insightId: string;
  blockNumber: string;
  areaName?: string | null;
  governorate?: Governorate | null;
  totalOrders: number;
  branches: Array<{ branchId: string; branchName: string; orderCount: number; sharePct: number }>;
  dominantBranchId?: string;
  dominantBranchName?: string;
  severity: DeliveryCoverageInsightSeverity;
  recommendedAction: string;
}

export interface DeliveryWhiteSpaceInsight {
  blockNumber: string;
  areaName?: string | null;
  governorate?: Governorate | null;
  orderCount: number; // 0 in true_zero_activity mode
  note: string;
}

export interface DeliveryWhiteSpace {
  /** true_zero_activity requires the block directory as a full universe; otherwise served-only. */
  mode: 'served_low_activity' | 'true_zero_activity';
  trueZeroCount: number;
  items: DeliveryWhiteSpaceInsight[];
  note: string;
}

export interface DeliveryExpansionCandidate {
  insightId: string;
  scope: 'block' | 'branch';
  blockNumber?: string;
  branchId?: string;
  label: string;
  score: number; // 0..100
  reasons: string[];
  severity: DeliveryCoverageInsightSeverity;
  recommendedAction: string;
}

export type DeliveryCapacityClass =
  | 'normal'
  | 'watch'
  | 'high_pressure'
  | 'overloaded'
  | 'insufficient_data';

export interface DeliveryCapacityPressure {
  insightId: string;
  branchId: string;
  branchName: string;
  orderCount: number;
  uniqueBlocks: number;
  topBlockConcentration: number; // share of branch volume in its busiest block
  outsideGovernoratePct: number;
  unknownBlockRate: number;
  overlapBlocks: number;
  classification: DeliveryCapacityClass;
  recommendedAction: string;
}

/** Which optional delivery_orders fields exist, gating SLA/product/customer analytics. */
export interface DeliveryFieldAvailability {
  revenue: boolean;
  deliveryTiming: boolean;
  deliveryStatus: boolean;
  customerIdentifier: boolean;
  productData: boolean;
}

export interface DeliveryAdvancedCoverage {
  fieldAvailability: DeliveryFieldAvailability;
  campaignOpportunities: DeliveryCampaignOpportunity[];
  demandTrends: DeliveryDemandTrend[];
  branchCatchments: DeliveryBranchCatchment[];
  branchOverlaps: DeliveryBranchOverlap[];
  whiteSpace: DeliveryWhiteSpace;
  expansionCandidates: DeliveryExpansionCandidate[];
  capacityPressures: DeliveryCapacityPressure[];
}

export interface DeliveryCoverageBundle {
  summary: DeliveryCoverageSummary;
  advanced: DeliveryAdvancedCoverage;
}

export type DriverEfficiencyClass = 'optimum' | 'in_range' | 'low_efficiency' | 'loss_making';

export interface DriverEfficiency {
  driverId: string;
  driverCode?: string;
  driverName: string;
  orders: number;
  totalValue: number;
  ordersPerDay: number;
  costPerOrder: number | null;
  periodCost: number | null;
  estimatedContribution: number | null;
  estimatedNet: number | null;
  classification: DriverEfficiencyClass | 'no_cost_data';
}

// ============================================================================
// OPERATIONAL ALERT & RENEWALS TYPES
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

export type VehicleOwnershipType = 'Internal' | 'External';

export interface Vehicle {
  id: string;
  vehicleCode: string;
  vehicleType: string;
  ownershipType?: VehicleOwnershipType;
  plateNumber?: string;
  crNumber?: string;
  registrationExpiryDate?: string;
  initialOdometer: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VehicleOdometerHistory {
  id: string;
  vehicleId: string;
  odometerReading: number;
  readingDate: string;
  readingTime?: string;
  sourceType: string;
  sourceReferenceId?: string;
  driverId?: string;
  driverName?: string;
  branchId?: string;
  branchName?: string;
  branchCode?: string;
  amount?: number;
  location?: string;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface FuelExpenseDetail {
  id: string;
  expenseId: string;
  vehicleId: string;
  driverId?: string;
  previousOdometer: number;
  currentOdometer: number;
  distanceSincePrevious: number;
  liters?: number;
  fuelPricePerLiter?: number;
  createdAt?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  isActive: boolean;
}

export interface ExpenseTransaction {
  id: string;
  referenceNo: string;
  branchId: string;
  branchCode?: string;
  branchName?: string;
  categoryId: string;
  categoryName?: string;
  categorySlug?: string;
  expenseDate: string;
  expenseTime?: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  paidTo?: string;
  driverId?: string;
  driverName?: string;
  vehicleId?: string;
  vehicleCode?: string;
  plateNumber?: string;
  ownershipType?: VehicleOwnershipType;
  receiptUrl?: string;
  receiptProvidedToAccounts: boolean;
  receiptProvidedAt?: string;
  receiptProvidedBy?: string;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  deletedAt?: string;
  fuelDetails?: FuelExpenseDetail;
}

export interface ExpenseTransactionInput {
  branchId: string;
  categoryId: string;
  expenseDate: string;
  expenseTime?: string;
  amount: number;
  currency?: string;
  description?: string;
  paidTo?: string;
  driverId?: string;
  vehicleId?: string;
  receiptUrl?: string;
  receiptProvidedToAccounts?: boolean;
  createdBy?: string;
  currentOdometer?: number;
  liters?: number;
  fuelPricePerLiter?: number;
  fuelDetails?: {
    currentOdometer: number;
    liters?: number;
    fuelPricePerLiter?: number;
  };
}

export interface ExpenseFilters {
  branchId?: string;
  categoryId?: string;
  vehicleId?: string;
  driverId?: string;
  startDate?: string;
  endDate?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  status?: string;
  receiptPending?: boolean;
}

export interface HighestExpenseVehicle {
  vehicleId: string;
  vehicleCode: string;
  plateNumber?: string;
  totalExpense: number;
}

export interface ExpenseDashboardKpis {
  totalExpenses: number;
  totalCount?: number;
  transactionCount?: number;
  fuelTotal: number;
  maintenanceTotal: number;
  suppliesTotal: number;
  vehicleServicesTotal: number;
  otherTotal: number;
  todayTotal?: number;
  weekTotal?: number;
  monthTotal?: number;
  receiptsPending?: number;
  receiptsPendingCount?: number;
  totalDistanceKm: number;
  totalFuelLiters: number;
  avgCostPerKm: number;
  avgLitersPer100Km?: number;
  avgConsumptionPer100Km?: number;
  prevPeriodLabel?: string;
  totalExpensesChangePct?: number;
  fuelTotalChangePct?: number;
  avgCostPerKmChangePct?: number;
  avgConsumptionChangePct?: number;
  highestExpenseVehicle?: HighestExpenseVehicle;
}

export interface ExpenseCalendarDay {
  date: string;
  dayOfMonth?: number;
  dayOfWeek?: number;
  total?: number;
  count?: number;
  totalAmount?: number;
  transactionCount?: number;
  isCurrentMonth?: boolean;
  isToday?: boolean;
  }

export interface BranchExpenseRanking {
  branchId: string;
  branchCode: string;
  branchName: string;
  total?: number;
  count?: number;
  totalAmount?: number;
  transactionCount?: number;
  percentage: number;
}

// ============================================================================
// AUTOMATED DUTY SCHEDULER TYPES (Spec v1.0)
// ============================================================================

export interface Region {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchShiftType {
  id: string;
  branchId: string;
  code: string;
  shiftTypeCode?: string;
  name: string;
  startTime: string; // "HH:MM:SS" or "HH:MM"
  endTime: string;
  crossesMidnight?: boolean;
  durationHours?: number;
  isActive?: boolean;
  staffRequired: number;
  createdAt?: string;
}

export type DutySchedulerLeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface DutySchedulerLeaveRecord {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  status: DutySchedulerLeaveStatus;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Comprehensive Annual Leave Management Types
// ==========================================

export type AnnualLeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type AnnualLeaveEventType = 'ACCRUAL' | 'CONSUMPTION' | 'MANUAL_ADJUSTMENT' | 'CONSUMPTION_REFUND';

export interface AnnualLeaveRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  requestedDays: number;
  status: AnnualLeaveRequestStatus;
  requestComments: string | null;
  requestedAt: string;
  decidedByUserId: string | null;
  decidedAt: string | null;
  decisionComments: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnnualLeaveLedgerEntry {
  id: string;
  employeeId: string;
  period: string; // 'YYYY-MM'
  openingBalance: number;
  accruedDays: number;
  consumedDays: number;
  closingBalance: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnnualLeaveAccrualEvent {
  id: string;
  employeeId: string;
  ledgerEntryId: string;
  eventType: AnnualLeaveEventType;
  amount: number;
  relatedRequestId: string | null;
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export type WeeklyRestComplianceStatus = 'UNDER' | 'OK' | 'OVER';

export interface WeeklyRestComplianceRow {
  employeeId: string;
  employeeName: string;
  totalCalendarDays: number;
  weeksCount: number;
  expectedRestDaysMin: number;
  expectedRestDaysMax: number;
  actualRestDaysTaken: number;
  leaveDaysCount: number;
  status: WeeklyRestComplianceStatus;
}

export interface WeeklyRestComplianceReport {
  startDate: string;
  endDate: string;
  rows: WeeklyRestComplianceRow[];
  summary: {
    totalEmployees: number;
    okCount: number;
    underCount: number;
    overCount: number;
  };
}


export type PharmacistRoleType = 'FIXED' | 'RELIEF';
export type WorkRestMode = 'DAYS_PER_WEEK' | 'FIXED_CYCLE' | 'VARIABLE_CYCLE' | 'CUSTOM_CALENDAR' | 'DYNAMIC_VARIABLE_CYCLE';
export type PatternStrictness = 'HARD' | 'SOFT';
export type ShiftEligibility = 'AM_ONLY' | 'PM_ONLY' | 'NIGHT_ONLY' | 'MIXED';
export type DutyScheduleStatus = 'DRAFT' | 'UNDER_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type DutyConflictSeverity = 'HARD' | 'SOFT';

export interface DynamicVariableCycleConfig {
  targetStreakMin: number;       // soft preference lower bound, e.g. 4
  targetStreakMax: number;       // soft preference upper bound, e.g. 6
  minRestDaysAfterStreak: number; // typically 1, configurable per profile
}

export interface PharmacistSchedulingProfile {
  id: string;
  employeeId: string;
  roleType: PharmacistRoleType;
  primaryBranchId?: string;
  workRestMode: WorkRestMode;
  workRestConfig: any; // JSON configuration based on the mode
  patternStrictness: PatternStrictness;
  maximumConsecutiveWorkingDays: number;
  maxConsecutiveWorkingDaysOverride?: number | null; // Optional override; null = use global Control Center value
  minimumRestHours: number; // Spec §5.2 - default 11.0
  weekendPreference?: any; // JSON
  isActive: boolean;
  effectiveFrom?: string; // "YYYY-MM-DD"
  effectiveTo?: string; // "YYYY-MM-DD"
  createdAt: string;
  updatedAt: string;
  
  // Relations mapped at runtime
  allowedBranchIds?: string[];
  allowedShiftTypes?: string[];
  zoneId?: string;
  zoneName?: string;
  secondaryZoneId?: string;
  secondaryZoneName?: string;
  secondaryZoneMaxDays?: number;
}

export interface DutySchedule {
  id: string;
  name?: string;
  zoneId?: string;
  zoneName?: string;
  periodStart: string; // "YYYY-MM-DD"
  periodEnd: string; // "YYYY-MM-DD"
  status: DutyScheduleStatus;
  version: number;
  editingUserId?: string;
  editingStartedAt?: string;
  lockedAt?: string;
  lockedBy?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DutyScheduleAssignment {
  id: string;
  scheduleId: string;
  employeeId: string;
  branchId: string;
  date: string; // "YYYY-MM-DD"
  shiftCode: string;
  isLocked: boolean;
  isRelief: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PharmacistRollingState {
  id: string;
  employeeId: string;
  scheduleId: string;
  consecutiveWorkingDays: number;
  currentConsecutiveWorkingDays?: number;
  currentConsecutiveRestDays?: number;
  currentPatternCycleIndex?: number;
  lastShiftType?: string;
  lastBranchId?: string;
  lastShiftEndTime?: string; // TIMESTAMPTZ
  lastShiftEndDatetime?: string;
  daysSinceWeeklyRest: number;
  workloadScore: number;
  totalWorkloadScore?: number;
  recentWorkloadScore?: number;
  weekendAssignmentCount?: number;
  
  // Dynamic Variable Cycle extensions
  isOnActiveStreak?: boolean;
  streakStartDate?: string | null;
  currentStreakTargetLength?: number | null;
  
  createdAt: string;
}

export interface DutyScheduleConflict {
  id: string;
  scheduleId: string;
  employeeId?: string; // Nullable if branch-level conflict
  branchId?: string;
  date: string; // "YYYY-MM-DD"
  conflictType: string;
  severity: DutyConflictSeverity;
  description: string;
  createdAt: string;
}

export interface DutyScheduleChange {
  id: string;
  scheduleId: string;
  actingUserId?: string;
  eventType: string;
  targetId?: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
  createdAt: string;
}

export interface DutySchedulerSettings {
  id?: string;
  defaultMinimumRestHours: number;
  defaultMaximumConsecutiveWorkingDays: number;
  defaultWorkRestMode: WorkRestMode;
  defaultWorkRestConfig: any;
  defaultRestDaysPerPeriod?: number;
  globalMaxConsecutiveDays?: number; // Admin-configurable ceiling for DYNAMIC_VARIABLE_CYCLE (default 8)
  shiftWeights: {
    AM: number;
    PM: number;
    NIGHT: number;
    FULL?: number;
    weekend_bonus?: number;
    [key: string]: number | undefined;
  };
  weekendDays: number[];
  fairnessWeight: number;
  continuityWeight: number;
  updatedBy?: string;
  updatedAt?: string;
}

export interface EmployeeSpecialRestRequest {
  id?: string;
  employeeId: string;
  employeeName?: string;
  dates: string[]; // List of specific dates (YYYY-MM-DD) requested as weekly rest / off-days
  notes?: string;
}

export interface SchedulingPeriodAdjustments {
  extraRestDays?: Record<string, number>; // employeeId -> additional rest days to take this period
  weekendPharmacistIds?: string[];        // 3-5 employeeIds designated for Friday/Saturday rest & off-day distribution
  leaveRecords?: DutySchedulerLeaveRecord[]; // Verified leave records from wizard for zero-gap solver
  specialRestRequests?: EmployeeSpecialRestRequest[]; // Specific requested weekly off-days per employee
}

export interface PatternDeviationRecord {
  employeeId: string;
  date: string;
  type: string;
  description: string;
  streakLength?: number;
}

export interface DynamicCycleSolverInput {
  periodStart: string;
  periodEnd: string;
  pharmacists: Array<{
    id: string;
    full_name?: string;
    name?: string;
    profile?: PharmacistSchedulingProfile;
    [key: string]: any;
  }>;
  rollingStates: Record<string, PharmacistRollingState>;
  branchShiftRequirements: BranchShiftType[];
  approvedLeave: DutySchedulerLeaveRecord[];
  branches: Branch[];
  lockedAssignments?: DutyScheduleAssignment[];
  globalMaxConsecutiveDays?: number;
  periodAdjustments?: SchedulingPeriodAdjustments;
  targetZoneId?: string;
  shiftWeights?: Record<string, number>;
}

export interface DynamicCycleSolverOutput {
  assignments: DutyScheduleAssignment[];
  updatedRollingStates: Record<string, PharmacistRollingState>;
  conflicts: DutyScheduleConflict[];
  deviations: PatternDeviationRecord[];
  success?: boolean;
  backtrackCount?: number;
  backjumpCount?: number;
}


// ============================================================================
// ATTENDANCE & GEOFENCING MODULE TYPES (Hardened Spec v1.0)
// ============================================================================

// ---------- Staff Category ----------
export type StaffCategory = 'Pharmacist' | 'Driver' | 'Worker' | 'Management';

// ---------- Core Attendance ----------
export type AttendancePunchType = 'CLOCK_IN' | 'CLOCK_OUT';
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT' | 'ON_LEAVE' | 'DAY_OFF' | 'HOLIDAY';
export type GeofenceValidation = 'INSIDE' | 'OUTSIDE' | 'GPS_UNAVAILABLE' | 'LOW_CONFIDENCE' | 'MANUAL_OVERRIDE';
export type AttendanceSyncStatus = 'CONFIRMED' | 'PENDING_SYNC' | 'SYNC_FAILED';

export interface AttendancePunch {
  id: string;
  employeeId: string;
  punchType: AttendancePunchType;
  punchTime: string;                 // ISO 8601 timestamp (captured client-side, authoritative)
  serverReceivedAt?: string;         // ISO 8601 timestamp (when server processed it)
  lat: number | null;
  lng: number | null;
  accuracy: number | null;           // GPS accuracy in meters
  matchedBranchId: string | null;
  matchedBranchName?: string;
  distanceFromBranch: number | null;  // meters from nearest geofence center
  geofenceValidation: GeofenceValidation;
  syncStatus: AttendanceSyncStatus;   // §4: Supabase-first with pending-sync queue
  deviceFingerprint?: string;         // browser/device identifier
  photoUrl?: string | null;           // optional selfie capture
  ipAddress?: string | null;
  notes?: string;
  flaggedForReview?: boolean;         // §3: anti-spoofing flags
  flagReasons?: string[];             // e.g. ['impossible_travel', 'low_accuracy']
  overriddenBy?: string | null;       // manager userId who approved override
  overrideReason?: string | null;
  createdAt: string;
}

export interface AttendanceDailyRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  category?: StaffCategory;
  date: string;                       // YYYY-MM-DD
  scheduledShiftCode?: string;        // from Duty Scheduler assignment
  scheduledBranchId?: string;
  scheduledBranchName?: string;
  scheduledStartTime?: string;        // HH:MM
  scheduledEndTime?: string;
  actualClockIn?: string;             // ISO timestamp
  actualClockOut?: string;
  clockInPunchId?: string;
  clockOutPunchId?: string;
  clockInGeofence: GeofenceValidation;
  clockOutGeofence: GeofenceValidation;
  status: AttendanceStatus;
  lateMinutes: number;                // 0 if on time (measured AFTER grace period — §5.1)
  earlyLeaveMinutes: number;          // 0 if full shift
  overtimeMinutes: number;
  totalWorkedMinutes: number;
  breakMinutes: number;               // configurable deduction
  netWorkedMinutes: number;
  penaltyIds: string[];               // FK references to penalty_ledger
  isManualEntry: boolean;
  manualEntryBy?: string | null;
  manualEntryReason?: string;
  approvedBy?: string | null;
  remarks?: string;
  registeredFingerprint?: string;
  deviceFingerprint?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Penalties Engine ----------
export type PenaltyRuleType =
  | 'LATE_ARRIVAL'
  | 'EARLY_DEPARTURE'
  | 'ABSENT_NO_EXCUSE'
  | 'ABSENT_NO_NOTICE'
  | 'MISSING_PUNCH'
  | 'OUTSIDE_GEOFENCE'
  | 'CONSECUTIVE_LATE'
  | 'MONTHLY_LATE_THRESHOLD'
  | 'CUSTOM';

export type PenaltyActionType =
  | 'VERBAL_WARNING'
  | 'WRITTEN_WARNING'
  | 'SALARY_DEDUCTION_HOURS'    // deduct N hours of daily rate
  | 'SALARY_DEDUCTION_DAYS'     // deduct N days of monthly salary
  | 'SALARY_DEDUCTION_FIXED'    // fixed BHD amount
  | 'SUSPENSION_DAYS'
  | 'TERMINATION_FLAG';          // §5.3: INERT — only creates a flag for HR review, never auto-deactivates

export type PenaltyEscalationTier = 1 | 2 | 3 | 4 | 5;

export interface AttendancePenaltyRule {
  id: string;
  ruleType: PenaltyRuleType;
  name: string;                       // e.g. "Late Arrival (1-15 min)"
  nameAr?: string;
  description?: string;
  descriptionAr?: string;

  // Trigger conditions
  triggerCondition: {
    minLateMinutes?: number;          // measured AFTER grace period is subtracted (§5.1)
    maxLateMinutes?: number;
    minEarlyLeaveMinutes?: number;
    consecutiveCount?: number;        // for escalation rules
    monthlyOccurrenceThreshold?: number;
    geofenceRequired?: boolean;
  };

  // Tiered escalation
  escalationTiers: Array<{
    tier: PenaltyEscalationTier;
    occurrenceRange: [number, number]; // e.g. [1,1] = 1st time, [2,3] = 2nd-3rd
    action: PenaltyActionType;
    deductionValue?: number;          // hours, days, or BHD depending on action
    description: string;
    descriptionAr?: string;
  }>;

  isActive: boolean;
  appliesTo: StaffCategory[];         // which staff categories this rule applies to
  resetPeriod: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'NEVER';
  createdAt: string;
  updatedAt: string;
}

export interface AttendancePenaltyLedger {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  date: string;                       // YYYY-MM-DD
  ruleId: string;
  ruleName: string;
  ruleType: PenaltyRuleType;
  tier: PenaltyEscalationTier;
  action: PenaltyActionType;
  deductionValue: number;
  deductionUnit: 'HOURS' | 'DAYS' | 'BHD';
  calculatedDeductionBhd: number;     // final BHD amount
  occurrenceNumber: number;           // nth violation in reset period
  isWaived: boolean;
  waivedBy?: string;
  waivedReason?: string;
  waivedAt?: string;
  linkedAttendanceRecordId: string;
  notes?: string;
  createdAt: string;
}

// ---------- Overtime Configuration (§2.2 — configurable, not hard-coded) ----------
export interface OvertimeRateConfig {
  normalDayMultiplier: number;         // e.g. 1.25, admin-editable
  weekendMultiplier: number;           // e.g. 1.5 — Bahrain law treats weekend/holiday OT differently
  publicHolidayMultiplier: number;     // e.g. 1.5 or higher, admin-editable
}

// ---------- Module Configuration (§2.1 — no duplicated publicHolidays/weekendDays) ----------
export interface AttendanceModuleConfig {
  id: string;
  gracePeriodMinutes: number;           // default 5
  earlyClockInWindowMinutes: number;    // how early they can punch in (e.g. 30)
  autoClockOutAfterHours: number;       // auto clock-out if forgot (e.g. 14)
  breakDeductionMinutes: number;        // standard break deduction (e.g. 30)
  requireGeofenceForClockIn: boolean;
  requireGeofenceForClockOut: boolean;
  allowManualEntryByEmployee: boolean;
  requirePhotoOnClockIn: boolean;       // photo on first clock-in of the day only (§6)
  gpsAccuracyThresholdMeters: number;   // §3.1: reject/flag punches with accuracy worse than this (e.g. 100)
  impossibleTravelSpeedKmh: number;     // §3.2: flag if implied speed exceeds this (e.g. 200)
  geofenceRadiusOverrideMeters?: number | null; // global override, null = per-branch assignment
  overtimeThresholdMinutes: number;     // minutes after shift end to count OT (e.g. 15)
  overtimeRateConfig: OvertimeRateConfig;
  workingHoursPerDay: number;           // for deduction calculations (e.g. 8)
  // NOTE: weekendDays sourced from DutySchedulerSettings.weekendDays — not duplicated here (§2.1)
  // NOTE: publicHolidays sourced from PublicHoliday table — not duplicated here (§2.1)
  updatedBy?: string;
  updatedAt: string;
}

// ---------- Granular Permissions (§2.3) ----------
export type AttendancePermissionKey =
  | 'attendance_clock_self'            // Clock In/Out for own record
  | 'attendance_view_own'              // View own attendance history
  | 'attendance_view_team'             // Manager dashboard, all employees in scope
  | 'attendance_manual_entry'          // Admin override entry
  | 'attendance_manage_penalty_rules'  // Edit AttendancePenaltyRule configuration
  | 'attendance_waive_penalty'         // Waiver action on penalty ledger
  | 'attendance_view_penalty_ledger'   // Read-only access to penalty history/audit
  | 'attendance_configure_module';     // Edit AttendanceModuleConfig

// ---------- Reporting ----------
export interface AttendanceMonthlyReport {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  category: string;
  branchName: string;
  month: string;                      // YYYY-MM
  scheduledDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  dayOffDays: number;
  holidayDays: number;
  earlyLeaveDays: number;
  totalLateMinutes: number;
  totalEarlyLeaveMinutes: number;
  totalOvertimeMinutes: number;
  totalWorkedHours: number;
  totalPenaltiesBhd: number;
  totalWaivedPenaltiesBhd: number;
  penaltyBreakdown: Array<{
    ruleType: PenaltyRuleType;
    count: number;
    totalBhd: number;
    waivedCount: number;
  }>;
  attendancePercentage: number;        // present / scheduled × 100
  punctualityScore: number;            // 0-100 composite score
}

// ---------- Anti-Spoofing Review Queue ----------
export interface AttendanceReviewItem {
  punchId: string;
  employeeId: string;
  employeeName: string;
  punchTime: string;
  flagReasons: string[];
  resolvedBy?: string;
  resolvedAt?: string;
  resolution?: 'APPROVED' | 'REJECTED' | 'PENDING';
}
