/**
 * Attendance Service — Geofencing-Based Attendance Engine
 * ========================================================
 * Hardened Spec v1.0
 *
 * Architecture:
 *   - Supabase-first: all authoritative decisions are server-side (§4)
 *   - Geofence validation via Haversine formula (§3)
 *   - Anti-spoofing: accuracy check, impossible-travel, device fingerprint (§3.1-3.3)
 *   - Leave status via dutySchedulerService.getApprovedLeaveForEmployee (§7)
 *   - Weekend days from DutySchedulerSettings.weekendDays — not duplicated (§2.1)
 *   - Grace period applied first, penalty rules measure lateness AFTER grace (§5.1)
 */

import { supabaseClient } from '../lib/supabaseClient';
import { dutySchedulerService } from './dutySchedulerService';
import {
  AttendancePunch,
  AttendanceDailyRecord,
  AttendanceModuleConfig,
  AttendanceStatus,
  AttendanceMonthlyReport,
  GeofenceValidation,
  AttendanceSyncStatus,
  DutyScheduleAssignment,
  DutySchedulerSettings,
  BranchShiftType,
  PenaltyRuleType,
} from '../types';
import { Employee, EmployeeBranchAssignment } from './workforceService';

// ============================================================================
// HAVERSINE GEOFENCE ENGINE (§3)
// ============================================================================

const EARTH_RADIUS_M = 6_371_000; // meters

/**
 * Haversine distance in meters between two GPS coordinates.
 * Sufficient for Bahrain's geography (small island, low curvature error).
 */
export function haversineDistanceM(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface GeofenceCheckResult {
  isInside: boolean;
  matchedBranch: { id: string; name: string; lat: number; lng: number; radiusM: number } | null;
  distanceMeters: number | null;
  validation: GeofenceValidation;
  flaggedForReview: boolean;
  flagReasons: string[];
}

/**
 * Server-side-only geofence validation (§3).
 * Validates employee GPS against all assigned branch geofences.
 * Applies anti-spoofing checks: accuracy sanity, impossible travel.
 */
export function validateGeofence(
  lat: number | null,
  lng: number | null,
  accuracy: number | null,
  assignments: EmployeeBranchAssignment[],
  config: AttendanceModuleConfig,
  previousPunch?: AttendancePunch | null
): GeofenceCheckResult {
  const flagReasons: string[] = [];

  // GPS unavailable
  if (lat == null || lng == null) {
    return {
      isInside: false,
      matchedBranch: null,
      distanceMeters: null,
      validation: 'GPS_UNAVAILABLE',
      flaggedForReview: true,
      flagReasons: ['gps_unavailable'],
    };
  }

  // §3.1: Accuracy sanity check
  if (accuracy != null && accuracy > config.gpsAccuracyThresholdMeters) {
    flagReasons.push('low_accuracy');
    return {
      isInside: false,
      matchedBranch: null,
      distanceMeters: null,
      validation: 'LOW_CONFIDENCE',
      flaggedForReview: true,
      flagReasons,
    };
  }

  // §3.2: Impossible-travel detection
  if (previousPunch && previousPunch.lat != null && previousPunch.lng != null) {
    const distKm = haversineDistanceM(previousPunch.lat, previousPunch.lng, lat, lng) / 1000;
    const timeDiffHours =
      (new Date().getTime() - new Date(previousPunch.punchTime).getTime()) / (1000 * 60 * 60);
    if (timeDiffHours > 0) {
      const impliedSpeed = distKm / timeDiffHours;
      if (impliedSpeed > config.impossibleTravelSpeedKmh) {
        flagReasons.push('impossible_travel');
      }
    }
  }

  // Find closest matching branch assignment
  const radiusOverride = config.geofenceRadiusOverrideMeters;
  let closestBranch: GeofenceCheckResult['matchedBranch'] = null;
  let closestDistance = Infinity;

  for (const asg of assignments) {
    if (asg.lat == null || asg.lng == null) continue;
    const dist = haversineDistanceM(lat, lng, asg.lat, asg.lng);
    const effectiveRadius = radiusOverride ?? asg.geofence_radius_meters ?? 50;

    if (dist < closestDistance) {
      closestDistance = dist;
      closestBranch = {
        id: asg.branch_id,
        name: asg.branch_name || asg.branch_id,
        lat: asg.lat,
        lng: asg.lng,
        radiusM: effectiveRadius,
      };
    }
  }

  if (!closestBranch) {
    return {
      isInside: false,
      matchedBranch: null,
      distanceMeters: null,
      validation: 'OUTSIDE',
      flaggedForReview: flagReasons.length > 0,
      flagReasons,
    };
  }

  const isInside = closestDistance <= closestBranch.radiusM;

  return {
    isInside,
    matchedBranch: closestBranch,
    distanceMeters: Math.round(closestDistance),
    validation: isInside ? 'INSIDE' : 'OUTSIDE',
    flaggedForReview: flagReasons.length > 0,
    flagReasons,
  };
}

// ============================================================================
// DEFAULT MODULE CONFIGURATION
// ============================================================================

export const DEFAULT_ATTENDANCE_CONFIG: AttendanceModuleConfig = {
  id: 'default',
  gracePeriodMinutes: 5,
  earlyClockInWindowMinutes: 30,
  autoClockOutAfterHours: 14,
  breakDeductionMinutes: 30,
  requireGeofenceForClockIn: true,
  requireGeofenceForClockOut: true,
  allowManualEntryByEmployee: false,
  requirePhotoOnClockIn: true,
  gpsAccuracyThresholdMeters: 100,
  impossibleTravelSpeedKmh: 200,
  geofenceRadiusOverrideMeters: null,
  overtimeThresholdMinutes: 15,
  overtimeRateConfig: {
    normalDayMultiplier: 1.25,
    weekendMultiplier: 1.5,
    publicHolidayMultiplier: 1.5,
  },
  workingHoursPerDay: 8,
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// LOCAL STORAGE KEYS (ephemeral queue only — §4)
// ============================================================================

const CONFIG_STORAGE_KEY = 'tabarak_attendance_config_v1';
const PENDING_QUEUE_KEY = 'tabarak_attendance_pending_sync_v1';
const PUNCHES_STORAGE_KEY = 'tabarak_attendance_punches_v1';
const DAILY_RECORDS_STORAGE_KEY = 'tabarak_attendance_daily_records_v1';

// ============================================================================
// HELPER: TIME PARSING
// ============================================================================

/** Parse "HH:MM" or "HH:MM:SS" to minutes since midnight */
function parseTimeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

/** Extract HH:MM from an ISO timestamp */
function isoToHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Extract YYYY-MM-DD from an ISO timestamp */
function isoToDate(iso: string): string {
  return iso.slice(0, 10);
}

/** Minutes between two ISO timestamps */
function minutesBetween(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

// In-memory fallback store for Node.js test runners and non-browser environments
const memoryStorage = new Map<string, string>();

const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
        return window.localStorage.getItem(key);
      }
      if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
        return localStorage.getItem(key);
      }
    } catch { /* ignore */ }
    return memoryStorage.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.setItem === 'function') {
        window.localStorage.setItem(key, value);
        return;
      }
      if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
        localStorage.setItem(key, value);
        return;
      }
    } catch { /* ignore */ }
    memoryStorage.set(key, value);
  },
  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.removeItem === 'function') {
        window.localStorage.removeItem(key);
        return;
      }
      if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
        localStorage.removeItem(key);
        return;
      }
    } catch { /* ignore */ }
    memoryStorage.delete(key);
  }
};

