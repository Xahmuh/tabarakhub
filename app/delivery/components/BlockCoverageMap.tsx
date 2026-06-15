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
  ZoomOut
} from 'lucide-react';
import {
  BranchDeliveryProfile,
  DeliveryBlockMetric,
  DeliveryBlockZoneAnalysis,
  DeliveryCoverageRecommendation,
  DeliveryCoverageSummary,
  DeliveryZoneQualityMetrics
} from '../../../types';
import { BlockGeometryDataset, GeoPoint, getBranchMarkerPoint } from '../bahrainBlockGeometry';

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
  dominantBranchName?: string;
  zoneLabel?: string;
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

const activityTone = (orders: number, maxOrders: number) => {
  const ratio = maxOrders > 0 ? orders / maxOrders : 0;
  if (orders <= 0) {
    return {
      label: 'No orders',
      fill: MAP_BASE_COLOR,
      hoverFill: '#ead7ce'
    };
  }
  if (ratio <= 0.25) {
    return {
      label: 'Low',
      fill: '#bbf7d0',
      hoverFill: '#86efac'
    };
  }
  if (ratio <= 0.5) {
    return {
      label: 'Medium',
      fill: '#7dd3fc',
      hoverFill: '#38bdf8'
    };
  }
  if (ratio <= 0.75) {
    return {
      label: 'High',
      fill: '#fbbf24',
      hoverFill: '#f59e0b'
    };
  }
  return {
    label: 'Very high',
    fill: '#dc2626',
    hoverFill: '#b91c1c'
  };
};

