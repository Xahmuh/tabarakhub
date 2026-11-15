import type { Cell, Row, Worksheet } from 'exceljs';
import { isModuleEnabled } from '../config/clientConfig';
import { supabaseClient } from '../lib/supabaseClient';
import { DeliveryOrder, Governorate } from '../types';
import { truncateBhd } from '../utils/money';
import { deliveryReportGroup, deliverySourceLabel, groupDeliveryReportOrders, summarizeDeliveryReportOrders } from '../lib/deliveryRecording';
import { excludeVoidedDeliveryOrders } from './deliveryOrderVisibility';

export interface DeliveryCleanExportFilters {
  branchId?: string | null;
  branchIds?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
  paymentType?: string | null;
  paymentTypes?: string[];
  driverId?: string | null;
  recordedDriverId?: string | null;
  pharmacistId?: string | null;
  governorate?: Governorate | string | null;
}

export interface DeliveryOrderCleanExportRow {
  externalSource?: string | null;
  externalOrderId?: string | null;
  dispatchMode?: string | null;
  recordedDriverId?: string | null;
  recordedDriverCode?: string | null;
  recordedDriverName?: string | null;
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
  external_source?: string | null;
  external_order_id?: string | null;
  dispatch_mode?: string | null;
  recorded_driver_id?: string | null;
  recorded_driver_code?: string | null;
  recorded_driver_name?: string | null;
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

const DELIVERY_GROUPS = [
  { group: 'total', name: 'Total Delivery Orders' },
  { group: 'tabarak', name: 'Tabarak Delivery' },
  { group: 'talabat', name: 'Talabat' }
] as const;

type DeliveryReportTotals = ReturnType<typeof summarizeDeliveryReportOrders>;

export interface DeliveryCleanExportParityResult {
  matches: boolean;
  rowCount: { operational: number; clean: number; matches: boolean };
  latest20Ids: { operational: string[]; clean: string[]; matches: boolean };
  paymentTotals: { operational: Record<string, number>; clean: Record<string, number>; matches: boolean };
  orderKindCounts: { operational: Record<string, number>; clean: Record<string, number>; matches: boolean };
  statusCounts: { operational: Record<string, number>; clean: Record<string, number>; matches: boolean };
  driverDisplay: { operational: number; clean: number; matches: boolean };
  deliveryGroups: { name: string; operational: DeliveryReportTotals; clean: DeliveryReportTotals; matches: boolean }[];
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
  externalSource: row.external_source || null,
  externalOrderId: row.external_order_id || null,
  dispatchMode: row.dispatch_mode || null,
  recordedDriverId: row.recorded_driver_id || null,
  recordedDriverCode: row.recorded_driver_code || null,
  recordedDriverName: row.recorded_driver_name || null,
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
  const columns = CLEAN_EXPORT_SELECT + ((import.meta as any).env?.VITE_DELIVERY_RECORDING_V1 === '1' ? ',external_source,external_order_id,dispatch_mode,recorded_driver_id,recorded_driver_code,recorded_driver_name' : '');
  let query = supabaseClient.from('delivery_orders_clean').select(columns);
  if (filters.branchId && filters.branchId !== 'all') query = query.eq('branch_id', filters.branchId);
  if (filters.branchIds && filters.branchIds.length > 0) query = query.in('branch_id', filters.branchIds);
  if (filters.dateFrom) query = query.gte('order_date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('order_date', filters.dateTo);
  if (filters.paymentTypes && filters.paymentTypes.length > 0) query = query.in('payment_type', filters.paymentTypes);
  else if (filters.paymentType && filters.paymentType !== 'all') query = query.eq('payment_type', filters.paymentType);
  if (filters.driverId && filters.driverId !== 'all') query = query.eq('driver_id', filters.driverId);
  if (filters.recordedDriverId && filters.recordedDriverId !== 'all') query = query.eq('recorded_driver_id', filters.recordedDriverId);
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
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data as unknown as DeliveryOrderCleanExportDbRow[]);
    if (data.length < PAGE_SIZE || rows.length >= MAX_EXPORT_ROWS) break;
    from += PAGE_SIZE;
  }

