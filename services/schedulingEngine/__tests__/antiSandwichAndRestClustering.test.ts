import { generateSchedule } from '../index';
import { PharmacistSchedulingProfile, Branch, BranchShiftType } from '../../../types';

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

console.log('=== Anti-Sandwich & Consecutive Rest Day Clustering Test Suite ===\n');

// -----------------------------------------------------------------------------
// Scenario: Single Branch H003 with 2 Fixed Pharmacists across a 2-week period
// In previous code, streakPenalty = consec * 120 caused the 2 pharmacists to alternate
// every single day (Off -> Work 1 day -> Off -> Work 1 day).
// With Anti-Sandwich Momentum + Rest Day Clustering, neither pharmacist should have
// an isolated 1-day work shift, and their off-days should be contiguous.
// -----------------------------------------------------------------------------

const branchH003: Branch = {
  id: 'b-h003',
  code: 'H003',
  name: 'Branch H003',
  role: 'branch',
  is24Hour: false,
  isActive: true
};

const shiftReqs: BranchShiftType[] = [
  { id: 'sr-am', branchId: 'b-h003', code: 'AM', name: 'Morning', startTime: '08:00:00', endTime: '16:00:00', staffRequired: 1 },
  { id: 'sr-pm', branchId: 'b-h003', code: 'PM', name: 'Evening', startTime: '16:00:00', endTime: '00:00:00', staffRequired: 1 }
];

// Pharmacist 1: Fixed at H003, 5 days/week (2 rest days/week)
const p1: PharmacistSchedulingProfile = {
  id: 'prof-p1',
  employeeId: 'emp-p1',
  roleType: 'FIXED',
  primaryBranchId: 'b-h003',
  workRestMode: 'DAYS_PER_WEEK',
  workRestConfig: { target_days_per_week: 5 },
  patternStrictness: 'SOFT',
  maximumConsecutiveWorkingDays: 6,
  minimumRestHours: 11.0,
  isActive: true,
  createdAt: '',
  updatedAt: ''
};

// Pharmacist 2: Fixed at H003, 5 days/week (2 rest days/week)
const p2: PharmacistSchedulingProfile = {
  id: 'prof-p2',
  employeeId: 'emp-p2',
  roleType: 'FIXED',
  primaryBranchId: 'b-h003',
  workRestMode: 'DAYS_PER_WEEK',
  workRestConfig: { target_days_per_week: 5 },
  patternStrictness: 'SOFT',
  maximumConsecutiveWorkingDays: 6,
  minimumRestHours: 11.0,
  isActive: true,
  createdAt: '',
  updatedAt: ''
};

// Pharmacist 3: Relief Pharmacist to cover the remaining shifts to achieve 14 shifts/week with 2*5 = 10 capacity
const p3: PharmacistSchedulingProfile = {
  id: 'prof-p3',
  employeeId: 'emp-p3',
  roleType: 'RELIEF',
  allowedBranchIds: ['b-h003'],
  workRestMode: 'DAYS_PER_WEEK',
  workRestConfig: { target_days_per_week: 5 },
  patternStrictness: 'SOFT',
  maximumConsecutiveWorkingDays: 6,
  minimumRestHours: 11.0,
  isActive: true,
  createdAt: '',
  updatedAt: ''
};

// Run schedule generation for 14 days (2026-09-14 to 2026-09-27)
const startDate = new Date('2026-09-14T00:00:00Z');
const endDate = new Date('2026-09-27T00:00:00Z');

const output = generateSchedule({
  scheduleId: 'test-sched-sandwich',
  startDate,
  endDate,
  profiles: [p1, p2, p3],
  branches: [branchH003],
  shiftRequirements: shiftReqs,
  leaves: []
});

console.log('1. Evaluating generated assignments:');
assert(output.assignments.length === 28, `All 28 shifts in 14 days are covered (got ${output.assignments.length})`);

// Generate dates array
const dates: string[] = [];
const curr = new Date(startDate);
while (curr <= endDate) {
  dates.push(curr.toISOString().split('T')[0]);
  curr.setUTCDate(curr.getUTCDate() + 1);
}

// Build employee timeline
const empTimeline = new Map<string, Set<string>>();
for (const a of output.assignments) {
  if (!empTimeline.has(a.employeeId)) {
    empTimeline.set(a.employeeId, new Set());
  }
  empTimeline.get(a.employeeId)!.add(a.date);
}

// 2. Anti-Sandwich Check: Verify NO employee has [OFF] -> [WORK 1 DAY] -> [OFF]
console.log('\n2. Anti-Sandwich Validation:');
let totalSandwichCount = 0;

for (const empId of ['emp-p1', 'emp-p2', 'emp-p3']) {
  const workingDates = empTimeline.get(empId) || new Set();
  const sandwiches: string[] = [];

  for (let i = 1; i < dates.length - 1; i++) {
    const prevDate = dates[i - 1];
    const currDate = dates[i];
    const nextDate = dates[i + 1];

    const prevWork = workingDates.has(prevDate);
    const currWork = workingDates.has(currDate);
    const nextWork = workingDates.has(nextDate);

    if (!prevWork && currWork && !nextWork) {
      sandwiches.push(currDate);
    }
  }

  totalSandwichCount += sandwiches.length;
  assert(
    sandwiches.length === 0,
    `Pharmacist ${empId} has ZERO isolated 1-day sandwich shifts (actual: ${sandwiches.length} on ${sandwiches.join(', ') || 'none'})`
  );
}

assert(totalSandwichCount === 0, 'ZERO isolated single-day work shifts across entire schedule');

// 3. Consecutive Rest Days Check:
// When an employee has 2 off days, verify they are grouped consecutively
console.log('\n3. Rest Day Grouping Validation:');
for (const empId of ['emp-p1', 'emp-p2']) {
  const workingDates = empTimeline.get(empId) || new Set();
  
  // Print human readable pattern: W = Work, O = Off
  const pattern = dates.map(d => workingDates.has(d) ? 'W' : 'O').join('');
  console.log(`  Pharmacist ${empId} schedule pattern: ${pattern}`);

  // Count max consecutive rest days
  let maxConsecRest = 0;
  let currentRest = 0;
  for (const d of dates) {
    if (!workingDates.has(d)) {
      currentRest++;
      if (currentRest > maxConsecRest) maxConsecRest = currentRest;
    } else {
      currentRest = 0;
    }
  }

  assert(maxConsecRest >= 2, `Pharmacist ${empId} achieves consecutive off-days (max consecutive rest: ${maxConsecRest} >= 2)`);
}

console.log(`\n=== Anti-Sandwich & Rest Clustering Results: ${passed} Passed, ${failed} Failed ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL ANTI-SANDWICH & CONSECUTIVE REST TESTS PASSED PERFECTLY!\n');
}
