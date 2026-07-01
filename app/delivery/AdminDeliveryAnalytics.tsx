import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, ChevronRight, FileDown, Globe2, Package, Printer, Store, Wallet } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { branchService } from '../../services/branchService';
import { pharmacistService } from '../../services/pharmacistService';
import {
  Branch, DeliveryDriver, DeliveryOrder, DeliveryPaymentTypeConfig, Governorate, Pharmacist
} from '../../types';
import { PeriodFilter } from './components/PeriodFilter';
import { SearchableSelect } from './components/SearchableSelect';
import { PeriodPreset, formatBhd, getPresetRange, isDirectOrder, periodLabel, sumValue, todayKey } from './utils';
import { exportBreakdownToExcel, printReport } from './exports';
import { isModuleEnabled } from '../../config/clientConfig';
import {
  buildDeliveryOrderCleanExportParity,
  deliveryCleanExportService,
  exportDeliveryOrderCleanRowsToExcel
} from '../../services/deliveryCleanExportService';
import { runAfterNextPaint } from '../../utils/uiPerformance';
import { truncateBhd } from '../../utils/money';

const GOVERNORATES: Governorate[] = ['Capital', 'Muharraq', 'Northern', 'Southern'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface LeaderRow { key: string; name: string; orders: number; value: number }
interface TransferRouteRow { key: string; from: string; to: string; orders: number }

const buildLeaderboard = (orders: DeliveryOrder[], keyFn: (o: DeliveryOrder) => string | null, nameFn: (o: DeliveryOrder) => string): LeaderRow[] => {
  const map = new Map<string, LeaderRow>();
  for (const order of orders) {
    const key = keyFn(order);
    if (!key) continue;
    const row = map.get(key) || { key, name: nameFn(order), orders: 0, value: 0 };
    row.orders += 1;
    row.value += order.valueBhd;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
};

const Leaderboard: React.FC<{ title: string; rows: LeaderRow[]; emptyLabel: string }> = ({ title, rows, emptyLabel }) => {
  const maxValue = rows[0]?.value || 1;
  return (
    <section className="operational-panel p-4 md:p-5">
      <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-700">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs font-bold text-slate-400">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 12).map((row, index) => (
            <div key={row.key} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-right text-[11px] font-black text-slate-400">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold text-slate-700">{row.name}</span>
                  <span className="shrink-0 text-[11px] font-black text-slate-900 tabular-nums">
                    {row.orders} · {formatBhd(row.value)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand/70" style={{ width: `${Math.max(4, (row.value / maxValue) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const KpiCard: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
    <p className="mt-2 text-xl font-black tracking-tight text-slate-950 tabular-nums">{value}</p>
    {sub && <p className="mt-1 text-[11px] font-bold text-slate-500">{sub}</p>}
  </div>
);

export const AdminDeliveryAnalytics: React.FC = () => {
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [customFrom, setCustomFrom] = useState(todayKey());
  const [customTo, setCustomTo] = useState(todayKey());

  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [governorateFilter, setGovernorateFilter] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<string | null>(null);
  const [driverFilter, setDriverFilter] = useState<string | null>(null);
  const [pharmacistFilter, setPharmacistFilter] = useState<string | null>(null);

  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<DeliveryPaymentTypeConfig[]>([]);
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingCleanOrders, setIsExportingCleanOrders] = useState(false);
  const [exportErrorMessage, setExportErrorMessage] = useState<string | null>(null);
  const [drilldownGov, setDrilldownGov] = useState<Governorate | null>(null);

  const range = getPresetRange(preset, customFrom, customTo);
  const label = periodLabel(preset, range.from, range.to);

  useEffect(() => {
    Promise.all([
      branchService.list(),
      deliveryService.drivers.list(true),
      deliveryService.paymentTypes.list(true),
      pharmacistService.listAll()
    ]).then(([b, d, pay, p]) => {
      setBranches(b.filter(x => x.role === 'branch'));
      setDrivers(d);
      setPaymentTypes(pay);
      setPharmacists(p as Pharmacist[]);
    }).catch(e => console.error('Analytics reference load failed', e));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    deliveryService.orders.list({
      branchId: branchFilter || undefined,
      dateFrom: range.from,
      dateTo: range.to,
      paymentType: paymentFilter || undefined,
      driverId: driverFilter || undefined,
      pharmacistId: pharmacistFilter || undefined,
      governorate: governorateFilter || undefined
    }).then(data => {
      if (cancelled) return;
      const branchNames = new Map(branches.map(branch => [branch.id, branch.name]));
      setOrders(data.map(order => ({
        ...order,
        branchName: order.branchName || branchNames.get(order.branchId) || 'Unknown branch'
      })));
    })
      .catch(e => { console.error('Analytics load failed', e); if (!cancelled) setOrders([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [range.from, range.to, branchFilter, paymentFilter, driverFilter, pharmacistFilter, governorateFilter, branches]);

  const filteredOrders = orders;

  const direct = useMemo(() => filteredOrders.filter(order => isDirectOrder(order, paymentTypes)), [filteredOrders, paymentTypes]);
  const external = useMemo(
    () => filteredOrders.filter(order => order.orderKind !== 'internal_transfer' && !isDirectOrder(order, paymentTypes)),
    [filteredOrders, paymentTypes]
  );
  const internalTransfers = useMemo(
    () => filteredOrders.filter(order => order.orderKind === 'internal_transfer'),
    [filteredOrders]
  );
  const actualDeliveries = useMemo(
    () => filteredOrders.filter(order => order.orderKind !== 'internal_transfer'),
    [filteredOrders]
  );
  const totalValue = sumValue(filteredOrders);
  const avgValue = filteredOrders.length ? totalValue / filteredOrders.length : 0;

  const pharmacistBoard = useMemo(
    () => buildLeaderboard(filteredOrders, o => o.pharmacistId || (o.pharmacistName ? `name:${o.pharmacistName}` : null), o => o.pharmacistName || 'Unknown'),
    [filteredOrders]
  );
  const driverBoard = useMemo(
    () => buildLeaderboard(filteredOrders, o => o.driverId, o => (
      o.driverCode && o.driverName ? `${o.driverCode} - ${o.driverName}` : o.driverName || 'Unknown'
    )),
    [filteredOrders]
  );
  const branchBoard = useMemo(
    () => buildLeaderboard(filteredOrders, o => o.branchId, o => o.branchName || 'Unknown branch'),
    [filteredOrders]
  );
  const transferRoutes = useMemo(() => {
    const map = new Map<string, TransferRouteRow>();
    for (const order of internalTransfers) {
      const from = order.transferFromBranchName || order.branchName || 'Unknown source';
      const to = order.transferToBranchName || 'Unknown destination';
      const key = `${order.transferFromBranchId || from}->${order.transferToBranchId || to}`;
      const row = map.get(key) || { key, from, to, orders: 0 };
      row.orders += 1;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.orders - a.orders || a.from.localeCompare(b.from));
  }, [internalTransfers]);

  // Geography — WhatsApp/direct orders only.
  const govBoard = useMemo(
    () => buildLeaderboard(direct, o => o.governorate || null, o => o.governorate || 'Unknown'),
    [direct]
  );
  const areaBoard = useMemo(
    () => buildLeaderboard(direct, o => (o.areaName ? `${o.governorate}|${o.areaName}` : null), o => o.areaName || 'Unknown'),
    [direct]
  );
  const blockBoard = useMemo(
    () => buildLeaderboard(direct, o => o.blockNumber, o => `Block ${o.blockNumber}${o.areaName ? ` (${o.areaName})` : ''}`),
    [direct]
  );

  const drilldown = useMemo(() => {
    if (!drilldownGov) return null;
    const govOrders = direct.filter(o => o.governorate === drilldownGov);
    return {
      areas: buildLeaderboard(govOrders, o => o.areaName || null, o => o.areaName || 'Unknown'),
      blocks: buildLeaderboard(govOrders, o => o.blockNumber, o => `Block ${o.blockNumber}${o.areaName ? ` (${o.areaName})` : ''}`),
      total: govOrders.length,
      value: sumValue(govOrders)
    };
  }, [drilldownGov, direct]);

  // Driver workload heatmap: driver × weekday order counts.
  const heatmap = useMemo(() => {
    const counts = new Map<string, number[]>();
    for (const order of filteredOrders) {
      if (!order.driverId) continue;
      const name = order.driverCode && order.driverName ? `${order.driverCode} - ${order.driverName}` : order.driverName || 'Unknown';
      const weekday = new Date(`${order.orderDate}T00:00:00`).getDay();
      const row = counts.get(name) || [0, 0, 0, 0, 0, 0, 0];
      row[weekday] += 1;
      counts.set(name, row);
    }
    const rows = [...counts.entries()].map(([name, days]) => ({ name, days, total: days.reduce((a, b) => a + b, 0) }));
    rows.sort((a, b) => b.total - a.total);
    const max = Math.max(1, ...rows.flatMap(r => r.days));
    return { rows: rows.slice(0, 12), max };
  }, [filteredOrders]);

  // Outside-governorate analysis by branch.
  const outsideByBranch = useMemo(() => {
    const map = new Map<string, { name: string; total: number; outside: number }>();
    for (const order of direct) {
      const row = map.get(order.branchId) || { name: order.branchName || 'Unknown', total: 0, outside: 0 };
      row.total += 1;
      if (order.isOutsideGovernorate) row.outside += 1;
      map.set(order.branchId, row);
    }
    return [...map.values()]
      .map(r => ({ ...r, pct: r.total ? (r.outside / r.total) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct);
  }, [direct]);

  const handlePeriodChange = (p: PeriodPreset, from?: string, to?: string) => {
    setPreset(p);
    if (from !== undefined) setCustomFrom(from);
    if (to !== undefined) setCustomTo(to);
  };

  const downloadDrilldown = () => {
    if (!drilldownGov || !drilldown) return;
    runAfterNextPaint(() => exportBreakdownToExcel(
      [
        ...drilldown.areas.map(a => ({ level: 'Area', name: a.name, orders: a.orders, value: truncateBhd(a.value) })),
        ...drilldown.blocks.map(b => ({ level: 'Block', name: b.name, orders: b.orders, value: truncateBhd(b.value) }))
      ],
      [
        { key: 'level', label: 'Level' },
        { key: 'name', label: 'Name' },
        { key: 'orders', label: 'Orders' },
        { key: 'value', label: 'Value (BHD)', numFmt: '0.000' }
      ],
      `${drilldownGov} governorate breakdown — ${label}`,
      `Delivery_${drilldownGov}_breakdown_${range.from}_${range.to}`
    )).catch(e => console.error(e));
  };

  const downloadOrders = async () => {
    setExportErrorMessage(null);
    setIsExportingCleanOrders(true);
    try {
      const cleanRows = await deliveryCleanExportService.orders.list({
        branchId: branchFilter || undefined,
        dateFrom: range.from,
        dateTo: range.to,
        paymentType: paymentFilter || undefined,
        driverId: driverFilter || undefined,
        pharmacistId: pharmacistFilter || undefined,
        governorate: governorateFilter || undefined
      });
      const parity = buildDeliveryOrderCleanExportParity(filteredOrders, cleanRows);
      if (!parity.matches) {
        throw new Error(`Clean export parity failed: ${parity.differences.join('; ')}`);
      }
      await runAfterNextPaint(() => exportDeliveryOrderCleanRowsToExcel(
        cleanRows,
        `Delivery Orders - Clean Export - ${label}`,
        `Delivery_Clean_All_${range.from}_${range.to}`,
        parity
      ));
    } catch (error: any) {
      console.error('Clean delivery order export failed', error);
      setExportErrorMessage(error?.message || 'Could not export clean delivery orders.');
    } finally {
      setIsExportingCleanOrders(false);
    }
  };

  const handlePrint = () => {
    runAfterNextPaint(printReport).catch(error => console.error(error));
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <section className="operational-panel p-4 print:hidden">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <PeriodFilter preset={preset} customFrom={customFrom} customTo={customTo} onChange={handlePeriodChange} />
          <div className="flex items-center gap-2">
            {isModuleEnabled('excelExport') && (
              <button
                onClick={downloadOrders}
                disabled={isLoading || isExportingCleanOrders}
                className="btn-secondary text-[10px] uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileDown className="h-3.5 w-3.5" /> {isExportingCleanOrders ? 'Exporting' : 'Excel'}
              </button>
            )}
            <button onClick={handlePrint} className="btn-secondary text-[10px] uppercase tracking-widest">
              <Printer className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <SearchableSelect options={branches.map(b => ({ value: b.id, label: b.name, hint: b.code }))} value={branchFilter} onChange={setBranchFilter} placeholder="All branches" />
          <SearchableSelect options={GOVERNORATES.map(g => ({ value: g, label: g }))} value={governorateFilter} onChange={setGovernorateFilter} placeholder="All governorates" />
          <SearchableSelect options={paymentTypes.map(type => ({ value: type.code, label: type.label }))} value={paymentFilter} onChange={setPaymentFilter} placeholder="All payments" />
          <SearchableSelect
            options={drivers.map(d => ({
              value: d.id,
              label: d.driverCode ? `${d.driverCode} - ${d.name}` : d.name,
              hint: d.driverCode
            }))}
            value={driverFilter}
            onChange={setDriverFilter}
            placeholder="All drivers"
          />
          <SearchableSelect options={pharmacists.map(p => ({ value: p.id, label: p.name }))} value={pharmacistFilter} onChange={setPharmacistFilter} placeholder="All pharmacists" />
        </div>
        {exportErrorMessage && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
            {exportErrorMessage}
          </div>
        )}
      </section>

      <div className="hidden print:block">
        <h1 className="text-xl font-black">Delivery Analytics — {label}</h1>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand"></div>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <KpiCard label="Total orders" value={String(filteredOrders.length)} sub={label} />
            <KpiCard label="Total value" value={formatBhd(totalValue)} />
            <KpiCard label="Actual delivery" value={String(actualDeliveries.length)} sub={formatBhd(sumValue(actualDeliveries))} />
            <KpiCard label="Internal transfer" value={String(internalTransfers.length)} sub={`${transferRoutes.length} routes`} />
            <KpiCard label="WhatsApp / Direct" value={String(direct.length)} sub={formatBhd(sumValue(direct))} />
            <KpiCard label="External / no-block" value={String(external.length)} sub={formatBhd(sumValue(external))} />
            <KpiCard label="Avg order value" value={formatBhd(avgValue)} />
            <KpiCard label="Active branches" value={String(branchBoard.length)} sub="with orders in period" />
          </div>

          {/* Branch + people leaderboards */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Leaderboard title="Orders per branch" rows={branchBoard} emptyLabel="No branch activity." />
            <Leaderboard title="Pharmacist performance" rows={pharmacistBoard} emptyLabel="No pharmacist-linked orders." />
            <Leaderboard title="Driver performance" rows={driverBoard} emptyLabel="No driver-linked orders." />
          </div>

          <section className="operational-panel p-4 md:p-5">
            <div className="mb-4 flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-brand" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Internal transfer routes</h3>
            </div>
            {transferRoutes.length === 0 ? (
              <p className="py-6 text-center text-xs font-bold text-slate-400">No internal transfer orders in this period.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {transferRoutes.slice(0, 12).map(route => (
                  <div key={route.key} className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-black text-slate-900">{route.from}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">to</p>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <p className="truncate text-xs font-bold text-slate-700">{route.to}</p>
                      <span className="rounded-full bg-brand/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                        {route.orders} orders
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Geography — direct orders only */}
          <section className="operational-panel p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-brand" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Geography — WhatsApp / direct only</h3>
              </div>
              {drilldownGov && (
                <div className="flex items-center gap-2">
                  {isModuleEnabled('excelExport') && (
                    <button onClick={downloadDrilldown} className="btn-secondary text-[10px] uppercase tracking-widest">
                      <FileDown className="h-3.5 w-3.5" /> Download breakdown
                    </button>
                  )}
                  <button onClick={() => setDrilldownGov(null)} className="btn-neutral text-[10px] uppercase tracking-widest">
                    Back to overview
                  </button>
                </div>
              )}
            </div>

            {!drilldownGov ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">By governorate (click to drill in)</p>
                  <div className="space-y-1.5">
                    {govBoard.length === 0 && <p className="py-4 text-center text-xs font-bold text-slate-400">No geographic data.</p>}
                    {govBoard.map(g => (
                      <button
                        key={g.key}
                        onClick={() => setDrilldownGov(g.name as Governorate)}
                        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-brand/40 hover:bg-brand/5"
                      >
                        <span className="text-sm font-black text-slate-800">{g.name}</span>
                        <span className="flex items-center gap-2 text-xs font-bold text-slate-500">
                          {g.orders} orders · {formatBhd(g.value)}
                          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Top areas</p>
                  <div className="space-y-1.5">
                    {areaBoard.slice(0, 8).map(a => (
                      <div key={a.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold">
                        <span className="truncate text-slate-700">{a.name}</span>
                        <span className="shrink-0 text-slate-500 tabular-nums">{a.orders} · {formatBhd(a.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Top blocks</p>
                  <div className="space-y-1.5">
                    {blockBoard.slice(0, 8).map(b => (
                      <div key={b.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold">
                        <span className="truncate text-slate-700">{b.name}</span>
                        <span className="shrink-0 text-slate-500 tabular-nums">{b.orders} · {formatBhd(b.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : drilldown && (
              <div>
                <p className="mb-3 text-sm font-bold text-slate-600">
                  <span className="font-black text-slate-900">{drilldownGov}</span> — {drilldown.total} direct orders · {formatBhd(drilldown.value)}
                </p>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Areas (highest first)</p>
                    <div className="space-y-1.5">
                      {drilldown.areas.map(a => (
                        <div key={a.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold">
                          <span className="truncate text-slate-700">{a.name}</span>
                          <span className="shrink-0 text-slate-500 tabular-nums">{a.orders} · {formatBhd(a.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Blocks (highest first)</p>
                    <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                      {drilldown.blocks.map(b => (
                        <div key={b.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold">
                          <span className="truncate text-slate-700">{b.name}</span>
                          <span className="shrink-0 text-slate-500 tabular-nums">{b.orders} · {formatBhd(b.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Driver workload heatmap + outside-governorate */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="operational-panel p-4 md:p-5">
              <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-700">Driver workload by weekday</h3>
              {heatmap.rows.length === 0 ? (
                <p className="py-6 text-center text-xs font-bold text-slate-400">No driver-linked orders.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <th className="py-1.5 pr-2 text-left">Driver</th>
                        {WEEKDAYS.map(d => <th key={d} className="px-1 py-1.5 text-center">{d}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmap.rows.map(row => (
                        <tr key={row.name}>
                          <td className="py-1 pr-2 font-bold text-slate-700">{row.name}</td>
                          {row.days.map((count, i) => (
                            <td key={i} className="p-0.5">
                              <div
                                className="flex h-7 items-center justify-center rounded font-black tabular-nums"
                                style={{
                                  backgroundColor: count === 0 ? '#f8fafc' : `rgba(var(--client-primary-rgb, 185 28 28) / ${0.1 + 0.6 * (count / heatmap.max)})`,
                                  color: count / heatmap.max > 0.55 ? 'white' : '#475569'
                                }}
                              >
                                {count || ''}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="operational-panel p-4 md:p-5">
              <div className="mb-3 flex items-center gap-2">
                <Store className="h-4 w-4 text-brand" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Outside-governorate share</h3>
              </div>
              <p className="mb-3 text-[11px] font-medium text-slate-500">
                Optimum: each pharmacy mostly serves its own governorate to reduce petrol and driver time. High shares signal route or coverage issues.
              </p>
              {outsideByBranch.length === 0 ? (
                <p className="py-6 text-center text-xs font-bold text-slate-400">No direct orders with geography.</p>
              ) : (
                <div className="space-y-1.5">
                  {outsideByBranch.map(row => (
                    <div key={row.name} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 truncate text-xs font-bold text-slate-700">{row.name}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${row.pct > 40 ? 'bg-red-400' : row.pct > 20 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${Math.min(100, row.pct)}%` }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-[11px] font-black tabular-nums text-slate-600">
                        {row.pct.toFixed(0)}% ({row.outside}/{row.total})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
};
