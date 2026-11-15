import React, { useEffect, useId, useMemo, useState } from 'react';
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
  exportDeliveryOrderCleanRowsToExcel,
  type DeliveryCleanExportFilters,
  type DeliveryDashboardExportSection
} from '../../services/deliveryCleanExportService';
import { runAfterNextPaint } from '../../utils/uiPerformance';
import { truncateBhd } from '../../utils/money';
import { groupDeliveryReportOrders, registeredSourceSummary, summarizeDeliveryReportOrders } from '../../lib/deliveryRecording';

const GOVERNORATES: Governorate[] = ['Capital', 'Muharraq', 'Northern', 'Southern'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHOW_RECORDED_EXTERNAL_DRIVER = (import.meta as any).env?.VITE_DELIVERY_RECORDING_V1 === '1';
const KPI_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'sources', label: 'Order Sources' },
  { id: 'operations', label: 'Operations' }
] as const;
type KpiTab = (typeof KPI_TABS)[number]['id'];

interface LeaderRow { key: string; name: string; orders: number; value: number }
interface TransferRouteRow { key: string; from: string; to: string; orders: number }
interface KpiMetric { label: string; value: number; currency?: boolean; detail?: string; detailValueBhd?: number }

const leaderExportSection = (tab: DeliveryDashboardExportSection['tab'], name: string, heading: string, rows: LeaderRow[]): DeliveryDashboardExportSection => ({
  tab, name,
  headers: [heading, 'Orders', 'Value (BHD)'],
  rows: rows.map(row => [row.name, row.orders, truncateBhd(row.value)]),
  formats: { 3: '0.000' }
});
const PAGE_SIZE = 10;

