import { supabaseClient } from '../lib/supabaseClient';
import {
  AnnualLeaveRequest,
  AnnualLeaveLedgerEntry,
  AnnualLeaveAccrualEvent,
  AnnualLeaveRequestStatus,
  WeeklyRestComplianceReport,
  WeeklyRestComplianceRow,
  WeeklyRestComplianceStatus,
  DutyScheduleAssignment,
  DutySchedulerLeaveRecord
} from '../types';

// =============================================================================
// PURE CALCULATION HELPERS (§1.1, §1.2, §2.3, §3.1)
// =============================================================================

/**
 * Returns total days in a given calendar month (28, 29, 30, or 31).
 */
export function getDaysInMonth(year: number, month1Indexed: number): number {
  return new Date(Date.UTC(year, month1Indexed, 0)).getUTCDate();
}

/**
 * Parses 'YYYY-MM-DD' into year, month (1-indexed), day UTC integers.
 */
export function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m, day: d };
}

/**
 * Formats period string 'YYYY-MM'.
 */
export function formatPeriod(year: number, month1Indexed: number): string {
  return `${year}-${String(month1Indexed).padStart(2, '0')}`;
}

/**
 * Calculates calendar days between two 'YYYY-MM-DD' dates, inclusive.
 */
export function calculateInclusiveDays(startDateStr: string, endDateStr: string): number {
  const s = new Date(startDateStr + 'T00:00:00Z').getTime();
  const e = new Date(endDateStr + 'T00:00:00Z').getTime();
  if (e < s) return 0;
  return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * §1.1 Accrual Formula for a given calendar month:
 * daysEmployedInMonth = min(monthEnd, asOfDate) - max(monthStart, hireDate) + 1
 * accruedForMonth = (daysEmployedInMonth / totalDaysInThatMonth) * 2.5
 */
export function calculateMonthlyAccrual(
  hireDateStr: string,
  period: string, // 'YYYY-MM'
  asOfDateStr?: string // optional 'YYYY-MM-DD', defaults to period end
): number {
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const totalDaysInMonth = getDaysInMonth(year, month);

  const monthStartStr = `${period}-01`;
  const monthEndStr = `${period}-${String(totalDaysInMonth).padStart(2, '0')}`;

  const effectiveCutoffStr = asOfDateStr && asOfDateStr < monthEndStr ? asOfDateStr : monthEndStr;

  // If cutoff is before month start or hire date is after cutoff -> 0 accrual
  if (effectiveCutoffStr < monthStartStr) return 0;
  if (hireDateStr > effectiveCutoffStr) return 0;

  const startBound = hireDateStr > monthStartStr ? hireDateStr : monthStartStr;
  const endBound = effectiveCutoffStr < monthEndStr ? effectiveCutoffStr : monthEndStr;

  if (startBound > endBound) return 0;

  const daysEmployedInMonth = calculateInclusiveDays(startBound, endBound);
  return (daysEmployedInMonth / totalDaysInMonth) * 2.5;
}

/**
 * Splits a date range spanning month boundaries into chunks per month.
 * e.g., '2026-04-28' to '2026-05-05' -> [ { period: '2026-04', days: 3 }, { period: '2026-05', days: 5 } ]
 */
export function splitRangeByMonth(
  startDateStr: string,
  endDateStr: string
): Array<{ period: string; days: number; startDate: string; endDate: string }> {
  const result: Array<{ period: string; days: number; startDate: string; endDate: string }> = [];
  let curr = new Date(startDateStr + 'T00:00:00Z');
  const end = new Date(endDateStr + 'T00:00:00Z');

  while (curr <= end) {
    const y = curr.getUTCFullYear();
    const m = curr.getUTCMonth() + 1;
    const period = formatPeriod(y, m);
    const totalDays = getDaysInMonth(y, m);
    const monthEnd = new Date(Date.UTC(y, m - 1, totalDays));

    const chunkEnd = monthEnd < end ? monthEnd : end;

    const chunkStartStr = curr.toISOString().split('T')[0];
    const chunkEndStr = chunkEnd.toISOString().split('T')[0];
    const days = calculateInclusiveDays(chunkStartStr, chunkEndStr);

    result.push({
      period,
      days,
      startDate: chunkStartStr,
      endDate: chunkEndStr
    });

    // Advance to next month's 1st day
    curr = new Date(Date.UTC(y, m, 1));
  }

  return result;
}

/**
 * Checks if two date ranges overlap.
 */
export function doDateRangesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 <= e2 && e1 >= s2;
}

