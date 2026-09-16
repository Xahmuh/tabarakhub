import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, Calculator, CalendarClock, Download, Edit2, FileText, Filter, Layers, Printer, RefreshCw, Settings, ShieldCheck, Sparkles, Truck, UserCheck, Wallet, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { DeliveryDriver, DeliveryDriverDutyReportRow } from '../../types';
import { SearchableSelect } from './components/SearchableSelect';
import { toDateKey } from './utils';
import { runAfterNextPaint } from '../../utils/uiPerformance';

interface DriverPayrollHubProps {
  selfOnly?: boolean;
}

export interface PayrollSettings {
  defaultBaseSalary: number; // e.g. 300.000 BHD
  commissionPerOrder: number; // e.g. 0.400 BHD per actual delivery
  targetOrdersThreshold: number; // e.g. 250 orders
  targetBonusAmount: number; // e.g. 40.000 BHD
  missingPunchPenalty: number; // e.g. 5.000 BHD per missing punch
}

export interface DriverPayrollRow {
  driverId: string;
  driverCode: string;
  driverName: string;
  dutyDays: number;
  totalWorkingMinutes: number;
  actualDeliveries: number;
  internalTransfers: number;
  missingPunchesCount: number;
  baseSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  commissionRate: number;
  commissionTotal: number;
  targetBonus: number;
  missingPunchPenaltyTotal: number;
  customAdjustment: number;
  customNotes: string;
  netPayable: number;
}

const DEFAULT_SETTINGS: PayrollSettings = {
  defaultBaseSalary: 300.0,
  commissionPerOrder: 0.4,
  targetOrdersThreshold: 250,
  targetBonusAmount: 40.0,
  missingPunchPenalty: 5.0
};

const monthKeyFromDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const monthRangeFromKey = (monthKey: string) => {
  const [yearRaw, monthRaw] = monthKey.split('-').map(Number);
  const fallback = new Date();
  const year = Number.isFinite(yearRaw) ? yearRaw : fallback.getFullYear();
  const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12
    ? monthRaw
    : fallback.getMonth() + 1;
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  return { from: toDateKey(first), to: toDateKey(last) };
};

