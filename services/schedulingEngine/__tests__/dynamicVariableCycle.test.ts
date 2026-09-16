import { 
  solveDynamicVariableCycle, 
  validateConsecutiveDaysSetting, 
  resolveEffectiveMaxConsecutiveDays 
} from '../dynamicVariableCycleSolver';
import { 
  PharmacistSchedulingProfile, 
  Branch, 
  BranchShiftType, 
  DutyScheduleAssignment,
  DutySchedulerLeaveRecord,
  PharmacistRollingState
} from '../../../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`, detail !== undefined ? detail : '');
    failed++;
  }
}

console.log('=== Dynamic Variable Cycle Engine (Intelligent CSP-Based Rotation Solver) Tests ===\n');

// -----------------------------------------------------------------------------
// Test 1: Ceiling cap, exact boundary (Release-Blocking)
// -----------------------------------------------------------------------------
console.log('1. Test 1: Ceiling cap, exact boundary (Release-Blocking)');
{
  const branchA: Branch = { id: 'b-1', code: 'B1', name: 'Branch 1', is24Hour: false, isActive: true, role: 'branch' };
  const shiftM: BranchShiftType = { id: 's-m', branchId: 'b-1', code: 'AM', name: 'Morning', startTime: '08:00:00', endTime: '16:00:00', durationHours: 8, staffRequired: 1, isActive: true };

  const profileP1: PharmacistSchedulingProfile = {
    id: 'prof-p1',
    employeeId: 'p1',
    roleType: 'FIXED',
    primaryBranchId: 'b-1',
    workRestMode: 'DYNAMIC_VARIABLE_CYCLE',
    workRestConfig: { targetStreakMin: 4, targetStreakMax: 6, minRestDaysAfterStreak: 1 },
    patternStrictness: 'HARD',
    maximumConsecutiveWorkingDays: 8,
    maxConsecutiveWorkingDaysOverride: null, // Inherits global
    minimumRestHours: 11.0,
    isActive: true,
    createdAt: '',
    updatedAt: ''
  };

  const rollingStateP1: PharmacistRollingState = {
    id: 'rs-p1',
    employeeId: 'p1',
    scheduleId: 'prev-sched',
    consecutiveWorkingDays: 8, // Hit ceiling of 8 on last day of prior month!
    currentConsecutiveWorkingDays: 8,
    currentConsecutiveRestDays: 0,
    daysSinceWeeklyRest: 8,
    workloadScore: 8,
    totalWorkloadScore: 8,
    isOnActiveStreak: true,
    streakStartDate: '2026-08-24',
    createdAt: ''
  };

  const output = solveDynamicVariableCycle({
    periodStart: '2026-09-01',
    periodEnd: '2026-09-02',
    pharmacists: [{ id: 'p1', name: 'Pharmacist 1', profile: profileP1 }],
    rollingStates: { p1: rollingStateP1 },
    branches: [branchA],
    branchShiftRequirements: [shiftM],
    approvedLeave: [],
    globalMaxConsecutiveDays: 8
  });

  const day1Assignment = output.assignments.find(a => a.employeeId === 'p1' && a.date === '2026-09-01');
  assert(!day1Assignment, 'Day 1 MUST be assigned as rest; P1 cannot be assigned on Day 1');

  const conflictDay1 = output.conflicts.find(c => c.date === '2026-09-01');
  assert(!!conflictDay1 && conflictDay1.severity === 'HARD', 'Day 1 emits HARD conflict because only candidate is at ceiling');

  const p1State = output.updatedRollingStates['p1'];
  assert(p1State && p1State.currentConsecutiveWorkingDays <= 1, 'Streak reset occurred after mandatory rest on Day 1', p1State);
}

