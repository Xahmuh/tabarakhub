import { isModuleEnabled } from '../../config/clientConfig';
import { supabaseClient } from '../../lib/supabaseClient';
import { Branch } from '../../types';
import { mapBranchName } from '../../utils/excelUtils';
import { isManagerRole } from '../../lib/access';

type ExportScope = {
  branchId: string | null;
  branchIds?: string[];
  label: string;
  filePart: string;
};

type LostSaleExportRow = {
  id: string;
  branch_id: string;
  branch_name?: string | null;
  pharmacist_id?: string | null;
  internal_code?: string | null;
  product_name?: string | null;
  lost_date?: string | null;
  timestamp?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  total_value?: number | string | null;
  category?: string | null;
  agent_name?: string | null;
  alternative_given?: boolean | null;
  internal_transfer?: boolean | null;
  notes?: string | null;
  pharmacist_name?: string | null;
};

type ShortageExportRow = {
  id: string;
  branch_id: string;
  branch_name?: string | null;
  pharmacist_id?: string | null;
  pharmacist_name?: string | null;
  internal_code?: string | null;
  product_name?: string | null;
  category?: string | null;
  agent_name?: string | null;
  status?: string | null;
  timestamp?: string | null;
  notes?: string | null;
};

const createExcelWorkbook = async () => {
  if (!isModuleEnabled('excelExport')) {
    throw new Error('Excel export is disabled for this client deployment');
  }

  const ExcelJS = await import('exceljs');
  return new ExcelJS.Workbook();
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYesterdayWindow = () => {
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return {
    start,
    end,
    date: toDateKey(start)
  };
};

const sanitizeExportFilePart = (value: string) =>
  value
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'Branch';

const canExportAllVisible = (user: Branch) => isManagerRole(user.role);

const fetchVisibleBranchIds = async (): Promise<string[]> => {
  const { data, error } = await supabaseClient
    .from('branches')
    .select('id')
    .eq('role', 'branch');

  if (error) throw error;
  return (data || [])
    .map(row => row.id)
    .filter((id): id is string => Boolean(id));
};

const resolveExportScope = async (user: Branch): Promise<ExportScope> => {
  if (canExportAllVisible(user)) {
    const branchIds = await fetchVisibleBranchIds();
    return {
      branchId: null,
      branchIds,
      label: 'All visible branches',
      filePart: 'All_Visible_Branches'
    };
  }

  const label = mapBranchName(user.name || user.code || 'Branch');
  return {
    branchId: user.id,
    label,
    filePart: sanitizeExportFilePart(label)
  };
};

const fetchAllPages = async (baseQuery: any): Promise<any[]> => {
  const pageSize = 1000;
  let from = 0;
  let all: any[] = [];

  while (true) {
    const { data, error } = await baseQuery.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = [...all, ...data];
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
};

const applyYesterdayScope = (query: any, scope: ExportScope, branchIdOverride?: string | null) => {
  const yesterday = getYesterdayWindow();
  let scopedQuery = query
    .gte('timestamp', yesterday.start.toISOString())
    .lte('timestamp', yesterday.end.toISOString());

  const branchId = branchIdOverride ?? scope.branchId;
  if (branchId) {
    scopedQuery = scopedQuery.eq('branch_id', branchId);
  }

  return scopedQuery.order('timestamp', { ascending: false });
};

const styleWorksheetHeader = (worksheet: any) => {
  worksheet.getRow(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  worksheet.getRow(1).alignment = { horizontal: 'center' };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount }
  };
};

const formatDate = (timestamp?: string | null) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
};

