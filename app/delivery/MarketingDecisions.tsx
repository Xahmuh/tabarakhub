import { useEffect, useState } from 'react';
import { deliveryService } from '../../services/deliveryService';
import { branchService } from '../../services/branchService';
import type { Branch, DeliveryBlock } from '../../types';
import {
  listMarketingBlockActivity, MARKETING_MIN_BLOCK_ORDERS,
  type MarketingBlock, type MarketingBranch
} from '../../services/deliveryMarketingService';
import { LEGACY_BLOCK_PHARMACY_MAP } from '../block-analyzer/legacyCoverageData';
import { getCompetitorsForBlock } from './utils/noOrdersClassification';
import { rangeDayCount, toDateKey } from './utils';
import { MarketingExperiments, type ExperimentSuggestion } from './MarketingExperiments';

type DateRange = { from: string; to: string };
type Candidate = MarketingBlock & {
  areaName: string;
  branch: MarketingBranch;
  trend: { firstRate: number; secondRate: number } | null;
  comparison: { blockNumber: string; orders: number } | null;
};
type Results = { candidates: Candidate[]; smallSamples: number; readyWithoutCompetitorEvidence: number };

const defaultRange = (): DateRange => {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 89);
  return { from: toDateKey(from), to: toDateKey(to) };
};

const percentage = (count: number, total: number) =>
  new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(count / total);

const hasLimitedTracking = ({ orders, tracked, branch }: Pick<Candidate, 'orders' | 'tracked' | 'branch'>) =>
  tracked < 20 || branch.tracked < 20 || tracked * 2 < orders || branch.tracked * 2 < branch.orders;

function suggestAd({ blockNumber, areaName, orders, tracked, branch, trend }: Candidate) {
  const area = areaName ? `${areaName} (Block ${blockNumber})` : `Block ${blockNumber}`;
  if (hasLimitedTracking({ orders, tracked, branch })) {
    return {
      type: 'Local awareness · short video',
      platform: 'Instagram Reels and Facebook Reels',
      idea: `Show how to check whether ${branch.name} delivers to ${area}, then show the branch’s approved ordering channel.`,
      reason: `The branch recorded ${branch.orders} of ${orders} orders here. With ${tracked}/${orders} tracked in the block and ${branch.tracked}/${branch.orders} at that branch, start by testing awareness without making delivery time promises.`
    };
  }
  if (trend && trend.secondRate >= trend.firstRate * 1.15) {
    return {
      type: 'Search ad · delivery information',
      platform: 'Google Search',
      idea: `Use a headline about delivery from ${branch.name} and link to a page where people can check coverage and how to order for ${area}.`,
      reason: `Daily orders rose from ${trend.firstRate.toFixed(2)} to ${trend.secondRate.toFixed(2)}. This makes it worth testing whether people searching for local delivery use the branch’s ordering channel.`
    };
  }
  return {
    type: 'Local awareness · how-to carousel',
    platform: 'Instagram and Facebook',
    idea: `Create three cards for ${area}: check coverage, reach ${branch.name}, and follow the branch’s ordering steps.`,
    reason: trend
      ? `Daily orders moved from ${trend.firstRate.toFixed(2)} to ${trend.secondRate.toFixed(2)}, with no rise of at least 15%. Test whether clearer ordering instructions help generate more orders.`
      : `There were ${orders} eligible orders, with ${branch.orders} recorded by this branch. There is not enough data to establish a trend, so start with a simple test of ordering instructions.`
  };
}

