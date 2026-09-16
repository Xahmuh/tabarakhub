import { 
  DutyScheduleAssignment, 
  DutyScheduleConflict, 
  PharmacistRollingState, 
  PharmacistSchedulingProfile, 
  DutySchedulerLeaveRecord, 
  BranchShiftType, 
  Branch,
  SchedulingPeriodAdjustments
} from '../../types';
import { 
  evaluateWorkRestPattern, 
  advanceRollingState, 
  RollingPharmacistState, 
  PatternEvaluationResult 
} from './workRestPatterns';
import { 
  calculateShiftDatetimes, 
  validateMinimumRest, 
  isShiftAllowedForPharmacist, 
  categorizeShift,
  BAHRAIN_TZ_OFFSET
} from './shiftTransitions';
import { resolveEffectiveMaxConsecutiveDays } from './dynamicVariableCycleSolver';
import { smoothScheduleAndGroupRestDays } from './scheduleSmoothing';

export * from './workRestPatterns';
export * from './shiftTransitions';
export * from './dynamicVariableCycleSolver';
export * from './scheduleSmoothing';

export interface RequiredCoverageSummary {
  totalRequired: number;
  byShiftType: {
    AM: number;
    PM: number;
    NIGHT: number;
    [code: string]: number;
  };
  hasNightShifts: boolean;
  branchShiftsMap: Map<string, BranchShiftType[]>;
}

export interface PharmacistCapacityDetail {
  employeeId: string;
  name: string;
  roleType: 'FIXED' | 'RELIEF' | 'UNASSIGNED';
  hasProfile: boolean;
  isUsingDefaultAssumption: boolean;
  isExcludedOnLeave?: boolean;
  workRestMode?: string;
  workRestDescription: string;
  leaveDays: number;
  availableDays: number;
  expectedWorkingDays: number;
  extraRestDays: number;
  netCapacity: number;
}

export interface CapacityCoverageSummary {
  requiredCoverage: RequiredCoverageSummary;
  totalPharmacistsInScope: number;
  availablePharmacistsCount: number;
  onLeavePharmacistsCount: number;
  totalBaseCapacity: number;
  totalAdjustedCapacity: number;
  balance: number; // totalAdjustedCapacity - totalRequired
  isSurplus: boolean;
  isDeficit: boolean;
  surplusCount: number;
  deficitCount: number;
  pharmacistDetails: PharmacistCapacityDetail[];
  excludedLeavePharmacists: PharmacistCapacityDetail[];
}

export interface SchedulingInput {
  scheduleId: string;
  targetZoneId?: string;
  startDate: Date | string;
  endDate: Date | string;
  profiles: PharmacistSchedulingProfile[];
  leaves: DutySchedulerLeaveRecord[];
  previousRollingState?: PharmacistRollingState[];
  branches: Branch[];
  shiftRequirements?: BranchShiftType[];
  lockedAssignments?: DutyScheduleAssignment[];
  shiftWeights?: Record<string, number>;
  periodAdjustments?: SchedulingPeriodAdjustments;
  globalMaxConsecutiveDays?: number;
  employees?: any[];
}

export interface SchedulingOutput {
  assignments: DutyScheduleAssignment[];
  conflicts: DutyScheduleConflict[];
  newRollingState: PharmacistRollingState[];
}

/**
 * Safely generates YYYY-MM-DD date strings in range [startDate, endDate]
 * completely immune to local browser or server timezone offsets.
 */
