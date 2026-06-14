import React, { useState } from 'react';
import { AlertTriangle, ArrowUpRight, ClipboardCheck, Layers, Loader2, ShieldAlert, Target, TrendingDown, TrendingUp } from 'lucide-react';
import {
  DeliveryAdvancedCoverage,
  DeliveryBranchCatchment,
  DeliveryBranchOverlap,
  DeliveryCampaignOpportunity,
  DeliveryCapacityClass,
  DeliveryCapacityPressure,
  DeliveryCoverageInsightSeverity,
  DeliveryCoverageInsightType,
  DeliveryExpansionCandidate,
  DeliveryWhiteSpace
} from '../../../types';

export interface CoverageTaskRequest {
  insightId: string;
  insightType: DeliveryCoverageInsightType;
  relatedRecordType: 'delivery_block' | 'branch_coverage' | 'delivery_insight';
  relatedRecordId: string;
  title: string;
  description: string;
  severity: DeliveryCoverageInsightSeverity;
  branchId?: string;
  branchName?: string;
  blockNumber?: string;
  recommendedAction: string;
}

interface SectionCommon {
  canCreateTask: boolean;
  onCreateTask: (req: CoverageTaskRequest) => Promise<void>;
  busyInsightId: string | null;
}

const sevClass = (s: DeliveryCoverageInsightSeverity) =>
  s === 'critical' ? 'border-red-300 bg-red-50 text-red-700'
    : s === 'high' ? 'border-red-200 bg-red-50 text-red-700'
      : s === 'medium' ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-slate-50 text-slate-600';

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="py-8 text-center text-xs font-bold text-slate-400">{children}</p>
);

const CreateTaskButton: React.FC<SectionCommon & { req: CoverageTaskRequest }> = ({ canCreateTask, onCreateTask, busyInsightId, req }) => {
  if (!canCreateTask) return null;
  const busy = busyInsightId === req.insightId;
  return (
    <button
      onClick={() => onCreateTask(req)}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardCheck className="h-3 w-3" />}
      Create task
    </button>
  );
};

