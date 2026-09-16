import { PharmacistSchedulingProfile, WorkRestMode, PatternStrictness } from '../../types';

export type PatternDecision = 'MUST_WORK' | 'MUST_REST' | 'PREFER_WORK' | 'PREFER_REST' | 'NO_PREFERENCE';

export interface RollingPharmacistState {
  employeeId: string;
  currentConsecutiveWorkingDays: number;
  currentConsecutiveRestDays: number;
  currentPatternCycleIndex: number;
  lastShiftEndDatetime?: string | null;
  lastShiftType?: string | null;
  lastBranchId?: string | null;
  totalWorkloadScore: number;
  recentWorkloadScore: number;
  weekendAssignmentCount: number;
  weeklyWorkingDaysAssigned?: number; // Days assigned in current Mon-Sun or Sun-Sat week
}

export interface PatternEvaluationResult {
  decision: PatternDecision;
  isHardConstraint: boolean;
  reason: string;
  targetStreak?: number;
  currentStreak?: number;
  cycleIndex?: number;
  deviated?: boolean;
}

/**
 * Evaluates the pharmacist Work/Rest pattern for a specific target date
 * given their current rolling state and profile configuration.
 * Spec §6.2 - All 4 Modes:
 * 1. DAYS_PER_WEEK
 * 2. FIXED_CYCLE
 * 3. VARIABLE_CYCLE
 * 4. CUSTOM_CALENDAR
 */
export function evaluateWorkRestPattern(
  profile: PharmacistSchedulingProfile,
  state: RollingPharmacistState,
  targetDate: string, // "YYYY-MM-DD"
  weekDayIndex: number, // 0 = Sun, 1 = Mon, ..., 6 = Sat
  daysAssignedThisWeek: number = 0,
  hasSpecialRestThisWeek: boolean = false
): PatternEvaluationResult {
  const maxConsecutive = profile.maxConsecutiveWorkingDaysOverride !== undefined && 
    profile.maxConsecutiveWorkingDaysOverride !== null && 
    profile.maxConsecutiveWorkingDaysOverride > 0
      ? profile.maxConsecutiveWorkingDaysOverride
      : (profile.maximumConsecutiveWorkingDays || 6);
  const isStrictHard = profile.patternStrictness === 'HARD';

  // 1. NON-NEGOTIABLE SAFETY GUARDRAIL (Spec §5.4):
  // Maximum consecutive working days is an unbreachable ceiling.
  if (state.currentConsecutiveWorkingDays >= maxConsecutive) {
    return {
      decision: 'MUST_REST',
      isHardConstraint: true,
      reason: `Maximum consecutive working days reached (${state.currentConsecutiveWorkingDays}/${maxConsecutive})`,
      currentStreak: state.currentConsecutiveWorkingDays,
      targetStreak: maxConsecutive
    };
  }

  const config = profile.workRestConfig || {};

  switch (profile.workRestMode) {
    case 'DAYS_PER_WEEK':
      return evaluateDaysPerWeek(profile, state, targetDate, weekDayIndex, daysAssignedThisWeek, hasSpecialRestThisWeek);

    case 'FIXED_CYCLE':
      return evaluateFixedCycle(profile, state, targetDate);

    case 'VARIABLE_CYCLE':
      return evaluateVariableCycle(profile, state, targetDate);

    case 'CUSTOM_CALENDAR':
      return evaluateCustomCalendar(profile, state, targetDate);

    case 'DYNAMIC_VARIABLE_CYCLE':
      return evaluateDynamicVariableCycle(profile, state, targetDate);

    default:
      return {
        decision: 'NO_PREFERENCE',
        isHardConstraint: false,
        reason: 'Default configuration - no strict pattern'
      };
  }
}

/**
 * Mode 5: DYNAMIC_VARIABLE_CYCLE (Intelligent CSP-Based Rotation)
 * Evaluates dynamic streak progression against [targetStreakMin, targetStreakMax]
 * and strictly blocks any assignment beyond effectiveMax or during mandatory rest.
 */