// -----------------------------------------------------------------------------
// Test 2: Attempted direct violation
// -----------------------------------------------------------------------------
console.log('\n2. Test 2: Attempted direct violation');
{
  const branchA: Branch = { id: 'b-1', code: 'B1', name: 'Branch 1', is24Hour: false, isActive: true, role: 'branch' };
  const shiftM: BranchShiftType = { id: 's-m', branchId: 'b-1', code: 'AM', name: 'Morning', startTime: '08:00:00', endTime: '16:00:00', durationHours: 8, staffRequired: 1, isActive: true };

  const profileP1: PharmacistSchedulingProfile = {
    id: 'prof-p1',
    employeeId: 'p1',
    roleType: 'FIXED',
    primaryBranchId: 'b-1',
    workRestMode: 'DYNAMIC_VARIABLE_CYCLE',
    workRestConfig: { targetStreakMin: 4, targetStreakMax: 6, minRestDaysAfterStreak: 2 },
    patternStrictness: 'HARD',
    maximumConsecutiveWorkingDays: 6,
    maxConsecutiveWorkingDaysOverride: 6, // Ceiling = 6
    minimumRestHours: 11.0,
    isActive: true,
    createdAt: '',
    updatedAt: ''
  };

  const output = solveDynamicVariableCycle({
    periodStart: '2026-09-01',
    periodEnd: '2026-09-08', // 8 consecutive days
    pharmacists: [{ id: 'p1', name: 'Pharmacist 1', profile: profileP1 }],
    rollingStates: {},
    branches: [branchA],
    branchShiftRequirements: [shiftM],
    approvedLeave: [],
    globalMaxConsecutiveDays: 8
  });

  const p1Assignments = output.assignments.filter(a => a.employeeId === 'p1');
  assert(p1Assignments.length === 6, 'Solver assigns exactly days 1-6 up to ceiling of 6', p1Assignments.length);

  const day7Assignment = output.assignments.find(a => a.employeeId === 'p1' && a.date === '2026-09-07');
  const day8Assignment = output.assignments.find(a => a.employeeId === 'p1' && a.date === '2026-09-08');
  assert(!day7Assignment, 'Solver REFUSES to assign day 7 to P1');
  assert(!day8Assignment, 'Solver REFUSES to assign day 8 (mandatory rest)');

  const conflictDay7 = output.conflicts.find(c => c.date === '2026-09-07');
  const conflictDay8 = output.conflicts.find(c => c.date === '2026-09-08');
  assert(!!conflictDay7, 'Emits structured DutyScheduleConflict for day 7');
  assert(!!conflictDay8, 'Emits structured DutyScheduleConflict for day 8');
}

