import { supabaseClient } from '../lib/supabaseClient';
import { assertSinglePublishedAssignmentPerDay, getPayrollMonthBounds } from '../lib/payrollSafety';
import { workforceService, Employee } from './workforceService';

type DatabaseRow = Record<string, any>;

const fetchPages = async (
  fetch: (start: number, end: number) => PromiseLike<{ data: DatabaseRow[] | null; error: any }>
): Promise<DatabaseRow[]> => {
  const pageSize = 500;
  const rows: DatabaseRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await fetch(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
};

export interface PayrollSourceData {
  employees: Employee[];
  assignments: DatabaseRow[];
  annualLeaves: DatabaseRow[];
  interimLeaves: DatabaseRow[];
  authorizedDeductions: DatabaseRow[];
  authorizedEarnings: DatabaseRow[];
}

export const payrollDataService = {
  async getSources(month: string): Promise<PayrollSourceData> {
    const { start, end } = getPayrollMonthBounds(month);

    // A payroll load fails if any required database read fails. Empty demo/local data
    // must never be substituted for failed or missing financial records.
    const employees = await workforceService.getPayrollEmployeesFromDatabase();
    const schedules = await fetchPages((from, to) => supabaseClient
      .from('duty_schedules')
      .select('id,period_start,period_end,status,version')
      .eq('status', 'PUBLISHED')
      .lte('period_start', end)
      .gte('period_end', start)
      .order('id', { ascending: true })
      .range(from, to));

    const assignments: DatabaseRow[] = [];
    for (let offset = 0; offset < schedules.length; offset += 100) {
      const ids = schedules.slice(offset, offset + 100).map(row => row.id);
      assignments.push(...await fetchPages((from, to) => supabaseClient
        .from('duty_schedule_assignments')
        .select('id,schedule_id,employee_id,branch_id,date,shift_code,is_relief')
        .in('schedule_id', ids)
        .gte('date', start)
        .lte('date', end)
        .order('id', { ascending: true })
        .range(from, to)));
    }

    assertSinglePublishedAssignmentPerDay(assignments as Array<{ employee_id: string; date: string }>);

    const [annualLeaves, interimLeaves, authorizedDeductions, authorizedEarnings] = await Promise.all([
      fetchPages((from, to) => supabaseClient.from('annual_leave_requests')
        .select('id,employee_id,start_date,end_date,requested_days,status')
        .eq('status', 'APPROVED').lte('start_date', end).gte('end_date', start)
        .order('id', { ascending: true }).range(from, to)),
      fetchPages((from, to) => supabaseClient.from('duty_scheduler_leave_records')
        .select('id,employee_id,start_date,end_date,leave_type,status')
        .eq('status', 'APPROVED').lte('start_date', end).gte('end_date', start)
        .order('id', { ascending: true }).range(from, to)),
      fetchPages((from, to) => supabaseClient.from('payroll_authorized_deductions')
        .select('id,employee_id,pay_month,amount_bhd,source_type,source_ref')
        .eq('pay_month', start).order('id', { ascending: true }).range(from, to)),
      fetchPages((from, to) => supabaseClient.from('payroll_authorized_earnings')
        .select('id,employee_id,pay_month,amount_bhd,source_type,source_ref,hours')
        .eq('pay_month', start).order('id', { ascending: true }).range(from, to))
    ]);

    return { employees, assignments, annualLeaves, interimLeaves, authorizedDeductions, authorizedEarnings };
  }
};