function toCalendarDateString(val: string | Date): string {
  if (typeof val === 'string') {
    return val.split('T')[0].trim();
  }
  const y = val.getFullYear();
  const m = String(val.getMonth() + 1).padStart(2, '0');
  const d = String(val.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCalendarDatesInRange(
  startDateInput: string | Date,
  endDateInput: string | Date
): string[] {
  const startStr = toCalendarDateString(startDateInput);
  const endStr = toCalendarDateString(endDateInput);

  if (!startStr || !endStr || startStr > endStr) return [];

  const [sYear, sMonth, sDay] = startStr.split('-').map(Number);
  const [eYear, eMonth, eDay] = endStr.split('-').map(Number);

  if (isNaN(sYear) || isNaN(sMonth) || isNaN(sDay) || isNaN(eYear) || isNaN(eMonth) || isNaN(eDay)) {
    return [];
  }

  const dates: string[] = [];
  const curr = new Date(Date.UTC(sYear, sMonth - 1, sDay, 0, 0, 0));
  const end = new Date(Date.UTC(eYear, eMonth - 1, eDay, 0, 0, 0));

  while (curr <= end) {
    const y = curr.getUTCFullYear();
    const m = String(curr.getUTCMonth() + 1).padStart(2, '0');
    const d = String(curr.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Safely returns calendar day details in UTC without timezone rollovers.
 */
export function getSafeDateDetails(dateStr: string) {
  const cleanStr = String(dateStr).split('T')[0].trim();
  const [y, m, dNum] = cleanStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, dNum, 12, 0, 0));
  const dayOfWeek = d.getUTCDay();
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday & Saturday in Bahrain
  const dayNameLong = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toUpperCase();
  const dayNameShort = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const dayNameNarrow = d.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' });
  const formattedDate = `${String(dNum).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;

  return {
    year: y,
    month: m,
    dayNum: dNum,
    dayOfWeek,
    isWeekend,
    isFriday: dayOfWeek === 5,
    dayNameLong,
    dayNameShort,
    dayNameNarrow,
    formattedDate
  };
}

export const DEFAULT_SHIFT_WEIGHTS: Record<string, number> = {
  AM: 1.0,
  PM: 1.0,
  NIGHT: 1.25,
  FULL: 1.0,
  weekend_bonus: 0.25
};

/**
 * Builds the authoritative shift configuration map per branch.
 * Non-24h branches default to 2 shifts (AM, PM). 24h branches default to 3 shifts (AM, PM, NIGHT).
 */
export function buildBranchShiftsMap(
  branches: Branch[],
  shiftRequirements: BranchShiftType[] = []
): Map<string, BranchShiftType[]> {
  const branchShiftsMap = new Map<string, BranchShiftType[]>();
  for (const b of branches) {
    const configured = shiftRequirements.filter(sr => sr.branchId === b.id);
    if (configured.length > 0) {
      branchShiftsMap.set(b.id, configured);
    } else {
      if (b.is24Hour) {
        branchShiftsMap.set(b.id, [
          { id: `${b.id}-AM`, branchId: b.id, code: 'AM', name: 'Morning Shift', startTime: '07:00:00', endTime: '15:00:00', staffRequired: 1 },
          { id: `${b.id}-PM`, branchId: b.id, code: 'PM', name: 'Evening Shift', startTime: '15:00:00', endTime: '23:00:00', staffRequired: 1 },
          { id: `${b.id}-NIGHT`, branchId: b.id, code: 'NIGHT', name: 'Night Shift', startTime: '23:00:00', endTime: '07:00:00', staffRequired: 1 }
        ]);
      } else {
        branchShiftsMap.set(b.id, [
          { id: `${b.id}-AM`, branchId: b.id, code: 'AM', name: 'Morning Shift', startTime: '08:00:00', endTime: '16:00:00', staffRequired: 1 },
          { id: `${b.id}-PM`, branchId: b.id, code: 'PM', name: 'Evening Shift', startTime: '16:00:00', endTime: '00:00:00', staffRequired: 1 }
        ]);
      }
    }
  }
  return branchShiftsMap;
}

/**
 * Computes exact required shifts across in-scope dates and active branches.
 * Used by both pre-generation capacity wizard (Step 3) and generation engine for zero drift.
 */
export function computeRequiredCoverage(
  dates: string[],
  branches: Branch[],
  shiftRequirements: BranchShiftType[] = []
): RequiredCoverageSummary {
  const branchShiftsMap = buildBranchShiftsMap(branches, shiftRequirements);
  let totalRequired = 0;
  const byShiftType: { AM: number; PM: number; NIGHT: number; [code: string]: number } = {
    AM: 0,
    PM: 0,
    NIGHT: 0
  };
  let hasNightShifts = false;

  for (const dateStr of dates) {
    for (const branch of branches) {
      if (branch.isActive === false) continue;
      const shifts = branchShiftsMap.get(branch.id) || [];
      for (const shift of shifts) {
        const count = shift.staffRequired || 1;
        totalRequired += count;
        const code = (shift.code || '').toUpperCase();
        if (code === 'NIGHT' || code === 'OVERNIGHT') {
          hasNightShifts = true;
          byShiftType.NIGHT += count;
        } else if (code === 'AM' || code === 'MORNING') {
          byShiftType.AM += count;
        } else if (code === 'PM' || code === 'EVENING') {
          byShiftType.PM += count;
        } else {
          byShiftType[code] = (byShiftType[code] || 0) + count;
        }
      }
    }
  }

  return {
    totalRequired,
    byShiftType,
    hasNightShifts,
    branchShiftsMap
  };
}

/**
 * Computes expected working days for a pharmacist based on their configured work/rest pattern
 * or falls back to the Control Center default assumption if no profile is set.
 */
export function calculatePharmacistExpectedWorkingDays(
  profile: PharmacistSchedulingProfile | undefined,
  availableDays: number,
  totalPeriodDays: number,
  defaultRestDaysPerPeriod: number = 4
): { expectedWorkingDays: number; isUsingDefaultAssumption: boolean; description: string } {
  if (!profile) {
    const proratedRest = Math.max(0, Math.round(defaultRestDaysPerPeriod * (totalPeriodDays / 30)));
    const expected = Math.max(0, availableDays - proratedRest);
    return {
      expectedWorkingDays: expected,
      isUsingDefaultAssumption: true,
      description: `Default Assumption (${defaultRestDaysPerPeriod} rest days/period)`
    };
  }

  const config = profile.workRestConfig || {};

  switch (profile.workRestMode) {
    case 'DAYS_PER_WEEK': {
      const targetDays = Number(config.target_days_per_week ?? config.targetDaysPerWeek ?? 6);
      const workRatio = Math.min(1, Math.max(0, targetDays / 7));
      const expected = Math.round(availableDays * workRatio);
      return {
        expectedWorkingDays: expected,
        isUsingDefaultAssumption: false,
        description: `${targetDays} days/week`
      };
    }
    case 'FIXED_CYCLE': {
      const workDays = Number(config.work_days ?? config.workDays ?? 6);
      const restDays = Number(config.rest_days ?? config.restDays ?? 1);
      const cycleLen = Math.max(1, workDays + restDays);
      const workRatio = workDays / cycleLen;
      const expected = Math.round(availableDays * workRatio);
      return {
        expectedWorkingDays: expected,
        isUsingDefaultAssumption: false,
        description: `${workDays}:${restDays} Fixed Rotation`
      };
    }
    case 'VARIABLE_CYCLE': {
      const rawCycle = config.cycle || [6, 7, 3, 8];
      const cycle: number[] = Array.isArray(rawCycle) && rawCycle.length > 0 ? rawCycle.map(Number) : [6, 7, 3, 8];
      const totalWork = cycle.reduce((a, b) => a + b, 0);
      const totalDays = totalWork + cycle.length;
      const workRatio = totalWork / Math.max(1, totalDays);
      const expected = Math.round(availableDays * workRatio);
      return {
        expectedWorkingDays: expected,
        isUsingDefaultAssumption: false,
        description: `Variable Cycle [${cycle.join(',')}]`
      };
    }
    case 'CUSTOM_CALENDAR': {
      return {
        expectedWorkingDays: Math.round(availableDays * (6 / 7)),
        isUsingDefaultAssumption: false,
        description: 'Custom Calendar'
      };
    }
    case 'DYNAMIC_VARIABLE_CYCLE': {
      const minStreak = Number(config.targetStreakMin || 4);
      const maxStreak = Number(config.targetStreakMax || 6);
      const minRest = Number(config.minRestDaysAfterStreak || 1);
      const avgStreak = (minStreak + maxStreak) / 2;
      const workRatio = avgStreak / Math.max(1, avgStreak + minRest);
      const expected = Math.round(availableDays * workRatio);
      return {
        expectedWorkingDays: expected,
        isUsingDefaultAssumption: false,
        description: `Dynamic Cycle (${minStreak}-${maxStreak}d streak, ${minRest}d rest)`
      };
    }
    default: {
      const proratedRest = Math.max(0, Math.round(defaultRestDaysPerPeriod * (totalPeriodDays / 30)));
      const expected = Math.max(0, availableDays - proratedRest);
      return {
        expectedWorkingDays: expected,
        isUsingDefaultAssumption: false,
        description: 'Standard Rotation'
      };
    }
  }
}

/**
 * Evaluates staffing capacity across all in-scope pharmacists, comparing against required shifts.
 */
export function computePharmacistCapacity(
  dates: string[],
  inScopeStaff: Array<{ id: string; full_name?: string; [key: string]: any }>,
  profiles: PharmacistSchedulingProfile[],
  leaves: DutySchedulerLeaveRecord[],
  requiredCoverage: RequiredCoverageSummary,
  targetZoneId?: string,
  defaultRestDaysPerPeriod: number = 4,
  extraRestDaysAssignment: Record<string, number> = {}
): CapacityCoverageSummary {
  const pharmacistDetails: PharmacistCapacityDetail[] = [];
  const excludedLeavePharmacists: PharmacistCapacityDetail[] = [];
  let availablePharmacistsCount = 0;
  let onLeavePharmacistsCount = 0;
  let totalBaseCapacity = 0;
  let totalAdjustedCapacity = 0;

  for (const staff of inScopeStaff) {
    const profile = profiles.find(p => p.employeeId === staff.id);
    
    // Count leave days in period
    let leaveDays = 0;
    const isEmployeeStatusOnLeave = typeof staff.status === 'string' && (
      staff.status.toLowerCase().includes('leave') || 
      staff.status.toLowerCase().includes('vacation') || 
      staff.status.toLowerCase().includes('holiday')
    );

    for (const dateStr of dates) {
      const hasLeave = isEmployeeStatusOnLeave || leaves.some(l => {
        const leaveEmpId = String(l.employeeId || (l as any).employee_id || '').trim().toLowerCase();
        const staffIds = [
          staff.id,
          staff.employeeId,
          (staff as any).employee_id,
          staff.pharmacist_id,
          staff.code
        ].filter(Boolean).map(x => String(x).trim().toLowerCase());

        if (!staffIds.includes(leaveEmpId)) return false;

        const statusUpper = String(l.status || 'APPROVED').trim().toUpperCase();
        if (statusUpper === 'REJECTED' || statusUpper === 'CANCELLED') return false;

        const sDate = String(l.startDate || (l as any).start_date || '').split('T')[0].trim();
        const eDate = String(l.endDate || (l as any).end_date || '').split('T')[0].trim();
        return sDate <= dateStr && eDate >= dateStr;
      });
      if (hasLeave) leaveDays++;
    }

    // If marked on annual leave, completely remove from Aggregate Planning Check & Pharmacist pool
    if (leaveDays > 0) {
      onLeavePharmacistsCount++;
      excludedLeavePharmacists.push({
        employeeId: staff.id,
        name: staff.full_name || staff.name || `Pharmacist ${staff.id.substring(0, 6)}`,
        roleType: profile ? (profile.roleType || 'FIXED') : 'UNASSIGNED',
        hasProfile: Boolean(profile),
        isUsingDefaultAssumption: false,
        isExcludedOnLeave: true,
        workRestMode: profile?.workRestMode,
        workRestDescription: 'On Annual Leave (Excluded from Pool)',
        leaveDays,
        availableDays: 0,
        expectedWorkingDays: 0,
        extraRestDays: 0,
        netCapacity: 0
      });
      continue;
    }

    availablePharmacistsCount++;
    const availableDays = dates.length;

    const calc = calculatePharmacistExpectedWorkingDays(
      profile,
      availableDays,
      dates.length,
      defaultRestDaysPerPeriod
    );

    let expectedWorking = calc.expectedWorkingDays;

    // Secondary Zone Quota check
    if (profile && targetZoneId && profile.secondaryZoneId === targetZoneId && (profile.secondaryZoneMaxDays || 0) > 0) {
      expectedWorking = Math.min(expectedWorking, profile.secondaryZoneMaxDays || 0);
    }

    const extraRest = extraRestDaysAssignment[staff.id] || 0;
    const netCap = Math.max(0, expectedWorking - extraRest);

    totalBaseCapacity += expectedWorking;
    totalAdjustedCapacity += netCap;

    pharmacistDetails.push({
      employeeId: staff.id,
      name: staff.full_name || staff.name || `Pharmacist ${staff.id.substring(0, 6)}`,
      roleType: profile ? (profile.roleType || 'FIXED') : 'UNASSIGNED',
      hasProfile: Boolean(profile),
      isUsingDefaultAssumption: calc.isUsingDefaultAssumption,
      isExcludedOnLeave: false,
      workRestMode: profile?.workRestMode,
      workRestDescription: calc.description,
      leaveDays: 0,
      availableDays,
      expectedWorkingDays: expectedWorking,
      extraRestDays: extraRest,
      netCapacity: netCap
    });
  }

  const balance = totalAdjustedCapacity - requiredCoverage.totalRequired;

  return {
    requiredCoverage,
    totalPharmacistsInScope: availablePharmacistsCount, // Active available pharmacists in pool
    availablePharmacistsCount,
    onLeavePharmacistsCount,
    totalBaseCapacity,
    totalAdjustedCapacity,
    balance,
    isSurplus: balance > 0,
    isDeficit: balance < 0,
    surplusCount: Math.max(0, balance),
    deficitCount: Math.max(0, -balance),
    pharmacistDetails,
    excludedLeavePharmacists
  };
}



/**
 * Core Automated Scheduling Engine (Spec v1.0)
 * Pure, deterministic, multi-shift constraint solver.
 */
export function generateSchedule(input: SchedulingInput): SchedulingOutput {
  const { 
    scheduleId, 
    targetZoneId,
    startDate, 
    endDate, 
    profiles = [], 
    leaves = [], 
    previousRollingState = [], 
    branches = [], 
    shiftRequirements = [],
    lockedAssignments = [],
    shiftWeights = DEFAULT_SHIFT_WEIGHTS,
    periodAdjustments,
    globalMaxConsecutiveDays = 8
  } = input;

  const assignments: DutyScheduleAssignment[] = [];
  const conflicts: DutyScheduleConflict[] = [];
  const newRollingState: PharmacistRollingState[] = [];

  // 1. Generate date range in YYYY-MM-DD
  const dates: string[] = getCalendarDatesInRange(startDate, endDate);

  const getEmpLabel = (empId: string) => {
    const emp = input.employees?.find((e: any) => String(e.id).toLowerCase() === String(empId).toLowerCase());
    if (!emp) return empId;
    const clean = (emp.full_name || emp.name || 'Pharmacist').replace(/^dr[\.\s]+/i, '').trim().toUpperCase();
    const codePart = emp.code ? ` (${emp.code})` : '';
    return `DR. ${clean}${codePart}`;
  };

  // 2. Initialize rolling state map for every active profile (Spec §16.1, §16.3)
  const stateMap = new Map<string, RollingPharmacistState>();
  for (const p of profiles) {
    const prev = previousRollingState.find(s => s.employeeId === p.employeeId);
    stateMap.set(p.employeeId, {
      employeeId: p.employeeId,
      currentConsecutiveWorkingDays: prev?.currentConsecutiveWorkingDays ?? prev?.consecutiveWorkingDays ?? 0,
      currentConsecutiveRestDays: prev?.currentConsecutiveRestDays ?? 0,
      currentPatternCycleIndex: prev?.currentPatternCycleIndex ?? 0,
      lastShiftEndDatetime: prev?.lastShiftEndDatetime ?? prev?.lastShiftEndTime ?? null,
      lastShiftType: prev?.lastShiftType ?? null,
      lastBranchId: prev?.lastBranchId ?? null,
      totalWorkloadScore: Number(prev?.totalWorkloadScore ?? prev?.workloadScore ?? 0),
      recentWorkloadScore: Number(prev?.recentWorkloadScore ?? 0),
      weekendAssignmentCount: prev?.weekendAssignmentCount ?? 0,
      weeklyWorkingDaysAssigned: 0
    });
  }

  // Pre-index locked assignments: [date][branchId][shiftCode] and [date][employeeId]
  const lockedBySlot = new Map<string, DutyScheduleAssignment[]>();
  const lockedEmployeesByDate = new Map<string, Set<string>>();
  const assignmentsCountByEmployee = new Map<string, number>();

  for (const la of lockedAssignments) {
    const slotKey = `${la.date}_${la.branchId}_${la.shiftCode.toUpperCase()}`;
    if (!lockedBySlot.has(slotKey)) lockedBySlot.set(slotKey, []);
    lockedBySlot.get(slotKey)!.push(la);

    if (!lockedEmployeesByDate.has(la.date)) {
      lockedEmployeesByDate.set(la.date, new Set());
    }
    lockedEmployeesByDate.get(la.date)!.add(la.employeeId);

    assignmentsCountByEmployee.set(
      la.employeeId,
      (assignmentsCountByEmployee.get(la.employeeId) || 0) + 1
    );

    // Locked assignments are carried forward unchanged (BR-16, Spec §21)
    assignments.push(la);
  }

  // Combine caller leaves with verified wizard periodAdjustment leave records
  const effectiveLeaves = [...leaves];
  if (periodAdjustments?.leaveRecords && periodAdjustments.leaveRecords.length > 0) {
    for (const lr of periodAdjustments.leaveRecords) {
      const lrId = String(lr.employeeId || (lr as any).employee_id || '').trim().toLowerCase();
      const lrStart = String(lr.startDate || (lr as any).start_date || '').split('T')[0].trim();
      if (!effectiveLeaves.some(l => {
        const lId = String(l.employeeId || (l as any).employee_id || '').trim().toLowerCase();
        const lStart = String(l.startDate || (l as any).start_date || '').split('T')[0].trim();
        return lId === lrId && lStart === lrStart;
      })) {
        effectiveLeaves.push(lr);
      }
    }
  }

  // Helper: check approved leave on a given date (Spec §11)
  const isEmployeeOnLeave = (empId: string, dateStr: string) => {
    const targetEmpId = String(empId).trim().toLowerCase();
    return effectiveLeaves.some(l => {
      const leaveEmpId = String(l.employeeId || (l as any).employee_id || '').trim().toLowerCase();
      if (leaveEmpId !== targetEmpId) return false;
      const statusUpper = String(l.status || 'APPROVED').trim().toUpperCase();
      if (statusUpper === 'REJECTED' || statusUpper === 'CANCELLED') return false;
      const sDate = String(l.startDate || (l as any).start_date || '').split('T')[0].trim();
      const eDate = String(l.endDate || (l as any).end_date || '').split('T')[0].trim();
      return sDate <= dateStr && eDate >= dateStr;
    });
  };

  // Helper: check effective date bounds (Spec §34.1, §34.2)
  const isProfileEffectiveOnDate = (p: PharmacistSchedulingProfile, dateStr: string) => {
    if (!p.isActive) return false;
    if (p.effectiveFrom && p.effectiveFrom > dateStr) return false;
    if (p.effectiveTo && p.effectiveTo < dateStr) return false;
    return true;
  };

  // Helper: map special requested off-days per employee (Spec: Special Request for Employee)
  const specialRestDaysMap = new Map<string, Set<string>>();
  if (periodAdjustments?.specialRestRequests && periodAdjustments.specialRestRequests.length > 0) {
    for (const req of periodAdjustments.specialRestRequests) {
      const empId = String(req.employeeId).trim().toLowerCase();
      if (!specialRestDaysMap.has(empId)) {
        specialRestDaysMap.set(empId, new Set());
      }
      for (const d of req.dates || []) {
        specialRestDaysMap.get(empId)!.add(d.split('T')[0].trim());
      }
    }
  }

  const isEmployeeOnSpecialRest = (empId: string, dateStr: string) => {
    const targetEmpId = String(empId).trim().toLowerCase();
    return specialRestDaysMap.get(targetEmpId)?.has(dateStr) ?? false;
  };

  // 1a. Week Indexing for Special Rest Requests (Rule 1):
  // When an employee requests a specific date off, that off-day is counted from their weekly rest quota,
  // so they do not take a redundant 2nd rest day in the same week, preserving target working days.
  const getWeekStartDateStr = (dateStr: string): string => {
    const [y, m, dNum] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, dNum, 12, 0, 0));
    const dayOfWeek = d.getUTCDay(); // 0 = Sun, ..., 6 = Sat
    d.setUTCDate(d.getUTCDate() - dayOfWeek);
    const wy = d.getUTCFullYear();
    const wm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const wd = String(d.getUTCDate()).padStart(2, '0');
    return `${wy}-${wm}-${wd}`;
  };

  const employeeSpecialRestWeeks = new Map<string, Set<string>>();
  for (const [empId, datesSet] of specialRestDaysMap.entries()) {
    const weeksSet = new Set<string>();
    for (const d of datesSet) {
      weeksSet.add(getWeekStartDateStr(d));
    }
    employeeSpecialRestWeeks.set(empId, weeksSet);
  }

  const hasSpecialRestInWeek = (empId: string, dateStr: string): boolean => {
    const targetEmpId = String(empId).trim().toLowerCase();
    const weekStart = getWeekStartDateStr(dateStr);
    return employeeSpecialRestWeeks.get(targetEmpId)?.has(weekStart) ?? false;
  };

  // 1b. Surplus Capacity Absorption Hard-Cap Map (Rule 2):
  // When surplus capacity is assigned to a pharmacist in Step 4 (e.g. 10 extra rest days),
  // their working shifts are hard-capped at max(0, expectedWorkingDays - extraRestDays),
  // so total off-days strictly equal baseRestDays + extraRestDays (e.g. 4 base + 10 extra = 14 off-days).
  const pharmacistShiftCapMap = new Map<string, number>();
  if (periodAdjustments?.extraRestDays) {
    for (const p of profiles) {
      const extraRest = periodAdjustments.extraRestDays[p.employeeId] || 0;
      if (extraRest > 0) {
        let leaveDays = 0;
        for (const d of dates) {
          if (isEmployeeOnLeave(p.employeeId, d)) {
            leaveDays++;
          }
        }
        const availableDays = Math.max(0, dates.length - leaveDays);
        const calc = calculatePharmacistExpectedWorkingDays(p, availableDays, dates.length);
        const netCap = Math.max(0, calc.expectedWorkingDays - extraRest);
        pharmacistShiftCapMap.set(p.employeeId, netCap);
      }
    }
  }

  // 1c. Alternating Weekend Rest Rotation (Rule 3):
  // For the team of 3-5 pharmacists selected in Step 5 across the month's weekend days (Fridays and Saturdays),
  // rest days strictly alternate weekly: whoever takes Friday off in Week 1 takes Saturday off in Week 2, and vice versa.
  interface WeekendDayInfo {
    weekendIndex: number;
    isFriday: boolean;
    isSaturday: boolean;
  }
  const weekendDateInfoMap = new Map<string, WeekendDayInfo>();
  let currentWeekendIndex = 0;
  let lastSeenWeekendDay: number | null = null; // 5 for Fri, 6 for Sat

  for (let i = 0; i < dates.length; i++) {
    const dStr = dates[i];
    const dObj = new Date(dStr + 'T00:00:00Z');
    const dow = dObj.getUTCDay(); // 5 = Fri, 6 = Sat

    if (dow === 5) {
      if (lastSeenWeekendDay !== null) {
        currentWeekendIndex++;
      }
      weekendDateInfoMap.set(dStr, {
        weekendIndex: currentWeekendIndex,
        isFriday: true,
        isSaturday: false
      });
      lastSeenWeekendDay = 5;
    } else if (dow === 6) {
      weekendDateInfoMap.set(dStr, {
        weekendIndex: currentWeekendIndex,
        isFriday: false,
        isSaturday: true
      });
      lastSeenWeekendDay = 6;
    }
  }

  const getWeekendDesignation = (empId: string, weekendIndex: number): 'FRIDAY_OFF' | 'SATURDAY_OFF' | null => {
    if (!periodAdjustments?.weekendPharmacistIds || periodAdjustments.weekendPharmacistIds.length === 0) {
      return null;
    }
    const targetId = String(empId).trim().toLowerCase();
    const idx = periodAdjustments.weekendPharmacistIds.findIndex(id => String(id).trim().toLowerCase() === targetId);
    if (idx === -1) return null;
    return (idx + weekendIndex) % 2 === 0 ? 'FRIDAY_OFF' : 'SATURDAY_OFF';
  };

  // Build branch shift configuration lookup using shared zero-drift computeRequiredCoverage
  const coverage = computeRequiredCoverage(dates, branches, shiftRequirements);
  const branchShiftsMap = coverage.branchShiftsMap;

  // 3. Process Day by Day
  for (const dateStr of dates) {
    const dateObj = new Date(dateStr + 'T00:00:00Z');
    const dayOfWeek = dateObj.getUTCDay(); // 0 = Sun, ..., 5 = Fri, 6 = Sat
    const isWeekend = dayOfWeek === 5; // Friday in Bahrain
    const isWeekendDay = dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday

    // Reset weekly counters on start of calendar week (Sunday = 0)
    if (dayOfWeek === 0) {
      for (const state of stateMap.values()) {
        state.weeklyWorkingDaysAssigned = 0;
      }
    }

    // Set of employees assigned on this date across all branches
    const assignedEmployeesToday = new Set<string>(lockedEmployeesByDate.get(dateStr) || []);

    // Active profiles on this date
    const activeProfiles = profiles.filter(p => isProfileEffectiveOnDate(p, dateStr));

    // For every branch and every configured shift slot
    for (const branch of branches) {
      if (branch.isActive === false) continue; // Skip closed branches (Spec §34.6)

      const requiredShifts = branchShiftsMap.get(branch.id) || [];

      for (const shift of requiredShifts) {
        const slotKey = `${dateStr}_${branch.id}_${shift.code.toUpperCase()}`;
        const lockedInSlot = lockedBySlot.get(slotKey) || [];
        const neededCount = Math.max(0, (shift.staffRequired || 1) - lockedInSlot.length);

        const shiftWindow = calculateShiftDatetimes(dateStr, shift);
        const shiftCategory = categorizeShift(shift);
        const shiftWeight = (shiftWeights[shiftCategory] || 1.0) + (isWeekend ? (shiftWeights.weekend_bonus || 0.25) : 0);

        for (let slotIndex = 0; slotIndex < neededCount; slotIndex++) {
          // Find candidates among active profiles
          interface CandidateScore {
            profile: PharmacistSchedulingProfile;
            state: RollingPharmacistState;
            patternResult: PatternEvaluationResult;
            priorityScore: number;
            workloadScoreDelta: number;
          }

          const candidates: CandidateScore[] = [];

          for (const profile of activeProfiles) {
            // A. Already assigned today? (Hard constraint §13 #6)
            if (assignedEmployeesToday.has(profile.employeeId)) continue;

            // B. On approved annual leave? (Hard constraint §13 #1)
            if (isEmployeeOnLeave(profile.employeeId, dateStr)) continue;

            // B2. Special Requested Weekly Rest Day? (Special Request for Employee)
            if (isEmployeeOnSpecialRest(profile.employeeId, dateStr)) continue;

            // C. Branch eligibility? (Hard constraint §13 #3, #4)
            if (profile.roleType === 'FIXED') {
              // Fixed pharmacists belong to primary branch
              if (profile.primaryBranchId && profile.primaryBranchId !== branch.id) {
                continue; // Cannot auto-move away from primary branch (BR-7)
              }
            } else {
              // Relief pharmacist: must be in allowedBranchIds pool (BR-10, §8)
              if (profile.allowedBranchIds && profile.allowedBranchIds.length > 0) {
                if (!profile.allowedBranchIds.includes(branch.id)) continue;
              }
            }

            // D. Shift eligibility? (Hard constraint §13 #5)
            if (!isShiftAllowedForPharmacist(profile, shift)) continue;

            // E. Minimum rest hours check (Hard constraint §13 #7, Spec §10.3)
            const pState = stateMap.get(profile.employeeId)!;
            const minRest = profile.minimumRestHours || 11.0;
            const restValidation = validateMinimumRest(pState.lastShiftEndDatetime, shiftWindow.startDatetime, minRest);
            if (!restValidation.isValid) {
              continue; // Insufficient rest between shifts!
            }

            // E2. H1 Ceiling check (Hard constraint):
            const effectiveMax = resolveEffectiveMaxConsecutiveDays(profile, globalMaxConsecutiveDays);
            if (pState.currentConsecutiveWorkingDays + 1 > effectiveMax) {
              continue; // Exceeds consecutive working days ceiling!
            }

            // F. Work/Rest Pattern check (Spec §6)
            const hasSpecialRestThisWeek = hasSpecialRestInWeek(profile.employeeId, dateStr);
            const patternResult = evaluateWorkRestPattern(
              profile, 
              pState, 
              dateStr, 
              dayOfWeek, 
              pState.weeklyWorkingDaysAssigned || 0,
              hasSpecialRestThisWeek
            );

            // If pattern requires rest and it's a HARD constraint, reject candidate
            if (patternResult.decision === 'MUST_REST' && patternResult.isHardConstraint) {
              continue;
            }

            // G. Multi-Zone Quota Check: If candidate is Secondary in this target zone, enforce quota
            const isSecondaryInZone = Boolean(targetZoneId && profile.secondaryZoneId === targetZoneId);
            if (isSecondaryInZone) {
              const currentAssignedDays = assignmentsCountByEmployee.get(profile.employeeId) || 0;
              const maxAllowedDays = profile.secondaryZoneMaxDays || 0;
              if (currentAssignedDays >= maxAllowedDays) {
                continue; // Hard constraint: Secondary quota reached!
              }
            }

            // G2. Surplus Capacity Hard Cap (Rule 2):
            // When extra rest days are assigned to absorb surplus, working shifts are strictly capped!
            const shiftCap = pharmacistShiftCapMap.get(profile.employeeId);
            const currentAssignedDays = assignmentsCountByEmployee.get(profile.employeeId) || 0;
            if (shiftCap !== undefined && currentAssignedDays >= shiftCap) {
              continue; // Hard cap reached! Off-days strictly preserved.
            }

            // G3. Alternating Weekend Rest Rotation (Rule 3):
            // Strictly enforce weekly alternation between Friday and Saturday off-days for the weekend team.
            const weekendInfo = weekendDateInfoMap.get(dateStr);
            let weekendBonus = 0;
            if (weekendInfo && periodAdjustments?.weekendPharmacistIds && periodAdjustments.weekendPharmacistIds.length > 0) {
              const designation = getWeekendDesignation(profile.employeeId, weekendInfo.weekendIndex);
              if (designation === 'FRIDAY_OFF' && weekendInfo.isFriday) {
                // Strictly reserve designated Friday off
                continue;
              } else if (designation === 'SATURDAY_OFF' && weekendInfo.isSaturday) {
                // Strictly reserve designated Saturday off
                continue;
              } else if (designation === 'FRIDAY_OFF' && weekendInfo.isSaturday) {
                // Alternating rotation: rested Friday, covers Saturday with high priority
                weekendBonus += 650;
              } else if (designation === 'SATURDAY_OFF' && weekendInfo.isFriday) {
                // Alternating rotation: covers Friday with high priority, will rest Saturday
                weekendBonus += 650;
              } else if (designation === null) {
                // Pharmacists outside the weekend rest team cover weekend duties
                weekendBonus += 250;
              }
            }

            // Candidate is legally eligible! Compute scoring for optimizer pass:
            let priorityScore = 0;

            // 1. Primary role alignment
            if (profile.roleType === 'FIXED' && profile.primaryBranchId === branch.id) {
              priorityScore += 1000;
            } else if (profile.roleType === 'RELIEF') {
              priorityScore += 550;
            }

            // 1b. Anti-Sandwich & Work Streak Momentum:
            // Crucial: Once a pharmacist starts working, they must continue working a healthy streak (3-5 days).
            // NEVER penalize working day 2, because doing so creates an isolated 1-day work sandwich
            // ([OFF] -> [WORK 1 DAY] -> [OFF]), which is forbidden in scheduling.
            const consecWork = pState.currentConsecutiveWorkingDays || 0;
            const consecRest = pState.currentConsecutiveRestDays || 0;

            if (consecWork === 1) {
              // Pharmacist worked yesterday! Strong continuation bonus to prevent isolated 1-day sandwich shift
              priorityScore += 450;
            } else if (consecWork >= 2 && consecWork <= 4) {
              // Healthy streak continuation (days 3, 4, 5)
              priorityScore += 300 - (consecWork - 2) * 50;
            } else if (consecWork === 5) {
              // Neutral: healthy 5-day streak completed, eligible for weekly rest if coverage allows
              priorityScore += 50;
            } else if (consecWork >= 6) {
              // Approaching ceiling: stagger penalty so relief or rested colleague can rotate in
              const overCeiling = consecWork - 5;
              priorityScore -= overCeiling * 150;
            }

            // 1c. Rest Day Clustering: Group Off-Days Consecutively (Off-days must be back-to-back):
            // If a pharmacist took an off-day yesterday (consecRest === 1), and their profile or surplus indicates
            // 2 rest days per week (e.g. 5 days work/week, or extra rest days assigned), prefer keeping them on rest
            // for a second consecutive day so their off-days are grouped together (e.g. Mon+Tue off).
            if (consecRest === 1) {
              const config = profile.workRestConfig || {};
              const targetDays = Number(config.target_days_per_week ?? config.targetDaysPerWeek ?? 6);
              const hasExtraRest = Boolean(periodAdjustments?.extraRestDays && (periodAdjustments.extraRestDays[profile.employeeId] || 0) > 0);

              if (targetDays <= 5 || hasExtraRest) {
                // Encourage completing 2 consecutive off-days (e.g. Mon+Tue off) rather than working an isolated day
                priorityScore -= 350;
              }
            } else if (consecRest >= 2) {
              // After 2 consecutive off-days, rest cluster is complete: return to work on fresh streak
              priorityScore += 250;
            }

            // Secondary support candidate priority: lower baseline score so primary pharmacists
            // take base schedule and secondary is utilized for gap coverage up to quota
            if (isSecondaryInZone) {
              priorityScore -= 400;
            }

            // 2. Pattern desire
            if (patternResult.decision === 'MUST_WORK') priorityScore += 300;
            else if (patternResult.decision === 'PREFER_WORK') priorityScore += 150;
            else if (patternResult.decision === 'PREFER_REST') priorityScore -= 200; // Soft rest request

            // 3. Branch continuity (§14 #6)
            if (pState.lastBranchId === branch.id) priorityScore += 50;

            // 4. Workload fairness (§15): lower current workload score gets higher priority
            const workloadScoreDelta = pState.totalWorkloadScore;
            priorityScore -= workloadScoreDelta * 5;

            // 5. Weekend Rest & Off-Day Distribution (Step 5 Alternating Rotation)
            priorityScore += weekendBonus;

            // 6. Surplus Extra Rest Days Soft Workload Cap (Step 3)
            if (periodAdjustments?.extraRestDays && (periodAdjustments.extraRestDays[profile.employeeId] || 0) > 0) {
              const extraRest = periodAdjustments.extraRestDays[profile.employeeId];
              priorityScore -= extraRest * 25;
            }

            candidates.push({
              profile,
              state: pState,
              patternResult,
              priorityScore,
              workloadScoreDelta
            });
          }

          if (candidates.length > 0) {
            // Sort by priorityScore descending
            candidates.sort((a, b) => b.priorityScore - a.priorityScore);
            const chosen = candidates[0];

            // If chosen had a soft rest preference, log a Pattern Deviation (Spec §14.2)
            if (chosen.patternResult.decision === 'PREFER_REST' || chosen.patternResult.decision === 'MUST_REST') {
              conflicts.push({
                id: crypto.randomUUID(),
                scheduleId,
                employeeId: chosen.profile.employeeId,
                branchId: branch.id,
                date: dateStr,
                conflictType: 'PATTERN_DEVIATION',
                severity: 'SOFT',
                description: `Pattern deviation for pharmacist **${getEmpLabel(chosen.profile.employeeId)}**: ${chosen.patternResult.reason}. Assigned to ${branch.name || branch.id} (${shift.code}) to maintain required coverage.`,
                createdAt: new Date().toISOString()
              });
            }

            // If chosen on weekend was inside manager's designated weekend rest team, log deviation (§14.2)
            if (isWeekendDay && periodAdjustments?.weekendPharmacistIds && periodAdjustments.weekendPharmacistIds.length > 0) {
              if (periodAdjustments.weekendPharmacistIds.includes(chosen.profile.employeeId)) {
                conflicts.push({
                  id: crypto.randomUUID(),
                  scheduleId,
                  employeeId: chosen.profile.employeeId,
                  branchId: branch.id,
                  date: dateStr,
                  conflictType: 'PATTERN_DEVIATION',
                  severity: 'SOFT',
                  description: `Weekend rest distribution deviation: Pharmacist **${getEmpLabel(chosen.profile.employeeId)}** from the weekend rest team was assigned to weekend shift (${shift.code}) to maintain zero-gap coverage (insufficient alternative staff).`,
                  createdAt: new Date().toISOString()
                });
              }
            }

            // Create assignment
            assignments.push({
              id: crypto.randomUUID(),
              scheduleId,
              employeeId: chosen.profile.employeeId,
              branchId: branch.id,
              date: dateStr,
              shiftCode: shift.code,
              isLocked: false,
              isRelief: chosen.profile.roleType === 'RELIEF',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });

            assignedEmployeesToday.add(chosen.profile.employeeId);
            assignmentsCountByEmployee.set(
              chosen.profile.employeeId,
              (assignmentsCountByEmployee.get(chosen.profile.employeeId) || 0) + 1
            );

            // Advance rolling state
            const nextState = advanceRollingState(
              chosen.profile,
              chosen.state,
              true,
              shift.code,
              branch.id,
              shiftWindow.endDatetime
            );
            nextState.totalWorkloadScore += shiftWeight;
            if (isWeekend) nextState.weekendAssignmentCount += 1;
            stateMap.set(chosen.profile.employeeId, nextState);
          } else {
            // =================================================================
            // ZERO-GAP EMERGENCY FALLBACK PASS (§Acceptance Criteria: Zero Gaps)
            // No pending / unfilled shifts permitted in this module.
            // Progressively relax constraints to fill every configured shift.
            // =================================================================
            const emergencyCandidates: Array<{
              profile: PharmacistSchedulingProfile;
              state: RollingPharmacistState;
              penalty: number;
              reasons: string[];
            }> = [];

            for (const profile of activeProfiles) {
              // Rule 1: Pharmacist must NOT be on approved leave today
              if (isEmployeeOnLeave(profile.employeeId, dateStr)) continue;

              // Rule 2: Pharmacist must NOT already be assigned to a shift on this date
              if (assignedEmployeesToday.has(profile.employeeId)) continue;

              // Rule 3: Pharmacist must be qualified for this shift category
              if (!isShiftAllowedForPharmacist(profile, shift)) continue;

              const pState = stateMap.get(profile.employeeId)!;

              // Rule 4: Absolute biological rest limit: minimum 8 hours gap
              const emergencyRestVal = validateMinimumRest(pState.lastShiftEndDatetime, shiftWindow.startDatetime, 8.0);
              if (!emergencyRestVal.isValid) continue;
              let penalty = 0;
              const reasons: string[] = [];

              // Check branch eligibility
              const isAllowedBranch = profile.roleType === 'RELIEF'
                ? (!profile.allowedBranchIds || profile.allowedBranchIds.length === 0 || profile.allowedBranchIds.includes(branch.id))
                : (profile.primaryBranchId === branch.id);

              if (!isAllowedBranch) {
                penalty += 100;
                reasons.push('Branch eligibility waiver');
              }

              // Check minimum rest
              const minRest = profile.minimumRestHours || 11.0;
              const restVal = validateMinimumRest(pState.lastShiftEndDatetime, shiftWindow.startDatetime, minRest);
              if (!restVal.isValid) {
                penalty += 300;
                reasons.push(`Rest gap reduced (${(restVal.gapHours ?? 0).toFixed(1)}h < ${minRest}h)`);
              }

              // Check consecutive days ceiling
              const effectiveMax = resolveEffectiveMaxConsecutiveDays(profile, globalMaxConsecutiveDays);
              if (pState.currentConsecutiveWorkingDays + 1 > effectiveMax) {
                penalty += 200;
                reasons.push(`Consecutive days ceiling extended (${pState.currentConsecutiveWorkingDays + 1}d > ${effectiveMax}d)`);
              }

              // Check pattern
              const hasSpecialRestThisWeekEmergency = hasSpecialRestInWeek(profile.employeeId, dateStr);
              const patRes = evaluateWorkRestPattern(
                profile, 
                pState, 
                dateStr, 
                dayOfWeek, 
                pState.weeklyWorkingDaysAssigned || 0,
                hasSpecialRestThisWeekEmergency
              );
              if (patRes.decision === 'MUST_REST') {
                penalty += 150;
                reasons.push('Pattern rest day waived');
              } else if (patRes.decision === 'PREFER_REST') {
                penalty += 50;
                reasons.push('Soft rest preference waived');
              }

              // Special requested weekly off-day protection (heavily penalize so others are used first)
              if (isEmployeeOnSpecialRest(profile.employeeId, dateStr)) {
                penalty += 10000;
                reasons.push('Special off-day request waived for emergency coverage');
              }

              // Surplus capacity hard cap protection in emergency fallback (Rule 2)
              const fallbackShiftCap = pharmacistShiftCapMap.get(profile.employeeId);
              const currentAssignedFallback = assignmentsCountByEmployee.get(profile.employeeId) || 0;
              if (fallbackShiftCap !== undefined && currentAssignedFallback >= fallbackShiftCap) {
                penalty += 5000;
                reasons.push(`Surplus capacity cap exceeded (${currentAssignedFallback}/${fallbackShiftCap})`);
              }

              // Alternating weekend rest day protection in emergency fallback (Rule 3)
              const fallbackWeekendInfo = weekendDateInfoMap.get(dateStr);
              if (fallbackWeekendInfo && periodAdjustments?.weekendPharmacistIds && periodAdjustments.weekendPharmacistIds.length > 0) {
                const des = getWeekendDesignation(profile.employeeId, fallbackWeekendInfo.weekendIndex);
                if ((des === 'FRIDAY_OFF' && fallbackWeekendInfo.isFriday) || (des === 'SATURDAY_OFF' && fallbackWeekendInfo.isSaturday)) {
                  penalty += 3500;
                  reasons.push('Designated alternating weekend rest day waived for emergency coverage');
                }
              }

              // Fairness tie-breaker: pharmacists with fewer total assignments take priority
              const currentTotalAss = assignmentsCountByEmployee.get(profile.employeeId) || 0;
              penalty += currentTotalAss * 5;

              // Relief pharmacists preferred for emergency gap coverage
              if (profile.roleType === 'RELIEF') {
                penalty -= 40;
              } else if (profile.primaryBranchId === branch.id) {
                penalty -= 20;
              }

              emergencyCandidates.push({ profile, state: pState, penalty, reasons });
            }

            if (emergencyCandidates.length > 0) {
              emergencyCandidates.sort((a, b) => a.penalty - b.penalty);
              const fallback = emergencyCandidates[0];

              // Assign shift to guarantee zero unfilled shifts!
              assignments.push({
                id: crypto.randomUUID(),
                scheduleId,
                employeeId: fallback.profile.employeeId,
                branchId: branch.id,
                date: dateStr,
                shiftCode: shift.code,
                isLocked: false,
                isRelief: fallback.profile.roleType === 'RELIEF',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });

              assignedEmployeesToday.add(fallback.profile.employeeId);
              assignmentsCountByEmployee.set(
                fallback.profile.employeeId,
                (assignmentsCountByEmployee.get(fallback.profile.employeeId) || 0) + 1
              );

              // Advance rolling state
              const nextState = advanceRollingState(
                fallback.profile,
                fallback.state,
                true,
                shift.code,
                branch.id,
                shiftWindow.endDatetime
              );
              nextState.totalWorkloadScore += shiftWeight;
              if (isWeekend) nextState.weekendAssignmentCount += 1;
              stateMap.set(fallback.profile.employeeId, nextState);

              // Log soft emergency gap coverage conflict
              conflicts.push({
                id: crypto.randomUUID(),
                scheduleId,
                employeeId: fallback.profile.employeeId,
                branchId: branch.id,
                date: dateStr,
                conflictType: 'EMERGENCY_GAP_COVERAGE',
                severity: 'SOFT',
                description: `Zero-gap coverage enforced: Shift ${shift.name || shift.code} at ${branch.name || branch.code} on ${dateStr} was filled by pharmacist **${getEmpLabel(fallback.profile.employeeId)}** to guarantee zero unfilled shifts (${fallback.reasons.join(', ')}).`,
                createdAt: new Date().toISOString()
              });
            } else {
              // Truly 0 staff available (all on approved annual leave or already assigned)
              conflicts.push({
                id: crypto.randomUUID(),
                scheduleId,
                branchId: branch.id,
                date: dateStr,
                conflictType: 'UNSATISFIABLE_COVERAGE',
                severity: 'HARD',
                description: `Schedule cannot be fully generated. Branch: ${branch.name || branch.code}, Date: ${dateStr}, Shift: ${shift.name || shift.code}. Required: ${shift.staffRequired || 1}, Eligible: 0. Reason: All active pharmacists are on approved annual leave or already assigned on this date.`,
                createdAt: new Date().toISOString()
              });
            }
          }
        }
      }
    }

    // Advance rolling state for all active unassigned pharmacists on this date to REST
    for (const profile of activeProfiles) {
      if (!assignedEmployeesToday.has(profile.employeeId)) {
        const pState = stateMap.get(profile.employeeId)!;
        const nextState = advanceRollingState(profile, pState, false);
        stateMap.set(profile.employeeId, nextState);
      }
    }
  }

  // 4. Schedule Smoothing & Rest Day Clustering Pass:
  // Eliminates any isolated single work days ([REST] -> [1 DAY WORK] -> [REST]) and groups off-days
  // into consecutive pairs (e.g. 2 days off back-to-back), fulfilling the operational requirement.
  const smoothed = smoothScheduleAndGroupRestDays({
    assignments,
    dates,
    profiles,
    branches,
    shiftRequirements,
    leaves: effectiveLeaves,
    specialRestDaysMap,
    previousRollingState,
    globalMaxConsecutiveDays,
    pharmacistShiftCapMap,
    periodAdjustments,
    weekendDateInfoMap
  });

  return {
    assignments: smoothed.assignments,
    conflicts,
    newRollingState: smoothed.newRollingState
  };
}

export const schedulingEngine = {
  generateSchedule,
  computeRequiredCoverage,
  computePharmacistCapacity,
  calculatePharmacistExpectedWorkingDays,
  buildBranchShiftsMap
};

export default schedulingEngine;
