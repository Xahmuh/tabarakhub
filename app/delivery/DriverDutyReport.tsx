import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, CalendarClock, Clock3, Printer, Route, Truck } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { DeliveryDriver, DeliveryDriverDutyReportRow } from '../../types';
import { PeriodFilter } from './components/PeriodFilter';
import { SearchableSelect } from './components/SearchableSelect';
import { PeriodPreset, getPresetRange, periodLabel, todayKey } from './utils';
import { printReport } from './exports';

interface DriverDutyReportProps {
  selfOnly?: boolean;
}

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
  const [preset, setPreset] = useState<PeriodPreset>('today');
  const [customFrom, setCustomFrom] = useState(todayKey());
  const [customTo, setCustomTo] = useState(todayKey());
  const [driverFilter, setDriverFilter] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [rows, setRows] = useState<DeliveryDriverDutyReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const range = getPresetRange(preset, customFrom, customTo);
  const label = periodLabel(preset, range.from, range.to);

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

  const handlePeriodChange = (nextPreset: PeriodPreset, from?: string, to?: string) => {
    setPreset(nextPreset);
    if (from !== undefined) setCustomFrom(from);
    if (to !== undefined) setCustomTo(to);
  };

  return (
    <div className="space-y-5">
      <section className="operational-panel p-4 print:hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <PeriodFilter
            preset={preset}
            customFrom={customFrom}
            customTo={customTo}
            onChange={handlePeriodChange}
          />
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
            <button onClick={printReport} className="btn-secondary text-[10px] uppercase tracking-widest">
              <Printer className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>
      </section>

      <div className="hidden print:block">
        <h1 className="text-xl font-black">Driver Duty Report - {label}</h1>
      </div>

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
        <div className="border-b border-slate-100 p-4 md:p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Duty log</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Daily driver activity</h3>
          <p className="mt-1 text-xs font-bold text-slate-500">
            Start and finish times come from the driver mobile start/stop duty buttons.
          </p>
        </div>

        {isLoading ? (
          <div className="flex h-44 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand"></div>
          </div>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-xs font-bold text-slate-400">No driver duty activity in this period.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-4 py-3">Date</th>
                    {!selfOnly && <th className="px-4 py-3">Driver</th>}
                    <th className="px-4 py-3">Started duty</th>
                    <th className="px-4 py-3">Finished duty</th>
                    <th className="px-4 py-3">Sessions</th>
                    <th className="px-4 py-3">Hours</th>
                    <th className="px-4 py-3">Start branch</th>
                    <th className="px-4 py-3">Start location</th>
                    <th className="px-4 py-3">Branch distance</th>
                    <th className="px-4 py-3">Assigned</th>
                    <th className="px-4 py-3">Picked up</th>
                    <th className="px-4 py-3">Actual</th>
                    <th className="px-4 py-3">Internal</th>
                    <th className="px-4 py-3">Delivered</th>
                    <th className="px-4 py-3">Cancelled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map(row => (
                    <tr key={`${row.driverId}:${row.statDate}`} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-xs font-black text-slate-900">{row.statDate}</td>
                      {!selfOnly && (
                        <td className="px-4 py-3 text-xs font-bold text-slate-600">
                          {row.driverCode ? `${row.driverCode} - ` : ''}{row.driverName}
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs font-bold text-slate-500">{formatDateTime(row.firstOnlineAt)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-500">{formatDateTime(row.lastOfflineAt)}</td>
                      <td className="px-4 py-3 text-xs font-black tabular-nums text-slate-700">{row.shiftCount}</td>
                      <td className="px-4 py-3 text-xs font-black tabular-nums text-slate-900">{formatHours(row.totalWorkingMinutes)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-600">{row.startedBranchName || '-'}</td>
                      <td className="px-4 py-3 text-xs font-bold tabular-nums text-slate-500">
                        {formatCoordinate(row.startedLat)}, {formatCoordinate(row.startedLng)}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold tabular-nums text-slate-500">{formatDistance(row.startedDistanceM)}</td>
                      <td className="px-4 py-3 text-xs font-black tabular-nums text-slate-700">{row.assignedCount}</td>
                      <td className="px-4 py-3 text-xs font-black tabular-nums text-slate-700">{row.pickedUpCount}</td>
                      <td className="px-4 py-3 text-xs font-black tabular-nums text-slate-700">{row.actualDeliveryCount}</td>
                      <td className="px-4 py-3 text-xs font-black tabular-nums text-slate-700">{row.internalTransferCount}</td>
                      <td className="px-4 py-3 text-xs font-black tabular-nums text-emerald-700">{row.deliveredCount}</td>
                      <td className="px-4 py-3 text-xs font-black tabular-nums text-red-700">{row.cancelledCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 md:hidden">
              {rows.map(row => (
                <div key={`${row.driverId}:${row.statDate}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">{row.statDate}</p>
                      {!selfOnly && <p className="mt-1 text-xs font-bold text-slate-500">{row.driverCode ? `${row.driverCode} - ` : ''}{row.driverName}</p>}
                    </div>
                    <span className="rounded-full bg-brand/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                      {formatHours(row.totalWorkingMinutes)}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <p className="font-bold text-slate-500">Started <span className="block font-black text-slate-900">{formatDateTime(row.firstOnlineAt)}</span></p>
                    <p className="font-bold text-slate-500">Finished <span className="block font-black text-slate-900">{formatDateTime(row.lastOfflineAt)}</span></p>
                    <p className="font-bold text-slate-500">Sessions <span className="block font-black text-slate-900">{row.shiftCount}</span></p>
                    <p className="font-bold text-slate-500">Start branch <span className="block font-black text-slate-900">{row.startedBranchName || '-'}</span></p>
                    <p className="font-bold text-slate-500">Start location <span className="block font-black text-slate-900">{formatCoordinate(row.startedLat)}, {formatCoordinate(row.startedLng)}</span></p>
                    <p className="font-bold text-slate-500">Distance <span className="block font-black text-slate-900">{formatDistance(row.startedDistanceM)}</span></p>
                    <p className="font-bold text-slate-500">Assigned <span className="block font-black text-slate-900">{row.assignedCount}</span></p>
                    <p className="font-bold text-slate-500">Picked up <span className="block font-black text-slate-900">{row.pickedUpCount}</span></p>
                    <p className="font-bold text-slate-500">Actual <span className="block font-black text-slate-900">{row.actualDeliveryCount}</span></p>
                    <p className="font-bold text-slate-500">Internal <span className="block font-black text-slate-900">{row.internalTransferCount}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
