import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Crosshair,
  Grid3x3,
  Info,
  MapPinned,
  MousePointer2,
  Navigation,
  RotateCcw,
  Search,
  TrendingDown,
  TrendingUp,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2
} from 'lucide-react';
import {
  BranchDeliveryProfile,
  DeliveryBlock,
  DeliveryBlockMetric,
  DeliveryBlockZoneAnalysis,
  DeliveryCoverageRecommendation,
  DeliveryCoverageSummary,
  DeliveryZoneQualityMetrics,
  NoOrderBlockAnalysis,
  NoOrderBlockClassification
} from '../../../types';
import { jenks } from 'simple-statistics';
import { BlockGeometryDataset, GeoPoint, getBranchMarkerPoint } from '../bahrainBlockGeometry';
import { SearchableSelect, SelectOption } from './SearchableSelect';
import { LEGACY_BLOCK_AREA_NAMES, LEGACY_BLOCK_PHARMACY_MAP } from '../../block-analyzer/legacyCoverageData';

/**
 * Enterprise Bahrain block coverage map.
 *
 * Renders the real block polygons from the local GeoJSON asset with no map
 * provider, no tiles, and no invented geography. Blocks with no orders remain
 * visible as neutral geometry; served blocks are colored by real order volume.
 */

interface BlockCoverageMapProps {
  dataset: BlockGeometryDataset;
  blocks: DeliveryBlockMetric[];
  branchProfiles?: BranchDeliveryProfile[];
  blockZoneAnalysis?: Map<string, DeliveryBlockZoneAnalysis>;
  zoneMetrics?: DeliveryZoneQualityMetrics;
  summary: DeliveryCoverageSummary;
  selectedBlock: DeliveryBlockMetric | null;
  highlightedGovernorate?: string | null;
  geometryStats: {
    matched: number;
    total: number;
    unmatched: number;
  };
  compact?: boolean;
  compactMapHeightClass?: string;
  noOrderAnalysis?: Map<string, NoOrderBlockAnalysis>;
  showNoOrdersClassification?: boolean;
  onToggleNoOrdersClassification?: () => void;
  directoryBlocks?: DeliveryBlock[];
  onSelect: (block: DeliveryBlockMetric) => void;
  onOpenMatrix?: () => void;
}

interface BlockCoverageMapLoadingProps {
  featureCount?: number;
}

interface BlockCoverageMapUnavailableProps {
  error?: string;
}

const VIEW_W = 760;
const VIEW_H = 760;
const PAD = 18;
const MAP_BASE_COLOR = '#f9eee9';
const MAP_BOUNDARY_COLOR = '#4b5563';
const MAP_ACTIVE_BOUNDARY_COLOR = '#374151';
const MAP_SELECTED_COLOR = '#111827';

type Ring = Array<[number, number]>;

type HoverInfo = {
  blockNumber: string;
  areaName?: string | null;
  orderCount: number;
  shareOfTotal?: number;
  percentileRank?: string;
  demandTierLabel?: string;
  dominantBranchName?: string;
  zoneLabel?: string;
  noOrderInfo?: {
    classification: NoOrderBlockClassification;
    competitorCount: number;
    competitors: string[];
  };
  x: number;
  y: number;
};

type PathRow = {
  blockNumber: string;
  block?: DeliveryBlockMetric;
  d: string;
  bbox: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
};

type Projection = {
  scale: number;
  project: (point: GeoPoint) => { x: number; y: number };
};

type BranchMarkerRow = {
  key: string;
  profile: BranchDeliveryProfile;
  originBlockNumber: string;
  x: number;
  y: number;
  markerX: number;
  markerY: number;
  duplicateCount: number;
  duplicateIndex: number;
};

type LegendItem = {
  label: string;
  color: string;
  border: string;
  selected?: boolean;
  dashed?: boolean;
};

type MapColorMode = 'orders' | 'zones';

type MapViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const ringsOf = (geometry: any): Ring[] => {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates as Ring[];
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates as Ring[][]).flat();
  return [];
};

const formatPct = (value: number) => `${Math.round(value * 100)}%`;

const trendLabel = (trend?: DeliveryBlockMetric['trend']) => {
  if (!trend) return 'No trend';
  return trend.replace('_', ' ');
};

const compactBranchCode = (profile: BranchDeliveryProfile) => {
  const rawCode = (profile.branchCode || '').trim();
  const numericCode = rawCode.match(/\d+/g)?.join('');
  const fallback = rawCode || (profile.branchName || 'B').trim();
  const code = numericCode || fallback || 'B';
  return code.length > 4 ? code.slice(-4) : code;
};

const TrendPill: React.FC<{ trend: DeliveryBlockMetric['trend'] }> = ({ trend }) => {
  const icon = trend === 'up'
    ? <TrendingUp className="h-3.5 w-3.5" />
    : trend === 'down'
      ? <TrendingDown className="h-3.5 w-3.5" />
      : <BarChart3 className="h-3.5 w-3.5" />;
  const tone = trend === 'up'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : trend === 'down'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-slate-200 bg-white text-slate-500';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-black uppercase ${tone}`}>
      {icon}
      {trendLabel(trend)}
    </span>
  );
};

export interface DemandThresholds {
  b1: number;
  b2: number;
  b3: number;
  b4: number;
  max: number;
  uniqueCount: number;
  q1: number;
  q2: number;
  q3: number;
}

export const DEMAND_COLORS = {
  none: {
    label: 'No orders',
    fill: '#f1f5f9',
    hoverFill: '#e2e8f0',
    stroke: '#cbd5e1'
  },
  low: {
    label: 'Low',
    fill: '#22c55e',
    hoverFill: '#16a34a',
    stroke: '#15803d'
  },
  medium: {
    label: 'Medium',
    fill: '#0ea5e9',
    hoverFill: '#0284c7',
    stroke: '#0369a1'
  },
  high: {
    label: 'High',
    fill: '#f59e0b',
    hoverFill: '#d97706',
    stroke: '#b45309'
  },
  very_high: {
    label: 'Very high',
    fill: '#ef4444',
    hoverFill: '#dc2626',
    stroke: '#b91c1c'
  },
  hotspot: {
    label: 'Hotspot',
    fill: '#7c3aed',
    hoverFill: '#6d28d9',
    stroke: '#5b21b6'
  },
  selected: {
    label: 'Selected',
    fill: '#09090b',
    hoverFill: '#18181b',
    stroke: '#000000'
  }
};

export const NO_ORDERS_COLORS = {
  whiteSpace: {
    label: 'White space (0 competitors)',
    fill: '#a7f3d0',
    hoverFill: '#6ee7b7',
    stroke: '#059669'
  },
  contested: {
    label: 'Contested (1–2 competitors)',
    fill: '#fed7aa',
    hoverFill: '#fdba74',
    stroke: '#ea580c'
  },
  saturated: {
    label: 'Saturated (3+ competitors)',
    fill: '#fecaca',
    hoverFill: '#fca5a5',
    stroke: '#dc2626'
  },
  outsideArea: {
    label: 'Outside service area',
    fill: '#e2e8f0',
    hoverFill: '#cbd5e1',
    stroke: '#64748b'
  }
};

/**
 * Computes demand tier thresholds using Jenks Natural Breaks Optimization (Fisher-Jenks).
 *
 * WHY JENKS OVER FIXED PERCENTILES:
 * Delivery order distributions are heavy-tailed — the vast majority of active blocks
 * receive 1-8 orders, while a tiny cluster of peak blocks drives 40-100+ orders.
 * Fixed percentile cutoffs (e.g. p25, p50, p75) leave the top tier unbounded,
 * placing a 10-order block and a 100-order block in the same bucket and destroying
 * visual contrast where it matters most.
 *
 * Jenks Natural Breaks minimizes within-class variance while maximizing between-class
 * variance. It detects natural gaps in the distribution and dynamically adapts to any
 * time filter (day/week/month) without arbitrary hand-tuned cutoffs, clearly separating
 * true operational hotspots ("Peak Demand") from moderately active blocks.
 */