// ---- Campaign Opportunities ----
export const CampaignOpportunitiesSection: React.FC<SectionCommon & { items: DeliveryCampaignOpportunity[]; suppressed: boolean }> = ({ items, suppressed, ...common }) => (
  <section className="operational-panel p-4 md:p-5">
    <div className="mb-3 flex items-center gap-2">
      <Target className="h-4 w-4 text-brand" />
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Campaign opportunities</h3>
    </div>
    {suppressed ? (
      <Empty>Insufficient or low-quality data — confident campaign recommendations are suppressed for this period.</Empty>
    ) : items.length === 0 ? (
      <Empty>No campaign opportunities detected in this period.</Empty>
    ) : (
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.insightId} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-800">
                  Block {item.blockNumber}{item.areaName ? ` · ${item.areaName}` : ''}
                  <span className={`ml-2 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase ${sevClass(item.severity)}`}>{item.severity}</span>
                  <span className="ml-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-500">conf: {item.confidence}</span>
                </p>
                <p className="mt-0.5 text-[11px] font-bold leading-5 text-slate-600">{item.reason}</p>
                <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">→ {item.recommendedAction}</p>
              </div>
              <CreateTaskButton {...common} req={{
                insightId: item.insightId,
                insightType: 'campaign_opportunity',
                relatedRecordType: 'delivery_block',
                relatedRecordId: item.blockNumber,
                title: `Review campaign opportunity for Block ${item.blockNumber}`,
                description: item.reason,
                severity: item.severity,
                blockNumber: item.blockNumber,
                recommendedAction: item.recommendedAction
              }} />
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

// ---- Branch Catchment ----
const tierBadge = (tier: string) =>
  tier === 'primary' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : tier === 'secondary' ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-slate-50 text-slate-500 border-slate-200';

export const BranchCatchmentSection: React.FC<{ items: DeliveryBranchCatchment[] }> = ({ items }) => (
  <section className="operational-panel p-4 md:p-5">
    <div className="mb-3 flex items-center gap-2">
      <Layers className="h-4 w-4 text-brand" />
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Branch catchment</h3>
    </div>
    {items.length === 0 ? (
      <Empty>No branch delivery activity in this period.</Empty>
    ) : (
      <div className="space-y-3">
        {items.map(b => (
          <div key={b.branchId} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-800">{b.branchName}</p>
              <p className="text-[11px] font-bold text-slate-500">
                {b.totalOrders} orders · {b.uniqueBlocks} blocks · {Math.round(b.shareOfTotal * 100)}% of volume
              </p>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              {([['primary', b.primaryBlocks], ['secondary', b.secondaryBlocks], ['weak', b.weakBlocks]] as const).map(([tier, blocks]) => (
                <div key={tier}>
                  <p className={`mb-1 inline-block rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase ${tierBadge(tier)}`}>{tier} ({blocks.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {blocks.length === 0 ? <span className="text-[10px] font-bold text-slate-300">—</span> : blocks.slice(0, 8).map(bl => (
                      <span key={bl.blockNumber} title={`${bl.orderCount} orders · ${Math.round(bl.shareOfBranch * 100)}%`} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 tabular-nums">
                        #{bl.blockNumber}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

// ---- Branch Overlap ----
export const BranchOverlapSection: React.FC<SectionCommon & { items: DeliveryBranchOverlap[] }> = ({ items, ...common }) => (
  <section className="operational-panel p-4 md:p-5">
    <div className="mb-3 flex items-center gap-2">
      <ShieldAlert className="h-4 w-4 text-brand" />
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Branch overlap / cannibalization</h3>
    </div>
    {items.length === 0 ? (
      <Empty>No blocks are served by more than one branch in this period.</Empty>
    ) : (
      <div className="space-y-2">
        {items.map(o => (
          <div key={o.insightId} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-800">
                  Block {o.blockNumber}{o.areaName ? ` · ${o.areaName}` : ''}
                  <span className={`ml-2 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase ${sevClass(o.severity)}`}>{o.severity}</span>
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {o.branches.map(br => (
                    <span key={br.branchId} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {br.branchName} {Math.round(br.sharePct)}%
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">→ {o.recommendedAction}</p>
              </div>
              <CreateTaskButton {...common} req={{
                insightId: o.insightId,
                insightType: 'branch_overlap',
                relatedRecordType: 'delivery_block',
                relatedRecordId: o.blockNumber,
                title: `Review delivery overlap in Block ${o.blockNumber}`,
                description: `Served by ${o.branches.length} branches (${o.branches.map(b => `${b.branchName} ${Math.round(b.sharePct)}%`).join(', ')}).`,
                severity: o.severity,
                blockNumber: o.blockNumber,
                recommendedAction: o.recommendedAction
              }} />
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

// ---- Capacity Pressure ----
const capClass = (c: DeliveryCapacityClass) =>
  c === 'overloaded' ? 'border-red-200 bg-red-50 text-red-700'
    : c === 'high_pressure' ? 'border-amber-200 bg-amber-50 text-amber-700'
      : c === 'watch' ? 'border-blue-200 bg-blue-50 text-blue-700'
        : c === 'insufficient_data' ? 'border-slate-200 bg-white text-slate-400'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700';

export const CapacityPressureSection: React.FC<SectionCommon & { items: DeliveryCapacityPressure[] }> = ({ items, ...common }) => (
  <section className="operational-panel p-4 md:p-5">
    <div className="mb-3 flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 text-brand" />
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Branch capacity pressure</h3>
    </div>
    {items.length === 0 ? (
      <Empty>No branch activity in this period.</Empty>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
              <th className="py-2 pr-3">Branch</th>
              <th className="py-2 pr-3 text-right">Orders</th>
              <th className="py-2 pr-3 text-right">Blocks</th>
              <th className="py-2 pr-3 text-right">Outside gov.</th>
              <th className="py-2 pr-3 text-right">Unknown</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {items.map(c => (
              <tr key={c.insightId} className="hover:bg-slate-50/50">
                <td className="py-2 pr-3 font-black text-slate-800">{c.branchName}</td>
                <td className="py-2 pr-3 text-right font-bold tabular-nums">{c.orderCount}</td>
                <td className="py-2 pr-3 text-right font-bold tabular-nums">{c.uniqueBlocks}</td>
                <td className="py-2 pr-3 text-right font-bold tabular-nums">{Math.round(c.outsideGovernoratePct * 100)}%</td>
                <td className="py-2 pr-3 text-right font-bold tabular-nums">{Math.round(c.unknownBlockRate * 100)}%</td>
                <td className="py-2 pr-3"><span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${capClass(c.classification)}`}>{c.classification.replace('_', ' ')}</span></td>
                <td className="py-2 pr-3 text-right">
                  {(c.classification === 'high_pressure' || c.classification === 'overloaded') && (
                    <CreateTaskButton {...common} req={{
                      insightId: c.insightId,
                      insightType: 'capacity_pressure',
                      relatedRecordType: 'branch_coverage',
                      relatedRecordId: c.branchId,
                      title: `Review capacity pressure for ${c.branchName}`,
                      description: c.recommendedAction,
                      severity: c.classification === 'overloaded' ? 'high' : 'medium',
                      branchId: c.branchId,
                      branchName: c.branchName,
                      recommendedAction: c.recommendedAction
                    }} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

// ---- Expansion Review ----
export const ExpansionReviewSection: React.FC<SectionCommon & { items: DeliveryExpansionCandidate[] }> = ({ items, ...common }) => (
  <section className="operational-panel p-4 md:p-5">
    <div className="mb-1 flex items-center gap-2">
      <ArrowUpRight className="h-4 w-4 text-brand" />
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Expansion review candidates</h3>
    </div>
    <p className="mb-3 text-[11px] font-medium text-slate-500">
      Cautious, evidence-based candidates for further review only — never a decision to open a branch. Geographic clustering of nearby blocks needs real GeoJSON geometry; scores below are per-block.
    </p>
    {items.length === 0 ? (
      <Empty>No expansion review candidates with sufficient supporting data in this period.</Empty>
    ) : (
      <div className="space-y-2">
        {items.map(e => (
          <div key={e.insightId} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-800">
                  {e.label}
                  <span className="ml-2 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-violet-700">score {e.score}/100</span>
                </p>
                <ul className="mt-1 list-disc pl-4 text-[11px] font-bold leading-5 text-slate-600">
                  {e.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
                <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">→ {e.recommendedAction}</p>
              </div>
              <CreateTaskButton {...common} req={{
                insightId: e.insightId,
                insightType: 'expansion_candidate',
                relatedRecordType: 'delivery_insight',
                relatedRecordId: e.insightId,
                title: e.blockNumber ? `Review expansion candidate Block ${e.blockNumber}` : `Review expansion candidate ${e.label}`,
                description: `Score ${e.score}/100. ${e.reasons.join('; ')}.`,
                severity: e.severity,
                blockNumber: e.blockNumber,
                recommendedAction: e.recommendedAction
              }} />
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

// ---- Demand Trend (compact lists) ----
export const DemandTrendSection: React.FC<{ advanced: DeliveryAdvancedCoverage }> = ({ advanced }) => {
  const blockTrends = advanced.demandTrends.filter(t => t.scope === 'block');
  const emerging = blockTrends.filter(t => t.classification === 'increasing' || t.classification === 'new_demand').sort((a, b) => b.secondHalf - a.secondHalf).slice(0, 8);
  const declining = blockTrends.filter(t => t.classification === 'decreasing').sort((a, b) => b.firstHalf - a.firstHalf).slice(0, 8);
  const Row: React.FC<{ label: string; cls: string; up?: boolean }> = ({ label, cls, up }) => (
    <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-xs font-bold">
      <span className="truncate text-slate-700">{label}</span>
      <span className={`inline-flex items-center gap-1 ${up ? 'text-emerald-600' : 'text-red-500'}`}>{up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}{cls}</span>
    </div>
  );
  return (
    <section className="operational-panel p-4 md:p-5">
      <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-700">Demand trend</h3>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Emerging blocks</p>
          {emerging.length === 0 ? <Empty>No emerging blocks (or insufficient sample).</Empty> : <div className="space-y-1.5">{emerging.map(t => <Row key={t.key} label={t.label} cls={t.classification.replace('_', ' ')} up />)}</div>}
        </div>
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Declining blocks</p>
          {declining.length === 0 ? <Empty>No declining blocks (or insufficient sample).</Empty> : <div className="space-y-1.5">{declining.map(t => <Row key={t.key} label={t.label} cls="decreasing" />)}</div>}
        </div>
      </div>
    </section>
  );
};

// ---- White space + field availability (Data Quality tab additions) ----
export const WhiteSpaceSection: React.FC<{ whiteSpace: DeliveryWhiteSpace }> = ({ whiteSpace }) => (
  <section className="operational-panel p-4 md:p-5">
    <h3 className="mb-1 text-sm font-black uppercase tracking-widest text-slate-700">White space / low activity</h3>
    <p className="mb-3 text-[11px] font-medium text-slate-500">{whiteSpace.note}</p>
    {whiteSpace.mode === 'true_zero_activity' && (
      <p className="mb-2 text-xs font-black text-slate-700">{whiteSpace.trueZeroCount} directory block(s) had zero orders in scope this period.</p>
    )}
    {whiteSpace.items.length === 0 ? (
      <Empty>No white-space blocks to show.</Empty>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {whiteSpace.items.map(item => (
          <span key={item.blockNumber} title={`${item.areaName || 'Unknown area'} — ${item.note}`} className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500 tabular-nums">
            #{item.blockNumber}{item.orderCount > 0 ? ` (${item.orderCount})` : ''}
          </span>
        ))}
      </div>
    )}
  </section>
);

export const FieldAvailabilitySection: React.FC<{ advanced: DeliveryAdvancedCoverage }> = ({ advanced }) => {
  const fa = advanced.fieldAvailability;
  const rows: Array<{ label: string; ok: boolean; note: string }> = [
    { label: 'Revenue (order value)', ok: fa.revenue, note: 'value_bhd is recorded per order.' },
    { label: 'SLA / delivery timing', ok: fa.deliveryTiming, note: 'Requires order/delivery/promised timestamps — not in delivery_orders. SLA analytics is future work.' },
    { label: 'Delivery status', ok: fa.deliveryStatus, note: 'No status column on delivery_orders. Late/completed analytics is future work.' },
    { label: 'Customer identifier', ok: fa.customerIdentifier, note: 'No safe customer id on delivery_orders. Repeat-customer analytics is future work; no PII is shown.' },
    { label: 'Product / category', ok: fa.productData, note: 'No order-item/category fields on delivery_orders. Product-demand analytics is future work.' }
  ];
  return (
    <section className="operational-panel p-4 md:p-5">
      <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-700">Optional analytics — field availability</h3>
      <div className="space-y-1.5">
        {rows.map(r => (
          <div key={r.label} className="flex items-start justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
            <div>
              <p className="text-xs font-black text-slate-700">{r.label}</p>
              <p className="text-[11px] font-medium text-slate-500">{r.note}</p>
            </div>
            <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${r.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'}`}>
              {r.ok ? 'Available' : 'Unavailable'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};