const formatBhd = (amount: number) => {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${safe.toFixed(3)} BHD`;
};

const formatHours = (minutes: number) => {
  const safe = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

const formatMonthLabel = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date);
};

export const DriverPayrollHub: React.FC<DriverPayrollHubProps> = ({ selfOnly = false }) => {
  const initialMonth = monthKeyFromDate(new Date());
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [driverFilter, setDriverFilter] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [dutyRows, setDutyRows] = useState<DeliveryDriverDutyReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Settings State
  const [settings, setSettings] = useState<PayrollSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Custom adjustments per driver id
  const [driverOverrides, setDriverOverrides] = useState<Record<string, {
    customBase?: number;
    housingAllowance?: number;
    transportAllowance?: number;
    customCommissionRate?: number;
    customAdjustment?: number;
    customNotes?: string;
  }>>({});
  const [editingDriverRow, setEditingDriverRow] = useState<DriverPayrollRow | null>(null);

  // Active Payslip Modal State
  const [activePayslip, setActivePayslip] = useState<DriverPayrollRow | null>(null);

  const range = useMemo(() => monthRangeFromKey(selectedMonth), [selectedMonth]);

  useEffect(() => {
    if (selfOnly) return;
    deliveryService.drivers.list(true)
      .then(setDrivers)
      .catch(err => console.warn('Failed to load drivers for payroll', err));
  }, [selfOnly]);

  const loadAttendanceData = () => {
    setIsLoading(true);
    setErrorMessage(null);
    deliveryService.driverDuty.list({
      driverId: selfOnly ? undefined : driverFilter || undefined,
      dateFrom: range.from,
      dateTo: range.to
    })
      .then(setDutyRows)
      .catch(err => {
        console.error('Payroll attendance load failed', err);
        setDutyRows([]);
        setErrorMessage(err?.message || 'Failed to load attendance logs for payroll calculation.');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadAttendanceData();
  }, [selectedMonth, driverFilter, selfOnly]);

  // Aggregate Duty Rows into Driver Payroll Rows
  const payrollRows: DriverPayrollRow[] = useMemo(() => {
    const map = new Map<string, {
      driverId: string;
      driverCode: string;
      driverName: string;
      dutyDays: Set<string>;
      totalWorkingMinutes: number;
      actualDeliveries: number;
      internalTransfers: number;
      missingPunchesCount: number;
    }>();

    dutyRows.forEach(row => {
      const existing = map.get(row.driverId) || {
        driverId: row.driverId,
        driverCode: row.driverCode || '',
        driverName: row.driverName,
        dutyDays: new Set<string>(),
        totalWorkingMinutes: 0,
        actualDeliveries: 0,
        internalTransfers: 0,
        missingPunchesCount: 0
      };

      if (!existing.driverCode && row.driverCode) existing.driverCode = row.driverCode;
      existing.dutyDays.add(row.statDate);
      existing.totalWorkingMinutes += row.totalWorkingMinutes;
      existing.actualDeliveries += row.actualDeliveryCount;
      existing.internalTransfers += row.internalTransferCount;
      if (row.isMissingPunch) existing.missingPunchesCount += 1;

      map.set(row.driverId, existing);
    });

    return [...map.values()].map(item => {
      const override = driverOverrides[item.driverId] || {};
      const baseSalary = override.customBase !== undefined ? override.customBase : settings.defaultBaseSalary;
      const housingAllowance = override.housingAllowance || 0;
      const transportAllowance = override.transportAllowance || 0;
      const commissionRate = override.customCommissionRate !== undefined ? override.customCommissionRate : settings.commissionPerOrder;
      const commissionTotal = item.actualDeliveries * commissionRate;
      const targetBonus = item.actualDeliveries >= settings.targetOrdersThreshold ? settings.targetBonusAmount : 0;
      const missingPunchPenaltyTotal = item.missingPunchesCount * settings.missingPunchPenalty;
      const customAdjustment = override.customAdjustment || 0;
      const customNotes = override.customNotes || '';

      const netPayable = Math.max(0, baseSalary + housingAllowance + transportAllowance + commissionTotal + targetBonus + customAdjustment - missingPunchPenaltyTotal);

      return {
        driverId: item.driverId,
        driverCode: item.driverCode,
        driverName: item.driverName,
        dutyDays: item.dutyDays.size,
        totalWorkingMinutes: item.totalWorkingMinutes,
        actualDeliveries: item.actualDeliveries,
        internalTransfers: item.internalTransfers,
        missingPunchesCount: item.missingPunchesCount,
        baseSalary,
        housingAllowance,
        transportAllowance,
        commissionRate,
        commissionTotal,
        targetBonus,
        missingPunchPenaltyTotal,
        customAdjustment,
        customNotes,
        netPayable
      };
    }).sort((a, b) => a.driverName.localeCompare(b.driverName));
  }, [dutyRows, driverOverrides, settings]);

  // Overall Payroll Totals
  const totals = useMemo(() => payrollRows.reduce((acc, row) => {
    acc.drivers += 1;
    acc.baseSalaries += row.baseSalary;
    acc.commissions += row.commissionTotal;
    acc.bonuses += row.targetBonus;
    acc.penalties += row.missingPunchPenaltyTotal;
    acc.adjustments += row.customAdjustment;
    acc.netPayable += row.netPayable;
    acc.deliveries += row.actualDeliveries;
    return acc;
  }, {
    drivers: 0,
    baseSalaries: 0,
    commissions: 0,
    bonuses: 0,
    penalties: 0,
    adjustments: 0,
    netPayable: 0,
    deliveries: 0
  }), [payrollRows]);

  const handleSaveDriverOverride = (
    driverId: string,
    customBase: number,
    housingAllowance: number,
    transportAllowance: number,
    customCommissionRate: number,
    customAdjustment: number,
    customNotes: string
  ) => {
    setDriverOverrides(prev => ({
      ...prev,
      [driverId]: {
        customBase,
        housingAllowance,
        transportAllowance,
        customCommissionRate,
        customAdjustment,
        customNotes
      }
    }));
    setEditingDriverRow(null);
  };

  const handlePrintPayslip = (row: DriverPayrollRow) => {
    setActivePayslip(row);
    runAfterNextPaint(() => {
      window.print();
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls Panel */}
      <section className="operational-panel p-4 print:hidden">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand/10 text-brand">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Payroll Management</p>
                <h3 className="text-lg font-black tracking-tight text-slate-950">Driver Payroll &amp; Incentives</h3>
              </div>
            </div>
            <p className="text-xs font-medium text-slate-500">
              Calculate monthly driver salaries, delivery commissions, performance bonuses, and missing punch deductions.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Payroll Month</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-900 outline-none cursor-pointer"
                />
              </label>

              {!selfOnly && (
                <div className="min-w-[220px]">
                  <SearchableSelect
                    options={drivers.map(d => ({
                      value: d.id,
                      label: d.driverCode ? `${d.driverCode} - ${d.name}` : d.name,
                      hint: d.isActive ? 'Active' : 'Inactive'
                    }))}
                    value={driverFilter}
                    onChange={setDriverFilter}
                    placeholder="All Drivers"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!selfOnly && (
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="btn-secondary text-[11px] uppercase tracking-wider font-bold"
              >
                <Settings className="h-3.5 w-3.5" /> Commission &amp; Rules
              </button>
            )}
            <button
              type="button"
              onClick={loadAttendanceData}
              disabled={isLoading}
              className="btn-secondary text-[11px] uppercase tracking-wider font-bold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Recalculate
            </button>
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 flex items-center gap-2 print:hidden">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          {errorMessage}
        </div>
      )}

      {/* KPI Cards Section */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 print:hidden">
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Net Payroll</p>
            <Banknote className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-emerald-400 tabular-nums">{formatBhd(totals.netPayable)}</p>
          <p className="mt-1 text-[11px] font-bold text-slate-400">{totals.drivers} driver{totals.drivers === 1 ? '' : 's'} calculated</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Base Salaries</p>
            <Banknote className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 tabular-nums">{formatBhd(totals.baseSalaries)}</p>
          <p className="mt-1 text-[11px] font-bold text-slate-500">Fixed basic pay</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Commissions &amp; Bonus</p>
            <Sparkles className="h-4 w-4 text-brand" />
          </div>
          <p className="mt-2 text-2xl font-black text-brand tabular-nums">{formatBhd(totals.commissions + totals.bonuses)}</p>
          <p className="mt-1 text-[11px] font-bold text-slate-500">{totals.deliveries} actual deliveries</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Deductions</p>
            <Calculator className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-600 tabular-nums">{formatBhd(totals.penalties)}</p>
          <p className="mt-1 text-[11px] font-bold text-slate-500">Missing punches / fines</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Adjustments</p>
            <Edit2 className="h-4 w-4 text-purple-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-purple-600 tabular-nums">{formatBhd(totals.adjustments)}</p>
          <p className="mt-1 text-[11px] font-bold text-slate-500">Manual loans / allowances</p>
        </div>
      </div>

      {/* Main Payroll Table */}
      <section className="operational-panel overflow-hidden print:hidden">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Monthly Payroll Statement</p>
            <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">{formatMonthLabel(range.from)}</h3>
          </div>
          <p className="text-xs font-bold text-slate-500">Default Rate: {formatBhd(settings.commissionPerOrder)} / delivery</p>
        </div>

        {isLoading ? (
          <div className="flex h-44 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand"></div>
          </div>
        ) : payrollRows.length === 0 ? (
          <p className="p-10 text-center text-xs font-bold text-slate-400">No driver activity recorded for this payroll month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3">Driver Code</th>
                  <th className="px-3 py-3">Driver Name</th>
                  <th className="px-3 py-3 text-center">Duty Days</th>
                  <th className="px-3 py-3 text-right">Duty Hours</th>
                  <th className="px-3 py-3 text-right">Deliveries</th>
                  <th className="px-3 py-3 text-right">Base Salary</th>
                  <th className="px-3 py-3 text-right">Commission</th>
                  <th className="px-3 py-3 text-right">Target Bonus</th>
                  <th className="px-3 py-3 text-right">Deductions</th>
                  <th className="px-3 py-3 text-right">Adjustment</th>
                  <th className="px-3 py-3 text-right font-black text-slate-900">Net Payable</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {payrollRows.map(row => (
                  <tr key={row.driverId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="whitespace-nowrap px-3 py-3 font-mono font-bold text-slate-500">{row.driverCode || '-'}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-950">{row.driverName}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-center tabular-nums font-bold text-slate-700">{row.dutyDays} days</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-600">{formatHours(row.totalWorkingMinutes)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums font-black text-brand">{row.actualDeliveries}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">{formatBhd(row.baseSalary)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums font-bold text-brand">{formatBhd(row.commissionTotal)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-emerald-700 font-bold">{formatBhd(row.targetBonus)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-amber-700 font-bold">
                      {row.missingPunchPenaltyTotal > 0 ? `-${formatBhd(row.missingPunchPenaltyTotal)}` : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-purple-700 font-bold">
                      {row.customAdjustment !== 0 ? (row.customAdjustment > 0 ? `+${formatBhd(row.customAdjustment)}` : formatBhd(row.customAdjustment)) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-black tabular-nums text-slate-950 text-sm">
                      <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-800 border border-emerald-200">
                        {formatBhd(row.netPayable)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {!selfOnly && (
                          <button
                            type="button"
                            onClick={() => setEditingDriverRow(row)}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 shadow-sm transition-all hover:border-brand/40 hover:text-brand"
                            title="Adjust base salary or add loan/bonus"
                          >
                            <Edit2 className="h-3 w-3" /> Adjust
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handlePrintPayslip(row)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:text-slate-950"
                          title="Generate printable payslip"
                        >
                          <FileText className="h-3 w-3" /> Payslip
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-black text-slate-950">
                  <td className="px-3 py-3">TOTAL</td>
                  <td className="px-3 py-3">{totals.drivers} drivers</td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3 text-right text-brand tabular-nums">{totals.deliveries}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatBhd(totals.baseSalaries)}</td>
                  <td className="px-3 py-3 text-right text-brand tabular-nums">{formatBhd(totals.commissions)}</td>
                  <td className="px-3 py-3 text-right text-emerald-700 tabular-nums">{formatBhd(totals.bonuses)}</td>
                  <td className="px-3 py-3 text-right text-amber-700 tabular-nums">-{formatBhd(totals.penalties)}</td>
                  <td className="px-3 py-3 text-right text-purple-700 tabular-nums">{formatBhd(totals.adjustments)}</td>
                  <td className="px-3 py-3 text-right font-black text-emerald-800 text-sm tabular-nums">{formatBhd(totals.netPayable)}</td>
                  <td className="px-3 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Global Rules Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-brand" />
                <h3 className="text-base font-black text-slate-950">Payroll Rates &amp; Incentive Rules</h3>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">Default Base Salary (BHD)</label>
                <input
                  type="number"
                  step="0.001"
                  value={settings.defaultBaseSalary}
                  onChange={e => setSettings({ ...settings, defaultBaseSalary: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Per-Delivery Order Commission (BHD)</label>
                <input
                  type="number"
                  step="0.050"
                  value={settings.commissionPerOrder}
                  onChange={e => setSettings({ ...settings, commissionPerOrder: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 mb-1">Target Threshold (Orders)</label>
                  <input
                    type="number"
                    value={settings.targetOrdersThreshold}
                    onChange={e => setSettings({ ...settings, targetOrdersThreshold: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1">Target Bonus (BHD)</label>
                  <input
                    type="number"
                    step="1.000"
                    value={settings.targetBonusAmount}
                    onChange={e => setSettings({ ...settings, targetBonusAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Missing Punch Fine / Penalty (BHD per occurrence)</label>
                <input
                  type="number"
                  step="0.500"
                  value={settings.missingPunchPenalty}
                  onChange={e => setSettings({ ...settings, missingPunchPenalty: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="btn-primary text-xs font-bold"
              >
                Apply Rules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Specific Adjustment Modal */}
      {editingDriverRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-brand">Manual Adjustment</p>
                <h3 className="text-base font-black text-slate-950">
                  {editingDriverRow.driverName} ({editingDriverRow.driverCode || 'No Code'})
                </h3>
              </div>
              <button onClick={() => setEditingDriverRow(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                const form = e.currentTarget;
                const baseVal = parseFloat((form.elements.namedItem('customBase') as HTMLInputElement).value) || 0;
                const housingVal = parseFloat((form.elements.namedItem('housingAllowance') as HTMLInputElement).value) || 0;
                const transportVal = parseFloat((form.elements.namedItem('transportAllowance') as HTMLInputElement).value) || 0;
                const commRateVal = parseFloat((form.elements.namedItem('customCommissionRate') as HTMLInputElement).value) || 0;
                const adjVal = parseFloat((form.elements.namedItem('customAdjustment') as HTMLInputElement).value) || 0;
                const notesVal = (form.elements.namedItem('customNotes') as HTMLInputElement).value;
                handleSaveDriverOverride(editingDriverRow.driverId, baseVal, housingVal, transportVal, commRateVal, adjVal, notesVal);
              }}
              className="space-y-4 text-xs font-bold"
            >
              <div>
                <label className="block text-slate-700 mb-1">Driver Basic Base Salary (BHD)</label>
                <input
                  name="customBase"
                  type="number"
                  step="0.001"
                  defaultValue={editingDriverRow.baseSalary}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 mb-1">Housing Allowance (BHD)</label>
                  <input
                    name="housingAllowance"
                    type="number"
                    step="0.100"
                    defaultValue={editingDriverRow.housingAllowance}
                    placeholder="0.000"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1">Transport Allowance (BHD)</label>
                  <input
                    name="transportAllowance"
                    type="number"
                    step="0.100"
                    defaultValue={editingDriverRow.transportAllowance}
                    placeholder="0.000"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Custom Order Commission Rate (BHD / Order)</label>
                <input
                  name="customCommissionRate"
                  type="number"
                  step="0.050"
                  defaultValue={editingDriverRow.commissionRate}
                  placeholder="0.400"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Other Adjustment (+ Bonus / - Loan Advance in BHD)</label>
                <input
                  name="customAdjustment"
                  type="number"
                  step="0.100"
                  defaultValue={editingDriverRow.customAdjustment}
                  placeholder="e.g. -20.000 for loan repayment or 15.000 for bonus"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Adjustment Reason / Notes</label>
                <input
                  name="customNotes"
                  type="text"
                  defaultValue={editingDriverRow.customNotes}
                  placeholder="e.g. Individual contract terms"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium outline-none focus:border-brand"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingDriverRow(null)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs font-bold">
                  Save Compensation Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Payslip Card (Visible on Print or Preview Modal) */}
      {activePayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md print:static print:bg-white print:p-0">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl space-y-6 print:border-none print:shadow-none print:p-0">
            {/* Payslip Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-brand">Tabarak Hub Operations</p>
                <h2 className="text-2xl font-black text-slate-950 mt-1">DRIVER PAYSLIP</h2>
                <p className="text-xs font-bold text-slate-500 mt-0.5">Pay Period: {formatMonthLabel(range.from)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-slate-900">{activePayslip.driverName}</p>
                <p className="text-xs font-mono text-slate-500">Code: {activePayslip.driverCode || 'N/A'}</p>
                <p className="text-[11px] font-bold text-emerald-700 mt-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                  Status: Approved
                </p>
              </div>
            </div>

            {/* Attendance & Delivery Metrics */}
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs font-bold">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Duty Days</span>
                <span className="text-sm font-black text-slate-900">{activePayslip.dutyDays} days</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Work Hours</span>
                <span className="text-sm font-black text-slate-900">{formatHours(activePayslip.totalWorkingMinutes)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Actual Deliveries</span>
                <span className="text-sm font-black text-brand">{activePayslip.actualDeliveries} orders</span>
              </div>
            </div>

            {/* Statement Table */}
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Salary Breakdown</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 text-[10px] font-black uppercase text-slate-600">
                    <th className="py-2 px-3 text-left">Description</th>
                    <th className="py-2 px-3 text-center">Qty / Rate</th>
                    <th className="py-2 px-3 text-right">Amount (BHD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-slate-950">Basic Base Salary</td>
                    <td className="py-2.5 px-3 text-center text-slate-500">Fixed Monthly</td>
                    <td className="py-2.5 px-3 text-right font-bold tabular-nums text-slate-900">{formatBhd(activePayslip.baseSalary)}</td>
                  </tr>
                  {activePayslip.housingAllowance > 0 && (
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-slate-900">Housing Allowance</td>
                      <td className="py-2.5 px-3 text-center text-slate-500">Monthly Fixed</td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums text-slate-900">+{formatBhd(activePayslip.housingAllowance)}</td>
                    </tr>
                  )}
                  {activePayslip.transportAllowance > 0 && (
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-slate-900">Transport / Fuel Allowance</td>
                      <td className="py-2.5 px-3 text-center text-slate-500">Monthly Fixed</td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums text-slate-900">+{formatBhd(activePayslip.transportAllowance)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-slate-950">Delivery Orders Commission</td>
                    <td className="py-2.5 px-3 text-center text-slate-500">{activePayslip.actualDeliveries} × {formatBhd(activePayslip.commissionRate)}</td>
                    <td className="py-2.5 px-3 text-right font-bold tabular-nums text-brand">{formatBhd(activePayslip.commissionTotal)}</td>
                  </tr>
                  {activePayslip.targetBonus > 0 && (
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-emerald-800">Monthly Target Achievement Bonus</td>
                      <td className="py-2.5 px-3 text-center text-emerald-700">Target Exceeded</td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums text-emerald-700">+{formatBhd(activePayslip.targetBonus)}</td>
                    </tr>
                  )}
                  {activePayslip.missingPunchPenaltyTotal > 0 && (
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-amber-800">Missing Punch Penalties</td>
                      <td className="py-2.5 px-3 text-center text-amber-700">{activePayslip.missingPunchesCount} occurrence(s)</td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums text-amber-700">-{formatBhd(activePayslip.missingPunchPenaltyTotal)}</td>
                    </tr>
                  )}
                  {activePayslip.customAdjustment !== 0 && (
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-purple-900">
                        Adjustment / Loan Advance {activePayslip.customNotes ? `(${activePayslip.customNotes})` : ''}
                      </td>
                      <td className="py-2.5 px-3 text-center text-purple-700">Manual Entry</td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums text-purple-700">
                        {activePayslip.customAdjustment > 0 ? `+${formatBhd(activePayslip.customAdjustment)}` : formatBhd(activePayslip.customAdjustment)}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-900 bg-slate-900 text-white font-black">
                    <td colSpan={2} className="py-3 px-4 text-sm">NET PAYABLE AMOUNT</td>
                    <td className="py-3 px-4 text-right text-lg text-emerald-400 tabular-nums">{formatBhd(activePayslip.netPayable)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Signature Area */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-xs font-bold text-slate-600">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Driver Signature</p>
                <div className="mt-8 border-b border-dashed border-slate-300 w-48"></div>
                <p className="mt-1 text-[11px] font-medium text-slate-400">Date: ____ / ____ / 2026</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">HR / Finance Approval</p>
                <div className="mt-8 border-b border-dashed border-slate-300 w-48 ml-auto"></div>
                <p className="mt-1 text-[11px] font-medium text-slate-400">Approved &amp; Disbursed</p>
              </div>
            </div>

            {/* Modal Action Buttons (Hidden when printing) */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 print:hidden">
              <button
                type="button"
                onClick={() => setActivePayslip(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary text-xs font-bold"
              >
                <Printer className="h-3.5 w-3.5" /> Print Official Payslip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
