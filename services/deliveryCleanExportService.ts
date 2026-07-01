import type { Row, Worksheet } from 'exceljs';
import { isModuleEnabled } from '../config/clientConfig';
import { supabaseClient } from '../lib/supabaseClient';
import { DeliveryOrder, Governorate } from '../types';
import { truncateBhd } from '../utils/money';

export interface DeliveryCleanExportFilters {
  branchId?: string | null;
  branchIds?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
  paymentType?: string | null;
  driverId?: string | null;
  pharmacistId?: string | null;
  governorate?: Governorate | string | null;
}

export interface DeliveryOrderCleanExportRow {
  id: string;
  orderDate: string | null;
  branchCode: string | null;
  branchName: string | null;
  orderKind: string | null;
  deliveryStatus: string | null;
  valueBhd: number | null;
  paymentType: string | null;
  benefitPayReceivedTime: string | null;
  blockNumber: string | null;
  areaName: string | null;
  governorate: string | null;
  driverCode: string | null;
  driverName: string | null;
  assignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
}

export interface ShortageExportRow {
  id: string;
  branch_id: string;
  branch_name: string | null;
  pharmacist_id: string | null;
  pharmacist_name: string | null;
  internal_code: string | null;
  product_id: string | null;
  product_name: string | null;
  category: string | null;
  agent_name: string | null;
  status: string | null;
  timestamp: string;
  notes: string | null;
}

interface DeliveryOrderCleanExportDbRow {
  id: string;
  order_date: string | null;
  branch_code: string | null;
  branch_name: string | null;
  order_kind: string | null;
  delivery_status: string | null;
  value_bhd: number | string | null;
  payment_type: string | null;
  benefit_pay_received_time: string | null;
  block_number: string | null;
  area_name: string | null;
  governorate: string | null;
  driver_code: string | null;
  driver_name: string | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
}

export interface DeliveryCleanExportParityResult {
  matches: boolean;
  rowCount: { operational: number; clean: number; matches: boolean };
  latest20Ids: { operational: string[]; clean: string[]; matches: boolean };
  paymentTotals: { operational: Record<string, number>; clean: Record<string, number>; matches: boolean };
  orderKindCounts: { operational: Record<string, number>; clean: Record<string, number>; matches: boolean };
  statusCounts: { operational: Record<string, number>; clean: Record<string, number>; matches: boolean };
  driverDisplay: { operational: number; clean: number; matches: boolean };
  differences: string[];
}

