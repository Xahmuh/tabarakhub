import {
  DutyScheduleAssignment,
  DutyScheduleConflict,
  PharmacistSchedulingProfile,
  DutySchedulerLeaveRecord,
  Branch,
  BranchShiftType,
  PharmacistRollingState,
  SchedulingPeriodAdjustments
} from '../../types';
import { 
  calculateShiftDatetimes, 
  validateMinimumRest, 
  isShiftAllowedForPharmacist 
} from './shiftTransitions';
import { resolveEffectiveMaxConsecutiveDays } from './dynamicVariableCycleSolver';
import { advanceRollingState, RollingPharmacistState } from './workRestPatterns';

export interface ScheduleSmoothingInput {
  assignments: DutyScheduleAssignment[];
  dates: string[];
  profiles: PharmacistSchedulingProfile[];
  branches: Branch[];
  shiftRequirements?: BranchShiftType[];
  leaves?: DutySchedulerLeaveRecord[];
  specialRestDaysMap?: Map<string, Set<string>>;
  previousRollingState?: PharmacistRollingState[];
  globalMaxConsecutiveDays?: number;
  pharmacistShiftCapMap?: Map<string, number>;
  periodAdjustments?: SchedulingPeriodAdjustments;
  weekendDateInfoMap?: Map<string, { weekendIndex: number; isFriday: boolean; isSaturday: boolean }>;
}

export interface ScheduleSmoothingOutput {
  assignments: DutyScheduleAssignment[];
  newRollingState: PharmacistRollingState[];
  repairedCount: number;
}

/**
 * Schedule Smoothing & Rest Day Clustering Pass:
 * 
 * Specifically eliminates isolated single-day work shifts ("sandwich shifts": [REST] -> [1 DAY WORK] -> [REST])
 * and groups weekly off-days into consecutive pairs (e.g. 2 contiguous days off), fulfilling the strict
 * operational requirement that employees should never be given 1 isolated day of work between two rest days.
 */
