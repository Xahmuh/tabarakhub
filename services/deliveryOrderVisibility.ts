import { supabaseClient } from '../lib/supabaseClient';

export const excludeVoidedDeliveryOrders = async <
  T extends { id: string; cancelledReason?: string | null }
>(orders: T[]): Promise<T[]> => {
  // Some voids are recorded only in the audit table so the financial
  // history stays intact. Neither kind belongs in active order reports.
  const candidates = orders.filter(order => !order.cancelledReason?.startsWith('Recorded only void:'));
  const orderIds = candidates.map(order => order.id);
  const voidedOrderIds = new Set<string>();

  for (let offset = 0; offset < orderIds.length; offset += 500) {
    const { data, error } = await supabaseClient
      .from('delivery_recording_voids')
      .select('order_id')
      .in('order_id', orderIds.slice(offset, offset + 500));
    if (error) throw error;
    for (const row of data ?? []) voidedOrderIds.add(row.order_id);
  }

  return candidates.filter(order => !voidedOrderIds.has(order.id));
};