  return excludeVoidedDeliveryOrders(rows.map(toCleanExportRow));
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
  const operationalGroups = groupDeliveryReportOrders(operationalRows);
  const cleanGroups = groupDeliveryReportOrders(cleanRows);
  const deliveryGroups = DELIVERY_GROUPS.map(({ group, name }) => {
    const operational = summarizeDeliveryReportOrders(operationalGroups[group]);
    const clean = summarizeDeliveryReportOrders(cleanGroups[group]);
    return { name, operational, clean, matches: operational.count === clean.count && operational.valueBhd === clean.valueBhd };
  });

  const differences: string[] = [];
  if (!rowCountMatches) differences.push(`row count operational=${operationalRows.length} clean=${cleanRows.length}`);
  if (!latest20Matches) differences.push('latest 20 order ids differ');
  if (!paymentTotalsMatch) differences.push('payment totals differ');
  if (!orderKindCountsMatch) differences.push('order kind counts differ');
  if (!statusCountsMatch) differences.push('delivery status counts differ');
  if (!driverDisplayMatches) differences.push(`driver display availability operational=${operationalDriverDisplay} clean=${cleanDriverDisplay}`);
  for (const group of deliveryGroups) {
    if (!group.matches) differences.push(`${group.name} count or value differs`);
  }

  return {
    matches: differences.length === 0,
    rowCount: { operational: operationalRows.length, clean: cleanRows.length, matches: rowCountMatches },
    latest20Ids: { operational: latestOperationalIds, clean: latestCleanIds, matches: latest20Matches },
    paymentTotals: { operational: operationalPaymentTotals, clean: cleanPaymentTotals, matches: paymentTotalsMatch },
    orderKindCounts: { operational: operationalKindCounts, clean: cleanKindCounts, matches: orderKindCountsMatch },
    statusCounts: { operational: operationalStatusCounts, clean: cleanStatusCounts, matches: statusCountsMatch },
    driverDisplay: { operational: operationalDriverDisplay, clean: cleanDriverDisplay, matches: driverDisplayMatches },
    deliveryGroups,
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
    if (!columns[index]) return;
    column.width = columns[index]?.width || 18;
    if (columns[index]?.numFmt) column.numFmt = columns[index].numFmt;
  });
};

const writeDeliveryReportOrders = (sheet: Worksheet, rows: DeliveryOrderCleanExportRow[]) => {
  const headerRow = sheet.rowCount + 1;
  writeObjectRows(
    sheet,
    rows.map(row => ({
      orderDate: row.orderDate,
      orderKind: row.orderKind === 'internal_transfer' ? 'Internal Transfer'
        : deliveryReportGroup(row) === 'talabat' ? 'Talabat' : 'Tabarak Delivery',
      orderSource: deliverySourceLabel(row.externalSource, row.paymentType),
      deliveryStatus: row.deliveryStatus,
      branchCode: row.branchCode,
      branchName: row.branchName,
      valueBhd: row.valueBhd === null ? null : normalizeBhd(row.valueBhd),
      paymentType: row.paymentType,
      recordedDriverCode: row.recordedDriverCode || '',
      recordedDriverName: row.recordedDriverName || '',
      benefitPayReceivedTime: row.benefitPayReceivedTime ? row.benefitPayReceivedTime.slice(0, 5) : '',
      blockNumber: row.blockNumber,
      areaName: row.areaName,
      governorate: row.governorate,
      deliveredAt: row.deliveredAt
    })),
    [
      { key: 'orderDate', label: 'Date', width: 14 },
      { key: 'orderKind', label: 'Type', width: 22 },
      { key: 'orderSource', label: 'Order source', width: 18 },
      { key: 'deliveryStatus', label: 'Status', width: 16 },
      { key: 'branchCode', label: 'Branch Code', width: 14 },
      { key: 'branchName', label: 'Branch', width: 24 },
      { key: 'valueBhd', label: 'Value (BHD)', numFmt: '0.000', width: 14 },
      { key: 'paymentType', label: 'Payment', width: 18 },
      { key: 'recordedDriverCode', label: 'Recorded driver code', width: 22 },
      { key: 'recordedDriverName', label: 'Recorded driver (no dispatch)', width: 30 },
      { key: 'benefitPayReceivedTime', label: 'Benefit Pay received time', width: 24 },
      { key: 'blockNumber', label: 'Block', width: 12 },
      { key: 'areaName', label: 'Area', width: 24 },
      { key: 'governorate', label: 'Governorate', width: 16 },
      { key: 'deliveredAt', label: 'Delivered At', width: 22 }
    ]
  );
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow + rows.length, column: 15 }
  };

  const totals = summarizeDeliveryReportOrders(rows);
  const totalRow = sheet.addRow([
    'TOTAL',
    '',
    '',
    '',
    '',
    `${totals.count} orders`,
    totals.valueBhd
  ]);
  totalRow.font = { bold: true };
};