export const computeDemandThresholds = (blocks: DeliveryBlockMetric[]): DemandThresholds | null => {
  const counts = blocks
    .map(b => b.orderCount)
    .filter(c => c > 0)
    .sort((a, b) => a - b);

  if (counts.length === 0) {
    return null;
  }

  const unique = [...new Set(counts)].sort((a, b) => a - b);
  const max = unique[unique.length - 1];

  // Edge case 3: Single active block or all active blocks share the same order count
  if (unique.length === 1) {
    return {
      b1: max,
      b2: max,
      b3: max,
      b4: max,
      max,
      uniqueCount: 1,
      q1: max,
      q2: max,
      q3: max
    };
  }

  // Edge case 2: Fewer distinct values than 5 classes
  // Fall back to as many classes as distinct values, collapsing unused top tiers.
  if (unique.length === 2) {
    const b1 = unique[0];
    return {
      b1,
      b2: b1,
      b3: b1,
      b4: b1,
      max,
      uniqueCount: 2,
      q1: b1,
      q2: b1,
      q3: b1
    };
  }

  if (unique.length === 3) {
    const b1 = unique[0];
    const b2 = unique[1];
    return {
      b1,
      b2,
      b3: b2,
      b4: b2,
      max,
      uniqueCount: 3,
      q1: b1,
      q2: b2,
      q3: b2
    };
  }

  if (unique.length === 4) {
    const b1 = unique[0];
    const b2 = unique[1];
    const b3 = unique[2];
    return {
      b1,
      b2,
      b3,
      b4: b3,
      max,
      uniqueCount: 4,
      q1: b1,
      q2: b2,
      q3: b3
    };
  }

  // 5 or more unique values: compute 5 natural break classes using Fisher-Jenks
  const rawBreaks = jenks(counts, 5);
  if (!rawBreaks || rawBreaks.length < 6) {
    return {
      b1: unique[0],
      b2: unique[1],
      b3: unique[2],
      b4: unique[3],
      max,
      uniqueCount: unique.length,
      q1: unique[0],
      q2: unique[1],
      q3: unique[2]
    };
  }

  // rawBreaks is [min, r1, r2, r3, r4, max], where r1..r4 are the lower bounds of classes 2..5.
  // Upper bounds for classes 1..4 are candidate values before each lower bound.
  let b1 = Math.round(rawBreaks[1] - 1);
  let b2 = Math.round(rawBreaks[2] - 1);
  let b3 = Math.round(rawBreaks[3] - 1);
  let b4 = Math.round(rawBreaks[4] - 1);

  // Force each class's lower bound to be at least 1 greater than previous class's upper bound,
  // ensuring strictly increasing integer boundaries: 1 <= b1 < b2 < b3 < b4 < max
  b1 = Math.max(1, b1);
  b2 = Math.max(b1 + 1, b2);
  b3 = Math.max(b2 + 1, b3);
  b4 = Math.max(b3 + 1, b4);

  // Ensure Hotspot tier (b4 + 1 to max) is strictly non-empty
  if (b4 >= max) {
    b4 = max - 1;
    if (b3 >= b4) b3 = b4 - 1;
    if (b2 >= b3) b2 = b3 - 1;
    if (b1 >= b2) b1 = b2 - 1;
  }

  return {
    b1,
    b2,
    b3,
    b4,
    max,
    uniqueCount: unique.length,
    q1: b1,
    q2: b2,
    q3: b3
  };
};

export const computeBlockPercentileRank = (
  orderCount: number,
  allBlocks: DeliveryBlockMetric[]
): { percentilePct: number; rankLabel: string } | null => {
  if (orderCount <= 0) return null;
  const activeCounts = allBlocks
    .map(b => b.orderCount)
    .filter(c => c > 0)
    .sort((a, b) => b - a);
  if (activeCounts.length === 0) return null;

  const strictlyGreater = activeCounts.filter(c => c > orderCount).length;
  const topPct = Math.max(1, Math.round(((strictlyGreater + 1) / activeCounts.length) * 100));
  return {
    percentilePct: topPct,
    rankLabel: `Top ${topPct}%`
  };
};

export const activityTone = (orders: number, thresholds: DemandThresholds | null) => {
  if (!thresholds || orders <= 0) return DEMAND_COLORS.none;
  const { uniqueCount, b1, b2, b3, b4 } = thresholds;

  if (uniqueCount <= 1) return DEMAND_COLORS.low;

  if (uniqueCount === 2) {
    if (orders <= b1) return DEMAND_COLORS.low;
    return DEMAND_COLORS.hotspot;
  }

  if (uniqueCount === 3) {
    if (orders <= b1) return DEMAND_COLORS.low;
    if (orders <= b2) return DEMAND_COLORS.medium;
    return DEMAND_COLORS.hotspot;
  }

  if (uniqueCount === 4) {
    if (orders <= b1) return DEMAND_COLORS.low;
    if (orders <= b2) return DEMAND_COLORS.medium;
    if (orders <= b3) return DEMAND_COLORS.high;
    return DEMAND_COLORS.hotspot;
  }

  // 5 or more unique values (full 5-tier Jenks spectrum)
  if (orders <= b1) return DEMAND_COLORS.low;
  if (orders <= b2) return DEMAND_COLORS.medium;
  if (orders <= b3) return DEMAND_COLORS.high;
  if (orders <= b4) return DEMAND_COLORS.very_high;
  return DEMAND_COLORS.hotspot;
};

export const computeDemandLegendItems = (demandThresholds: DemandThresholds | null): LegendItem[] => {
  if (!demandThresholds) {
    return [
      { label: 'No orders', color: DEMAND_COLORS.none.fill, border: DEMAND_COLORS.none.stroke },
      { label: 'Selected', color: DEMAND_COLORS.selected.fill, border: DEMAND_COLORS.selected.stroke, selected: true }
    ];
  }

  const { b1, b2, b3, b4, max, uniqueCount } = demandThresholds;

  if (uniqueCount <= 1) {
    return [
      { label: 'No orders', color: DEMAND_COLORS.none.fill, border: DEMAND_COLORS.none.stroke },
      { label: `Served (${max || 1})`, color: DEMAND_COLORS.low.fill, border: DEMAND_COLORS.low.stroke },
      { label: 'Selected', color: DEMAND_COLORS.selected.fill, border: DEMAND_COLORS.selected.stroke, selected: true }
    ];
  }

  if (uniqueCount === 2) {
    return [
      { label: 'No orders', color: DEMAND_COLORS.none.fill, border: DEMAND_COLORS.none.stroke },
      { label: `Low (${b1})`, color: DEMAND_COLORS.low.fill, border: DEMAND_COLORS.low.stroke },
      { label: `Hotspot (${max})`, color: DEMAND_COLORS.hotspot.fill, border: DEMAND_COLORS.hotspot.stroke },
      { label: 'Selected', color: DEMAND_COLORS.selected.fill, border: DEMAND_COLORS.selected.stroke, selected: true }
    ];
  }

  if (uniqueCount === 3) {
    return [
      { label: 'No orders', color: DEMAND_COLORS.none.fill, border: DEMAND_COLORS.none.stroke },
      { label: `Low (${b1})`, color: DEMAND_COLORS.low.fill, border: DEMAND_COLORS.low.stroke },
      { label: `Medium (${b2})`, color: DEMAND_COLORS.medium.fill, border: DEMAND_COLORS.medium.stroke },
      { label: `Hotspot (${max}+)`, color: DEMAND_COLORS.hotspot.fill, border: DEMAND_COLORS.hotspot.stroke },
      { label: 'Selected', color: DEMAND_COLORS.selected.fill, border: DEMAND_COLORS.selected.stroke, selected: true }
    ];
  }

  if (uniqueCount === 4) {
    return [
      { label: 'No orders', color: DEMAND_COLORS.none.fill, border: DEMAND_COLORS.none.stroke },
      { label: `Low (${b1})`, color: DEMAND_COLORS.low.fill, border: DEMAND_COLORS.low.stroke },
      { label: `Medium (${b2})`, color: DEMAND_COLORS.medium.fill, border: DEMAND_COLORS.medium.stroke },
      { label: `High (${b3})`, color: DEMAND_COLORS.high.fill, border: DEMAND_COLORS.high.stroke },
      { label: `Hotspot (${max}+)`, color: DEMAND_COLORS.hotspot.fill, border: DEMAND_COLORS.hotspot.stroke },
      { label: 'Selected', color: DEMAND_COLORS.selected.fill, border: DEMAND_COLORS.selected.stroke, selected: true }
    ];
  }

  // 5 or more unique values: full 5-tier demand spectrum with absolute order-count ranges
  return [
    { label: 'No orders', color: DEMAND_COLORS.none.fill, border: DEMAND_COLORS.none.stroke },
    {
      label: b1 === 1 ? 'Low (1)' : `Low (1–${b1})`,
      color: DEMAND_COLORS.low.fill,
      border: DEMAND_COLORS.low.stroke
    },
    {
      label: b1 + 1 === b2 ? `Medium (${b2})` : `Medium (${b1 + 1}–${b2})`,
      color: DEMAND_COLORS.medium.fill,
      border: DEMAND_COLORS.medium.stroke
    },
    {
      label: b2 + 1 === b3 ? `High (${b3})` : `High (${b2 + 1}–${b3})`,
      color: DEMAND_COLORS.high.fill,
      border: DEMAND_COLORS.high.stroke
    },
    {
      label: b3 + 1 === b4 ? `Very high (${b4})` : `Very high (${b3 + 1}–${b4})`,
      color: DEMAND_COLORS.very_high.fill,
      border: DEMAND_COLORS.very_high.stroke
    },
    {
      label: `Hotspot (${b4 + 1}+)`,
      color: DEMAND_COLORS.hotspot.fill,
      border: DEMAND_COLORS.hotspot.stroke
    },
    {
      label: 'Selected',
      color: DEMAND_COLORS.selected.fill,
      border: DEMAND_COLORS.selected.stroke,
      selected: true
    }
  ];
};

