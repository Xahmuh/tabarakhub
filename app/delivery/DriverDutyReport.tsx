import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, CalendarClock, Clock3, FileDown, MapPin, Printer, Route, Truck } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { DeliveryDriver, DeliveryDriverDutyReportRow } from '../../types';
import { SearchableSelect } from './components/SearchableSelect';
import { toDateKey } from './utils';
import { exportDriverDutyToExcel, printDriverDutyReport } from './exports';
import { runAfterNextPaint } from '../../utils/uiPerformance';

interface DriverDutyReportProps {
  selfOnly?: boolean;
}

type DutyPeriodPreset = 'this-month' | 'last-month' | 'custom';

const PERIOD_OPTIONS: Array<{ id: DutyPeriodPreset; label: string }> = [
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
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

const formatDateStripLabel = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
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
  return from === to ? from : `${from} - ${to}`;
};

const formatHours = (minutes: number) => {
  const safe = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

const formatCoordinate = (value?: number | null) =>
  value === null || value === undefined || !Number.isFinite(value) ? '-' : value.toFixed(6);

const formatDistance = (value?: number | null) =>
  value === null || value === undefined || !Number.isFinite(value) ? '-' : `${Math.round(value)} m`;

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

const StripMetric: React.FC<{ label: string; value: React.ReactNode; tone?: 'brand' | 'slate' | 'green' | 'red' }> = ({ label, value, tone = 'slate' }) => {
  const toneClass = tone === 'brand'
    ? 'text-brand'
    : tone === 'green'
      ? 'text-emerald-700'
      : tone === 'red'
        ? 'text-red-700'
        : 'text-slate-900';

  return (
    <div className="min-w-[72px]">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-black tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
};

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

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    deliveryService.driverDuty.list({
      driverId: selfOnly ? undefined : driverFilter || undefined,
      dateFrom: range.from,
      dateTo: range.to
    })
      .then(data => {
        if (!cancelled) setRows(data);
      })
      .catch(error => {
        console.error('Driver duty report failed', error);
        if (!cancelled) {
          setRows([]);
          setErrorMessage(error?.message || 'Could not load driver duty report.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [driverFilter, range.from, range.to, selfOnly]);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.minutes += row.totalWorkingMinutes;
    acc.shifts += row.shiftCount;
    acc.actual += row.actualDeliveryCount;
    acc.transfers += row.internalTransferCount;
    acc.delivered += row.deliveredCount;
    acc.cancelled += row.cancelledCount;
    acc.days.add(`${row.driverId}:${row.statDate}`);
    acc.drivers.add(row.driverId);
    return acc;
  }, {
    minutes: 0,
    shifts: 0,
    actual: 0,
    transfers: 0,
    delivered: 0,
    cancelled: 0,
    days: new Set<string>(),
    drivers: new Set<string>()
  }), [rows]);

  const dateGroups = useMemo(() => {
    const map = new Map<string, {
      date: string;
      rows: DeliveryDriverDutyReportRow[];
      drivers: Set<string>;
      minutes: number;
      shifts: number;
      assigned: number;
      pickedUp: number;
      actual: number;
      internal: number;
      delivered: number;
      cancelled: number;
    }>();

    rows.forEach(row => {
      const group = map.get(row.statDate) || {
        date: row.statDate,
        rows: [],
        drivers: new Set<string>(),
        minutes: 0,
        shifts: 0,
        assigned: 0,
        pickedUp: 0,
        actual: 0,
        internal: 0,
        delivered: 0,
        cancelled: 0
      };
      group.rows.push(row);
      group.rows.sort((a, b) => a.driverName.localeCompare(b.driverName));
      group.drivers.add(row.driverId);
      group.minutes += row.totalWorkingMinutes;
      group.shifts += row.shiftCount;
      group.assigned += row.assignedCount;
      group.pickedUp += row.pickedUpCount;
      group.actual += row.actualDeliveryCount;
      group.internal += row.internalTransferCount;
      group.delivered += row.deliveredCount;
      group.cancelled += row.cancelledCount;
      map.set(row.statDate, group);
    });

    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [rows]);

  const exportDriverLabel = useMemo(() => {
    if (selfOnly) return driverLabel(null, rows[0]);
    return driverFilter ? driverLabel(selectedDriver, rows[0]) : 'All Drivers';
  }, [driverFilter, rows, selectedDriver, selfOnly]);

  const exportFileName = useMemo(() => (
    `Driver_Duty_${sanitizeFileSegment(exportDriverLabel)}_${filePeriodSegment(range.from, range.to)}`
  ), [exportDriverLabel, range.from, range.to]);

  const exportTitle = useMemo(() => (
    `Driver Duty Archive - ${exportDriverLabel} - ${label}`
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

  return (
    <div className="space-y-5">
      <section className="operational-panel p-4 print:hidden">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Duty archive</p>
              <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Driver monthly attendance</h3>
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
              <div className="min-w-[260px]">
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
        <KpiCard label="Internal transfer" value={String(totals.transfers)} sub="completed" icon={<ArrowRightLeft className="h-4 w-4" />} />
        <KpiCard label="Closed orders" value={String(totals.delivered + totals.cancelled)} sub={`${totals.cancelled} cancelled`} icon={<Truck className="h-4 w-4" />} />
      </div>

      <section className="operational-panel overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Monthly archive</p>
            <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">{formatMonthLabel(range.from)}</h3>
          </div>
          <p className="text-xs font-bold text-slate-500">{exportDriverLabel} - {range.from} to {range.to}</p>
        </div>

        {isLoading ? (
          <div className="flex h-44 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand"></div>
          </div>
        ) : dateGroups.length === 0 ? (
          <p className="p-10 text-center text-xs font-bold text-slate-400">No driver duty activity in this period.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {dateGroups.map(group => (
              <div key={group.date} className="bg-white">
                <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(180px,1.2fr)_2.8fr] lg:items-center lg:px-5">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{group.date}</p>
                    <h4 className="mt-1 truncate text-base font-black tracking-tight text-slate-950">{formatDateStripLabel(group.date)}</h4>
                    <p className="mt-1 text-xs font-bold text-slate-500">{group.drivers.size} driver{group.drivers.size === 1 ? '' : 's'} on duty</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-8">
                    <StripMetric label="Sessions" value={group.shifts} tone="brand" />
                    <StripMetric label="Hours" value={formatHours(group.minutes)} />
                    <StripMetric label="Assigned" value={group.assigned} />
                    <StripMetric label="Picked" value={group.pickedUp} />
                    <StripMetric label="Actual" value={group.actual} tone="brand" />
                    <StripMetric label="Internal" value={group.internal} />
                    <StripMetric label="Delivered" value={group.delivered} tone="green" />
                    <StripMetric label="Cancelled" value={group.cancelled} tone="red" />
                  </div>
                </div>

                <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 lg:px-5">
                  <div className="grid gap-2">
                    {group.rows.map(row => (
                      <div
                        key={`${row.driverId}:${row.statDate}`}
                        className="grid gap-3 border-l-2 border-brand/20 bg-white px-3 py-3 text-xs shadow-[0_1px_0_rgba(15,23,42,0.04)] lg:grid-cols-[minmax(170px,1.1fr)_minmax(220px,1.2fr)_minmax(220px,1.5fr)_minmax(220px,1.3fr)] lg:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950">
                            {row.driverCode ? `${row.driverCode} - ` : ''}{row.driverName}
                          </p>
                          <p className="mt-0.5 font-bold text-slate-400">{row.shiftCount} session{row.shiftCount === 1 ? '' : 's'} - {formatHours(row.totalWorkingMinutes)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <StripMetric label="Started" value={formatDateTime(row.firstOnlineAt)} />
                          <StripMetric label="Finished" value={formatDateTime(row.lastOfflineAt)} />
                        </div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate font-black text-slate-700">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" />
                            {row.startedBranchName || '-'}
                          </p>
                          <p className="mt-1 font-bold tabular-nums text-slate-400">
                            {formatCoordinate(row.startedLat)}, {formatCoordinate(row.startedLng)} - {formatDistance(row.startedDistanceM)}
                          </p>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <StripMetric label="Assigned" value={row.assignedCount} />
                          <StripMetric label="Picked" value={row.pickedUpCount} />
                          <StripMetric label="Actual" value={row.actualDeliveryCount} tone="brand" />
                          <StripMetric label="Closed" value={row.deliveredCount + row.cancelledCount} tone={row.cancelledCount ? 'red' : 'green'} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