export interface DeliveryDashboardExportSection {
  tab: 'Dashboard' | 'Operations' | 'Branches' | 'Pharmacists' | 'Drivers' | 'Driver Workload' | 'Geography';
  name: string;
  headers: string[];
  rows: (string | number)[][];
  formats?: Record<number, string>;
}

const valueFormat = '#,##0.000';
const countFormat = '#,##0';

const writeDashboardBand = (sheet: Worksheet, range: string, address: string, value: string | number, options: {
  background: string; color: string; size: number; bold?: boolean; center?: boolean; format?: string;
}) => {
  sheet.mergeCells(range);
  const cell = sheet.getCell(address);
  cell.value = value;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: options.background } };
  cell.font = { name: 'Calibri', color: { argb: options.color }, size: options.size, bold: options.bold };
  cell.alignment = { vertical: 'middle', horizontal: options.center ? 'center' : 'left', indent: options.center ? 0 : 1 };
  if (options.format) cell.numFmt = options.format;
  return cell;
};

const addDashboardLink = (cell: Cell, text: string, target: string) => {
  cell.value = { text, hyperlink: `#'${target}'!A1` };
  cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF1D4ED8' }, underline: true };
};

const writeDashboardSection = (sheet: Worksheet, section: DeliveryDashboardExportSection) => {
  sheet.addRow([]);
  const heading = sheet.addRow([section.name]);
  heading.height = 24;
  heading.getCell(1).font = { bold: true, color: { argb: 'FF0F172A' }, size: 13 };
  styleHeader(sheet.addRow(section.headers));
  section.rows.forEach((values, index) => {
    const row = sheet.addRow(values);
    row.height = 17;
    row.eachCell(cell => {
      if (index % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });
    for (const [column, format] of Object.entries(section.formats ?? {})) {
      row.getCell(Number(column)).numFmt = format;
    }
  });
  if (section.rows.length === 0) sheet.addRow(['No results for the selected period and filters.']);
};

export const buildDeliveryCleanExportWorkbook = async (
  rows: DeliveryOrderCleanExportRow[],
  title: string,
  parity?: DeliveryCleanExportParityResult,
  dashboardSections: DeliveryDashboardExportSection[] = []
) => {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tabarak Hub';
  workbook.created = new Date();

  const dashboard = workbook.addWorksheet('Dashboard', {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: 'FF1D4ED8' } }
  });
  workbook.views = [{ firstSheet: 0, activeTab: 0, visibility: 'visible', x: 0, y: 0, width: 12000, height: 18000 }];
  const tabOrder = ['Branches', 'Pharmacists', 'Drivers', 'Driver Workload', 'Geography', 'Operations'] as const;
  const detailTabs = tabOrder.filter(tab => dashboardSections.some(section => section.tab === tab));
  const navTabs = [...detailTabs, 'Order Details'];

  for (let column = 1; column <= 8; column++) dashboard.getColumn(column).width = column === 1 ? 24 : 13;
  const banner = { background: 'FF0F172A', color: 'FFFFFFFF', size: 21, bold: true };
  writeDashboardBand(dashboard, 'A1:H1', 'A1', 'Delivery Recording and Traceability', banner);
  writeDashboardBand(dashboard, 'A2:H2', 'A2', title, { ...banner, color: 'FFC7D2FE', size: 11, bold: false });
  dashboard.getRow(1).height = 35;
  dashboard.getRow(2).height = 22;

  const registered = summarizeDeliveryReportOrders(rows);
  const branchCount = dashboardSections.find(section => section.tab === 'Branches')?.rows.length
    ?? new Set(rows.map(row => row.branchCode || row.branchName).filter(Boolean)).size;
  const cards = [
    { label: 'Registered orders', value: registered.count, format: countFormat, left: 'A', right: 'B' },
    { label: 'Registered value (BHD)', value: registered.valueBhd, format: valueFormat, left: 'C', right: 'D' },
    { label: 'Avg. order value (BHD)', value: registered.count ? registered.valueBhd / registered.count : 0, format: valueFormat, left: 'E', right: 'F' },
    { label: 'Active branches', value: branchCount, format: countFormat, left: 'G', right: 'H' }
  ];
  for (const card of cards) {
    const style = { background: 'FFEFF6FF', color: 'FF1E3A8A', size: 10, bold: true, center: true };
    writeDashboardBand(dashboard, `${card.left}4:${card.right}4`, `${card.left}4`, card.label, style);
    writeDashboardBand(dashboard, `${card.left}5:${card.right}5`, `${card.left}5`, card.value, { ...style, size: 17, format: card.format });
  }
  dashboard.getRow(4).height = 22;
  dashboard.getRow(5).height = 32;

  const groups = groupDeliveryReportOrders(rows);
  const summaries = [...DELIVERY_GROUPS, { group: 'transfers' as const, name: 'Internal Transfers' }];
  writeDashboardBand(dashboard, 'A7:H7', 'A7', 'Delivery breakdown', { ...banner, size: 12 });
  const breakdownRow = (row: number, name: string, count: string | number, value: string | number, background: string) => {
    const style = { background, color: 'FF0F172A', size: 11, bold: row < 10 };
    writeDashboardBand(dashboard, `A${row}:D${row}`, `A${row}`, name, style);
    writeDashboardBand(dashboard, `E${row}:F${row}`, `E${row}`, count, { ...style, center: true, format: countFormat });
    writeDashboardBand(dashboard, `G${row}:H${row}`, `G${row}`, value, { ...style, center: true, format: valueFormat });
    dashboard.getRow(row).height = 20;
  };
  breakdownRow(8, 'Delivery type', 'Orders', 'Value (BHD)', 'FFE2E8F0');
  summaries.forEach(({ group, name }, index) => {
    const totals = summarizeDeliveryReportOrders(groups[group]);
    breakdownRow(index + 9, name, totals.count, totals.valueBhd, index % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF');
  });
  writeDashboardBand(dashboard, 'A14:H14', 'A14', 'Open a report', { ...banner, size: 12 });
  navTabs.forEach((tab, index) => {
    const row = 15 + Math.floor(index / 4);
    const left = 'ACEG'[index % 4];
    const right = 'BDFH'[index % 4];
    const cell = writeDashboardBand(dashboard, `${left}${row}:${right}${row}`, `${left}${row}`, tab, {
      background: 'FFEFF6FF', color: 'FF1D4ED8', size: 11, center: true
    });
    addDashboardLink(cell, tab, tab);
    dashboard.getRow(row).height = 23;
  });
  for (const section of dashboardSections.filter(section => section.tab === 'Dashboard')) {
    writeDashboardSection(dashboard, section);
  }

  const reportTab = (name: string) => {
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] });
    sheet.addRow([name]).font = { size: 17, bold: true, color: { argb: 'FF0F172A' } };
    sheet.addRow([title]);
    addDashboardLink(sheet.addRow(['Back to Dashboard']).getCell(1), 'Back to Dashboard', 'Dashboard');
    sheet.getColumn(1).width = 48;
    for (let column = 2; column <= 9; column++) sheet.getColumn(column).width = 20;
    return sheet;
  };
  for (const tab of detailTabs) {
    const sheet = reportTab(tab);
    for (const section of dashboardSections.filter(section => section.tab === tab)) writeDashboardSection(sheet, section);
  }
  const ordersSheet = reportTab('Order Details');
  writeDeliveryReportOrders(ordersSheet, rows);
  ordersSheet.views = [{ state: 'frozen', ySplit: 5, showGridLines: false }];
  void parity;
  return workbook;
};

export const exportDeliveryOrderCleanRowsToExcel = async (
  rows: DeliveryOrderCleanExportRow[],
  title: string,
  fileName: string,
  parity?: DeliveryCleanExportParityResult,
  dashboardSections: DeliveryDashboardExportSection[] = []
) => {
  assertExcelEnabled();
  const [workbook, { saveAs }] = await Promise.all([
    buildDeliveryCleanExportWorkbook(rows, title, parity, dashboardSections),
    import('file-saver')
  ]);
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