export function evaluateDynamicVariableCycle(
  profile: PharmacistSchedulingProfile,
  state: RollingPharmacistState,
  targetDate: string
): PatternEvaluationResult {
  const config = profile.workRestConfig || {};
  const targetStreakMin = Number(config.targetStreakMin || 4);
  const targetStreakMax = Number(config.targetStreakMax || 6);
  const minRestDaysAfterStreak = Number(config.minRestDaysAfterStreak || 1);

  const effectiveMax = profile.maxConsecutiveWorkingDaysOverride !== undefined && 
    profile.maxConsecutiveWorkingDaysOverride !== null && 
    profile.maxConsecutiveWorkingDaysOverride > 0
      ? profile.maxConsecutiveWorkingDaysOverride
      : (profile.maximumConsecutiveWorkingDays || 8);

  // 1. Hard ceiling H1
  if (state.currentConsecutiveWorkingDays >= effectiveMax) {
    return {
      decision: 'MUST_REST',
      isHardConstraint: true,
      reason: `Maximum consecutive working days reached (${state.currentConsecutiveWorkingDays}/${effectiveMax})`,
      currentStreak: state.currentConsecutiveWorkingDays,
      targetStreak: effectiveMax
    };
  }

  // 2. Mandatory rest H2
  if (state.currentConsecutiveWorkingDays === 0 && state.currentConsecutiveRestDays < minRestDaysAfterStreak && state.currentConsecutiveRestDays > 0) {
    return {
      decision: 'MUST_REST',
      isHardConstraint: true,
      reason: `Mandatory rest in progress (${state.currentConsecutiveRestDays}/${minRestDaysAfterStreak} days)`,
      currentStreak: 0
    };
  }

  // 3. Streak preferences
  if (state.currentConsecutiveWorkingDays >= targetStreakMax) {
    return {
      decision: 'PREFER_REST',
      isHardConstraint: false,
      reason: `Target streak maximum reached (${state.currentConsecutiveWorkingDays}/${targetStreakMax} days) — prefer rest unless coverage requires extension`,
      currentStreak: state.currentConsecutiveWorkingDays,
      targetStreak: targetStreakMax
    };
  }

  if (state.currentConsecutiveWorkingDays > 0 && state.currentConsecutiveWorkingDays < targetStreakMin) {
    return {
      decision: 'PREFER_WORK',
      isHardConstraint: false,
      reason: `Building toward target streak min (${state.currentConsecutiveWorkingDays}/${targetStreakMin} days)`,
      currentStreak: state.currentConsecutiveWorkingDays,
      targetStreak: targetStreakMin
    };
  }

  return {
    decision: 'PREFER_WORK',
    isHardConstraint: false,
    reason: `Within healthy streak range (${state.currentConsecutiveWorkingDays}/${targetStreakMax} days)`,
    currentStreak: state.currentConsecutiveWorkingDays,
    targetStreak: targetStreakMax
  };
}

/**
 * Mode 1: DAYS_PER_WEEK (Spec §6.2 Mode 1, §14.3)
 * Distributes target_days_per_week across the calendar week.
 * Never defaults to 6 days for a 3-day pharmacist!
 */
export function evaluateDaysPerWeek(
  profile: PharmacistSchedulingProfile,
  state: RollingPharmacistState,
  targetDate: string,
  weekDayIndex: number,
  daysAssignedThisWeek: number,
  hasSpecialRestThisWeek: boolean = false
): PatternEvaluationResult {
  const config = profile.workRestConfig || {};
  const targetDaysPerWeek = Number(config.target_days_per_week ?? config.targetDaysPerWeek ?? 5);
  const isStrictHard = profile.patternStrictness === 'HARD';
  
  // Weekly rest day preference if configured (e.g. 5 = Friday)
  const preferredRestDays: number[] = Array.isArray(config.preferredRestDays) 
    ? config.preferredRestDays 
    : (config.fixedRestDay !== undefined ? [Number(config.fixedRestDay)] : [5]);

  // If the employee has a special rest request in this week, their weekly rest day is fulfilled
  // by that special request date, so do not force a duplicate rest day on the default preferred day (Point 1).
  if (!hasSpecialRestThisWeek && preferredRestDays.includes(weekDayIndex)) {
    return {
      decision: isStrictHard ? 'MUST_REST' : 'PREFER_REST',
      isHardConstraint: isStrictHard,
      reason: `Configured weekly rest day (${getDayName(weekDayIndex)})`,
      currentStreak: state.currentConsecutiveWorkingDays
    };
  }

  // If pharmacist already hit their weekly quota
  if (daysAssignedThisWeek >= targetDaysPerWeek) {
    return {
      decision: isStrictHard ? 'MUST_REST' : 'PREFER_REST',
      isHardConstraint: isStrictHard,
      reason: `Weekly target of ${targetDaysPerWeek} days reached for this week (${daysAssignedThisWeek}/${targetDaysPerWeek})`,
      currentStreak: state.currentConsecutiveWorkingDays
    };
  }

  // Days remaining in week (assuming week ends Saturday=6 or Sunday=0)
  // Standard Bahrain week runs Sunday (0) to Saturday (6). Remaining days including today:
  const remainingDaysInWeek = 7 - weekDayIndex;
  const remainingNeededDays = targetDaysPerWeek - daysAssignedThisWeek;

  if (remainingDaysInWeek <= remainingNeededDays) {
    // Must work all remaining days to meet target
    return {
      decision: isStrictHard ? 'MUST_WORK' : 'PREFER_WORK',
      isHardConstraint: isStrictHard,
      reason: `Must work to reach target ${targetDaysPerWeek} days/week (${daysAssignedThisWeek} done, ${remainingNeededDays} needed in ${remainingDaysInWeek} days)`,
      currentStreak: state.currentConsecutiveWorkingDays
    };
  }

  return {
    decision: 'PREFER_WORK',
    isHardConstraint: false,
    reason: `Within weekly target of ${targetDaysPerWeek} days/week (${daysAssignedThisWeek}/${targetDaysPerWeek})`,
    currentStreak: state.currentConsecutiveWorkingDays
  };
}