// -----------------------------------------------------------------------------
// Test 3: Cross-month continuity, mid-streak (Release-Blocking)
// -----------------------------------------------------------------------------
console.log('\n3. Test 3: Cross-month continuity, mid-streak (Release-Blocking)');
{
  const branchA: Branch = { id: 'b-1', code: 'B1', name: 'Branch 1', is24Hour: false, isActive: true, role: 'branch' };
  const shiftM: BranchShiftType = { id: 's-m', branchId: 'b-1', code: 'AM', name: 'Morning', startTime: '08:00:00', endTime: '16:00:00', durationHours: 8, staffRequired: 1, isActive: true };

  const profileP1: PharmacistSchedulingProfile = {
    id: 'prof-p1',
    employeeId: 'p1',
    roleType: 'FIXED',
    primaryBranchId: 'b-1',
    workRestMode: 'DYNAMIC_VARIABLE_CYCLE',
    workRestConfig: { targetStreakMin: 4, targetStreakMax: 6, minRestDaysAfterStreak: 1 },
    patternStrictness: 'HARD',
    maximumConsecutiveWorkingDays: 8,
    minimumRestHours: 11.0,
    isActive: true,
    createdAt: '',
    updatedAt: ''
  };

  const rollingStateP1: PharmacistRollingState = {
    id: 'rs-p1',
    employeeId: 'p1',
    scheduleId: 'prev-sched',
    consecutiveWorkingDays: 5,
    currentConsecutiveWorkingDays: 5,
    currentConsecutiveRestDays: 0,
    daysSinceWeeklyRest: 5,
    workloadScore: 5,
    totalWorkloadScore: 5,
    isOnActiveStreak: true,
    streakStartDate: '2026-08-27',
    createdAt: ''
  };

  const output = solveDynamicVariableCycle({
    periodStart: '2026-09-01',
    periodEnd: '2026-09-05',
    pharmacists: [{ id: 'p1', name: 'Pharmacist 1', profile: profileP1 }],
    rollingStates: { p1: rollingStateP1 },
    branches: [branchA],
    branchShiftRequirements: [shiftM],
    approvedLeave: [],
    globalMaxConsecutiveDays: 8
  });

  const p1Dates = output.assignments.filter(a => a.employeeId === 'p1').map(a => a.date);
  assert(p1Dates.includes('2026-09-01'), 'Day 1 (2026-09-01) is assigned (streak day 6)');
  assert(p1Dates.includes('2026-09-02'), 'Day 2 (2026-09-02) is assigned (streak day 7)');
  assert(p1Dates.includes('2026-09-03'), 'Day 3 (2026-09-03) is assigned (streak day 8)');
  assert(!p1Dates.includes('2026-09-04'), 'Day 4 (2026-09-04) MUST be a rest day (ceiling 8 reached)');

  const conflictDay4 = output.conflicts.find(c => c.date === '2026-09-04');
  assert(!!conflictDay4, 'Conflict emitted for Day 4 when ceiling mandates rest', conflictDay4);
}

// -----------------------------------------------------------------------------
// Test 4: Cross-month continuity, resting
// -----------------------------------------------------------------------------
console.log('\n4. Test 4: Cross-month continuity, resting');
{
  const branchA: Branch = { id: 'b-1', code: 'B1', name: 'Branch 1', is24Hour: false, isActive: true, role: 'branch' };
  const shiftM: BranchShiftType = { id: 's-m', branchId: 'b-1', code: 'AM', name: 'Morning', startTime: '08:00:00', endTime: '16:00:00', durationHours: 8, staffRequired: 1, isActive: true };

  const profileP1: PharmacistSchedulingProfile = {
    id: 'prof-p1',
    employeeId: 'p1',
    roleType: 'FIXED',
    primaryBranchId: 'b-1',
    workRestMode: 'DYNAMIC_VARIABLE_CYCLE',
    workRestConfig: { targetStreakMin: 4, targetStreakMax: 6, minRestDaysAfterStreak: 1 },
    patternStrictness: 'HARD',
    maximumConsecutiveWorkingDays: 8,
    minimumRestHours: 11.0,
    isActive: true,
    createdAt: '',
    updatedAt: ''
  };

  const rollingStateP1: PharmacistRollingState = {
    id: 'rs-p1',
    employeeId: 'p1',
    scheduleId: 'prev-sched',
    consecutiveWorkingDays: 0,
    currentConsecutiveWorkingDays: 0,
    currentConsecutiveRestDays: 1, // On rest day
    daysSinceWeeklyRest: 0,
    workloadScore: 10,
    totalWorkloadScore: 10,
    isOnActiveStreak: false,
    streakStartDate: null,
    createdAt: ''
  };

  const output = solveDynamicVariableCycle({
    periodStart: '2026-09-01',
    periodEnd: '2026-09-03',
    pharmacists: [{ id: 'p1', name: 'Pharmacist 1', profile: profileP1 }],
    rollingStates: { p1: rollingStateP1 },
    branches: [branchA],
    branchShiftRequirements: [shiftM],
    approvedLeave: [],
    globalMaxConsecutiveDays: 8
  });

  const day1Assignment = output.assignments.find(a => a.employeeId === 'p1' && a.date === '2026-09-01');
  assert(!!day1Assignment, 'Day 1 of new period is eligible for work and assigned');

  const finalP1State = output.updatedRollingStates['p1'];
  assert(finalP1State && finalP1State.currentConsecutiveWorkingDays === 3, 'Consecutive working days incremented fresh to 3', finalP1State?.currentConsecutiveWorkingDays);
}

