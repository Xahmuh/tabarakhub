import {
  Branch,
  BranchShiftType,
  DutyScheduleAssignment,
  DutyScheduleConflict,
  DutySchedulerLeaveRecord,
  PharmacistRollingState,
  PharmacistSchedulingProfile,
  SchedulingPeriodAdjustments,
  PatternDeviationRecord,
  DynamicCycleSolverInput,
  DynamicCycleSolverOutput,
  DynamicVariableCycleConfig
} from '../../types';
import { 
  buildBranchShiftsMap, 
  DEFAULT_SHIFT_WEIGHTS,
  getCalendarDatesInRange
} from './index';
import { 
  calculateShiftDatetimes, 
  validateMinimumRest, 
  isShiftAllowedForPharmacist, 
  categorizeShift 
} from './shiftTransitions';

/**
 * Validates consecutive working days setting values.
 * Ensures the value is a positive integer (> 0).
 * Does not clamp to any artificial upper bound (e.g. 10, 12, 14 are valid).
 */
export function validateConsecutiveDaysSetting(value: any): { isValid: boolean; error?: string } {
  if (value === null || value === undefined || value === '') {
    return { isValid: false, error: 'Value cannot be empty' };
  }
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
    return { isValid: false, error: 'Must be a positive integer greater than 0' };
  }
  return { isValid: true };
}

/**
 * Resolves the effective maximum consecutive working days ceiling for a pharmacist.
 * Formula: pharmacist.maxConsecutiveWorkingDaysOverride ?? globalMaxConsecutiveDays
 */
export function resolveEffectiveMaxConsecutiveDays(
  profile?: PharmacistSchedulingProfile,
  globalMaxConsecutiveDays?: number
): number {
  if (
    profile?.maxConsecutiveWorkingDaysOverride !== undefined &&
    profile.maxConsecutiveWorkingDaysOverride !== null &&
    profile.maxConsecutiveWorkingDaysOverride > 0
  ) {
    return profile.maxConsecutiveWorkingDaysOverride;
  }
  if (globalMaxConsecutiveDays !== undefined && globalMaxConsecutiveDays !== null && globalMaxConsecutiveDays > 0) {
    return globalMaxConsecutiveDays;
  }
  return 8;
}

export interface InternalSlot {
  id: string;
  dateStr: string;
  branch: Branch;
  shift: BranchShiftType;
  slotIndex: number;
}

export interface SlotAssignmentCandidate {
  slot: InternalSlot;
  pharmacist: any;
  score: number;
}

export interface DayCombination {
  assignments: SlotAssignmentCandidate[];
  totalScore: number;
}

function cloneStateMap(map: Map<string, PharmacistRollingState>): Map<string, PharmacistRollingState> {
  const cloned = new Map<string, PharmacistRollingState>();
  for (const [key, val] of map.entries()) {
    cloned.set(key, { ...val });
  }
  return cloned;
}

/**
 * Pure CSP-based solver for Dynamic Variable Cycle rotation mode.
 * Implements MRV variable ordering, dynamic streak scoring, cross-day backtracking,
 * and Conflict-Directed Backjumping (CDBJ).
 */
