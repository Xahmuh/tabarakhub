import { supabaseClient } from '../lib/supabaseClient';

export type MarketingBranch = { id: string; name: string; code: string | null; orders: number; tracked: number };
export type MarketingBlock = {
  blockNumber: string;
  orders: number;
  tracked: number;
  branches: Map<string, MarketingBranch>;
};

export const MARKETING_MIN_BLOCK_ORDERS = 30;

export const MARKETING_GOALS = {
  additional_orders: 'Additional orders',
  order_growth_pct: 'Order growth (%)',
  recorded_value_bhd: 'Recorded order value (BHD)'
} as const;

export type MarketingExperimentInput = {
  branch_id: string;
  block_number: string;
  comparison_block_number: string;
  starts_on: string;
  ends_on: string;
  budget_bhd: string;
  goal_metric: keyof typeof MARKETING_GOALS;
  goal_target: string;
};

export type MarketingExperiment = MarketingExperimentInput & { id: string };

const experimentTable = 'delivery_marketing_experiments';
const experimentColumns = 'id,branch_id,block_number,comparison_block_number,starts_on,ends_on,budget_bhd,goal_metric,goal_target';
export const MARKETING_EXPERIMENT_PAGE_SIZE = 15;

export async function listMarketingExperiments(page: number, signal: AbortSignal) {
  const offset = page * MARKETING_EXPERIMENT_PAGE_SIZE;
  const { data, error } = await supabaseClient.from(experimentTable).select(experimentColumns)
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .range(offset, offset + MARKETING_EXPERIMENT_PAGE_SIZE)
    .abortSignal(signal);
  if (error) throw error;
  return {
    rows: data.slice(0, MARKETING_EXPERIMENT_PAGE_SIZE) as unknown as MarketingExperiment[],
    hasMore: data.length > MARKETING_EXPERIMENT_PAGE_SIZE
  };
}

export async function saveMarketingExperiment(input: MarketingExperimentInput, id?: string) {
  const table = supabaseClient.from(experimentTable);
  const result = id ? table.update(input).eq('id', id) : table.insert(input);
  const { error } = await result.select('id').single();
  if (error) throw error;
}

export async function listMarketingBlockActivity(from: string, to: string, signal: AbortSignal) {
  const blocks = new Map<string, MarketingBlock>();
  const pageSize = 500;

  // Page the summaries, since the API can cap the number of returned rows.
  for (let offset = 0; ; offset += pageSize) {
    signal.throwIfAborted();
    const { data, error } = await supabaseClient
      .rpc('app_delivery_marketing_block_activity', { p_from: from, p_to: to })
      .order('block_number')
      .order('branch_id')
      .range(offset, offset + pageSize - 1)
      .abortSignal(signal);
    if (error) throw error;

    for (const row of data) {
      const branch: MarketingBranch = {
        id: row.branch_id,
        name: row.branch_name || row.branch_code || 'Unknown branch',
        code: row.branch_code,
        orders: Number(row.orders),
        tracked: Number(row.tracked)
      };
      let block = blocks.get(row.block_number);
      if (!block) {
        block = { blockNumber: row.block_number, orders: 0, tracked: 0, branches: new Map() };
        blocks.set(row.block_number, block);
      }
      block.orders += branch.orders;
      block.tracked += branch.tracked;
      block.branches.set(branch.id, branch);
    }

    if (data.length < pageSize) break;
  }

  return blocks;
}
