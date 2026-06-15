import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  FileDown,
  Gauge,
  Layers,
  MapPinned,
  Package,
  Printer,
  Search,
  ShieldCheck,
  Store,
  Truck,
  Wallet,
  X
} from 'lucide-react';
import { Branch, DeliveryOrder, DeliveryPaymentType, Governorate } from '../../types';
import { BackToModulesButton } from '../shared';
import { PeriodFilter } from '../delivery/components/PeriodFilter';
import { SearchableSelect } from '../delivery/components/SearchableSelect';
import { BlockCoverageMap, BlockCoverageMapLoading } from '../delivery/components/BlockCoverageMap';
import { BlockGeometryDataset, loadBahrainBlockGeometry } from '../delivery/bahrainBlockGeometry';
import { exportBreakdownToExcel, exportOrdersToExcel, printReport } from '../delivery/exports';
import { PeriodPreset, formatBhd, getPresetRange, periodLabel, todayKey } from '../delivery/utils';
import { deliveryService } from '../../services/deliveryService';
import { isModuleEnabled } from '../../config/clientConfig';
import {
  OwnerBranchKpi,
  OwnerDashboardBundle,
  OwnerDashboardSection,
  OwnerDriverKpi,
  ownerDashboardService
} from './ownerDashboardService';
import { buildOwnerZoneAnalysis, ownerGeometryStats, ownerMapBlocksWithGeometry } from './ownerZoneAnalysis';

const GOVERNORATES: Governorate[] = ['Capital', 'Muharraq', 'Northern', 'Southern'];
const PAYMENT_TYPES: DeliveryPaymentType[] = ['BP', 'CARD', 'CASH', 'TALABAT'];

interface OwnerDashboardPageProps {
  user: Branch;
  onBack: () => void;
}

const formatPercent = (value: number) => `${Number(value || 0).toFixed(1)}%`;
const compactDateTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const classNames = (...items: Array<string | false | null | undefined>) => items.filter(Boolean).join(' ');

const KpiCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  tone?: 'brand' | 'emerald' | 'amber' | 'red' | 'slate';
}> = ({ label, value, sub, icon, tone = 'slate' }) => {
  const toneClasses = {
    brand: 'border-brand/15 bg-brand/5 text-brand',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    red: 'border-red-100 bg-red-50 text-red-700',
    slate: 'border-slate-200 bg-white text-slate-500'
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <span className={classNames('inline-flex h-8 w-8 items-center justify-center rounded-lg border', toneClasses[tone])}>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-slate-950 tabular-nums">{value}</p>
      {sub && <p className="mt-1 truncate text-[11px] font-bold text-slate-500">{sub}</p>}
    </div>
  );
};

const SectionButton: React.FC<{
  id: OwnerDashboardSection;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: (id: OwnerDashboardSection) => void;
}> = ({ id, label, icon, active, onClick }) => (
  <button
    type="button"
    onClick={() => onClick(id)}
    className={classNames(
      'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold transition-all',
      active ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
    )}
  >
    {icon}
    {label}
  </button>
);

const StatusPill: React.FC<{ status: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' }> = ({ status, tone = 'neutral' }) => {
  const toneClass = tone === 'good'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : tone === 'bad'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-slate-200 bg-slate-50 text-slate-500';
  return <span className={classNames('rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-widest', toneClass)}>{status}</span>;
};

const driverTone = (classification: OwnerDriverKpi['classification']): 'good' | 'warn' | 'bad' | 'neutral' => {
  if (classification === 'optimum') return 'good';
  if (classification === 'in_range' || classification === 'no_cost_data') return 'neutral';
  if (classification === 'low_efficiency') return 'warn';
  return 'bad';
};

const branchTone = (status: OwnerBranchKpi['healthStatus']): 'good' | 'warn' | 'bad' | 'neutral' => {
  if (status === 'healthy') return 'good';
  if (status === 'watch' || status === 'insufficient_data') return 'neutral';
  if (status === 'risk') return 'warn';
  return 'bad';
};