/**
 * Mode 2: FIXED_CYCLE (Spec §6.2 Mode 2)
 * Repeating N work days followed by M rest days (e.g. 6:1, 5:2, 3:4)
 */
export function evaluateFixedCycle(
  profile: PharmacistSchedulingProfile,
  state: RollingPharmacistState,
  targetDate: string
): PatternEvaluationResult {
  const config = profile.workRestConfig || {};
  const workDays = Number(config.work_days ?? config.workDays ?? 6);
  const restDays = Number(config.rest_days ?? config.restDays ?? 1);
  const isStrictHard = profile.patternStrictness === 'HARD';

  // If currently in rest phase:
  if (state.currentConsecutiveRestDays > 0) {
    if (state.currentConsecutiveRestDays < restDays) {
      return {
        decision: 'MUST_REST',
        isHardConstraint: true, // Rest streak must be completed
        reason: `Continuing fixed rest cycle (${state.currentConsecutiveRestDays}/${restDays} rest days)`,
        targetStreak: restDays,
        currentStreak: state.currentConsecutiveRestDays
      };
    } else {
      // Rest phase complete -> ready to work
      return {
        decision: isStrictHard ? 'MUST_WORK' : 'PREFER_WORK',
        isHardConstraint: isStrictHard,
        reason: `Rest phase complete (${state.currentConsecutiveRestDays}/${restDays}). Starting work cycle.`,
        currentStreak: 0
      };
    }
  }

  // Currently in work phase:
  if (state.currentConsecutiveWorkingDays >= workDays) {
    return {
      decision: isStrictHard ? 'MUST_REST' : 'PREFER_REST',
      isHardConstraint: isStrictHard,
      reason: `Fixed work cycle target reached (${state.currentConsecutiveWorkingDays}/${workDays} work days). Rest is due.`,
      targetStreak: workDays,
      currentStreak: state.currentConsecutiveWorkingDays
    };
  }

  return {
    decision: isStrictHard ? 'MUST_WORK' : 'PREFER_WORK',
    isHardConstraint: isStrictHard,
    reason: `In fixed work cycle (${state.currentConsecutiveWorkingDays + 1}/${workDays} work days)`,
    targetStreak: workDays,
    currentStreak: state.currentConsecutiveWorkingDays
  };
}

/**
 * Mode 3: VARIABLE_CYCLE (Spec §6.2 Mode 3, §6.3, §17.2)
 * Streak array target, e.g. [6, 7, 3, 8].
 * Each number is the target consecutive work streak before 1 rest occasion is assigned.
 */
export function evaluateVariableCycle(
  profile: PharmacistSchedulingProfile,
  state: RollingPharmacistState,
  targetDate: string
): PatternEvaluationResult {
  const config = profile.workRestConfig || {};
  const rawCycle = config.cycle || [6, 7, 3, 8];
  const cycle: number[] = Array.isArray(rawCycle) && rawCycle.length > 0 
    ? rawCycle.map(Number) 
    : [6, 7, 3, 8];
  const mode = (config.mode || 'REPEATING').toUpperCase();
  const isStrictHard = profile.patternStrictness === 'HARD';

  let cycleIndex = state.currentPatternCycleIndex || 0;
  if (cycleIndex >= cycle.length) {
    if (mode === 'REPEATING') {
      cycleIndex = cycleIndex % cycle.length;
    } else {
      cycleIndex = cycle.length - 1;
    }
  }

  const targetStreak = cycle[cycleIndex];

  // If currently in a rest occasion:
  if (state.currentConsecutiveRestDays > 0) {
    // A single rest occasion satisfies the break in variable cycle
    return {
      decision: isStrictHard ? 'MUST_WORK' : 'PREFER_WORK',
      isHardConstraint: isStrictHard,
      reason: `Rest occasion complete. Starting next variable cycle streak [index ${cycleIndex}, target ${targetStreak}]`,
      targetStreak,
      cycleIndex
    };
  }

  // In work streak:
  if (state.currentConsecutiveWorkingDays >= targetStreak) {
    return {
      decision: isStrictHard ? 'MUST_REST' : 'PREFER_REST',
      isHardConstraint: isStrictHard,
      reason: `Variable cycle streak target reached (${state.currentConsecutiveWorkingDays}/${targetStreak} days at cycle [${cycleIndex}])`,
      targetStreak,
      currentStreak: state.currentConsecutiveWorkingDays,
      cycleIndex
    };
  }

  return {
    decision: isStrictHard ? 'MUST_WORK' : 'PREFER_WORK',
    isHardConstraint: isStrictHard,
    reason: `Progressing through variable streak (${state.currentConsecutiveWorkingDays + 1}/${targetStreak} days at cycle [${cycleIndex}])`,
    targetStreak,
    currentStreak: state.currentConsecutiveWorkingDays,
    cycleIndex
  };
}