// -----------------------------------------------------------------------------
// Test 5: Backtracking correctness (CDBJ)
// -----------------------------------------------------------------------------
console.log('\n5. Test 5: Backtracking correctness (CDBJ)');
{
  const branch1: Branch = { id: 'b-1', code: 'B1', name: 'Branch 1', is24Hour: false, isActive: true, role: 'branch' };
  const branch2: Branch = { id: 'b-2', code: 'B2', name: 'Branch 2', is24Hour: false, isActive: true, role: 'branch' };

  const shiftB1: BranchShiftType = { id: 's-1', branchId: 'b-1', code: 'AM', name: 'Morning B1', startTime: '08:00:00', endTime: '16:00:00', durationHours: 8, staffRequired: 1, isActive: true };
  const shiftB2: BranchShiftType = { id: 's-2', branchId: 'b-2', code: 'AM', name: 'Morning B2', startTime: '08:00:00', endTime: '16:00:00', durationHours: 8, staffRequired: 1, isActive: true };

  // 3 pharmacists: P1, P2, P3
  // P1: FIXED B1, ceiling 5
  // P2: FIXED B2, ceiling 5
  // P3: RELIEF, ceiling 5
  const profileP1: PharmacistSchedulingProfile = {
    id: 'prof-p1', employeeId: 'p1', roleType: 'FIXED', primaryBranchId: 'b-1',
    workRestMode: 'DYNAMIC_VARIABLE_CYCLE', workRestConfig: { targetStreakMin: 3, targetStreakMax: 5, minRestDaysAfterStreak: 1 },
    patternStrictness: 'HARD', maximumConsecutiveWorkingDays: 5, maxConsecutiveWorkingDaysOverride: 5, minimumRestHours: 11.0, isActive: true, createdAt: '', updatedAt: ''
  };
  const profileP2: PharmacistSchedulingProfile = {
    id: 'prof-p2', employeeId: 'p2', roleType: 'FIXED', primaryBranchId: 'b-2',
    workRestMode: 'DYNAMIC_VARIABLE_CYCLE', workRestConfig: { targetStreakMin: 3, targetStreakMax: 5, minRestDaysAfterStreak: 1 },
    patternStrictness: 'HARD', maximumConsecutiveWorkingDays: 5, maxConsecutiveWorkingDaysOverride: 5, minimumRestHours: 11.0, isActive: true, createdAt: '', updatedAt: ''
  };
  const profileP3: PharmacistSchedulingProfile = {
    id: 'prof-p3', employeeId: 'p3', roleType: 'RELIEF', allowedBranchIds: ['b-1', 'b-2'],
    workRestMode: 'DYNAMIC_VARIABLE_CYCLE', workRestConfig: { targetStreakMin: 3, targetStreakMax: 5, minRestDaysAfterStreak: 1 },
    patternStrictness: 'HARD', maximumConsecutiveWorkingDays: 5, maxConsecutiveWorkingDaysOverride: 5, minimumRestHours: 11.0, isActive: true, createdAt: '', updatedAt: ''
  };

  const output = solveDynamicVariableCycle({
    periodStart: '2026-09-01',
    periodEnd: '2026-09-07', // 7 days x 2 branches = 14 shifts
    pharmacists: [
      { id: 'p1', name: 'P1', profile: profileP1 },
      { id: 'p2', name: 'P2', profile: profileP2 },
      { id: 'p3', name: 'P3', profile: profileP3 }
    ],
    rollingStates: {},
    branches: [branch1, branch2],
    branchShiftRequirements: [shiftB1, shiftB2],
    approvedLeave: [],
    globalMaxConsecutiveDays: 5
  });

  assert(output.success === true, 'CSP solver successfully solved 7-day schedule with full coverage', output.success);
  assert(output.assignments.length === 14, 'All 14 shifts across both branches are assigned', output.assignments.length);
  assert(output.conflicts.length === 0, 'Zero conflicts in completed schedule', output.conflicts.length);

  // Verify no pharmacist worked more than 5 consecutive days
  const shiftsByEmp: Record<string, string[]> = { p1: [], p2: [], p3: [] };
  for (const a of output.assignments) {
    shiftsByEmp[a.employeeId].push(a.date);
  }
  let maxConsec = 0;
  for (const empId of ['p1', 'p2', 'p3']) {
    const datesSorted = shiftsByEmp[empId].sort();
    let streak = 0;
    for (let i = 0; i < datesSorted.length; i++) {
      if (i > 0) {
        const prevD = new Date(datesSorted[i - 1] + 'T00:00:00Z');
        const currD = new Date(datesSorted[i] + 'T00:00:00Z');
        const diffDays = Math.round((currD.getTime() - prevD.getTime()) / (1000 * 3600 * 24));
        if (diffDays === 1) streak++;
        else streak = 1;
      } else {
        streak = 1;
      }
      if (streak > maxConsec) maxConsec = streak;
    }
  }
  assert(maxConsec <= 5, 'Inviolable ceiling respected: max consecutive working days <= 5', maxConsec);
}