const formatTime = (timestamp?: string | null) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const addLostSalesSheets = (workbook: any, rows: LostSaleExportRow[]) => {
  const worksheet = workbook.addWorksheet('Lost Sales Yesterday');
  worksheet.columns = [
    { header: 'Internal Code', key: 'internal_code', width: 22 },
    { header: 'Product Name', key: 'product_name', width: 45 },
    { header: 'Date', key: 'lost_date', width: 14 },
    { header: 'Time', key: 'time', width: 14 },
    { header: 'Branch', key: 'branch_name', width: 28 },
    { header: 'Qty', key: 'quantity', width: 10 },
    { header: 'Price (BHD)', key: 'unit_price', width: 16, style: { numFmt: '0.000' } },
    { header: 'Total (BHD)', key: 'total_value', width: 16, style: { numFmt: '0.000' } },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Agent Code / Name', key: 'agent_name', width: 25 },
    { header: 'Alternative Given', key: 'alternative_given', width: 18 },
    { header: 'Internal Transfer', key: 'internal_transfer', width: 18 },
    { header: 'Remarks', key: 'notes', width: 35 },
    { header: 'Pharmacist', key: 'pharmacist_name', width: 25 }
  ];

  rows.forEach(row => {
    worksheet.addRow({
      internal_code: row.internal_code || 'N/A',
      product_name: row.product_name || 'N/A',
      lost_date: row.lost_date || formatDate(row.timestamp),
      time: formatTime(row.timestamp),
      branch_name: mapBranchName(row.branch_name || 'Unknown'),
      quantity: Number(row.quantity || 0),
      unit_price: Number(row.unit_price || 0),
      total_value: Number(row.total_value || 0),
      category: row.category || 'General',
      agent_name: row.agent_name || 'N/A',
      alternative_given: row.alternative_given ? 'Yes' : 'No',
      internal_transfer: row.internal_transfer ? 'Yes' : 'No',
      notes: row.notes || '',
      pharmacist_name: row.pharmacist_name || 'N/A'
    });
  });

  styleWorksheetHeader(worksheet);

  const byItemSheet = workbook.addWorksheet('Lost Sales By Item');
  byItemSheet.columns = [
    { header: 'Internal Code', key: 'internal_code', width: 22 },
    { header: 'Product Name', key: 'product_name', width: 45 },
    { header: 'Agent Name', key: 'agent_name', width: 30 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Total Qty Lost', key: 'quantity', width: 15 },
    { header: 'Total Value (BHD)', key: 'total_value', width: 20, style: { numFmt: '0.000' } }
  ];

  const byItem = new Map<string, {
    internal_code: string;
    agent_name: string;
    category: string;
    quantity: number;
    total_value: number;
  }>();

  rows.forEach(row => {
    const productName = row.product_name || 'N/A';
    const current = byItem.get(productName) || {
      internal_code: row.internal_code || 'N/A',
      agent_name: row.agent_name || 'N/A',
      category: row.category || 'General',
      quantity: 0,
      total_value: 0
    };
    current.quantity += Number(row.quantity || 0);
    current.total_value += Number(row.total_value || 0);
    byItem.set(productName, current);
  });

  Array.from(byItem.entries())
    .sort((a, b) => b[1].total_value - a[1].total_value)
    .forEach(([productName, stats]) => {
      byItemSheet.addRow({
        product_name: productName,
        ...stats
      });
    });

  styleWorksheetHeader(byItemSheet);
};

const addShortageSheets = (workbook: any, rows: ShortageExportRow[]) => {
  const worksheet = workbook.addWorksheet('Shortages Yesterday');
  worksheet.columns = [
    { header: 'Internal Code', key: 'internal_code', width: 22 },
    { header: 'Product Name', key: 'product_name', width: 45 },
    { header: 'Category', key: 'category', width: 25 },
    { header: 'Agent Name', key: 'agent_name', width: 30 },
    { header: 'Reporting Branch', key: 'branch_name', width: 30 },
    { header: 'Pharmacist', key: 'pharmacist_name', width: 30 },
    { header: 'Current Status', key: 'status', width: 20 },
    { header: 'Logged Date', key: 'date', width: 15 },
    { header: 'Logged Time', key: 'time', width: 15 },
    { header: 'Remarks', key: 'notes', width: 35 }
  ];

  rows.forEach(row => {
    worksheet.addRow({
      internal_code: row.internal_code || 'N/A',
      product_name: row.product_name || 'N/A',
      category: row.category || 'General',
      agent_name: row.agent_name || 'N/A',
      branch_name: mapBranchName(row.branch_name || 'Unknown'),
      pharmacist_name: row.pharmacist_name || 'N/A',
      status: row.status || 'N/A',
      date: formatDate(row.timestamp),
      time: formatTime(row.timestamp),
      notes: row.notes || ''
    });
  });

  styleWorksheetHeader(worksheet);

  const statusSheet = workbook.addWorksheet('Shortage Status');
  statusSheet.columns = [
    { header: 'Status', key: 'status', width: 22 },
    { header: 'Report Count', key: 'count', width: 16 }
  ];

  const byStatus = new Map<string, number>();
  rows.forEach(row => {
    const status = row.status || 'N/A';
    byStatus.set(status, (byStatus.get(status) || 0) + 1);
  });

  Array.from(byStatus.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => statusSheet.addRow({ status, count }));

  styleWorksheetHeader(statusSheet);
};

const addSummarySheet = (
  workbook: any,
  scope: ExportScope,
  lostSalesRows: LostSaleExportRow[],
  shortageRows: ShortageExportRow[]
) => {
  const yesterday = getYesterdayWindow();
  const worksheet = workbook.addWorksheet('Summary');
  worksheet.columns = [
    { header: 'Metric', key: 'metric', width: 32 },
    { header: 'Value', key: 'value', width: 28 }
  ];
  worksheet.addRows([
    { metric: 'Scope', value: scope.label },
    { metric: 'Date', value: yesterday.date },
    { metric: 'Lost sales records', value: lostSalesRows.length },
    { metric: 'Lost sales units', value: lostSalesRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0) },
    { metric: 'Lost sales value (BHD)', value: lostSalesRows.reduce((sum, row) => sum + Number(row.total_value || 0), 0).toFixed(3) },
    { metric: 'Shortage reports', value: shortageRows.length },
    { metric: 'Critical shortages', value: shortageRows.filter(row => row.status === 'Critical').length },
    { metric: 'Out of stock', value: shortageRows.filter(row => row.status === 'Out of Stock').length }
  ]);
  styleWorksheetHeader(worksheet);
};

