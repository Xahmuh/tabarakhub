import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  AlertTriangle, ArrowUpRight, BarChart3, Building2, CheckCircle2, FileDown, Grid3x3, Info, Layers, LayoutDashboard, Lightbulb, Map as MapIcon, MapPinned, Package, Printer, ShieldAlert, Target, TrendingDown, TrendingUp
} from 'lucide-react';
import { deliveryCoverageService } from '../../services/deliveryCoverageService';
import { branchService } from '../../services/branchService';
import { branchDeliveryProfileService } from '../../services/branchDeliveryProfileService';
import { operationsTaskService } from '../command-center/operationsTaskService';
import {
  Branch, BranchDeliveryProfile, DeliveryAdvancedCoverage, DeliveryBlockMetric, DeliveryBlockZoneAnalysis, DeliveryCoverageRecommendation, DeliveryCoverageSummary, DeliveryZoneQualityMetrics, Governorate
} from '../../types';
import { SearchableSelect } from './components/SearchableSelect';
import { BlockCoverageMap, BlockCoverageMapLoading } from './components/BlockCoverageMap';
import {
  BranchCatchmentSection, BranchOverlapSection, CampaignOpportunitiesSection, CapacityPressureSection,
  CoverageTaskRequest, DemandTrendSection, ExpansionReviewSection, FieldAvailabilitySection, WhiteSpaceSection
} from './components/CoverageSections';
import { BlockGeometryDataset, calculateDistanceKm, classifyDistanceZone, getBlockCentroid, loadBahrainBlockGeometry } from './bahrainBlockGeometry';
import { exportBreakdownToExcel, printReport } from './exports';
import { isModuleEnabled } from '../../config/clientConfig';
import { formatBhd } from './utils';

type CoverageSection = 'overview' | 'matrix' | 'governorate' | 'catchment' | 'campaign' | 'overlap' | 'capacity' | 'expansion' | 'quality';

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

const formatMaybeBhd = (value: number | null | undefined) => value === null || value === undefined ? 'Unavailable' : formatBhd(value);
const formatMaybeNumber = (value: number | null | undefined, digits = 1) => value === null || value === undefined ? 'Unavailable' : value.toFixed(digits);
const formatPercent = (value: number | null | undefined) => value === null || value === undefined ? 'Unavailable' : `${value.toFixed(1)}%`;

const purchasePowerTone = (band: 'high' | 'medium' | 'low' | 'unavailable') => {
  if (band === 'high') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (band === 'medium') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (band === 'low') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-500';
};

const emptyZoneMetrics = (geometry?: BlockGeometryDataset | null): DeliveryZoneQualityMetrics => ({
  totalBranchProfiles: 0,
  mappedBranchMarkers: 0,
  unmappedBranchMarkers: 0,
  duplicateBranchBlockGroups: [],
  missingOriginBlock: 0,
  missingGeoJsonBlock: 0,
  servedCoreBlocks: 0,
  servedStandardBlocks: 0,
  servedExtendedBlocks: 0,
  servedOutsideRangeBlocks: 0,
  unmappedServedBlocks: 0,
  missingBranchProfiles: 0,
  servedBlocksMapped: 0,
  servedBlocksUnavailableZone: 0,
  totalGeometryBlocks: geometry?.featureCount || 0
});

const zoneLabel = (zone: DeliveryBlockZoneAnalysis['zone']) => zone.replace('_', ' ');

const zoneAction = (zone: DeliveryBlockZoneAnalysis['zone'], orders: number) => {
  if (zone === 'core') return orders >= 5 ? 'Strong natural service area. Maintain service quality.' : 'Core service area. Monitor quality and repeat demand.';
  if (zone === 'standard') return 'Normal delivery coverage. Monitor capacity.';
  if (zone === 'extended') return 'Extended coverage pressure. Review routing or nearby branch support.';
  if (zone === 'outside_range') return 'Coverage review candidate. Consider routing review, campaign test, or future expansion study.';
  return 'Distance unavailable because branch profile or block geometry is missing.';
};

interface DeliveryCoverageProps {
  /** Restrict the branch filter (supervisor/branch scopes); RLS enforces data scope regardless. */
  lockedBranchId?: string | null;
  /** Manager-only: allow creating operations tasks from insights. */
  canCreateTask?: boolean;
  /** Branch-facing coverage keeps the surface limited to overview + block map. */
  branchView?: boolean;
}

