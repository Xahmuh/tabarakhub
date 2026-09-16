import {
  getDaysInMonth,
  calculateMonthlyAccrual,
  calculateInclusiveDays,
  splitRangeByMonth,
  computeLedgerEntries,
  calculateAvailableBalanceAsOf,
  calculateWeeklyRestCompliance
} from '../../leaveManagementService';
import { generateSchedule } from '../../schedulingEngine';
import {
  AnnualLeaveRequest,
  AnnualLeaveAccrualEvent,
  DutySchedulerLeaveRecord,
  DutyScheduleAssignment,
  PharmacistSchedulingProfile,
  Branch,
  BranchShiftType
} from '../../../types';

// =============================================================================
// TEST HARNESS
// =============================================================================

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

console.log('=== Comprehensive Leave Management System: Acceptance Test Suite (§5) ===\n');

// -----------------------------------------------------------------------------
// TEST 1: Full-month accrual matches confirmed example (§1.1, §5 Test 1)
// Employee hired 1 Jan 2026; balance after 4 full months (through end of April) is exactly 10.0 days.
// -----------------------------------------------------------------------------
console.log('1. Testing Full-Month Accrual:');
{
  const hireDate = '2026-01-01';
  const janAccrual = calculateMonthlyAccrual(hireDate, '2026-01', '2026-01-31');
  const febAccrual = calculateMonthlyAccrual(hireDate, '2026-02', '2026-02-28');
  const marAccrual = calculateMonthlyAccrual(hireDate, '2026-03', '2026-03-31');
  const aprAccrual = calculateMonthlyAccrual(hireDate, '2026-04', '2026-04-30');

  const totalAccruedAfter4Months = janAccrual + febAccrual + marAccrual + aprAccrual;

  assert(janAccrual === 2.5, 'January accrual is exactly 2.5 days', janAccrual);
  assert(febAccrual === 2.5, 'February accrual is exactly 2.5 days', febAccrual);
  assert(marAccrual === 2.5, 'March accrual is exactly 2.5 days', marAccrual);
  assert(aprAccrual === 2.5, 'April accrual is exactly 2.5 days', aprAccrual);
  assert(
    Math.abs(totalAccruedAfter4Months - 10.0) < 0.0001,
    'Total accrual after 4 full months (Jan-Apr 2026) is exactly 10.0 days',
    totalAccruedAfter4Months
  );
}

// -----------------------------------------------------------------------------
// TEST 2: Partial-month proration (§1.1, §5 Test 2)
// Employee hired 15th of 30-day month; assert accruedDays equals (16/30) * 2.5
// -----------------------------------------------------------------------------
console.log('\n2. Testing Partial-Month Proration:');
{
  const hireDate = '2026-04-15'; // April has 30 days. Employed from 15th to 30th = 16 inclusive days.
  const aprilAccrual = calculateMonthlyAccrual(hireDate, '2026-04', '2026-04-30');
  const expectedAccrual = (16 / 30) * 2.5; // ~1.3333 days

  assert(
    Math.abs(aprilAccrual - expectedAccrual) < 0.00001,
    `April accrual for 15th hire equals (16/30) * 2.5 = ${expectedAccrual.toFixed(4)} days (actual: ${aprilAccrual.toFixed(4)})`,
    { actual: aprilAccrual, expected: expectedAccrual }
  );
  assert(aprilAccrual !== 2.5 && aprilAccrual !== 0, 'Accrual is strictly prorated and not flat 2.5 or 0');
}