const saveWorkbook = async (workbook: any, filename: string) => {
  const { saveAs } = await import('file-saver');
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, filename);
};

const fetchYesterdayLostSalesForBranch = async (
  scope: ExportScope,
  branchIdOverride?: string | null
): Promise<LostSaleExportRow[]> => {
  const query = applyYesterdayScope(
    supabaseClient.from('lost_sales_excel_export').select('*'),
    scope,
    branchIdOverride
  );
  return fetchAllPages(query) as Promise<LostSaleExportRow[]>;
};

const fetchYesterdayLostSales = async (scope: ExportScope): Promise<LostSaleExportRow[]> => {
  const branchIds = scope.branchIds?.filter(Boolean) || [];
  if (branchIds.length === 0) {
    return fetchYesterdayLostSalesForBranch(scope);
  }

  const rows: LostSaleExportRow[] = [];
  for (const branchId of branchIds) {
    rows.push(...await fetchYesterdayLostSalesForBranch(scope, branchId));
  }
  return rows.sort((a, b) => new Date(b.timestamp || '').getTime() - new Date(a.timestamp || '').getTime());
};

const fetchYesterdayShortagesForBranch = async (
  branchId: string,
  dateFrom: string,
  dateTo: string
): Promise<ShortageExportRow[]> => {
  const PAGE_SIZE = 1000;
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
};

const fetchYesterdayShortages = async (scope: ExportScope): Promise<ShortageExportRow[]> => {
  const yesterday = getYesterdayWindow();
  const branchIds = scope.branchIds?.filter(Boolean) || (scope.branchId ? [scope.branchId] : []);
  if (branchIds.length === 0) {
    throw new Error('Shortage export requires a branch scope. Select one branch and retry.');
  }

  const rows: ShortageExportRow[] = [];
  for (const branchId of branchIds) {
    rows.push(...await fetchYesterdayShortagesForBranch(branchId, yesterday.date, yesterday.date));
  }
  return rows.sort((a, b) => new Date(b.timestamp || '').getTime() - new Date(a.timestamp || '').getTime());
};

export const exportYesterdayLostSales = async (user: Branch) => {
  const scope = await resolveExportScope(user);
  const yesterday = getYesterdayWindow();
  const rows = await fetchYesterdayLostSales(scope);
  const workbook = await createExcelWorkbook();
  addLostSalesSheets(workbook, rows);
  await saveWorkbook(workbook, `Tabarak_${scope.filePart}_Lost_Sales_Yesterday_${yesterday.date}.xlsx`);
  return rows.length;
};

export const exportYesterdayShortages = async (user: Branch) => {
  const scope = await resolveExportScope(user);
  const yesterday = getYesterdayWindow();
  const rows = await fetchYesterdayShortages(scope);
  const workbook = await createExcelWorkbook();
  addShortageSheets(workbook, rows);
  await saveWorkbook(workbook, `Tabarak_${scope.filePart}_Shortages_Yesterday_${yesterday.date}.xlsx`);
  return rows.length;
};

export const exportYesterdayOperationsPack = async (user: Branch) => {
  const scope = await resolveExportScope(user);
  const yesterday = getYesterdayWindow();
  const [lostSalesRows, shortageRows] = await Promise.all([
    fetchYesterdayLostSales(scope),
    fetchYesterdayShortages(scope)
  ]);
  const workbook = await createExcelWorkbook();
  addSummarySheet(workbook, scope, lostSalesRows, shortageRows);
  addLostSalesSheets(workbook, lostSalesRows);
  addShortageSheets(workbook, shortageRows);
  await saveWorkbook(workbook, `Tabarak_${scope.filePart}_Yesterday_Operations_Pack_${yesterday.date}.xlsx`);
  return {
    lostSalesCount: lostSalesRows.length,
    shortageCount: shortageRows.length
  };
};
