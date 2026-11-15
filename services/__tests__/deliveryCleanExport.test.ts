import assert from 'node:assert/strict';
import { supabaseClient } from '../../lib/supabaseClient';
import {
  buildDeliveryOrderCleanExportParity,
  listDeliveryOrderCleanExportRows
} from '../deliveryCleanExportService';
import { deliveryService } from '../deliveryService';

const rows = Array.from({ length: 12866 }, (_, index) => ({
  id: String(index),
  order_kind: 'actual_delivery',
  delivery_status: index === 12865 ? 'cancelled' : 'recorded',
  payment_type: 'TALABAT',
  value_bhd: '1.250',
  cancelled_reason: index === 12865 ? 'Recorded only void: duplication' : null
}));
const auditIds = new Set(['1000', '3500', '9000', '12864']);
const originalFrom = supabaseClient.from;
supabaseClient.from = ((table: string) => {
  const ordering: string[] = [];
  const query = {
    select: () => query,
    is: () => query,
    order: (column: string) => {
      ordering.push(column);
      return query;
    },
    range: async (from: number, to: number) => {
      assert.ok(table === 'delivery_orders' || table === 'delivery_orders_clean');
      assert.deepEqual(ordering, ['order_date', 'created_at', 'id']);
      return { data: rows.slice(from, to + 1) };
    },
    in: async (column: string, ids: string[]) => {
      assert.equal(table, 'delivery_recording_voids');
      assert.equal(column, 'order_id');
      assert.ok(ids.length <= 500);
      return { data: ids.filter(id => auditIds.has(id)).map(order_id => ({ order_id })) };
    }
  };
  return query;
}) as unknown as typeof supabaseClient.from;

try {
  const operational = await deliveryService.orders.list();
  const clean = await listDeliveryOrderCleanExportRows();
  assert.equal(clean.length, 12861);
  assert.deepEqual(operational.map(row => row.id), clean.map(row => row.id));
  assert.ok(clean.every(row => !auditIds.has(row.id) && row.id !== '12865'));
  const parity = buildDeliveryOrderCleanExportParity(operational, clean);
  assert.ok(parity.matches, parity.differences.join('; '));
  assert.equal(parity.paymentTotals.clean.TALABAT, 16076.25);
  console.log('Delivery clean export parity test passed.');
} finally {
  supabaseClient.from = originalFrom;
}