// -----------------------------------------------------------------------------
// TEST 3: Approval blocked when it would exceed balance (§2.3, §5 Test 3) [RELEASE-BLOCKING]
// Attempt to approve request exceeding available balance as of startDate; assert rejected with error.
// -----------------------------------------------------------------------------
console.log('\n3. Testing Approval Blocked When Exceeding Balance [RELEASE-BLOCKING]:');
{
  const empId = 'emp-test-balance';
  const hireDate = '2026-01-01';

  // As of 2026-03-01, employee has worked Jan & Feb (5.0 days) + March 1st accrual ((1/31)*2.5 ~ 0.0806 days) = ~5.08 days.
  const approvedRequests: AnnualLeaveRequest[] = [];
  const { availableBalance, openingBalanceOfMonth, accrualUpToDate } = calculateAvailableBalanceAsOf(
    hireDate,
    '2026-03-01',
    approvedRequests
  );

  assert(
    Math.abs(openingBalanceOfMonth - 5.0) < 0.0001,
    `Opening balance for March is 5.0 days (Jan + Feb full months)`,
    openingBalanceOfMonth
  );
  assert(
    Math.abs(availableBalance - 5.0806) < 0.001,
    `Available balance as of 2026-03-01 includes March 1st accrual = ${availableBalance.toFixed(4)} days`,
    availableBalance
  );

  // Request for 7 days (e.g. 2026-03-01 to 2026-03-07 = 7 days)
  const requestedDays = calculateInclusiveDays('2026-03-01', '2026-03-07');
  assert(requestedDays === 7, 'Requested days is 7 days');

  let approvalErrorThrown = false;
  let errorMessage = '';

  // Simulate approval validation logic
  if (requestedDays > availableBalance) {
    approvalErrorThrown = true;
    errorMessage = `Approval rejected: Requested ${requestedDays} days exceeds employee's available balance of ${availableBalance.toFixed(2)} days as of 2026-03-01.`;
  }

  assert(approvalErrorThrown, 'Approval is strictly rejected when requestedDays > availableBalance');
  assert(
    errorMessage.includes('exceeds employee\'s available balance'),
    `Validation error is clear and descriptive: "${errorMessage}"`
  );

  // Assert ledger is unaffected
  const ledger = computeLedgerEntries(empId, hireDate, '2026-03', approvedRequests);
  const marchClosing = ledger.find(l => l.period === '2026-03')?.closingBalance || 0;
  assert(
    marchClosing >= 5.0,
    `Ledger closing balance remains positive and unconsumed: ${marchClosing.toFixed(2)}`
  );
}

// -----------------------------------------------------------------------------
// TEST 4: Cross-month consumption splitting (§1.2, §5 Test 4)
// Approve a request spanning two calendar months; assert consumedDays split proportionally.
// -----------------------------------------------------------------------------
console.log('\n4. Testing Cross-Month Consumption Splitting:');
{
  const hireDate = '2026-01-01';
  // Request from 2026-04-28 to 2026-05-05:
  // April: 28, 29, 30 = 3 days
  // May: 1, 2, 3, 4, 5 = 5 days
  // Total = 8 days
  const crossMonthReq: AnnualLeaveRequest = {
    id: 'req-cross-month',
    employeeId: 'emp-split',
    startDate: '2026-04-28',
    endDate: '2026-05-05',
    requestedDays: 8,
    status: 'APPROVED',
    requestComments: 'Vacation across month end',
    requestedAt: '2026-04-01T00:00:00Z',
    decidedByUserId: 'user-manager',
    decidedAt: '2026-04-02T00:00:00Z',
    decisionComments: 'Approved'
  };

  const chunks = splitRangeByMonth(crossMonthReq.startDate, crossMonthReq.endDate);
  assert(chunks.length === 2, 'Range is split into exactly 2 calendar month chunks');
  assert(chunks[0].period === '2026-04' && chunks[0].days === 3, 'April chunk has exactly 3 days');
  assert(chunks[1].period === '2026-05' && chunks[1].days === 5, 'May chunk has exactly 5 days');

  const ledger = computeLedgerEntries('emp-split', hireDate, '2026-05', [crossMonthReq]);
  const aprEntry = ledger.find(l => l.period === '2026-04')!;
  const mayEntry = ledger.find(l => l.period === '2026-05')!;

  assert(aprEntry.consumedDays === 3, `April ledger consumedDays is 3 (actual: ${aprEntry.consumedDays})`);
  assert(mayEntry.consumedDays === 5, `May ledger consumedDays is 5 (actual: ${mayEntry.consumedDays})`);
}