const AuditTimeline: React.FC<{ order: DeliveryOrder | null }> = ({ order }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLogs([]);
    if (!order) return undefined;
    setIsLoading(true);
    deliveryService.auditLogs.listForOrder(order.id)
      .then(rows => { if (!cancelled) setLogs(rows); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [order]);

  if (!order) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audit timeline</p>
      {isLoading ? (
        <p className="mt-3 text-xs font-bold text-slate-400">Loading audit trail...</p>
      ) : logs.length === 0 ? (
        <p className="mt-3 text-xs font-bold leading-5 text-slate-500">
          No audit events returned. This can mean the order has not been edited/deleted, or the target Supabase project still needs the owner read-only audit policy migration.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {logs.map((log, index) => (
            <div key={log.id || index} className="rounded-md border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-slate-800">{String(log.action || 'change').replace('_', ' ')}</p>
                <p className="text-[10px] font-bold text-slate-400">{compactDateTime(log.changed_at)}</p>
              </div>
              {log.changed_by && <p className="mt-1 text-[10px] font-bold text-slate-400">By {String(log.changed_by).slice(0, 8)}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const OwnerDashboardPage: React.FC<OwnerDashboardPageProps> = ({ user, onBack }) => {
  const [section, setSection] = useState<OwnerDashboardSection>('overview');
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [customFrom, setCustomFrom] = useState(todayKey());
  const [customTo, setCustomTo] = useState(todayKey());
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<string | null>(null);
  const [driverFilter, setDriverFilter] = useState<string | null>(null);
  const [governorateFilter, setGovernorateFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [bundle, setBundle] = useState<OwnerDashboardBundle | null>(null);
  const [geometry, setGeometry] = useState<BlockGeometryDataset | null>(null);
  const [isGeometryLoading, setIsGeometryLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);

  const range = getPresetRange(preset, customFrom, customTo);
  const label = periodLabel(preset, range.from, range.to);

  useEffect(() => {
    let cancelled = false;
    setIsGeometryLoading(true);
    loadBahrainBlockGeometry()
      .then(dataset => { if (!cancelled) setGeometry(dataset); })
      .catch(() => { if (!cancelled) setGeometry(null); })
      .finally(() => { if (!cancelled) setIsGeometryLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setSelectedBlock(null);
    setSelectedOrder(null);

    ownerDashboardService.loadBundle({
      dateFrom: range.from,
      dateTo: range.to,
      branchId: branchFilter,
      paymentType: paymentFilter as DeliveryPaymentType | null,
      driverId: driverFilter,
      governorate: governorateFilter as Governorate | null,
      search
    })
      .then(data => { if (!cancelled) setBundle(data); })
      .catch(loadError => {
        if (!cancelled) {
          setBundle(null);
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [range.from, range.to, branchFilter, paymentFilter, driverFilter, governorateFilter, search]);

  const branchOptions = useMemo(
    () => (bundle?.branches || []).map(branch => ({ value: branch.id, label: branch.name, hint: branch.code })),
    [bundle?.branches]
  );
  const driverOptions = useMemo(
    () => (bundle?.drivers || []).map(driver => ({
      value: driver.id,
      label: driver.driverCode ? `${driver.driverCode} - ${driver.name}` : driver.name,
      hint: driver.isActive ? 'active' : 'inactive'
    })),
    [bundle?.drivers]
  );

  const zoneAnalysis = useMemo(
    () => buildOwnerZoneAnalysis(bundle?.coverage.summary || null, bundle?.branchProfiles || [], geometry),
    [bundle?.coverage.summary, bundle?.branchProfiles, geometry]
  );

  const mapBlocks = useMemo(
    () => ownerMapBlocksWithGeometry(bundle?.coverage.summary.blocks || [], geometry),
    [bundle?.coverage.summary.blocks, geometry]
  );

  const geometryStats = useMemo(
    () => ownerGeometryStats(bundle?.coverage.summary.blocks || [], geometry),
    [bundle?.coverage.summary.blocks, geometry]
  );

  const topDriverRisk = bundle?.driverKpis.find(driver => driver.classification === 'loss_making' || driver.classification === 'low_efficiency');
  const topBranchRisk = bundle?.branchKpis.find(branch => branch.healthStatus === 'critical' || branch.healthStatus === 'risk');
  const exportEnabled = isModuleEnabled('excelExport');

  const handlePeriodChange = (nextPreset: PeriodPreset, from?: string, to?: string) => {
    setPreset(nextPreset);
    if (from !== undefined) setCustomFrom(from);
    if (to !== undefined) setCustomTo(to);
  };

  const clearFilters = () => {
    setBranchFilter(null);
    setPaymentFilter(null);
    setDriverFilter(null);
    setGovernorateFilter(null);
    setSearch('');
  };

  const exportTraceability = () => {
    if (!bundle) return;
    exportOrdersToExcel(bundle.orders, `Owner Delivery Traceability - ${label}`, `Owner_Delivery_Traceability_${range.from}_${range.to}`)
      .catch(console.error);
  };

  const exportOverview = () => {
    if (!bundle) return;
    exportBreakdownToExcel(
      [
        { metric: 'Total orders', value: bundle.overview.totalOrders, note: label },
        { metric: 'Delivery value (BHD)', value: Number(bundle.overview.totalValueBhd.toFixed(3)), note: 'Selected delivery scope' },
        { metric: 'Direct orders', value: bundle.overview.directOrders, note: 'WhatsApp / non-Talabat' },
        { metric: 'Talabat orders', value: bundle.overview.talabatOrders, note: 'No block by design' },
        { metric: 'Known block rate %', value: Number(bundle.overview.knownBlockRate.toFixed(1)), note: 'Direct orders with block' },
        { metric: 'Unknown block rate %', value: Number(bundle.overview.unknownBlockRate.toFixed(1)), note: 'Data-quality risk' },
        { metric: 'Outside governorate %', value: Number(bundle.overview.outsideGovernorateRate.toFixed(1)), note: 'Direct orders' },
        { metric: 'Lost sales value (BHD)', value: Number(bundle.overview.lostSalesValueBhd.toFixed(3)), note: 'Selected performance scope' },
        { metric: 'No-recovery lost sales', value: bundle.overview.noRecoveryLostSales, note: 'No alternative or transfer' },
        { metric: 'Critical shortages', value: bundle.overview.criticalShortages, note: 'Critical + out of stock' }
      ],
      [
        { key: 'metric', label: 'Metric' },
        { key: 'value', label: 'Value' },
        { key: 'note', label: 'Note' }
      ],
      `Owner Overview - ${label}`,
      `Owner_Overview_${range.from}_${range.to}`
    ).catch(console.error);
  };

  const exportBlocks = () => {
    if (!bundle) return;
    exportBreakdownToExcel(
      bundle.coverage.summary.blocks.map(block => {
        const zone = zoneAnalysis.byBlock.get(block.blockNumber);
        return {
          block: block.blockNumber,
          area: block.areaName || '',
          governorate: block.governorate || 'Unknown',
          orders: block.orderCount,
          dominantBranch: block.dominantBranchName || '',
          share: Number((block.shareOfTotal * 100).toFixed(1)),
          trend: block.trend,
          zone: zone?.zone || 'unavailable',
          distanceKm: zone?.distanceKm == null ? '' : Number(zone.distanceKm.toFixed(2)),
          action: zone?.recommendedAction || ''
        };
      }),
      [
        { key: 'block', label: 'Block' },
        { key: 'area', label: 'Area' },
        { key: 'governorate', label: 'Governorate' },
        { key: 'orders', label: 'Orders' },
        { key: 'dominantBranch', label: 'Dominant Branch' },
        { key: 'share', label: 'Share %', numFmt: '0.0' },
        { key: 'trend', label: 'Trend' },
        { key: 'zone', label: 'Zone' },
        { key: 'distanceKm', label: 'Distance KM', numFmt: '0.00' },
        { key: 'action', label: 'Recommended Action' }
      ],
      `Owner Block KPIs - ${label}`,
      `Owner_Block_KPIs_${range.from}_${range.to}`
    ).catch(console.error);
  };

  const exportDrivers = () => {
    if (!bundle) return;
    exportBreakdownToExcel(
      bundle.driverKpis.map(row => ({
        driver: row.driverName,
        code: row.driverCode || '',
        orders: row.orders,
        value: Number(row.totalValueBhd.toFixed(3)),
        ordersPerDay: Number(row.ordersPerDay.toFixed(2)),
        costPerOrder: row.costPerOrderBhd == null ? '' : Number(row.costPerOrderBhd.toFixed(3)),
        estimatedNet: row.estimatedNetBhd == null ? '' : Number(row.estimatedNetBhd.toFixed(3)),
        classification: row.classification
      })),
      [
        { key: 'driver', label: 'Driver' },
        { key: 'code', label: 'Code' },
        { key: 'orders', label: 'Orders' },
        { key: 'value', label: 'Value (BHD)', numFmt: '0.000' },
        { key: 'ordersPerDay', label: 'Orders / Day', numFmt: '0.00' },
        { key: 'costPerOrder', label: 'Cost / Order', numFmt: '0.000' },
        { key: 'estimatedNet', label: 'Estimated Net', numFmt: '0.000' },
        { key: 'classification', label: 'Classification' }
      ],
      `Owner Driver KPIs - ${label}`,
      `Owner_Driver_KPIs_${range.from}_${range.to}`
    ).catch(console.error);
  };

  const exportBranches = () => {
    if (!bundle) return;
    exportBreakdownToExcel(
      bundle.branchKpis.map(row => ({
        branch: `${row.branchCode} - ${row.branchName}`,
        deliveryOrders: row.deliveryOrders,
        deliveryValue: Number(row.deliveryValueBhd.toFixed(3)),
        uniqueBlocks: row.uniqueBlocks,
        unknownBlockRate: Number(row.unknownBlockRate.toFixed(1)),
        outsideGovernorateRate: Number(row.outsideGovernorateRate.toFixed(1)),
        lostSalesValue: Number(row.lostSalesValueBhd.toFixed(3)),
        noRecoveryRate: Number(row.noRecoveryRate.toFixed(1)),
        shortageCount: row.shortageCount,
        criticalShortageCount: row.criticalShortageCount,
        healthScore: row.healthScore,
        status: row.healthStatus
      })),
      [
        { key: 'branch', label: 'Branch' },
        { key: 'deliveryOrders', label: 'Delivery Orders' },
        { key: 'deliveryValue', label: 'Delivery Value', numFmt: '0.000' },
        { key: 'uniqueBlocks', label: 'Unique Blocks' },
        { key: 'unknownBlockRate', label: 'Unknown Block %', numFmt: '0.0' },
        { key: 'outsideGovernorateRate', label: 'Outside Gov %', numFmt: '0.0' },
        { key: 'lostSalesValue', label: 'Lost Sales Value', numFmt: '0.000' },
        { key: 'noRecoveryRate', label: 'No Recovery %', numFmt: '0.0' },
        { key: 'shortageCount', label: 'Shortages' },
        { key: 'criticalShortageCount', label: 'Critical Shortages' },
        { key: 'healthScore', label: 'Health Score' },
        { key: 'status', label: 'Status' }
      ],
      `Owner Pharmacy KPIs - ${label}`,
      `Owner_Pharmacy_KPIs_${range.from}_${range.to}`
    ).catch(console.error);
  };

  return (
    <div className="space-y-5 page-enter">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Read-only owner view</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Owner Dashboard</h2>
                <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-500">
                  Services performance, delivery traceability, Bahrain map zones, driver KPIs, and pharmacy KPIs in one executive view.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                No write actions
              </span>
              <BackToModulesButton onClick={onBack} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-slate-100 md:grid-cols-4">
          <div className="bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Today orders</p>
            <p className="mt-2 text-2xl font-black text-slate-950 tabular-nums">{bundle?.today.orders ?? '—'}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{formatBhd(bundle?.today.valueBhd || 0)}</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Today direct / Talabat</p>
            <p className="mt-2 text-2xl font-black text-slate-950 tabular-nums">{bundle ? `${bundle.today.directOrders}/${bundle.today.talabatOrders}` : '—'}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">WhatsApp vs marketplace</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Today lost sales</p>
            <p className="mt-2 text-2xl font-black text-red-700 tabular-nums">{formatBhd(bundle?.today.lostSalesValueBhd || 0)}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">service availability signal</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Critical shortages</p>
            <p className="mt-2 text-2xl font-black text-slate-950 tabular-nums">{bundle?.today.criticalShortages ?? '—'}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">Critical + out of stock</p>
          </div>
        </div>
      </div>

      <section className="operational-panel p-4 print:hidden">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <PeriodFilter preset={preset} customFrom={customFrom} customTo={customTo} onChange={handlePeriodChange} />
          <div className="flex flex-wrap gap-2">
            {exportEnabled && section === 'overview' && <button onClick={exportOverview} className="btn-secondary text-[10px] uppercase tracking-widest"><FileDown className="h-3.5 w-3.5" /> Overview Excel</button>}
            {exportEnabled && section === 'map' && <button onClick={exportBlocks} className="btn-secondary text-[10px] uppercase tracking-widest"><FileDown className="h-3.5 w-3.5" /> Block Excel</button>}
            {exportEnabled && section === 'traceability' && <button onClick={exportTraceability} className="btn-secondary text-[10px] uppercase tracking-widest"><FileDown className="h-3.5 w-3.5" /> Trace Excel</button>}
            {exportEnabled && section === 'drivers' && <button onClick={exportDrivers} className="btn-secondary text-[10px] uppercase tracking-widest"><FileDown className="h-3.5 w-3.5" /> Driver Excel</button>}
            {exportEnabled && section === 'pharmacies' && <button onClick={exportBranches} className="btn-secondary text-[10px] uppercase tracking-widest"><FileDown className="h-3.5 w-3.5" /> Branch Excel</button>}
            <button onClick={printReport} className="btn-secondary text-[10px] uppercase tracking-widest"><Printer className="h-3.5 w-3.5" /> PDF / Print</button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
          <SearchableSelect options={branchOptions} value={branchFilter} onChange={setBranchFilter} placeholder="All branches" />
          <SearchableSelect options={PAYMENT_TYPES.map(type => ({ value: type, label: type }))} value={paymentFilter} onChange={setPaymentFilter} placeholder="All payments" />
          <SearchableSelect options={driverOptions} value={driverFilter} onChange={setDriverFilter} placeholder="All drivers" />
          <SearchableSelect options={GOVERNORATES.map(gov => ({ value: gov, label: gov }))} value={governorateFilter} onChange={setGovernorateFilter} placeholder="All governorates" />
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search block, area, branch, driver..."
              className="h-full min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-9 text-sm font-bold text-slate-800 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-brand">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={clearFilters} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-brand/30 hover:text-brand">
            Clear filters
          </button>
          {(driverFilter || search) && (
            <span className="text-[11px] font-bold text-amber-700">
              Driver/search filters affect KPIs and traceability; the map uses date, branch, payment, and governorate filters.
            </span>
          )}
        </div>
      </section>

      <div className="flex overflow-x-auto rounded-lg border border-slate-200/50 bg-slate-100/60 p-1 print:hidden">
        <SectionButton id="overview" label="Overview" icon={<BarChart3 className="h-3.5 w-3.5" />} active={section === 'overview'} onClick={setSection} />
        <SectionButton id="map" label="Delivery Map" icon={<MapPinned className="h-3.5 w-3.5" />} active={section === 'map'} onClick={setSection} />
        <SectionButton id="traceability" label="Traceability" icon={<ClipboardList className="h-3.5 w-3.5" />} active={section === 'traceability'} onClick={setSection} />
        <SectionButton id="drivers" label="Drivers" icon={<Truck className="h-3.5 w-3.5" />} active={section === 'drivers'} onClick={setSection} />
        <SectionButton id="pharmacies" label="Pharmacies" icon={<Store className="h-3.5 w-3.5" />} active={section === 'pharmacies'} onClick={setSection} />
      </div>

      {isLoading ? (
        <div className="flex h-56 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700">{error}</div>
      ) : bundle && (
        <>
          {section === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                <KpiCard label="Orders" value={bundle.overview.totalOrders} sub={label} icon={<Package className="h-4 w-4" />} tone="brand" />
                <KpiCard label="Delivery value" value={formatBhd(bundle.overview.totalValueBhd)} sub={`Avg ${formatBhd(bundle.overview.averageOrderValueBhd)}`} icon={<Wallet className="h-4 w-4" />} tone="emerald" />
                <KpiCard label="Direct" value={bundle.overview.directOrders} sub={formatBhd(bundle.orders.filter(order => order.paymentType !== 'TALABAT').reduce((sum, order) => sum + order.valueBhd, 0))} icon={<Truck className="h-4 w-4" />} tone="brand" />
                <KpiCard label="Talabat" value={bundle.overview.talabatOrders} sub="no block by design" icon={<Package className="h-4 w-4" />} />
                <KpiCard label="Known blocks" value={formatPercent(bundle.overview.knownBlockRate)} sub={`${bundle.coverage.summary.uniqueBlocksServed} unique blocks`} icon={<MapPinned className="h-4 w-4" />} tone={bundle.overview.knownBlockRate >= 85 ? 'emerald' : 'amber'} />
                <KpiCard label="Unknown blocks" value={formatPercent(bundle.overview.unknownBlockRate)} sub="data quality" icon={<AlertTriangle className="h-4 w-4" />} tone={bundle.overview.unknownBlockRate > 10 ? 'red' : 'slate'} />
                <KpiCard label="Outside gov." value={formatPercent(bundle.overview.outsideGovernorateRate)} sub="direct orders" icon={<Layers className="h-4 w-4" />} tone={bundle.overview.outsideGovernorateRate > 25 ? 'amber' : 'slate'} />
                <KpiCard label="Shortage risk" value={bundle.overview.criticalShortages} sub={`${formatBhd(bundle.overview.lostSalesValueBhd)} lost sales`} icon={<Gauge className="h-4 w-4" />} tone={bundle.overview.criticalShortages > 0 ? 'red' : 'emerald'} />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <section className="operational-panel p-4 md:p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-brand" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Owner attention</h3>
                  </div>
                  <div className="space-y-2">
                    {topBranchRisk ? (
                      <button onClick={() => setSection('pharmacies')} className="w-full rounded-lg border border-amber-100 bg-amber-50 p-3 text-left">
                        <p className="text-xs font-black text-amber-900">{topBranchRisk.branchCode} - {topBranchRisk.branchName}</p>
                        <p className="mt-1 text-[11px] font-bold text-amber-800">Health {topBranchRisk.healthScore}/100 · {topBranchRisk.healthStatus.replace('_', ' ')}</p>
                      </button>
                    ) : (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">No critical branch risk in the selected scope.</div>
                    )}
                    {topDriverRisk ? (
                      <button onClick={() => setSection('drivers')} className="w-full rounded-lg border border-red-100 bg-red-50 p-3 text-left">
                        <p className="text-xs font-black text-red-900">{topDriverRisk.driverName}</p>
                        <p className="mt-1 text-[11px] font-bold text-red-800">{topDriverRisk.classification.replace('_', ' ')} · {topDriverRisk.ordersPerDay.toFixed(1)} orders/day</p>
                      </button>
                    ) : (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">Driver productivity has no critical alert.</div>
                    )}
                  </div>
                </section>

                <section className="operational-panel p-4 md:p-5 xl:col-span-2">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Lowest pharmacy health</h3>
                      <p className="mt-1 text-xs font-medium text-slate-500">Sorted by risk score; owner can drill into pharmacy KPIs.</p>
                    </div>
                    <button onClick={() => setSection('pharmacies')} className="btn-secondary text-[10px] uppercase tracking-widest">Open pharmacies</button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    {bundle.branchKpis.slice(0, 3).map(branch => (
                      <div key={branch.branchId} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-black text-slate-800">{branch.branchCode}</p>
                          <StatusPill status={branch.healthStatus.replace('_', ' ')} tone={branchTone(branch.healthStatus)} />
                        </div>
                        <p className="mt-1 truncate text-xs font-bold text-slate-500">{branch.branchName}</p>
                        <p className="mt-3 text-2xl font-black text-slate-950 tabular-nums">{branch.healthScore}/100</p>
                        <p className="mt-1 text-[11px] font-bold text-slate-500">{branch.deliveryOrders} delivery · {branch.criticalShortageCount} critical shortages</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {section === 'map' && (
            <section className="operational-panel p-4 md:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPinned className="h-4 w-4 text-brand" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Bahrain delivery map & zones</h3>
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-500">{label} · {bundle.coverage.summary.knownBlockOrders} known-block orders</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill status={`${zoneAnalysis.metrics.servedCoreBlocks} core`} tone="good" />
                  <StatusPill status={`${zoneAnalysis.metrics.servedStandardBlocks} standard`} />
                  <StatusPill status={`${zoneAnalysis.metrics.servedExtendedBlocks} extended`} tone="warn" />
                  <StatusPill status={`${zoneAnalysis.metrics.servedOutsideRangeBlocks} outside range`} tone={zoneAnalysis.metrics.servedOutsideRangeBlocks > 0 ? 'bad' : 'neutral'} />
                </div>
              </div>

              {isGeometryLoading ? (
                <BlockCoverageMapLoading featureCount={geometry?.featureCount} />
              ) : geometry?.available ? (
                <BlockCoverageMap
                  dataset={geometry}
                  blocks={mapBlocks}
                  branchProfiles={bundle.branchProfiles.filter(profile => profile.isDeliveryEnabled !== false)}
                  blockZoneAnalysis={zoneAnalysis.byBlock}
                  zoneMetrics={zoneAnalysis.metrics}
                  summary={bundle.coverage.summary}
                  selectedBlock={selectedBlock}
                  highlightedGovernorate={governorateFilter as Governorate | null}
                  geometryStats={geometryStats}
                  onSelect={setSelectedBlock}
                />
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-black text-amber-900">Map geometry is unavailable.</p>
                  <p className="mt-1 text-xs font-bold text-amber-800">Matrix fallback: top known delivery blocks are still shown from live records.</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {bundle.coverage.summary.topBlocks.map(block => (
                      <button key={block.blockNumber} onClick={() => setSelectedBlock(block)} className="rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs font-black text-amber-900">
                        #{block.blockNumber} · {block.orderCount}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {section === 'traceability' && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section className="operational-panel overflow-hidden">
                <div className="border-b border-slate-100 p-4 md:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Delivery traceability log</h3>
                      <p className="mt-1 text-xs font-bold text-slate-500">{bundle.orders.length} orders · {formatBhd(bundle.orders.reduce((sum, order) => sum + order.valueBhd, 0))}</p>
                    </div>
                    {exportEnabled && <button onClick={exportTraceability} className="btn-secondary text-[10px] uppercase tracking-widest"><Download className="h-3.5 w-3.5" /> Export all</button>}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Branch</th>
                        <th className="px-4 py-3">Driver</th>
                        <th className="px-4 py-3">Payment</th>
                        <th className="px-4 py-3">Block</th>
                        <th className="px-4 py-3">Area</th>
                        <th className="px-4 py-3 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {bundle.orders.slice(0, 500).map(order => (
                        <tr key={order.id} onClick={() => setSelectedOrder(order)} className={classNames('cursor-pointer hover:bg-brand/5', selectedOrder?.id === order.id && 'bg-brand/5')}>
                          <td className="px-4 py-3 font-bold text-slate-700 tabular-nums">{order.orderDate}</td>
                          <td className="px-4 py-3 font-black text-slate-800">{order.branchName || 'Unknown branch'}</td>
                          <td className="px-4 py-3 font-bold text-slate-600">{order.driverCode ? `${order.driverCode} - ${order.driverName}` : order.driverName || '—'}</td>
                          <td className="px-4 py-3"><StatusPill status={order.paymentType} /></td>
                          <td className="px-4 py-3 font-black text-slate-700 tabular-nums">{order.blockNumber || (order.paymentType === 'TALABAT' ? 'Talabat' : '—')}</td>
                          <td className="px-4 py-3 font-bold text-slate-500">{order.areaName || order.governorate || '—'}</td>
                          <td className="px-4 py-3 text-right font-black text-slate-900 tabular-nums">{formatBhd(order.valueBhd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {bundle.orders.length === 0 && <p className="p-8 text-center text-xs font-bold text-slate-400">No delivery orders match the current filters.</p>}
              </section>

              <aside className="space-y-4">
                {selectedOrder ? (
                  <>
                    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selected order</p>
                      <h4 className="mt-1 text-xl font-black text-slate-950">{formatBhd(selectedOrder.valueBhd)}</h4>
                      <div className="mt-3 space-y-2 text-xs font-bold text-slate-600">
                        <p>Branch: <span className="text-slate-900">{selectedOrder.branchName || 'Unknown'}</span></p>
                        <p>Driver: <span className="text-slate-900">{selectedOrder.driverName || 'Unassigned'}</span></p>
                        <p>Pharmacist: <span className="text-slate-900">{selectedOrder.pharmacistName || 'Unassigned'}</span></p>
                        <p>Block: <span className="text-slate-900">{selectedOrder.blockNumber || 'No block'}</span></p>
                        <p>Governorate: <span className="text-slate-900">{selectedOrder.governorate || 'Unknown'}</span></p>
                        <p>Created: <span className="text-slate-900">{compactDateTime(selectedOrder.createdAt)}</span></p>
                      </div>
                    </div>
                    <AuditTimeline order={selectedOrder} />
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                    <ClipboardList className="mx-auto h-7 w-7 text-slate-300" />
                    <p className="mt-3 text-sm font-black text-slate-700">Select an order</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-400">Order details and read-only audit timeline appear here.</p>
                  </div>
                )}
              </aside>
            </div>
          )}

          {section === 'drivers' && (
            <section className="operational-panel overflow-hidden">
              <div className="border-b border-slate-100 p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Driver KPIs & cost efficiency</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">Cost/order and estimated net are visible to owner, but no cost settings can be edited.</p>
                  </div>
                  {exportEnabled && <button onClick={exportDrivers} className="btn-secondary text-[10px] uppercase tracking-widest"><Download className="h-3.5 w-3.5" /> Export drivers</button>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-4 py-3">Driver</th>
                      <th className="px-4 py-3 text-right">Orders</th>
                      <th className="px-4 py-3 text-right">Value</th>
                      <th className="px-4 py-3 text-right">Orders/day</th>
                      <th className="px-4 py-3 text-right">Cost/order</th>
                      <th className="px-4 py-3 text-right">Est. net</th>
                      <th className="px-4 py-3">Class</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {bundle.driverKpis.map(driver => (
                      <tr key={driver.driverId} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <p className="font-black text-slate-800">{driver.driverName}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-brand">{driver.driverCode || (driver.isActive ? 'Active' : 'Inactive')}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-black tabular-nums">{driver.orders}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{formatBhd(driver.totalValueBhd)}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{driver.ordersPerDay.toFixed(1)}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{driver.costPerOrderBhd == null ? '—' : formatBhd(driver.costPerOrderBhd)}</td>
                        <td className={classNames('px-4 py-3 text-right font-black tabular-nums', driver.estimatedNetBhd == null ? 'text-slate-300' : driver.estimatedNetBhd < 0 ? 'text-red-600' : 'text-emerald-600')}>
                          {driver.estimatedNetBhd == null ? '—' : formatBhd(driver.estimatedNetBhd)}
                        </td>
                        <td className="px-4 py-3"><StatusPill status={driver.classification.replace('_', ' ')} tone={driverTone(driver.classification)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {section === 'pharmacies' && (
            <section className="operational-panel overflow-hidden">
              <div className="border-b border-slate-100 p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Pharmacy KPIs</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">Delivery + lost sales + shortages combined into an owner health view.</p>
                  </div>
                  {exportEnabled && <button onClick={exportBranches} className="btn-secondary text-[10px] uppercase tracking-widest"><Download className="h-3.5 w-3.5" /> Export branches</button>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-4 py-3">Pharmacy</th>
                      <th className="px-4 py-3 text-right">Health</th>
                      <th className="px-4 py-3 text-right">Delivery</th>
                      <th className="px-4 py-3 text-right">Value</th>
                      <th className="px-4 py-3 text-right">Blocks</th>
                      <th className="px-4 py-3 text-right">Unknown %</th>
                      <th className="px-4 py-3 text-right">Outside gov.</th>
                      <th className="px-4 py-3 text-right">Lost sales</th>
                      <th className="px-4 py-3 text-right">No recovery</th>
                      <th className="px-4 py-3 text-right">Shortage risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {bundle.branchKpis.map(branch => (
                      <tr key={branch.branchId} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <p className="font-black text-slate-800">{branch.branchCode} - {branch.branchName}</p>
                          <p className="text-[10px] font-bold text-slate-400">
                            Top block {branch.topBlockNumber ? `#${branch.topBlockNumber}` : '—'} · Top driver {branch.topDriverName || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-black tabular-nums text-slate-950">{branch.healthScore}/100</span>
                            <StatusPill status={branch.healthStatus.replace('_', ' ')} tone={branchTone(branch.healthStatus)} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-black tabular-nums">{branch.deliveryOrders}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{formatBhd(branch.deliveryValueBhd)}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{branch.uniqueBlocks}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{formatPercent(branch.unknownBlockRate)}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{formatPercent(branch.outsideGovernorateRate)}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{formatBhd(branch.lostSalesValueBhd)}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{formatPercent(branch.noRecoveryRate)}</td>
                        <td className="px-4 py-3 text-right font-black tabular-nums">{branch.criticalShortageCount}/{branch.shortageCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-xs font-bold leading-5 text-blue-900 print:hidden">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
          <p>
            Owner view is read-only by design. Export and print are allowed because they do not mutate operational data.
          </p>
        </div>
      </div>
    </div>
  );
};
