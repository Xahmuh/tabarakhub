import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  AlertTriangle, ArrowUpRight, Building2, CheckCircle2, FileDown, Grid3x3, Info, Layers, LayoutDashboard, Lightbulb, Map as MapIcon, MapPinned, Package, Printer, ShieldAlert, Target, TrendingDown, TrendingUp
} from 'lucide-react';
import { deliveryCoverageService } from '../../services/deliveryCoverageService';
import { branchService } from '../../services/branchService';
import { operationsTaskService } from '../command-center/operationsTaskService';
import {
  Branch, DeliveryAdvancedCoverage, DeliveryBlockMetric, DeliveryCoverageRecommendation, DeliveryCoverageSummary, Governorate
} from '../../types';
import { SearchableSelect } from './components/SearchableSelect';
import { BlockCoverageMap, BlockCoverageMapLoading } from './components/BlockCoverageMap';
import {
  BranchCatchmentSection, BranchOverlapSection, CampaignOpportunitiesSection, CapacityPressureSection,
  CoverageTaskRequest, DemandTrendSection, ExpansionReviewSection, FieldAvailabilitySection, WhiteSpaceSection
} from './components/CoverageSections';
import { BlockGeometryDataset, loadBahrainBlockGeometry } from './bahrainBlockGeometry';
import { exportBreakdownToExcel, printReport } from './exports';
import { isModuleEnabled } from '../../config/clientConfig';

type CoverageSection = 'overview' | 'matrix' | 'catchment' | 'campaign' | 'overlap' | 'capacity' | 'expansion' | 'quality';

type CoveragePreset = 'today' | '7d' | '30d' | 'month' | 'custom';
type GeometryStatus = 'loading' | 'available' | 'unavailable';

const GOV_ORDER: Array<Governorate | 'Unknown'> = ['Capital', 'Muharraq', 'Northern', 'Southern', 'Unknown'];

const toDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const presetRange = (preset: CoveragePreset, from: string, to: string): { from: string; to: string } => {
  const now = new Date();
  const today = toDateKey(now);
  if (preset === 'today') return { from: today, to: today };
  if (preset === '7d') { const f = new Date(now); f.setDate(f.getDate() - 6); return { from: toDateKey(f), to: today }; }
  if (preset === '30d') { const f = new Date(now); f.setDate(f.getDate() - 29); return { from: toDateKey(f), to: today }; }
  if (preset === 'month') return { from: toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  return { from: from || today, to: to || today };
};

const PRESETS: Array<{ id: CoveragePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' }
];

const REC_TONE: Record<DeliveryCoverageRecommendation['type'], string> = {
  strong_service_area: 'border-emerald-200 bg-emerald-50',
  marketing_opportunity: 'border-blue-200 bg-blue-50',
  under_served_area: 'border-amber-200 bg-amber-50',
  data_quality_issue: 'border-red-200 bg-red-50',
  expansion_candidate: 'border-violet-200 bg-violet-50'
};

const TrendIcon: React.FC<{ trend: DeliveryBlockMetric['trend'] }> = ({ trend }) => {
  if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />;
  if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return null;
};

const KpiCard: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
    <p className="mt-2 text-xl font-black tracking-tight text-slate-950 tabular-nums">{value}</p>
    {sub && <p className="mt-1 text-[11px] font-bold text-slate-500 truncate">{sub}</p>}
  </div>
);

interface DeliveryCoverageProps {
  /** Restrict the branch filter (supervisor/branch scopes); RLS enforces data scope regardless. */
  lockedBranchId?: string | null;
  /** Manager-only: allow creating operations tasks from insights. */
  canCreateTask?: boolean;
}