export function smoothScheduleAndGroupRestDays(
  input: ScheduleSmoothingInput
): ScheduleSmoothingOutput {
  const {
    assignments,
    dates,
    profiles,
    branches,
    shiftRequirements = [],
    leaves = [],
    specialRestDaysMap = new Map(),
    previousRollingState = [],
    globalMaxConsecutiveDays = 8,
    pharmacistShiftCapMap,
    periodAdjustments,
    weekendDateInfoMap
  } = input;

  if (!dates || dates.length < 3 || assignments.length === 0) {
    // Cannot have a sandwich pattern with fewer than 3 days
    return {
      assignments,
      newRollingState: rebuildRollingState(assignments, dates, profiles, previousRollingState),
      repairedCount: 0
    };
  }

  // Helper for alternating weekend rotation protection in smoothing
  const getWeekendDesignation = (empId: string, weekendIndex: number): 'FRIDAY_OFF' | 'SATURDAY_OFF' | null => {
    if (!periodAdjustments?.weekendPharmacistIds || periodAdjustments.weekendPharmacistIds.length === 0) {
      return null;
    }
    const targetId = String(empId).trim().toLowerCase();
    const idx = periodAdjustments.weekendPharmacistIds.findIndex(id => String(id).trim().toLowerCase() === targetId);
    if (idx === -1) return null;
    return (idx + weekendIndex) % 2 === 0 ? 'FRIDAY_OFF' : 'SATURDAY_OFF';
  };

  const isRestrictedByWeekendRotation = (empId: string, dateStr: string): boolean => {
    if (!weekendDateInfoMap) return false;
    const wInfo = weekendDateInfoMap.get(dateStr);
    if (!wInfo) return false;
    const des = getWeekendDesignation(empId, wInfo.weekendIndex);
    if (des === 'FRIDAY_OFF' && wInfo.isFriday) return true;
    if (des === 'SATURDAY_OFF' && wInfo.isSaturday) return true;
    return false;
  };

  // Work on a mutable copy of assignments
  const workingAssignments: DutyScheduleAssignment[] = assignments.map(a => ({ ...a }));

  // Helper maps for O(1) lookups
  const profileMap = new Map<string, PharmacistSchedulingProfile>();
  for (const p of profiles) {
    profileMap.set(p.employeeId, p);
  }

  const branchMap = new Map<string, Branch>();
  for (const b of branches) {
    branchMap.set(b.id, b);
  }

  // Map shift requirement by branch and code
  const shiftReqMap = new Map<string, BranchShiftType>();
  for (const sr of shiftRequirements) {
    shiftReqMap.set(`${sr.branchId}_${sr.code.toUpperCase()}`, sr);
  }

  // Helper to check if employee is on leave on a date
  const isEmpOnLeave = (empId: string, dateStr: string): boolean => {
    const targetId = String(empId).trim().toLowerCase();
    return leaves.some(l => {
      const lId = String(l.employeeId || (l as any).employee_id || '').trim().toLowerCase();
      if (lId !== targetId) return false;
      const status = String(l.status || 'APPROVED').trim().toUpperCase();
      if (status === 'REJECTED' || status === 'CANCELLED') return false;
      const s = String(l.startDate || (l as any).start_date || '').split('T')[0];
      const e = String(l.endDate || (l as any).end_date || '').split('T')[0];
      return s <= dateStr && e >= dateStr;
    });
  };

  const isEmpOnSpecialRest = (empId: string, dateStr: string): boolean => {
    const targetId = String(empId).trim().toLowerCase();
    return specialRestDaysMap.get(targetId)?.has(dateStr) ?? false;
  };

  let repairedCount = 0;
  const maxPasses = 3;

  for (let pass = 0; pass < maxPasses; pass++) {
    let passRepaired = 0;

    // Index assignments: [employeeId][dateStr] -> DutyScheduleAssignment
    const empDateMap = new Map<string, Map<string, DutyScheduleAssignment>>();
    // Index assignments: [dateStr] -> DutyScheduleAssignment[]
    const dateAssignmentsMap = new Map<string, DutyScheduleAssignment[]>();

    for (const a of workingAssignments) {
      if (!empDateMap.has(a.employeeId)) {
        empDateMap.set(a.employeeId, new Map());
      }
      empDateMap.get(a.employeeId)!.set(a.date, a);

      if (!dateAssignmentsMap.has(a.date)) {
        dateAssignmentsMap.set(a.date, []);
      }
      dateAssignmentsMap.get(a.date)!.push(a);
    }

    // Inspect each employee's schedule across all dates
    for (const profile of profiles) {
      const empId = profile.employeeId;
      const empSchedule = empDateMap.get(empId) || new Map();

      for (let i = 1; i < dates.length - 1; i++) {
        const prevDate = dates[i - 1];
        const currDate = dates[i];
        const nextDate = dates[i + 1];

        const hasPrev = empSchedule.has(prevDate);
        const hasCurr = empSchedule.has(currDate);
        const hasNext = empSchedule.has(nextDate);

        // Check for isolated single work day (The "Sandwich Shift"):
        // OFF on prevDate, WORK on currDate, OFF on nextDate
        const isIsolatedWorkDay = !hasPrev && hasCurr && !hasNext;
        if (!isIsolatedWorkDay) continue;

        const currentAssignment = empSchedule.get(currDate)!;
        if (currentAssignment.isLocked) continue; // Locked shifts cannot be moved

        // Find candidate peer pharmacists who can take currDate shift or swap to eliminate the sandwich:
        // Strategy A: Direct Peer Coverage
        // Look for a peer B who is OFF on currDate, but IS WORKING on prevDate or nextDate (so working currDate connects their streak!)
        // and is fully qualified for this shift.
        let swapped = false;

        const candidatePeers = profiles.filter(p => {
          if (p.employeeId === empId) return false;
          if (!p.isActive) return false;

          const pSchedule = empDateMap.get(p.employeeId) || new Map();
          // Peer must be OFF on currDate
          if (pSchedule.has(currDate)) return false;
          // Peer must NOT be on leave or special rest
          if (isEmpOnLeave(p.employeeId, currDate)) return false;
          if (isEmpOnSpecialRest(p.employeeId, currDate)) return false;
          // Peer must NOT be restricted by alternating weekend rotation on currDate (Rule 3)
          if (isRestrictedByWeekendRotation(p.employeeId, currDate)) return false;

          // Crucial: Peer SHOULD BE WORKING on prevDate or nextDate so taking currDate GROUPS their working days!
          const peerWorksPrev = pSchedule.has(prevDate);
          const peerWorksNext = pSchedule.has(nextDate);
          if (!peerWorksPrev && !peerWorksNext) return false;

          // Branch qualification
          if (p.roleType === 'FIXED') {
            if (p.primaryBranchId && p.primaryBranchId !== currentAssignment.branchId) return false;
          } else {
            if (p.allowedBranchIds && p.allowedBranchIds.length > 0) {
              if (!p.allowedBranchIds.includes(currentAssignment.branchId)) return false;
            }
          }

          // Shift qualification
          const shiftReq: BranchShiftType = shiftReqMap.get(`${currentAssignment.branchId}_${currentAssignment.shiftCode.toUpperCase()}`) || {
            id: 'temp',
            branchId: currentAssignment.branchId,
            code: currentAssignment.shiftCode,
            name: currentAssignment.shiftCode,
            startTime: '08:00:00',
            endTime: '16:00:00',
            staffRequired: 1
          };
          if (!isShiftAllowedForPharmacist(p, shiftReq)) return false;

          // Check consecutive working days ceiling for peer
          let peerConsec = 0;
          // Check backwards from currDate
          let bIdx = i - 1;
          while (bIdx >= 0 && (empDateMap.get(p.employeeId)?.has(dates[bIdx]))) {
            peerConsec++;
            bIdx--;
          }
          // Check forwards from currDate
          let fIdx = i + 1;
          while (fIdx < dates.length && (empDateMap.get(p.employeeId)?.has(dates[fIdx]))) {
            peerConsec++;
            fIdx++;
          }

          const peerMax = resolveEffectiveMaxConsecutiveDays(p, globalMaxConsecutiveDays);
          if (peerConsec + 1 > peerMax) return false;

          return true;
        });

        // Try swapping with a candidate peer
        for (const peer of candidatePeers) {
          // Look for an opportunity to balance workload:
          // Does peer have an assignment on another date that can be given to empId (so both keep the same total shifts),
          // OR can empId simply take rest on currDate?
          const peerSchedule = empDateMap.get(peer.employeeId) || new Map();

          // Search for a date where peer is working and empId could work contiguously (e.g. adjacent to another empId shift)
          let compensatoryDate: string | null = null;
          let compensatoryAssignment: DutyScheduleAssignment | null = null;

          for (const [pDate, pAss] of peerSchedule.entries()) {
            if (pAss.isLocked) continue;
            if (pDate === currDate) continue;
            // empId must be OFF on pDate
            if (empSchedule.has(pDate)) continue;
            if (isEmpOnLeave(empId, pDate) || isEmpOnSpecialRest(empId, pDate)) continue;
            // empId must NOT be restricted by alternating weekend rotation on compensatory date (Rule 3)
            if (isRestrictedByWeekendRotation(empId, pDate)) continue;

            // empId must be working adjacent to pDate (so it doesn't create another sandwich for empId!)
            const pIdx = dates.indexOf(pDate);
            if (pIdx <= 0 || pIdx >= dates.length - 1) continue;
            const empAdjacent = empSchedule.has(dates[pIdx - 1]) || empSchedule.has(dates[pIdx + 1]);
            if (!empAdjacent) continue;

            // empId must be qualified for peer's shift
            if (profile.roleType === 'FIXED') {
              if (profile.primaryBranchId && profile.primaryBranchId !== pAss.branchId) continue;
            } else {
              if (profile.allowedBranchIds && profile.allowedBranchIds.length > 0) {
                if (!profile.allowedBranchIds.includes(pAss.branchId)) continue;
              }
            }

            const pShiftReq: BranchShiftType = shiftReqMap.get(`${pAss.branchId}_${pAss.shiftCode.toUpperCase()}`) || {
              id: 'temp',
              branchId: pAss.branchId,
              code: pAss.shiftCode,
              name: pAss.shiftCode,
              startTime: '08:00:00',
              endTime: '16:00:00',
              staffRequired: 1
            };
            if (!isShiftAllowedForPharmacist(profile, pShiftReq)) continue;

            // Valid compensatory date found!
            compensatoryDate = pDate;
            compensatoryAssignment = pAss;
            break;
          }

          if (compensatoryAssignment && compensatoryDate) {
            // Two-way balanced swap:
            // 1. Peer takes currDate shift
            currentAssignment.employeeId = peer.employeeId;
            currentAssignment.isRelief = peer.roleType === 'RELIEF';
            currentAssignment.updatedAt = new Date().toISOString();

            // 2. Original empId takes compensatory shift
            compensatoryAssignment.employeeId = empId;
            compensatoryAssignment.isRelief = profile.roleType === 'RELIEF';
            compensatoryAssignment.updatedAt = new Date().toISOString();

            swapped = true;
            passRepaired++;
            break;
          } else {
            // One-way transfer if peer has lower workload and can absorb the shift without exceeding surplus shiftCap (Rule 2)
            const empTotal = empSchedule.size;
            const peerTotal = peerSchedule.size;
            const peerCap = pharmacistShiftCapMap?.get(peer.employeeId);

            if (peerTotal < empTotal && (peerCap === undefined || peerTotal + 1 <= peerCap)) {
              currentAssignment.employeeId = peer.employeeId;
              currentAssignment.isRelief = peer.roleType === 'RELIEF';
              currentAssignment.updatedAt = new Date().toISOString();

              swapped = true;
              passRepaired++;
              break;
            }
          }
        }

        if (swapped) {
          repairedCount++;
          // Break out of inner loop to rebuild maps for consistency
          break;
        }
      }
    }

    if (passRepaired === 0) {
      break; // Converged
    }
  }

  // Rebuild rolling state map from the polished assignments to guarantee zero drift
  const newRollingState = rebuildRollingState(workingAssignments, dates, profiles, previousRollingState);

  return {
    assignments: workingAssignments,
    newRollingState,
    repairedCount
  };
}

