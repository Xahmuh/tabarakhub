import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { isModuleEnabled } from '../../config/clientConfig';
import { DeliveryOrder } from '../../types';

const assertExcelEnabled = () => {
  if (!isModuleEnabled('excelExport')) {
    throw new Error('Excel export is disabled for this client deployment');
  }
};

type KpiRow = {
  key: string;
  label: string;
  secondary?: string;
  orders: number;
  value: number;
};

const styleHeader = (row: ExcelJS.Row) => {
  row.font = { bold: true };
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });
};

const buildKpis = (
  orders: DeliveryOrder[],
  getKey: (order: DeliveryOrder) => string,
  getLabel: (order: DeliveryOrder) => string,
  getSecondary?: (order: DeliveryOrder) => string | undefined
): KpiRow[] => {
  const map = new Map<string, KpiRow>();
  orders.forEach(order => {
    const key = getKey(order);
    const existing = map.get(key) || {
      key,
      label: getLabel(order),
      secondary: getSecondary?.(order),
      orders: 0,
      value: 0
    };
    existing.orders += 1;
    existing.value += order.valueBhd;
    map.set(key, existing);
  });

  return [...map.values()]
    .sort((a, b) => b.orders - a.orders || b.value - a.value || a.label.localeCompare(b.label));
};

const addKpiSheet = (
  workbook: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  entityLabel: string,
  rows: KpiRow[],
  secondaryLabel?: string
) => {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow([title]);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.addRow([]);

  const columns = secondaryLabel
    ? ['Rank', entityLabel, secondaryLabel, 'Orders', 'Total Value (BHD)']
    : ['Rank', entityLabel, 'Orders', 'Total Value (BHD)'];
  styleHeader(sheet.addRow(columns));

  rows.forEach((row, index) => {
    const values = secondaryLabel
      ? [index + 1, row.label, row.secondary || '', row.orders, Number(row.value.toFixed(3))]
      : [index + 1, row.label, row.orders, Number(row.value.toFixed(3))];
    sheet.addRow(values);
  });

  if (rows.length === 0) {
    sheet.addRow(['No data']);
  }

  const totalValue = rows.reduce((acc, row) => acc + row.value, 0);
  const totalOrders = rows.reduce((acc, row) => acc + row.orders, 0);
  sheet.addRow([]);
  const totalRow = secondaryLabel
    ? sheet.addRow(['TOTAL', '', '', totalOrders, Number(totalValue.toFixed(3))])
    : sheet.addRow(['TOTAL', '', totalOrders, Number(totalValue.toFixed(3))]);
  totalRow.font = { bold: true };

  sheet.columns.forEach(col => { col.width = 22; });
  sheet.getColumn(1).width = 10;
  sheet.getColumn(secondaryLabel ? 5 : 4).numFmt = '0.000';
};

export const exportOrdersToExcel = async (
  orders: DeliveryOrder[],
  title: string,
  fileName: string
) => {
  assertExcelEnabled();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Delivery Orders');

  sheet.addRow([title]);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.addRow([]);

  const header = sheet.addRow([
    'Date', 'Type', 'Branch', 'From Branch', 'To Branch', 'Value (BHD)', 'Payment', 'Pharmacist', 'Driver ID', 'Driver', 'Block', 'Area', 'Governorate', 'Outside Governorate', 'Notes'
  ]);
  styleHeader(header);

  orders.forEach(order => {
    sheet.addRow([
      order.orderDate,
      order.orderKind === 'internal_transfer' ? 'Internal transfer' : 'Actual delivery',
      order.branchName || '',
      order.transferFromBranchName || '',
      order.transferToBranchName || '',
      Number(order.valueBhd.toFixed(3)),
      order.paymentType,
      order.pharmacistName || '',
      order.driverCode || '',
      order.driverName || '',
      order.blockNumber || '',
      order.areaName || '',
      order.governorate || '',
      order.isOutsideGovernorate ? 'YES' : '',
      order.notes || ''
    ]);
  });

  sheet.columns.forEach(col => { col.width = 16; });
  sheet.getColumn(6).numFmt = '0.000';

  const totalRow = sheet.addRow([
    'TOTAL', '', '', '', '', Number(orders.reduce((a, o) => a + o.valueBhd, 0).toFixed(3)), `${orders.length} orders`
  ]);
  totalRow.font = { bold: true };

  addKpiSheet(
    workbook,
    'Pharmacist KPIs',
    `${title} - Pharmacist KPIs`,
    'Pharmacist',
    buildKpis(
      orders,
      order => order.pharmacistId || `name:${order.pharmacistName || 'unassigned'}`,
      order => order.pharmacistName || 'Unassigned pharmacist'
    )
  );

  addKpiSheet(
    workbook,
    'Driver KPIs',
    `${title} - Driver KPIs`,
    'Driver',
    buildKpis(
      orders,
      order => order.driverId || `name:${order.driverName || 'unassigned'}`,
      order => order.driverName || 'Unassigned driver',
      order => order.driverCode || undefined
    ),
    'Driver ID'
  );

  addKpiSheet(
    workbook,
    'Area KPIs',
    `${title} - Area KPIs`,
    'Area',
    buildKpis(
      orders,
      order => `${order.governorate || 'No governorate'}|${order.areaName || (order.paymentType === 'TALABAT' ? 'Talabat / No area' : 'Unknown area')}`,
      order => order.areaName || (order.paymentType === 'TALABAT' ? 'Talabat / No area' : 'Unknown area'),
      order => order.governorate || undefined
    ),
    'Governorate'
  );

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${fileName}.xlsx`);
};

export const exportBreakdownToExcel = async (
  rows: Array<Record<string, string | number>>,
  columns: Array<{ key: string; label: string; numFmt?: string }>,
  title: string,
  fileName: string
) => {
  assertExcelEnabled();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Breakdown');

  sheet.addRow([title]);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.addRow([]);

  const header = sheet.addRow(columns.map(c => c.label));
  header.font = { bold: true };
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  });

  rows.forEach(row => sheet.addRow(columns.map(c => row[c.key] ?? '')));
  sheet.columns.forEach((col, i) => {
    col.width = 20;
    if (columns[i]?.numFmt) col.numFmt = columns[i].numFmt as string;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${fileName}.xlsx`);
};

/** Open the browser print dialog targeting a printable section (PDF via "Save as PDF"). */
export const printReport = () => {
  window.print();
};