const legendItems: LegendItem[] = [
  { label: 'No orders', color: MAP_BASE_COLOR, border: MAP_BOUNDARY_COLOR },
  { label: 'Low', color: '#bbf7d0', border: MAP_BOUNDARY_COLOR },
  { label: 'Medium', color: '#7dd3fc', border: MAP_BOUNDARY_COLOR },
  { label: 'High', color: '#fbbf24', border: MAP_BOUNDARY_COLOR },
  { label: 'Very high', color: '#dc2626', border: MAP_BOUNDARY_COLOR },
  { label: 'Selected', color: MAP_SELECTED_COLOR, border: MAP_SELECTED_COLOR, selected: true }
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
  onSelect,
  onOpenMatrix
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ pointerId: number; clientX: number; clientY: number; viewport: MapViewport } | null>(null);
  const suppressClickRef = useRef(false);
  const [hovered, setHovered] = useState<HoverInfo | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [showBranchMarkers, setShowBranchMarkers] = useState(true);
  const [showServiceRings, setShowServiceRings] = useState(true);
  const [showServedBlocks, setShowServedBlocks] = useState(true);
  const [colorMode, setColorMode] = useState<MapColorMode>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchError, setSearchError] = useState('');
  const [viewport, setViewport] = useState<MapViewport>(INITIAL_VIEWPORT);

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
    setSearchError('');
  };

  const focusSelected = () => {
    if (selectedPath) focusPath(selectedPath);
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const key = searchTerm.trim();
    if (!key) {
      setSearchError('');
      return;
    }
    const path = pathByBlockNumber.get(key);
    if (!path) {
      setSearchError('Block is not available in the loaded geometry.');
      return;
    }
    setSearchError('');
    if (path.block) onSelect(path.block);
    focusPath(path, path.block ? 92 : 120);
  };

  useEffect(() => {
    if (!selectedPath) return;
    focusPath(selectedPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath?.blockNumber]);

  const branchMarkers = useMemo<BranchMarkerRow[]>(() => {
    if (!projection || branchProfiles.length === 0) return [];

    const mapped = branchProfiles
      .filter(profile => profile.isDeliveryEnabled !== false)
      .map(profile => {
        const marker = getBranchMarkerPoint(dataset, profile.branchCode || profile.branchName || profile.branchId, profile.originBlockNumber);
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

    const groups = new Map<string, Array<{ profile: BranchDeliveryProfile; originBlockNumber: string; x: number; y: number }>>();
    for (const row of mapped) {
      const group = groups.get(row.originBlockNumber) || [];
      group.push(row);
      groups.set(row.originBlockNumber, group);
    }

    const result: BranchMarkerRow[] = [];
    for (const group of groups.values()) {
      const count = group.length;
      group.forEach((row, index) => {
        const angle = count === 1 ? 0 : (Math.PI * 2 * index) / count - Math.PI / 2;
        const offset = count === 1 ? 0 : 14;
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
    setHovered({
      blockNumber: row.blockNumber,
      areaName: block?.areaName,
      orderCount: block?.orderCount || 0,
      dominantBranchName: block?.dominantBranchName,
      zoneLabel: block ? zoneTone(blockZoneAnalysis?.get(block.blockNumber)?.zone).label : undefined,
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
    <div className={compact ? 'space-y-3' : 'space-y-4 p-4 md:p-5'}>
      {!compact && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm">
                  <MapPinned className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-slate-950">Bahrain Block Delivery Coverage</h3>
                  <p className="text-xs font-bold leading-5 text-slate-500">
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

          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-start">
            <form onSubmit={handleSearchSubmit} className="min-w-0">
              <div className="flex h-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/10">
                <div className="flex w-10 items-center justify-center text-slate-400">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  value={searchTerm}
                  onChange={event => {
                    setSearchTerm(event.target.value);
                    if (searchError) setSearchError('');
                  }}
                  placeholder="Search block number"
                  className="min-w-0 flex-1 bg-transparent pr-2 text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400"
                />
                {searchTerm && (
                  <button
                    type="button"
                    title="Clear block search"
                    aria-label="Clear block search"
                    onClick={() => {
                      setSearchTerm('');
                      setSearchError('');
                    }}
                    className="flex w-9 items-center justify-center text-slate-400 transition hover:text-brand"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button type="submit" className="bg-slate-950 px-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-brand">
                  Find
                </button>
              </div>
              {searchError ? (
                <p className="mt-1.5 text-[11px] font-bold text-amber-700">{searchError}</p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hot blocks</span>
                  {topServedBlocks.map(block => (
                    <button
                      key={block.blockNumber}
                      type="button"
                      onClick={() => {
                        setSearchTerm(block.blockNumber);
                        onSelect(block);
                        const path = pathByBlockNumber.get(block.blockNumber.trim());
                        if (path) focusPath(path);
                      }}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-600 transition hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
                    >
                      #{block.blockNumber}
                    </button>
                  ))}
                </div>
              )}
            </form>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
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
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-white hover:text-slate-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <MapIconButton label="Zoom in" icon={<ZoomIn className="h-4 w-4" />} onClick={() => zoomBy(0.82)} />
              <MapIconButton label="Zoom out" icon={<ZoomOut className="h-4 w-4" />} onClick={() => zoomBy(1.18)} />
              <MapIconButton label="Recenter map" icon={<RotateCcw className="h-4 w-4" />} onClick={resetViewport} />
              <MapIconButton label="Focus selected block" icon={<Navigation className="h-4 w-4" />} disabled={!selectedPath} onClick={focusSelected} />
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

      <div className={compact ? 'grid grid-cols-1' : 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]'}>
        <div>
          <div ref={mapRef} className="relative overflow-hidden rounded-lg border border-slate-200 bg-[#f9eee9] shadow-inner">
            {!compact && <div className="absolute left-3 top-3 z-10 hidden rounded-lg border border-white/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur md:block">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <MousePointer2 className="h-3.5 w-3.5" />
                Hover, click, wheel to zoom
              </p>
            </div>}
            {!compact && <div className="absolute right-3 top-3 z-10 hidden max-w-[280px] flex-wrap gap-1 rounded-lg border border-white/80 bg-white/90 p-1 shadow-sm backdrop-blur print:hidden md:flex">
              <MapToggle label="Branch Markers" checked={showBranchMarkers} onToggle={() => setShowBranchMarkers(v => !v)} />
              <MapToggle label="Service Rings" checked={showServiceRings && branchMarkers.length > 0} disabled={branchMarkers.length === 0} onToggle={() => setShowServiceRings(v => !v)} />
              <MapToggle label="Served Blocks" checked={showServedBlocks} onToggle={() => setShowServedBlocks(v => !v)} />
            </div>}

            {!compact && <div className="absolute bottom-3 left-3 z-10 hidden grid grid-cols-3 gap-1 rounded-lg border border-white/80 bg-white/90 p-1 shadow-sm backdrop-blur print:hidden md:grid">
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
                    @media (prefers-reduced-motion: reduce) {
                      .delivery-zone-ring { animation: none; }
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
                const selected = selectedBlock?.blockNumber === row.blockNumber;
                const hoveredBlock = hovered?.blockNumber === row.blockNumber;
                const tone = activityTone(block?.orderCount || 0, mapMaxOrders);
                const zone = block ? blockZoneAnalysis?.get(block.blockNumber)?.zone : undefined;
                const zoneStyle = zoneTone(zone);
                const interactive = !!block;
                const dimmedByGovernorate = !!highlightedGovernorate
                  && !!block
                  && (block.governorate || 'Unknown') !== highlightedGovernorate;
                const highlightedByGovernorate = !!highlightedGovernorate
                  && !!block
                  && (block.governorate || 'Unknown') === highlightedGovernorate;

                return (
                  <path
                    key={row.blockNumber}
                    d={row.d}
                    role={interactive ? 'button' : 'img'}
                    tabIndex={interactive ? 0 : -1}
                    aria-label={
                      interactive
                        ? `Block ${row.blockNumber}, ${block.orderCount} delivery orders`
                        : `Block ${row.blockNumber}, no delivery orders`
                    }
                    aria-pressed={interactive ? selected : undefined}
                    onClick={event => {
                      if (suppressClickRef.current) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                      }
                      if (block) onSelect(block);
                    }}
                    onKeyDown={event => {
                      if (!block) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect(block);
                      }
                    }}
                    onMouseEnter={event => handleHover(event, row)}
                    onMouseMove={event => handleHover(event, row)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      fill: selected
                        ? MAP_SELECTED_COLOR
                        : !showServedBlocks
                          ? MAP_BASE_COLOR
                          : colorMode === 'zones'
                            ? (hoveredBlock ? zoneStyle.hoverFill : zoneStyle.fill)
                            : (hoveredBlock ? tone.hoverFill : tone.fill),
                      stroke: selected
                        ? '#020617'
                        : highlightedByGovernorate
                          ? '#7f1d1d'
                          : hoveredBlock
                            ? MAP_ACTIVE_BOUNDARY_COLOR
                            : colorMode === 'zones'
                              ? zoneStyle.stroke
                              : MAP_BOUNDARY_COLOR,
                      strokeWidth: selected ? 2.2 : highlightedByGovernorate ? 1.8 : hoveredBlock ? 1.45 : 0.8,
                      opacity: dimmedByGovernorate ? 0.32 : 1,
                      cursor: isPanning ? 'grabbing' : 'grab',
                      filter: selected ? 'url(#selected-block-shadow)' : undefined,
                      transition: 'fill 140ms ease, stroke 140ms ease, stroke-width 140ms ease, opacity 140ms ease, filter 140ms ease'
                    }}
                  >
                    <title>
                      {`Block ${row.blockNumber} | ${block?.orderCount || 0} orders${block?.dominantBranchName ? ` | ${block.dominantBranchName}` : ''}`}
                    </title>
                  </path>
                );
              })}
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
                const code = compactBranchCode(marker.profile);
                const fontSize = code.length > 3 ? 4.3 : code.length > 2 ? 4.9 : 5.5;
                const connectorX = (marker.x - marker.markerX) / branchMarkerScale;
                const connectorY = (marker.y - marker.markerY) / branchMarkerScale;
                return (
                  <g
                    key={marker.key}
                    transform={`translate(${marker.markerX.toFixed(1)} ${marker.markerY.toFixed(1)}) scale(${branchMarkerScale.toFixed(3)})`}
                    pointerEvents="none"
                    aria-hidden="true"
                  >
                    <title>
                      {`${code}${marker.profile.branchName ? ` | ${marker.profile.branchName}` : ''} | Origin block ${marker.originBlockNumber} | ${marker.profile.isDeliveryEnabled ? 'Delivery enabled' : 'Delivery disabled'} | Core ${marker.profile.coreRadiusKm}km, Standard ${marker.profile.standardRadiusKm}km, Extended ${marker.profile.extendedRadiusKm}km${marker.duplicateCount > 1 ? ` | Cluster ${marker.duplicateIndex + 1}/${marker.duplicateCount}` : ''}`}
                    </title>
                    <line
                      x1={connectorX.toFixed(1)}
                      y1={connectorY.toFixed(1)}
                      x2="0"
                      y2="0"
                      stroke="#7f1d1d"
                      strokeWidth="0.8"
                      opacity={marker.duplicateCount > 1 ? 0.38 : 0}
                    />
                    <circle r="5.2" fill="#991b1b" stroke="#ffffff" strokeWidth="1.25" />
                    <circle r="1.15" fill="#ffffff" opacity="0.2" />
                    <text
                      x="0"
                      y="1.7"
                      textAnchor="middle"
                      fontSize={fontSize}
                      fontWeight="800"
                      fill="#ffffff"
                    >
                      {code}
                    </text>
                  </g>
                );
              })}
            </svg>

            {hovered && (
              <div
                className="pointer-events-none absolute z-20 max-w-[220px] rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white shadow-lg"
                style={{ left: Math.min(hovered.x, 520), top: hovered.y }}
              >
                <p className="text-xs font-black">Block {hovered.blockNumber}</p>
                <p className="mt-0.5 text-[11px] font-bold text-slate-200">
                  {hovered.orderCount} orders{hovered.areaName ? ` | ${hovered.areaName}` : ''}
                </p>
                {hovered.dominantBranchName && (
                  <p className="mt-0.5 text-[10px] font-bold text-slate-300">Top branch: {hovered.dominantBranchName}</p>
                )}
                {hovered.zoneLabel && (
                  <p className="mt-0.5 text-[10px] font-bold text-slate-300">Zone: {hovered.zoneLabel}</p>
                )}
              </div>
            )}
          </div>

          {!compact && <div className="mt-3 flex flex-wrap items-center gap-2">
            {(colorMode === 'zones' ? zoneLegendItems : legendItems).map(item => (
              <div key={item.label} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-600">
                <span
                  className={`h-3 w-5 rounded-sm border ${item.dashed ? 'border-dashed' : ''} ${item.selected ? 'ring-1 ring-slate-900 ring-offset-1' : ''}`}
                  style={{ backgroundColor: item.color, borderColor: item.border }}
                />
                {item.label}
              </div>
            ))}
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              {colorMode === 'zones' ? 'Service-zone layer' : 'Order-demand layer'}
            </span>
          </div>}
        </div>

        {!compact && <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          {selectedBlock ? (
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selected block</p>
                    <h4 className="mt-1 text-2xl font-black tracking-tight text-slate-950">#{selectedBlock.blockNumber}</h4>
                  </div>
                  <TrendPill trend={selectedBlock.trend} />
                </div>
                <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                  {selectedBlock.areaName || 'Unresolved area'}
                  {selectedBlock.governorate ? ` | ${selectedBlock.governorate}` : ''}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StatChip label="Orders" value={`${selectedBlock.orderCount}`} />
                <StatChip label="Located share" value={formatPct(selectedBlock.shareOfTotal)} />
                <StatChip label="Map status" value="Mapped" tone="good" />
              </div>

              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Dominant branch</p>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-800">
                  {selectedBlock.dominantBranchName || 'No dominant branch'}
                </div>
              </div>

              {blockZoneAnalysis?.get(selectedBlock.blockNumber) && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
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

              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Branch breakdown</p>
                <div className="space-y-1.5">
                  {selectedBlock.branchBreakdown.map(branch => {
                    const share = selectedBlock.orderCount ? branch.orderCount / selectedBlock.orderCount : 0;
                    return (
                      <div key={branch.branchId} className="rounded-lg border border-slate-200 bg-white p-2">
                        <div className="flex items-center justify-between gap-2 text-xs font-bold">
                          <span className="truncate text-slate-700">{branch.branchName}</span>
                          <span className="shrink-0 text-slate-500 tabular-nums">{branch.orderCount} orders</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, share * 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Recommended action</p>
                <p className="mt-1 text-xs font-bold leading-5 text-blue-900">
                  {selectedRecommendation?.recommendedAction || 'No automatic recommendation for this block in the selected period.'}
                </p>
              </div>

              {onOpenMatrix && (
                <button type="button" onClick={onOpenMatrix} className="btn-secondary w-full text-[10px] uppercase tracking-widest">
                  <Grid3x3 className="h-3.5 w-3.5" />
                  View matrix details
                </button>
              )}
            </div>
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-slate-300 shadow-sm">
                <MousePointer2 className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-black text-slate-800">Select a block on the map</p>
              <p className="mt-1 max-w-[240px] text-xs font-bold leading-5 text-slate-400">
                Inspect delivery activity, branch breakdown, trend, and any recommendation for a served block.
              </p>
            </div>
          )}
        </aside>}
      </div>
    </div>
  );
};
