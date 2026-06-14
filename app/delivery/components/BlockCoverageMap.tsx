import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Grid3x3,
  Info,
  MapPinned,
  MousePointer2,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { DeliveryBlockMetric, DeliveryCoverageRecommendation, DeliveryCoverageSummary } from '../../../types';
import { BlockGeometryDataset } from '../bahrainBlockGeometry';

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
  maxOrders: number;
  summary: DeliveryCoverageSummary;
  selectedBlock: DeliveryBlockMetric | null;
  geometryStats: {
    matched: number;
    total: number;
    unmatched: number;
  };
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

type Ring = Array<[number, number]>;

type HoverInfo = {
  blockNumber: string;
  areaName?: string | null;
  orderCount: number;
  dominantBranchName?: string;
  x: number;
  y: number;
};

type PathRow = {
  blockNumber: string;
  block?: DeliveryBlockMetric;
  d: string;
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
      fill: '#f8fafc',
      stroke: '#e2e8f0',
      textClass: 'text-slate-500'
    };
  }
  if (ratio <= 0.25) {
    return {
      label: 'Low',
      fill: '#bbf7d0',
      stroke: '#86efac',
      textClass: 'text-emerald-700'
    };
  }
  if (ratio <= 0.5) {
    return {
      label: 'Medium',
      fill: '#7dd3fc',
      stroke: '#38bdf8',
      textClass: 'text-sky-700'
    };
  }
  if (ratio <= 0.75) {
    return {
      label: 'High',
      fill: '#fbbf24',
      stroke: '#f59e0b',
      textClass: 'text-amber-700'
    };
  }
  return {
    label: 'Very high',
    fill: '#dc2626',
    stroke: '#991b1b',
    textClass: 'text-red-700'
  };
};

const legendItems = [
  { label: 'No orders', color: '#f8fafc', border: '#cbd5e1' },
  { label: 'Low', color: '#bbf7d0', border: '#86efac' },
  { label: 'Medium', color: '#7dd3fc', border: '#38bdf8' },
  { label: 'High', color: '#fbbf24', border: '#f59e0b' },
  { label: 'Very high', color: '#dc2626', border: '#991b1b' },
  { label: 'Selected', color: '#111827', border: '#111827', selected: true },
  { label: 'Unmapped served', color: '#fff7ed', border: '#fb923c', dashed: true }
];

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
  maxOrders,
  summary,
  selectedBlock,
  geometryStats,
  onSelect,
  onOpenMatrix
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<HoverInfo | null>(null);

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

  const paths = useMemo(() => {
    if (!bounds) return [];
    const { minX, maxX, minY, maxY } = bounds;
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const scale = Math.min((VIEW_W - PAD * 2) / spanX, (VIEW_H - PAD * 2) / spanY);
    const offX = PAD + ((VIEW_W - PAD * 2) - spanX * scale) / 2;
    const offY = PAD + ((VIEW_H - PAD * 2) - spanY * scale) / 2;
    const px = (x: number) => offX + (x - minX) * scale;
    const py = (y: number) => offY + (maxY - y) * scale;

    const result: PathRow[] = [];
    for (const feature of dataset.byBlock.values()) {
      let d = '';
      for (const ring of ringsOf(feature.geometry)) {
        if (ring.length === 0) continue;
        d += 'M' + ring.map(([x, y]) => `${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join(' L') + 'Z';
      }
      if (d) {
        const block = blocksByNumber.get(feature.blockNumber.trim());
        result.push({ blockNumber: feature.blockNumber, block, d });
      }
    }

    return result.sort((a, b) => (a.block?.orderCount || 0) - (b.block?.orderCount || 0));
  }, [blocksByNumber, bounds, dataset]);

  const selectedRecommendation = useMemo<DeliveryCoverageRecommendation | undefined>(
    () => selectedBlock
      ? summary.recommendedActions.find(action => action.blockNumber === selectedBlock.blockNumber)
      : undefined,
    [selectedBlock, summary.recommendedActions]
  );

  const emptyOrders = summary.totalOrders === 0;

  const handleHover = (event: React.MouseEvent<SVGPathElement>, row: PathRow) => {
    const rect = mapRef.current?.getBoundingClientRect();
    const block = row.block;
    if (!rect) return;
    setHovered({
      blockNumber: row.blockNumber,
      areaName: block?.areaName,
      orderCount: block?.orderCount || 0,
      dominantBranchName: block?.dominantBranchName,
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
    <div className="space-y-4 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <MapPinned className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-slate-950">Bahrain Block Delivery Coverage</h3>
              <p className="text-xs font-bold leading-5 text-slate-500">
                Real block geometry loaded for internal operational analysis.
              </p>
            </div>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Internal-use geometry dataset
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <StatChip label="Geometry blocks" value={`${dataset.featureCount}`} tone="good" />
        <StatChip label="Mapped served" value={`${geometryStats.matched}`} tone="good" />
        <StatChip label="Unmapped served" value={`${geometryStats.unmatched}`} tone={geometryStats.unmatched > 0 ? 'warn' : 'neutral'} />
        <StatChip label="Unknown block orders" value={`${summary.unknownBlockOrders}`} tone={summary.unknownBlockOrders > 0 ? 'warn' : 'neutral'} />
        <StatChip label="Unresolved blocks" value={`${summary.unresolvedBlockOrders}`} tone={summary.unresolvedBlockOrders > 0 ? 'warn' : 'neutral'} />
      </div>

      {emptyOrders && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>No delivery orders found for the selected filters. Adjust the date range or branch filter.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div ref={mapRef} className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            <div className="absolute left-3 top-3 z-10 hidden rounded-lg border border-white/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur md:block">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <MousePointer2 className="h-3.5 w-3.5" />
                Hover for details
              </p>
            </div>

            <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-auto w-full" role="img" aria-label="Bahrain block delivery coverage map">
              <defs>
                <filter id="selected-block-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.28" />
                </filter>
              </defs>
              <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="#f8fafc" />
              {paths.map(row => {
                const block = row.block;
                const selected = selectedBlock?.blockNumber === row.blockNumber;
                const hoveredBlock = hovered?.blockNumber === row.blockNumber;
                const tone = activityTone(block?.orderCount || 0, maxOrders);
                const interactive = !!block;

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
                    onClick={() => { if (block) onSelect(block); }}
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
                      fill: selected ? '#111827' : tone.fill,
                      stroke: selected ? '#020617' : hoveredBlock ? '#0f172a' : tone.stroke,
                      strokeWidth: selected ? 2.2 : hoveredBlock ? 1.4 : 0.55,
                      cursor: interactive ? 'pointer' : 'default',
                      filter: selected ? 'url(#selected-block-shadow)' : undefined,
                      transition: 'fill 140ms ease, stroke 140ms ease, stroke-width 140ms ease, filter 140ms ease'
                    }}
                  >
                    <title>
                      {`Block ${row.blockNumber} | ${block?.orderCount || 0} orders${block?.dominantBranchName ? ` | ${block.dominantBranchName}` : ''}`}
                    </title>
                  </path>
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
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {legendItems.map(item => (
              <div key={item.label} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-600">
                <span
                  className={`h-3 w-5 rounded-sm border ${item.dashed ? 'border-dashed' : ''} ${item.selected ? 'ring-1 ring-slate-900 ring-offset-1' : ''}`}
                  style={{ backgroundColor: item.color, borderColor: item.border }}
                />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
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
        </aside>
      </div>
    </div>
  );
};
