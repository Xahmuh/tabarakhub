import { DeliveryOrder } from '../../types';
import { DeliveryPaymentTypeConfig } from '../../types';
import { isDirectDeliveryOrder } from '../../lib/deliveryPaymentTypes';

export type PeriodPreset = 'today' | 'yesterday' | 'month' | 'custom';

export const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const todayKey = () => toDateKey(new Date());

export const yesterdayKey = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateKey(d);
};

export const getPresetRange = (preset: PeriodPreset, customFrom?: string, customTo?: string): { from: string; to: string } => {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: todayKey(), to: todayKey() };
    case 'yesterday':
      return { from: yesterdayKey(), to: yesterdayKey() };
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toDateKey(first), to: todayKey() };
    }
    case 'custom':
      return { from: customFrom || todayKey(), to: customTo || todayKey() };
  }
};

export const formatBhd = (value: number) => `${Number(value || 0).toFixed(3)} BHD`;

export const periodLabel = (preset: PeriodPreset, from: string, to: string) => {
  if (preset === 'today') return `Today (${from})`;
  if (preset === 'yesterday') return `Yesterday (${from})`;
  if (preset === 'month') return `This month (${from} → ${to})`;
  return from === to ? from : `${from} → ${to}`;
};

/** Direct/mappable = payment channels that require block/area mapping. */
export const isDirectOrder = (order: DeliveryOrder, paymentTypes?: DeliveryPaymentTypeConfig[] | null) =>
  isDirectDeliveryOrder(order, paymentTypes);

export const sumValue = (orders: DeliveryOrder[]) => orders.reduce((acc, o) => acc + o.valueBhd, 0);

/** Inclusive day count of a yyyy-mm-dd range. */
export const rangeDayCount = (from: string, to: string) => {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
};
