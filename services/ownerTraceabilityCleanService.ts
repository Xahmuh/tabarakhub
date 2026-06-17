import { supabaseClient } from '../lib/supabaseClient';
import {
  DeliveryLifecycleStatus,
  DeliveryOrder,
  DeliveryOrderKind,
  DeliveryPaymentType,
  Governorate
} from '../types';

export interface OwnerTraceabilityCleanFilters {
  branchId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  paymentType?: string | null;
  driverId?: string | null;
  governorate?: Governorate | string | null;
  includeInternalTransfers?: boolean;
}

export interface OwnerTraceabilityCleanRow {
  id: string;
  orderDate: string | null;
  createdAt: string | null;
  branchCode: string | null;
  branchName: string | null;
  orderKind: DeliveryOrderKind;
  deliveryStatus: DeliveryLifecycleStatus;
  valueBhd: number;
  paymentType: DeliveryPaymentType;
  blockNumber: string | null;
  areaName: string | null;
  governorate: Governorate | null;
  driverCode: string | null;
  driverName: string | null;
  assignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
}

interface OwnerTraceabilityCleanDbRow {
  id: string;
  order_date: string | null;
  created_at: string | null;
  branch_code: string | null;
  branch_name: string | null;
  order_kind: string | null;
  delivery_status: string | null;
  value_bhd: number | string | null;
  payment_type: string | null;
  block_number: string | null;
  area_name: string | null;
  governorate: Governorate | string | null;
  driver_code: string | null;
  driver_name: string | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
}

export interface OwnerTraceabilityCleanParityResult {
  matches: boolean;
  rowCount: { operational: number; clean: number; matches: boolean };
  latest20Ids: { operational: string[]; clean: string[]; matches: boolean };
  statusCounts: { operational: Record<string, number>; clean: Record<string, number>; matches: boolean };
  paymentTotals: { operational: Record<string, number>; clean: Record<string, number>; matches: boolean };
  driverDisplay: { operational: number; clean: number; matches: boolean };
  internalTransferRows: { operational: number; clean: number; matches: boolean };
  differences: string[];
}

const OWNER_TRACEABILITY_SELECT = `
  id,
  order_date,
  created_at,
  branch_code,
  branch_name,
  order_kind,
  delivery_status,
  value_bhd,
  payment_type,
  block_number,
  area_name,
  governorate,
  driver_code,
  driver_name,
  assigned_at,
  picked_up_at,
  delivered_at,
  cancelled_at,
  cancelled_reason
`;

const PAGE_SIZE = 1000;
const MAX_TRACEABILITY_ROWS = 50000;
const LIFECYCLE_STATUSES: DeliveryLifecycleStatus[] = ['recorded', 'assigned', 'picked_up', 'delivered', 'cancelled'];

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toOrderKind = (value: string | null | undefined): DeliveryOrderKind =>
  value === 'internal_transfer' ? 'internal_transfer' : 'actual_delivery';

const toDeliveryStatus = (value: string | null | undefined): DeliveryLifecycleStatus =>
  LIFECYCLE_STATUSES.includes(value as DeliveryLifecycleStatus)
    ? value as DeliveryLifecycleStatus
    : 'recorded';

const toGovernorate = (value: Governorate | string | null | undefined): Governorate | null =>
  ['Capital', 'Muharraq', 'Northern', 'Southern'].includes(String(value || ''))
    ? value as Governorate
    : null;

const toCleanRow = (row: OwnerTraceabilityCleanDbRow): OwnerTraceabilityCleanRow => ({
  id: row.id,
  orderDate: row.order_date,
  createdAt: row.created_at,
  branchCode: row.branch_code,
  branchName: row.branch_name,
  orderKind: toOrderKind(row.order_kind),
  deliveryStatus: toDeliveryStatus(row.delivery_status),
  valueBhd: toNumber(row.value_bhd),
  paymentType: row.payment_type || 'UNKNOWN',
  blockNumber: row.block_number,
  areaName: row.area_name,
  governorate: toGovernorate(row.governorate),
  driverCode: row.driver_code,
  driverName: row.driver_name,
  assignedAt: row.assigned_at,
  pickedUpAt: row.picked_up_at,
  deliveredAt: row.delivered_at,
  cancelledAt: row.cancelled_at,
  cancelledReason: row.cancelled_reason
});