/**
 * Rebuilds authoritative rolling state across the period from the final assignments.
 */
function rebuildRollingState(
  assignments: DutyScheduleAssignment[],
  dates: string[],
  profiles: PharmacistSchedulingProfile[],
  previousRollingState: PharmacistRollingState[]
): PharmacistRollingState[] {
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

  const assignmentsByDate = new Map<string, Set<string>>();
  const assignmentDetailMap = new Map<string, DutyScheduleAssignment>();

  for (const a of assignments) {
    if (!assignmentsByDate.has(a.date)) {
      assignmentsByDate.set(a.date, new Set());
    }
    assignmentsByDate.get(a.date)!.add(a.employeeId);
    assignmentDetailMap.set(`${a.date}_${a.employeeId}`, a);
  }

  for (const dateStr of dates) {
    const dateObj = new Date(dateStr + 'T00:00:00Z');
    const dayOfWeek = dateObj.getUTCDay();
    const isWeekend = dayOfWeek === 5;

    if (dayOfWeek === 0) {
      for (const st of stateMap.values()) {
        st.weeklyWorkingDaysAssigned = 0;
      }
    }

    const assignedToday = assignmentsByDate.get(dateStr) || new Set();

    for (const profile of profiles) {
      const empId = profile.employeeId;
      const st = stateMap.get(empId);
      if (!st) continue;

      if (assignedToday.has(empId)) {
        const ass = assignmentDetailMap.get(`${dateStr}_${empId}`);
        const next = advanceRollingState(
          profile,
          st,
          true,
          ass?.shiftCode,
          ass?.branchId
        );
        next.totalWorkloadScore += 1.0;
        if (isWeekend) next.weekendAssignmentCount += 1;
        stateMap.set(empId, next);
      } else {
        const next = advanceRollingState(profile, st, false);
        stateMap.set(empId, next);
      }
    }
  }

  const result: PharmacistRollingState[] = [];
  for (const [empId, st] of stateMap.entries()) {
    result.push({
      id: crypto.randomUUID(),
      employeeId: empId,
      scheduleId: '',
      consecutiveWorkingDays: st.currentConsecutiveWorkingDays,
      currentConsecutiveWorkingDays: st.currentConsecutiveWorkingDays,
      currentConsecutiveRestDays: st.currentConsecutiveRestDays,
      currentPatternCycleIndex: st.currentPatternCycleIndex,
      lastShiftType: st.lastShiftType || undefined,
      lastBranchId: st.lastBranchId || undefined,
      lastShiftEndTime: st.lastShiftEndDatetime || undefined,
      lastShiftEndDatetime: st.lastShiftEndDatetime || undefined,
      daysSinceWeeklyRest: st.currentConsecutiveWorkingDays,
      workloadScore: Number(st.totalWorkloadScore.toFixed(2)),
      totalWorkloadScore: Number(st.totalWorkloadScore.toFixed(2)),
      recentWorkloadScore: Number(st.recentWorkloadScore.toFixed(2)),
      weekendAssignmentCount: st.weekendAssignmentCount,
      createdAt: new Date().toISOString()
    });
  }

  return result;
}
