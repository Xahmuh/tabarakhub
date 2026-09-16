import { generateSchedule } from '../../schedulingEngine';
import { 
  evaluateWorkRestPattern, 
  evaluateCustomCalendar,
  advanceRollingState, 
  RollingPharmacistState 
} from '../workRestPatterns';
import { 
  calculateShiftDatetimes, 
  validateMinimumRest, 
  isShiftAllowedForPharmacist 
} from '../shiftTransitions';
import { 
  PharmacistSchedulingProfile, 
  Branch, 
  BranchShiftType, 
  DutyScheduleAssignment 
} from '../../../types';

// Simple test harness
let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`, detail || '');
    failed++;
  }
}

console.log('=== Automated Duty Scheduler: Unit Test Suite (Spec v1.0) ===\n');

// -----------------------------------------------------------------------------
// TEST SUITE 1: Work/Rest Pattern Modes (§6.2, §14.3)
// -----------------------------------------------------------------------------
console.log('1. Testing Work/Rest Pattern Modes:');

// 1.1 DAYS_PER_WEEK: 3 days/week pharmacist must NOT be forced into 6 days
const p3Days: PharmacistSchedulingProfile = {
  id: 'p-3day',
  employeeId: 'emp-3day',
  roleType: 'FIXED',
  workRestMode: 'DAYS_PER_WEEK',
  workRestConfig: { target_days_per_week: 3, preferredRestDays: [5] }, // Friday off
  patternStrictness: 'HARD',
  maximumConsecutiveWorkingDays: 6,
  minimumRestHours: 11.0,
  isActive: true,
  createdAt: '',
  updatedAt: ''
};

const state3DaysInit: RollingPharmacistState = {
  employeeId: 'emp-3day',
  currentConsecutiveWorkingDays: 0,
  currentConsecutiveRestDays: 0,
  currentPatternCycleIndex: 0,
  totalWorkloadScore: 0,
  recentWorkloadScore: 0,
  weekendAssignmentCount: 0
};

// If already assigned 3 days this week:
const res3DaysHitQuota = evaluateWorkRestPattern(p3Days, state3DaysInit, '2026-09-16', 3, 3);
assert(res3DaysHitQuota.decision === 'MUST_REST', 'DAYS_PER_WEEK: 3-day pharmacist rests after 3 days worked in week', res3DaysHitQuota);

// 1.2 FIXED_CYCLE: 5 work / 2 rest cycle across period boundary
const pFixedCycle: PharmacistSchedulingProfile = {
  id: 'p-fixed',
  employeeId: 'emp-fixed',
  roleType: 'FIXED',
  workRestMode: 'FIXED_CYCLE',
  workRestConfig: { work_days: 5, rest_days: 2 },
  patternStrictness: 'HARD',
  maximumConsecutiveWorkingDays: 6,
  minimumRestHours: 11.0,
  isActive: true,
  createdAt: '',
  updatedAt: ''
};

// Spans boundary: pharmacist finished previous month at 5 consecutive work days
const stateFixedBoundary: RollingPharmacistState = {
  employeeId: 'emp-fixed',
  currentConsecutiveWorkingDays: 5,
  currentConsecutiveRestDays: 0,
  currentPatternCycleIndex: 0,
  totalWorkloadScore: 5,
  recentWorkloadScore: 5,
  weekendAssignmentCount: 0
};

const resFixedCycleRest = evaluateWorkRestPattern(pFixedCycle, stateFixedBoundary, '2026-09-01', 2);
assert(resFixedCycleRest.decision === 'MUST_REST', 'FIXED_CYCLE: Rest is mandated when 5 work days streak reached across boundary', resFixedCycleRest);

// 1.3 VARIABLE_CYCLE: [6, 7, 3, 8] streak array evaluation & rolling index
const pVariableCycle: PharmacistSchedulingProfile = {
  id: 'p-var',
  employeeId: 'emp-var',
  roleType: 'FIXED',
  workRestMode: 'VARIABLE_CYCLE',
  workRestConfig: { cycle: [6, 7, 3, 8], mode: 'REPEATING' },
  patternStrictness: 'HARD',
  maximumConsecutiveWorkingDays: 8,
  minimumRestHours: 11.0,
  isActive: true,
  createdAt: '',
  updatedAt: ''
};

// Boundary case: cycle index 0 (target 6), already worked 5 days at end of previous schedule
const stateVarBoundary: RollingPharmacistState = {
  employeeId: 'emp-var',
  currentConsecutiveWorkingDays: 5,
  currentConsecutiveRestDays: 0,
  currentPatternCycleIndex: 0,
  totalWorkloadScore: 5,
  recentWorkloadScore: 5,
  weekendAssignmentCount: 0
};

// Next day should continue work to reach target 6
const resVarWork = evaluateWorkRestPattern(pVariableCycle, stateVarBoundary, '2026-09-01', 2);
assert(resVarWork.decision === 'MUST_WORK' || resVarWork.decision === 'PREFER_WORK', 'VARIABLE_CYCLE: Continues working to complete target streak 6 across boundary');

// After working day 6:
const stateVarDay6 = advanceRollingState(pVariableCycle, stateVarBoundary, true);
const resVarRestDue = evaluateWorkRestPattern(pVariableCycle, stateVarDay6, '2026-09-02', 3);
assert(resVarRestDue.decision === 'MUST_REST', 'VARIABLE_CYCLE: Rest is enforced when streak 6 is completed');

// After resting 1 day: cycle index advances to 1 (target 7)
const stateVarRested = advanceRollingState(pVariableCycle, stateVarDay6, false);
assert(stateVarRested.currentPatternCycleIndex === 1, 'VARIABLE_CYCLE: Cycle index advances from 0 to 1 after rest occasion', stateVarRested);
const resVarNextStreak = evaluateWorkRestPattern(pVariableCycle, stateVarRested, '2026-09-03', 4);
assert(resVarNextStreak.targetStreak === 7, 'VARIABLE_CYCLE: Next target streak is 7 at cycle index 1');

// 1.4 CUSTOM_CALENDAR: Explicit day sequence anchored to calendar date
const pCustom: PharmacistSchedulingProfile = {
  id: 'p-cust',
  employeeId: 'emp-cust',
  roleType: 'FIXED',
  workRestMode: 'CUSTOM_CALENDAR',
  workRestConfig: { calendar: ['W', 'W', 'O', 'W', 'W'], anchor_date: '2026-09-01' },
  patternStrictness: 'HARD',
  maximumConsecutiveWorkingDays: 6,
  minimumRestHours: 11.0,
  isActive: true,
  createdAt: '',
  updatedAt: ''
};

const resCustomDay0 = evaluateCustomCalendar(pCustom, state3DaysInit, '2026-09-01');
const resCustomDay2 = evaluateCustomCalendar(pCustom, state3DaysInit, '2026-09-03');
assert(resCustomDay0.decision === 'MUST_WORK', 'CUSTOM_CALENDAR: Day offset 0 is WORK');
assert(resCustomDay2.decision === 'MUST_REST', 'CUSTOM_CALENDAR: Day offset 2 is OFF');


// -----------------------------------------------------------------------------
// TEST SUITE 2: Timestamp-based Minimum Rest & Shift Transitions (§10.3)
// -----------------------------------------------------------------------------
console.log('\n2. Testing Timestamp-based Minimum Rest & Shift Transitions:');

// Scenario A: PM shift (ends 23:00 on Mon) -> AM shift (starts 07:00 on Tue)
// Actual gap is 8.0 hours. Minimum required is 11.0 hours.
const lastEndMon23 = '2026-09-14T23:00:00+03:00';
const candidateStartTue07 = '2026-09-15T07:00:00+03:00';
const restCheckInsufficient = validateMinimumRest(lastEndMon23, candidateStartTue07, 11.0);
assert(!restCheckInsufficient.isValid && restCheckInsufficient.gapHours === 8, 
  `PM(Mon 23:00) -> AM(Tue 07:00): Correctly BLOCKED (gap=${restCheckInsufficient.gapHours}h < 11h)`);

// Scenario B: PM shift (ends 20:00 on Mon) -> AM shift (starts 08:00 on Tue)
// Actual gap is 12.0 hours. Minimum required is 11.0 hours.
const lastEndMon20 = '2026-09-14T20:00:00+03:00';
const candidateStartTue08 = '2026-09-15T08:00:00+03:00';
const restCheckSufficient = validateMinimumRest(lastEndMon20, candidateStartTue08, 11.0);
assert(restCheckSufficient.isValid && restCheckSufficient.gapHours === 12, 
  `PM(Mon 20:00) -> AM(Tue 08:00): Correctly ALLOWED (gap=${restCheckSufficient.gapHours}h >= 11h)`);

// Scenario C: Midnight crossing: Night shift (23:00 -> 07:00 next day)
const nightShift: BranchShiftType = {
  id: 'shift-night',
  branchId: 'b-1',
  code: 'NIGHT',
  name: 'Night Shift',
  startTime: '23:00:00',
  endTime: '07:00:00',
  staffRequired: 1
};
const nightWindow = calculateShiftDatetimes('2026-09-14', nightShift);
assert(nightWindow.endDatetime === '2026-09-15T07:00:00+03:00', 'Midnight crossing: NIGHT shift end timestamp is next calendar day 07:00+03:00');

// Shift eligibility check
const pFixedAM: PharmacistSchedulingProfile = {
  ...p3Days,
  allowedShiftTypes: ['AM_ONLY']
};
assert(isShiftAllowedForPharmacist(pFixedAM, { ...nightShift, code: 'AM', startTime: '08:00:00', endTime: '16:00:00' }), 'AM_ONLY pharmacist allowed AM shift');
assert(!isShiftAllowedForPharmacist(pFixedAM, nightShift), 'AM_ONLY pharmacist blocked from NIGHT shift');


// -----------------------------------------------------------------------------
// TEST SUITE 3: Multi-Shift Slot Solving (24h vs Non-24h Branches, §9.2)
// -----------------------------------------------------------------------------
console.log('\n3. Testing Multi-Shift Slot Solving (24h vs Non-24h branches):');

const branch24h: Branch = { id: 'branch-24h', code: 'B24', name: 'Sanad 24h', is24Hour: true, isActive: true, role: 'branch' };
const branchStandard: Branch = { id: 'branch-std', code: 'BSTD', name: 'Riffa Non-24h', is24Hour: false, isActive: true, role: 'branch' };

// Profiles to staff branches
const staffProfiles: PharmacistSchedulingProfile[] = [
  { ...pFixedCycle, id: 'p1', employeeId: 'emp-1', primaryBranchId: 'branch-24h', roleType: 'FIXED', allowedShiftTypes: ['AM_ONLY'] },
  { ...pFixedCycle, id: 'p2', employeeId: 'emp-2', primaryBranchId: 'branch-24h', roleType: 'FIXED', allowedShiftTypes: ['PM_ONLY'] },
  { ...pFixedCycle, id: 'p3', employeeId: 'emp-3', primaryBranchId: 'branch-24h', roleType: 'FIXED', allowedShiftTypes: ['NIGHT_ONLY'] },
  { ...pFixedCycle, id: 'p4', employeeId: 'emp-4', primaryBranchId: 'branch-std', roleType: 'FIXED', allowedShiftTypes: ['AM_ONLY'] },
  { ...pFixedCycle, id: 'p5', employeeId: 'emp-5', primaryBranchId: 'branch-std', roleType: 'FIXED', allowedShiftTypes: ['PM_ONLY'] },
  { ...pFixedCycle, id: 'pRelief', employeeId: 'emp-relief', roleType: 'RELIEF', allowedBranchIds: ['branch-24h', 'branch-std'], allowedShiftTypes: ['MIXED'] }
];

const genOutput = generateSchedule({
  scheduleId: 'sched-test-1',
  startDate: new Date('2026-09-01'),
  endDate: new Date('2026-09-01'), // 1 day
  profiles: staffProfiles,
  leaves: [],
  branches: [branch24h, branchStandard]
});

const b24Assignments = genOutput.assignments.filter(a => a.branchId === 'branch-24h');
const bStdAssignments = genOutput.assignments.filter(a => a.branchId === 'branch-std');

assert(b24Assignments.length === 3, `24h branch has 3 distinct shift slots generated (actual: ${b24Assignments.length})`);
assert(bStdAssignments.length === 2, `Non-24h branch has 2 distinct shift slots generated (actual: ${bStdAssignments.length})`);
const shiftCodes24 = new Set(b24Assignments.map(a => a.shiftCode));
assert(shiftCodes24.has('AM') && shiftCodes24.has('PM') && shiftCodes24.has('NIGHT'), '24h branch contains distinct AM, PM, and NIGHT slots');


// -----------------------------------------------------------------------------
// TEST SUITE 4: Locked Assignments & Regeneration (§21, §22, BR-16)
// -----------------------------------------------------------------------------
console.log('\n4. Testing Locked Assignments & Regeneration:');

const preLockedAssignment: DutyScheduleAssignment = {
  id: 'locked-shift-1',
  scheduleId: 'sched-test-1',
  employeeId: 'emp-1',
  branchId: 'branch-24h',
  date: '2026-09-01',
  shiftCode: 'AM',
  isLocked: true,
  isRelief: false,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z'
};

const regenOutput = generateSchedule({
  scheduleId: 'sched-test-1',
  startDate: new Date('2026-09-01'),
  endDate: new Date('2026-09-01'),
  profiles: staffProfiles,
  leaves: [],
  branches: [branch24h, branchStandard],
  lockedAssignments: [preLockedAssignment]
});

const foundLocked = regenOutput.assignments.find(a => a.id === 'locked-shift-1');
assert(!!foundLocked && foundLocked.isLocked === true, 'Locked assignment is preserved byte-for-byte in regeneration output');

// Ensure emp-1 was not double-assigned on that date
const emp1Assignments = regenOutput.assignments.filter(a => a.employeeId === 'emp-1');
assert(emp1Assignments.length === 1, 'Locked pharmacist is not double-assigned on the same date');


// -----------------------------------------------------------------------------
// TEST SUITE 5: Rolling State Continuity Across Boundaries (§16.3, §17.1)
// -----------------------------------------------------------------------------
console.log('\n5. Testing Rolling State Continuity Across Period Boundaries:');

// Pharmacist finished Period 1 on Day 4 of their streak
const prevRollingState = [{
  id: 'roll-1',
  employeeId: 'emp-1',
  scheduleId: 'sched-p1',
  consecutiveWorkingDays: 4,
  currentConsecutiveWorkingDays: 4,
  currentConsecutiveRestDays: 0,
  currentPatternCycleIndex: 0,
  daysSinceWeeklyRest: 4,
  workloadScore: 4.0,
  totalWorkloadScore: 4.0,
  recentWorkloadScore: 4.0,
  weekendAssignmentCount: 0,
  createdAt: ''
}];

// Generate Period 2 (Day 1)
const p2Output = generateSchedule({
  scheduleId: 'sched-p2',
  startDate: new Date('2026-09-05'),
  endDate: new Date('2026-09-05'),
  profiles: [staffProfiles[0]], // emp-1 (fixed AM)
  leaves: [],
  branches: [{ id: 'branch-24h', code: 'B24', name: 'Sanad 24h', is24Hour: false, isActive: true, role: 'branch' }],
  shiftRequirements: [{ id: 'sr-1', branchId: 'branch-24h', code: 'AM', name: 'AM', startTime: '08:00:00', endTime: '16:00:00', staffRequired: 1 }],
  previousRollingState: prevRollingState
});

const emp1RollingAfter = p2Output.newRollingState.find(s => s.employeeId === 'emp-1');
assert(emp1RollingAfter?.currentConsecutiveWorkingDays === 5, 
  `Streak carries over across period boundary: started at 4, after 1 work day is 5 (actual: ${emp1RollingAfter?.currentConsecutiveWorkingDays})`);


// -----------------------------------------------------------------------------
// TEST SUITE 6: Pattern Deviation Logging (§14.2)
// -----------------------------------------------------------------------------
console.log('\n6. Testing Pattern Deviation Logging:');

// Create a scenario where ONLY 1 pharmacist exists, whose soft pattern requests rest,
// but the branch MUST be staffed.
const pSoftRest: PharmacistSchedulingProfile = {
  id: 'p-soft',
  employeeId: 'emp-soft',
  roleType: 'FIXED',
  primaryBranchId: 'branch-solo',
  workRestMode: 'FIXED_CYCLE',
  workRestConfig: { work_days: 1, rest_days: 1 },
  patternStrictness: 'SOFT', // Soft!
  maximumConsecutiveWorkingDays: 6,
  minimumRestHours: 11.0,
  isActive: true,
  createdAt: '',
  updatedAt: ''
};

// Already worked 1 day, so pattern would prefer rest:
const prevSoftState = [{
  id: 'roll-soft',
  employeeId: 'emp-soft',
  scheduleId: 'sched-soft',
  consecutiveWorkingDays: 1,
  currentConsecutiveWorkingDays: 1,
  currentConsecutiveRestDays: 0,
  currentPatternCycleIndex: 0,
  daysSinceWeeklyRest: 1,
  workloadScore: 1.0,
  totalWorkloadScore: 1.0,
  recentWorkloadScore: 1.0,
  weekendAssignmentCount: 0,
  createdAt: ''
}];

const soloBranch: Branch = { id: 'branch-solo', code: 'SOLO', name: 'Solo Branch', is24Hour: false, isActive: true, role: 'branch' };

const devOutput = generateSchedule({
  scheduleId: 'sched-dev',
  startDate: new Date('2026-09-02'),
  endDate: new Date('2026-09-02'),
  profiles: [pSoftRest],
  leaves: [],
  branches: [soloBranch],
  shiftRequirements: [{ id: 'sr-solo', branchId: 'branch-solo', code: 'AM', name: 'AM', startTime: '08:00:00', endTime: '16:00:00', staffRequired: 1 }],
  previousRollingState: prevSoftState
});

const deviationConflict = devOutput.conflicts.find(c => c.conflictType === 'PATTERN_DEVIATION');
assert(!!deviationConflict && deviationConflict.severity === 'SOFT', 'Soft pattern violation creates structured PATTERN_DEVIATION conflict record', deviationConflict);
assert(devOutput.assignments.length === 1, 'Branch coverage is satisfied by deviating from soft rest preference');


// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log(`\n=== Test Results: ${passed} Passed, ${failed} Failed ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL PHASE 2 ACCEPTANCE TESTS PASSED SUCCESSFULLY!\n');
}
