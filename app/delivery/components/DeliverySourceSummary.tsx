import React from 'react';
import { registeredSourceSummary } from '../../../lib/deliveryRecording';
import type { DeliveryOrder } from '../../../types';
export function DeliverySourceSummary({ orders }: { orders: DeliveryOrder[] }) {
  const groups = registeredSourceSummary(orders);
  return <section className="rounded-xl border border-slate-200 bg-white p-4">
    <h3 className="text-sm font-bold">Registered delivery records by source</h3>
    <div className="mt-2 flex flex-wrap gap-5">{Object.entries(groups).map(([label, group]) => <p key={label} className="text-sm"><b>{label}</b>: {group.count} · {(group.fils / 1000).toFixed(3)} BHD</p>)}</div>
    <p className="mt-2 text-xs text-slate-500">Online counts only registered delivery tasks. Total online sales remain in WooCommerce and are not added to this ledger. Legacy records without a saved source default to WhatsApp, unless their payment type is Talabat.</p>
  </section>;
}