/**
 * Mode 4: CUSTOM_CALENDAR (Spec §6.2 Mode 4)
 * Explicit day-by-day array anchored to a calendar date.
 * E.g. calendar: ["W","W","W","W","W","W","O",...], anchor_date: "2026-09-01"
 */
export function evaluateCustomCalendar(
  profile: PharmacistSchedulingProfile,
  state: RollingPharmacistState,
  targetDate: string
): PatternEvaluationResult {
  const config = profile.workRestConfig || {};
  const calendar: string[] = Array.isArray(config.calendar) ? config.calendar : ['W','W','W','W','W','W','O'];
  const anchorDateStr: string = config.anchor_date || config.anchorDate || targetDate;
  const isStrictHard = profile.patternStrictness === 'HARD';

  if (calendar.length === 0) {
    return { decision: 'NO_PREFERENCE', isHardConstraint: false, reason: 'Empty calendar pattern' };
  }

  // Calculate day difference using UTC calendar days to avoid DST/offset quirks
  const anchor = new Date(anchorDateStr + 'T00:00:00Z');
  const target = new Date(targetDate + 'T00:00:00Z');
  const diffDays = Math.floor((target.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));

  // Modulo calculation that handles negative offsets correctly
  const patternIndex = ((diffDays % calendar.length) + calendar.length) % calendar.length;
  const slotVal = calendar[patternIndex].toUpperCase();

  if (slotVal === 'O' || slotVal === 'OFF' || slotVal === 'REST') {
    return {
      decision: isStrictHard ? 'MUST_REST' : 'PREFER_REST',
      isHardConstraint: isStrictHard,
      reason: `Custom calendar specifies OFF on day offset ${diffDays} (pattern index ${patternIndex})`,
      currentStreak: state.currentConsecutiveWorkingDays
    };
  }

  return {
    decision: isStrictHard ? 'MUST_WORK' : 'PREFER_WORK',
    isHardConstraint: isStrictHard,
    reason: `Custom calendar specifies WORK on day offset ${diffDays} (pattern index ${patternIndex})`,
    currentStreak: state.currentConsecutiveWorkingDays
  };
}

/**
 * Advances rolling state after a day's schedule decision (WORK or REST).
 * Maintains continuity across days, weeks, and schedule boundaries (§16.3).
 */
export function advanceRollingState(
  profile: PharmacistSchedulingProfile,
  state: RollingPharmacistState,
  isWorking: boolean,
  shiftCode?: string,
  branchId?: string,
  shiftEndTimeStr?: string // TIMESTAMPTZ
): RollingPharmacistState {
  const config = profile.workRestConfig || {};
  const cycle: number[] = Array.isArray(config.cycle) && config.cycle.length > 0 
    ? config.cycle.map(Number) 
    : [6, 7, 3, 8];
  const mode = (config.mode || 'REPEATING').toUpperCase();

  const nextState: RollingPharmacistState = { ...state };

  if (isWorking) {
    nextState.currentConsecutiveWorkingDays += 1;
    nextState.currentConsecutiveRestDays = 0;
    if (shiftCode) nextState.lastShiftType = shiftCode;
    if (branchId) nextState.lastBranchId = branchId;
    if (shiftEndTimeStr) nextState.lastShiftEndDatetime = shiftEndTimeStr;
    nextState.weeklyWorkingDaysAssigned = (nextState.weeklyWorkingDaysAssigned || 0) + 1;
  } else {
    // If was working yesterday and transitioned to rest, advance cycle index if VARIABLE_CYCLE
    if (profile.workRestMode === 'VARIABLE_CYCLE' && state.currentConsecutiveWorkingDays > 0) {
      if (mode === 'REPEATING') {
        nextState.currentPatternCycleIndex = (state.currentPatternCycleIndex + 1) % cycle.length;
      } else {
        nextState.currentPatternCycleIndex = Math.min(state.currentPatternCycleIndex + 1, cycle.length - 1);
      }
    }
    nextState.currentConsecutiveWorkingDays = 0;
    nextState.currentConsecutiveRestDays += 1;
  }

  return nextState;
}

function getDayName(dayIndex: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayIndex] || 'Unknown';
}
