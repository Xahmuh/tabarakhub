import { supabaseClient } from '../lib/supabaseClient';
import { HRRequest, DutySchedulerLeaveRecord } from '../types';
import { workforceService, Employee } from './workforceService';
import { leaveManagementService, calculateInclusiveDays } from './leaveManagementService';
import { dutySchedulerService } from './dutySchedulerService';

export interface LeaveSyncResult {
  success: boolean;
  action: 'CREATED_ANNUAL' | 'CREATED_INTERIM' | 'ALREADY_SYNCED' | 'FAILED';
  recordId?: string;
  employeeId?: string;
  employeeName?: string;
  message: string;
}

export const leaveSyncService = {
  /**
   * Resolves an employee from an HR request by CPR, code, or name.
   */
  async resolveEmployee(request: HRRequest): Promise<Employee | null> {
    const employees = await workforceService.getAllEmployees();

    const cleanCpr = (request.cpr || '').replace(/\D/g, '');
    if (cleanCpr) {
      const byCpr = employees.find(e => {
        const empCpr = (e.cpr_number || e.salary_matrix?.expatCpr || '').replace(/\D/g, '');
        return empCpr && (empCpr === cleanCpr || empCpr.endsWith(cleanCpr) || cleanCpr.endsWith(empCpr));
      });
      if (byCpr) return byCpr;
    }

    // Match by full name
    const reqName = (request.employeeName || '').trim().toLowerCase();
    if (reqName) {
      const byName = employees.find(e => e.full_name.trim().toLowerCase() === reqName);
      if (byName) return byName;

      // Partial name match
      const byPartial = employees.find(e => {
        const n = e.full_name.trim().toLowerCase();
        return n.includes(reqName) || reqName.includes(n);
      });
      if (byPartial) return byPartial;
    }

    return null;
  },

  /**
   * Synchronizes an approved Vacation Request into Leave Management and Duty Scheduler.
   */
  async syncApprovedHrRequest(request: HRRequest, decidedByUserId: string = 'hr-admin'): Promise<LeaveSyncResult> {
    if (!request.holidayFrom || !request.holidayTo) {
      return {
        success: false,
        action: 'FAILED',
        message: 'Request does not contain holiday dates (holidayFrom / holidayTo).'
      };
    }

    const emp = await this.resolveEmployee(request);
    if (!emp) {
      console.warn(`[LeaveSync] Could not resolve employee for CPR ${request.cpr} (${request.employeeName})`);
      return {
        success: false,
        action: 'FAILED',
        message: `Employee not found in Workforce Directory for CPR ${request.cpr || 'N/A'} (${request.employeeName}).`
      };
    }

    const startDate = request.holidayFrom;
    const endDate = request.holidayTo;
    const rawLeaveType = (request.leaveType || 'Annual').trim().toUpperCase();
    const daysCount = request.daysCount || calculateInclusiveDays(startDate, endDate);
    const syncRefNote = `[HR-SYNC:${request.refNum || request.id}] ${request.notes || ''}`.trim();

    // Check if already synced in annual_leave_requests
    const { data: existingAnnual } = await supabaseClient
      .from('annual_leave_requests')
      .select('id, status')
      .eq('employee_id', emp.id)
      .eq('start_date', startDate)
      .eq('end_date', endDate)
      .maybeSingle();

    if (existingAnnual) {
      if (existingAnnual.status !== 'APPROVED') {
        await supabaseClient
          .from('annual_leave_requests')
          .update({
            status: 'APPROVED',
            decided_by_user_id: decidedByUserId,
            decided_at: new Date().toISOString(),
            decision_comments: `Approved via HR Admin Portal (Ref: ${request.refNum || request.id})`
          })
          .eq('id', existingAnnual.id);

        await leaveManagementService.recomputeAndPersistEmployeeLedger(emp.id, request.joinDate);
      }
      return {
        success: true,
        action: 'ALREADY_SYNCED',
        recordId: existingAnnual.id,
        employeeId: emp.id,
        employeeName: emp.full_name,
        message: `Existing leave record (${existingAnnual.id}) confirmed as APPROVED.`
      };
    }

    // Check if already synced in duty_scheduler_leave_records
    const { data: existingInterim } = await supabaseClient
      .from('duty_scheduler_leave_records')
      .select('id, status')
      .eq('employee_id', emp.id)
      .eq('start_date', startDate)
      .eq('end_date', endDate)
      .maybeSingle();

    if (existingInterim) {
      return {
        success: true,
        action: 'ALREADY_SYNCED',
        recordId: existingInterim.id,
        employeeId: emp.id,
        employeeName: emp.full_name,
        message: `Existing interim leave record (${existingInterim.id}) confirmed.`
      };
    }

    // 1. Annual Leave Branch
    if (rawLeaveType.includes('ANNUAL') || rawLeaveType === 'ANNUAL') {
      const { data: newAnnual, error: annErr } = await supabaseClient
        .from('annual_leave_requests')
        .insert({
          employee_id: emp.id,
          start_date: startDate,
          end_date: endDate,
          requested_days: daysCount,
          status: 'APPROVED',
          request_comments: syncRefNote,
          requested_at: request.timestamp || new Date().toISOString(),
          decided_by_user_id: decidedByUserId,
          decided_at: new Date().toISOString(),
          decision_comments: `Approved via HR Portal (Ref: ${request.refNum || request.id})`
        })
        .select()
        .single();

      if (annErr) {
        console.error('[LeaveSync] Failed to insert annual_leave_requests:', annErr);
        throw annErr;
      }

      // Automatically recalculate and persist Bahrain Labor Law ledger
      try {
        await leaveManagementService.recomputeAndPersistEmployeeLedger(emp.id, request.joinDate);
      } catch (ledgerErr) {
        console.warn('[LeaveSync] Ledger recomputation notice:', ledgerErr);
      }

      return {
        success: true,
        action: 'CREATED_ANNUAL',
        recordId: newAnnual.id,
        employeeId: emp.id,
        employeeName: emp.full_name,
        message: `Synchronized Annual Leave for ${emp.full_name} (${startDate} to ${endDate}). Ledger updated & Duty Scheduler blocked.`
      };
    }

    // 2. Interim Leave Branch (Sick, Emergency, Special)
    let mappedType: 'SICK' | 'MATERNITY' | 'HAJJ' | 'BEREAVEMENT' | 'UNPAID' | 'OTHER' = 'OTHER';
    if (rawLeaveType.includes('SICK')) mappedType = 'SICK';
    else if (rawLeaveType.includes('EMERG') || rawLeaveType.includes('UNPAID')) mappedType = 'UNPAID';

    const { data: newInterim, error: intErr } = await supabaseClient
      .from('duty_scheduler_leave_records')
      .insert({
        employee_id: emp.id,
        leave_type: mappedType,
        start_date: startDate,
        end_date: endDate,
        status: 'APPROVED',
        notes: syncRefNote,
        created_by: decidedByUserId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (intErr) {
      console.error('[LeaveSync] Failed to insert duty_scheduler_leave_records:', intErr);
      throw intErr;
    }

    return {
      success: true,
      action: 'CREATED_INTERIM',
      recordId: newInterim.id,
      employeeId: emp.id,
      employeeName: emp.full_name,
      message: `Synchronized ${mappedType} Leave for ${emp.full_name} (${startDate} to ${endDate}). Duty Scheduler blocked.`
    };
  },

  /**
   * Synchronizes a rejected Vacation Request.
   */
  async syncRejectedHrRequest(request: HRRequest, decidedByUserId: string = 'hr-admin'): Promise<void> {
    if (!request.holidayFrom || !request.holidayTo) return;
    const emp = await this.resolveEmployee(request);
    if (!emp) return;

    // Update annual leave
    await supabaseClient
      .from('annual_leave_requests')
      .update({
        status: 'REJECTED',
        decided_by_user_id: decidedByUserId,
        decided_at: new Date().toISOString(),
        decision_comments: `Rejected via HR Admin Portal (Ref: ${request.refNum || request.id})`
      })
      .eq('employee_id', emp.id)
      .eq('start_date', request.holidayFrom)
      .eq('end_date', request.holidayTo);

    // Update interim leave
    await supabaseClient
      .from('duty_scheduler_leave_records')
      .update({
        status: 'REJECTED'
      })
      .eq('employee_id', emp.id)
      .eq('start_date', request.holidayFrom)
      .eq('end_date', request.holidayTo);

    // Recompute ledger to refund balances if any
    try {
      await leaveManagementService.recomputeAndPersistEmployeeLedger(emp.id, request.joinDate);
    } catch {}
  },

  /**
   * Retroactively reconciles all approved HR vacation requests into Leave Management.
   */
  async reconcileAllApprovedRequests(): Promise<{ total: number; synced: number; skipped: number; errors: number }> {
    const { data: hrList, error } = await supabaseClient
      .from('hr_requests')
      .select('*')
      .eq('type', 'Vacation Request')
      .eq('status', 'Approved');

    if (error || !hrList) return { total: 0, synced: 0, skipped: 0, errors: 0 };

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of hrList) {
      try {
        const req: HRRequest = {
          id: row.id,
          refNum: row.ref_num,
          employeeName: row.employee_name,
          cpr: row.cpr,
          type: row.type,
          docTypes: row.doc_types || [],
          deliveryMethod: row.delivery_method || 'Email',
          email: row.email || '',
          status: row.status,
          holidayFrom: row.holiday_from,
          holidayTo: row.holiday_to,
          daysCount: row.days_count,
          leaveType: row.leave_type,
          notes: row.notes,
          joinDate: row.join_date,
          timestamp: row.timestamp
        };

        const res = await this.syncApprovedHrRequest(req);
        if (res.action === 'CREATED_ANNUAL' || res.action === 'CREATED_INTERIM') {
          synced++;
        } else {
          skipped++;
        }
      } catch {
        errors++;
      }
    }

    return { total: hrList.length, synced, skipped, errors };
  }
};