export const noOrdersLegendItems: LegendItem[] = [
  { label: 'Contested (1–2 comp)', color: NO_ORDERS_COLORS.contested.fill, border: NO_ORDERS_COLORS.contested.stroke },
  { label: 'White space (0 comp)', color: NO_ORDERS_COLORS.whiteSpace.fill, border: NO_ORDERS_COLORS.whiteSpace.stroke },
  { label: 'Saturated (3+ comp)', color: NO_ORDERS_COLORS.saturated.fill, border: NO_ORDERS_COLORS.saturated.stroke },
  { label: 'Outside service area', color: NO_ORDERS_COLORS.outsideArea.fill, border: NO_ORDERS_COLORS.outsideArea.stroke },
  { label: 'Selected', color: DEMAND_COLORS.selected.fill, border: DEMAND_COLORS.selected.stroke, selected: true }
];

const zoneLegendItems: LegendItem[] = [
  { label: 'Core', color: '#dcfce7', border: '#15803d' },
  { label: 'Standard', color: '#dbeafe', border: '#1d4ed8' },
  { label: 'Extended', color: '#fef3c7', border: '#b45309' },
  { label: 'Outside range', color: '#fee2e2', border: '#b91c1c' },
  { label: 'Unavailable', color: '#e2e8f0', border: '#64748b' },
  { label: 'No orders', color: MAP_BASE_COLOR, border: MAP_BOUNDARY_COLOR }
];

const INITIAL_VIEWPORT: MapViewport = { x: 0, y: 0, width: VIEW_W, height: VIEW_H };
const MIN_VIEW_SIZE = 170;
const MAX_VIEW_SIZE = VIEW_W;

const clampViewport = (viewport: MapViewport): MapViewport => {
  const width = Math.min(MAX_VIEW_SIZE, Math.max(MIN_VIEW_SIZE, viewport.width));
  const height = Math.min(MAX_VIEW_SIZE, Math.max(MIN_VIEW_SIZE, viewport.height));
  const x = Math.min(VIEW_W - width, Math.max(0, viewport.x));
  const y = Math.min(VIEW_H - height, Math.max(0, viewport.y));
  return { x, y, width, height };
};

const zoneTone = (zone?: DeliveryBlockZoneAnalysis['zone']) => {
  if (zone === 'core') return { label: 'Core', fill: '#dcfce7', hoverFill: '#bbf7d0', stroke: '#15803d' };
  if (zone === 'standard') return { label: 'Standard', fill: '#dbeafe', hoverFill: '#bfdbfe', stroke: '#1d4ed8' };
  if (zone === 'extended') return { label: 'Extended', fill: '#fef3c7', hoverFill: '#fde68a', stroke: '#b45309' };
  if (zone === 'outside_range') return { label: 'Outside range', fill: '#fee2e2', hoverFill: '#fecaca', stroke: '#b91c1c' };
  if (zone === 'unavailable') return { label: 'Unavailable', fill: '#e2e8f0', hoverFill: '#cbd5e1', stroke: '#64748b' };
  return { label: 'No orders', fill: MAP_BASE_COLOR, hoverFill: '#ead7ce', stroke: MAP_BOUNDARY_COLOR };
};

const StatChip: React.FC<{ label: string; value: string; tone?: 'good' | 'warn' | 'neutral' }> = ({ label, value, tone = 'neutral' }) => {
  const toneClass = tone === 'good'
    ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
    : tone === 'warn'
      ? 'border-amber-100 bg-amber-50 text-amber-800'
      : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-0.5 text-sm font-black tabular-nums">{value}</p>
    </div>
  );
};

const MapToggle: React.FC<{ label: string; checked: boolean; disabled?: boolean; onToggle: () => void }> = ({ label, checked, disabled, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    disabled={disabled}
    className={`rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-40 ${
      checked
        ? 'border-brand/20 bg-brand text-white'
        : 'border-slate-200 bg-white text-slate-500 hover:border-brand/30 hover:text-brand'
    }`}
  >
    {label}
  </button>
);

const MapIconButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}> = ({ label, icon, disabled, onClick }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
    className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-brand/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
  >
    {icon}
  </button>
);

export const BlockCoverageMapLoading: React.FC<BlockCoverageMapLoadingProps> = ({ featureCount }) => (
  <div className="space-y-4 p-4 md:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="skeleton-text h-4 w-64" />
        <div className="skeleton-text mt-2 h-3 w-80 max-w-full" />
      </div>
      <div className="skeleton h-9 w-40" />
    </div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
      {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}
    </div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="skeleton aspect-square min-h-[320px] rounded-lg" />
      <div className="skeleton min-h-[320px] rounded-lg" />
    </div>
    <p className="flex items-center gap-2 text-xs font-bold text-slate-500">
      <MapPinned className="h-4 w-4 text-brand" />
      Loading Bahrain block geometry{featureCount ? ` (${featureCount} blocks)` : ''}...
    </p>
  </div>
);

export const BlockCoverageMapUnavailable: React.FC<BlockCoverageMapUnavailableProps> = ({ error }) => (
  <div className="m-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 md:m-5">
    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
    <div>
      <p className="font-black">Block geometry could not be loaded.</p>
      <p className="text-xs font-bold text-amber-800">
        Matrix view is still available. {error ? `Details: ${error}` : 'The app is continuing without the polygon layer.'}
      </p>
    </div>
  </div>
);

