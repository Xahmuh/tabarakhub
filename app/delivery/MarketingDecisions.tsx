import { useEffect, useState } from 'react';
import { deliveryService } from '../../services/deliveryService';
import {
  listMarketingBlockActivity, MARKETING_MIN_BLOCK_ORDERS,
  type MarketingBlock, type MarketingBranch
} from '../../services/deliveryMarketingService';
import { LEGACY_BLOCK_PHARMACY_MAP } from '../block-analyzer/legacyCoverageData';
import { getCompetitorsForBlock } from './utils/noOrdersClassification';
import { rangeDayCount, toDateKey } from './utils';

type DateRange = { from: string; to: string };
type Candidate = MarketingBlock & { areaName: string; branch: MarketingBranch };
type Results = { candidates: Candidate[]; smallSamples: number; readyWithoutCompetitorEvidence: number };

const defaultRange = (): DateRange => {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 89);
  return { from: toDateKey(from), to: toDateKey(to) };
};

const percentage = (count: number, total: number) =>
  new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(count / total);

export function MarketingDecisions() {
  const [range, setRange] = useState(defaultRange);
  const [draft, setDraft] = useState(range);
  const [results, setResults] = useState<Results | null>(null);
  const [loadError, setLoadError] = useState(false);
  const invalidRange = !draft.from || !draft.to || draft.from > draft.to || rangeDayCount(draft.from, draft.to) > 90;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setResults(null);
      setLoadError(false);
      try {
        const [activity, directory] = await Promise.all([
          listMarketingBlockActivity(range.from, range.to, controller.signal),
          deliveryService.blocks.list()
        ]);
        if (controller.signal.aborted) return;
        const areas = new Map(directory.map(block => [block.blockNumber.trim(), block.areaName]));
        const candidates: Candidate[] = [];
        let smallSamples = 0;
        let readyWithoutCompetitorEvidence = 0;
        for (const block of activity.values()) {
          if (!areas.has(block.blockNumber)) continue;
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
          if (branch) candidates.push({ ...block, areaName: areas.get(block.blockNumber) || '', branch });
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
                {results.candidates.map(({ blockNumber, areaName, orders, tracked, branch }) => (
                  <article key={blockNumber} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                    <h4 className="font-bold text-slate-950">Block {blockNumber}{areaName && ` · ${areaName}`}</h4>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-slate-600">Block sample</dt><dd className="font-bold">{orders} orders</dd></div>
                      <div><dt className="text-slate-600">Block tracking</dt><dd className="font-bold">{percentage(tracked, orders)} ({tracked}/{orders})</dd></div>
                      <div className="col-span-2">
                        <dt className="text-slate-600">Suggested branch</dt>
                        <dd className="font-bold">{branch.name}{branch.code && branch.code !== branch.name && ` · ${branch.code}`}</dd>
                        <dd className="text-slate-600">{branch.orders} of {orders} orders · {percentage(branch.tracked, branch.orders)} tracked</dd>
                      </div>
                    </dl>
                    {(tracked < 20 || branch.tracked < 20) && (
                      <p className="text-sm text-amber-800">Fewer than 20 tracked orders for the block or branch. Confirm readiness before testing.</p>
                    )}
                  </article>
                ))}
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
      </details>
    </section>
  );
}
