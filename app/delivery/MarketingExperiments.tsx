import { useEffect, useRef, useState } from 'react';
import type { Branch, DeliveryBlock } from '../../types';
import {
  listMarketingExperiments, MARKETING_GOALS, saveMarketingExperiment,
  type MarketingExperiment, type MarketingExperimentInput
} from '../../services/deliveryMarketingService';
import { formatBhd } from './utils';

export type ExperimentSuggestion = Pick<MarketingExperimentInput, 'block_number' | 'branch_id' | 'comparison_block_number'>;

const emptyExperiment: MarketingExperimentInput = {
  branch_id: '', block_number: '', comparison_block_number: '', starts_on: '', ends_on: '',
  budget_bhd: '', goal_metric: 'additional_orders', goal_target: ''
};
const fieldClass = 'min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm';

export function MarketingExperiments({ canEdit, blocks, branches, suggestion }: {
  canEdit: boolean;
  blocks: DeliveryBlock[];
  branches: Branch[];
  suggestion: ExperimentSuggestion | null;
}) {
  const [input, setInput] = useState(emptyExperiment);
  const [editingId, setEditingId] = useState<string>();
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [entries, setEntries] = useState<{ rows: MarketingExperiment[]; hasMore: boolean } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | null>(null);
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const block = blocks.find(item => item.blockNumber === input.block_number);
  const comparisonOptions = blocks.filter(item => item.blockNumber !== input.block_number);
  const branchLabel = (id: string) => branches.find(branch => branch.id === id)?.name ?? 'Unavailable branch';
  const setField = <K extends keyof MarketingExperimentInput,>(key: K, value: MarketingExperimentInput[K]) => {
    setInput(current => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    if (!suggestion || !canEdit) return;
    setEditingId(undefined);
    setInput({ ...emptyExperiment, ...suggestion });
    setSaveState(null);
    setShowForm(true);
  }, [canEdit, suggestion]);

  useEffect(() => {
    if (showForm) formRef.current?.focus();
  }, [showForm]);

  useEffect(() => {
    const controller = new AbortController();
    setEntries(null);
    setLoadFailed(false);
    listMarketingExperiments(page, controller.signal).then(result => {
      if (!controller.signal.aborted) setEntries(result);
    }).catch(() => {
      if (!controller.signal.aborted) setLoadFailed(true);
    });
    return () => controller.abort();
  }, [page, refresh]);

  async function save() {
    if (!canEdit || saveState === 'saving' || input.block_number === input.comparison_block_number) return;
    setSaveState('saving');
    try {
      await saveMarketingExperiment(input, editingId);
      setShowForm(false);
      setInput(emptyExperiment);
      setEditingId(undefined);
      setPage(0);
      setRefresh(value => value + 1);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }

  return (
    <section className="operational-panel space-y-4 p-4 md:p-6" aria-labelledby="marketing-experiments-heading">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="marketing-experiments-heading" className="text-lg font-bold text-slate-950">Campaign experiments</h3>
          <p className="text-sm text-slate-600">Record a campaign plan and its comparison block for later review.</p>
        </div>
        {canEdit && !showForm && <button type="button" className="btn-primary min-h-10 px-4" onClick={() => {
          setInput(emptyExperiment);
          setEditingId(undefined);
          setSaveState(null);
          setShowForm(true);
        }}>New experiment</button>}
      </header>
      {showForm && canEdit && (
        <form ref={formRef} tabIndex={-1} onSubmit={event => { event.preventDefault(); void save(); }}>
          <fieldset disabled={saveState === 'saving'} className="space-y-3 rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-bold">{editingId ? 'Edit experiment' : 'New experiment'}</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-sm font-semibold">Target block
                <select required className={fieldClass} value={input.block_number} onChange={event => {
                  const value = event.target.value;
                  setInput(current => ({ ...current, block_number: value, comparison_block_number: '' }));
                }}>
                  <option value="">Choose a block</option>
                  {blocks.map(item => <option key={item.blockNumber} value={item.blockNumber}>{item.blockNumber} · {item.areaName}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold">Branch
                <select required className={fieldClass} value={input.branch_id} onChange={event => setField('branch_id', event.target.value)}>
                  <option value="">Choose a branch</option>
                  {branches.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Comparison block
                <select required disabled={!block} className={fieldClass} value={input.comparison_block_number}
                  onChange={event => setField('comparison_block_number', event.target.value)}>
                  <option value="">Choose a block outside the campaign</option>
                  {block && ['Same governorate', 'Other governorates'].map((label, index) => (
                    <optgroup key={label} label={label}>
                      {comparisonOptions.filter(item => (item.governorate === block.governorate) === (index === 0)).map(item =>
                        <option key={item.blockNumber} value={item.blockNumber}>{item.blockNumber} · {item.areaName}</option>
                      )}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold">Start date
                <input required className={fieldClass} type="date" value={input.starts_on} max={input.ends_on || undefined}
                  onChange={event => setField('starts_on', event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-semibold">End date
                <input required className={fieldClass} type="date" value={input.ends_on} min={input.starts_on || undefined}
                  onChange={event => setField('ends_on', event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-semibold">Planned budget (BHD)
                <input required className={fieldClass} type="number" min="0" max="999999999.999" step="0.001" value={input.budget_bhd}
                  onChange={event => setField('budget_bhd', event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-semibold">Goal
                <select className={fieldClass} value={input.goal_metric} onChange={event => setInput(current => ({
                  ...current, goal_metric: event.target.value as MarketingExperimentInput['goal_metric'], goal_target: ''
                }))}>
                  {Object.entries(MARKETING_GOALS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold">Goal target
                <input required className={fieldClass} type="number" max="999999999.999"
                  min={input.goal_metric === 'additional_orders' ? '1' : '0.001'}
                  step={input.goal_metric === 'additional_orders' ? '1' : '0.001'} value={input.goal_target}
                  onChange={event => setField('goal_target', event.target.value)} />
              </label>
            </div>
            {saveState === 'error' && <p role="alert" className="text-sm text-red-700">Could not save the experiment. Check the fields and try again.</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary min-h-10 px-4">{saveState === 'saving' ? 'Saving…' : 'Save experiment'}</button>
              <button type="button" className="btn-secondary min-h-10 px-4" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </fieldset>
        </form>
      )}
      {saveState === 'saved' && <p role="status" className="text-sm text-emerald-800">Experiment saved.</p>}
      {loadFailed ? (
        <button type="button" className="btn-secondary min-h-10 px-4" onClick={() => setRefresh(value => value + 1)}>Retry loading experiments</button>
      ) : entries ? (
        <>
          {entries.rows.length === 0 && <p className="text-sm text-slate-600">No experiments saved yet.</p>}
          {entries.rows.map(({ id, ...experiment }) => (
            <article key={id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div className="space-y-1">
                <h4 className="font-bold">Block {experiment.block_number} · {branchLabel(experiment.branch_id)}</h4>
                <p className="text-sm text-slate-600">{experiment.starts_on} to {experiment.ends_on} · Comparison block {experiment.comparison_block_number}</p>
                <p className="text-sm text-slate-700">Budget {formatBhd(Number(experiment.budget_bhd))} · {MARKETING_GOALS[experiment.goal_metric]} target {experiment.goal_target}</p>
              </div>
              {canEdit && <button type="button" className="btn-secondary min-h-10 px-4" disabled={saveState === 'saving'}
                onClick={() => {
                  setEditingId(id);
                  setInput(experiment);
                  setSaveState(null);
                  setShowForm(true);
                }}>Edit</button>}
            </article>
          ))}
          {(page > 0 || entries.hasMore) && (
            <nav className="flex items-center gap-3 text-sm" aria-label="Campaign experiments pages">
              <button type="button" className="btn-secondary min-h-10 px-4" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {page + 1}</span>
              <button type="button" className="btn-secondary min-h-10 px-4" disabled={!entries.hasMore} onClick={() => setPage(page + 1)}>Next</button>
            </nav>
          )}
        </>
      ) : <p role="status" className="text-sm text-slate-600">Loading experiments…</p>}
    </section>
  );
}