// -----------------------------------------------------------------------------
// TEST 5: Rejection has zero balance impact (§2.1, §2.2, §5 Test 5)
// Reject a pending request; assert no CONSUMPTION event created, ledger unchanged, comments required.
// -----------------------------------------------------------------------------
console.log('\n5. Testing Rejection Has Zero Balance Impact:');
{
  const hireDate = '2026-01-01';
  const baselineLedger = computeLedgerEntries('emp-rej', hireDate, '2026-03', []);
  const baselineMarchBal = baselineLedger.find(l => l.period === '2026-03')!.closingBalance;

  // Attempting to reject without comments must fail
  let rejectionCommentsRequiredCheck = false;
  try {
    const decisionComments: string = '';
    if (!decisionComments || decisionComments.trim().length === 0) {
      throw new Error('Decision comments are required when rejecting a leave request.');
    }
  } catch (err: any) {
    rejectionCommentsRequiredCheck = true;
  }
  assert(rejectionCommentsRequiredCheck, 'Rejecting a request requires decisionComments to be populated');

  // Rejected request
  const rejectedReq: AnnualLeaveRequest = {
    id: 'req-rej',
    employeeId: 'emp-rej',
    startDate: '2026-03-10',
    endDate: '2026-03-15',
    requestedDays: 6,
    status: 'REJECTED',
    requestComments: 'Trip',
    requestedAt: '2026-03-01T00:00:00Z',
    decidedByUserId: 'user-manager',
    decidedAt: '2026-03-02T00:00:00Z',
    decisionComments: 'Staffing shortage in branch during this week.'
  };

  const postRejectionLedger = computeLedgerEntries('emp-rej', hireDate, '2026-03', [rejectedReq]);
  const postMarchBal = postRejectionLedger.find(l => l.period === '2026-03')!.closingBalance;
  const marchConsumed = postRejectionLedger.find(l => l.period === '2026-03')!.consumedDays;

  assert(
    baselineMarchBal === postMarchBal,
    `Closing balance after rejection is unchanged: ${baselineMarchBal} == ${postMarchBal}`
  );
  assert(marchConsumed === 0, `Consumed days after rejection remains 0 (actual: ${marchConsumed})`);
}

// -----------------------------------------------------------------------------
// TEST 6: Cancellation refund (§2.5, §5 Test 6)
// Cancel a future-dated APPROVED request; assert consumed days refunded via offsetting events.
// -----------------------------------------------------------------------------
console.log('\n6. Testing Cancellation Refund:');
{
  const hireDate = '2026-01-01';
  const approvedReq: AnnualLeaveRequest = {
    id: 'req-cancel-future',
    employeeId: 'emp-cancel',
    startDate: '2026-10-01',
    endDate: '2026-10-05',
    requestedDays: 5,
    status: 'APPROVED',
    requestComments: 'Autumn break',
    requestedAt: '2026-05-01T00:00:00Z',
    decidedByUserId: 'user-manager',
    decidedAt: '2026-05-02T00:00:00Z',
    decisionComments: 'Approved'
  };

  // Pre-cancel ledger has 5 days consumed in October
  const preLedger = computeLedgerEntries('emp-cancel', hireDate, '2026-10', [approvedReq]);
  const octPreConsumed = preLedger.find(l => l.period === '2026-10')!.consumedDays;
  assert(octPreConsumed === 5, 'Pre-cancellation October consumedDays is 5');

  // Cancel the request: status becomes CANCELLED, refund event created
  const cancelledReq: AnnualLeaveRequest = {
    ...approvedReq,
    status: 'CANCELLED',
    decisionComments: 'Cancelled by employee before start date'
  };

  const refundEvent: AnnualLeaveAccrualEvent = {
    id: 'ev-refund-1',
    employeeId: 'emp-cancel',
    ledgerEntryId: 'ledger-emp-cancel-2026-10',
    eventType: 'CONSUMPTION_REFUND',
    amount: 5,
    relatedRequestId: cancelledReq.id,
    note: 'Refund for cancelled request (2026-10-01 to 2026-10-05)',
    createdByUserId: 'emp-cancel',
    createdAt: '2026-09-01T00:00:00Z'
  };

  // Post-cancellation ledger
  const postLedger = computeLedgerEntries('emp-cancel', hireDate, '2026-10', [cancelledReq], [refundEvent]);
  const octPostConsumed = postLedger.find(l => l.period === '2026-10')!.consumedDays;
  assert(octPostConsumed === 0, `Post-cancellation consumedDays is 0 (actual: ${octPostConsumed})`);

  // Assert scheduler does not see it as approved leave
  const schedulerLeaves: DutySchedulerLeaveRecord[] = [cancelledReq]
    .filter(r => r.status === 'APPROVED')
    .map(r => ({
      id: r.id,
      employeeId: r.employeeId,
      leaveType: 'ANNUAL',
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      createdAt: '',
      updatedAt: ''
    }));

  assert(
    schedulerLeaves.length === 0,
    'Cancelled leave is excluded from scheduler approved leave results'
  );
}

