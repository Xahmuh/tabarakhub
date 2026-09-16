import { 
  generateSchedule, 
  computeRequiredCoverage, 
  computePharmacistCapacity, 
  calculatePharmacistExpectedWorkingDays 
} from '../index';
import { 
  Branch, 
  BranchShiftType, 
  PharmacistSchedulingProfile, 
  DutySchedulerLeaveRecord 
} from '../../../types';

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

console.log('=== Pre-Generation Capacity Planning & Zero-Gap Wizard Test Suite ===\n');

// -----------------------------------------------------------------------------
// TEST SUITE 1: Shared Required Coverage & Zero Drift (Criterion 3)
// -----------------------------------------------------------------------------
console.log('1. Testing Required Coverage Preview vs. Real Solver (Zero Drift Rule):');

const branchA: Branch = { id: 'b-1', code: 'B1', name: 'Branch 1', is24Hour: false, isActive: true, role: 'branch' };
const branchB24h: Branch = { id: 'b-2', code: 'B2', name: '24h Branch', is24Hour: true, isActive: true, role: 'branch' };
const dates = ['2026-10-01', '2026-10-02', '2026-10-03']; // 3 days

const coverage = computeRequiredCoverage(dates, [branchA, branchB24h]);
// branchA: 2 shifts/day * 3 days = 6
// branchB24h: 3 shifts/day * 3 days = 9
// Total required = 15 shifts
assert(coverage.totalRequired === 15, `Exact total required shifts calculated (expected 15, got ${coverage.totalRequired})`);
assert(coverage.byShiftType.AM === 6, `AM shifts count is 6 (got ${coverage.byShiftType.AM})`);
assert(coverage.byShiftType.PM === 6, `PM shifts count is 6 (got ${coverage.byShiftType.PM})`);
assert(coverage.byShiftType.NIGHT === 3, `NIGHT shifts count is 3 (got ${coverage.byShiftType.NIGHT})`);
assert(coverage.hasNightShifts === true, 'Correctly flags presence of night shifts in in-scope branches');

// Now run real solver with empty profiles to verify hard conflicts match totalRequired exactly
const solverRun = generateSchedule({
  scheduleId: 'test-sched',
  startDate: new Date('2026-10-01'),
  endDate: new Date('2026-10-03'),
  profiles: [],
  leaves: [],
  branches: [branchA, branchB24h]
});
const hardConflicts = solverRun.conflicts.filter(c => c.severity === 'HARD').length;
const solverTotalRequired = solverRun.assignments.length + hardConflicts;
assert(
  solverTotalRequired === coverage.totalRequired,
  `ZERO DRIFT: Solver total (${solverTotalRequired}) matches pre-generation preview total (${coverage.totalRequired}) exactly`
);

// -----------------------------------------------------------------------------
// TEST SUITE 2: Per-Pharmacist Capacity & Unconfigured Fallback (Criterion 4)
// -----------------------------------------------------------------------------
console.log('\n2. Testing Pharmacist Capacity & Default Setting Fallback:');

const profileFixed6Day: PharmacistSchedulingProfile = {
  id: 'prof-1',
  employeeId: 'emp-1',
  roleType: 'FIXED',
  primaryBranchId: 'b-1',
  workRestMode: 'DAYS_PER_WEEK',
  workRestConfig: { target_days_per_week: 6 },
  patternStrictness: 'HARD',
  maximumConsecutiveWorkingDays: 6,
  minimumRestHours: 11.0,
  isActive: true,
  createdAt: '',
  updatedAt: ''
};

// 30 days period
const monthDates: string[] = [];
for (let i = 1; i <= 30; i++) {
  monthDates.push(`2026-10-${i.toString().padStart(2, '0')}`);
}

const staff = [
  { id: 'emp-1', full_name: 'Dr. Profile Set' },
  { id: 'emp-2', full_name: 'Dr. No Profile Set' }
];

const leaves: DutySchedulerLeaveRecord[] = [
  // emp-1 has 5 days of annual leave in month
  {
    id: 'leave-1',
    employeeId: 'emp-1',
    leaveType: 'ANNUAL',
    startDate: '2026-10-05',
    endDate: '2026-10-09',
    status: 'APPROVED',
    createdAt: '',
    updatedAt: ''
  }
];

const singleBranchCoverage = computeRequiredCoverage(monthDates, [branchA]); // 30 days * 2 shifts = 60 shifts
const capacityRes = computePharmacistCapacity(
  monthDates,
  staff,
  [profileFixed6Day],
  leaves,
  singleBranchCoverage,
  undefined,
  4 // default 4 rest days per period setting
);

const excludedEmp1 = capacityRes.excludedLeavePharmacists.find(d => d.employeeId === 'emp-1');
const detailEmp2 = capacityRes.pharmacistDetails.find(d => d.employeeId === 'emp-2')!;

