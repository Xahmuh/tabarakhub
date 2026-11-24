import { deliverySourceLabel } from '../lib/deliveryRecording';
import { supabaseClient } from '../lib/supabaseClient';
import { excludeVoidedDeliveryOrders } from './deliveryOrderVisibility';

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
  const batchSize = 500;
  let cursor: string | undefined;

  for (;;) {
    signal.throwIfAborted();
    let query = supabaseClient.from('delivery_orders_clean')
      .select('id,branch_id,branch_name,branch_code,block_number,payment_type,external_source,order_kind,delivery_status,assigned_at,delivered_at,cancelled_reason')
      .gte('order_date', from)
      .lte('order_date', to)
      .not('block_number', 'is', null)
      .order('id')
      .limit(batchSize);
    if (cursor) query = query.gt('id', cursor);
    const { data, error } = await query.abortSignal(signal);
    if (error) throw error;
    if (!data.length) break;

    const eligible = data.filter(row =>
      row.branch_code !== 'TEST-01' &&
      row.order_kind !== 'internal_transfer' &&
      row.delivery_status !== 'cancelled' &&
      deliverySourceLabel(row.external_source, row.payment_type) !== 'Talabat'
    );
    const orders = await excludeVoidedDeliveryOrders(
      eligible.map(row => ({ ...row, cancelledReason: row.cancelled_reason }))
    );
    signal.throwIfAborted();

    for (const order of orders) {
      const blockNumber = String(order.block_number ?? '').trim();
      if (!blockNumber || !order.branch_id) continue;
      let block = blocks.get(blockNumber);
      if (!block) {
        block = { blockNumber, orders: 0, tracked: 0, branches: new Map() };
        blocks.set(blockNumber, block);
      }
      let branch = block.branches.get(order.branch_id);
      if (!branch) {
        branch = {
          id: order.branch_id, name: order.branch_name || order.branch_code || 'Unknown branch',
          code: order.branch_code, orders: 0, tracked: 0
        };
        block.branches.set(branch.id, branch);
      }
      const tracked = order.delivery_status === 'delivered' &&
        order.assigned_at && order.delivered_at &&
        Date.parse(order.delivered_at) > Date.parse(order.assigned_at);
      block.orders++;
      branch.orders++;
      if (tracked) {
        block.tracked++;
        branch.tracked++;
      }
    }
    if (data.length < batchSize) break;
    cursor = data[data.length - 1].id;
  }

  return blocks;
}