export function MarketingDecisions({ canEdit }: { canEdit: boolean }) {
  const [range, setRange] = useState(defaultRange);
  const [draft, setDraft] = useState(range);
  const [results, setResults] = useState<Results | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [blocks, setBlocks] = useState<DeliveryBlock[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suggestion, setSuggestion] = useState<ExperimentSuggestion | null>(null);
  const invalidRange = !draft.from || !draft.to || draft.from > draft.to || rangeDayCount(draft.from, draft.to) > 90;

  useEffect(() => {
    let active = true;
    branchService.list().then(list => {
      if (active) setBranches(list.filter(branch => branch.role === 'branch' && branch.code !== 'TEST-01'));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setResults(null);
      setLoadError(false);
      try {
        const days = rangeDayCount(range.from, range.to);
        const firstDays = Math.floor(days / 2);
        const midpoint = new Date(`${range.from}T12:00:00Z`);
        midpoint.setUTCDate(midpoint.getUTCDate() + firstDays - 1);
        const [activity, directory, earlyActivity] = await Promise.all([
          listMarketingBlockActivity(range.from, range.to, controller.signal),
          deliveryService.blocks.list(),
          firstDays >= 7
            ? listMarketingBlockActivity(range.from, midpoint.toISOString().slice(0, 10), controller.signal)
            : null
        ]);
        if (controller.signal.aborted) return;
        setBlocks(directory);
        const areas = new Map(directory.map(block => [block.blockNumber.trim(), block]));
        const comparisonPool = [...activity.values()].filter(block =>
          block.orders >= MARKETING_MIN_BLOCK_ORDERS && areas.has(block.blockNumber)
        );
        const candidates: Candidate[] = [];
        let smallSamples = 0;
        let readyWithoutCompetitorEvidence = 0;
        for (const block of activity.values()) {
          const area = areas.get(block.blockNumber);
          if (!area) continue;
          if (block.orders < MARKETING_MIN_BLOCK_ORDERS) {
            smallSamples++;
            continue;
          }
          if (!getCompetitorsForBlock(block.blockNumber, LEGACY_BLOCK_PHARMACY_MAP).length) {
            readyWithoutCompetitorEvidence++;
            continue;
          }
          const branch = [...block.branches.values()].sort((a, b) =>
            b.orders - a.orders || b.tracked - a.tracked || a.id.localeCompare(b.id)
          )[0];
          if (!branch) continue;
          const firstOrders = earlyActivity?.get(block.blockNumber)?.orders ?? 0;
          const secondOrders = block.orders - firstOrders;
          const trend = earlyActivity && firstOrders >= 10 && secondOrders >= 10
            ? { firstRate: firstOrders / firstDays, secondRate: secondOrders / (days - firstDays) }
            : null;
          const comparison = comparisonPool.filter(other =>
            other.blockNumber !== block.blockNumber &&
            areas.get(other.blockNumber)?.governorate === area.governorate &&
            other.orders >= block.orders / 2 && other.orders <= block.orders * 2
          ).sort((a, b) =>
            Math.abs(a.orders - block.orders) - Math.abs(b.orders - block.orders) ||
            a.blockNumber.localeCompare(b.blockNumber, undefined, { numeric: true })
          )[0];
          candidates.push({
            ...block, areaName: area.areaName, branch, trend,
            comparison: comparison ? { blockNumber: comparison.blockNumber, orders: comparison.orders } : null
          });
        }
        candidates.sort((a, b) => a.orders - b.orders || b.tracked - a.tracked ||
          a.blockNumber.localeCompare(b.blockNumber, undefined, { numeric: true }));
        setResults({ candidates: candidates.slice(0, 3), smallSamples, readyWithoutCompetitorEvidence });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Could not load delivery marketing decisions', error);
          setLoadError(true);
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [range]);

  return (
    <div className="space-y-5">
    <section className="operational-panel space-y-5 p-4 md:p-6" aria-labelledby="marketing-decisions-heading">
      <header className="space-y-1">
        <h3 id="marketing-decisions-heading" className="text-xl font-bold text-slate-950">Marketing Decisions</h3>
        <p className="text-sm text-slate-600">Review blocks for a small campaign test and confirm which branch can serve each block.</p>
      </header>
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault();
        if (!invalidRange) setRange({ ...draft });
      }}>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          From
          <input type="date" required value={draft.from} max={draft.to || undefined}
            onChange={event => setDraft({ ...draft, from: event.target.value })}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-2" />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          To
          <input type="date" required value={draft.to} min={draft.from || undefined}
            onChange={event => setDraft({ ...draft, to: event.target.value })}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-2" />
        </label>
        <button type="submit" className="btn-primary min-h-10 px-4 disabled:opacity-50" disabled={invalidRange}>Apply dates</button>
        {invalidRange && <p className="basis-full text-sm text-red-700">Choose a valid date range of up to 90 days.</p>}
      </form>
      <div className="space-y-3" aria-live="polite">
        <p className="text-sm font-semibold text-slate-700">{range.from} to {range.to}</p>
        {loadError && <p role="alert" className="text-sm text-red-700">Could not load recommendations. Apply the dates again to retry.</p>}
        {!loadError && !results && <p className="text-sm text-slate-600">Loading block activity…</p>}
        {results && (
          <>
            {results.candidates.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {results.candidates.map(candidate => {
                  const { blockNumber, areaName, orders, tracked, branch, trend, comparison } = candidate;
                  const ad = suggestAd(candidate);
                  return (
                  <article key={blockNumber} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                    <h4 className="font-bold text-slate-950">Block {blockNumber}{areaName && ` · ${areaName}`}</h4>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-slate-600">Block sample</dt><dd className="font-bold">{orders} orders</dd></div>
                      <div><dt className="text-slate-600">Block tracking</dt><dd className="font-bold">{percentage(tracked, orders)} ({tracked}/{orders})</dd></div>
                      <div className="col-span-2">
                        <dt className="text-slate-600">Suggested branch</dt>
                        <dd className="font-bold">{branch.name}{branch.code && branch.code !== branch.name && ` · ${branch.code}`}</dd>
                        <dd className="text-slate-600">{branch.orders} of {orders} orders ({percentage(branch.orders, orders)} share) · {percentage(branch.tracked, branch.orders)} tracked</dd>
                      </div>
                      <div className="col-span-2"><dt className="text-slate-600">Order trend</dt><dd className="font-semibold">
                        {trend ? `${trend.firstRate.toFixed(2)} → ${trend.secondRate.toFixed(2)} orders/day` : 'Insufficient data'}
                      </dd></div>
                      <div className="col-span-2"><dt className="text-slate-600">Competitor records</dt><dd>On file · Last verified date unknown</dd></div>
                      <div className="col-span-2"><dt className="text-slate-600">Suggested comparison</dt><dd className="font-semibold">
                        {comparison ? `Block ${comparison.blockNumber} · ${comparison.orders} orders` : 'No similar block found for these dates'}
                      </dd></div>
                    </dl>
                    <p className="text-sm font-semibold text-amber-800">
                      {hasLimitedTracking(candidate)
                        ? 'Limited tracking evidence. Check branch readiness before testing.'
                        : 'Ready for review. Confirm branch capacity before testing.'}
                    </p>
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <h5 className="text-sm font-bold text-slate-950">Ad idea to review</h5>
                      <dl className="space-y-2 text-sm">
                        <div><dt className="text-slate-600">Ad type</dt><dd className="font-semibold">{ad.type}</dd></div>
                        <div><dt className="text-slate-600">Platform</dt><dd className="font-semibold">{ad.platform}</dd></div>
                        <div><dt className="text-slate-600">Content idea</dt><dd>{ad.idea}</dd></div>
                        <div><dt className="text-slate-600">Why this block</dt><dd>{ad.reason}</dd></div>
                      </dl>
                    </div>
                    {canEdit && <button type="button" className="btn-secondary min-h-10 px-4" onClick={() => setSuggestion({
                      block_number: blockNumber, branch_id: branch.id, comparison_block_number: comparison?.blockNumber ?? ''
                    })}>Plan experiment</button>}
                  </article>
                  );
                })}
              </div>
            ) : <p className="text-sm text-slate-700">No blocks meet the sample and competitor criteria for these dates.</p>}
            <p className="text-sm text-slate-600">
              {results.smallSamples} blocks below {MARKETING_MIN_BLOCK_ORDERS} orders · {results.readyWithoutCompetitorEvidence} with enough orders and unknown competitor coverage.
            </p>
          </>
        )}
      </div>
      <details className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-800">How recommendations are selected</summary>
        <p className="mt-2">
          The list prioritizes lower order volumes among blocks in the active directory with at least {MARKETING_MIN_BLOCK_ORDERS} orders
          and a competitor entry on file. Competitor records have no confirmed refresh date. The suggested branch handled the most
          recorded orders in that block during the selected dates.
        </p>
        <p className="mt-2">
          Tracking counts delivered orders with a valid assignment and delivery timestamp. The sample excludes Talabat, internal transfers,
          cancelled or voided orders, and the test branch.
        </p>
        <p className="mt-2">
          The trend compares average orders per day in the first and second halves of the selected range, with at least seven days and
          ten orders per half. Comparison blocks come from the same governorate and have the closest eligible order volume.
          Confirm the comparison block will stay outside the campaign.
        </p>
        <p className="mt-2">
          Ad ideas use aggregate delivery activity as a starting point. Check the platform’s location settings before planning a test,
          especially if its audience area could also reach the comparison block.
        </p>
      </details>
    </section>
    <MarketingExperiments canEdit={canEdit} blocks={blocks} branches={branches} suggestion={suggestion} />
    </div>
  );
}
