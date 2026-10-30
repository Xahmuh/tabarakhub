import { Employee } from '../../services/workforceService';
import { branchService } from '../../services/branchService';
import { payrollDataService } from '../../services/payrollDataService';
import { getLeaveDaysInMonth, getPayrollMonthBounds, isValidBahrainIban } from '../../lib/payrollSafety';
import { SearchableSelect } from '../delivery/components/SearchableSelect';
import {
  Banknote,
  Building2,
  Calculator,
  Calendar,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  Edit2,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
  X,
  AlertCircle,
  BriefcaseMedical
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { formatBhd } from '../../utils/money';

export interface StaffPayrollRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  category: string;
  cprNumber: string;
  iban: string;
  bankName: string;
  primaryBranchName: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  totalFixed: number;
  hasNhraLicense: boolean;
  nhraLicenseNo: string;
  nhraAllowance: number;
  regularShiftsCount: number;
  nightShiftsCount: number;
  nightShiftPay: number;
  reliefShiftsCount: number;
  reliefShiftsPay: number;
  responsibilityBonus: number;
  annualLeaveDays: number;
  unpaidLeaveDays: number;
  unpaidDeduction: number;
  gosiDeduction: number;
  attendancePenalty: number;
  overtimeMinutes: number;
  overtimePay: number;
  otherDeductions: number;
  customAdjustment: number;
  customNotes: string;
  totalGross: number;
  totalDeductions: number;
  netPayable: number;
}

export interface StaffPayrollSettings {
  nightShiftBonusRate: number;
  reliefShiftBonusRate: number;
  defaultNhraAllowance: number;
  gosiPercentage: number;
}

const DEFAULT_SETTINGS: StaffPayrollSettings = {
  nightShiftBonusRate: 0,
  reliefShiftBonusRate: 0,
  defaultNhraAllowance: 0,
  gosiPercentage: 0
};


