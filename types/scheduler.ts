// ============================================================================
// AUTOMATED DUTY SCHEDULER & LEAVE MANAGEMENT TYPES
// ============================================================================

import type { Branch, Pharmacist } from './common';

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