function PagedRows<T>({ rows, label, children }: {
  rows: T[];
  label: string;
  children: (page: T[], offset: number) => React.ReactNode;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(rows.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const offset = currentPage * PAGE_SIZE;
  return <>
    {children(rows.slice(offset, offset + PAGE_SIZE), offset)}
    {pageCount > 1 && (
      <nav aria-label={`${label} pagination`} className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs print:hidden">
        <span aria-live="polite" className="font-semibold text-slate-600">
          {offset + 1}–{Math.min(offset + PAGE_SIZE, rows.length)} of {rows.length}
        </span>
        <div className="flex gap-1">
          <button type="button" aria-label={`Previous page of ${label}`} onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0} className="btn-neutral min-h-9 px-2 disabled:opacity-40">Previous</button>
          <button type="button" aria-label={`Next page of ${label}`} onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount - 1} className="btn-neutral min-h-9 px-2 disabled:opacity-40">Next</button>
        </div>
      </nav>
    )}
  </>;
}

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
        <PagedRows<LeaderRow> rows={rows} label={title}>{(page, offset) => <div className="space-y-2">
          {page.map((row, index) => (
            <div key={row.key} className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-right text-[11px] font-black text-slate-400">{offset + index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                  <span className="min-w-0 break-words text-xs font-bold text-slate-700">{row.name}</span>
                  <span className="text-[11px] font-black text-slate-900 tabular-nums">
                    {row.orders} · {formatBhd(row.value)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand/70" style={{ width: `${Math.max(4, (row.value / maxValue) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>}</PagedRows>
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
  const kpiId = useId();
  const [activeKpiTab, setActiveKpiTab] = useState<KpiTab>('overview');
  const [preset, setPreset] = useState<PeriodPreset>('today');
  const [customFrom, setCustomFrom] = useState(todayKey());
  const [customTo, setCustomTo] = useState(todayKey());

  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [governorateFilter, setGovernorateFilter] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<string | null>(null);
  const [driverFilter, setDriverFilter] = useState<string | null>(null);
  const [recordedDriverFilter, setRecordedDriverFilter] = useState<string | null>(null);
  const [pharmacistFilter, setPharmacistFilter] = useState<string | null>(null);

  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<DeliveryPaymentTypeConfig[]>([]);
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedFilters, setLoadedFilters] = useState<DeliveryCleanExportFilters | null>(null);
  const [isExportingCleanOrders, setIsExportingCleanOrders] = useState(false);
  const [exportErrorMessage, setExportErrorMessage] = useState<string | null>(null);
  const [drilldownGov, setDrilldownGov] = useState<Governorate | null>(null);

  const range = getPresetRange(preset, customFrom, customTo);
  const label = periodLabel(preset, range.from, range.to);
  const filters = useMemo(() => ({
    branchId: branchFilter || undefined,
    dateFrom: range.from,
    dateTo: range.to,
    paymentType: paymentFilter || undefined,
    driverId: driverFilter || undefined,
    recordedDriverId: recordedDriverFilter || undefined,
    pharmacistId: pharmacistFilter || undefined,
    governorate: governorateFilter || undefined
  }), [range.from, range.to, branchFilter, paymentFilter, driverFilter, recordedDriverFilter, pharmacistFilter, governorateFilter]);

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
    deliveryService.orders.list(filters).then(data => {
      if (cancelled) return;
      setOrders(data);
      setLoadedFilters(filters);
    })
      .catch(e => { console.error('Analytics load failed', e); if (!cancelled) setOrders([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [filters]);

  const filteredOrders = useMemo(() => {
    const branchNames = new Map(branches.map(branch => [branch.id, branch.name]));
    return orders.map(order => ({
      ...order,
      branchName: order.branchName || branchNames.get(order.branchId) || 'Unknown branch'
    }));
  }, [orders, branches]);

  const direct = useMemo(() => filteredOrders.filter(order => isDirectOrder(order, paymentTypes)), [filteredOrders, paymentTypes]);
  const external = useMemo(
    () => filteredOrders.filter(order => order.orderKind !== 'internal_transfer' && !isDirectOrder(order, paymentTypes)),
    [filteredOrders, paymentTypes]
  );
  const { total: actualDeliveries, tabarak: tabarakDeliveries, talabat: talabatDeliveries, transfers: internalTransfers } =
    useMemo(() => groupDeliveryReportOrders(filteredOrders), [filteredOrders]);
  const totalDelivery = summarizeDeliveryReportOrders(actualDeliveries);
  const tabarakDelivery = summarizeDeliveryReportOrders(tabarakDeliveries);
  const talabatDelivery = summarizeDeliveryReportOrders(talabatDeliveries);
  const totalValue = sumValue(filteredOrders);
  const avgValue = filteredOrders.length ? totalValue / filteredOrders.length : 0;
  const sourceGroups = useMemo(() => registeredSourceSummary(filteredOrders), [filteredOrders]);
  const sourceGroup = (source: 'WhatsApp' | 'Online' | 'Talabat') => sourceGroups[source] || { count: 0, fils: 0 };

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
  const recordedDriverBoard = useMemo(
    () => buildLeaderboard(filteredOrders, o => o.recordedDriverId || null, o =>
      o.recordedDriverCode && o.recordedDriverName ? `${o.recordedDriverCode} - ${o.recordedDriverName}` : o.recordedDriverName || 'Unknown recorded driver'),
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

  // Geography follows payment classification; source is filtered independently.
  const govBoard = useMemo(
    () => buildLeaderboard(direct, o => o.governorate || null, o => o.governorate || 'Unknown'),
    [direct]
  );
  const areaBoard = useMemo(
    () => buildLeaderboard(direct, o => (o.areaName ? `${o.governorate}|${o.areaName}` : null), o => [o.areaName, o.governorate].filter(Boolean).join(' · ')),
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
    const counts = new Map<string, { name: string; days: number[] }>();
    for (const order of filteredOrders) {
      if (!order.driverId) continue;
      const name = order.driverCode && order.driverName ? `${order.driverCode} - ${order.driverName}` : order.driverName || 'Unknown';
      const weekday = new Date(`${order.orderDate}T00:00:00`).getDay();
      if (!Number.isInteger(weekday)) continue;
      const row = counts.get(order.driverId) || { name, days: [0, 0, 0, 0, 0, 0, 0] };
      row.days[weekday] += 1;
      counts.set(order.driverId, row);
    }
    const rows = [...counts.entries()].map(([id, { name, days }]) => ({ id, name, days, total: days.reduce((a, b) => a + b, 0) }));
    rows.sort((a, b) => b.total - a.total);
    const max = rows.reduce((largest, row) => Math.max(largest, ...row.days), 1);
    return { rows, max };
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
    return [...map.entries()]
      .map(([id, r]) => ({ id, ...r, pct: r.total ? (r.outside / r.total) * 100 : 0 }))
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
    if (loadedFilters !== filters) return;
    setExportErrorMessage(null);
    setIsExportingCleanOrders(true);
    try {
      const cleanRows = await deliveryCleanExportService.orders.list(filters);
      const parity = buildDeliveryOrderCleanExportParity(filteredOrders, cleanRows);
      if (!parity.matches) {
        throw new Error(`Clean export parity failed: ${parity.differences.join('; ')}`);
      }
      const dashboardSections: DeliveryDashboardExportSection[] = [
        ...KPI_TABS.map<DeliveryDashboardExportSection>(({ id, label }) => ({
          tab: id === 'operations' ? 'Operations' : 'Dashboard',
          name: label,
          headers: ['KPI', 'Count', 'Value (BHD)', 'Details'],
          rows: kpiCards[id].map(metric => [
            metric.label,
            metric.currency ? '' : metric.value,
            metric.currency ? truncateBhd(metric.value) : metric.detailValueBhd == null ? '' : truncateBhd(metric.detailValueBhd),
            metric.detail || ''
          ]),
          formats: { 3: '0.000' }
        })),
        leaderExportSection('Branches', 'Orders per branch', 'Branch', branchBoard),
        leaderExportSection('Pharmacists', 'Pharmacist performance', 'Pharmacist', pharmacistBoard),
        leaderExportSection('Drivers', 'Driver performance', 'Driver', driverBoard),
        ...(SHOW_RECORDED_EXTERNAL_DRIVER ? [
          leaderExportSection('Drivers', 'Recorded external driver value', 'Recorded driver', recordedDriverBoard)
        ] : []),
        {
          tab: 'Operations',
          name: 'Internal transfer routes',
          headers: ['From branch', 'To branch', 'Orders'],
          rows: transferRoutes.map(row => [row.from, row.to, row.orders])
        },
        leaderExportSection('Geography', 'Direct payments by governorate', 'Governorate', govBoard),
        leaderExportSection('Geography', 'Direct payments by area', 'Area', areaBoard),
        leaderExportSection('Geography', 'Direct payments by block', 'Block', blockBoard),
        {
          tab: 'Drivers',
          name: 'Driver workload by weekday',
          headers: ['Driver', ...WEEKDAYS, 'Total'],
          rows: heatmap.rows.map(row => [row.name, ...row.days, row.total])
        },
        {
          tab: 'Geography',
          name: 'Outside-governorate share',
          headers: ['Branch', 'Outside orders', 'Direct orders', 'Outside share'],
          rows: outsideByBranch.map(row => [row.name, row.outside, row.total, row.pct / 100]),
          formats: { 4: '0%' }
        }
      ];
      await runAfterNextPaint(() => exportDeliveryOrderCleanRowsToExcel(
        cleanRows,
        label,
        `Delivery_Clean_All_${range.from}_${range.to}`,
        parity,
        dashboardSections
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

  const kpiCards: Record<KpiTab, KpiMetric[]> = {
    overview: [
      { label: 'Registered orders', value: filteredOrders.length, detail: label },
      { label: 'Registered value', value: totalValue, currency: true },
      { label: 'Avg order value', value: avgValue, currency: true },
      { label: 'Active branches', value: branchBoard.length, detail: 'with orders in period' }
    ],
    sources: (['WhatsApp', 'Online', 'Talabat'] as const).map(source => ({
      label: `${source} Orders`, value: sourceGroup(source).count, detailValueBhd: sourceGroup(source).fils / 1000
    })),
    operations: [
      { label: 'Total Delivery Orders', value: totalDelivery.count, detailValueBhd: totalDelivery.valueBhd },
      { label: 'Tabarak Delivery', value: tabarakDelivery.count, detailValueBhd: tabarakDelivery.valueBhd },
      { label: 'Talabat Delivery', value: talabatDelivery.count, detailValueBhd: talabatDelivery.valueBhd },
      { label: 'Internal transfer', value: internalTransfers.length, detail: `${transferRoutes.length} routes` },
      { label: 'Direct payment types', value: direct.length, detailValueBhd: sumValue(direct) },
      { label: 'External / no-block', value: external.length, detailValueBhd: sumValue(external) }
    ]
  };

  const handleKpiTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = KPI_TABS.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowLeft': next = index === 0 ? last : index - 1; break;
      case 'ArrowRight': next = index === last ? 0 : index + 1; break;
      case 'Home': next = 0; break;
      case 'End': next = last; break;
      default: return;
    }
    event.preventDefault();
    const nextTab = KPI_TABS[next].id;
    setActiveKpiTab(nextTab);
    document.getElementById(`${kpiId}-tab-${nextTab}`)?.focus();
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
                disabled={isLoading || loadedFilters !== filters || isExportingCleanOrders}
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
          {SHOW_RECORDED_EXTERNAL_DRIVER && <SearchableSelect
            options={drivers.map(d => ({ value: d.id, label: d.driverCode ? `${d.driverCode} - ${d.name}` : d.name }))}
            value={recordedDriverFilter} onChange={setRecordedDriverFilter} placeholder="All recorded drivers" />}
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
          <section aria-label="Delivery KPIs" className="space-y-3">
            <div role="tablist" aria-label="Delivery KPI groups" className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 print:hidden">
              {KPI_TABS.map(({ id, label }, index) => {
                const selected = activeKpiTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    id={`${kpiId}-tab-${id}`}
                    aria-controls={`${kpiId}-panel-${id}`}
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveKpiTab(id)}
                    onKeyDown={event => handleKpiTabKeyDown(event, index)}
                    className={`rounded-md px-3 py-2 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${selected ? 'bg-white text-brand shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {KPI_TABS.map(({ id, label }) => (
              <div
                key={id}
                role="tabpanel"
                id={`${kpiId}-panel-${id}`}
                aria-labelledby={`${kpiId}-tab-${id}`}
                tabIndex={activeKpiTab === id ? 0 : -1}
                className={activeKpiTab === id ? undefined : 'hidden print:block'}
              >
                <h2 className="mb-2 hidden text-sm font-bold print:block">{label}</h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 print:grid-cols-4">
                  {kpiCards[id].map(metric => (
                    <KpiCard key={metric.label} label={metric.label} value={metric.currency ? formatBhd(metric.value) : String(metric.value)} sub={metric.detailValueBhd == null ? metric.detail : formatBhd(metric.detailValueBhd)} />
                  ))}
                </div>
              </div>
            ))}
          </section>

          {/* Branch + people leaderboards */}
          <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${SHOW_RECORDED_EXTERNAL_DRIVER ? 'xl:grid-cols-4' : 'lg:grid-cols-3'}`}>
            <Leaderboard title="Orders per branch" rows={branchBoard} emptyLabel="No branch activity." />
            <Leaderboard title="Pharmacist performance" rows={pharmacistBoard} emptyLabel="No pharmacist-linked orders." />
            <Leaderboard title="Driver performance" rows={driverBoard} emptyLabel="No driver-linked orders." />
            {SHOW_RECORDED_EXTERNAL_DRIVER && <Leaderboard title="Recorded external driver value (no dispatch)" rows={recordedDriverBoard} emptyLabel="No externally assigned driver records." />}
          </div>

          <section className="operational-panel p-4 md:p-5">
            <div className="mb-4 flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-brand" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Internal transfer routes</h3>
            </div>
            {transferRoutes.length === 0 ? (
              <p className="py-6 text-center text-xs font-bold text-slate-400">No internal transfer orders in this period.</p>
            ) : (
              <PagedRows<TransferRouteRow> rows={transferRoutes} label="Internal transfer routes">{page => <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {page.map(route => (
                  <div key={route.key} className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-black text-slate-900">{route.from}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">to</p>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <p className="min-w-0 break-words text-xs font-bold text-slate-700">{route.to}</p>
                      <span className="rounded-full bg-brand/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                        {route.orders} orders
                      </span>
                    </div>
                  </div>
                ))}
              </div>}</PagedRows>
            )}
          </section>

          {/* Geography — direct orders only */}
          <section className="operational-panel p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-brand" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Geography — direct payment types</h3>
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
                <Leaderboard title="Areas" rows={areaBoard} emptyLabel="No area data." />
                <Leaderboard title="Blocks" rows={blockBoard} emptyLabel="No block data." />
              </div>
            ) : drilldown && (
              <div>
                <p className="mb-3 text-sm font-bold text-slate-600">
                  <span className="font-black text-slate-900">{drilldownGov}</span> — {drilldown.total} direct orders · {formatBhd(drilldown.value)}
                </p>
                <div key={drilldownGov} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Leaderboard title="Areas" rows={drilldown.areas} emptyLabel="No area data." />
                  <Leaderboard title="Blocks" rows={drilldown.blocks} emptyLabel="No block data." />
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
                <PagedRows<(typeof heatmap.rows)[number]> rows={heatmap.rows} label="Driver workload">{page => <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <th className="py-1.5 pr-2 text-left">Driver</th>
                        {WEEKDAYS.map(d => <th key={d} className="px-1 py-1.5 text-center">{d}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {page.map(row => (
                        <tr key={row.id}>
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
                </div>}</PagedRows>
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
                <PagedRows<(typeof outsideByBranch)[number]> rows={outsideByBranch} label="Outside-governorate share">{page => <div className="space-y-2">
                  {page.map(row => (
                    <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg border border-slate-100 p-2">
                      <span className="break-words text-xs font-bold text-slate-700">{row.name}</span>
                      <span className="text-right text-[11px] font-black tabular-nums text-slate-600">
                        {row.pct.toFixed(0)}% ({row.outside}/{row.total})
                      </span>
                      <div className="col-span-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${row.pct > 40 ? 'bg-red-400' : row.pct > 20 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${Math.min(100, row.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>}</PagedRows>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
};
