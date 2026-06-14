import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, MapPinned, RefreshCcw, Truck } from 'lucide-react';
import { branchDeliveryProfileService } from '../../services/branchDeliveryProfileService';
import { deliveryCoverageService } from '../../services/deliveryCoverageService';
import { Branch, BranchDeliveryProfile, DeliveryBlockMetric, DeliveryCoverageSummary } from '../../types';
import { BlockCoverageMap } from '../delivery/components/BlockCoverageMap';
import { BlockGeometryDataset, loadBahrainBlockGeometry } from '../delivery/bahrainBlockGeometry';

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const last30Days = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: toDateKey(from), to: toDateKey(to) };
};

interface BranchCoverageMapWidgetProps {
  user: Branch | null;
  onOpenDelivery?: () => void;
}

export const BranchCoverageMapWidget: React.FC<BranchCoverageMapWidgetProps> = ({ user, onOpenDelivery }) => {
  const [summary, setSummary] = useState<DeliveryCoverageSummary | null>(null);
  const [geometry, setGeometry] = useState<BlockGeometryDataset | null>(null);
  const [profiles, setProfiles] = useState<BranchDeliveryProfile[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<DeliveryBlockMetric | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const branchId = user?.role === 'branch' ? user.id : null;
  const scopeLabel = branchId
    ? `${user?.code || 'Branch'} - ${user?.name || 'Current branch'}`
    : 'All visible branches';

  const range = useMemo(() => last30Days(), []);

  const loadCoverage = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    setSelectedBlock(null);

    try {
      const [dataset, bundle, profileRows] = await Promise.all([
        loadBahrainBlockGeometry(),
        deliveryCoverageService.getDeliveryCoverageBundle({
          dateFrom: range.from,
          dateTo: range.to,
          branchId: branchId || undefined
        }),
        branchId
          ? branchDeliveryProfileService.getBranchDeliveryProfile(branchId).then(profile => profile ? [profile] : [])
          : branchDeliveryProfileService.listBranchDeliveryProfiles()
      ]);

      setGeometry(dataset);
      setSummary(bundle.summary);
      setProfiles(profileRows);
    } catch (loadError: any) {
      setGeometry(null);
      setSummary(null);
      setProfiles([]);
      setError(loadError?.message || 'Could not load branch coverage map.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCoverage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, range.from, range.to, user?.id]);

  const mappableBlocks = useMemo(
    () => geometry?.available && summary
      ? summary.blocks.filter(block => geometry.byBlock.has(block.blockNumber.trim()))
      : [],
    [geometry, summary]
  );

  const geometryStats = useMemo(() => {
    if (!geometry?.available || !summary) return { matched: 0, total: 0, unmatched: 0 };
    const matched = summary.blocks.filter(block => geometry.byBlock.has(block.blockNumber.trim())).length;
    return {
      matched,
      total: summary.blocks.length,
      unmatched: Math.max(0, summary.blocks.length - matched)
    };
  }, [geometry, summary]);

  const mapHeightClass = isExpanded
    ? 'h-[330px] sm:h-[380px] xl:h-[420px]'
    : 'h-[185px] sm:h-[220px] xl:h-[250px]';

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand/10 bg-brand/5 text-brand">
              <MapPinned className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-brand">Bahrain block map</p>
              <h4 className="truncate text-sm font-black text-slate-900">Branch delivery coverage</h4>
              <p className="truncate text-[11px] font-bold text-slate-500">
                {scopeLabel} | Last 30 days | map only
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {onOpenDelivery && (
              <button type="button" onClick={onOpenDelivery} title="Open Delivery Coverage" className="btn-secondary h-8 px-2 text-[10px] uppercase tracking-widest">
                <Truck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Delivery</span>
              </button>
            )}
            <button type="button" onClick={loadCoverage} disabled={isLoading} title="Refresh coverage map" className="btn-secondary h-8 px-2 text-[10px] uppercase tracking-widest">
              <RefreshCcw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(value => !value)}
              aria-expanded={isExpanded}
              className="btn-secondary h-8 px-2 text-[10px] uppercase tracking-widest"
            >
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{isExpanded ? 'Less' : 'More'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-2.5">
        {isLoading ? (
          <div className={`${mapHeightClass} animate-pulse rounded-lg border border-slate-200 bg-slate-100`} />
        ) : error ? (
          <div className={`flex ${mapHeightClass} items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-sm font-bold text-amber-900`}>
            <div>
              <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-amber-600" />
              {error}
            </div>
          </div>
        ) : !geometry?.available || !summary ? (
          <div className={`flex ${mapHeightClass} items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm font-bold text-slate-500`}>
            Bahrain block geometry is unavailable. The full Delivery Coverage module still keeps its matrix fallback.
          </div>
        ) : (
          <BlockCoverageMap
            compact
            compactMapHeightClass={mapHeightClass}
            dataset={geometry}
            blocks={mappableBlocks}
            branchProfiles={profiles}
            summary={summary}
            selectedBlock={selectedBlock}
            geometryStats={geometryStats}
            onSelect={setSelectedBlock}
          />
        )}
      </div>
    </div>
  );
};