// -----------------------------------------------------------------------------
// Test 6: Genuine unsatisfiability
// -----------------------------------------------------------------------------
console.log('\n6. Test 6: Genuine unsatisfiability');
{
  const branch1: Branch = { id: 'b-1', code: 'B1', name: 'Branch 1', is24Hour: false, isActive: true, role: 'branch' };
  const branch2: Branch = { id: 'b-2', code: 'B2', name: 'Branch 2', is24Hour: false, isActive: true, role: 'branch' };
  const shiftB1: BranchShiftType = { id: 's-1', branchId: 'b-1', code: 'AM', name: 'AM B1', startTime: '08:00:00', endTime: '16:00:00', durationHours: 8, staffRequired: 1, isActive: true };
  const shiftB2: BranchShiftType = { id: 's-2', branchId: 'b-2', code: 'AM', name: 'AM B2', startTime: '08:00:00', endTime: '16:00:00', durationHours: 8, staffRequired: 1, isActive: true };

  // Only 2 pharmacists, 2 branches need 1 each (total 2 shifts/day).
  // Ceiling = 4, minRestDaysAfterStreak = 2.
  // Over 6 days: after day 4, both MUST rest on days 5 and 6. Day 5 and 6 are mathematically impossible.
  const profileP1: PharmacistSchedulingProfile = {
    id: 'prof-p1', employeeId: 'p1', roleType: 'RELIEF', allowedBranchIds: ['b-1', 'b-2'],
    workRestMode: 'DYNAMIC_VARIABLE_CYCLE', workRestConfig: { targetStreakMin: 3, targetStreakMax: 4, minRestDaysAfterStreak: 2 },
    patternStrictness: 'HARD', maximumConsecutiveWorkingDays: 4, maxConsecutiveWorkingDaysOverride: 4, minimumRestHours: 11.0, isActive: true, createdAt: '', updatedAt: ''
  };
  const profileP2: PharmacistSchedulingProfile = {
    id: 'prof-p2', employeeId: 'p2', roleType: 'RELIEF', allowedBranchIds: ['b-1', 'b-2'],
    workRestMode: 'DYNAMIC_VARIABLE_CYCLE', workRestConfig: { targetStreakMin: 3, targetStreakMax: 4, minRestDaysAfterStreak: 2 },
    patternStrictness: 'HARD', maximumConsecutiveWorkingDays: 4, maxConsecutiveWorkingDaysOverride: 4, minimumRestHours: 11.0, isActive: true, createdAt: '', updatedAt: ''
  };

  const output = solveDynamicVariableCycle({
    periodStart: '2026-09-01',
    periodEnd: '2026-09-06',
    pharmacists: [
      { id: 'p1', name: 'P1', profile: profileP1 },
      { id: 'p2', name: 'P2', profile: profileP2 }
    ],
    rollingStates: {},
    branches: [branch1, branch2],
    branchShiftRequirements: [shiftB1, shiftB2],
    approvedLeave: [],
    globalMaxConsecutiveDays: 4
  });

  assert(output.success === false, 'Solver returns success = false for impossible coverage', output.success);
  assert(output.conflicts.length > 0, 'Structured conflicts emitted for unfillable slots', output.conflicts.length);
  assert(output.conflicts.some(c => c.conflictType === 'UNSATISFIABLE_COVERAGE'), 'Conflict type is UNSATISFIABLE_COVERAGE');

  // Verify zero ceiling violations
  for (const empId of ['p1', 'p2']) {
    const dates = output.assignments.filter(a => a.employeeId === empId).map(a => a.date).sort();
    let streak = 0;
    for (let i = 0; i < dates.length; i++) {
      if (i > 0) {
        const prevD = new Date(dates[i - 1] + 'T00:00:00Z');
        const currD = new Date(dates[i] + 'T00:00:00Z');
        if (Math.round((currD.getTime() - prevD.getTime()) / (1000 * 3600 * 24)) === 1) streak++;
        else streak = 1;
      } else {
        streak = 1;
      }
      assert(streak <= 4, `Pharmacist ${empId} never exceeds ceiling of 4 (streak=${streak})`);
    }
  }
}