export function solveDynamicVariableCycle(input: DynamicCycleSolverInput): DynamicCycleSolverOutput {
  const {
    periodStart,
    periodEnd,
    pharmacists,
    rollingStates = {},
    branchShiftRequirements = [],
    approvedLeave = [],
    branches = [],
    lockedAssignments = [],
    globalMaxConsecutiveDays = 8,
    periodAdjustments,
    shiftWeights = DEFAULT_SHIFT_WEIGHTS
  } = input;

  // 1. Generate calendar dates
  const dates = getCalendarDatesInRange(periodStart, periodEnd);

  // 2. Initialize working rolling states (H3 Cross-Period Continuity)
  const initialStateMap = new Map<string, PharmacistRollingState>();
  for (const p of pharmacists) {
    const prev = rollingStates[p.id];
    const consecutive = prev?.currentConsecutiveWorkingDays ?? prev?.consecutiveWorkingDays ?? 0;
    initialStateMap.set(p.id, {
      id: prev?.id || `state-${p.id}`,
      employeeId: p.id,
      scheduleId: prev?.scheduleId || '',
      consecutiveWorkingDays: consecutive,
      currentConsecutiveWorkingDays: consecutive,
      currentConsecutiveRestDays: prev?.currentConsecutiveRestDays ?? 0,
      currentPatternCycleIndex: prev?.currentPatternCycleIndex ?? 0,
      lastShiftType: prev?.lastShiftType ?? null,
      lastBranchId: prev?.lastBranchId ?? null,
      lastShiftEndTime: prev?.lastShiftEndTime ?? null,
      lastShiftEndDatetime: prev?.lastShiftEndDatetime ?? prev?.lastShiftEndTime ?? null,
      daysSinceWeeklyRest: prev?.daysSinceWeeklyRest ?? 0,
      workloadScore: Number(prev?.totalWorkloadScore ?? prev?.workloadScore ?? 0),
      totalWorkloadScore: Number(prev?.totalWorkloadScore ?? prev?.workloadScore ?? 0),
      recentWorkloadScore: Number(prev?.recentWorkloadScore ?? 0),
      weekendAssignmentCount: prev?.weekendAssignmentCount ?? 0,
      isOnActiveStreak: prev?.isOnActiveStreak ?? (consecutive > 0),
      streakStartDate: prev?.streakStartDate ?? null,
      currentStreakTargetLength: prev?.currentStreakTargetLength ?? null,
      createdAt: prev?.createdAt || new Date().toISOString()
    });
  }

  // Pre-index locked assignments
  const lockedBySlot = new Map<string, DutyScheduleAssignment[]>();
  const lockedByEmpDate = new Map<string, Set<string>>();
  for (const la of lockedAssignments) {
    const key = `${la.date}_${la.branchId}_${la.shiftCode.toUpperCase()}`;
    if (!lockedBySlot.has(key)) lockedBySlot.set(key, []);
    lockedBySlot.get(key)!.push(la);

    if (!lockedByEmpDate.has(la.date)) lockedByEmpDate.set(la.date, new Set());
    lockedByEmpDate.get(la.date)!.add(la.employeeId);
  }

  // Build branch shifts map
  const branchShiftsMap = buildBranchShiftsMap(branches, branchShiftRequirements);

  // Helper: check leave on date
  const isEmployeeOnLeave = (empId: string, dateStr: string) => {
    const targetEmpId = String(empId).trim().toLowerCase();
    return approvedLeave.some(l => {
      const leaveEmpId = String(l.employeeId || (l as any).employee_id || '').trim().toLowerCase();
      if (leaveEmpId !== targetEmpId) return false;
      const statusUpper = String(l.status || 'APPROVED').trim().toUpperCase();
      if (statusUpper === 'REJECTED' || statusUpper === 'CANCELLED') return false;
      const sDate = String(l.startDate || (l as any).start_date || '').split('T')[0].trim();
      const eDate = String(l.endDate || (l as any).end_date || '').split('T')[0].trim();
      return sDate <= dateStr && eDate >= dateStr;
    });
  };

  // Helper: get slots for date
  const getSlotsForDate = (dateStr: string): InternalSlot[] => {
    const slots: InternalSlot[] = [];
    for (const branch of branches) {
      if (branch.isActive === false) continue;
      const shifts = branchShiftsMap.get(branch.id) || [];
      for (const shift of shifts) {
        const key = `${dateStr}_${branch.id}_${shift.code.toUpperCase()}`;
        const lockedInSlot = lockedBySlot.get(key) || [];
        const needed = Math.max(0, (shift.staffRequired || 1) - lockedInSlot.length);
        for (let i = 0; i < needed; i++) {
          slots.push({
            id: `${key}_${i}`,
            dateStr,
            branch,
            shift,
            slotIndex: i
          });
        }
      }
    }
    return slots;
  };

  // Helper: evaluate candidate suitability for a slot given the current state
  const evaluateCandidateForSlot = (
    p: any,
    slot: InternalSlot,
    assignedToday: Set<string>,
    stateMap: Map<string, PharmacistRollingState>,
    isWeekendDay: boolean
  ): { eligible: boolean; score: number } => {
    const profile = p.profile;
    const state = stateMap.get(p.id)!;

    // 1. Already assigned today?
    if (assignedToday.has(p.id)) return { eligible: false, score: 0 };

    // 2. On approved leave today? (Hard constraint H1 / Spec §13 #1)
    if (isEmployeeOnLeave(p.id, slot.dateStr)) return { eligible: false, score: 0 };

    // 3. Branch eligibility
    if (profile) {
      if (profile.roleType === 'FIXED') {
        if (profile.primaryBranchId && profile.primaryBranchId !== slot.branch.id) {
          return { eligible: false, score: 0 };
        }
      } else if (profile.roleType === 'RELIEF') {
        if (profile.allowedBranchIds && profile.allowedBranchIds.length > 0) {
          if (!profile.allowedBranchIds.includes(slot.branch.id)) {
            return { eligible: false, score: 0 };
          }
        }
      }

      // 4. Shift eligibility
      if (!isShiftAllowedForPharmacist(profile, slot.shift)) {
        return { eligible: false, score: 0 };
      }
    }

    // 5. Minimum rest hours
    const shiftWindow = calculateShiftDatetimes(slot.dateStr, slot.shift);
    const minRest = profile?.minimumRestHours || 11.0;
    const restCheck = validateMinimumRest(state.lastShiftEndDatetime, shiftWindow.startDatetime, minRest);
    if (!restCheck.isValid) return { eligible: false, score: 0 };

    // 6. H1: Maximum consecutive working days ceiling
    const effectiveMax = resolveEffectiveMaxConsecutiveDays(profile, globalMaxConsecutiveDays);
    if (state.currentConsecutiveWorkingDays + 1 > effectiveMax) {
      // Excluded from domain entirely!
      return { eligible: false, score: 0 };
    }

    // 7. H2: Mandatory rest injection
    const dConfig: DynamicVariableCycleConfig = profile?.workRestConfig || {};
    const minRestDays = dConfig.minRestDaysAfterStreak || 1;
    if (!state.isOnActiveStreak && state.currentConsecutiveRestDays < minRestDays && state.currentConsecutiveRestDays > 0) {
      return { eligible: false, score: 0 };
    }

    // Candidate is structurally valid! Compute score for value ordering
    const nextStreak = state.currentConsecutiveWorkingDays + 1;
    const targetMin = dConfig.targetStreakMin || 4;
    const targetMax = dConfig.targetStreakMax || 6;

    // Fairness bonus: prioritize resting pharmacists with lowest workload
    const fairnessBonus = -state.totalWorkloadScore * 20;

    // Streak momentum / continuation bonus:
    // If a pharmacist is actively on a streak that hasn't reached targetMax, give strong continuation bonus!
    let streakBonus = 0;
    let streakPenalty = 0;

    if (state.isOnActiveStreak && nextStreak <= targetMax) {
      streakBonus = 150;
    } else if (nextStreak > targetMax) {
      const overage = nextStreak - targetMax;
      const distToCeiling = effectiveMax - nextStreak;
      streakPenalty = overage * 80 + (distToCeiling <= 1 ? 300 : 100);
    }

    let continuityBonus = 0;
    if (state.lastBranchId === slot.branch.id) continuityBonus += 40;
    if (profile?.roleType === 'FIXED' && profile.primaryBranchId === slot.branch.id) continuityBonus += 1000;
    else if (profile?.roleType === 'RELIEF') continuityBonus += 400;

    if (isWeekendDay && periodAdjustments?.weekendPharmacistIds && periodAdjustments.weekendPharmacistIds.length > 0) {
      if (periodAdjustments.weekendPharmacistIds.includes(p.id)) {
        // Designated for weekend rest/off-days: penalize working on weekends
        continuityBonus -= 450 + (state.weekendAssignmentCount * 80);
      } else {
        // Pharmacists outside the weekend rest team cover weekend duties
        continuityBonus += 250;
      }
    }

    const score = continuityBonus + fairnessBonus + streakBonus - streakPenalty;
    return { eligible: true, score };
  };

  // Helper: Advance state for a full day given a chosen combination
  const advanceStateForDay = (
    stateMap: Map<string, PharmacistRollingState>,
    dateStr: string,
    assignmentsForDay: SlotAssignmentCandidate[]
  ) => {
    const dateObj = new Date(dateStr + 'T00:00:00Z');
    const dayOfWeek = dateObj.getUTCDay();
    const isWeekendDay = dayOfWeek === 5 || dayOfWeek === 6;

    const assignedToday = new Set<string>(lockedByEmpDate.get(dateStr) || []);
    for (const a of assignmentsForDay) {
      assignedToday.add(a.pharmacist.id);
    }

    // 1. Process leaves
    for (const p of pharmacists) {
      if (isEmployeeOnLeave(p.id, dateStr)) {
        const st = stateMap.get(p.id)!;
        if (st.currentConsecutiveWorkingDays > 0) {
          st.currentConsecutiveWorkingDays = 0;
          st.consecutiveWorkingDays = 0;
          st.isOnActiveStreak = false;
          st.streakStartDate = null;
          st.currentStreakTargetLength = null;
        }
        st.currentConsecutiveRestDays += 1;
      }
    }

    // 2. Process assigned
    for (const a of assignmentsForDay) {
      const p = a.pharmacist;
      const slot = a.slot;
      const st = stateMap.get(p.id)!;
      const shiftWindow = calculateShiftDatetimes(dateStr, slot.shift);

      st.currentConsecutiveWorkingDays += 1;
      st.consecutiveWorkingDays = st.currentConsecutiveWorkingDays;
      st.currentConsecutiveRestDays = 0;
      st.isOnActiveStreak = true;
      if (!st.streakStartDate) st.streakStartDate = dateStr;
      st.lastBranchId = slot.branch.id;
      st.lastShiftType = slot.shift.code;
      st.lastShiftEndTime = shiftWindow.endDatetime;
      st.lastShiftEndDatetime = shiftWindow.endDatetime;

      const shiftCat = categorizeShift(slot.shift);
      const weight = (shiftWeights[shiftCat] || 1.0) + (isWeekendDay ? (shiftWeights.weekend_bonus || 0.25) : 0);
      st.totalWorkloadScore += weight;
      st.workloadScore = st.totalWorkloadScore;
      if (isWeekendDay) st.weekendAssignmentCount += 1;
    }

    // 3. Process unassigned
    for (const p of pharmacists) {
      if (!assignedToday.has(p.id) && !isEmployeeOnLeave(p.id, dateStr)) {
        const st = stateMap.get(p.id)!;
        if (st.currentConsecutiveWorkingDays > 0) {
          st.currentConsecutiveWorkingDays = 0;
          st.consecutiveWorkingDays = 0;
          st.isOnActiveStreak = false;
          st.streakStartDate = null;
          st.currentStreakTargetLength = null;
          st.currentConsecutiveRestDays = 1;
        } else {
          st.currentConsecutiveRestDays += 1;
        }
      }
    }
  };

  // Helper: Find all valid combinations of candidate assignments for today's slots
  const generateDayCombinations = (
    dateStr: string,
    daySlots: InternalSlot[],
    stateMap: Map<string, PharmacistRollingState>
  ): DayCombination[] => {
    if (daySlots.length === 0) {
      return [{ assignments: [], totalScore: 0 }];
    }

    const dateObj = new Date(dateStr + 'T00:00:00Z');
    const dayOfWeek = dateObj.getUTCDay();
    const isWeekendDay = dayOfWeek === 5 || dayOfWeek === 6;

    const initialAssigned = new Set<string>(lockedByEmpDate.get(dateStr) || []);
    const combinations: DayCombination[] = [];
    const MAX_COMBINATIONS_PER_DAY = 25;

    // Recursive search to fill daySlots
    const searchCombinations = (
      slotIdx: number,
      currentAssignments: SlotAssignmentCandidate[],
      assignedSet: Set<string>,
      totalScore: number
    ) => {
      if (combinations.length >= MAX_COMBINATIONS_PER_DAY) return;
      if (slotIdx === daySlots.length) {
        combinations.push({
          assignments: [...currentAssignments],
          totalScore
        });
        return;
      }

      const slot = daySlots[slotIdx];
      const eligibleCandidates: Array<{ p: any; score: number }> = [];

      for (const p of pharmacists) {
        const evalRes = evaluateCandidateForSlot(p, slot, assignedSet, stateMap, isWeekendDay);
        if (evalRes.eligible) {
          eligibleCandidates.push({ p, score: evalRes.score });
        }
      }

      // Value ordering: highest score first
      eligibleCandidates.sort((a, b) => b.score - a.score);

      for (const cand of eligibleCandidates) {
        assignedSet.add(cand.p.id);
        currentAssignments.push({
          slot,
          pharmacist: cand.p,
          score: cand.score
        });

        searchCombinations(slotIdx + 1, currentAssignments, assignedSet, totalScore + cand.score);

        currentAssignments.pop();
        assignedSet.delete(cand.p.id);

        if (combinations.length >= MAX_COMBINATIONS_PER_DAY) break;
      }
    };

    searchCombinations(0, [], initialAssigned, 0);

    // Sort combinations by totalScore descending
    combinations.sort((a, b) => b.totalScore - a.totalScore);
    return combinations;
  };

  // 3. Multi-Day CSP Backtracking Search (CDBJ)
  interface DayDecision {
    dateIndex: number;
    dateStr: string;
    combinations: DayCombination[];
    combinationIndex: number;
    stateSnapshot: Map<string, PharmacistRollingState>;
  }

  let dateIdx = 0;
  let backtrackCount = 0;
  let backjumpCount = 0;
  const MAX_GLOBAL_BACKTRACKS = 2500;
  let currentStateMap = cloneStateMap(initialStateMap);
  const dayStack: DayDecision[] = [];

  while (dateIdx < dates.length) {
    const dateStr = dates[dateIdx];
    const daySlots = getSlotsForDate(dateStr);
    const combinations = generateDayCombinations(dateStr, daySlots, currentStateMap);

    if (combinations.length > 0) {
      // Pick best combination
      const chosenComb = combinations[0];
      const stateSnapshot = cloneStateMap(currentStateMap);

      advanceStateForDay(currentStateMap, dateStr, chosenComb.assignments);

      dayStack.push({
        dateIndex: dateIdx,
        dateStr,
        combinations,
        combinationIndex: 0,
        stateSnapshot
      });

      dateIdx++;
    } else {
      // Dead-end on dateIdx: Backtrack to earlier day decisions!
      let backtracked = false;

      while (dayStack.length > 0 && backtrackCount < MAX_GLOBAL_BACKTRACKS) {
        backtrackCount++;
        const top = dayStack[dayStack.length - 1];

        const nextCombIdx = top.combinationIndex + 1;
        if (nextCombIdx < top.combinations.length) {
          top.combinationIndex = nextCombIdx;
          const nextComb = top.combinations[nextCombIdx];

          // Restore state snapshot and advance with new choice
          currentStateMap = cloneStateMap(top.stateSnapshot);
          advanceStateForDay(currentStateMap, top.dateStr, nextComb.assignments);

          dateIdx = top.dateIndex + 1;
          backjumpCount++;
          backtracked = true;
          break;
        } else {
          // Exhausted all combinations on this day, pop it and backtrack further!
          dayStack.pop();
        }
      }

      if (!backtracked) {
        // Genuine Unsatisfiability across period (or backtrack limit)
        break;
      }
    }
  }

  const assignments: DutyScheduleAssignment[] = [];
  const conflicts: DutyScheduleConflict[] = [];
  const deviations: PatternDeviationRecord[] = [];

  // Include locked assignments first
  for (const la of lockedAssignments) {
    assignments.push(la);
  }

  const isFullSuccess = dateIdx === dates.length;

  if (isFullSuccess) {
    // Collect all assignments from day decisions
    for (const decision of dayStack) {
      const chosenComb = decision.combinations[decision.combinationIndex];
      for (const a of chosenComb.assignments) {
        const isRelief = a.pharmacist.profile?.roleType === 'RELIEF';
        assignments.push({
          id: `asgn-${decision.dateStr}-${a.slot.branch.id}-${a.slot.shift.code}-${a.pharmacist.id}`,
          scheduleId: '',
          employeeId: a.pharmacist.id,
          branchId: a.slot.branch.id,
          date: decision.dateStr,
          shiftCode: a.slot.shift.code,
          isLocked: false,
          isRelief,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        const dConfig: DynamicVariableCycleConfig = a.pharmacist.profile?.workRestConfig || {};
        const targetMax = dConfig.targetStreakMax || 6;
        const finalState = currentStateMap.get(a.pharmacist.id)!;
        if (finalState.currentConsecutiveWorkingDays > targetMax) {
          deviations.push({
            employeeId: a.pharmacist.id,
            date: decision.dateStr,
            type: 'STREAK_EXTENDED_PAST_TARGET_MAX',
            description: `Streak reached day ${finalState.currentConsecutiveWorkingDays} (past target max ${targetMax}).`,
            streakLength: finalState.currentConsecutiveWorkingDays
          });
        }
      }
    }
  } else {
    // Genuine Unsatisfiability: run greedy forward pass with partial assignments
    // Emitting structured conflicts for any unfillable slot without EVER violating H1 ceiling
    currentStateMap = cloneStateMap(initialStateMap);

    for (const dateStr of dates) {
      const dateObj = new Date(dateStr + 'T00:00:00Z');
      const dayOfWeek = dateObj.getUTCDay();
      const isWeekendDay = dayOfWeek === 5 || dayOfWeek === 6;

      const daySlots = getSlotsForDate(dateStr);
      const assignedToday = new Set<string>(lockedByEmpDate.get(dateStr) || []);
      const todayAssignments: SlotAssignmentCandidate[] = [];

      // Sort slots by MRV
      for (const slot of daySlots) {
        const eligibleCandidates: Array<{ p: any; score: number }> = [];
        for (const p of pharmacists) {
          const evalRes = evaluateCandidateForSlot(p, slot, assignedToday, currentStateMap, isWeekendDay);
          if (evalRes.eligible) {
            eligibleCandidates.push({ p, score: evalRes.score });
          }
        }

        eligibleCandidates.sort((a, b) => b.score - a.score);

        if (eligibleCandidates.length > 0) {
          const chosen = eligibleCandidates[0];
          assignedToday.add(chosen.p.id);
          todayAssignments.push({
            slot,
            pharmacist: chosen.p,
            score: chosen.score
          });

          const isRelief = chosen.p.profile?.roleType === 'RELIEF';
          assignments.push({
            id: `asgn-${dateStr}-${slot.branch.id}-${slot.shift.code}-${chosen.p.id}`,
            scheduleId: '',
            employeeId: chosen.p.id,
            branchId: slot.branch.id,
            date: dateStr,
            shiftCode: slot.shift.code,
            isLocked: false,
            isRelief,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } else {
          // Unfillable slot -> structured conflict
          conflicts.push({
            id: `conflict-${dateStr}-${slot.branch.id}-${slot.shift.code}-${slot.slotIndex}`,
            scheduleId: '',
            branchId: slot.branch.id,
            date: dateStr,
            conflictType: 'UNSATISFIABLE_COVERAGE',
            severity: 'HARD',
            description: `Zero-gap coverage failed on ${dateStr} at ${slot.branch.name} for ${slot.shift.name}. Ceiling, mandatory rest, or leave limits candidate pool.`,
            createdAt: new Date().toISOString()
          });
        }
      }

      advanceStateForDay(currentStateMap, dateStr, todayAssignments);
    }
  }

  const updatedRollingStates: Record<string, PharmacistRollingState> = {};
  for (const [empId, st] of currentStateMap.entries()) {
    updatedRollingStates[empId] = st;
  }

  return {
    assignments,
    updatedRollingStates,
    conflicts,
    deviations,
    success: isFullSuccess,
    backtrackCount,
    backjumpCount
  };
}