const buildQuery = (filters: OwnerTraceabilityCleanFilters = {}) => {
  let query = supabaseClient.from('delivery_orders_clean').select(OWNER_TRACEABILITY_SELECT);
  if (filters.branchId && filters.branchId !== 'all') query = query.eq('branch_id', filters.branchId);
  if (filters.dateFrom) query = query.gte('order_date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('order_date', filters.dateTo);
  if (filters.paymentType && filters.paymentType !== 'all') query = query.eq('payment_type', filters.paymentType);
  if (filters.driverId && filters.driverId !== 'all') query = query.eq('driver_id', filters.driverId);
  if (filters.governorate && filters.governorate !== 'all') query = query.eq('governorate', filters.governorate);
  if (!filters.includeInternalTransfers) query = query.neq('order_kind', 'internal_transfer');
  return query;
};

export const listOwnerTraceabilityCleanRows = async (
  filters: OwnerTraceabilityCleanFilters = {}
): Promise<OwnerTraceabilityCleanRow[]> => {
  const rows: OwnerTraceabilityCleanDbRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery(filters)
      .order('order_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data as OwnerTraceabilityCleanDbRow[]);
    if (data.length < PAGE_SIZE || rows.length >= MAX_TRACEABILITY_ROWS) break;
    from += PAGE_SIZE;
  }
  return rows.map(toCleanRow);
};

const roundBhd = (value: number) => Number(value.toFixed(3));

const normalizeBucket = (value?: string | null) => value || 'UNKNOWN';

const addCount = (map: Record<string, number>, key: string) => {
  map[key] = (map[key] || 0) + 1;
};

const addValue = (map: Record<string, number>, key: string, value: number) => {
  map[key] = roundBhd((map[key] || 0) + value);
};

const normalizedJson = (value: Record<string, number>) =>
  JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce<Record<string, number>>((acc, key) => {
        acc[key] = value[key];
        return acc;
      }, {})
  );

const recordsMatch = (left: Record<string, number>, right: Record<string, number>) =>
  normalizedJson(left) === normalizedJson(right);

const arraysMatch = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const buildOwnerTraceabilityCleanParity = (
  operationalRows: DeliveryOrder[],
  cleanRows: OwnerTraceabilityCleanRow[]
): OwnerTraceabilityCleanParityResult => {
  const operationalStatusCounts: Record<string, number> = {};
  const cleanStatusCounts: Record<string, number> = {};
  const operationalPaymentTotals: Record<string, number> = {};
  const cleanPaymentTotals: Record<string, number> = {};

  operationalRows.forEach(order => {
    addCount(operationalStatusCounts, normalizeBucket(order.deliveryStatus));
    addValue(operationalPaymentTotals, normalizeBucket(order.paymentType), order.valueBhd || 0);
  });

  cleanRows.forEach(order => {
    addCount(cleanStatusCounts, normalizeBucket(order.deliveryStatus));
    addValue(cleanPaymentTotals, normalizeBucket(order.paymentType), order.valueBhd || 0);
  });

  const rowCountMatches = operationalRows.length === cleanRows.length;
  const latestOperationalIds = operationalRows.slice(0, 20).map(order => order.id);
  const latestCleanIds = cleanRows.slice(0, 20).map(order => order.id);
  const latest20Matches = arraysMatch(latestOperationalIds, latestCleanIds);
  const statusCountsMatch = recordsMatch(operationalStatusCounts, cleanStatusCounts);
  const paymentTotalsMatch = recordsMatch(operationalPaymentTotals, cleanPaymentTotals);
  const operationalDriverDisplay = operationalRows.filter(order => order.driverCode || order.driverName).length;
  const cleanDriverDisplay = cleanRows.filter(order => order.driverCode || order.driverName).length;
  const driverDisplayMatches = operationalDriverDisplay === cleanDriverDisplay;
  const operationalInternalTransfers = operationalRows.filter(order => order.orderKind === 'internal_transfer').length;
  const cleanInternalTransfers = cleanRows.filter(order => order.orderKind === 'internal_transfer').length;
  const internalTransferMatches = operationalInternalTransfers === cleanInternalTransfers;

  const differences: string[] = [];
  if (!rowCountMatches) differences.push(`row count operational=${operationalRows.length} clean=${cleanRows.length}`);
  if (!latest20Matches) differences.push('latest 20 order ids differ');
  if (!statusCountsMatch) differences.push('delivery status counts differ');
  if (!paymentTotalsMatch) differences.push('payment totals differ');
  if (!driverDisplayMatches) differences.push(`driver display availability operational=${operationalDriverDisplay} clean=${cleanDriverDisplay}`);
  if (!internalTransferMatches) differences.push(`internal transfer rows operational=${operationalInternalTransfers} clean=${cleanInternalTransfers}`);

  return {
    matches: differences.length === 0,
    rowCount: { operational: operationalRows.length, clean: cleanRows.length, matches: rowCountMatches },
    latest20Ids: { operational: latestOperationalIds, clean: latestCleanIds, matches: latest20Matches },
    statusCounts: { operational: operationalStatusCounts, clean: cleanStatusCounts, matches: statusCountsMatch },
    paymentTotals: { operational: operationalPaymentTotals, clean: cleanPaymentTotals, matches: paymentTotalsMatch },
    driverDisplay: { operational: operationalDriverDisplay, clean: cleanDriverDisplay, matches: driverDisplayMatches },
    internalTransferRows: { operational: operationalInternalTransfers, clean: cleanInternalTransfers, matches: internalTransferMatches },
    differences
  };
};

export const ownerTraceabilityCleanService = {
  list: listOwnerTraceabilityCleanRows,
  buildParity: buildOwnerTraceabilityCleanParity
};