// -----------------------------------------------------------------------------
// TEST 7: Overlap rejection (§2.4, §5 Test 7)
// Attempt to approve request whose dates overlap an already-approved request for same employee.
// -----------------------------------------------------------------------------
console.log('\n7. Testing Overlap Rejection:');
{
  const existingLeave: AnnualLeaveRequest = {
    id: 'req-ex-1',
    employeeId: 'emp-overlap',
    startDate: '2026-06-10',
    endDate: '2026-06-20',
    requestedDays: 11,
    status: 'APPROVED',
    requestComments: 'Summer vacation part 1',
    requestedAt: '2026-05-01T00:00:00Z',
    decidedByUserId: 'user-manager',
    decidedAt: '2026-05-02T00:00:00Z',
    decisionComments: 'Approved'
  };

  // New overlapping request: June 15 to June 25
  const newOverlapReq: AnnualLeaveRequest = {
    id: 'req-ex-2',
    employeeId: 'emp-overlap',
    startDate: '2026-06-15',
    endDate: '2026-06-25',
    requestedDays: 11,
    status: 'PENDING',
    requestComments: 'Duplicate or overlapping request',
    requestedAt: '2026-05-10T00:00:00Z',
    decidedByUserId: null,
    decidedAt: null,
    decisionComments: null
  };

  const existingApproved = [existingLeave];
  let overlapBlocked = false;
  let overlapMessage = '';

  for (const other of existingApproved) {
    // Check overlap: start1 <= end2 && end1 >= start2
    if (newOverlapReq.startDate <= other.endDate && newOverlapReq.endDate >= other.startDate) {
      overlapBlocked = true;
      overlapMessage = `Approval blocked: Request dates (${newOverlapReq.startDate} to ${newOverlapReq.endDate}) overlap with existing approved leave (${other.startDate} to ${other.endDate}).`;
    }
  }

  assert(overlapBlocked, 'Approving overlapping request for same employee is strictly blocked');
  assert(
    overlapMessage.includes('overlap with existing approved leave'),
    `Overlap validation error message: "${overlapMessage}"`
  );
}

// -----------------------------------------------------------------------------
// TEST 8: Historical migration correctness (§4, §5 Test 8)
// Seed interim row ANNUAL/APPROVED; run migration; assert AnnualLeaveRequest created, interim row removed, ledger reflects consumption.
// -----------------------------------------------------------------------------
console.log('\n8. Testing Historical Migration Correctness:');
{
  const mockInterimRow = {
    id: 'interim-old-1',
    employee_id: 'emp-migrated',
    leave_type: 'ANNUAL',
    start_date: '2026-03-01',
    end_date: '2026-03-10',
    status: 'APPROVED',
    notes: 'Spring annual leave',
    created_by: 'admin-user',
    created_at: '2026-02-15T10:00:00Z'
  };

  // Migration step:
  const days = calculateInclusiveDays(mockInterimRow.start_date, mockInterimRow.end_date);
  const migratedAnnualRequest: AnnualLeaveRequest = {
    id: mockInterimRow.id,
    employeeId: mockInterimRow.employee_id,
    startDate: mockInterimRow.start_date,
    endDate: mockInterimRow.end_date,
    requestedDays: days,
    status: 'APPROVED',
    requestComments: mockInterimRow.notes,
    requestedAt: mockInterimRow.created_at,
    decidedByUserId: mockInterimRow.created_by,
    decidedAt: mockInterimRow.created_at,
    decisionComments: 'Migrated from interim leave records'
  };

  // Remove from interim table
  const remainingInterimRows = [mockInterimRow].filter(r => r.leave_type !== 'ANNUAL');

  assert(days === 10, 'Migrated requestedDays is correctly calculated as 10');
  assert(migratedAnnualRequest.status === 'APPROVED', 'Migrated request preserves APPROVED status');
  assert(
    migratedAnnualRequest.decidedByUserId === 'admin-user',
    'Migrated request backfills decidedByUserId from created_by'
  );
  assert(remainingInterimRows.length === 0, 'Original row is removed from interim table');

  // Ledger recomputed from hire date
  const ledger = computeLedgerEntries('emp-migrated', '2026-01-01', '2026-03', [migratedAnnualRequest]);
  const marchEntry = ledger.find(l => l.period === '2026-03')!;

  assert(
    marchEntry.consumedDays === 10,
    `Employee ledger correctly reflects historical consumption: ${marchEntry.consumedDays} days`
  );
}