export const BlockCoverageMap: React.FC<BlockCoverageMapProps> = ({
  dataset,
  blocks,
  branchProfiles = [],
  blockZoneAnalysis,
  zoneMetrics,
  summary,
  selectedBlock,
  highlightedGovernorate,
  geometryStats,
  compact = false,
  compactMapHeightClass = 'h-[220px] sm:h-[260px]',
  noOrderAnalysis,
  showNoOrdersClassification,
  onToggleNoOrdersClassification,
  directoryBlocks = [],
  onSelect,
  onOpenMatrix
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ pointerId: number; clientX: number; clientY: number; viewport: MapViewport } | null>(null);
  const suppressClickRef = useRef(false);
  const [hovered, setHovered] = useState<HoverInfo | null>(null);
  const [hoveredBranch, setHoveredBranch] = useState<{ name: string; x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showBranchMarkers, setShowBranchMarkers] = useState(true);
  const [showServiceRings, setShowServiceRings] = useState(true);
  const [showServedBlocks, setShowServedBlocks] = useState(true);
  const [colorMode, setColorMode] = useState<MapColorMode>('orders');
  const [viewport, setViewport] = useState<MapViewport>(INITIAL_VIEWPORT);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) {
        el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => setIsFullscreen(v => !v));
      } else {
        setIsFullscreen(v => !v);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => setIsFullscreen(false));
      } else {
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key === 'Escape' && isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const blocksByNumber = useMemo(
    () => new Map(blocks.map(block => [block.blockNumber.trim(), block])),
    [blocks]
  );

  const bounds = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const feat of dataset.byBlock.values()) {
      for (const ring of ringsOf(feat.geometry)) {
        for (const [x, y] of ring) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!Number.isFinite(minX)) return null;
    return { minX, maxX, minY, maxY };
  }, [dataset]);

  const projection = useMemo<Projection | null>(() => {
    if (!bounds) return null;
    const { minX, maxX, minY, maxY } = bounds;
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const scale = Math.min((VIEW_W - PAD * 2) / spanX, (VIEW_H - PAD * 2) / spanY);
    const offX = PAD + ((VIEW_W - PAD * 2) - spanX * scale) / 2;
    const offY = PAD + ((VIEW_H - PAD * 2) - spanY * scale) / 2;
    return {
      scale,
      project: (point: GeoPoint) => ({
        x: offX + (point.lng - minX) * scale,
        y: offY + (maxY - point.lat) * scale
      })
    };
  }, [bounds]);

  const paths = useMemo(() => {
    if (!projection) return [];

    const result: PathRow[] = [];
    for (const feature of dataset.byBlock.values()) {
      let d = '';
      let pathMinX = Infinity;
      let pathMaxX = -Infinity;
      let pathMinY = Infinity;
      let pathMaxY = -Infinity;
      for (const ring of ringsOf(feature.geometry)) {
        if (ring.length === 0) continue;
        d += 'M' + ring.map(([lng, lat]) => {
          const point = projection.project({ lng, lat });
          pathMinX = Math.min(pathMinX, point.x);
          pathMaxX = Math.max(pathMaxX, point.x);
          pathMinY = Math.min(pathMinY, point.y);
          pathMaxY = Math.max(pathMaxY, point.y);
          return `${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
        }).join(' L') + 'Z';
      }
      if (d) {
        const block = blocksByNumber.get(feature.blockNumber.trim());
        result.push({
          blockNumber: feature.blockNumber,
          block,
          d,
          bbox: {
            minX: Number.isFinite(pathMinX) ? pathMinX : 0,
            maxX: Number.isFinite(pathMaxX) ? pathMaxX : 0,
            minY: Number.isFinite(pathMinY) ? pathMinY : 0,
            maxY: Number.isFinite(pathMaxY) ? pathMaxY : 0
          }
        });
      }
    }

    return result.sort((a, b) => (a.block?.orderCount || 0) - (b.block?.orderCount || 0));
  }, [blocksByNumber, dataset, projection]);

  const mapMaxOrders = useMemo(
    () => blocks.reduce((max, block) => Math.max(max, block.orderCount), 0) || 1,
    [blocks]
  );

  const demandThresholds = useMemo(
    () => computeDemandThresholds(blocks),
    [blocks]
  );

  const demandLegendItems = useMemo(
    () => computeDemandLegendItems(demandThresholds),
    [demandThresholds]
  );

  const [localShowNoOrdersClassification, setLocalShowNoOrdersClassification] = useState(false);
  const activeShowNoOrders = showNoOrdersClassification !== undefined ? showNoOrdersClassification : localShowNoOrdersClassification;
  const toggleNoOrders = onToggleNoOrdersClassification || (() => setLocalShowNoOrdersClassification(prev => !prev));

  const pathByBlockNumber = useMemo(
    () => new Map(paths.map(path => [path.blockNumber.trim(), path])),
    [paths]
  );

  const selectedPath = useMemo(
    () => selectedBlock ? pathByBlockNumber.get(selectedBlock.blockNumber.trim()) : undefined,
    [pathByBlockNumber, selectedBlock]
  );

  const topServedBlocks = useMemo(
    () => blocks.slice().sort((a, b) => b.orderCount - a.orderCount).slice(0, 6),
    [blocks]
  );

  const zoomPercent = Math.round((VIEW_W / viewport.width) * 100);

  const focusPath = (path: PathRow, padding = 74) => {
    const width = Math.max(MIN_VIEW_SIZE, Math.min(MAX_VIEW_SIZE, (path.bbox.maxX - path.bbox.minX) + padding));
    const height = Math.max(MIN_VIEW_SIZE, Math.min(MAX_VIEW_SIZE, (path.bbox.maxY - path.bbox.minY) + padding));
    const size = Math.min(MAX_VIEW_SIZE, Math.max(width, height));
    const cx = (path.bbox.minX + path.bbox.maxX) / 2;
    const cy = (path.bbox.minY + path.bbox.maxY) / 2;
    setViewport(clampViewport({
      x: cx - size / 2,
      y: cy - size / 2,
      width: size,
      height: size
    }));
  };

  const zoomBy = (factor: number) => {
    setViewport(current => {
      const nextWidth = current.width * factor;
      const nextHeight = current.height * factor;
      const cx = current.x + current.width / 2;
      const cy = current.y + current.height / 2;
      return clampViewport({
        x: cx - nextWidth / 2,
        y: cy - nextHeight / 2,
        width: nextWidth,
        height: nextHeight
      });
    });
  };

  const panBy = (dx: number, dy: number) => {
    setViewport(current => clampViewport({
      ...current,
      x: current.x + dx,
      y: current.y + dy
    }));
  };

  const handleWheelZoom = (event: React.WheelEvent<SVGSVGElement>) => {
    if (!mapRef.current) return;
    event.preventDefault();
    const rect = mapRef.current.getBoundingClientRect();
    const pointerX = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * viewport.width + viewport.x;
    const pointerY = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * viewport.height + viewport.y;
    const factor = event.deltaY > 0 ? 1.14 : 0.86;
    const nextWidth = viewport.width * factor;
    const nextHeight = viewport.height * factor;
    const xRatio = (pointerX - viewport.x) / viewport.width;
    const yRatio = (pointerY - viewport.y) / viewport.height;
    setViewport(clampViewport({
      x: pointerX - nextWidth * xRatio,
      y: pointerY - nextHeight * yRatio,
      width: nextWidth,
      height: nextHeight
    }));
  };

  const handlePanStart = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    panStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      viewport
    };
    suppressClickRef.current = false;
    setIsPanning(true);
    setHovered(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePanMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const start = panStartRef.current;
    if (!start || !mapRef.current || start.pointerId !== event.pointerId) return;
    event.preventDefault();
    const rect = mapRef.current.getBoundingClientRect();
    const dx = event.clientX - start.clientX;
    const dy = event.clientY - start.clientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      suppressClickRef.current = true;
    }
    setViewport(clampViewport({
      ...start.viewport,
      x: start.viewport.x - (dx / Math.max(rect.width, 1)) * start.viewport.width,
      y: start.viewport.y - (dy / Math.max(rect.height, 1)) * start.viewport.height
    }));
  };

  const handlePanEnd = (event: React.PointerEvent<SVGSVGElement>) => {
    const start = panStartRef.current;
    if (start?.pointerId === event.pointerId) {
      panStartRef.current = null;
    }
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (suppressClickRef.current) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  };

  const resetViewport = () => {
    setViewport(INITIAL_VIEWPORT);
  };

  const focusSelected = () => {
    if (selectedPath) focusPath(selectedPath);
  };

  const blockSelectOptions = useMemo<SelectOption[]>(() => {
    const map = new Map<string, { blockNumber: string; areaName?: string | null; governorate?: string | null }>();

    if (directoryBlocks && directoryBlocks.length > 0) {
      for (const b of directoryBlocks) {
        const num = (b.blockNumber || '').trim();
        if (!num) continue;
        map.set(num, {
          blockNumber: num,
          areaName: b.areaName,
          governorate: b.governorate
        });
      }
    }

    for (const [key, feat] of dataset.byBlock.entries()) {
      const num = key.trim();
      if (!num) continue;
      const existing = map.get(num);
      const area = feat.properties?.areaName || feat.properties?.area || existing?.areaName;
      const gov = feat.properties?.governorate || existing?.governorate;
      map.set(num, {
        blockNumber: num,
        areaName: area || existing?.areaName || null,
        governorate: gov || existing?.governorate || null
      });
    }

    for (const b of blocks) {
      const num = (b.blockNumber || '').trim();
      if (!num) continue;
      const existing = map.get(num);
      map.set(num, {
        blockNumber: num,
        areaName: b.areaName || existing?.areaName || null,
        governorate: b.governorate || existing?.governorate || null
      });
    }

    const sorted = Array.from(map.values()).sort((a, b) => {
      const na = parseInt(a.blockNumber, 10);
      const nb = parseInt(b.blockNumber, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.blockNumber.localeCompare(b.blockNumber);
    });

    return sorted.map(item => ({
      value: item.blockNumber,
      label: `Block ${item.blockNumber}`,
      hint: item.areaName ? (item.governorate ? `${item.areaName} (${item.governorate})` : item.areaName) : undefined
    }));
  }, [dataset, blocks, directoryBlocks]);

  const handleBlockSelect = (blockNumber: string | null) => {
    if (!blockNumber) return;
    const trimmed = blockNumber.trim();
    const existingMetric = blocksByNumber.get(trimmed);
    const geometryMatch = pathByBlockNumber.get(trimmed);
    const directoryMatch = directoryBlocks.find(d => d.blockNumber.trim() === trimmed);

    const targetMetric: DeliveryBlockMetric = existingMetric || {
      blockNumber: trimmed,
      areaName: directoryMatch?.areaName || (geometryMatch ? dataset.byBlock.get(trimmed)?.properties?.areaName || null : null),
      governorate: directoryMatch?.governorate || (geometryMatch ? dataset.byBlock.get(trimmed)?.properties?.governorate || null : null),
      orderCount: 0,
      deliveredCount: 0,
      cancelledCount: 0,
      returnedCount: 0,
      avgDeliveryMinutes: null,
      shareOfTotal: 0,
      trend: 'neutral',
      dominantBranchId: null,
      dominantBranchName: null,
      branchBreakdown: []
    };

    onSelect(targetMetric);
    if (geometryMatch) {
      focusPath(geometryMatch, targetMetric.orderCount > 0 ? 92 : 120);
    }
  };

  useEffect(() => {
    if (!selectedPath) return;
    focusPath(selectedPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath?.blockNumber]);

  const branchMarkers = useMemo<BranchMarkerRow[]>(() => {
    if (!projection || branchProfiles.length === 0) return [];

    // Deduplicate profiles by branchId or code/name
    const uniqueProfiles: BranchDeliveryProfile[] = [];
    const seenBranchIds = new Set<string>();
    for (const p of branchProfiles) {
      const id = (p.branchId || p.branchCode || p.branchName || '').trim();
      if (id && !seenBranchIds.has(id)) {
        seenBranchIds.add(id);
        uniqueProfiles.push(p);
      }
    }

    const mapped = uniqueProfiles
      .filter(profile => profile.isDeliveryEnabled !== false)
      .map(profile => {
        const marker = getBranchMarkerPoint(
          dataset,
          profile.branchCode || profile.branchName || profile.branchId,
          profile.originBlockNumber,
          { lat: profile.lat, lng: profile.lng }
        );
        if (!marker.point) return null;
        const projected = projection.project(marker.point);
        return {
          profile,
          originBlockNumber: marker.originBlockNumber,
          x: projected.x,
          y: projected.y
        };
      })
      .filter(Boolean) as Array<{ profile: BranchDeliveryProfile; originBlockNumber: string; x: number; y: number }>;

    // Spatial clustering: cluster pins that are within 10 SVG units of each other
    const clusters: Array<Array<{ profile: BranchDeliveryProfile; originBlockNumber: string; x: number; y: number }>> = [];
    for (const row of mapped) {
      let placed = false;
      for (const cluster of clusters) {
        const rep = cluster[0];
        const dist = Math.hypot(rep.x - row.x, rep.y - row.y);
        if (dist < 10) {
          cluster.push(row);
          placed = true;
          break;
        }
      }
      if (!placed) {
        clusters.push([row]);
      }
    }

    const result: BranchMarkerRow[] = [];
    for (const cluster of clusters) {
      const count = cluster.length;
      cluster.forEach((row, index) => {
        const angle = count === 1 ? 0 : (Math.PI * 2 * index) / count - Math.PI / 2;
        const offset = count === 1 ? 0 : 6.5;
        result.push({
          key: `${row.profile.branchId}:${row.originBlockNumber}`,
          profile: row.profile,
          originBlockNumber: row.originBlockNumber,
          x: row.x,
          y: row.y,
          markerX: row.x + Math.cos(angle) * offset,
          markerY: row.y + Math.sin(angle) * offset,
          duplicateCount: count,
          duplicateIndex: index
        });
      });
    }
    return result;
  }, [branchProfiles, dataset, projection]);

  const radiusToSvg = (radiusKm: number) => {
    if (!projection) return 0;
    return (radiusKm / 111.32) * projection.scale;
  };

  const branchMarkerScale = Math.max(0.46, viewport.width / VIEW_W);

  const selectedRecommendation = useMemo<DeliveryCoverageRecommendation | undefined>(
    () => selectedBlock
      ? summary.recommendedActions.find(action => action.blockNumber === selectedBlock.blockNumber)
      : undefined,
    [selectedBlock, summary.recommendedActions]
  );

  const emptyOrders = summary.totalOrders === 0;
  const mapSvgClassName = compact
    ? `${compactMapHeightClass} w-full touch-none select-none`
    : 'h-auto w-full touch-none select-none';

  const handleHover = (event: React.MouseEvent<SVGPathElement>, row: PathRow) => {
    if (panStartRef.current) return;
    const rect = mapRef.current?.getBoundingClientRect();
    const block = row.block;
    if (!rect) return;

    const orderCount = block?.orderCount || 0;
    const rankInfo = computeBlockPercentileRank(orderCount, blocks);
    const demandTone = activityTone(orderCount, demandThresholds);
    const cleanNum = row.blockNumber.trim();
    const noOrderData = noOrderAnalysis?.get(cleanNum) || noOrderAnalysis?.get(row.blockNumber);
    const fallbackArea = (LEGACY_BLOCK_AREA_NAMES as Record<string, string>)[cleanNum] || null;

    let competitorNames: string[] = [];
    if (noOrderData) {
      competitorNames = noOrderData.competitors.map(c => c.name);
    } else {
      const rawEntries = (LEGACY_BLOCK_PHARMACY_MAP as Record<string, Array<{ name: string; group?: string }>>)[cleanNum] || [];
      competitorNames = rawEntries
        .filter(p => {
          const name = (p.name || '').toUpperCase();
          const group = (p.group || '').toUpperCase();
          return !name.includes('TABARAK') && !group.includes('TABARAK');
        })
        .map(p => p.name);
    }

    setHovered({
      blockNumber: cleanNum,
      areaName: block?.areaName || fallbackArea,
      orderCount,
      shareOfTotal: block?.shareOfTotal,
      percentileRank: rankInfo?.rankLabel,
      demandTierLabel: demandTone.label,
      dominantBranchName: block?.dominantBranchName,
      zoneLabel: block ? zoneTone(blockZoneAnalysis?.get(cleanNum)?.zone).label : undefined,
      noOrderInfo: noOrderData ? {
        classification: noOrderData.classification,
        competitorCount: noOrderData.competitorCount,
        competitors: competitorNames
      } : (competitorNames.length > 0 ? {
        classification: competitorNames.length <= 2 ? 'contested' : 'saturated',
        competitorCount: competitorNames.length,
        competitors: competitorNames
      } : undefined),
      x: event.clientX - rect.left + 14,
      y: event.clientY - rect.top + 14
    });
  };

  if (!bounds || paths.length === 0) {
    return (
      <div className="p-4 md:p-5">
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center">
          <MapPinned className="mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-black text-slate-700">No block geometry available to render.</p>
          <p className="mt-1 max-w-md text-xs font-bold leading-5 text-slate-400">
            Matrix view is still available for recorded delivery blocks.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${compact ? 'space-y-3' : 'space-y-4 p-4 md:p-5'} ${isFullscreen ? 'fixed inset-0 z-50 overflow-y-auto bg-slate-900/95 p-4 sm:p-6 backdrop-blur-md text-white' : ''}`}
    >
      {!compact && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm">
                  <MapPinned className="h-5 w-5" />
                </div>
                <div>
                  <h3 className={`text-base font-black tracking-tight ${isFullscreen ? 'text-white' : 'text-slate-950'}`}>Bahrain Block Delivery Coverage</h3>
                  <p className={`text-xs font-bold leading-5 ${isFullscreen ? 'text-slate-400' : 'text-slate-500'}`}>
                    Interactive operating map for demand, zones, branch reach, and block-level action.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Real geometry loaded
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600">
                <Crosshair className="h-3.5 w-3.5 text-brand" />
                {zoomPercent}% zoom
              </div>
            </div>
          </div>

          <div className={`grid gap-3 rounded-lg border p-3 shadow-sm lg:grid-cols-[minmax(240px,360px)_auto_auto] lg:items-center ${isFullscreen ? 'border-slate-800 bg-slate-800/90' : 'border-slate-200 bg-white'}`}>
            <div className="min-w-0">
              <SearchableSelect
                options={blockSelectOptions}
                value={selectedBlock?.blockNumber || null}
                onChange={handleBlockSelect}
                placeholder="Search block number or area name..."
              />
            </div>

            <div className={`flex flex-wrap items-center gap-2 rounded-lg border p-1 ${isFullscreen ? 'border-slate-700 bg-slate-900/80' : 'border-slate-200 bg-slate-50'}`}>
              {([
                { id: 'orders', label: 'Demand' },
                { id: 'zones', label: 'Zones' }
              ] as Array<{ id: MapColorMode; label: string }>).map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setColorMode(option.id)}
                  className={`rounded-md px-3 py-2 text-[10px] font-black uppercase tracking-widest transition ${
                    colorMode === option.id
                      ? 'bg-slate-950 text-white shadow-sm ring-1 ring-white/20'
                      : 'text-slate-500 hover:bg-white hover:text-slate-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              {noOrderAnalysis && (
                <button
                  type="button"
                  onClick={() => {
                    if (colorMode === 'zones' && !activeShowNoOrders) {
                      setColorMode('orders');
                    }
                    toggleNoOrders();
                  }}
                  className={`rounded-md px-3 py-2 text-[10px] font-black uppercase tracking-widest transition flex items-center gap-1.5 ${
                    activeShowNoOrders
                      ? 'bg-amber-600 text-white shadow-sm ring-1 ring-white/20'
                      : 'text-slate-500 hover:bg-white hover:text-slate-800'
                  }`}
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${activeShowNoOrders ? 'bg-white animate-pulse' : 'bg-amber-500'}`} />
                  Analyze No-Orders
                </button>
              )}
            </div>

            <div className="flex items-center gap-1">
              <MapIconButton label="Zoom in" icon={<ZoomIn className="h-4 w-4" />} onClick={() => zoomBy(0.82)} />
              <MapIconButton label="Zoom out" icon={<ZoomOut className="h-4 w-4" />} onClick={() => zoomBy(1.18)} />
              <MapIconButton label="Recenter map" icon={<RotateCcw className="h-4 w-4" />} onClick={resetViewport} />
              <MapIconButton label="Focus selected block" icon={<Navigation className="h-4 w-4" />} disabled={!selectedPath} onClick={focusSelected} />
              <MapIconButton
                label={isFullscreen ? 'Exit Fullscreen (F11)' : 'Fullscreen (F11)'}
                icon={isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                onClick={toggleFullscreen}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <StatChip label="Geometry blocks" value={`${dataset.featureCount}`} tone="good" />
            <StatChip label="Mapped served" value={`${geometryStats.matched}`} tone="good" />
            <StatChip label="Unmapped served" value={`${geometryStats.unmatched}`} tone={geometryStats.unmatched > 0 ? 'warn' : 'neutral'} />
            <StatChip label="Unknown block orders" value={`${summary.unknownBlockOrders}`} tone={summary.unknownBlockOrders > 0 ? 'warn' : 'neutral'} />
            <StatChip label="Unresolved blocks" value={`${summary.unresolvedBlockOrders}`} tone={summary.unresolvedBlockOrders > 0 ? 'warn' : 'neutral'} />
          </div>

          {zoneMetrics && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <StatChip label="Branch markers" value={`${zoneMetrics.mappedBranchMarkers}/${zoneMetrics.totalBranchProfiles}`} tone={zoneMetrics.unmappedBranchMarkers > 0 ? 'warn' : 'good'} />
              <StatChip label="Duplicate origins" value={`${zoneMetrics.duplicateBranchBlockGroups.length}`} tone={zoneMetrics.duplicateBranchBlockGroups.length > 0 ? 'warn' : 'neutral'} />
              <StatChip label="Outside range" value={`${zoneMetrics.servedOutsideRangeBlocks}`} tone={zoneMetrics.servedOutsideRangeBlocks > 0 ? 'warn' : 'neutral'} />
              <StatChip label="Unavailable zones" value={`${zoneMetrics.servedBlocksUnavailableZone}`} tone={zoneMetrics.servedBlocksUnavailableZone > 0 ? 'warn' : 'neutral'} />
            </div>
          )}
        </>
      )}

      {!compact && emptyOrders && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>No delivery orders found for the selected filters. Adjust the date range or branch filter.</span>
        </div>
      )}

      <div className="space-y-4">
        <div className="w-full">
          <div ref={mapRef} className="relative overflow-hidden rounded-lg border border-slate-200 bg-[#f9eee9] shadow-inner">
            {!compact && <div className="absolute left-3 top-3 z-10 hidden rounded-lg border border-white/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur md:block">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <MousePointer2 className="h-3.5 w-3.5" />
                Hover, click, wheel to zoom
              </p>
            </div>}
            {!compact && <div className="absolute right-3 top-3 z-10 hidden max-w-[380px] flex-wrap gap-1 rounded-lg border border-white/80 bg-white/90 p-1 shadow-sm backdrop-blur print:hidden md:flex">
              <MapToggle label="Branch Markers" checked={showBranchMarkers} onToggle={() => setShowBranchMarkers(v => !v)} />
              <MapToggle label="Service Rings" checked={showServiceRings && branchMarkers.length > 0} disabled={branchMarkers.length === 0} onToggle={() => setShowServiceRings(v => !v)} />
              <MapToggle label="Served Blocks" checked={showServedBlocks} onToggle={() => setShowServedBlocks(v => !v)} />
              {noOrderAnalysis && (
                <MapToggle
                  label="Analyze No-Orders"
                  checked={activeShowNoOrders}
                  onToggle={() => {
                    if (colorMode === 'zones' && !activeShowNoOrders) {
                      setColorMode('orders');
                    }
                    toggleNoOrders();
                  }}
                />
              )}
            </div>}

            {!compact && <div className="absolute bottom-3 left-3 z-10 hidden grid-cols-3 gap-1 rounded-lg border border-white/80 bg-white/90 p-1 shadow-sm backdrop-blur print:hidden md:grid">
              <span />
              <MapIconButton label="Pan up" icon={<Navigation className="h-3.5 w-3.5 -rotate-45" />} onClick={() => panBy(0, -viewport.height * 0.18)} />
              <span />
              <MapIconButton label="Pan left" icon={<Navigation className="h-3.5 w-3.5 -rotate-[135deg]" />} onClick={() => panBy(-viewport.width * 0.18, 0)} />
              <MapIconButton label="Reset map" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={resetViewport} />
              <MapIconButton label="Pan right" icon={<Navigation className="h-3.5 w-3.5 rotate-45" />} onClick={() => panBy(viewport.width * 0.18, 0)} />
              <span />
              <MapIconButton label="Pan down" icon={<Navigation className="h-3.5 w-3.5 rotate-[135deg]" />} onClick={() => panBy(0, viewport.height * 0.18)} />
              <span />
            </div>}

            <svg
              viewBox={`${viewport.x.toFixed(2)} ${viewport.y.toFixed(2)} ${viewport.width.toFixed(2)} ${viewport.height.toFixed(2)}`}
              className={mapSvgClassName}
              style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
              role="img"
              aria-label="Bahrain block delivery coverage map"
              onWheel={handleWheelZoom}
              onPointerDown={handlePanStart}
              onPointerMove={handlePanMove}
              onPointerUp={handlePanEnd}
              onPointerCancel={handlePanEnd}
            >
              <defs>
                <style>
                  {`
                    .delivery-zone-ring {
                      transform-box: fill-box;
                      transform-origin: center;
                      animation: delivery-zone-pulse 3.2s ease-in-out infinite;
                    }
                    .delivery-zone-ring-standard { animation-delay: .25s; }
                    .delivery-zone-ring-extended { animation-delay: .5s; }
                    @keyframes delivery-zone-pulse {
                      0%, 100% { opacity: .46; stroke-width: 1.8; }
                      50% { opacity: .72; stroke-width: 2.35; }
                    }
                    .branch-marker-pulse {
                      transform-box: fill-box;
                      transform-origin: center;
                      animation: branch-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                    }
                    @keyframes branch-pulse {
                      0% {
                        r: 3.5;
                        opacity: 0.85;
                        stroke-width: 0.8;
                      }
                      50% {
                        r: 6.5;
                        opacity: 0.3;
                        stroke-width: 1.2;
                      }
                      100% {
                        r: 8.5;
                        opacity: 0;
                        stroke-width: 0.3;
                      }
                    }
                    @media (prefers-reduced-motion: reduce) {
                      .delivery-zone-ring { animation: none; }
                      .branch-marker-pulse { animation: none; opacity: 0.4; r: 5; }
                    }
                  `}
                </style>
                <filter id="selected-block-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.28" />
                </filter>
              </defs>
              <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={MAP_BASE_COLOR} />
              {paths.map(row => {
                const block = row.block;
                const cleanBlockNum = row.blockNumber.trim();
                const selected = selectedBlock?.blockNumber?.trim() === cleanBlockNum;
                const hoveredBlock = hovered?.blockNumber?.trim() === cleanBlockNum;
                const noOrderData = noOrderAnalysis?.get(cleanBlockNum) || noOrderAnalysis?.get(row.blockNumber);
                const isZeroOrder = !block || block.orderCount <= 0;
                let tone = activityTone(block?.orderCount || 0, demandThresholds);

                // Competitor-aware No-Orders coloring overlay
                if (isZeroOrder && activeShowNoOrders && noOrderData) {
                  if (noOrderData.classification === 'contested') {
                    tone = NO_ORDERS_COLORS.contested;
                  } else if (noOrderData.classification === 'white-space') {
                    tone = NO_ORDERS_COLORS.whiteSpace;
                  } else if (noOrderData.classification === 'saturated') {
                    tone = NO_ORDERS_COLORS.saturated;
                  } else if (noOrderData.classification === 'outside-service-area') {
                    tone = NO_ORDERS_COLORS.outsideArea;
                  }
                }

                const zone = block ? blockZoneAnalysis?.get(cleanBlockNum)?.zone : undefined;
                const zoneStyle = zoneTone(zone);
                const interactive = !!block || (activeShowNoOrders && !!noOrderData);
                const dimmedByGovernorate = !!highlightedGovernorate
                  && !!block
                  && (block.governorate || 'Unknown') !== highlightedGovernorate;
                const highlightedByGovernorate = !!highlightedGovernorate
                  && !!block
                  && (block.governorate || 'Unknown') === highlightedGovernorate;

                let blockFill = MAP_BASE_COLOR;
                let blockStroke = '#cbd5e1';

                if (selected) {
                  blockFill = MAP_SELECTED_COLOR;
                  blockStroke = MAP_SELECTED_COLOR;
                } else if (colorMode === 'zones') {
                  blockFill = zoneStyle.fill;
                  blockStroke = zoneStyle.stroke;
                } else if (activeShowNoOrders && isZeroOrder && noOrderData) {
                  blockFill = hoveredBlock ? tone.hoverFill : tone.fill;
                  blockStroke = hoveredBlock ? '#111827' : tone.stroke;
                } else if (!isZeroOrder) {
                  blockFill = !showServedBlocks ? MAP_BASE_COLOR : (hoveredBlock ? tone.hoverFill : tone.fill);
                  blockStroke = !showServedBlocks ? '#cbd5e1' : (hoveredBlock ? '#111827' : tone.stroke);
                } else {
                  blockFill = MAP_BASE_COLOR;
                  blockStroke = '#cbd5e1';
                }

                return (
                  <path
                    key={row.blockNumber}
                    d={row.d}
                    role={interactive ? 'button' : 'img'}
                    tabIndex={interactive ? 0 : -1}
                    aria-label={
                      !isZeroOrder
                        ? `Block ${row.blockNumber}, ${block!.orderCount} delivery orders`
                        : activeShowNoOrders && noOrderData
                          ? `Block ${row.blockNumber}, 0 orders, ${noOrderData.classification}`
                          : `Block ${row.blockNumber}, no delivery orders`
                    }
                    aria-pressed={interactive ? selected : undefined}
                    onClick={event => {
                      if (suppressClickRef.current) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                      }
                      const targetBlock: DeliveryBlockMetric = block || {
                        blockNumber: cleanBlockNum,
                        areaName: (LEGACY_BLOCK_AREA_NAMES as Record<string, string>)[cleanBlockNum] || null,
                        governorate: null,
                        unresolved: false,
                        orderCount: 0,
                        branchBreakdown: [],
                        shareOfTotal: 0,
                        trend: 'insufficient_data'
                      };
                      onSelect(targetBlock);
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        const targetBlock: DeliveryBlockMetric = block || {
                          blockNumber: cleanBlockNum,
                          areaName: (LEGACY_BLOCK_AREA_NAMES as Record<string, string>)[cleanBlockNum] || null,
                          governorate: null,
                          unresolved: false,
                          orderCount: 0,
                          branchBreakdown: [],
                          shareOfTotal: 0,
                          trend: 'insufficient_data'
                        };
                        onSelect(targetBlock);
                      }
                    }}
                    onMouseEnter={event => handleHover(event, row)}
                    onMouseMove={event => handleHover(event, row)}
                    onMouseLeave={() => setHovered(null)}
                    fill={blockFill}
                    stroke={blockStroke}
                    strokeWidth={selected ? 2.5 : hoveredBlock ? 1.6 : (colorMode === 'zones' && zone ? 1.15 : (activeShowNoOrders && isZeroOrder && noOrderData ? 0.9 : 0.65))}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    filter={selected ? 'url(#selected-block-shadow)' : undefined}
                    opacity={
                      dimmedByGovernorate
                        ? 0.18
                        : highlightedByGovernorate
                          ? 1
                          : !showServedBlocks
                            ? 0.85
                            : 1
                    }
                    className="cursor-pointer transition-colors duration-150"
                  />
                );
              })}

              {selectedPath && (
                <path
                  d={selectedPath.d}
                  fill="none"
                  stroke="#111827"
                  strokeWidth="2.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              )}

              {showServiceRings && branchMarkers.map(marker => (
                <g key={`rings:${marker.key}`} pointerEvents="none" aria-hidden="true">
                  <circle
                    cx={marker.x}
                    cy={marker.y}
                    r={radiusToSvg(marker.profile.extendedRadiusKm)}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    strokeDasharray="5 5"
                    opacity="0.34"
                    className="delivery-zone-ring delivery-zone-ring-extended"
                  />
                  <circle
                    cx={marker.x}
                    cy={marker.y}
                    r={radiusToSvg(marker.profile.standardRadiusKm)}
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="1.5"
                    opacity="0.42"
                    className="delivery-zone-ring delivery-zone-ring-standard"
                  />
                  <circle
                    cx={marker.x}
                    cy={marker.y}
                    r={radiusToSvg(marker.profile.coreRadiusKm)}
                    fill="none"
                    stroke="#b91c1c"
                    strokeWidth="1.8"
                    opacity="0.55"
                    className="delivery-zone-ring"
                  />
                </g>
              ))}
              {showBranchMarkers && branchMarkers.map(marker => {
                const pharmacyName = marker.profile.branchName || marker.profile.branchCode || 'Pharmacy';
                const connectorX = (marker.x - marker.markerX) / branchMarkerScale;
                const connectorY = (marker.y - marker.markerY) / branchMarkerScale;
                return (
                  <g
                    key={marker.key}
                    transform={`translate(${marker.markerX.toFixed(1)} ${marker.markerY.toFixed(1)}) scale(${branchMarkerScale.toFixed(3)})`}
                    pointerEvents="auto"
                    className="cursor-pointer"
                    onMouseEnter={(e) => {
                      const rect = mapRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      setHoveredBranch({
                        name: pharmacyName,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top
                      });
                    }}
                    onMouseMove={(e) => {
                      const rect = mapRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      setHoveredBranch({
                        name: pharmacyName,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top
                      });
                    }}
                    onMouseLeave={() => setHoveredBranch(null)}
                    aria-label={pharmacyName}
                  >
                    <title>{pharmacyName}</title>
                    {marker.duplicateCount > 1 && (
                      <line
                        x1={connectorX.toFixed(1)}
                        y1={connectorY.toFixed(1)}
                        x2="0"
                        y2="0"
                        stroke="#7f1d1d"
                        strokeWidth="0.8"
                        opacity={0.38}
                      />
                    )}
                    {/* Dark red pulsating aura circle (compact) */}
                    <circle
                      className="branch-marker-pulse"
                      r="4.5"
                      fill="#7f1d1d"
                      stroke="#991b1b"
                    />
                    {/* Dark red solid center core circle (compact diameter r=3.2, no number text) */}
                    <circle r="3.2" fill="#7f1d1d" stroke="#ffffff" strokeWidth="0.8" />
                    <circle r="0.8" fill="#ffffff" opacity="0.4" />
                  </g>
                );
              })}
            </svg>

            {hovered && !hoveredBranch && (
              <div
                className="pointer-events-none absolute z-30 min-w-[220px] max-w-[290px] rounded-lg border border-slate-700/80 bg-slate-950/95 p-3 text-white shadow-2xl backdrop-blur-md transition-all duration-75"
                style={{
                  left: Math.max(10, Math.min(hovered.x + 14, (mapRef.current?.clientWidth || 600) - 305)),
                  top: Math.max(10, Math.min(hovered.y - 25, (mapRef.current?.clientHeight || 600) - 220))
                }}
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-white">Block #{hovered.blockNumber}</p>
                    <p className="truncate text-[11px] font-medium text-slate-300">{hovered.areaName || 'Unassigned Area'}</p>
                  </div>
                  {hovered.orderCount > 0 ? (
                    <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-black text-emerald-400">
                      {hovered.orderCount} orders
                    </span>
                  ) : (
                    <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                      0 orders
                    </span>
                  )}
                </div>

                {activeShowNoOrders && (
                  <div className="mt-2 space-y-1.5">
                    {hovered.noOrderInfo && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Status
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${
                          hovered.noOrderInfo.classification === 'contested'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : hovered.noOrderInfo.classification === 'white-space'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : hovered.noOrderInfo.classification === 'saturated'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          {hovered.noOrderInfo.classification.replace(/-/g, ' ')}
                        </span>
                      </div>
                    )}

                    {hovered.noOrderInfo && hovered.noOrderInfo.competitors.length > 0 ? (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                          Competitors ({hovered.noOrderInfo.competitors.length}):
                        </p>
                        <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                          {hovered.noOrderInfo.competitors.map((compName, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-[11px] leading-tight text-slate-200">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                              <span className="font-medium text-slate-100">{compName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-[10px] font-medium text-emerald-400 italic">
                        No competitors in this block
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {hoveredBranch && (
              <div
                className="pointer-events-none absolute z-30 rounded-md border border-slate-700/80 bg-slate-950/95 px-2.5 py-1 text-xs font-black text-white shadow-xl backdrop-blur-xs"
                style={{ left: Math.min(hoveredBranch.x + 12, (mapRef.current?.clientWidth || 500) - 180), top: Math.max(10, hoveredBranch.y - 32) }}
              >
                {hoveredBranch.name}
              </div>
            )}
          </div>

          {!compact && <div className="mt-3 flex flex-wrap items-center gap-2">
            {(colorMode === 'zones'
              ? zoneLegendItems
              : activeShowNoOrders
                ? [...demandLegendItems, ...noOrdersLegendItems.filter(i => i.label !== 'Selected')]
                : demandLegendItems
            ).map(item => (
              <div key={item.label} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-600">
                <span
                  className={`h-3 w-5 rounded-sm border ${item.dashed ? 'border-dashed' : ''} ${item.selected ? 'ring-1 ring-slate-900 ring-offset-1' : ''}`}
                  style={{ backgroundColor: item.color, borderColor: item.border }}
                />
                {item.label}
              </div>
            ))}
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              {colorMode === 'zones' ? 'Service-zone layer' : activeShowNoOrders ? 'Jenks Demand + Competitor Overlay' : 'Jenks Natural Breaks Demand'}
            </span>
          </div>}
        </div>

        {!compact && (
          <aside className="w-full rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-xs">
            {selectedBlock ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selected block</span>
                      <h4 className="text-2xl font-black tracking-tight text-slate-950">#{selectedBlock.blockNumber}</h4>
                      <TrendPill trend={selectedBlock.trend} />
                    </div>
                    <p className="mt-0.5 text-xs font-bold text-slate-500">
                      {selectedBlock.areaName || 'Unresolved area'}
                      {selectedBlock.governorate ? ` | ${selectedBlock.governorate}` : ''}
                    </p>
                  </div>
                  {onOpenMatrix && (
                    <button type="button" onClick={onOpenMatrix} className="btn-secondary text-[10px] uppercase tracking-widest">
                      <Grid3x3 className="h-3.5 w-3.5" />
                      View matrix details
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatChip label="Orders" value={`${selectedBlock.orderCount}`} />
                  <StatChip label="Located share" value={formatPct(selectedBlock.shareOfTotal)} />
                  {selectedBlock.orderCount > 0 ? (
                    <StatChip
                      label="Demand Tier"
                      value={`${computeBlockPercentileRank(selectedBlock.orderCount, blocks)?.rankLabel || ''} · ${activityTone(selectedBlock.orderCount, demandThresholds).label}`}
                      tone="good"
                    />
                  ) : (
                    <StatChip
                      label="No-Order Status"
                      value={(() => {
                        const cleanNum = selectedBlock.blockNumber.trim();
                        const info = noOrderAnalysis?.get(cleanNum) || noOrderAnalysis?.get(selectedBlock.blockNumber);
                        if (!info) return '0 Orders';
                        return info.classification === 'contested'
                          ? `Contested (${info.competitorCount} comp)`
                          : info.classification === 'white-space'
                            ? 'White Space (0 comp)'
                            : info.classification === 'saturated'
                              ? `Saturated (${info.competitorCount} comp)`
                              : 'Outside Area';
                      })()}
                      tone={(() => {
                        const cleanNum = selectedBlock.blockNumber.trim();
                        const info = noOrderAnalysis?.get(cleanNum) || noOrderAnalysis?.get(selectedBlock.blockNumber);
                        return info?.classification === 'contested' ? 'warn' : 'neutral';
                      })()}
                    />
                  )}
                  <StatChip label="Dominant branch" value={selectedBlock.dominantBranchName || 'None'} />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Branch breakdown</p>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto">
                        {selectedBlock.branchBreakdown.length > 0 ? (
                          selectedBlock.branchBreakdown.map(branch => {
                            const share = selectedBlock.orderCount ? branch.orderCount / selectedBlock.orderCount : 0;
                            return (
                              <div key={branch.branchId} className="rounded-lg border border-slate-200 bg-white p-2.5">
                                <div className="flex items-center justify-between gap-2 text-xs font-bold">
                                  <span className="truncate text-slate-700">{branch.branchName}</span>
                                  <span className="shrink-0 text-slate-500 tabular-nums">{branch.orderCount} orders</span>
                                </div>
                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, share * 100)}%` }} />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs font-bold text-slate-400">
                            No branch delivery breakdown recorded for this block.
                          </div>
                        )}
                      </div>
                    </div>

                    {blockZoneAnalysis?.get(selectedBlock.blockNumber) && (
                      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3.5">
                        {(() => {
                          const analysis = blockZoneAnalysis.get(selectedBlock.blockNumber)!;
                          return (
                            <>
                              <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Branch service zone</p>
                              <p className="mt-1 text-sm font-black text-blue-950">
                                {analysis.zone.replace('_', ' ')}
                                {analysis.distanceKm !== null && analysis.distanceKm !== undefined ? ` | ${analysis.distanceKm.toFixed(1)} km approx.` : ''}
                              </p>
                              <p className="mt-1 text-xs font-bold leading-5 text-blue-800">
                                {analysis.originBlockNumber ? `Origin block ${analysis.originBlockNumber}. ` : ''}
                                {analysis.reason ? `${analysis.reason}. ` : ''}
                                {analysis.recommendedAction}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {selectedBlock.orderCount === 0 && (noOrderAnalysis?.get(selectedBlock.blockNumber.trim()) || noOrderAnalysis?.get(selectedBlock.blockNumber)) && (
                      <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs">
                        {(() => {
                          const analysis = (noOrderAnalysis.get(selectedBlock.blockNumber.trim()) || noOrderAnalysis.get(selectedBlock.blockNumber))!;
                          const toneColor =
                            analysis.classification === 'contested' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                            analysis.classification === 'white-space' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                            analysis.classification === 'saturated' ? 'text-rose-700 bg-rose-50 border-rose-200' :
                            'text-slate-700 bg-slate-100 border-slate-200';
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                  Competitor Analysis
                                </span>
                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${toneColor}`}>
                                  {analysis.classification.replace(/-/g, ' ')}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-slate-700 leading-snug">
                                {analysis.competitorCount === 0
                                  ? 'No competitor pharmacies detected.'
                                  : `${analysis.competitorCount} competitor pharmacy${analysis.competitorCount > 1 ? 's' : ''} detected:`}
                              </p>
                              {analysis.competitors.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {analysis.competitors.map((c, i) => (
                                    <span key={i} className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                                      {c.name}{c.group ? ` (${c.group})` : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <p className="text-[11px] font-semibold text-slate-500 leading-tight">
                                {analysis.actionRecommendation}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Recommended action</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-blue-900">
                        {selectedRecommendation?.recommendedAction || 'No automatic recommendation for this block in the selected period.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[130px] flex-col items-center justify-center py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-slate-300 shadow-sm">
                  <MousePointer2 className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-black text-slate-800">Select a block on the map</p>
                <p className="mt-1 max-w-md text-xs font-bold leading-5 text-slate-400">
                  Inspect delivery activity, branch breakdown, trend, and any recommendation for a served block.
                </p>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};