assert(excludedEmp1 !== undefined, 'Pharmacist on annual leave is moved to excludedLeavePharmacists');
assert(excludedEmp1?.isExcludedOnLeave === true, 'Pharmacist is flagged as isExcludedOnLeave');
assert(excludedEmp1?.netCapacity === 0, 'Pharmacist on annual leave contributes 0 capacity shifts');
assert(capacityRes.pharmacistDetails.find(d => d.employeeId === 'emp-1') === undefined, 'Pharmacist on annual leave is NOT in active pharmacistDetails pool');
assert(capacityRes.totalPharmacistsInScope === 1, `Total pharmacists in active pool is 1 (got ${capacityRes.totalPharmacistsInScope})`);
assert(capacityRes.availablePharmacistsCount === 1, `Available count is 1 (got ${capacityRes.availablePharmacistsCount})`);
assert(capacityRes.onLeavePharmacistsCount === 1, `On-leave count is 1 (got ${capacityRes.onLeavePharmacistsCount})`);
assert(detailEmp2.isUsingDefaultAssumption === true, 'Pharmacist with NO profile is visibly flagged as using default rest assumption');
assert(detailEmp2.expectedWorkingDays === 26, `Pharmacist without profile uses default 4 rest days (30 - 4 = 26, got ${detailEmp2.expectedWorkingDays})`);
assert(capacityRes.totalBaseCapacity === 26, `Total base capacity only counts active pharmacist (expected 26, got ${capacityRes.totalBaseCapacity})`);

// -----------------------------------------------------------------------------
// TEST SUITE 3: Live Surplus Balancing (Criterion 5)
// -----------------------------------------------------------------------------
console.log('\n3. Testing Live Surplus Absorption:');

// Assign 2 extra rest days to emp-2
const adjustedCapacityRes = computePharmacistCapacity(
  monthDates,
  staff,
  [profileFixed6Day],
  leaves,
  singleBranchCoverage,
  undefined,
  4,
  { 'emp-2': 2 }
);

assert(
  adjustedCapacityRes.totalAdjustedCapacity === capacityRes.totalBaseCapacity - 2,
  `Adjusting extra rest days decrements capacity live by 2 (base: ${capacityRes.totalBaseCapacity}, adjusted: ${adjustedCapacityRes.totalAdjustedCapacity})`
);

// -----------------------------------------------------------------------------
// TEST SUITE 4: Weekend (Friday/Saturday) Distribution Soft Preference (Criterion 7 & 8)
// -----------------------------------------------------------------------------
console.log('\n4. Testing Weekend Distribution Soft Preference & Zero-Gap Protection:');

const pWeekend1: PharmacistSchedulingProfile = {
  id: 'p-w1',
  employeeId: 'emp-w1',
  roleType: 'FIXED',
  primaryBranchId: 'b-1',
  workRestMode: 'DAYS_PER_WEEK',
  workRestConfig: { target_days_per_week: 6, preferredRestDays: [0] }, // Sunday rest, works Friday
  patternStrictness: 'SOFT',
  maximumConsecutiveWorkingDays: 6,
  minimumRestHours: 11.0,
  isActive: true,
  createdAt: '',
  updatedAt: ''
};

const pWeekend2: PharmacistSchedulingProfile = {
  ...pWeekend1,
  id: 'p-w2',
  employeeId: 'emp-w2'
};

const pWeekend3: PharmacistSchedulingProfile = {
  ...pWeekend1,
  id: 'p-w3',
  employeeId: 'emp-w3'
};

const pCover1: PharmacistSchedulingProfile = {
  ...pWeekend1,
  id: 'p-c1',
  employeeId: 'emp-c1'
};

const pCover2: PharmacistSchedulingProfile = {
  ...pWeekend1,
  id: 'p-c2',
  employeeId: 'emp-c2'
};

// Weekend 0: Friday 2026-10-02 & Saturday 2026-10-03
// Team ['emp-w1', 'emp-w2', 'emp-w3']:
// Weekend 0 (wIdx = 0):
// - emp-w1 (idx 0, (0+0)%2=0): FRIDAY_OFF
// - emp-w2 (idx 1, (1+0)%2=1): SATURDAY_OFF (works Friday, rests Saturday)
// - emp-w3 (idx 2, (2+0)%2=0): FRIDAY_OFF
const weekendOutput = generateSchedule({
  scheduleId: 'weekend-test-sched',
  startDate: new Date('2026-10-02'),
  endDate: new Date('2026-10-03'),
  profiles: [pWeekend1, pWeekend2, pWeekend3, pCover1, pCover2],
  leaves: [],
  branches: [branchA], // 2 shifts (AM, PM) per day = 4 shifts total
  periodAdjustments: {
    weekendPharmacistIds: ['emp-w1', 'emp-w2', 'emp-w3']
  }
});

const fridayAssignments = weekendOutput.assignments.filter(a => a.date === '2026-10-02').map(a => a.employeeId);
const saturdayAssignments = weekendOutput.assignments.filter(a => a.date === '2026-10-03').map(a => a.employeeId);

assert(
  !fridayAssignments.includes('emp-w1') && !fridayAssignments.includes('emp-w3'),
  'Pharmacists designated Friday off (emp-w1, emp-w3) successfully receive Friday off'
);
assert(
  !saturdayAssignments.includes('emp-w2'),
  'Pharmacist designated Saturday off (emp-w2) successfully receives Saturday off'
);
assert(
  fridayAssignments.length === 2 && saturdayAssignments.length === 2,
  'Zero-gap maintained: both branch shifts staffed on Friday and Saturday'
);

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log(`\n=== Test Results: ${passed} Passed, ${failed} Failed ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL ZERO-GAP WIZARD CAPACITY PLANNING TESTS PASSED SUCCESSFULLY!\n');
}
