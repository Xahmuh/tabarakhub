import { BranchShiftType, PharmacistSchedulingProfile } from '../../types';

export const BAHRAIN_TZ_OFFSET = '+03:00';

export interface ShiftTimeWindow {
  startDatetime: string; // ISO string with +03:00
  endDatetime: string;   // ISO string with +03:00
  durationHours: number;
}

export interface RestValidationResult {
  isValid: boolean;
  gapHours: number;
  requiredHours: number;
  reason?: string;
}

/**
 * Calculates absolute start and end datetimes for a branch shift on a given date.
 * Handles shifts crossing midnight (e.g. NIGHT shift 22:00 -> 08:00).
 * Always computed in Bahrain local time (UTC+3, no DST) per Spec §10.3.
 */
export function calculateShiftDatetimes(
  dateStr: string, // "YYYY-MM-DD"
  shift: BranchShiftType
): ShiftTimeWindow {
  const normStartTime = normalizeTimeString(shift.startTime);
  const normEndTime = normalizeTimeString(shift.endTime);

  const startIso = `${dateStr}T${normStartTime}${BAHRAIN_TZ_OFFSET}`;
  const startDate = new Date(startIso);

  // If end_time <= start_time, the shift crosses midnight into the next calendar day
  let endDateStr = dateStr;
  if (normEndTime <= normStartTime) {
    const nextDay = new Date(dateStr + 'T00:00:00Z');
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    endDateStr = nextDay.toISOString().split('T')[0];
  }

  const endIso = `${endDateStr}T${normEndTime}${BAHRAIN_TZ_OFFSET}`;
  const endDate = new Date(endIso);

  const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

  return {
    startDatetime: startIso,
    endDatetime: endIso,
    durationHours
  };
}

/**
 * Validates whether assigning candidateShift on dateStr provides sufficient rest
 * after lastShiftEndDatetime.
 * Evaluates real timestamps, not shift labels (Spec §10.3).
 */
export function validateMinimumRest(
  lastShiftEndDatetime: string | null | undefined,
  candidateStartDatetime: string,
  minimumRestHours: number = 11.0
): RestValidationResult {
  if (!lastShiftEndDatetime) {
    return { isValid: true, gapHours: 999, requiredHours: minimumRestHours };
  }

  const lastEnd = new Date(lastShiftEndDatetime).getTime();
  const candidateStart = new Date(candidateStartDatetime).getTime();
  const gapHours = (candidateStart - lastEnd) / (1000 * 60 * 60);

  if (gapHours < minimumRestHours) {
    return {
      isValid: false,
      gapHours: Number(gapHours.toFixed(2)),
      requiredHours: minimumRestHours,
      reason: `Insufficient rest: actual gap is ${gapHours.toFixed(1)}h, but minimum required is ${minimumRestHours}h`
    };
  }

  return {
    isValid: true,
    gapHours: Number(gapHours.toFixed(2)),
    requiredHours: minimumRestHours
  };
}

/**
 * Categorizes a shift as AM, PM, or NIGHT based on its timing.
 */
export function categorizeShift(shift: BranchShiftType): 'AM' | 'PM' | 'NIGHT' {
  const code = (shift.code || '').toUpperCase();
  if (code.includes('NIGHT') || code === 'N') return 'NIGHT';
  if (code.includes('PM') || code.includes('EVE') || code === 'E') return 'PM';
  if (code.includes('AM') || code.includes('MORN') || code === 'M') return 'AM';

  const startHour = parseHour(shift.startTime);
  const endHour = parseHour(shift.endTime);

  // If ends before or at start, or starts late at night (>= 21:00)
  if (endHour <= startHour || startHour >= 21) {
    return 'NIGHT';
  }
  if (startHour >= 12) {
    return 'PM';
  }
  return 'AM';
}

/**
 * Validates whether the pharmacist is eligible for this shift type.
 * Spec §5.2, §10.1: Fixed-shift pharmacists never receive disallowed shift types.
 */
export function isShiftAllowedForPharmacist(
  profile: PharmacistSchedulingProfile,
  shift: BranchShiftType
): boolean {
  const allowed = profile.allowedShiftTypes;
  if (!allowed || allowed.length === 0) return true;

  const category = categorizeShift(shift); // 'AM' | 'PM' | 'NIGHT'
  const code = shift.code.toUpperCase();

  // Exact code match check
  if (allowed.some(a => a.toUpperCase() === code)) {
    return true;
  }

  // Category matching
  for (const a of allowed) {
    const aUp = a.toUpperCase();
    if (aUp === 'MIXED') return true;
    if (aUp === 'AM_ONLY' && category === 'AM') return true;
    if (aUp === 'PM_ONLY' && category === 'PM') return true;
    if (aUp === 'NIGHT_ONLY' && category === 'NIGHT') return true;
    if (aUp === 'M' && category === 'AM') return true;
    if (aUp === 'E' && category === 'PM') return true;
    if (aUp === 'FULL') return true;
  }

  return false;
}

function normalizeTimeString(timeStr: string): string {
  if (!timeStr) return '00:00:00';
  const parts = timeStr.trim().split(':');
  const h = parts[0].padStart(2, '0');
  const m = (parts[1] || '00').padStart(2, '0');
  const s = (parts[2] || '00').padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function parseHour(timeStr: string): number {
  if (!timeStr) return 0;
  return parseInt(timeStr.split(':')[0], 10) || 0;
}
