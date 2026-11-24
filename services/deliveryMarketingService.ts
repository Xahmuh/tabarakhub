import { supabaseClient } from '../lib/supabaseClient';

export type MarketingBranch = { id: string; name: string; code: string | null; orders: number; tracked: number };
export type MarketingBlock = {
  blockNumber: string;
  orders: number;
  tracked: number;
  branches: Map<string, MarketingBranch>;
};

export const MARKETING_MIN_BLOCK_ORDERS = 30;

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