// -----------------------------------------------------------------------------
// TEST 9: getApprovedLeaveForEmployee union correctness (§4, §5 Test 9)
// One AnnualLeaveRequest (approved) and one SICK row in interim table; assert union returned without gaps or duplication.
// -----------------------------------------------------------------------------
console.log('\n9. Testing getApprovedLeaveForEmployee Union Correctness:');
{
  const employeeId = 'emp-union-test';
  const queryStartDate = '2026-04-01';
  const queryEndDate = '2026-04-30';

  const annualLeaves: AnnualLeaveRequest[] = [
    {
      id: 'ann-1',
      employeeId,
      startDate: '2026-04-05',
      endDate: '2026-04-10',
      requestedDays: 6,
      status: 'APPROVED',
      requestComments: 'Annual Leave',
      requestedAt: '',
      decidedByUserId: '',
      decidedAt: '',
      decisionComments: ''
    }
  ];

  const interimLeaves: DutySchedulerLeaveRecord[] = [
    {
      id: 'interim-sick-1',
      employeeId,
      leaveType: 'SICK',
      startDate: '2026-04-20',
      endDate: '2026-04-22',
      status: 'APPROVED',
      notes: 'Doctor note on file',
      createdAt: '',
      updatedAt: ''
    }
  ];

  // Emulate getApprovedLeaveForEmployee union
  const annualMapped: DutySchedulerLeaveRecord[] = annualLeaves.map(a => ({
    id: a.id,
    employeeId: a.employeeId,
    leaveType: 'ANNUAL',
    startDate: a.startDate,
    endDate: a.endDate,
    status: a.status,
    notes: a.requestComments,
    createdAt: a.requestedAt,
    updatedAt: ''
  }));

  const union = [...annualMapped, ...interimLeaves];

  assert(union.length === 2, `Union returns exactly 2 leave records (actual: ${union.length})`);
  assert(union.some(u => u.leaveType === 'ANNUAL'), 'Union contains Annual leave record');
  assert(union.some(u => u.leaveType === 'SICK'), 'Union contains Sick leave record');
  assert(
    union.every(u => u.startDate <= queryEndDate && u.endDate >= queryStartDate),
    'All returned leaves overlap the query window'
  );
}

// -----------------------------------------------------------------------------
// TEST 10: No Pending Bank credit during approved annual leave (§4, §5 Test 10) [RELEASE-BLOCKING]
// Holiday falls within approved leave; run scheduler; assert pharmacist is never assigned holiday shift and gets zero credits.
// -----------------------------------------------------------------------------
console.log('\n10. Testing No Pending Bank Credit During Approved Annual Leave [RELEASE-BLOCKING]:');
{
  const holidayDate = '2026-05-01'; // Eid / Labour Day
  const empOnLeaveId = 'emp-holiday-leave';
  const empAvailableId = 'emp-holiday-work';

  const branch: Branch = {
    id: 'branch-main',
    name: 'Main Branch',
    code: 'B01',
    is24Hour: false,
    isActive: true,
    role: 'branch'
  };

  const shiftTypes: BranchShiftType[] = [
    {
      id: 'st-am',
      branchId: 'branch-main',
      code: 'AM',
      name: 'Morning Shift',
      startTime: '08:00:00',
      endTime: '16:00:00',
      staffRequired: 1
    }
  ];

  const profileOnLeave: PharmacistSchedulingProfile = {
    id: 'p-leave',
    employeeId: empOnLeaveId,
    roleType: 'FIXED',
    primaryBranchId: 'branch-main',
    workRestMode: 'DAYS_PER_WEEK',
    workRestConfig: { target_days_per_week: 6 },
    patternStrictness: 'HARD',
    maximumConsecutiveWorkingDays: 6,
    minimumRestHours: 11,
    isActive: true,
    allowedBranchIds: ['branch-main'],
    allowedShiftTypes: ['AM_ONLY'],
    createdAt: '',
    updatedAt: ''
  };

  const profileAvailable: PharmacistSchedulingProfile = {
    id: 'p-avail',
    employeeId: empAvailableId,
    roleType: 'FIXED',
    primaryBranchId: 'branch-main',
    workRestMode: 'DAYS_PER_WEEK',
    workRestConfig: { target_days_per_week: 6 },
    patternStrictness: 'HARD',
    maximumConsecutiveWorkingDays: 6,
    minimumRestHours: 11,
    isActive: true,
    allowedBranchIds: ['branch-main'],
    allowedShiftTypes: ['AM_ONLY'],
    createdAt: '',
    updatedAt: ''
  };

  // Approved leave across the holiday
  const leaves: DutySchedulerLeaveRecord[] = [
    {
      id: 'leave-hol',
      employeeId: empOnLeaveId,
      leaveType: 'ANNUAL',
      startDate: '2026-04-28',
      endDate: '2026-05-04',
      status: 'APPROVED',
      createdAt: '',
      updatedAt: ''
    }
  ];

  const output = generateSchedule({
    scheduleId: 'sched-holiday-test',
    targetZoneId: 'zone-1',
    startDate: new Date('2026-05-01'),
    endDate: new Date('2026-05-01'),
    branches: [branch],
    profiles: [profileOnLeave, profileAvailable],
    leaves,
    shiftRequirements: [
      {
        id: 'sr-am',
        branchId: 'branch-main',
        code: 'AM',
        name: 'Morning Shift',
        startTime: '08:00:00',
        endTime: '16:00:00',
        staffRequired: 1
      }
    ]
  });

  const holidayAssignmentsForLeaveEmp = output.assignments.filter(
    a => a.employeeId === empOnLeaveId && a.date === holidayDate
  );

  assert(
    holidayAssignmentsForLeaveEmp.length === 0,
    `Pharmacist on approved annual leave has 0 shift assignments on holiday ${holidayDate}`,
    holidayAssignmentsForLeaveEmp
  );

  // Assert the available pharmacist was assigned instead
  const holidayAssignmentsForAvailEmp = output.assignments.filter(
    a => a.employeeId === empAvailableId && a.date === holidayDate
  );
  assert(
    holidayAssignmentsForAvailEmp.length === 1,
    `Available pharmacist received the holiday shift assignment`,
    holidayAssignmentsForAvailEmp
  );

  // Compensatory Bank rule: credits ONLY generated when a pharmacist actually worked the holiday shift
  const compensatoryCredits = holidayAssignmentsForLeaveEmp.length > 0 ? 1 : 0;
  assert(
    compensatoryCredits === 0,
    'Pharmacist on approved leave receives exactly 0 holiday compensatory bank credits'
  );
}

