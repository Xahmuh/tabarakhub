import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock3, FileDown, Printer, Route, Table, Truck, AlertTriangle, Edit3, X } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { DeliveryDriver, DeliveryDriverDutyReportRow } from '../../types';
import { SearchableSelect } from './components/SearchableSelect';
import { toDateKey } from './utils';
import { exportDriverDutyToExcel, printDriverDutyReport } from './exports';
import { runAfterNextPaint } from '../../utils/uiPerformance';

interface DriverDutyReportProps {
  selfOnly?: boolean;
}

type DutyPeriodPreset = 'this-month' | 'last-month' | 'all-time' | 'custom';

const PERIOD_OPTIONS: Array<{ id: DutyPeriodPreset; label: string }> = [
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'all-time', label: 'All the time' },
  { id: 'custom', label: 'Custom time' }
];

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

const getDutyRange = (preset: DutyPeriodPreset, customFrom: string, customTo: string) => {
  const now = new Date();
  if (preset === 'this-month') return { ...monthRangeFromKey(monthKeyFromDate(now)), to: toDateKey(now) };
  if (preset === 'last-month') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return monthRangeFromKey(monthKeyFromDate(lastMonth));
  }
  if (preset === 'all-time') {
    return { from: '2020-01-01', to: toDateKey(now) };
  }
  return { from: customFrom, to: customTo };
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const formatMonthLabel = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date);
};

const dutyPeriodLabel = (preset: DutyPeriodPreset, from: string, to: string) => {
  if (preset === 'this-month') return `This month (${from} - ${to})`;
  if (preset === 'last-month') return `Last month (${from} - ${to})`;
  if (preset === 'all-time') return `All the time (${from} - ${to})`;
  return from === to ? from : `${from} - ${to}`;
};