export const StaffPayrollHub: React.FC<{ canEditRules: boolean }> = ({ canEditRules }) => {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [payrollRows, setPayrollRows] = useState<StaffPayrollRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paymentIssues, setPaymentIssues] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');

  // Custom manager adjustments per employeeId
  const [overrides, setOverrides] = useState<Record<string, { adjustment: number; notes: string }>>({});
  const [editingRow, setEditingRow] = useState<StaffPayrollRow | null>(null);
  const [editAdjustmentInput, setEditAdjustmentInput] = useState<string>('0');
  const [editNotesInput, setEditNotesInput] = useState<string>('');

  // Settings
  const [settings, setSettings] = useState<StaffPayrollSettings>(DEFAULT_SETTINGS);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Single employee print modal
  const [printingRow, setPrintingRow] = useState<StaffPayrollRow | null>(null);
  const payslipPrintRef = useRef<HTMLDivElement>(null);

  const handlePrintPayslip = useReactToPrint({
    contentRef: payslipPrintRef,
    documentTitle: printingRow ? `Payslip_${printingRow.employeeCode}_${selectedMonth}` : `Payslips_${selectedMonth}`
  });

  useEffect(() => {
    loadPayrollData();
  }, [selectedMonth, settings]);

  const loadPayrollData = async () => {
    setIsLoading(true);
    setLoadError(null);
    setPayrollRows([]);
    setPaymentIssues([]);
    try {
      const [sources, fetchedBranches] = await Promise.all([
        payrollDataService.getSources(selectedMonth),
        branchService.getBranches()
      ]);

      const { employees: fetchedEmployees, assignments, annualLeaves, interimLeaves, authorizedDeductions, authorizedEarnings } = sources;

      setEmployees(fetchedEmployees);
      setBranches(fetchedBranches);

      getPayrollMonthBounds(selectedMonth);
      const issues: string[] = [
        'No published company payroll policy or dual-approved payroll run exists. Every amount below is an estimate only.'
      ];
      if (fetchedEmployees.length === 0) issues.push('No employees were returned from the database.');

      // Build rows for non-drivers (drivers have DriverPayrollHub)
      const rows: StaffPayrollRow[] = fetchedEmployees
        .filter(emp => emp.category !== 'Driver' && emp.status !== 'Inactive')
        .map(emp => {
          const matrix = emp.salary_matrix || {};
          const amount = (label: string, value: unknown): number => {
            if (value == null || value === '') return 0;
            const parsed = Number(value);
            if (!Number.isFinite(parsed) || parsed < 0) {
              issues.push(`${emp.code}: ${label} is invalid.`);
              return 0;
            }
            return parsed;
          };
          const primaryAssignment = emp.assignments?.find(a => a.is_primary) || emp.assignments?.[0];
          const branchName = primaryAssignment?.branch_name ||
            fetchedBranches.find(b => b.id === primaryAssignment?.branch_id)?.name || 'General Operations';

          // Schedule stats
          const empAssignments = (assignments || []).filter((a: any) => a.employee_id === emp.id || a.employeeId === emp.id);
          const regularShiftsCount = empAssignments.filter((a: any) => (a.shift_code || a.shiftCode) !== 'NIGHT').length;
          const nightShiftsCount = empAssignments.filter((a: any) => (a.shift_code || a.shiftCode) === 'NIGHT').length;
          const reliefShiftsCount = empAssignments.filter((a: any) => Boolean(a.is_relief || a.isRelief)).length;

          // Leaves
          const empAnnual = (annualLeaves || []).filter((l: any) => l.employee_id === emp.id);
          const empInterim = (interimLeaves || []).filter((l: any) => l.employee_id === emp.id);

          const annualLeaveDays = empAnnual.reduce((acc: number, l: any) =>
            acc + getLeaveDaysInMonth(l.start_date, l.end_date, selectedMonth), 0);
          const unpaidLeaveDays = empInterim
            .filter((l: any) => l.leave_type === 'UNPAID')
            .reduce((acc: number, l: any) => acc + getLeaveDaysInMonth(l.start_date, l.end_date, selectedMonth), 0);

          // Fixed components
          const basicSalary = Number(matrix.basicSalary);
          if (!Number.isFinite(basicSalary) || basicSalary <= 0) {
            issues.push(`${emp.code}: basic salary is missing or invalid.`);
          }
          const safeBasicSalary = Number.isFinite(basicSalary) && basicSalary > 0 ? basicSalary : 0;
          const iban = (matrix.iban || '').replace(/\s+/g, '').toUpperCase();
          if (!isValidBahrainIban(iban)) issues.push(`${emp.code}: a valid Bahrain IBAN is required.`);
          const housingAllowance = amount('housing allowance', matrix.housing);
          const transportAllowance = amount('transport allowance', matrix.transportation);
          const totalFixed = safeBasicSalary + housingAllowance + transportAllowance;

          // NHRA License Allowance
          const hasNhraLicense = Boolean(matrix.nhraLicenseNo || (emp as any).nhra_license_no);
          const employeeEarnings = authorizedEarnings.filter(e => e.employee_id === emp.id);
          const approvedAmount = (sourceType: string) => employeeEarnings
            .filter(e => e.source_type === sourceType)
            .reduce((sum, e) => sum + amount(`approved ${sourceType}`, e.amount_bhd), 0);
          const nhraAllowance = approvedAmount('license');

          // Variable bonuses
          const responsibilityBonus = approvedAmount('bonus') + approvedAmount('other');
          const nightShiftPay = approvedAmount('night_shift');
          const reliefShiftsPay = approvedAmount('relief_shift');

          // Only deductions approved in the database can affect a payroll preview.
          // Device-local punches and local penalty settings are not payroll evidence.
          const attendancePenalty = authorizedDeductions
            .filter(d => d.employee_id === emp.id)
            .reduce((sum, d) => sum + amount('approved deduction', d.amount_bhd), 0);
          const overtimeMinutes = employeeEarnings
            .filter(e => e.source_type === 'overtime')
            .reduce((sum, e) => sum + amount('approved overtime hours', e.hours) * 60, 0);
          const overtimePay = approvedAmount('overtime');

          // Deductions
          const gosiDeduction = 0;
          if (Number(matrix.gosi1Pct || 0) !== 0) {
            issues.push(`${emp.code}: legacy GOSI amount is excluded until approved.`);
          }
          const unpaidDeduction = 0;
          if (unpaidLeaveDays) issues.push(`${emp.code}: unpaid leave calculation basis needs approval.`);
          const unverifiedDeductions = ['payrollDedLoan', 'ewaFees', 'othersDeduction']
            .some(key => Number(matrix[key as keyof typeof matrix] || 0) !== 0);
          if (unverifiedDeductions) issues.push(`${emp.code}: legacy salary-matrix deductions need source/approval verification.`);
          const otherDeductions = 0;

          // Custom Override
          const userOverride = overrides[emp.id] || { adjustment: 0, notes: '' };

          if (Number(matrix.jobResponsibilityBonus || 0) !== 0) {
            issues.push(`${emp.code}: legacy responsibility bonus is excluded until approved.`);
          }
          const totalGross = totalFixed + nhraAllowance + responsibilityBonus + nightShiftPay + reliefShiftsPay + overtimePay;
          const totalDeductions = gosiDeduction + unpaidDeduction + attendancePenalty + otherDeductions;
          const rawNet = Math.round((totalGross - totalDeductions) * 1000) / 1000;
          if (rawNet < 0) issues.push(`${emp.code}: deductions exceed gross pay.`);
          const netPayable = Math.max(0, rawNet);

          return {
            employeeId: emp.id,
            employeeCode: emp.code || 'EMP',
            employeeName: emp.full_name,
            category: emp.category || 'Staff',
            cprNumber: emp.cpr_number || matrix.expatCpr || '—',
            iban,
            bankName: iban ? iban.slice(4, 8) : '',
            primaryBranchName: branchName,
            basicSalary: safeBasicSalary,
            housingAllowance,
            transportAllowance,
            totalFixed,
            hasNhraLicense,
            nhraLicenseNo: matrix.nhraLicenseNo || '—',
            nhraAllowance,
            regularShiftsCount,
            nightShiftsCount,
            nightShiftPay,
            reliefShiftsCount,
            reliefShiftsPay,
            responsibilityBonus,
            annualLeaveDays,
            unpaidLeaveDays,
            unpaidDeduction,
            gosiDeduction,
            attendancePenalty,
            overtimeMinutes,
            overtimePay,
            otherDeductions,
            customAdjustment: 0,
            customNotes: '',
            totalGross,
            totalDeductions,
            netPayable
          };
        });

      setPayrollRows(rows);
      setPaymentIssues(issues);
    } catch (err) {
      console.error('Failed to load staff payroll data:', err);
      setLoadError(err instanceof Error ? err.message : 'Could not load payroll data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAdjustment = () => {
    if (!canEditRules || !editingRow) return;
    const adj = Number(editAdjustmentInput);
    if (!Number.isFinite(adj) || !editNotesInput.trim()) return;
    setOverrides(prev => ({
      ...prev,
      [editingRow.employeeId]: {
        adjustment: adj,
        notes: editNotesInput
      }
    }));
    setEditingRow(null);
  };

  const filteredRows = useMemo(() => {
    return payrollRows.filter(r => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = !q ||
        r.employeeName.toLowerCase().includes(q) ||
        r.employeeCode.toLowerCase().includes(q) ||
        r.cprNumber.includes(q);

      const matchesCat = selectedCategory === 'ALL' || r.category === selectedCategory;
      const matchesBranch = selectedBranch === 'ALL' || r.primaryBranchName === selectedBranch;

      return matchesSearch && matchesCat && matchesBranch;
    });
  }, [payrollRows, searchTerm, selectedCategory, selectedBranch]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalStaff = filteredRows.length;
    const totalNet = filteredRows.reduce((acc, r) => acc + r.netPayable, 0);
    const totalReliefHours = filteredRows.reduce((acc, r) => acc + r.reliefShiftsCount, 0);
    const totalNightShifts = filteredRows.reduce((acc, r) => acc + r.nightShiftsCount, 0);
    const totalNhraAllowances = filteredRows.reduce((acc, r) => acc + r.nhraAllowance, 0);

    return {
      totalStaff,
      totalNet,
      totalReliefHours,
      totalNightShifts,
      totalNhraAllowances
    };
  }, [filteredRows]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Controls Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-brand">Automated HR Compensation</span>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> Preview Only
            </span>
          </div>
          <h3 className="text-2xl font-black text-slate-950">Staff &amp; Pharmacist Monthly Payroll</h3>
          <p className="text-xs text-slate-500 font-medium">
            Unapproved estimate from database records. Payment, bank export and payslips require approved payroll rules and a published run signed by Owner and Accounts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Calendar className="h-4 w-4 text-slate-500 ml-2" />
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-900 border-none outline-none pr-2 cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={loadPayrollData}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Payroll Metrics"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {canEditRules && <button
            type="button"
            disabled
            title="Rates must be configured and approved in a persistent payroll policy."
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold border border-slate-200 opacity-50 cursor-not-allowed"
          >
            <Calculator className="h-3.5 w-3.5" /> Rates &amp; Rules
          </button>}

          <button
            type="button"
            disabled
            title="A published payroll run approved by Owner and Accounts is required."
            className="btn-primary inline-flex items-center gap-1.5 text-xs font-bold opacity-50 cursor-not-allowed"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export IBAN Batch
          </button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Payroll data could not be loaded: {loadError}
        </div>
      )}
      {paymentIssues.length > 0 && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Payroll is blocked for payment.</strong>
          <ul className="mt-2 list-disc pl-5">
            {paymentIssues.map(issue => <li key={issue}>{issue}</li>)}
          </ul>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Estimated Net (Not Payable)</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-950">{formatBhd(metrics.totalNet)}</p>
          <p className="mt-0.5 text-[11px] text-slate-400 font-semibold">{metrics.totalStaff} staff active on payroll</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Scheduler Relief Shifts</span>
            <Users className="h-4 w-4 text-brand" />
          </div>
          <p className="mt-2 text-2xl font-black text-brand">{metrics.totalReliefHours} Covered</p>
          <p className="mt-0.5 text-[11px] text-slate-400 font-semibold">Logged via Duty Scheduler</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Night Shift Count</span>
            <Sparkles className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-indigo-950">{metrics.totalNightShifts} Shifts</p>
          <p className="mt-0.5 text-[11px] text-slate-400 font-semibold">Night differential calculated</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">NHRA Allowance Pool</span>
            <BriefcaseMedical className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-blue-950">{formatBhd(metrics.totalNhraAllowances)}</p>
          <p className="mt-0.5 text-[11px] text-slate-400 font-semibold">Active licensed pharmacists</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200/80">
        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, code, CPR..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-brand outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'Pharmacist', 'Worker', 'Management'].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat === 'ALL' ? 'All Roles' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Payroll Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Loader2 className="h-8 w-8 text-brand animate-spin mx-auto" />
            <p className="text-xs font-bold">Computing monthly compensation metrics...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-1">
            <Calculator className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No staff records found for {selectedMonth}</p>
            <p className="text-xs text-slate-400">Try adjusting your role or search filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Fixed Pay</th>
                  <th className="py-3 px-3">Duty Shifts</th>
                  <th className="py-3 px-3">Relief &amp; Night Pay</th>
                  <th className="py-3 px-3">Deductions</th>
                  <th className="py-3 px-4 text-right">Estimated Net</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map(row => (
                  <tr key={row.employeeId} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-slate-900">{row.employeeName}</div>
                      <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono bg-slate-100 px-1 rounded">{row.employeeCode}</span>
                        <span>CPR: {row.cprNumber}</span>
                        <span>•</span>
                        <span>{row.primaryBranchName}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        row.category === 'Pharmacist'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {row.category}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{formatBhd(row.totalFixed)}</div>
                      <div className="text-[10px] text-slate-400 font-semibold">
                        Basic: {row.basicSalary} | H: {row.housingAllowance}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">
                        {row.regularShiftsCount + row.nightShiftsCount} Shifts
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <span className="text-amber-700 font-semibold">Reg: {row.regularShiftsCount}</span>
                        <span>•</span>
                        <span className="text-indigo-700 font-semibold">Night: {row.nightShiftsCount}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">
                        {formatBhd(row.nightShiftPay + row.reliefShiftsPay + row.nhraAllowance + row.overtimePay + row.customAdjustment)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold">
                        {row.reliefShiftsCount > 0 && `Relief: +${row.reliefShiftsPay} | `}
                        {row.overtimePay > 0 && `OT: +${row.overtimePay} | `}
                        {row.hasNhraLicense && `NHRA: +${row.nhraAllowance}`}
                        {row.customAdjustment !== 0 && ` | Adj: ${row.customAdjustment > 0 ? '+' : ''}${row.customAdjustment}`}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-rose-700">-{formatBhd(row.totalDeductions)}</div>
                      <div className="text-[10px] text-slate-400 font-semibold">
                        GOSI: {row.gosiDeduction} {row.attendancePenalty > 0 && `| Penalties: -${row.attendancePenalty}`} {row.unpaidLeaveDays > 0 && `| Unpaid: -${row.unpaidDeduction}`}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-black text-sm border border-emerald-200">
                        {formatBhd(row.netPayable)}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {canEditRules && <button
                          type="button"
                          disabled
                          className="p-1.5 text-slate-300 cursor-not-allowed"
                          title="Adjustments require a saved proposal and approval."
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>}
                        <button
                          type="button"
                          disabled
                          className="p-1.5 text-slate-300 cursor-not-allowed"
                          title="A published payroll run is required to print a payslip"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjustment Modal */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-extrabold text-slate-950 text-sm">Monthly Compensation Adjustment</h4>
                <p className="text-xs text-slate-500 font-medium">{editingRow.employeeName} ({editingRow.employeeCode})</p>
              </div>
              <button onClick={() => setEditingRow(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Adjustment Amount in BHD (+ for Bonus, - for Penalty)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={editAdjustmentInput}
                  onChange={e => setEditAdjustmentInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Audit Notes / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Eid Extra Coverage, Spot Reward, Penalty"
                  value={editNotesInput}
                  onChange={e => setEditNotesInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAdjustment}
                className="btn-primary text-xs font-bold"
              >
                Save Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-brand" />
                <h4 className="font-extrabold text-slate-950 text-sm">Payroll &amp; Differential Rules</h4>
              </div>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Night Shift Differential (BHD / Shift)</label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.nightShiftBonusRate}
                  onChange={e => setSettings({ ...settings, nightShiftBonusRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Relief Coverage Bonus (BHD / Shift)</label>
                <input
                  type="number"
                  step="1"
                  value={settings.reliefShiftBonusRate}
                  onChange={e => setSettings({ ...settings, reliefShiftBonusRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">NHRA License Allowance (BHD / Month)</label>
                <input
                  type="number"
                  step="5"
                  value={settings.defaultNhraAllowance}
                  onChange={e => setSettings({ ...settings, defaultNhraAllowance: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">GOSI Employee Share (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.gosiPercentage}
                  onChange={e => setSettings({ ...settings, gosiPercentage: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="btn-primary text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Printable Payslip Template */}
      <div className="hidden">
        <div ref={payslipPrintRef} className="p-10 font-sans text-slate-900 bg-white max-w-[210mm] mx-auto">
          {printingRow && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-xl font-black uppercase text-slate-900">Tabarak Pharmacy Group W.L.L.</h1>
                  <p className="text-xs text-slate-500 font-bold">Official Salary Payslip • إشعار راتب شهري رسمي</p>
                  <p className="text-[10px] text-slate-400">Kingdom of Bahrain • C.R. No: 127506-01</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase text-slate-400">Pay Period</p>
                  <p className="text-lg font-black text-slate-900">{selectedMonth}</p>
                </div>
              </div>

              {/* Employee Summary Card */}
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 p-4 bg-slate-50 text-xs">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Employee Name</p>
                  <p className="font-extrabold text-sm text-slate-950">{printingRow.employeeName}</p>
                  <p className="text-slate-500 mt-1">Code: {printingRow.employeeCode} | CPR: {printingRow.cprNumber}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Designation &amp; Branch</p>
                  <p className="font-extrabold text-sm text-slate-950">{printingRow.category}</p>
                  <p className="text-slate-500 mt-1">{printingRow.primaryBranchName} | IBAN: {printingRow.iban}</p>
                </div>
              </div>

              {/* Earnings & Deductions Breakdown */}
              <div className="grid grid-cols-2 gap-6 text-xs">
                {/* Earnings */}
                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 border-b border-slate-200 pb-1 uppercase tracking-wider text-[11px]">
                    Earnings (المستحقات)
                  </h4>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Basic Contract Salary:</span>
                    <span className="font-bold">{formatBhd(printingRow.basicSalary)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Housing Allowance:</span>
                    <span className="font-bold">{formatBhd(printingRow.housingAllowance)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Transportation Allowance:</span>
                    <span className="font-bold">{formatBhd(printingRow.transportAllowance)}</span>
                  </div>
                  {printingRow.hasNhraLicense && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>NHRA License Allowance:</span>
                      <span className="font-bold">{formatBhd(printingRow.nhraAllowance)}</span>
                    </div>
                  )}
                  {printingRow.nightShiftsCount > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>Night Differential ({printingRow.nightShiftsCount} shifts):</span>
                      <span className="font-bold">{formatBhd(printingRow.nightShiftPay)}</span>
                    </div>
                  )}
                  {printingRow.reliefShiftsCount > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>Relief Coverage Bonus ({printingRow.reliefShiftsCount} shifts):</span>
                      <span className="font-bold">{formatBhd(printingRow.reliefShiftsPay)}</span>
                    </div>
                  )}
                  {printingRow.customAdjustment !== 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>Monthly Adjustment ({printingRow.customNotes || 'Approved Bonus'}):</span>
                      <span className="font-bold">{formatBhd(printingRow.customAdjustment)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 font-black text-slate-950 border-t border-slate-300">
                    <span>Total Gross Earnings:</span>
                    <span>{formatBhd(printingRow.totalGross)}</span>
                  </div>
                </div>

                {/* Deductions */}
                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 border-b border-slate-200 pb-1 uppercase tracking-wider text-[11px]">
                    Deductions (الاستقطاعات)
                  </h4>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>GOSI / Social Insurance:</span>
                    <span className="font-bold text-rose-700">{formatBhd(printingRow.gosiDeduction)}</span>
                  </div>
                  {printingRow.unpaidLeaveDays > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>Unpaid Absences ({printingRow.unpaidLeaveDays} days):</span>
                      <span className="font-bold text-rose-700">{formatBhd(printingRow.unpaidDeduction)}</span>
                    </div>
                  )}
                  {printingRow.otherDeductions > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>Other Deductions (Loan/EWA):</span>
                      <span className="font-bold text-rose-700">{formatBhd(printingRow.otherDeductions)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 font-black text-rose-800 border-t border-slate-300">
                    <span>Total Deductions:</span>
                    <span>-{formatBhd(printingRow.totalDeductions)}</span>
                  </div>
                </div>
              </div>

              {/* Net Payable Highlight Box */}
              <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase font-bold text-slate-300 tracking-wider">Net Salary Disbursed • صافي الراتب المستحق</p>
                  <p className="text-xs text-slate-400">Deposited to IBAN: {printingRow.iban}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-emerald-400">{formatBhd(printingRow.netPayable)}</p>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-10 text-xs border-t border-slate-200">
                <div>
                  <p className="text-slate-400 font-bold uppercase mb-8">HR &amp; Accounts Management</p>
                  <p className="border-t border-dashed border-slate-300 pt-1 font-bold">Authorized Signatory</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 font-bold uppercase mb-8">Employee Acknowledgement</p>
                  <p className="border-t border-dashed border-slate-300 pt-1 font-bold">Recipient Signature</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
