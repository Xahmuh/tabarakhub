// ============================================================================
// ATTENDANCE & BIOMETRIC PUNCH TYPES
// ============================================================================

import type { DutySchedulerSettings, StaffCategory } from './scheduler';

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
