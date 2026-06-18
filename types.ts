
// Define Role type for consistent usage
export type Role = 'owner' | 'admin' | 'manager' | 'accounts' | 'supervisor' | 'warehouse' | 'branch' | 'driver';

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
  branchId: string;
  branchName?: string;
  orderDate: string; // yyyy-mm-dd
  valueBhd: number;
  paymentType: DeliveryPaymentType;
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

export interface DeliveryOrderInput {
  branchId: string;
  orderDate: string;
  valueBhd: number;
  paymentType: DeliveryPaymentType;
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