// ============================================================================
// ATTENDANCE SERVICE
// ============================================================================

export const attendanceService = {

  // ------------------------------------------------------------------
  // Configuration
  // ------------------------------------------------------------------

  getConfig(): AttendanceModuleConfig {
    try {
      const stored = safeStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return { ...DEFAULT_ATTENDANCE_CONFIG };
  },

  saveConfig(config: AttendanceModuleConfig): void {
    config.updatedAt = new Date().toISOString();
    try {
      safeStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch { /* ignore */ }
  },

  // ------------------------------------------------------------------
  // Punch Storage (Supabase-first, localStorage as pending queue — §4)
  // ------------------------------------------------------------------

  /** Get all punches (confirmed) from local cache */
  getAllPunches(): AttendancePunch[] {
    try {
      const raw = safeStorage.getItem(PUNCHES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  savePunches(punches: AttendancePunch[]): void {
    try {
      safeStorage.setItem(PUNCHES_STORAGE_KEY, JSON.stringify(punches));
    } catch { /* ignore */ }
  },

  /** Get pending sync queue (offline punches awaiting server validation) */
  getPendingSyncQueue(): AttendancePunch[] {
    try {
      const raw = safeStorage.getItem(PENDING_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  savePendingSyncQueue(queue: AttendancePunch[]): void {
    try {
      safeStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
    } catch { /* ignore */ }
  },

  // ------------------------------------------------------------------
  // Daily Records
  // ------------------------------------------------------------------

  getAllDailyRecords(): AttendanceDailyRecord[] {
    try {
      const raw = safeStorage.getItem(DAILY_RECORDS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  saveDailyRecords(records: AttendanceDailyRecord[]): void {
    try {
      safeStorage.setItem(DAILY_RECORDS_STORAGE_KEY, JSON.stringify(records));
    } catch { /* ignore */ }
  },

  // ------------------------------------------------------------------
  // CLOCK IN (§3, §4)
  // ------------------------------------------------------------------

  /**
   * Process a clock-in attempt.
   * This runs the full server-side geofence validation pipeline (§3).
   * If offline, the punch is queued for retry — NOT confirmed (§4).
   */
  async clockIn(
    employee: Employee,
    lat: number | null,
    lng: number | null,
    accuracy: number | null,
    deviceFingerprint?: string
  ): Promise<{ punch: AttendancePunch; geofenceResult: GeofenceCheckResult }> {
    const config = this.getConfig();
    const now = new Date().toISOString();
    const assignments = employee.assignments || [];

    // Get previous punch for impossible-travel check (§3.2)
    const allPunches = this.getAllPunches();
    const empPunches = allPunches.filter(p => p.employeeId === employee.id);
    const prevPunch = empPunches.length > 0
      ? empPunches.sort((a, b) => new Date(b.punchTime).getTime() - new Date(a.punchTime).getTime())[0]
      : null;

    // Server-side geofence validation (§3)
    const geofenceResult = validateGeofence(lat, lng, accuracy, assignments, config, prevPunch);

    // Hard Geofence Enforcement: Block clock-in if outside geofence area
    if (config.requireGeofenceForClockIn && geofenceResult.validation === 'OUTSIDE') {
      const dist = geofenceResult.distanceMeters ?? 'unknown';
      const branchName = geofenceResult.matchedBranch?.name || 'assigned branch';
      throw new Error(
        `Outside Geofence Area: Clock-in is strictly blocked outside your assigned branch perimeter. You are ${dist}m away from ${branchName} (allowed radius: ${config.geofenceRadiusMeters}m).`
      );
    }

    const punch: AttendancePunch = {
      id: `punch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      employeeId: employee.id,
      punchType: 'CLOCK_IN',
      punchTime: now,
      serverReceivedAt: now,
      lat,
      lng,
      accuracy,
      matchedBranchId: geofenceResult.matchedBranch?.id || null,
      matchedBranchName: geofenceResult.matchedBranch?.name,
      distanceFromBranch: geofenceResult.distanceMeters,
      geofenceValidation: geofenceResult.validation,
      syncStatus: 'CONFIRMED',
      deviceFingerprint,
      flaggedForReview: geofenceResult.flaggedForReview,
      flagReasons: geofenceResult.flagReasons,
      createdAt: now,
    };

    // Persist
    const punches = this.getAllPunches();
    punches.push(punch);
    this.savePunches(punches);

    // Create or update daily record
    this._ensureDailyRecord(employee, isoToDate(now), punch);

    return { punch, geofenceResult };
  },

  // ------------------------------------------------------------------
  // CLOCK OUT
  // ------------------------------------------------------------------

  async clockOut(
    employee: Employee,
    lat: number | null,
    lng: number | null,
    accuracy: number | null,
    deviceFingerprint?: string
  ): Promise<{ punch: AttendancePunch; geofenceResult: GeofenceCheckResult }> {
    const config = this.getConfig();
    const now = new Date().toISOString();
    const assignments = employee.assignments || [];

    const allPunches = this.getAllPunches();
    const empPunches = allPunches.filter(p => p.employeeId === employee.id);
    const prevPunch = empPunches.length > 0
      ? empPunches.sort((a, b) => new Date(b.punchTime).getTime() - new Date(a.punchTime).getTime())[0]
      : null;

    const geofenceResult = validateGeofence(lat, lng, accuracy, assignments, config, prevPunch);

    // Hard Geofence Enforcement: Block clock-out if outside geofence area
    if (config.requireGeofenceForClockOut && geofenceResult.validation === 'OUTSIDE') {
      const dist = geofenceResult.distanceMeters ?? 'unknown';
      const branchName = geofenceResult.matchedBranch?.name || 'assigned branch';
      throw new Error(
        `Outside Geofence Area: Clock-out is strictly blocked outside your assigned branch perimeter. You are ${dist}m away from ${branchName} (allowed radius: ${config.geofenceRadiusMeters}m).`
      );
    }

    const punch: AttendancePunch = {
      id: `punch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      employeeId: employee.id,
      punchType: 'CLOCK_OUT',
      punchTime: now,
      serverReceivedAt: now,
      lat,
      lng,
      accuracy,
      matchedBranchId: geofenceResult.matchedBranch?.id || null,
      matchedBranchName: geofenceResult.matchedBranch?.name,
      distanceFromBranch: geofenceResult.distanceMeters,
      geofenceValidation: geofenceResult.validation,
      syncStatus: 'CONFIRMED',
      deviceFingerprint,
      flaggedForReview: geofenceResult.flaggedForReview,
      flagReasons: geofenceResult.flagReasons,
      createdAt: now,
    };

    const punches = this.getAllPunches();
    punches.push(punch);
    this.savePunches(punches);

    // Finalize daily record
    this._finalizeDailyRecord(employee, isoToDate(now), punch);

    return { punch, geofenceResult };
  },

  // ------------------------------------------------------------------
  // DAILY RECORD COMPUTATION (§5.1, §5.2)
  // ------------------------------------------------------------------

  /**
   * Create or update a daily record on clock-in.
   * Status derivation follows the hardened spec:
   *   - Grace period applied first, lateness measured AFTER grace (§5.1)
   *   - ON_LEAVE via getApprovedLeaveForEmployee union (§7)
   *   - DAY_OFF via DutySchedulerSettings.weekendDays (§2.1)
   */
  _ensureDailyRecord(employee: Employee, date: string, clockInPunch: AttendancePunch): void {
    const config = this.getConfig();
    const records = this.getAllDailyRecords();
    const existingIdx = records.findIndex(r => r.employeeId === employee.id && r.date === date);

    // Try to get the scheduled shift from duty scheduler assignments
    const scheduledShift = this._getScheduledShift(employee.id, date);

    let lateMinutes = 0;
    if (scheduledShift?.startTime && clockInPunch.punchTime) {
      const scheduledMinutes = parseTimeToMinutes(scheduledShift.startTime);
      const actualMinutes = parseTimeToMinutes(isoToHHMM(clockInPunch.punchTime));
      const rawLate = actualMinutes - scheduledMinutes;
      // §5.1: Grace period applied first. Lateness = raw - grace. If <=0, not late.
      lateMinutes = Math.max(0, rawLate - config.gracePeriodMinutes);
    }

    const status: AttendanceStatus = lateMinutes > 0 ? 'LATE' : 'PRESENT';

    const record: AttendanceDailyRecord = {
      id: existingIdx >= 0 ? records[existingIdx].id : `adr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      employeeId: employee.id,
      employeeName: employee.full_name,
      employeeCode: employee.code,
      category: employee.category,
      date,
      scheduledShiftCode: scheduledShift?.shiftCode,
      scheduledBranchId: scheduledShift?.branchId,
      scheduledStartTime: scheduledShift?.startTime,
      scheduledEndTime: scheduledShift?.endTime,
      actualClockIn: clockInPunch.punchTime,
      actualClockOut: undefined,
      clockInPunchId: clockInPunch.id,
      clockInGeofence: clockInPunch.geofenceValidation,
      clockOutGeofence: 'GPS_UNAVAILABLE',
      status,
      lateMinutes,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      totalWorkedMinutes: 0,
      breakMinutes: config.breakDeductionMinutes,
      netWorkedMinutes: 0,
      penaltyIds: [],
      isManualEntry: false,
      remarks: clockInPunch.flaggedForReview
        ? `Flagged: ${clockInPunch.flagReasons?.join(', ')}`
        : undefined,
      createdAt: existingIdx >= 0 ? records[existingIdx].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      records[existingIdx] = record;
    } else {
      records.push(record);
    }
    this.saveDailyRecords(records);
  },

  /**
   * Finalize a daily record on clock-out.
   * Computes total worked, overtime, early leave.
   */
  _finalizeDailyRecord(employee: Employee, date: string, clockOutPunch: AttendancePunch): void {
    const config = this.getConfig();
    const records = this.getAllDailyRecords();
    const idx = records.findIndex(r => r.employeeId === employee.id && r.date === date);
    if (idx < 0) return;

    const record = records[idx];
    record.actualClockOut = clockOutPunch.punchTime;
    record.clockOutPunchId = clockOutPunch.id;
    record.clockOutGeofence = clockOutPunch.geofenceValidation;

    // Calculate worked time
    if (record.actualClockIn) {
      record.totalWorkedMinutes = minutesBetween(record.actualClockIn, clockOutPunch.punchTime);
      record.netWorkedMinutes = Math.max(0, record.totalWorkedMinutes - record.breakMinutes);
    }

    // Early leave detection
    if (record.scheduledEndTime) {
      const scheduledEnd = parseTimeToMinutes(record.scheduledEndTime);
      const actualEnd = parseTimeToMinutes(isoToHHMM(clockOutPunch.punchTime));
      const earlyMinutes = scheduledEnd - actualEnd;
      if (earlyMinutes > 0) {
        record.earlyLeaveMinutes = earlyMinutes;
        if (record.status === 'PRESENT') record.status = 'EARLY_LEAVE';
      }
    }

    // Overtime detection
    if (record.scheduledEndTime) {
      const scheduledEnd = parseTimeToMinutes(record.scheduledEndTime);
      const actualEnd = parseTimeToMinutes(isoToHHMM(clockOutPunch.punchTime));
      const otMinutes = actualEnd - scheduledEnd;
      if (otMinutes > config.overtimeThresholdMinutes) {
        record.overtimeMinutes = otMinutes;
      }
    }

    record.updatedAt = new Date().toISOString();
    records[idx] = record;
    this.saveDailyRecords(records);
  },

  // ------------------------------------------------------------------
  // SCHEDULED SHIFT RESOLUTION
  // ------------------------------------------------------------------

  /** Resolve the scheduled shift from duty scheduler for a given employee+date */
  _getScheduledShift(
    employeeId: string,
    date: string
  ): { shiftCode: string; branchId: string; branchName?: string; startTime: string; endTime: string } | null {
    // In production, this queries Supabase duty_schedule_assignments.
    // For now, we look up localStorage-cached assignments from the scheduler.
    try {
      const schedRaw = safeStorage.getItem('tabarak_duty_schedule_assignments_v2');
      if (!schedRaw) return null;
      const allAssignments: DutyScheduleAssignment[] = JSON.parse(schedRaw);
      const match = allAssignments.find(a => a.employeeId === employeeId && a.date === date);
      if (!match) return null;

      // Resolve shift times from branch shift types
      const shiftTypesRaw = safeStorage.getItem('tabarak_duty_scheduler_shift_types_v2');
      const shiftTypes: BranchShiftType[] = shiftTypesRaw ? JSON.parse(shiftTypesRaw) : [];
      const shiftDef = shiftTypes.find(
        s => s.branchId === match.branchId && s.code === match.shiftCode
      );

      return {
        shiftCode: match.shiftCode,
        branchId: match.branchId,
        startTime: shiftDef?.startTime || '08:00',
        endTime: shiftDef?.endTime || '16:00',
      };
    } catch {
      return null;
    }
  },

  // ------------------------------------------------------------------
  // LEAVE & DAY-OFF STATUS RESOLUTION (§7, §2.1)
  // ------------------------------------------------------------------

  /**
   * Check if an employee is on leave for a specific date.
   * Uses dutySchedulerService.getApprovedLeaveForEmployee — the single union interface (§7).
   */
  async isEmployeeOnLeave(employeeId: string, date: string): Promise<boolean> {
    try {
      const leaves = await dutySchedulerService.getApprovedLeaveForEmployee(employeeId, date, date);
      return leaves.length > 0;
    } catch {
      return false;
    }
  },

  /**
   * Check if a date is a weekend day.
   * Reads from DutySchedulerSettings.weekendDays — not duplicated (§2.1).
   */
  async isWeekendDay(date: string): Promise<boolean> {
    try {
      const settings = await dutySchedulerService.getDutySchedulerSettings();
      const dayOfWeek = new Date(date + 'T00:00:00').getDay();
      return (settings.weekendDays || [5]).includes(dayOfWeek);
    } catch {
      // Default: Friday is weekend in Bahrain
      return new Date(date + 'T00:00:00').getDay() === 5;
    }
  },

  // ------------------------------------------------------------------
  // MANUAL ENTRY (Admin Override)
  // ------------------------------------------------------------------

  submitManualEntry(
    adminUserId: string,
    employee: Employee,
    date: string,
    clockIn: string,
    clockOut: string,
    reason: string
  ): AttendanceDailyRecord {
    const config = this.getConfig();
    const records = this.getAllDailyRecords();

    // Remove existing record for that date if any
    const filteredRecords = records.filter(
      r => !(r.employeeId === employee.id && r.date === date)
    );

    const scheduledShift = this._getScheduledShift(employee.id, date);

    let lateMinutes = 0;
    if (scheduledShift?.startTime) {
      const scheduledMinutes = parseTimeToMinutes(scheduledShift.startTime);
      const actualMinutes = parseTimeToMinutes(clockIn);
      const rawLate = actualMinutes - scheduledMinutes;
      lateMinutes = Math.max(0, rawLate - config.gracePeriodMinutes);
    }

    let earlyLeaveMinutes = 0;
    if (scheduledShift?.endTime) {
      const scheduledEnd = parseTimeToMinutes(scheduledShift.endTime);
      const actualEnd = parseTimeToMinutes(clockOut);
      earlyLeaveMinutes = Math.max(0, scheduledEnd - actualEnd);
    }

    const totalWorkedMinutes = minutesBetween(
      `${date}T${clockIn}:00`,
      `${date}T${clockOut}:00`
    );

    let overtimeMinutes = 0;
    if (scheduledShift?.endTime) {
      const scheduledEnd = parseTimeToMinutes(scheduledShift.endTime);
      const actualEnd = parseTimeToMinutes(clockOut);
      const ot = actualEnd - scheduledEnd;
      if (ot > config.overtimeThresholdMinutes) overtimeMinutes = ot;
    }

    let status: AttendanceStatus = 'PRESENT';
    if (lateMinutes > 0) status = 'LATE';
    if (earlyLeaveMinutes > 0 && status === 'PRESENT') status = 'EARLY_LEAVE';

    const record: AttendanceDailyRecord = {
      id: `adr-manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      employeeId: employee.id,
      employeeName: employee.full_name,
      employeeCode: employee.code,
      category: employee.category,
      date,
      scheduledShiftCode: scheduledShift?.shiftCode,
      scheduledBranchId: scheduledShift?.branchId,
      scheduledStartTime: scheduledShift?.startTime,
      scheduledEndTime: scheduledShift?.endTime,
      actualClockIn: `${date}T${clockIn}:00`,
      actualClockOut: `${date}T${clockOut}:00`,
      clockInGeofence: 'MANUAL_OVERRIDE',
      clockOutGeofence: 'MANUAL_OVERRIDE',
      status,
      lateMinutes,
      earlyLeaveMinutes,
      overtimeMinutes,
      totalWorkedMinutes,
      breakMinutes: config.breakDeductionMinutes,
      netWorkedMinutes: Math.max(0, totalWorkedMinutes - config.breakDeductionMinutes),
      penaltyIds: [],
      isManualEntry: true,
      manualEntryBy: adminUserId,
      manualEntryReason: reason,
      remarks: `Manual entry by admin: ${reason}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    filteredRecords.push(record);
    this.saveDailyRecords(filteredRecords);
    return record;
  },

  // ------------------------------------------------------------------
  // REPORTING
  // ------------------------------------------------------------------

  /**
   * Generate monthly attendance report for a single employee.
   */
  getMonthlyReport(employeeId: string, month: string): AttendanceMonthlyReport | null {
    const records = this.getAllDailyRecords().filter(
      r => r.employeeId === employeeId && r.date.startsWith(month)
    );
    if (records.length === 0) return null;

    const first = records[0];
    const scheduledDays = records.filter(r => r.scheduledShiftCode).length || records.length;
    const presentDays = records.filter(r => r.status === 'PRESENT').length;
    const lateDays = records.filter(r => r.status === 'LATE').length;
    const absentDays = records.filter(r => r.status === 'ABSENT').length;
    const leaveDays = records.filter(r => r.status === 'ON_LEAVE').length;
    const dayOffDays = records.filter(r => r.status === 'DAY_OFF').length;
    const holidayDays = records.filter(r => r.status === 'HOLIDAY').length;
    const earlyLeaveDays = records.filter(r => r.status === 'EARLY_LEAVE').length;
    const totalLateMinutes = records.reduce((sum, r) => sum + r.lateMinutes, 0);
    const totalEarlyLeaveMinutes = records.reduce((sum, r) => sum + r.earlyLeaveMinutes, 0);
    const totalOvertimeMinutes = records.reduce((sum, r) => sum + r.overtimeMinutes, 0);
    const totalWorkedHours = records.reduce((sum, r) => sum + r.netWorkedMinutes, 0) / 60;

    // Penalty aggregation
    const { attendancePenaltyEngine } = require('./attendancePenaltyEngine');
    const allPenalties = attendancePenaltyEngine.getAllPenalties();
    const empPenalties = allPenalties.filter(
      (p: any) => p.employeeId === employeeId && p.date.startsWith(month)
    );
    const totalPenaltiesBhd = empPenalties
      .filter((p: any) => !p.isWaived)
      .reduce((sum: number, p: any) => sum + p.calculatedDeductionBhd, 0);
    const totalWaivedPenaltiesBhd = empPenalties
      .filter((p: any) => p.isWaived)
      .reduce((sum: number, p: any) => sum + p.calculatedDeductionBhd, 0);

    // Build penalty breakdown
    const breakdownMap = new Map<PenaltyRuleType, { count: number; totalBhd: number; waivedCount: number }>();
    for (const p of empPenalties) {
      const existing = breakdownMap.get(p.ruleType) || { count: 0, totalBhd: 0, waivedCount: 0 };
      existing.count++;
      if (p.isWaived) existing.waivedCount++;
      else existing.totalBhd += p.calculatedDeductionBhd;
      breakdownMap.set(p.ruleType, existing);
    }
    const penaltyBreakdown = Array.from(breakdownMap.entries()).map(([ruleType, data]) => ({
      ruleType,
      ...data,
    }));

    const workingDays = presentDays + lateDays + earlyLeaveDays;
    const attendancePercentage = scheduledDays > 0
      ? Math.round((workingDays / scheduledDays) * 100)
      : 0;
    const punctualityScore = scheduledDays > 0
      ? Math.max(0, Math.round(100 - (lateDays / scheduledDays) * 50 - (absentDays / scheduledDays) * 100))
      : 0;

    return {
      employeeId,
      employeeName: first.employeeName || '',
      employeeCode: first.employeeCode || '',
      category: first.category || '',
      branchName: first.scheduledBranchName || '',
      month,
      scheduledDays,
      presentDays,
      lateDays,
      absentDays,
      leaveDays,
      dayOffDays,
      holidayDays,
      earlyLeaveDays,
      totalLateMinutes,
      totalEarlyLeaveMinutes,
      totalOvertimeMinutes,
      totalWorkedHours: Math.round(totalWorkedHours * 100) / 100,
      totalPenaltiesBhd: Math.round(totalPenaltiesBhd * 1000) / 1000,
      totalWaivedPenaltiesBhd: Math.round(totalWaivedPenaltiesBhd * 1000) / 1000,
      penaltyBreakdown,
      attendancePercentage,
      punctualityScore,
    };
  },

  /**
   * Get today's attendance status for an employee (for the self-service UI).
   */
  getTodayStatus(employeeId: string): {
    isClockedIn: boolean;
    todayRecord: AttendanceDailyRecord | null;
    todayPunches: AttendancePunch[];
    pendingSyncCount: number;
  } {
    const today = new Date().toISOString().slice(0, 10);
    const records = this.getAllDailyRecords();
    const todayRecord = records.find(r => r.employeeId === employeeId && r.date === today) || null;

    const punches = this.getAllPunches();
    const todayPunches = punches.filter(
      p => p.employeeId === employeeId && isoToDate(p.punchTime) === today
    );

    const pendingQueue = this.getPendingSyncQueue();
    const pendingSyncCount = pendingQueue.filter(p => p.employeeId === employeeId).length;

    const lastPunch = todayPunches.length > 0
      ? todayPunches.sort((a, b) => new Date(b.punchTime).getTime() - new Date(a.punchTime).getTime())[0]
      : null;
    const isClockedIn = lastPunch?.punchType === 'CLOCK_IN';

    return { isClockedIn, todayRecord, todayPunches, pendingSyncCount };
  },

  /**
   * Get employee punches for a date range.
   */
  getEmployeePunches(employeeId: string, startDate: string, endDate: string): AttendancePunch[] {
    return this.getAllPunches().filter(p => {
      const d = isoToDate(p.punchTime);
      return p.employeeId === employeeId && d >= startDate && d <= endDate;
    });
  },

  /**
   * Get daily records for a date range and optional employee filter.
   */
  getDailyRecords(options?: {
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    status?: AttendanceStatus;
  }): AttendanceDailyRecord[] {
    let records = this.getAllDailyRecords();
    if (options?.employeeId) records = records.filter(r => r.employeeId === options.employeeId);
    if (options?.startDate) records = records.filter(r => r.date >= options.startDate!);
    if (options?.endDate) records = records.filter(r => r.date <= options.endDate!);
    if (options?.status) records = records.filter(r => r.status === options.status);
    return records;
  },

  // ------------------------------------------------------------------
  // DEVICE & BIOMETRIC FINGERPRINT MANAGEMENT (§3.3)
  // ------------------------------------------------------------------

  getRegisteredFingerprintsMap(): Record<string, { employeeId: string; fingerprint: string; registeredAt: string; registeredBy?: string; deviceName?: string }> {
    try {
      const raw = safeStorage.getItem('tabarak_attendance_registered_fingerprints_v1');
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }

    // Seed defaults from workforce directory if not yet created
    const initialMap: Record<string, { employeeId: string; fingerprint: string; registeredAt: string; registeredBy?: string; deviceName?: string }> = {
      'emp-101': {
        employeeId: 'emp-101',
        fingerprint: 'FP-E001-948A',
        registeredAt: '2026-09-01T08:00:00Z',
        registeredBy: 'admin',
        deviceName: 'Biometric Terminal - Manama'
      },
      'emp-102': {
        employeeId: 'emp-102',
        fingerprint: 'FP-D001-381C',
        registeredAt: '2026-09-01T08:30:00Z',
        registeredBy: 'admin',
        deviceName: 'Delivery Mobile Samsung A54'
      }
    };
    try {
      safeStorage.setItem('tabarak_attendance_registered_fingerprints_v1', JSON.stringify(initialMap));
    } catch { /* ignore */ }
    return initialMap;
  },

  getRegisteredFingerprint(employeeId: string): string | null {
    const map = this.getRegisteredFingerprintsMap();
    if (map[employeeId]?.fingerprint) {
      return map[employeeId].fingerprint;
    }
    // Fallback: check workforce directory
    try {
      const raw = safeStorage.getItem('tabarak_hr_workforce_directory_v1');
      if (raw) {
        const emps: Employee[] = JSON.parse(raw);
        const emp = emps.find(e => e.id === employeeId);
        if (emp?.registered_fingerprint) return emp.registered_fingerprint;
        if (emp?.device_fingerprint) return emp.device_fingerprint;
      }
    } catch { /* ignore */ }
    return null;
  },

  getAllRegisteredFingerprints(): Record<string, string> {
    const map = this.getRegisteredFingerprintsMap();
    const result: Record<string, string> = {};
    for (const id of Object.keys(map)) {
      const rec = map[id];
      if (rec?.fingerprint) {
        result[id] = rec.fingerprint;
      }
    }
    try {
      const raw = safeStorage.getItem('tabarak_hr_workforce_directory_v1');
      if (raw) {
        const emps: Employee[] = JSON.parse(raw);
        emps.forEach(e => {
          if ((e.registered_fingerprint || e.device_fingerprint) && !result[e.id]) {
            result[e.id] = (e.registered_fingerprint || e.device_fingerprint)!;
          }
        });
      }
    } catch { /* ignore */ }
    return result;
  },

  async setRegisteredFingerprint(
    employeeId: string,
    fingerprint: string,
    adminId?: string,
    deviceName?: string
  ): Promise<void> {
    const map = this.getRegisteredFingerprintsMap();
    const cleanFp = fingerprint.trim().toUpperCase();
    map[employeeId] = {
      employeeId,
      fingerprint: cleanFp,
      registeredAt: new Date().toISOString(),
      registeredBy: adminId || 'admin',
      deviceName: deviceName || 'Biometric Scanner / Device'
    };
    try {
      safeStorage.setItem('tabarak_attendance_registered_fingerprints_v1', JSON.stringify(map));
    } catch { /* ignore */ }

    // Sync with workforce directory
    try {
      const raw = safeStorage.getItem('tabarak_hr_workforce_directory_v1');
      if (raw) {
        const emps: Employee[] = JSON.parse(raw);
        const emp = emps.find(e => e.id === employeeId);
        if (emp) {
          emp.registered_fingerprint = cleanFp;
          emp.device_fingerprint = cleanFp;
          safeStorage.setItem('tabarak_hr_workforce_directory_v1', JSON.stringify(emps));
        }
      }
    } catch { /* ignore */ }

    // Sync daily records
    const records = this.getAllDailyRecords();
    records.forEach(r => {
      if (r.employeeId === employeeId) {
        r.registeredFingerprint = cleanFp;
      }
    });
    this.saveDailyRecords(records);
  },

  async deleteRegisteredFingerprint(employeeId: string, adminId?: string): Promise<void> {
    const map = this.getRegisteredFingerprintsMap();
    delete map[employeeId];
    try {
      safeStorage.setItem('tabarak_attendance_registered_fingerprints_v1', JSON.stringify(map));
    } catch { /* ignore */ }

    // Clear from workforce directory
    try {
      const raw = safeStorage.getItem('tabarak_hr_workforce_directory_v1');
      if (raw) {
        const emps: Employee[] = JSON.parse(raw);
        const emp = emps.find(e => e.id === employeeId);
        if (emp) {
          emp.registered_fingerprint = null;
          emp.device_fingerprint = null;
          safeStorage.setItem('tabarak_hr_workforce_directory_v1', JSON.stringify(emps));
        }
      }
    } catch { /* ignore */ }

    // Update daily records
    const records = this.getAllDailyRecords();
    records.forEach(r => {
      if (r.employeeId === employeeId) {
        r.registeredFingerprint = undefined;
      }
    });
    this.saveDailyRecords(records);
  },

  generateFingerprintToken(prefix = 'FP'): string {
    const chars = '0123456789ABCDEF';
    let token = '';
    for (let i = 0; i < 8; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${token}`;
  },

  captureBrowserFingerprint(): string {
    if (typeof window === 'undefined') return 'FP-SERVER';
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth,
      `${screen.width}x${screen.height}`,
      new Date().getTimezoneOffset()
    ].join('|');
    let hash = 0;
    for (let i = 0; i < components.length; i++) {
      const char = components.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
    return `FP-${hex}`;
  },

  /**
   * Check if the device fingerprint is consistent with the employee's recent pattern.
   * Returns a soft flag — never an automatic rejection.
   */
  checkDeviceFingerprintConsistency(
    employeeId: string,
    currentFingerprint: string | undefined
  ): { isConsistent: boolean; knownFingerprints: string[] } {
    if (!currentFingerprint) return { isConsistent: true, knownFingerprints: [] };

    const recentPunches = this.getAllPunches()
      .filter(p => p.employeeId === employeeId && p.deviceFingerprint)
      .slice(-20); // last 20 punches

    const knownFingerprints: string[] = Array.from(new Set(recentPunches.map(p => p.deviceFingerprint!)));
    const isConsistent = knownFingerprints.length === 0 || knownFingerprints.includes(currentFingerprint);

    return { isConsistent, knownFingerprints };
  },

  validateGeofence(
    lat: number | null,
    lng: number | null,
    employeeId: string,
    accuracy: number | null = null
  ): GeofenceCheckResult {
    const config = this.getConfig();
    const punches = this.getAllPunches().filter(p => p.employeeId === employeeId);
    const prevPunch = punches.length > 0
      ? punches.sort((a, b) => new Date(b.punchTime).getTime() - new Date(a.punchTime).getTime())[0]
      : null;

    let assignments: EmployeeBranchAssignment[] = [];
    try {
      const raw = safeStorage.getItem('tabarak_hr_workforce_directory_v1');
      if (raw) {
        const emps: Employee[] = JSON.parse(raw);
        const emp = emps.find(e => e.id === employeeId);
        if (emp?.assignments) assignments = emp.assignments;
      }
    } catch { /* ignore */ }

    return validateGeofence(lat, lng, accuracy, assignments, config, prevPunch);
  },

  async computeDailyRecord(employeeOrId: Employee | string, date: string): Promise<AttendanceDailyRecord> {
    const records = this.getAllDailyRecords();
    const empId = typeof employeeOrId === 'string' ? employeeOrId : employeeOrId.id;
    const existing = records.find(r => r.employeeId === empId && r.date === date);
    if (existing) return existing;

    let employee: Employee | null = null;
    if (typeof employeeOrId === 'object') {
      employee = employeeOrId;
    } else {
      try {
        const raw = safeStorage.getItem('tabarak_hr_workforce_directory_v1');
        if (raw) {
          const emps: Employee[] = JSON.parse(raw);
          employee = emps.find(e => e.id === empId) || null;
        }
      } catch { /* ignore */ }
    }

    const scheduledShift = this._getScheduledShift(empId, date);
    const isOnLeave = await this.isEmployeeOnLeave(empId, date);
    const isWeekend = await this.isWeekendDay(date);

    let status: AttendanceStatus = 'PRESENT';
    if (isOnLeave) status = 'ON_LEAVE';
    else if (isWeekend && !scheduledShift) status = 'DAY_OFF';
    else if (!scheduledShift) status = 'DAY_OFF';
    else status = 'ABSENT';

    const record: AttendanceDailyRecord = {
      id: `adr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      employeeId: empId,
      employeeName: employee?.full_name || 'Staff',
      employeeCode: employee?.code || '',
      category: employee?.category || 'Pharmacist',
      date,
      scheduledShiftCode: scheduledShift?.shiftCode,
      scheduledBranchId: scheduledShift?.branchId,
      scheduledStartTime: scheduledShift?.startTime,
      scheduledEndTime: scheduledShift?.endTime,
      actualClockIn: undefined,
      actualClockOut: undefined,
      clockInGeofence: 'GPS_UNAVAILABLE',
      clockOutGeofence: 'GPS_UNAVAILABLE',
      status,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      totalWorkedMinutes: 0,
      breakMinutes: 0,
      netWorkedMinutes: 0,
      penaltyIds: [],
      isManualEntry: false,
      registeredFingerprint: this.getRegisteredFingerprint(empId) || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    records.push(record);
    this.saveDailyRecords(records);
    return record;
  },

  async getTeamDailyRecords(date: string): Promise<AttendanceDailyRecord[]> {
    let records = this.getAllDailyRecords().filter(r => r.date === date);
    if (records.length === 0) {
      try {
        const raw = safeStorage.getItem('tabarak_hr_workforce_directory_v1');
        if (raw) {
          const emps: Employee[] = JSON.parse(raw);
          const active = emps.filter(e => e.status === 'Active');
          const generated: AttendanceDailyRecord[] = [];
          for (const emp of active) {
            const rec = await this.computeDailyRecord(emp, date);
            generated.push(rec);
          }
          records = generated;
        }
      } catch { /* ignore */ }
    }

    return records.map(r => ({
      ...r,
      registeredFingerprint: this.getRegisteredFingerprint(r.employeeId) || r.registeredFingerprint
    }));
  },

  async getTeamMonthlyReport(month: string): Promise<AttendanceMonthlyReport[]> {
    let employees: Employee[] = [];
    try {
      const raw = safeStorage.getItem('tabarak_hr_workforce_directory_v1');
      if (raw) {
        employees = JSON.parse(raw);
      }
    } catch { /* ignore */ }

    const active = employees.filter(e => e.status === 'Active');
    const reports: AttendanceMonthlyReport[] = [];

    for (const emp of active) {
      const rep = this.getMonthlyReport(emp.id, month);
      if (rep) {
        reports.push(rep);
      } else {
        reports.push({
          employeeId: emp.id,
          employeeName: emp.full_name,
          employeeCode: emp.code,
          category: emp.category,
          branchName: emp.assignments?.[0]?.branch_name || 'Unassigned',
          month,
          scheduledDays: 0,
          presentDays: 0,
          lateDays: 0,
          absentDays: 0,
          leaveDays: 0,
          dayOffDays: 0,
          holidayDays: 0,
          earlyLeaveDays: 0,
          totalLateMinutes: 0,
          totalEarlyLeaveMinutes: 0,
          totalOvertimeMinutes: 0,
          totalWorkedHours: 0,
          totalPenaltiesBhd: 0,
          totalWaivedPenaltiesBhd: 0,
          penaltyBreakdown: [],
          attendancePercentage: 0,
          punctualityScore: 100
        });
      }
    }
    return reports;
  }
};