export const DeliveryCoverage: React.FC<DeliveryCoverageProps> = ({ lockedBranchId, canCreateTask = false }) => {
  const advancedEnabled = isModuleEnabled('deliveryCoverageAdvanced');
  const [preset, setPreset] = useState<CoveragePreset>('30d');
  const [customFrom, setCustomFrom] = useState(toDateKey(new Date()));
  const [customTo, setCustomTo] = useState(toDateKey(new Date()));
  const [branchFilter, setBranchFilter] = useState<string | null>(lockedBranchId || null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [summary, setSummary] = useState<DeliveryCoverageSummary | null>(null);
  const [advanced, setAdvanced] = useState<DeliveryAdvancedCoverage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<DeliveryBlockMetric | null>(null);
  const [geometry, setGeometry] = useState<BlockGeometryDataset | null>(null);
  const [geometryStatus, setGeometryStatus] = useState<GeometryStatus>('loading');
  const [view, setView] = useState<'map' | 'matrix'>('matrix');
  const [section, setSection] = useState<CoverageSection>('overview');
  const [busyInsightId, setBusyInsightId] = useState<string | null>(null);

  const range = presetRange(preset, customFrom, customTo);

  useEffect(() => {
    branchService.list()
      .then(list => setBranches(list.filter(b => b.role === 'branch')))
      .catch(e => console.error('Coverage branch load failed', e));
  }, []);

  // Optional real block geometry. Never blocks the dashboard; matrix stays if absent.
  useEffect(() => {
    let cancelled = false;
    setGeometryStatus('loading');
    loadBahrainBlockGeometry()
      .then(ds => {
        if (cancelled) return;
        setGeometry(ds);
        setGeometryStatus(ds.available ? 'available' : 'unavailable');
        if (ds.available) setView('map');
      })
      .catch(() => {
        if (!cancelled) {
          setGeometry(null);
          setGeometryStatus('unavailable');
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setSelectedBlock(null);
    deliveryCoverageService.getDeliveryCoverageBundle({
      dateFrom: range.from,
      dateTo: range.to,
      branchId: lockedBranchId || branchFilter || undefined
    })
      .then(bundle => { if (!cancelled) { setSummary(bundle.summary); setAdvanced(bundle.advanced); } })
      .catch(e => { console.error('Coverage load failed', e); if (!cancelled) { setSummary(null); setAdvanced(null); } })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [range.from, range.to, branchFilter, lockedBranchId]);

  // Create an operations task from a coverage insight (manager-only), with a
  // duplicate warning if an open/in_progress task already exists for it.
  const handleCreateTask = async (req: CoverageTaskRequest) => {
    if (!canCreateTask) return;
    setBusyInsightId(req.insightId);
    try {
      const existing = await operationsTaskService.findOpenTaskForInsight(
        'delivery_coverage', req.relatedRecordType, req.relatedRecordId
      );
      if (existing) {
        const proceed = await Swal.fire({
          title: 'Task already exists',
          html: `An open task for this insight already exists:<br/><b>${existing.title}</b>.<br/>Create another anyway?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Create anyway',
          confirmButtonColor: '#B91c1c'
        });
        if (!proceed.isConfirmed) { setBusyInsightId(null); return; }
      }
      await operationsTaskService.createTaskFromInput({
        sourceModule: 'delivery_coverage',
        title: req.title,
        description: req.description,
        severity: req.severity,
        priority: req.severity,
        branchId: req.branchId || null,
        branchName: req.branchName || null,
        recommendedAction: req.recommendedAction,
        nextStep: req.recommendedAction,
        relatedRecordType: req.relatedRecordType,
        relatedRecordId: req.relatedRecordId
      }, `delivery coverage insight (${req.insightType})`);
      await Swal.fire({ title: 'Task created', text: req.title, icon: 'success', timer: 1600, showConfirmButton: false });
    } catch (e: any) {
      Swal.fire('Could not create task', e?.message || 'Task creation failed.', 'error');
    } finally {
      setBusyInsightId(null);
    }
  };

  const maxBlockOrders = useMemo(
    () => summary?.blocks.reduce((m, b) => Math.max(m, b.orderCount), 0) || 1,
    [summary]
  );

  const blocksByGov = useMemo(() => {
    const map = new Map<string, DeliveryBlockMetric[]>();
    summary?.blocks.forEach(b => {
      const gov = b.governorate || 'Unknown';
      const arr = map.get(gov) || [];
      arr.push(b);
      map.set(gov, arr);
    });
    return map;
  }, [summary]);

  const geoAvailable = geometryStatus === 'available' && !!geometry?.available;

  // How many served blocks in this period have real geometry.
  const geoMatch = useMemo(() => {
    if (!geometry?.available || !summary) return { matched: 0, total: 0, unmatched: 0 };
    let matched = 0;
    for (const b of summary.blocks) if (geometry.byBlock.has(b.blockNumber.trim())) matched += 1;
    return { matched, total: summary.blocks.length, unmatched: Math.max(0, summary.blocks.length - matched) };
  }, [geometry, summary]);

  const mappableBlocks = useMemo(
    () => (geometry?.available && summary ? summary.blocks.filter(b => geometry.byBlock.has(b.blockNumber.trim())) : []),
    [geometry, summary]
  );

  const handlePeriod = (p: CoveragePreset) => setPreset(p);

  const downloadCoverage = () => {
    if (!summary) return;
    exportBreakdownToExcel(
      summary.blocks.map(b => ({
        block: b.blockNumber,
        area: b.areaName || (b.unresolved ? 'Unresolved' : ''),
        governorate: b.governorate || 'Unknown',
        orders: b.orderCount,
        share_pct: Number((b.shareOfTotal * 100).toFixed(1)),
        dominant_branch: b.dominantBranchName || '',
        trend: b.trend
      })),
      [
        { key: 'block', label: 'Block' },
        { key: 'area', label: 'Area' },
        { key: 'governorate', label: 'Governorate' },
        { key: 'orders', label: 'Orders' },
        { key: 'share_pct', label: 'Share %', numFmt: '0.0' },
        { key: 'dominant_branch', label: 'Dominant branch' },
        { key: 'trend', label: 'Trend' }
      ],
      `Bahrain Block Coverage — ${range.from} → ${range.to}`,
      `Delivery_Coverage_${range.from}_${range.to}`
    ).catch(e => console.error(e));
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <section className="operational-panel p-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-100/60 p-1 rounded-lg border border-slate-200/50">
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => handlePeriod(p.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${preset === p.id ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold outline-none focus:border-brand/40" />
                <span className="text-xs font-bold text-slate-400">→</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold outline-none focus:border-brand/40" />
              </div>
            )}
            {!lockedBranchId && (
              <div className="w-52">
                <SearchableSelect
                  options={branches.map(b => ({ value: b.id, label: b.name, hint: b.code }))}
                  value={branchFilter}
                  onChange={setBranchFilter}
                  placeholder="All branches"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isModuleEnabled('excelExport') && (
              <button onClick={downloadCoverage} className="btn-secondary text-[10px] uppercase tracking-widest">
                <FileDown className="h-3.5 w-3.5" /> Excel
              </button>
            )}
            <button onClick={printReport} className="btn-secondary text-[10px] uppercase tracking-widest">
              <Printer className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>
      </section>

      <div className="hidden print:block">
        <h1 className="text-xl font-black">Bahrain Block Coverage — {range.from} → {range.to}</h1>
      </div>

      {/* Geometry availability notice */}
      {geometryStatus === 'loading' ? (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] font-bold leading-5 text-slate-700">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Loading Bahrain block geometry. The matrix fallback remains available if the map asset cannot be loaded.
          </span>
        </div>
      ) : geoAvailable ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 text-[11px] font-bold leading-5 text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Bahrain block geometry loaded for internal operational use. Geometry blocks: {geometry?.featureCount}.
            {summary && ` Served blocks mapped: ${geoMatch.matched}; served blocks without geometry: ${geoMatch.unmatched}.`}
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-[11px] font-bold leading-5 text-blue-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Bahrain block geometry is unavailable in this environment. Matrix view remains available for real
            recorded blocks without inventing geography.
            {geometry?.error ? ` Details: ${geometry.error}` : ''}
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand"></div>
        </div>
      ) : !summary ? (
        <p className="py-10 text-center text-xs font-bold text-slate-400">Could not load coverage data.</p>
      ) : (
        <>
          {/* Section tabs */}
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200/50 bg-slate-100/60 p-1 print:hidden">
            {([
              { id: 'overview', label: 'Overview', icon: LayoutDashboard, show: true },
              { id: 'matrix', label: 'Block Map', icon: MapPinned, show: true },
              { id: 'catchment', label: 'Branch Catchment', icon: Layers, show: true },
              { id: 'campaign', label: 'Campaign', icon: Target, show: advancedEnabled },
              { id: 'overlap', label: 'Overlap', icon: ShieldAlert, show: advancedEnabled },
              { id: 'capacity', label: 'Capacity', icon: AlertTriangle, show: advancedEnabled },
              { id: 'expansion', label: 'Expansion Review', icon: ArrowUpRight, show: advancedEnabled },
              { id: 'quality', label: 'Data Quality', icon: Info, show: true }
            ] as Array<{ id: CoverageSection; label: string; icon: React.ElementType; show: boolean }>)
              .filter(t => t.show)
              .map(t => (
                <button
                  key={t.id}
                  onClick={() => setSection(t.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold transition-all ${section === t.id ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <t.icon className="h-3.5 w-3.5" /> {t.label}
                </button>
              ))}
          </div>

          {/* KPI cards */}
          {section === 'overview' && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <KpiCard label="Total orders" value={String(summary.totalOrders)} sub={`${summary.talabatOrders} Talabat (no block)`} />
            <KpiCard label="Known block orders" value={String(summary.knownBlockOrders)} sub={`${summary.uniqueBlocksServed} unique blocks`} />
            <KpiCard label="Unknown block orders" value={String(summary.unknownBlockOrders)} sub="non-Talabat, no block #" />
            <KpiCard label="Unknown block rate" value={`${Math.round(summary.unknownBlockRate * 100)}%`} sub="of mappable orders" />
            <KpiCard label="Unique blocks served" value={String(summary.uniqueBlocksServed)} />
            <KpiCard
              label="Top block"
              value={summary.topBlock ? `#${summary.topBlock.blockNumber}` : '—'}
              sub={summary.topBlock ? `${summary.topBlock.orderCount} orders${summary.topBlock.areaName ? ` · ${summary.topBlock.areaName}` : ''}` : undefined}
            />
            <KpiCard
              label="Top serving branch"
              value={summary.topBranch ? summary.topBranch.branchName : '—'}
              sub={summary.topBranch ? `${summary.topBranch.orderCount} orders` : undefined}
            />
            <KpiCard label="Unresolved blocks" value={String(summary.unresolvedBlockOrders)} sub="block # not in directory" />
          </div>
          )}

          {section === 'matrix' && (
          <>
          {/* Coverage matrix / map grouped by governorate */}
          <section className="operational-panel p-4 md:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
              <MapPinned className="h-4 w-4 text-brand" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">
                  {geometryStatus === 'loading' || (geoAvailable && view === 'map') ? 'Bahrain block coverage map' : 'Bahrain block coverage matrix'}
                </h3>
              </div>
              {geoAvailable && (
                <div className="flex bg-slate-100/60 p-1 rounded-lg border border-slate-200/50 print:hidden">
                  <button
                    onClick={() => setView('map')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${view === 'map' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <MapIcon className="h-3.5 w-3.5" /> Map
                  </button>
                  <button
                    onClick={() => setView('matrix')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${view === 'matrix' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Grid3x3 className="h-3.5 w-3.5" /> Matrix
                  </button>
                </div>
              )}
            </div>

            {geometryStatus === 'loading' ? (
              <BlockCoverageMapLoading featureCount={geometry?.featureCount} />
            ) : geoAvailable && view === 'map' && geometry ? (
              <BlockCoverageMap
                dataset={geometry}
                blocks={mappableBlocks}
                maxOrders={maxBlockOrders}
                summary={summary}
                selectedBlock={selectedBlock}
                geometryStats={geoMatch}
                onSelect={setSelectedBlock}
                onOpenMatrix={() => setView('matrix')}
              />
            ) : summary.blocks.length === 0 ? (
              <p className="py-8 text-center text-xs font-bold text-slate-400">No located delivery orders in this period.</p>
            ) : (
              <div className="space-y-4">
                {GOV_ORDER.filter(g => blocksByGov.has(g)).map(gov => {
                  const govBlocks = (blocksByGov.get(gov) || []).slice().sort((a, b) => b.orderCount - a.orderCount);
                  const govMeta = summary.governorateCoverage.find(g => g.governorate === gov);
                  return (
                    <div key={gov}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{gov}</p>
                        <p className="text-[10px] font-bold text-slate-400">
                          {govMeta?.orderCount || 0} orders · {govMeta?.uniqueBlocks || govBlocks.length} blocks
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {govBlocks.map(block => {
                          const intensity = block.orderCount / maxBlockOrders;
                          const isSelected = selectedBlock?.blockNumber === block.blockNumber;
                          return (
                            <button
                              key={block.blockNumber}
                              onClick={() => setSelectedBlock(isSelected ? null : block)}
                              title={`Block ${block.blockNumber}${block.areaName ? ` · ${block.areaName}` : ''} — ${block.orderCount} orders`}
                              className={`flex min-w-[58px] flex-col items-center rounded-md border px-2 py-1.5 transition-all ${isSelected ? 'border-brand ring-2 ring-brand/20' : 'border-slate-200 hover:border-brand/40'} ${block.unresolved ? 'border-dashed' : ''}`}
                              style={{
                                backgroundColor: `rgba(var(--client-primary-rgb, 185 28 28) / ${0.08 + 0.62 * intensity})`,
                                color: intensity > 0.55 ? 'white' : '#334155'
                              }}
                            >
                              <span className="text-xs font-black tabular-nums">{block.blockNumber}</span>
                              <span className="text-[9px] font-bold opacity-90 tabular-nums">{block.orderCount}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selected block detail */}
            {selectedBlock && !(geoAvailable && view === 'map') && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      Block {selectedBlock.blockNumber}
                      {selectedBlock.areaName ? ` · ${selectedBlock.areaName}` : ''}
                      {selectedBlock.governorate ? ` · ${selectedBlock.governorate}` : ''}
                    </p>
                    <p className="text-[11px] font-bold text-slate-500">
                      {selectedBlock.orderCount} orders · {Math.round(selectedBlock.shareOfTotal * 100)}% of located deliveries
                      {selectedBlock.unresolved && ' · block not in directory'}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                    <TrendIcon trend={selectedBlock.trend} /> {selectedBlock.trend.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Branch breakdown</p>
                  {selectedBlock.branchBreakdown.map(b => (
                    <div key={b.branchId} className="flex items-center justify-between rounded-md bg-white px-3 py-1.5 text-xs font-bold">
                      <span className="text-slate-700">{b.branchName}</span>
                      <span className="text-slate-500 tabular-nums">{b.orderCount} orders</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Top + low blocks */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="operational-panel p-4 md:p-5">
              <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-700">Top served blocks</h3>
              <BlockTable blocks={summary.topBlocks} onSelect={setSelectedBlock} emptyLabel="No located orders." />
            </section>
            <section className="operational-panel p-4 md:p-5">
              <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-700">Low / weak-demand blocks</h3>
              {summary.lowBlocks.length === 0 ? (
                <p className="py-6 text-center text-xs font-bold text-slate-400">Not enough distinct blocks to rank weak demand.</p>
              ) : (
                <BlockTable blocks={summary.lowBlocks} onSelect={setSelectedBlock} emptyLabel="No data." />
              )}
            </section>
          </div>
          </>
          )}

          {section === 'catchment' && (
          <>
          {/* Branch coverage */}
          <section className="operational-panel p-4 md:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Branch delivery footprint</h3>
            </div>
            {summary.branchCoverage.length === 0 ? (
              <p className="py-6 text-center text-xs font-bold text-slate-400">No branch activity.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="py-2 pr-3">Branch</th>
                      <th className="py-2 pr-3 text-right">Orders</th>
                      <th className="py-2 pr-3 text-right">Blocks served</th>
                      <th className="py-2 pr-3 text-right">Unknown block</th>
                      <th className="py-2 pr-3 text-right">Top block</th>
                      <th className="py-2 pr-3 text-right">Outside gov.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {summary.branchCoverage.map(b => (
                      <tr key={b.branchId} className="hover:bg-slate-50/50">
                        <td className="py-2 pr-3 font-black text-slate-800">{b.branchName}</td>
                        <td className="py-2 pr-3 text-right font-bold tabular-nums">{b.orderCount}</td>
                        <td className="py-2 pr-3 text-right font-bold tabular-nums">{b.uniqueBlocksServed}</td>
                        <td className="py-2 pr-3 text-right font-bold tabular-nums">{b.unknownBlockOrders}</td>
                        <td className="py-2 pr-3 text-right font-bold tabular-nums">{b.topBlockNumber ? `#${b.topBlockNumber} (${b.topBlockOrders})` : '—'}</td>
                        <td className="py-2 pr-3 text-right font-bold tabular-nums">
                          {b.orderCount ? `${Math.round((b.outsideGovernorateOrders / b.orderCount) * 100)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {advancedEnabled && advanced && <BranchCatchmentSection items={advanced.branchCatchments} />}
          </>
          )}

          {section === 'overview' && (
          <>
          {/* Recommendations */}
          <section className="operational-panel p-4 md:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-brand" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Coverage insights</h3>
            </div>
            {summary.recommendedActions.length === 0 ? (
              <p className="py-6 text-center text-xs font-bold text-slate-400">No automatic insights for this period.</p>
            ) : (
              <div className="space-y-2">
                {summary.recommendedActions.map((rec, i) => (
                  <div key={i} className={`rounded-lg border p-3 ${REC_TONE[rec.type]}`}>
                    <div className="flex items-start gap-2">
                      {rec.type === 'data_quality_issue'
                        ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                        : <Package className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />}
                      <div>
                        <p className="text-xs font-black text-slate-800">{rec.title}</p>
                        <p className="mt-0.5 text-[11px] font-bold leading-5 text-slate-600">{rec.message}</p>
                        <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">→ {rec.recommendedAction}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          {advancedEnabled && advanced && <DemandTrendSection advanced={advanced} />}
          </>
          )}

          {section === 'campaign' && advancedEnabled && advanced && (
            <CampaignOpportunitiesSection
              items={advanced.campaignOpportunities}
              suppressed={summary.mappableOrders < 10 || summary.unknownBlockRate >= 0.4}
              canCreateTask={canCreateTask}
              onCreateTask={handleCreateTask}
              busyInsightId={busyInsightId}
            />
          )}

          {section === 'overlap' && advancedEnabled && advanced && (
            <BranchOverlapSection items={advanced.branchOverlaps} canCreateTask={canCreateTask} onCreateTask={handleCreateTask} busyInsightId={busyInsightId} />
          )}

          {section === 'capacity' && advancedEnabled && advanced && (
            <CapacityPressureSection items={advanced.capacityPressures} canCreateTask={canCreateTask} onCreateTask={handleCreateTask} busyInsightId={busyInsightId} />
          )}

          {section === 'expansion' && advancedEnabled && advanced && (
            <ExpansionReviewSection items={advanced.expansionCandidates} canCreateTask={canCreateTask} onCreateTask={handleCreateTask} busyInsightId={busyInsightId} />
          )}

          {section === 'quality' && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <KpiCard label="Unknown block orders" value={String(summary.unknownBlockOrders)} sub="non-Talabat, no block #" />
                <KpiCard label="Unknown block rate" value={`${Math.round(summary.unknownBlockRate * 100)}%`} sub="of mappable orders" />
                <KpiCard label="Unresolved blocks" value={String(summary.unresolvedBlockOrders)} sub="not in directory" />
                <KpiCard label="Talabat (no block)" value={String(summary.talabatOrders)} />
              </div>
              {advanced && <WhiteSpaceSection whiteSpace={advanced.whiteSpace} />}
              {advanced && <FieldAvailabilitySection advanced={advanced} />}
              {/* Data-quality recommendations */}
              {summary.recommendedActions.filter(r => r.type === 'data_quality_issue').length > 0 && (
                <section className="operational-panel p-4 md:p-5">
                  <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-700">Data quality issues</h3>
                  <div className="space-y-2">
                    {summary.recommendedActions.filter(r => r.type === 'data_quality_issue').map((rec, i) => (
                      <div key={i} className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                          <div>
                            <p className="text-xs font-black text-slate-800">{rec.title}</p>
                            <p className="mt-0.5 text-[11px] font-bold leading-5 text-slate-600">{rec.message}</p>
                            <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">→ {rec.recommendedAction}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

const BlockTable: React.FC<{ blocks: DeliveryBlockMetric[]; onSelect: (b: DeliveryBlockMetric) => void; emptyLabel: string }> = ({ blocks, onSelect, emptyLabel }) => {
  if (blocks.length === 0) return <p className="py-6 text-center text-xs font-bold text-slate-400">{emptyLabel}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
            <th className="py-2 pr-3">Block</th>
            <th className="py-2 pr-3">Area</th>
            <th className="py-2 pr-3 text-right">Orders</th>
            <th className="py-2 pr-3 text-right">Share</th>
            <th className="py-2 pr-3">Dominant branch</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {blocks.map(b => (
            <tr key={b.blockNumber} className="cursor-pointer hover:bg-slate-50/50" onClick={() => onSelect(b)}>
              <td className="py-2 pr-3 font-black text-slate-800 tabular-nums">#{b.blockNumber}</td>
              <td className="py-2 pr-3 text-xs font-bold text-slate-500">{b.areaName || (b.unresolved ? 'Unresolved' : '—')}</td>
              <td className="py-2 pr-3 text-right font-bold tabular-nums">{b.orderCount}</td>
              <td className="py-2 pr-3 text-right font-bold tabular-nums">{Math.round(b.shareOfTotal * 100)}%</td>
              <td className="py-2 pr-3 text-xs font-bold text-slate-500">{b.dominantBranchName || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