const CLEAN_EXPORT_SELECT = `
  id,
  order_date,
  created_at,
  branch_id,
  branch_code,
  branch_name,
  pharmacist_id,
  driver_id,
  order_kind,
  delivery_status,
  value_bhd,
  payment_type,
  benefit_pay_received_time,
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
const MAX_EXPORT_ROWS = 50000;

const assertExcelEnabled = () => {
  if (!isModuleEnabled('excelExport')) {
    throw new Error('Excel export is disabled for this client deployment');
  }
};

const normalizeBhd = (value: number) => truncateBhd(value);

const normalizeBucket = (value?: string | null) => value || 'UNKNOWN';

const addCount = (map: Record<string, number>, key: string) => {
  map[key] = (map[key] || 0) + 1;
};

const addValue = (map: Record<string, number>, key: string, value: number) => {
  map[key] = normalizeBhd((map[key] || 0) + value);
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

const toNumberOrNull = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toCleanExportRow = (row: DeliveryOrderCleanExportDbRow): DeliveryOrderCleanExportRow => ({
  id: row.id,
  orderDate: row.order_date,
  branchCode: row.branch_code,
  branchName: row.branch_name,
  orderKind: row.order_kind,
  deliveryStatus: row.delivery_status,
  valueBhd: toNumberOrNull(row.value_bhd),
  paymentType: row.payment_type,
  benefitPayReceivedTime: row.benefit_pay_received_time,
  blockNumber: row.block_number,
  areaName: row.area_name,
  governorate: row.governorate,
  driverCode: row.driver_code,
  driverName: row.driver_name,
  assignedAt: row.assigned_at,
  pickedUpAt: row.picked_up_at,
  deliveredAt: row.delivered_at,
  cancelledAt: row.cancelled_at,
  cancelledReason: row.cancelled_reason
});

const buildQuery = (filters: DeliveryCleanExportFilters = {}) => {
  let query = supabaseClient.from('delivery_orders_clean').select(CLEAN_EXPORT_SELECT);
  if (filters.branchId && filters.branchId !== 'all') query = query.eq('branch_id', filters.branchId);
  if (filters.branchIds && filters.branchIds.length > 0) query = query.in('branch_id', filters.branchIds);
  if (filters.dateFrom) query = query.gte('order_date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('order_date', filters.dateTo);
  if (filters.paymentType && filters.paymentType !== 'all') query = query.eq('payment_type', filters.paymentType);
  if (filters.driverId && filters.driverId !== 'all') query = query.eq('driver_id', filters.driverId);
  if (filters.pharmacistId && filters.pharmacistId !== 'all') query = query.eq('pharmacist_id', filters.pharmacistId);
  if (filters.governorate && filters.governorate !== 'all') query = query.eq('governorate', filters.governorate);
  return query;
};

export const listDeliveryOrderCleanExportRows = async (
  filters: DeliveryCleanExportFilters = {}
): Promise<DeliveryOrderCleanExportRow[]> => {
  if (filters.branchIds && filters.branchIds.length === 0) return [];

  const rows: DeliveryOrderCleanExportDbRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery(filters)
      .order('order_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data as DeliveryOrderCleanExportDbRow[]);
    if (data.length < PAGE_SIZE || rows.length >= MAX_EXPORT_ROWS) break;
    from += PAGE_SIZE;
  }

  return rows.map(toCleanExportRow);
};

export async function fetchAllShortagesForExport(
  branchId: string,
  dateFrom: string,
  dateTo: string
) {
  const rows: ShortageExportRow[] = [];
  let cursor: string | null = null;

  while (true) {
    const { data, error } = await supabaseClient.rpc('export_shortages_paginated', {
      p_branch_id: branchId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_cursor: cursor,
      p_limit: PAGE_SIZE,
    });

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data as ShortageExportRow[]);
    cursor = data[data.length - 1]?.id || null;

    if (data.length < PAGE_SIZE || !cursor) break;
  }

  return rows;
}

export const buildDeliveryOrderCleanExportParity = (
  operationalRows: DeliveryOrder[],
  cleanRows: DeliveryOrderCleanExportRow[]
): DeliveryCleanExportParityResult => {
  const operationalPaymentTotals: Record<string, number> = {};
  const cleanPaymentTotals: Record<string, number> = {};
  const operationalKindCounts: Record<string, number> = {};
  const cleanKindCounts: Record<string, number> = {};
  const operationalStatusCounts: Record<string, number> = {};
  const cleanStatusCounts: Record<string, number> = {};

  operationalRows.forEach(order => {
    addValue(operationalPaymentTotals, normalizeBucket(order.paymentType), order.valueBhd || 0);
    addCount(operationalKindCounts, normalizeBucket(order.orderKind));
    addCount(operationalStatusCounts, normalizeBucket(order.deliveryStatus));
  });

  cleanRows.forEach(order => {
    addValue(cleanPaymentTotals, normalizeBucket(order.paymentType), order.valueBhd || 0);
    addCount(cleanKindCounts, normalizeBucket(order.orderKind));
    addCount(cleanStatusCounts, normalizeBucket(order.deliveryStatus));
  });

  const rowCountMatches = operationalRows.length === cleanRows.length;
  const latestOperationalIds = operationalRows.slice(0, 20).map(order => order.id);
  const latestCleanIds = cleanRows.slice(0, 20).map(order => order.id);
  const latest20Matches = arraysMatch(latestOperationalIds, latestCleanIds);
  const paymentTotalsMatch = recordsMatch(operationalPaymentTotals, cleanPaymentTotals);
  const orderKindCountsMatch = recordsMatch(operationalKindCounts, cleanKindCounts);
  const statusCountsMatch = recordsMatch(operationalStatusCounts, cleanStatusCounts);
  const operationalDriverDisplay = operationalRows.filter(order => order.driverCode || order.driverName).length;
  const cleanDriverDisplay = cleanRows.filter(order => order.driverCode || order.driverName).length;
  const driverDisplayMatches = operationalDriverDisplay === cleanDriverDisplay;

  const differences: string[] = [];
  if (!rowCountMatches) differences.push(`row count operational=${operationalRows.length} clean=${cleanRows.length}`);
  if (!latest20Matches) differences.push('latest 20 order ids differ');
  if (!paymentTotalsMatch) differences.push('payment totals differ');
  if (!orderKindCountsMatch) differences.push('order kind counts differ');
  if (!statusCountsMatch) differences.push('delivery status counts differ');
  if (!driverDisplayMatches) differences.push(`driver display availability operational=${operationalDriverDisplay} clean=${cleanDriverDisplay}`);

  return {
    matches: differences.length === 0,
    rowCount: { operational: operationalRows.length, clean: cleanRows.length, matches: rowCountMatches },
    latest20Ids: { operational: latestOperationalIds, clean: latestCleanIds, matches: latest20Matches },
    paymentTotals: { operational: operationalPaymentTotals, clean: cleanPaymentTotals, matches: paymentTotalsMatch },
    orderKindCounts: { operational: operationalKindCounts, clean: cleanKindCounts, matches: orderKindCountsMatch },
    statusCounts: { operational: operationalStatusCounts, clean: cleanStatusCounts, matches: statusCountsMatch },
    driverDisplay: { operational: operationalDriverDisplay, clean: cleanDriverDisplay, matches: driverDisplayMatches },
    differences
  };
};

const styleHeader = (row: Row) => {
  row.font = { bold: true };
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });
};

const writeObjectRows = (
  sheet: Worksheet,
  rows: Array<Record<string, string | number | boolean | null>>,
  columns: Array<{ key: string; label: string; numFmt?: string; width?: number }>
) => {
  styleHeader(sheet.addRow(columns.map(column => column.label)));
  rows.forEach(row => sheet.addRow(columns.map(column => row[column.key] ?? '')));
  sheet.columns.forEach((column, index) => {
    column.width = columns[index]?.width || 18;
    if (columns[index]?.numFmt) column.numFmt = columns[index].numFmt;
  });
};

export const exportDeliveryOrderCleanRowsToExcel = async (
  rows: DeliveryOrderCleanExportRow[],
  title: string,
  fileName: string,
  parity?: DeliveryCleanExportParityResult
) => {
  assertExcelEnabled();
  const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
    import('exceljs'),
    import('file-saver'),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tabarak Hub';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Clean Delivery Orders');
  sheet.addRow([title]);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.addRow(['Source: public.delivery_orders_clean']);
  sheet.addRow([]);

  writeObjectRows(
    sheet,
    rows.map(row => ({
      id: row.id,
      orderDate: row.orderDate,
      orderKind: row.orderKind,
      deliveryStatus: row.deliveryStatus,
      branchCode: row.branchCode,
      branchName: row.branchName,
      valueBhd: row.valueBhd === null ? null : normalizeBhd(row.valueBhd),
      paymentType: row.paymentType,
      benefitPayReceivedTime: row.benefitPayReceivedTime ? row.benefitPayReceivedTime.slice(0, 5) : '',
      blockNumber: row.blockNumber,
      areaName: row.areaName,
      governorate: row.governorate,
      driverCode: row.driverCode,
      driverName: row.driverName,
      assignedAt: row.assignedAt,
      pickedUpAt: row.pickedUpAt,
      deliveredAt: row.deliveredAt,
      cancelledAt: row.cancelledAt,
      cancelledReason: row.cancelledReason
    })),
    [
      { key: 'id', label: 'Order ID', width: 38 },
      { key: 'orderDate', label: 'Date', width: 14 },
      { key: 'orderKind', label: 'Type', width: 18 },
      { key: 'deliveryStatus', label: 'Status', width: 16 },
      { key: 'branchCode', label: 'Branch Code', width: 14 },
      { key: 'branchName', label: 'Branch', width: 24 },
      { key: 'valueBhd', label: 'Value (BHD)', numFmt: '0.000', width: 14 },
      { key: 'paymentType', label: 'Payment', width: 18 },
      { key: 'benefitPayReceivedTime', label: 'BP received time', width: 18 },
      { key: 'blockNumber', label: 'Block', width: 12 },
      { key: 'areaName', label: 'Area', width: 24 },
      { key: 'governorate', label: 'Governorate', width: 16 },
      { key: 'driverCode', label: 'Driver Code', width: 14 },
      { key: 'driverName', label: 'Driver', width: 24 },
      { key: 'assignedAt', label: 'Assigned At', width: 22 },
      { key: 'pickedUpAt', label: 'Picked Up At', width: 22 },
      { key: 'deliveredAt', label: 'Delivered At', width: 22 },
      { key: 'cancelledAt', label: 'Cancelled At', width: 22 },
      { key: 'cancelledReason', label: 'Cancel Reason', width: 28 }
    ]
  );

  const totalRow = sheet.addRow([
    'TOTAL',
    '',
    '',
    '',
    '',
    `${rows.length} orders`,
    normalizeBhd(rows.reduce((total, row) => total + (row.valueBhd || 0), 0))
  ]);
  totalRow.font = { bold: true };

  const qaSheet = workbook.addWorksheet('Clean Export QA');
  qaSheet.addRow(['Clean Export QA']);
  qaSheet.getRow(1).font = { bold: true, size: 14 };
  qaSheet.addRow([]);
  if (parity) {
    writeObjectRows(
      qaSheet,
      [
        { check: 'Row count', operational: parity.rowCount.operational, clean: parity.rowCount.clean, matches: parity.rowCount.matches ? 'YES' : 'NO' },
        { check: 'Latest 20 order IDs', operational: parity.latest20Ids.operational.join(', '), clean: parity.latest20Ids.clean.join(', '), matches: parity.latest20Ids.matches ? 'YES' : 'NO' },
        { check: 'Payment totals', operational: JSON.stringify(parity.paymentTotals.operational), clean: JSON.stringify(parity.paymentTotals.clean), matches: parity.paymentTotals.matches ? 'YES' : 'NO' },
        { check: 'Order kind counts', operational: JSON.stringify(parity.orderKindCounts.operational), clean: JSON.stringify(parity.orderKindCounts.clean), matches: parity.orderKindCounts.matches ? 'YES' : 'NO' },
        { check: 'Status counts', operational: JSON.stringify(parity.statusCounts.operational), clean: JSON.stringify(parity.statusCounts.clean), matches: parity.statusCounts.matches ? 'YES' : 'NO' },
        { check: 'Driver display availability', operational: parity.driverDisplay.operational, clean: parity.driverDisplay.clean, matches: parity.driverDisplay.matches ? 'YES' : 'NO' }
      ],
      [
        { key: 'check', label: 'Check', width: 28 },
        { key: 'operational', label: 'Operational Source', width: 44 },
        { key: 'clean', label: 'Clean View', width: 44 },
        { key: 'matches', label: 'Matches', width: 12 }
      ]
    );
  } else {
    qaSheet.addRow(['Parity comparison was not supplied.']);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${fileName}.xlsx`
  );
};

export const deliveryCleanExportService = {
  orders: {
    list: listDeliveryOrderCleanExportRows
  },
  shortages: {
    listForExport: fetchAllShortagesForExport
  }
};
