import assert from 'assert';
import { generateSchedule, calculatePharmacistExpectedWorkingDays, getCalendarDatesInRange, getSafeDateDetails } from '../index';
import { PharmacistSchedulingProfile, Branch, BranchShiftType, DutySchedulerLeaveRecord } from '../../../types';

function runSchedulerBusinessRulesTests() {
  console.log('================================================================');
  console.log('TEST SUITE: Scheduler Business Rules Optimization');
  console.log('1. Special Requests Within Regular Rest Quota');
  console.log('2. Surplus Capacity Absorption Hard-Capping');
  console.log('3. Alternating Weekend Rest Rotation (Friday ⇄ Saturday)');
  console.log('================================================================\n');

  // Shared 30-day date range: September 2026 (01/09/2026 -> 30/09/2026)
  const startDate = '2026-09-01';
  const endDate = '2026-09-30';
  const allDates = getCalendarDatesInRange(startDate, endDate);
  assert.strictEqual(allDates.length, 30, 'September 2026 has exactly 30 days');

  // Setup 2 branches
  const branches: Branch[] = [
    { id: 'branch-main', code: 'MAIN', name: 'Main Pharmacy', isActive: true } as any,
    { id: 'branch-plaza', code: 'PLZ', name: 'Plaza Pharmacy', isActive: true } as any
  ];

  // Each branch has AM and PM shift (1 staff each -> 4 shifts needed per day)
  const shiftRequirements: BranchShiftType[] = [
    { id: 'sr-main-am', branchId: 'branch-main', code: 'AM', name: 'Morning', startTime: '08:00:00', endTime: '16:00:00', staffRequired: 1 },
    { id: 'sr-main-pm', branchId: 'branch-main', code: 'PM', name: 'Evening', startTime: '16:00:00', endTime: '00:00:00', staffRequired: 1 },
    { id: 'sr-plz-am', branchId: 'branch-plaza', code: 'AM', name: 'Morning', startTime: '08:00:00', endTime: '16:00:00', staffRequired: 1 },
    { id: 'sr-plz-pm', branchId: 'branch-plaza', code: 'PM', name: 'Evening', startTime: '16:00:00', endTime: '00:00:00', staffRequired: 1 }
  ];

  // Pool of 6 pharmacists
  const employees = [
    { id: 'emp-1', code: 'DR01', full_name: 'Dr. Sarah Ahmed', category: 'Pharmacist' },
    { id: 'emp-2', code: 'DR02', full_name: 'Dr. Mohamed Ibrahim', category: 'Pharmacist' },
    { id: 'emp-3', code: 'DR03', full_name: 'Dr. Fatema Hassan', category: 'Pharmacist' },
    { id: 'emp-4', code: 'DR04', full_name: 'Dr. Ali Mansoor', category: 'Pharmacist' },
    { id: 'emp-5', code: 'DR05', full_name: 'Dr. Zainab Redha', category: 'Pharmacist' },
    { id: 'emp-6', code: 'DR06', full_name: 'Dr. Hussain Jaafar', category: 'Pharmacist' }
  ];

  const baseProfiles: PharmacistSchedulingProfile[] = employees.map((emp, idx) => ({
    id: `prof-${emp.id}`,
    employeeId: emp.id,
    roleType: idx < 4 ? 'FIXED' : 'RELIEF',
    primaryBranchId: idx < 2 ? 'branch-main' : 'branch-plaza',
    allowedBranchIds: ['branch-main', 'branch-plaza'],
    workRestMode: 'DAYS_PER_WEEK',
    workRestConfig: { target_days_per_week: 6, preferredRestDays: [5] }, // 6 days work, Friday rest
    patternStrictness: 'SOFT',
    maximumConsecutiveWorkingDays: 6,
    minimumRestHours: 11,
    isActive: true,
    createdAt: '',
    updatedAt: ''
  }));

  // ===========================================================================
  // TEST 1: Special Request Off-Days Counted Within Regular Rest Quota
  // ===========================================================================
  console.log('--- TEST 1: Special Request Off-Days Counted Within Regular Rest Quota ---');
  // Dr. Sarah Ahmed (emp-1) requests Tuesday 2026-09-15 off.
  // Tuesday is part of week Sun 13/09 -> Sat 19/09.
  // Her regular rest day is Friday 18/09.
  // With Rule 1, 15/09 fulfills her 1 rest day for that week. She can work Friday 18/09,
  // ensuring her total off-days for the 30-day month = 4 days, total working shifts = 26 shifts.
  const specialRestDate = '2026-09-15'; // Tuesday

  const result1 = generateSchedule({
    scheduleId: 'sched-rule1',
    startDate,
    endDate,
    profiles: baseProfiles,
    leaves: [],
    branches,
    shiftRequirements,
    periodAdjustments: {
      specialRestRequests: [
        {
          employeeId: 'emp-1',
          dates: [specialRestDate],
          notes: 'Doctor appointment'
        }
      ]
    },
    employees
  });

  const emp1Assignments = result1.assignments.filter(a => a.employeeId === 'emp-1');
  const emp1Dates = new Set(emp1Assignments.map(a => a.date));

  const weekDates = ['2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'];
  console.log('  Week breakdown (Sun 13/09 -> Sat 19/09):');
  for (const d of weekDates) {
    console.log(`    ${d} (${getSafeDateDetails(d).dayNameShort}): ${emp1Dates.has(d) ? 'WORK' : 'OFF'}`);
  }
  assert.ok(!emp1Dates.has(specialRestDate), 'Tuesday 15/09 was granted OFF');
  assert.ok(emp1Dates.has('2026-09-18'), 'Friday 18/09 was worked (no duplicate rest day forced)');
  console.log('  [PASS] Special requested Tuesday 15/09 acted as weekly rest day; Friday 18/09 was worked.');

  // ===========================================================================
  // TEST 2: Surplus Capacity Absorption (Extra Rest Days) Hard-Capping
  // ===========================================================================
  console.log('\n--- TEST 2: Surplus Capacity Absorption Hard-Capping ---');
  // Dr. Mohamed Ibrahim (emp-2) is assigned 10 extra rest days in Step 4.
  // Base working days = 26 (4 base rest days).
  // Net capacity = 26 - 10 = 16 shifts.
  // Total off-days = 4 base + 10 extra = 14 total off-days.
  const extraRestDaysCount = 10;
  const result2 = generateSchedule({
    scheduleId: 'sched-rule2',
    startDate,
    endDate,
    profiles: baseProfiles,
    leaves: [],
    branches,
    shiftRequirements,
    periodAdjustments: {
      extraRestDays: {
        'emp-2': extraRestDaysCount
      }
    },
    employees
  });

  const emp2Assignments = result2.assignments.filter(a => a.employeeId === 'emp-2');
  console.log(`  Dr. Mohamed Ibrahim assigned shifts with ${extraRestDaysCount} extra rest days: ${emp2Assignments.length}`);

  assert.strictEqual(
    emp2Assignments.length,
    16,
    `Dr. Mohamed Ibrahim should be hard-capped at 16 shifts (26 - 10), but got ${emp2Assignments.length}`
  );

  const totalOffDaysEmp2 = 30 - emp2Assignments.length;
  assert.strictEqual(
    totalOffDaysEmp2,
    14,
    `Dr. Mohamed Ibrahim total off-days should be 14 (4 base + 10 extra), but got ${totalOffDaysEmp2}`
  );
  console.log(`  [PASS] Hard-cap strictly enforced: 16 working shifts, 14 total off-days (4 base + 10 surplus).`);

  // ===========================================================================
  // TEST 3: Alternating Weekend Rest Rotation (Friday ⇄ Saturday)
  // ===========================================================================
  console.log('\n--- TEST 3: Alternating Weekend Rest Rotation (Friday ⇄ Saturday) ---');
  // Designate 4 pharmacists in the weekend rest team: emp-1, emp-2, emp-3, emp-4
  // September 2026 weekends:
  // Weekend 0: Fri 04/09, Sat 05/09
  // Weekend 1: Fri 11/09, Sat 12/09
  // Weekend 2: Fri 18/09, Sat 19/09
  // Weekend 3: Fri 25/09, Sat 26/09
  const weekendTeamIds = ['emp-1', 'emp-2', 'emp-3', 'emp-4'];

  const result3 = generateSchedule({
    scheduleId: 'sched-rule3',
    startDate,
    endDate,
    profiles: baseProfiles,
    leaves: [],
    branches,
    shiftRequirements,
    periodAdjustments: {
      weekendPharmacistIds: weekendTeamIds
    },
    employees
  });

  const weekends = [
    { name: 'Weekend 0', fri: '2026-09-04', sat: '2026-09-05', wIdx: 0 },
    { name: 'Weekend 1', fri: '2026-09-11', sat: '2026-09-12', wIdx: 1 },
    { name: 'Weekend 2', fri: '2026-09-18', sat: '2026-09-19', wIdx: 2 },
    { name: 'Weekend 3', fri: '2026-09-25', sat: '2026-09-26', wIdx: 3 }
  ];

  const assSetByEmp = new Map<string, Set<string>>();
  for (const a of result3.assignments) {
    if (!assSetByEmp.has(a.employeeId)) assSetByEmp.set(a.employeeId, new Set());
    assSetByEmp.get(a.employeeId)!.add(a.date);
  }

  for (let idx = 0; idx < weekendTeamIds.length; idx++) {
    const empId = weekendTeamIds[idx];
    const empName = employees.find(e => e.id === empId)?.full_name;
    const empDates = assSetByEmp.get(empId) || new Set();

    console.log(`\n  Checking rotation for ${empName} (index ${idx}):`);

    for (const w of weekends) {
      const isExpectedFridayOff = (idx + w.wIdx) % 2 === 0;
      const worksFri = empDates.has(w.fri);
      const worksSat = empDates.has(w.sat);

      if (isExpectedFridayOff) {
        console.log(`    ${w.name}: Expected FRIDAY OFF -> Fri: ${worksFri ? 'WORK' : 'OFF'}, Sat: ${worksSat ? 'WORK' : 'OFF'}`);
        assert.ok(!worksFri, `${empName} should be OFF on Friday ${w.fri}`);
      } else {
        console.log(`    ${w.name}: Expected SATURDAY OFF -> Fri: ${worksFri ? 'WORK' : 'OFF'}, Sat: ${worksSat ? 'WORK' : 'OFF'}`);
        assert.ok(!worksSat, `${empName} should be OFF on Saturday ${w.sat}`);
      }
    }
    console.log(`    [PASS] ${empName} strictly alternated: ${idx % 2 === 0 ? 'Fri -> Sat -> Fri -> Sat' : 'Sat -> Fri -> Sat -> Fri'}`);
  }

  console.log('\n================================================================');
  console.log('ALL SCHEDULER BUSINESS RULES TESTS PASSED SUCCESSFULLY! (3/3)');
  console.log('================================================================\n');
}

runSchedulerBusinessRulesTests();