/**
 * Generates an array of 'YYYY-MM' periods between start and end dates.
 */
export function generatePeriodsBetween(startPeriod: string, endPeriod: string): string[] {
  const periods: string[] = [];
  const [sY, sM] = startPeriod.split('-').map(Number);
  const [eY, eM] = endPeriod.split('-').map(Number);

  let curY = sY;
  let curM = sM;

  while (curY < eY || (curY === eY && curM <= eM)) {
    periods.push(formatPeriod(curY, curM));
    curM++;
    if (curM > 12) {
      curM = 1;
      curY++;
    }
  }

  return periods;
}

/**
 * Idempotently computes all ledger entries from hireDate up to targetPeriod
 * based on hire_date, approved requests, and manual adjustment events.
 */
export function computeLedgerEntries(
  employeeId: string,
  hireDateStr: string,
  targetPeriod: string,
  approvedRequests: AnnualLeaveRequest[],
  manualAdjustments: AnnualLeaveAccrualEvent[] = []
): AnnualLeaveLedgerEntry[] {
  const hirePeriod = hireDateStr.substring(0, 7);
  const startPeriod = hirePeriod < targetPeriod ? hirePeriod : targetPeriod;
  const periods = generatePeriodsBetween(startPeriod, targetPeriod);

  // Group consumption by period
  const consumptionByPeriod = new Map<string, number>();
  for (const req of approvedRequests) {
    if (req.status !== 'APPROVED') continue;
    const chunks = splitRangeByMonth(req.startDate, req.endDate);
    for (const chunk of chunks) {
      consumptionByPeriod.set(
        chunk.period,
        (consumptionByPeriod.get(chunk.period) || 0) + chunk.days
      );
    }
  }

  // Group manual adjustments by period (via ledgerEntryId or timestamp period)
  const adjustmentsByPeriod = new Map<string, number>();
  for (const ev of manualAdjustments) {
    if (ev.eventType === 'MANUAL_ADJUSTMENT' || ev.eventType === 'CONSUMPTION_REFUND') {
      const p = ev.createdAt ? ev.createdAt.substring(0, 7) : targetPeriod;
      adjustmentsByPeriod.set(p, (adjustmentsByPeriod.get(p) || 0) + ev.amount);
    }
  }

  let runningBalance = 0;
  const entries: AnnualLeaveLedgerEntry[] = [];

  for (const period of periods) {
    const openingBalance = runningBalance;
    const accruedDays = calculateMonthlyAccrual(hireDateStr, period);
    const consumedDays = consumptionByPeriod.get(period) || 0;
    const manualAdj = adjustmentsByPeriod.get(period) || 0;

    const closingBalance = openingBalance + accruedDays - consumedDays + manualAdj;
    runningBalance = closingBalance;

    entries.push({
      id: `ledger-${employeeId}-${period}`,
      employeeId,
      period,
      openingBalance,
      accruedDays,
      consumedDays,
      closingBalance,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  return entries;
}

/**
 * §2.3 Recomputes the employee's available balance as of the request's startDate:
 * opening balance of that month + accrual up to startDate - already-approved consumption in that month prior to startDate.
 */
export function calculateAvailableBalanceAsOf(
  hireDateStr: string,
  asOfStartDateStr: string,
  approvedRequests: AnnualLeaveRequest[],
  manualAdjustments: AnnualLeaveAccrualEvent[] = []
): {
  availableBalance: number;
  openingBalanceOfMonth: number;
  accrualUpToDate: number;
  consumedInMonthPrior: number;
} {
  const targetPeriod = asOfStartDateStr.substring(0, 7);
  const [yearStr, monthStr] = targetPeriod.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // 1. Compute ledger up to previous month to get opening balance of targetPeriod
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevPeriod = formatPeriod(prevYear, prevMonth);

  const hirePeriod = hireDateStr.substring(0, 7);

  let openingBalanceOfMonth = 0;
  if (hirePeriod <= prevPeriod) {
    const prevLedgers = computeLedgerEntries(
      'temp',
      hireDateStr,
      prevPeriod,
      approvedRequests,
      manualAdjustments
    );
    const lastEntry = prevLedgers[prevLedgers.length - 1];
    if (lastEntry) {
      openingBalanceOfMonth = lastEntry.closingBalance;
    }
  }

  // 2. Accrual in target month up to asOfStartDate
  const accrualUpToDate = calculateMonthlyAccrual(hireDateStr, targetPeriod, asOfStartDateStr);

  // 3. Approved consumption in target month (excluding this request)
  let consumedInMonthPrior = 0;
  for (const req of approvedRequests) {
    if (req.status !== 'APPROVED') continue;
    const chunks = splitRangeByMonth(req.startDate, req.endDate);
    for (const chunk of chunks) {
      if (chunk.period === targetPeriod) {
        consumedInMonthPrior += chunk.days;
      }
    }
  }

  // 4. Any manual adjustment in target month
  let adjustmentsInMonth = 0;
  for (const ev of manualAdjustments) {
    const p = ev.createdAt ? ev.createdAt.substring(0, 7) : targetPeriod;
    if (p === targetPeriod) {
      adjustmentsInMonth += ev.amount;
    }
  }

  const availableBalance =
    openingBalanceOfMonth + accrualUpToDate - consumedInMonthPrior + adjustmentsInMonth;

  return {
    availableBalance,
    openingBalanceOfMonth,
    accrualUpToDate,
    consumedInMonthPrior
  };
}

/**
 * §3.1 Weekly Rest Compliance Computation (Pure, on-demand, no new persisted balance)
 */
export function calculateWeeklyRestCompliance(
  assignments: DutyScheduleAssignment[],
  leaves: DutySchedulerLeaveRecord[],
  startDateStr: string,
  endDateStr: string,
  employeeId: string,
  employeeName: string = 'Employee',
  employeeHireDate?: string
): WeeklyRestComplianceRow {
  const totalCalendarDays = calculateInclusiveDays(startDateStr, endDateStr);
  const weeksCount = totalCalendarDays / 7;
  const expectedRestDaysMin = Math.floor(totalCalendarDays / 7);
  const expectedRestDaysMax = Math.ceil(totalCalendarDays / 7);

  // Dates set of scheduled shifts for this employee
  const shiftDates = new Set<string>();
  for (const a of assignments) {
    const emp = a.employeeId || (a as any).employee_id;
    if (emp === employeeId) {
      shiftDates.add(a.date);
    }
  }

  // Set of dates on approved leave (Annual, Sick, Other)
  const approvedLeaveDates = new Set<string>();
  for (const l of leaves) {
    const lEmp = l.employeeId || (l as any).employee_id;
    if (lEmp === employeeId && l.status === 'APPROVED') {
      let cur = new Date(l.startDate + 'T00:00:00Z');
      const lEnd = new Date(l.endDate + 'T00:00:00Z');
      while (cur <= lEnd) {
        approvedLeaveDates.add(cur.toISOString().split('T')[0]);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
  }

  let actualRestDaysTaken = 0;
  let leaveDaysInPeriod = 0;

  let cur = new Date(startDateStr + 'T00:00:00Z');
  const end = new Date(endDateStr + 'T00:00:00Z');

  while (cur <= end) {
    const dateStr = cur.toISOString().split('T')[0];

    // Check outside employment
    if (employeeHireDate && dateStr < employeeHireDate) {
      cur.setUTCDate(cur.getUTCDate() + 1);
      continue;
    }

    const isOnLeave = approvedLeaveDates.has(dateStr);
    const hasShift = shiftDates.has(dateStr);

    if (isOnLeave) {
      leaveDaysInPeriod++;
    } else if (!hasShift) {
      // Genuine scheduled rest day!
      actualRestDaysTaken++;
    }

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  let status: WeeklyRestComplianceStatus = 'OK';
  if (actualRestDaysTaken < expectedRestDaysMin) {
    status = 'UNDER';
  } else if (actualRestDaysTaken > expectedRestDaysMax) {
    status = 'OVER';
  }

  return {
    employeeId,
    employeeName,
    totalCalendarDays,
    weeksCount,
    expectedRestDaysMin,
    expectedRestDaysMax,
    actualRestDaysTaken,
    leaveDaysCount: leaveDaysInPeriod,
    status
  };
}

// =============================================================================
// DATABASE & WORKFLOW SERVICE METHODS (§2, §4)
// =============================================================================

export const leaveManagementService = {
  /**
   * Submits a new annual leave request in PENDING state.
   */
  async submitRequest(input: {
    employeeId: string;
    startDate: string;
    endDate: string;
    requestComments?: string;
  }): Promise<AnnualLeaveRequest> {
    if (!input.employeeId) throw new Error('Employee ID is required');
    if (!input.startDate || !input.endDate) throw new Error('Start date and end date are required');
    if (input.startDate > input.endDate) throw new Error('Start date cannot be after end date');

    const requestedDays = calculateInclusiveDays(input.startDate, input.endDate);

    const { data, error } = await supabaseClient
      .from('annual_leave_requests')
      .insert({
        employee_id: input.employeeId,
        start_date: input.startDate,
        end_date: input.endDate,
        requested_days: requestedDays,
        status: 'PENDING',
        request_comments: input.requestComments || null,
        requested_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error submitting annual leave request:', error);
      throw error;
    }

    return mapRequestFromDB(data);
  },

  /**
   * Approves an annual leave request with hard server-side available balance validation.
   * (§2.3 & §2.4)
   */
  async approveRequest(input: {
    requestId: string;
    decidedByUserId: string;
    decisionComments?: string;
  }): Promise<AnnualLeaveRequest> {
    // 1. Fetch request
    const { data: requestRow, error: reqErr } = await supabaseClient
      .from('annual_leave_requests')
      .select('*')
      .eq('id', input.requestId)
      .single();

    if (reqErr || !requestRow) throw new Error('Leave request not found');
    const req = mapRequestFromDB(requestRow);

    if (req.status !== 'PENDING') {
      throw new Error(`Cannot approve request in status ${req.status}`);
    }

    // 2. Fetch employee hire_date
    const { data: emp, error: empErr } = await supabaseClient
      .from('employees')
      .select('hire_date')
      .eq('id', req.employeeId)
      .single();

    if (empErr || !emp?.hire_date) {
      throw new Error('Employee hire date is not configured');
    }

    // 3. Fetch all approved requests for this employee to check overlap and balance
    const { data: existingApprovedRows, error: exErr } = await supabaseClient
      .from('annual_leave_requests')
      .select('*')
      .eq('employee_id', req.employeeId)
      .eq('status', 'APPROVED');

    if (exErr) throw exErr;
    const existingApproved = (existingApprovedRows || []).map(mapRequestFromDB);

    // Overlap validation: §2.4 "Approving a request whose dates overlap an already-approved request for the same employee should be blocked"
    for (const other of existingApproved) {
      if (doDateRangesOverlap(req.startDate, req.endDate, other.startDate, other.endDate)) {
        throw new Error(
          `Approval blocked: Request dates (${req.startDate} to ${req.endDate}) overlap with existing approved leave (${other.startDate} to ${other.endDate}).`
        );
      }
    }

    // 4. Fetch manual adjustments for this employee
    const { data: eventRows } = await supabaseClient
      .from('annual_leave_accrual_events')
      .select('*')
      .eq('employee_id', req.employeeId);

    const manualAdjustments = (eventRows || []).map(mapEventFromDB);

    // 5. Hard validation (§2.3): Recompute available balance as of request's startDate
    const { availableBalance } = calculateAvailableBalanceAsOf(
      emp.hire_date,
      req.startDate,
      existingApproved,
      manualAdjustments
    );

    if (req.requestedDays > availableBalance) {
      throw new Error(
        `Approval rejected: Requested ${req.requestedDays} days exceeds employee's available balance of ${availableBalance.toFixed(2)} days as of start date (${req.startDate}). Approval would cause a negative balance.`
      );
    }

    // 6. Update request status to APPROVED
    const decidedAt = new Date().toISOString();
    const { data: updatedReq, error: upErr } = await supabaseClient
      .from('annual_leave_requests')
      .update({
        status: 'APPROVED',
        decided_by_user_id: input.decidedByUserId,
        decided_at: decidedAt,
        decision_comments: input.decisionComments || 'Approved'
      })
      .eq('id', req.id)
      .select()
      .single();

    if (upErr) throw upErr;

    // 7. Split consumption across months and record CONSUMPTION events & ledger entries
    await this.recomputeAndPersistEmployeeLedger(req.employeeId, emp.hire_date);

    return mapRequestFromDB(updatedReq);
  },

  /**
   * Rejects an annual leave request. Requires decisionComments.
   * (§2.1, §2.2, §5 Test 5)
   */
  async rejectRequest(input: {
    requestId: string;
    decidedByUserId: string;
    decisionComments: string;
  }): Promise<AnnualLeaveRequest> {
    if (!input.decisionComments || input.decisionComments.trim().length === 0) {
      throw new Error('Decision comments are required when rejecting a leave request.');
    }

    const { data: requestRow, error: reqErr } = await supabaseClient
      .from('annual_leave_requests')
      .select('*')
      .eq('id', input.requestId)
      .single();

    if (reqErr || !requestRow) throw new Error('Leave request not found');

    const { data: updatedReq, error: upErr } = await supabaseClient
      .from('annual_leave_requests')
      .update({
        status: 'REJECTED',
        decided_by_user_id: input.decidedByUserId,
        decided_at: new Date().toISOString(),
        decision_comments: input.decisionComments.trim()
      })
      .eq('id', input.requestId)
      .select()
      .single();

    if (upErr) throw upErr;
    return mapRequestFromDB(updatedReq);
  },

  /**
   * Cancels a pending or approved annual leave request.
   * (§2.1, §2.5, §5 Test 6)
   */
  async cancelRequest(input: {
    requestId: string;
    actorUserId: string;
    note?: string;
  }): Promise<AnnualLeaveRequest> {
    const { data: requestRow, error: reqErr } = await supabaseClient
      .from('annual_leave_requests')
      .select('*')
      .eq('id', input.requestId)
      .single();

    if (reqErr || !requestRow) throw new Error('Leave request not found');
    const req = mapRequestFromDB(requestRow);

    const todayStr = new Date().toISOString().split('T')[0];

    if (req.status === 'APPROVED') {
      // Only future-dated approved leave can be cancelled (§2.5)
      if (req.startDate <= todayStr) {
        throw new Error(
          'Cannot cancel leave that has already started or completed. Only future-dated leave may be cancelled.'
        );
      }
    } else if (req.status !== 'PENDING') {
      throw new Error(`Cannot cancel request in status ${req.status}`);
    }

    // Update status to CANCELLED
    const { data: updatedReq, error: upErr } = await supabaseClient
      .from('annual_leave_requests')
      .update({
        status: 'CANCELLED',
        decision_comments: input.note ? `Cancelled: ${input.note}` : 'Cancelled by user',
        updated_at: new Date().toISOString()
      })
      .eq('id', req.id)
      .select()
      .single();

    if (upErr) throw upErr;

    // If was APPROVED, recompute ledger to refund the consumed days
    if (req.status === 'APPROVED') {
      const { data: emp } = await supabaseClient
        .from('employees')
        .select('hire_date')
        .eq('id', req.employeeId)
        .single();

      if (emp?.hire_date) {
        // Record refund event in history
        const chunks = splitRangeByMonth(req.startDate, req.endDate);
        for (const chunk of chunks) {
          await supabaseClient.from('annual_leave_accrual_events').insert({
            employee_id: req.employeeId,
            event_type: 'CONSUMPTION_REFUND',
            amount: chunk.days,
            related_request_id: req.id,
            note: `Refund for cancelled request (${req.startDate} to ${req.endDate})`,
            created_by_user_id: input.actorUserId
          });
        }

        await this.recomputeAndPersistEmployeeLedger(req.employeeId, emp.hire_date);
      }
    }

    return mapRequestFromDB(updatedReq);
  },

  /**
   * Adds an audited manual balance adjustment. (§1.2)
   */
  async addManualAdjustment(input: {
    employeeId: string;
    amount: number; // positive or negative
    note: string;
    actorUserId: string;
  }): Promise<AnnualLeaveAccrualEvent> {
    if (!input.note || input.note.trim().length === 0) {
      throw new Error('A descriptive note is required for manual adjustments.');
    }

    const { data: emp } = await supabaseClient
      .from('employees')
      .select('hire_date')
      .eq('id', input.employeeId)
      .single();

    if (!emp?.hire_date) throw new Error('Employee hire date not found');

    const { data: evData, error: evErr } = await supabaseClient
      .from('annual_leave_accrual_events')
      .insert({
        employee_id: input.employeeId,
        event_type: 'MANUAL_ADJUSTMENT',
        amount: input.amount,
        note: input.note.trim(),
        created_by_user_id: input.actorUserId
      })
      .select()
      .single();

    if (evErr) throw evErr;

    await this.recomputeAndPersistEmployeeLedger(input.employeeId, emp.hire_date);
    return mapEventFromDB(evData);
  },

  /**
   * Recomputes and persists monthly ledger entries for an employee from hire date up to current month.
   */
  async recomputeAndPersistEmployeeLedger(
    employeeId: string,
    hireDateStr: string
  ): Promise<AnnualLeaveLedgerEntry[]> {
    const currentPeriod = new Date().toISOString().substring(0, 7);

    // 1. Fetch approved requests
    const { data: approvedRows } = await supabaseClient
      .from('annual_leave_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('status', 'APPROVED');

    const approvedRequests = (approvedRows || []).map(mapRequestFromDB);

    // 2. Fetch manual events
    const { data: eventRows } = await supabaseClient
      .from('annual_leave_accrual_events')
      .select('*')
      .eq('employee_id', employeeId);

    const manualEvents = (eventRows || []).map(mapEventFromDB);

    // 3. Compute ledger rows
    const entries = computeLedgerEntries(
      employeeId,
      hireDateStr,
      currentPeriod,
      approvedRequests,
      manualEvents
    );

    // 4. Upsert into database
    for (const entry of entries) {
      await supabaseClient.from('annual_leave_ledger_entries').upsert(
        {
          employee_id: entry.employeeId,
          period: entry.period,
          opening_balance: entry.openingBalance,
          accrued_days: entry.accruedDays,
          consumed_days: entry.consumedDays,
          closing_balance: entry.closingBalance,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'employee_id,period' }
      );
    }

    return entries;
  },

  /**
   * Retrieves all annual leave requests with optional filters.
   */
  async getRequests(options?: {
    employeeId?: string;
    status?: AnnualLeaveRequestStatus;
  }): Promise<AnnualLeaveRequest[]> {
    let query = supabaseClient
      .from('annual_leave_requests')
      .select('*')
      .order('start_date', { ascending: false });

    if (options?.employeeId) {
      query = query.eq('employee_id', options.employeeId);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapRequestFromDB);
  },

  /**
   * Retrieves ledger entries for an employee.
   */
  async getLedger(employeeId: string): Promise<AnnualLeaveLedgerEntry[]> {
    const { data, error } = await supabaseClient
      .from('annual_leave_ledger_entries')
      .select('*')
      .eq('employee_id', employeeId)
      .order('period', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapLedgerFromDB);
  },

  /**
   * Retrieves transaction / audit events for an employee.
   */
  async getEvents(employeeId: string): Promise<AnnualLeaveAccrualEvent[]> {
    const { data, error } = await supabaseClient
      .from('annual_leave_accrual_events')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapEventFromDB);
  },

  /**
   * Generates Weekly Rest Compliance Report for a given date range. (§3)
   */
  async getWeeklyRestComplianceReport(
    startDateStr: string,
    endDateStr: string
  ): Promise<WeeklyRestComplianceReport> {
    // 1. Fetch pharmacists / employees
    const { data: emps, error: empErr } = await supabaseClient
      .from('employees')
      .select('*')
      .eq('category', 'Pharmacist')
      .eq('status', 'Active');

    if (empErr) throw empErr;

    // 2. Fetch schedule assignments in date range
    const { data: assignments, error: assignErr } = await supabaseClient
      .from('duty_schedule_assignments')
      .select('*')
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (assignErr) throw assignErr;

    // 3. Fetch leaves (union of Annual + Sick/Other) in date range
    const { data: annualLeaves } = await supabaseClient
      .from('annual_leave_requests')
      .select('*')
      .eq('status', 'APPROVED')
      .lte('start_date', endDateStr)
      .gte('end_date', startDateStr);

    const { data: interimLeaves } = await supabaseClient
      .from('duty_scheduler_leave_records')
      .select('*')
      .eq('status', 'APPROVED')
      .lte('start_date', endDateStr)
      .gte('end_date', startDateStr);

    const allLeaves: DutySchedulerLeaveRecord[] = [
      ...(annualLeaves || []).map((a: any) => ({
        id: a.id,
        employeeId: a.employee_id,
        leaveType: 'ANNUAL',
        startDate: a.start_date,
        endDate: a.end_date,
        status: a.status,
        notes: a.request_comments,
        createdAt: a.created_at,
        updatedAt: a.updated_at
      })),
      ...(interimLeaves || []).map((i: any) => ({
        id: i.id,
        employeeId: i.employee_id,
        leaveType: i.leave_type,
        startDate: i.start_date,
        endDate: i.end_date,
        status: i.status,
        notes: i.notes,
        createdAt: i.created_at,
        updatedAt: i.updated_at
      }))
    ];

    const rows: WeeklyRestComplianceRow[] = [];
    for (const emp of emps || []) {
      const row = calculateWeeklyRestCompliance(
        assignments || [],
        allLeaves,
        startDateStr,
        endDateStr,
        emp.id,
        emp.full_name,
        emp.hire_date
      );
      rows.push(row);
    }

    const okCount = rows.filter(r => r.status === 'OK').length;
    const underCount = rows.filter(r => r.status === 'UNDER').length;
    const overCount = rows.filter(r => r.status === 'OVER').length;

    return {
      startDate: startDateStr,
      endDate: endDateStr,
      rows,
      summary: {
        totalEmployees: rows.length,
        okCount,
        underCount,
        overCount
      }
    };
  }
};

// =============================================================================
// DB MAPPERS
// =============================================================================

function mapRequestFromDB(r: any): AnnualLeaveRequest {
  return {
    id: r.id,
    employeeId: r.employee_id,
    startDate: r.start_date,
    endDate: r.end_date,
    requestedDays: Number(r.requested_days),
    status: r.status,
    requestComments: r.request_comments,
    requestedAt: r.requested_at,
    decidedByUserId: r.decided_by_user_id,
    decidedAt: r.decided_at,
    decisionComments: r.decision_comments,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

function mapLedgerFromDB(l: any): AnnualLeaveLedgerEntry {
  return {
    id: l.id,
    employeeId: l.employee_id,
    period: l.period,
    openingBalance: Number(l.opening_balance),
    accruedDays: Number(l.accrued_days),
    consumedDays: Number(l.consumed_days),
    closingBalance: Number(l.closing_balance),
    createdAt: l.created_at,
    updatedAt: l.updated_at
  };
}

function mapEventFromDB(e: any): AnnualLeaveAccrualEvent {
  return {
    id: e.id,
    employeeId: e.employee_id,
    ledgerEntryId: e.ledger_entry_id,
    eventType: e.event_type,
    amount: Number(e.amount),
    relatedRequestId: e.related_request_id,
    note: e.note,
    createdByUserId: e.created_by_user_id,
    createdAt: e.created_at
  };
}
