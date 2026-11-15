import type { DeliveryOrderInput } from '../types';

export const deliverySourceLabel = (source?: string | null, paymentType?: string | null) => {
  if (String(paymentType || '').trim().toUpperCase() === 'TALABAT') return 'Talabat';
  const normalizedSource = String(source || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (normalizedSource === 'woocommerce' || normalizedSource === 'online') return 'Online';
  if (normalizedSource === 'talabat') return 'Talabat';
  return 'WhatsApp';
};

type DeliveryReportOrder = {
  orderKind?: string | null;
  externalSource?: string | null;
  paymentType?: string | null;
  valueBhd: number | null;
};

export const deliveryReportGroup = (order: DeliveryReportOrder) => {
  if (order.orderKind === 'internal_transfer') return 'transfers';
  return deliverySourceLabel(order.externalSource, order.paymentType) === 'Talabat' ? 'talabat' : 'tabarak';
};

export const groupDeliveryReportOrders = <T extends DeliveryReportOrder>(orders: T[]) => {
  const groups = { total: [] as T[], tabarak: [] as T[], talabat: [] as T[], transfers: [] as T[] };
  for (const order of orders) {
    const group = deliveryReportGroup(order);
    groups[group].push(order);
    if (group !== 'transfers') groups.total.push(order);
  }
  return groups;
};

export const summarizeDeliveryReportOrders = (orders: DeliveryReportOrder[]) => ({
  count: orders.length,
  valueBhd: orders.reduce((fils, order) => fils + Math.round((order.valueBhd ?? 0) * 1000), 0) / 1000
});
export const deliveryPaymentOrderLabel = (paymentLabel: string, source?: string | null, paymentType?: string | null) => {
  const orderSource = deliverySourceLabel(source, paymentType);
  if (orderSource === 'Talabat') return 'Talabat';
  return `${paymentLabel} / ${orderSource === 'Online' ? 'Online Order' : 'WhatsApp order'}`;
};
export const deliveryLockKey = (environment: string, operator: string, branch: string) => `delivery-entry-v2:${encodeURIComponent(environment)}:${operator}:${branch}`;
export function toRecordingPayload(input: DeliveryOrderInput) {
  const talabat = input.paymentType.toUpperCase() === 'TALABAT';
  return {
    branch_id: input.branchId, order_date: input.orderDate, value_bhd: String(input.valueBhd),
    payment_type: input.paymentType, pharmacist_id: input.pharmacistId,
    dispatch_mode: talabat ? 'log_only' : input.dispatchMode || 'system',
    payment_collection_status: talabat ? 'paid' : input.paymentCollectionStatus || 'paid',
    ...(talabat ? {} : {
      driver_id: input.dispatchMode === 'log_only' ? null : input.driverId || null,
      recorded_driver_id: input.dispatchMode === 'log_only' ? input.recordedDriverId || null : null,
      block_number: input.blockNumber || null,
      amount_received_bhd: input.amountReceivedBhd ?? null,
      cash_handed_to_driver_bhd: input.cashHandedToDriverBhd ?? 0,
      driver_payment_note: input.driverPaymentNote || null,
      benefit_pay_received_time: input.benefitPayReceivedTime || null,
      location_url: input.locationUrl || null,
      customer_address: input.customerAddress || null,
      customer_phone: input.customerPhone || null,
      notes: input.notes || null,
    }),
  };
}
export function registeredSourceSummary(orders: { id: string; externalSource?: string | null; paymentType?: string | null; valueBhd: number }[]) {
  const seen = new Set<string>();
  const groups: Record<string, { count: number; fils: number }> = {};
  for (const order of orders) {
    if (seen.has(order.id)) continue;
    seen.add(order.id);
    const label = deliverySourceLabel(order.externalSource, order.paymentType);
    const group = groups[label] ||= { count: 0, fils: 0 };
    group.count++; group.fils += Math.round(order.valueBhd * 1000);
  }
  return groups;
}