export const DeliveryCoverage: React.FC<DeliveryCoverageProps> = ({ lockedBranchId, canCreateTask = false, branchView = false }) => {
  const advancedEnabled = isModuleEnabled('deliveryCoverageAdvanced');
  const [preset, setPreset] = useState<CoveragePreset>('30d');
  const [customFrom, setCustomFrom] = useState(toDateKey(new Date()));
  const [customTo, setCustomTo] = useState(toDateKey(new Date()));
  const [branchFilter, setBranchFilter] = useState<string | null>(lockedBranchId || null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [summary, setSummary] = useState<DeliveryCoverageSummary | null>(null);
  const [advanced, setAdvanced] = useState<DeliveryAdvancedCoverage | null>(null);
  const [branchProfiles, setBranchProfiles] = useState<BranchDeliveryProfile[]>([]);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<DeliveryBlockMetric | null>(null);
  const [selectedGovernorate, setSelectedGovernorate] = useState<Governorate | 'Unknown' | null>(null);
  const [geometry, setGeometry] = useState<BlockGeometryDataset | null>(null);
  const [geometryStatus, setGeometryStatus] = useState<GeometryStatus>('loading');
  const [view, setView] = useState<'map' | 'matrix'>('matrix');
  const [section, setSection] = useState<CoverageSection>('overview');
  const [busyInsightId, setBusyInsightId] = useState<string | null>(null);

  const range = presetRange(preset, customFrom, customTo);
  const effectiveBranchFilter = lockedBranchId || branchFilter || null;
  const selectedBranch = useMemo(
    () => branches.find(branch => branch.id === effectiveBranchFilter) || null,
    [branches, effectiveBranchFilter]
  );
  const activeScopeLabel = selectedBranch
    ? `${selectedBranch.code} - ${selectedBranch.name}`
    : 'All branches';
  const branchOptions = useMemo(
    () => branches
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name))
      .map(branch => ({ value: branch.id, label: branch.name, hint: branch.code })),
    [branches]
  );
  const visibleBranchProfiles = useMemo(
    () => effectiveBranchFilter
      ? branchProfiles.filter(profile => profile.branchId === effectiveBranchFilter)
      : branchProfiles,
    [branchProfiles, effectiveBranchFilter]
  );
  const activeBranchProfiles = useMemo(
    () => visibleBranchProfiles.filter(profile => profile.isDeliveryEnabled !== false),
    [visibleBranchProfiles]
  );

  useEffect(() => {
    branchService.list()
      .then(list => setBranches(list.filter(b => b.role === 'branch')))
      .catch(e => console.error('Coverage branch load failed', e));
  }, []);

  useEffect(() => {
    if (lockedBranchId) setBranchFilter(lockedBranchId);
  }, [lockedBranchId]);

  useEffect(() => {
    let cancelled = false;
    branchDeliveryProfileService.listBranchDeliveryProfiles()
      .then(list => {
        if (!cancelled) {
          setBranchProfiles(list);
          setProfileLoadError(null);
        }
      })
      .catch((error: any) => {
        if (!cancelled) {
          setBranchProfiles([]);
          setProfileLoadError(error?.message || 'Could not load branch delivery profiles.');
        }
      });
    return () => { cancelled = true; };
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
    setSelectedGovernorate(null);
    deliveryCoverageService.getDeliveryCoverageBundle({
      dateFrom: range.from,
      dateTo: range.to,
      branchId: effectiveBranchFilter || undefined
    })
      .then(bundle => { if (!cancelled) { setSummary(bundle.summary); setAdvanced(bundle.advanced); } })
      .catch(e => { console.error('Coverage load failed', e); if (!cancelled) { setSummary(null); setAdvanced(null); } })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [range.from, range.to, effectiveBranchFilter]);

  const coverageSections = useMemo(
    () => ([
      { id: 'overview', label: 'Overview', icon: LayoutDashboard, show: true },
      { id: 'matrix', label: 'Block Map', icon: MapPinned, show: true },
      { id: 'governorate', label: 'Governorate KPIs', icon: BarChart3, show: !branchView },
      { id: 'catchment', label: 'Branch Catchment', icon: Layers, show: !branchView },
      { id: 'campaign', label: 'Campaign', icon: Target, show: !branchView && advancedEnabled },
      { id: 'overlap', label: 'Overlap', icon: ShieldAlert, show: !branchView && advancedEnabled },
      { id: 'capacity', label: 'Capacity', icon: AlertTriangle, show: !branchView && advancedEnabled },
      { id: 'expansion', label: 'Expansion Review', icon: ArrowUpRight, show: !branchView && advancedEnabled },
      { id: 'quality', label: 'Data Quality', icon: Info, show: !branchView }
    ] as Array<{ id: CoverageSection; label: string; icon: React.ElementType; show: boolean }>).filter(item => item.show),
    [advancedEnabled, branchView]
  );

  useEffect(() => {
    if (!coverageSections.some(item => item.id === section)) {
      setSection('overview');
    }
  }, [coverageSections, section]);

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

  const selectedGovernorateBranchRows = useMemo(
    () => summary?.branchGovernoratePerformanceKpis
      .filter(row => !selectedGovernorate || row.governorate === selectedGovernorate)
      .slice(0, 50) || [],
    [selectedGovernorate, summary]
  );

  const topServingBranchesForGovernorate = useMemo(() => {
    if (!selectedGovernorate || !summary) return [];
    return summary.branchGovernoratePerformanceKpis
      .filter(row => row.governorate === selectedGovernorate)
      .slice()
      .sort((a, b) => b.ordersCount - a.ordersCount)
      .slice(0, 5);
  }, [selectedGovernorate, summary]);

  const geoAvailable = geometryStatus === 'available' && !!geometry?.available;

  useEffect(() => {
    if (branchView && geoAvailable && view !== 'map') {
      setView('map');
    }
  }, [branchView, geoAvailable, view]);

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

  const profileByBranch = useMemo(
    () => new Map(activeBranchProfiles.map(profile => [profile.branchId, profile])),
    [activeBranchProfiles]
  );

  const zoneAnalysis = useMemo((): { metrics: DeliveryZoneQualityMetrics; byBlock: Map<string, DeliveryBlockZoneAnalysis> } => {
    const metrics = emptyZoneMetrics(geometry);
    const byBlock = new Map<string, DeliveryBlockZoneAnalysis>();
    if (!summary) return { metrics, byBlock };

    metrics.totalBranchProfiles = activeBranchProfiles.length;
    metrics.missingBranchProfiles = summary.branchCoverage.filter(branch => !profileByBranch.has(branch.branchId)).length;

    const duplicateMap = new Map<string, string[]>();
    for (const profile of activeBranchProfiles) {
      const block = profile.originBlockNumber?.trim();
      if (!block) {
        metrics.missingOriginBlock += 1;
        metrics.unmappedBranchMarkers += 1;
        continue;
      }
      const group = duplicateMap.get(block) || [];
      group.push(profile.branchCode || profile.branchName || profile.branchId.slice(0, 6));
      duplicateMap.set(block, group);

      if (geometry?.available && getBlockCentroid(geometry, block)) {
        metrics.mappedBranchMarkers += 1;
      } else {
        metrics.unmappedBranchMarkers += 1;
        if (geometry?.available) metrics.missingGeoJsonBlock += 1;
      }
    }

    metrics.duplicateBranchBlockGroups = [...duplicateMap.entries()]
      .filter(([, codes]) => codes.length > 1)
      .map(([originBlockNumber, branchCodes]) => ({ originBlockNumber, branchCodes }));

    for (const block of summary.blocks) {
      const servedPoint = geometry?.available ? getBlockCentroid(geometry, block.blockNumber) : null;
      if (servedPoint) metrics.servedBlocksMapped += 1;
      else metrics.unmappedServedBlocks += 1;

      const profile = block.dominantBranchId ? profileByBranch.get(block.dominantBranchId) : undefined;
      const branchPoint = profile && geometry?.available ? getBlockCentroid(geometry, profile.originBlockNumber) : null;
      const distanceKm = calculateDistanceKm(branchPoint, servedPoint);
      const zone = classifyDistanceZone(distanceKm, profile);

      if (zone === 'core') metrics.servedCoreBlocks += 1;
      else if (zone === 'standard') metrics.servedStandardBlocks += 1;
      else if (zone === 'extended') metrics.servedExtendedBlocks += 1;
      else if (zone === 'outside_range') metrics.servedOutsideRangeBlocks += 1;
      else metrics.servedBlocksUnavailableZone += 1;

      const reason = !profile
        ? 'branch profile missing'
        : !branchPoint
          ? 'branch origin block not mapped'
          : !servedPoint
            ? 'served block not mapped'
            : undefined;

      byBlock.set(block.blockNumber, {
        blockNumber: block.blockNumber,
        branchId: block.dominantBranchId,
        branchName: block.dominantBranchName,
        branchCode: profile?.branchCode || undefined,
        originBlockNumber: profile?.originBlockNumber,
        zone,
        distanceKm,
        reason,
        recommendedAction: reason ? 'Distance unavailable because block geometry or branch profile is missing.' : zoneAction(zone, block.orderCount)
      });
    }

    return { metrics, byBlock };
  }, [activeBranchProfiles, geometry, profileByBranch, summary]);

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
      `Bahrain Block Coverage - ${activeScopeLabel} - ${range.from} to ${range.to}`,
      `Delivery_Coverage_${activeScopeLabel.replace(/[^a-z0-9]+/gi, '_')}_${range.from}_${range.to}`
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
              <div className="w-full min-w-[16rem] sm:w-72">
                <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    <Building2 className="h-3.5 w-3.5 text-brand" />
                    Branch scope
                  </span>
                  <span className="max-w-[9rem] truncate text-right text-[10px] font-black uppercase tracking-wider text-slate-500">
                    {selectedBranch?.code || 'All'}
                  </span>
                </div>
                <SearchableSelect
                  options={branchOptions}
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
        <h1 className="text-xl font-black">Bahrain Block Coverage - {activeScopeLabel} - {range.from} to {range.to}</h1>
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

      {profileLoadError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] font-bold leading-5 text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Branch delivery profiles are unavailable: {profileLoadError}. Branch markers and zone detection will stay unavailable until the local migration is applied to the target Supabase project.
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
            {coverageSections.map(t => (
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
              {geoAvailable && !branchView && (
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
                branchProfiles={activeBranchProfiles}
                blockZoneAnalysis={zoneAnalysis.byBlock}
                zoneMetrics={zoneAnalysis.metrics}
                summary={summary}
                selectedBlock={selectedBlock}
                highlightedGovernorate={selectedGovernorate}
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
                {zoneAnalysis.byBlock.get(selectedBlock.blockNumber) && (
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                    {(() => {
                      const analysis = zoneAnalysis.byBlock.get(selectedBlock.blockNumber)!;
                      return (
                        <>
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Dominant branch zone</p>
                          <p className="mt-1 text-xs font-bold leading-5 text-blue-900">
                            {analysis.branchName || 'Unknown branch'}{analysis.branchCode ? ` (${analysis.branchCode})` : ''} | {zoneLabel(analysis.zone)}
                            {analysis.distanceKm !== null && analysis.distanceKm !== undefined ? ` | approx. ${analysis.distanceKm.toFixed(1)} km` : ''}
                          </p>
                          <p className="mt-1 text-[11px] font-bold leading-5 text-blue-800">
                            {analysis.reason ? `${analysis.reason}. ` : ''}{analysis.recommendedAction}
                          </p>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Top + low blocks */}
          {!branchView && (
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
          )}
          </>
          )}

          {section === 'governorate' && (
          <div className="space-y-4">
            <section className="operational-panel p-4 md:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-brand" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Governorate KPIs</h3>
                  </div>
                  <p className="mt-1 max-w-3xl text-xs font-bold leading-5 text-slate-500">
                    Purchase Power Proxy is based on internal delivery orders and order value only. It is not population-adjusted economic purchasing power.
                  </p>
                </div>
                {selectedGovernorate && (
                  <button
                    type="button"
                    onClick={() => setSelectedGovernorate(null)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-brand/30 hover:text-brand"
                  >
                    Clear governorate
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <KpiCard label="Orders analyzed" value={String(summary.governorateKpiQuality.totalOrdersAnalyzed)} />
                <KpiCard
                  label="Mapped governorate"
                  value={String(summary.governorateKpiQuality.ordersWithMappedGovernorate)}
                  sub={`${summary.governorateKpiQuality.ordersWithUnmappedGovernorate} unmapped`}
                />
                <KpiCard
                  label="Orders with value"
                  value={String(summary.governorateKpiQuality.ordersWithValue)}
                  sub={`${summary.governorateKpiQuality.ordersMissingValue} missing value`}
                />
                <KpiCard
                  label="Mapped blocks"
                  value={String(summary.governorateKpiQuality.blocksWithGovernorateMapping)}
                  sub={`${summary.governorateKpiQuality.blocksWithoutGovernorateMapping} without mapping`}
                />
              </div>

              {summary.governorateKpiQuality.ordersMissingValue > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">
                  Value-based KPIs may be incomplete because some orders do not have order value.
                </div>
              )}

              {summary.governoratePerformanceKpis.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-black text-slate-700">Governorate mapping is unavailable for the selected orders.</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-slate-400">
                    Add or fix block governorate mappings in Delivery Settings before using governorate KPIs.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {summary.governoratePerformanceKpis.map(row => (
                      <button
                        key={row.governorate}
                        type="button"
                        onClick={() => setSelectedGovernorate(selectedGovernorate === row.governorate ? null : row.governorate)}
                        className={`rounded-lg border px-3 py-2 text-left transition ${
                          selectedGovernorate === row.governorate
                            ? 'border-brand bg-brand text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-brand/30 hover:text-brand'
                        }`}
                      >
                        <span className="block text-[10px] font-black uppercase tracking-widest">{row.governorate}</span>
                        <span className="mt-0.5 block text-xs font-bold tabular-nums">{row.ordersCount} orders | {formatMaybeBhd(row.totalValue)}</span>
                      </button>
                    ))}
                  </div>

                  {selectedGovernorate && (
                    <div className="mt-4 rounded-lg border border-brand/10 bg-brand/5 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-brand">Top serving branches in {selectedGovernorate}</p>
                      {topServingBranchesForGovernorate.length === 0 ? (
                        <p className="mt-2 text-xs font-bold text-slate-500">No branch activity for this governorate in the selected scope.</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {topServingBranchesForGovernorate.map(row => (
                            <span key={`${row.branchId}:${row.governorate}`} className="rounded-md border border-white bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-700 shadow-sm">
                              {row.branchCode} | {row.ordersCount} orders | {formatPercent(row.governorateOrderSharePercent)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="operational-panel p-4 md:p-5">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-brand" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Governorate Performance</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="py-2 pr-3">Governorate</th>
                      <th className="py-2 pr-3 text-right">Orders</th>
                      <th className="py-2 pr-3 text-right">Total value</th>
                      <th className="py-2 pr-3 text-right">Avg value</th>
                      <th className="py-2 pr-3 text-right">Blocks</th>
                      <th className="py-2 pr-3 text-right">Value / block</th>
                      <th className="py-2 pr-3 text-right">Orders / block</th>
                      <th className="py-2 pr-3 text-right">Purchase Power Proxy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {summary.governoratePerformanceKpis.map(row => (
                      <tr
                        key={row.governorate}
                        className={`cursor-pointer hover:bg-slate-50/50 ${selectedGovernorate === row.governorate ? 'bg-brand/5' : ''}`}
                        onClick={() => setSelectedGovernorate(selectedGovernorate === row.governorate ? null : row.governorate)}
                      >
                        <td className="py-2 pr-3 font-black text-slate-800">{row.governorate}</td>
                        <td className="py-2 pr-3 text-right font-bold tabular-nums">{row.ordersCount}</td>
                        <td className="py-2 pr-3 text-right font-bold tabular-nums">{formatMaybeBhd(row.totalValue)}</td>
                        <td className="py-2 pr-3 text-right font-bold tabular-nums">{formatMaybeBhd(row.averageOrderValue)}</td>
                        <td className="py-2 pr-3 text-right font-bold tabular-nums">{row.servedBlocksCount}</td>
                        <td className="py-2 pr-3 text-right font-bold tabular-nums">{formatMaybeBhd(row.valuePerServedBlock)}</td>
                        <td className="py-2 pr-3 text-right font-bold tabular-nums">{formatMaybeNumber(row.ordersPerServedBlock)}</td>
                        <td className="py-2 pr-3 text-right">
                          <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${purchasePowerTone(row.purchasePowerBand)}`}>
                            {row.purchasePowerProxyScore === null ? 'Unavailable' : `${row.purchasePowerBand} | ${row.purchasePowerProxyScore}`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="operational-panel p-4 md:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-brand" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Branch Performance per Governorate</h3>
                </div>
                {selectedGovernorate && (
                  <span className="rounded-md border border-brand/10 bg-brand/5 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                    Filtered: {selectedGovernorate}
                  </span>
                )}
              </div>
              {selectedGovernorateBranchRows.length === 0 ? (
                <p className="py-6 text-center text-xs font-bold text-slate-400">No branch governorate activity for the selected scope.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <th className="py-2 pr-3">Branch</th>
                        <th className="py-2 pr-3">Governorate</th>
                        <th className="py-2 pr-3 text-right">Orders</th>
                        <th className="py-2 pr-3 text-right">Total value</th>
                        <th className="py-2 pr-3 text-right">Avg value</th>
                        <th className="py-2 pr-3 text-right">Blocks</th>
                        <th className="py-2 pr-3 text-right">Branch order share</th>
                        <th className="py-2 pr-3 text-right">Gov order share</th>
                        <th className="py-2 pr-3 text-right">Branch value share</th>
                        <th className="py-2 pr-3 text-right">Gov value share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {selectedGovernorateBranchRows.map(row => (
                        <tr key={`${row.branchId}:${row.governorate}`} className="hover:bg-slate-50/50">
                          <td className="py-2 pr-3">
                            <p className="font-black text-slate-800">{row.branchCode}</p>
                            <p className="text-[10px] font-bold text-slate-400">{row.branchName}</p>
                          </td>
                          <td className="py-2 pr-3 text-xs font-bold text-slate-500">{row.governorate}</td>
                          <td className="py-2 pr-3 text-right font-bold tabular-nums">{row.ordersCount}</td>
                          <td className="py-2 pr-3 text-right font-bold tabular-nums">{formatMaybeBhd(row.totalValue)}</td>
                          <td className="py-2 pr-3 text-right font-bold tabular-nums">{formatMaybeBhd(row.averageOrderValue)}</td>
                          <td className="py-2 pr-3 text-right font-bold tabular-nums">{row.servedBlocksCount}</td>
                          <td className="py-2 pr-3 text-right font-bold tabular-nums">{formatPercent(row.branchOrderSharePercent)}</td>
                          <td className="py-2 pr-3 text-right font-bold tabular-nums">{formatPercent(row.governorateOrderSharePercent)}</td>
                          <td className="py-2 pr-3 text-right font-bold tabular-nums">{formatPercent(row.branchValueSharePercent)}</td>
                          <td className="py-2 pr-3 text-right font-bold tabular-nums">{formatPercent(row.governorateValueSharePercent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
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

          {section === 'overview' && !branchView && (
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
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <KpiCard label="Branch profiles" value={String(zoneAnalysis.metrics.totalBranchProfiles)} sub={`${zoneAnalysis.metrics.mappedBranchMarkers} mapped markers`} />
                <KpiCard label="Unmapped markers" value={String(zoneAnalysis.metrics.unmappedBranchMarkers)} sub={`${zoneAnalysis.metrics.missingGeoJsonBlock} missing GeoJSON block`} />
                <KpiCard label="Outside range blocks" value={String(zoneAnalysis.metrics.servedOutsideRangeBlocks)} sub="centroid-based" />
                <KpiCard label="Unavailable zones" value={String(zoneAnalysis.metrics.servedBlocksUnavailableZone)} sub={`${zoneAnalysis.metrics.missingBranchProfiles} missing branch profiles`} />
                <KpiCard label="Core zone blocks" value={String(zoneAnalysis.metrics.servedCoreBlocks)} />
                <KpiCard label="Standard zone blocks" value={String(zoneAnalysis.metrics.servedStandardBlocks)} />
                <KpiCard label="Extended zone blocks" value={String(zoneAnalysis.metrics.servedExtendedBlocks)} />
                <KpiCard label="Geometry blocks" value={String(zoneAnalysis.metrics.totalGeometryBlocks)} sub={`${zoneAnalysis.metrics.servedBlocksMapped} served blocks mapped`} />
              </div>
              {zoneAnalysis.metrics.duplicateBranchBlockGroups.length > 0 && (
                <section className="operational-panel p-4 md:p-5">
                  <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-700">Duplicate branch origin blocks</h3>
                  <div className="flex flex-wrap gap-2">
                    {zoneAnalysis.metrics.duplicateBranchBlockGroups.map(group => (
                      <span key={group.originBlockNumber} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
                        Block {group.originBlockNumber}: {group.branchCodes.join(', ')}
                      </span>
                    ))}
                  </div>
                </section>
              )}
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