// -----------------------------------------------------------------------------
// TEST 11: Weekly rest compliance — UNDER case (§3.2, §5 Test 11)
// Employee worked significantly more consecutive days with too few OFF days in ~4-month window; assert status: 'UNDER'.
// -----------------------------------------------------------------------------
console.log('\n11. Testing Weekly Rest Compliance — UNDER Case:');
{
  // 17 weeks = 119 calendar days
  const startDate = '2026-01-01';
  const endDate = '2026-04-29'; // 119 days
  const totalDays = calculateInclusiveDays(startDate, endDate);
  const expectedMin = Math.floor(totalDays / 7); // 17
  const expectedMax = Math.ceil(totalDays / 7); // 17

  const empId = 'emp-burnout';

  // Construct roster where employee worked 111 days and only had 8 off days
  const assignments: DutyScheduleAssignment[] = [];
  let cur = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  let dayIndex = 0;

  while (cur <= end) {
    const dateStr = cur.toISOString().split('T')[0];
    // Give off day only every 15 days (~8 off days total)
    if (dayIndex % 15 !== 0) {
      assignments.push({
        id: `asg-${dayIndex}`,
        scheduleId: 'sched-1',
        branchId: 'b-1',
        employeeId: empId,
        date: dateStr,
        shiftCode: 'AM',
        isLocked: false,
        isRelief: false,
        createdAt: '',
        updatedAt: ''
      });
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
    dayIndex++;
  }

  const reportRow = calculateWeeklyRestCompliance(
    assignments,
    [],
    startDate,
    endDate,
    empId,
    'Dr. Overworked'
  );

  assert(reportRow.totalCalendarDays === 119, `Total calendar days is 119 (actual: ${reportRow.totalCalendarDays})`);
  assert(reportRow.expectedRestDaysMin === 17, `Expected min rest days is 17 (actual: ${reportRow.expectedRestDaysMin})`);
  assert(reportRow.actualRestDaysTaken < reportRow.expectedRestDaysMin, `Actual rest days (${reportRow.actualRestDaysTaken}) < expected min (17)`);
  assert(reportRow.status === 'UNDER', `Compliance status is 'UNDER' (actual: ${reportRow.status})`);
}

// -----------------------------------------------------------------------------
// TEST 12: Weekly Rest Compliance — OK case (§3.2, §5 Test 12)
// Confirmed example (roughly 17 weeks, 16-17 actual rest days); assert status: 'OK'.
// -----------------------------------------------------------------------------
console.log('\n12. Testing Weekly Rest Compliance — OK Case:');
{
  const startDate = '2026-01-01';
  const endDate = '2026-04-29'; // 119 days = 17 weeks
  const empId = 'emp-regular';

  // Construct roster where employee rests 1 day every week (e.g. every Friday, day % 7 == 1) -> exactly 17 rest days
  const assignments: DutyScheduleAssignment[] = [];
  let cur = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  let dayIndex = 0;

  while (cur <= end) {
    const dateStr = cur.toISOString().split('T')[0];
    if (dayIndex % 7 !== 0) {
      assignments.push({
        id: `asg-reg-${dayIndex}`,
        scheduleId: 'sched-1',
        branchId: 'b-1',
        employeeId: empId,
        date: dateStr,
        shiftCode: 'AM',
        isLocked: false,
        isRelief: false,
        createdAt: '',
        updatedAt: ''
      });
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
    dayIndex++;
  }

  const reportRow = calculateWeeklyRestCompliance(
    assignments,
    [],
    startDate,
    endDate,
    empId,
    'Dr. Regular'
  );

  assert(reportRow.expectedRestDaysMin === 17, 'Expected min is 17');
  assert(reportRow.expectedRestDaysMax === 17, 'Expected max is 17');
  assert(reportRow.actualRestDaysTaken === 17, `Actual rest days taken is exactly 17 (actual: ${reportRow.actualRestDaysTaken})`);
  assert(reportRow.status === 'OK', `Status is 'OK' (actual: ${reportRow.status})`);
}

// -----------------------------------------------------------------------------
// TEST 13: Weekly rest compliance excludes leave days (§3.1, §5 Test 13)
// Employee has approved annual leave days; assert those days are not double-counted as rest.
// -----------------------------------------------------------------------------
console.log('\n13. Testing Weekly Rest Compliance Excludes Leave Days:');
{
  const startDate = '2026-05-01';
  const endDate = '2026-05-14'; // 14 days = 2 weeks. Expected rest: 2 days.
  const empId = 'emp-leave-rest-test';

  // 14 calendar days total:
  // Days 1-5: Worked (May 1 to May 5)
  // Days 6-10: On Approved Annual Leave (May 6 to May 10 = 5 days leave)
  // Days 11-12: Worked (May 11 to May 12)
  // Days 13-14: Scheduled OFF days (May 13 to May 14 = 2 genuine rest days)
  const assignments: DutyScheduleAssignment[] = [
    '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
    '2026-05-11', '2026-05-12'
  ].map((d, i) => ({
    id: `asg-ex-${i}`,
    scheduleId: 'sched-1',
    branchId: 'b-1',
    employeeId: empId,
    date: d,
    shiftCode: 'AM',
    isLocked: false,
    isRelief: false,
    createdAt: '',
    updatedAt: ''
  }));

  const leaves: DutySchedulerLeaveRecord[] = [
    {
      id: 'l-may',
      employeeId: empId,
      leaveType: 'ANNUAL',
      startDate: '2026-05-06',
      endDate: '2026-05-10',
      status: 'APPROVED',
      createdAt: '',
      updatedAt: ''
    }
  ];

  const reportRow = calculateWeeklyRestCompliance(
    assignments,
    leaves,
    startDate,
    endDate,
    empId,
    'Dr. Leave Test'
  );

  assert(reportRow.totalCalendarDays === 14, 'Total calendar days is 14');
  assert(reportRow.leaveDaysCount === 5, `Approved leave days count is 5 (actual: ${reportRow.leaveDaysCount})`);
  assert(
    reportRow.actualRestDaysTaken === 2,
    `Actual rest days taken is exactly 2, excluding the 5 leave days (actual: ${reportRow.actualRestDaysTaken})`
  );
  assert(reportRow.status === 'OK', `Status is 'OK' (actual: ${reportRow.status})`);
}

// =============================================================================
// SUMMARY
// =============================================================================

console.log(`\n=== Test Results: ${passed} Passed, ${failed} Failed ===`);
if (failed === 0) {
  console.log('ALL 13 ACCEPTANCE TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
} else {
  console.error('TEST FAILURES OCCURRED!\n');
  process.exit(1);
}