const formatHours = (minutes: number) => {
  const safe = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

const sanitizeFileSegment = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'Driver';

const filePeriodSegment = (from: string, to: string) => {
  if (from.slice(0, 7) === to.slice(0, 7)) {
    return sanitizeFileSegment(formatMonthLabel(from));
  }
  return `${from}_to_${to}`;
};

const driverLabel = (driver?: DeliveryDriver | null, row?: DeliveryDriverDutyReportRow | null) => {
  if (driver) return driver.driverCode ? `${driver.name} ${driver.driverCode}` : driver.name;
  if (row) return row.driverCode ? `${row.driverName} ${row.driverCode}` : row.driverName;
  return 'All Drivers';
};

const toDateTimeInput = (isoStr?: string | null) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (!Number.isFinite(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const KpiCard: React.FC<{ label: string; value: string; sub?: string; icon: React.ReactNode }> = ({ label, value, sub, icon }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand/5 text-brand">{icon}</div>
    </div>
    <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 tabular-nums">{value}</p>
    {sub && <p className="mt-1 text-xs font-bold text-slate-500">{sub}</p>}
  </div>
);

export const DriverDutyReport: React.FC<DriverDutyReportProps> = ({ selfOnly = false }) => {
  const initialMonth = monthRangeFromKey(monthKeyFromDate(new Date()));
  const [preset, setPreset] = useState<DutyPeriodPreset>('this-month');
  const [customFrom, setCustomFrom] = useState(initialMonth.from);
  const [customTo, setCustomTo] = useState(initialMonth.to);
  const [driverFilter, setDriverFilter] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [rows, setRows] = useState<DeliveryDriverDutyReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isPrintingPdf, setIsPrintingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edit Modal State
  const [editingRow, setEditingRow] = useState<DeliveryDriverDutyReportRow | null>(null);
  const [editStartedAt, setEditStartedAt] = useState('');
  const [editEndedAt, setEditEndedAt] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const range = useMemo(() => getDutyRange(preset, customFrom, customTo), [customFrom, customTo, preset]);
  const label = useMemo(() => dutyPeriodLabel(preset, range.from, range.to), [preset, range.from, range.to]);
  const selectedDriver = useMemo(
    () => drivers.find(driver => driver.id === driverFilter) || null,
    [driverFilter, drivers]
  );

  useEffect(() => {
    if (selfOnly) return;
    deliveryService.drivers.list(true)
      .then(setDrivers)
      .catch(error => console.warn('Driver duty driver list failed', error));
  }, [selfOnly]);

  const loadData = () => {
    setIsLoading(true);
    setErrorMessage(null);
    deliveryService.driverDuty.list({
      driverId: selfOnly ? undefined : driverFilter || undefined,
      dateFrom: range.from,
      dateTo: range.to
    })
      .then(setRows)
      .catch(error => {
        console.error('Driver duty report failed', error);
        setRows([]);
        setErrorMessage(error?.message || 'Could not load driver duty report.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [driverFilter, range.from, range.to, selfOnly]);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.minutes += row.totalWorkingMinutes;
    acc.shifts += row.shiftCount;
    acc.assigned += row.assignedCount;
    acc.picked += row.pickedUpCount;
    acc.actual += row.actualDeliveryCount;
    acc.transfers += row.internalTransferCount;
    acc.delivered += row.deliveredCount;
    acc.cancelled += row.cancelledCount;
    if (row.isMissingPunch) acc.missingPunches += 1;
    acc.days.add(`${row.driverId}:${row.statDate}`);
    acc.drivers.add(row.driverId);
    return acc;
  }, {
    minutes: 0,
    shifts: 0,
    assigned: 0,
    picked: 0,
    actual: 0,
    transfers: 0,
    delivered: 0,
    cancelled: 0,
    missingPunches: 0,
    days: new Set<string>(),
    drivers: new Set<string>()
  }), [rows]);

  const sortedSheetRows = useMemo(() => (
    [...rows].sort((a, b) => b.statDate.localeCompare(a.statDate) || a.driverName.localeCompare(b.driverName))
  ), [rows]);

  const exportDriverLabel = useMemo(() => {
    if (selfOnly) return driverLabel(null, rows[0]);
    return driverFilter ? driverLabel(selectedDriver, rows[0]) : 'All Drivers';
  }, [driverFilter, rows, selectedDriver, selfOnly]);

  const exportFileName = useMemo(() => (
    `Driver_Attendance_${sanitizeFileSegment(exportDriverLabel)}_${filePeriodSegment(range.from, range.to)}`
  ), [exportDriverLabel, range.from, range.to]);

  const exportTitle = useMemo(() => (
    `Driver Attendance Archive - ${exportDriverLabel} - ${label}`
  ), [exportDriverLabel, label]);

  const handlePresetChange = (nextPreset: DutyPeriodPreset) => {
    setPreset(nextPreset);
    if (nextPreset === 'this-month') {
      const nextRange = monthRangeFromKey(monthKeyFromDate(new Date()));
      setCustomFrom(nextRange.from);
      setCustomTo(nextRange.to);
    }
    if (nextPreset === 'last-month') {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const nextRange = monthRangeFromKey(monthKeyFromDate(lastMonth));
      setCustomFrom(nextRange.from);
      setCustomTo(nextRange.to);
    }
    if (nextPreset === 'all-time') {
      const now = new Date();
      setCustomFrom('2020-01-01');
      setCustomTo(toDateKey(now));
    }
  };

  const handleMonthArchiveChange = (monthKey: string) => {
    if (!monthKey) return;
    const nextRange = monthRangeFromKey(monthKey);
    setPreset('custom');
    setCustomFrom(nextRange.from);
    setCustomTo(nextRange.to);
  };

  const handleExcelExport = async () => {
    if (rows.length === 0) {
      setErrorMessage('No driver duty activity is available to export for this period.');
      return;
    }
    setIsExportingExcel(true);
    setErrorMessage(null);
    try {
      await runAfterNextPaint(() => exportDriverDutyToExcel(rows, exportTitle, exportFileName));
    } catch (error: any) {
      console.error('Driver duty Excel export failed', error);
      setErrorMessage(error?.message || 'Could not export driver duty Excel file.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handlePdfPrint = async () => {
    if (rows.length === 0) {
      setErrorMessage('No driver duty activity is available to print for this period.');
      return;
    }
    setIsPrintingPdf(true);
    setErrorMessage(null);
    try {
      await runAfterNextPaint(() => printDriverDutyReport(rows, exportTitle, exportFileName));
    } catch (error: any) {
      console.error('Driver duty PDF print failed', error);
      setErrorMessage(error?.message || 'Could not open driver duty PDF report.');
    } finally {
      setTimeout(() => setIsPrintingPdf(false), 500);
    }
  };

  const openEditModal = (row: DeliveryDriverDutyReportRow) => {
    setEditingRow(row);
    setEditStartedAt(toDateTimeInput(row.firstOnlineAt));
    setEditEndedAt(toDateTimeInput(row.lastOfflineAt));
    setEditNotes(row.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingRow) return;
    setIsSavingEdit(true);
    setErrorMessage(null);
    try {
      await deliveryService.driverDuty.updateShift({
        driverId: editingRow.driverId,
        statDate: editingRow.statDate,
        firstOnlineAt: editStartedAt ? new Date(editStartedAt).toISOString() : null,
        lastOfflineAt: editEndedAt ? new Date(editEndedAt).toISOString() : null,
        notes: editNotes
      });
      setEditingRow(null);
      loadData();
    } catch (error: any) {
      console.error('Driver shift edit failed', error);
      setErrorMessage(error?.message || 'Failed to save driver attendance shift update.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="operational-panel p-4 print:hidden">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Attendance archive</p>
              <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Driver attendance</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-slate-200/70 bg-slate-100/70 p-1">
                {PERIOD_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handlePresetChange(option.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-black transition-all ${
                      preset === option.id ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Month</span>
                <input
                  type="month"
                  value={range.from.slice(0, 7)}
                  onChange={event => handleMonthArchiveChange(event.target.value)}
                  className="bg-transparent text-xs font-black text-slate-900 outline-none"
                />
              </label>
              {preset === 'custom' && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={event => setCustomFrom(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-brand/40"
                  />
                  <span className="text-xs font-black text-slate-300">to</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={event => setCustomTo(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-brand/40"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {!selfOnly && (
              <div className="min-w-[240px]">
                <SearchableSelect
                  options={drivers.map(driver => ({
                    value: driver.id,
                    label: driver.driverCode ? `${driver.driverCode} - ${driver.name}` : driver.name,
                    hint: driver.isActive ? 'Active' : 'Inactive'
                  }))}
                  value={driverFilter}
                  onChange={setDriverFilter}
                  placeholder="All drivers"
                />
              </div>
            )}
            <button
              onClick={handleExcelExport}
              disabled={isLoading || isExportingExcel || rows.length === 0}
              className="btn-secondary text-[10px] uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileDown className="h-3.5 w-3.5" /> {isExportingExcel ? 'Exporting' : 'Excel'}
            </button>
            <button
              onClick={handlePdfPrint}
              disabled={isLoading || isPrintingPdf || rows.length === 0}
              className="btn-secondary text-[10px] uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-7">
        <KpiCard label="Duty days" value={String(totals.days.size)} sub={label} icon={<CalendarClock className="h-4 w-4" />} />
        <KpiCard label="Drivers" value={String(totals.drivers.size)} sub={selfOnly ? 'my report' : 'with activity'} icon={<Truck className="h-4 w-4" />} />
        <KpiCard label="Duty sessions" value={String(totals.shifts)} sub="in / out logs" icon={<CalendarClock className="h-4 w-4" />} />
        <KpiCard label="Work hours" value={formatHours(totals.minutes)} icon={<Clock3 className="h-4 w-4" />} />
        <KpiCard label="Actual delivery" value={String(totals.actual)} sub="completed" icon={<Route className="h-4 w-4" />} />
        <KpiCard label="Missing punches" value={String(totals.missingPunches)} sub="auto-closed" icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} />
        <KpiCard label="Closed orders" value={String(totals.delivered + totals.cancelled)} sub={`${totals.cancelled} cancelled`} icon={<Truck className="h-4 w-4" />} />
      </div>

      <section className="operational-panel overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Attendance log sheet</p>
            <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">{formatMonthLabel(range.from)}</h3>
          </div>
          <p className="text-xs font-bold text-slate-500">{exportDriverLabel} - {range.from} to {range.to}</p>
        </div>

        {isLoading ? (
          <div className="flex h-44 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand"></div>
          </div>
        ) : sortedSheetRows.length === 0 ? (
          <p className="p-10 text-center text-xs font-bold text-slate-400">No driver duty activity in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Driver Code</th>
                  <th className="px-3 py-3">Driver Name</th>
                  <th className="px-3 py-3">Started Duty</th>
                  <th className="px-3 py-3">Start Branch</th>
                  <th className="px-3 py-3">Finished Duty</th>
                  <th className="px-3 py-3">Last Branch</th>
                  <th className="px-3 py-3 text-right">Working Hours</th>
                  <th className="px-3 py-3 text-right">Working Minutes</th>
                  <th className="px-3 py-3 text-right">Assigned</th>
                  <th className="px-3 py-3 text-right">Picked Up</th>
                  <th className="px-3 py-3 text-right">Actual Delivery</th>
                  <th className="px-3 py-3 text-right">Internal Transfer</th>
                  <th className="px-3 py-3 text-right">Delivered</th>
                  <th className="px-3 py-3 text-right">Cancelled</th>
                  <th className="px-3 py-3">Notes</th>
                  {!selfOnly && <th className="px-3 py-3 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {sortedSheetRows.map(row => (
                  <tr key={`${row.driverId}:${row.statDate}`} className={`transition-colors ${row.isMissingPunch ? 'bg-amber-50/70 hover:bg-amber-100/60' : 'hover:bg-slate-50/80'}`}>
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-900">{row.statDate}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-slate-500">{row.driverCode || '-'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-950">{row.driverName}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{formatDateTime(row.firstOnlineAt)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{row.startedBranchName || '-'}</td>
                    <td className={`whitespace-nowrap px-3 py-2.5 font-semibold ${row.isMissingPunch ? 'text-amber-800 font-bold' : 'text-slate-600'}`}>
                      {formatDateTime(row.lastOfflineAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">{row.startedBranchName || '-'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-black text-brand tabular-nums">{formatHours(row.totalWorkingMinutes)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-600">{row.totalWorkingMinutes}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700">{row.assignedCount}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700">{row.pickedUpCount}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-brand tabular-nums">{row.actualDeliveryCount}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700">{row.internalTransferCount}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-emerald-700 tabular-nums">{row.deliveredCount}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-red-600 tabular-nums">{row.cancelledCount}</td>
                    <td className="px-3 py-2.5 min-w-[200px]">
                      {row.isMissingPunch ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-300">
                          <AlertTriangle className="h-3 w-3 shrink-0 text-amber-700" />
                          {row.notes || '⚠️ Missing Clock-out (Auto-closed)'}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">{row.notes || '-'}</span>
                      )}
                    </td>
                    {!selfOnly && (
                      <td className="whitespace-nowrap px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 shadow-sm transition-all hover:border-brand/40 hover:text-brand"
                          title="Edit attendance timestamps"
                        >
                          <Edit3 className="h-3 w-3" /> Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-black text-slate-950">
                  <td className="px-3 py-3">TOTAL</td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3">{totals.drivers.size} drivers</td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3 text-right text-brand tabular-nums">{formatHours(totals.minutes)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{totals.minutes}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{totals.assigned}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{totals.picked}</td>
                  <td className="px-3 py-3 text-right text-brand tabular-nums">{totals.actual}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{totals.transfers}</td>
                  <td className="px-3 py-3 text-right text-emerald-700 tabular-nums">{totals.delivered}</td>
                  <td className="px-3 py-3 text-right text-red-600 tabular-nums">{totals.cancelled}</td>
                  <td className="px-3 py-3"></td>
                  {!selfOnly && <td className="px-3 py-3"></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Admin Edit Attendance Shift Modal */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand">Admin Correction</p>
                <h3 className="text-base font-black text-slate-950">
                  Edit Attendance: {editingRow.driverName} ({editingRow.statDate})
                </h3>
              </div>
              <button
                onClick={() => setEditingRow(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">Started Duty Time (Start Punch)</label>
                <input
                  type="datetime-local"
                  value={editStartedAt}
                  onChange={e => setEditStartedAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Finished Duty Time (End Punch / Missing Clock-out Correction)</label>
                <input
                  type="datetime-local"
                  value={editEndedAt}
                  onChange={e => setEditEndedAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-brand"
                />
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  Provide the actual clock-out timestamp to resolve missing punch flags.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Correction Notes / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Corrected by HR - Verified shift checkout"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-900 outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="btn-primary text-xs font-bold disabled:opacity-50"
              >
                {isSavingEdit ? 'Saving...' : 'Save Attendance Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