// -----------------------------------------------------------------------------
// Test 7: Fairness / streak-length distribution
// -----------------------------------------------------------------------------
console.log('\n7. Test 7: Fairness / streak-length distribution');
{
  const branch1: Branch = { id: 'b-1', code: 'B1', name: 'Branch 1', is24Hour: false, isActive: true, role: 'branch' };
  const shiftB1: BranchShiftType = { id: 's-1', branchId: 'b-1', code: 'AM', name: 'Morning', startTime: '08:00:00', endTime: '16:00:00', durationHours: 8, staffRequired: 1, isActive: true };

  // 5 pharmacists, 30 days, 1 shift/day = 30 shifts total (average 6 shifts/pharmacist)
  // targetStreakMin = 4, targetStreakMax = 6, ceiling = 8
  const pharmacists = ['p1', 'p2', 'p3', 'p4', 'p5'].map(id => ({
    id,
    name: `Pharmacist ${id}`,
    profile: {
      id: `prof-${id}`,
      employeeId: id,
      roleType: 'RELIEF' as const,
      allowedBranchIds: ['b-1'],
      workRestMode: 'DYNAMIC_VARIABLE_CYCLE' as const,
      workRestConfig: { targetStreakMin: 4, targetStreakMax: 6, minRestDaysAfterStreak: 1 },
      patternStrictness: 'HARD' as const,
      maximumConsecutiveWorkingDays: 8,
      minimumRestHours: 11.0,
      isActive: true,
      createdAt: '',
      updatedAt: ''
    }
  }));

  const output = solveDynamicVariableCycle({
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30', // 30 days
    pharmacists,
    rollingStates: {},
    branches: [branch1],
    branchShiftRequirements: [shiftB1],
    approvedLeave: [],
    globalMaxConsecutiveDays: 8
  });

  assert(output.success === true, 'Solved 30-day single branch schedule successfully', output.success);
  assert(output.assignments.length === 30, 'All 30 days are assigned', output.assignments.length);

  // Compute shift counts
  const shiftCounts: Record<string, number> = {};
  for (const p of pharmacists) shiftCounts[p.id] = 0;
  for (const a of output.assignments) {
    shiftCounts[a.employeeId] = (shiftCounts[a.employeeId] || 0) + 1;
  }

  const counts = Object.values(shiftCounts);
  const avg = counts.reduce((acc, c) => acc + c, 0) / counts.length; // 30 / 5 = 6
  const variance = counts.reduce((acc, c) => acc + Math.pow(c - avg, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  assert(stdDev <= 2.0, `Workload standard deviation is fair (${stdDev.toFixed(2)} <= 2.0)`, counts);

  // Compute streak lengths
  const streaks: number[] = [];
  for (const p of pharmacists) {
    const dates = output.assignments.filter(a => a.employeeId === p.id).map(a => a.date).sort();
    let currentStreak = 0;
    for (let i = 0; i < dates.length; i++) {
      if (i > 0) {
        const prevD = new Date(dates[i - 1] + 'T00:00:00Z');
        const currD = new Date(dates[i] + 'T00:00:00Z');
        if (Math.round((currD.getTime() - prevD.getTime()) / (1000 * 3600 * 24)) === 1) {
          currentStreak++;
        } else {
          if (currentStreak > 0) streaks.push(currentStreak);
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
    }
    if (currentStreak > 0) streaks.push(currentStreak);
  }

  const avgStreak = streaks.reduce((acc, s) => acc + s, 0) / (streaks.length || 1);
  assert(avgStreak >= 4 && avgStreak <= 6, `Average streak length (${avgStreak.toFixed(1)}) falls within target [4, 6]`, streaks);
}

// -----------------------------------------------------------------------------
// Test 8: Leave interrupts streak
// -----------------------------------------------------------------------------
console.log('\n8. Test 8: Leave interrupts streak');
{
  const branch1: Branch = { id: 'b-1', code: 'B1', name: 'Branch 1', is24Hour: false, isActive: true, role: 'branch' };
  const shiftB1: BranchShiftType = { id: 's-1', branchId: 'b-1', code: 'AM', name: 'Morning', startTime: '08:00:00', endTime: '16:00:00', durationHours: 8, staffRequired: 1, isActive: true };

  const profileP1: PharmacistSchedulingProfile = {
    id: 'prof-p1', employeeId: 'p1', roleType: 'FIXED', primaryBranchId: 'b-1',
    workRestMode: 'DYNAMIC_VARIABLE_CYCLE', workRestConfig: { targetStreakMin: 4, targetStreakMax: 6, minRestDaysAfterStreak: 1 },
    patternStrictness: 'HARD', maximumConsecutiveWorkingDays: 8, minimumRestHours: 11.0, isActive: true, createdAt: '', updatedAt: ''
  };

  // P1 starts on Day 4 of active streak on 2026-09-01
  const rollingStateP1: PharmacistRollingState = {
    id: 'rs-p1',
    employeeId: 'p1',
    scheduleId: 'prev-sched',
    consecutiveWorkingDays: 4,
    currentConsecutiveWorkingDays: 4,
    currentConsecutiveRestDays: 0,
    daysSinceWeeklyRest: 4,
    workloadScore: 4,
    totalWorkloadScore: 4,
    isOnActiveStreak: true,
    streakStartDate: '2026-08-28',
    createdAt: ''
  };

  // Approved leave on days 2 and 3 (2026-09-02 and 2026-09-03)
  const leaveRecords: DutySchedulerLeaveRecord[] = [{
    id: 'leave-1',
    employeeId: 'p1',
    leaveType: 'ANNUAL',
    startDate: '2026-09-02',
    endDate: '2026-09-03',
    status: 'APPROVED',
    createdAt: '',
    updatedAt: ''
  }];

  const output = solveDynamicVariableCycle({
    periodStart: '2026-09-01',
    periodEnd: '2026-09-05',
    pharmacists: [{ id: 'p1', name: 'P1', profile: profileP1 }],
    rollingStates: { p1: rollingStateP1 },
    branches: [branch1],
    branchShiftRequirements: [shiftB1],
    approvedLeave: leaveRecords,
    globalMaxConsecutiveDays: 8
  });

  const p1Dates = output.assignments.filter(a => a.employeeId === 'p1').map(a => a.date);
  assert(!p1Dates.includes('2026-09-02'), 'Days on leave (2026-09-02) are non-working days');
  assert(!p1Dates.includes('2026-09-03'), 'Days on leave (2026-09-03) are non-working days');

  // Day 4 (2026-09-04) should start a FRESH streak of 1, not continue at day 5 or 6!
  assert(p1Dates.includes('2026-09-04'), 'Day after leave (2026-09-04) is assigned');
  const finalState = output.updatedRollingStates['p1'];
  assert(finalState && finalState.currentConsecutiveWorkingDays === 2, 'Streak count was reset by leave and restarted fresh (current=2 on Day 5)', finalState?.currentConsecutiveWorkingDays);
}

// -----------------------------------------------------------------------------
// Test 9: Config validation
// -----------------------------------------------------------------------------
console.log('\n9. Test 9: Config validation');
{
  assert(validateConsecutiveDaysSetting(0).isValid === false, '0 is rejected with validation error');
  assert(validateConsecutiveDaysSetting(-1).isValid === false, '-1 is rejected with validation error');
  assert(validateConsecutiveDaysSetting(8.5).isValid === false, '8.5 is rejected with validation error');
  assert(validateConsecutiveDaysSetting(8).isValid === true, '8 is accepted');
  assert(validateConsecutiveDaysSetting(14).isValid === true, '14 is accepted without artificial upper clamp');

  // Profile overrides
  assert(validateConsecutiveDaysSetting(0).isValid === false, 'Profile override 0 is rejected');
  assert(resolveEffectiveMaxConsecutiveDays({ maxConsecutiveWorkingDaysOverride: null } as any, 8) === 8, 'Profile override null inherits global 8');
  assert(resolveEffectiveMaxConsecutiveDays({ maxConsecutiveWorkingDaysOverride: 10 } as any, 8) === 10, 'Profile override 10 looser than global 8 is accepted');
  assert(resolveEffectiveMaxConsecutiveDays({ maxConsecutiveWorkingDaysOverride: 5 } as any, 8) === 5, 'Profile override 5 tighter than global 8 is accepted');
}

// -----------------------------------------------------------------------------
// Test 10: Effective ceiling resolution
// -----------------------------------------------------------------------------
console.log('\n10. Test 10: Effective ceiling resolution');
{
  const profNull = { maxConsecutiveWorkingDaysOverride: null } as any;
  const prof6 = { maxConsecutiveWorkingDaysOverride: 6 } as any;
  const prof10 = { maxConsecutiveWorkingDaysOverride: 10 } as any;
  const profUndef = {} as any;

  assert(resolveEffectiveMaxConsecutiveDays(profNull, 8) === 8, 'Override null, global 8 -> returns 8');
  assert(resolveEffectiveMaxConsecutiveDays(prof6, 8) === 6, 'Override 6, global 8 -> returns 6 (tighter override wins)');
  assert(resolveEffectiveMaxConsecutiveDays(prof10, 8) === 10, 'Override 10, global 8 -> returns 10 (looser override wins)');
  assert(resolveEffectiveMaxConsecutiveDays(profUndef, 8) === 8, 'Override undefined, global 8 -> returns 8');
  assert(resolveEffectiveMaxConsecutiveDays(undefined, undefined) === 8, 'Global undefined -> returns 8 (default)');
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log(`\n=== Dynamic Variable Cycle Tests: ${passed} Passed, ${failed} Failed ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL 10 DYNAMIC VARIABLE CYCLE ENGINE TESTS PASSED!\n');
}
