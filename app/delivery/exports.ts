import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { isModuleEnabled } from '../../config/clientConfig';
import { DeliveryOrder } from '../../types';

const assertExcelEnabled = () => {
  if (!isModuleEnabled('excelExport')) {
    throw new Error('Excel export is disabled for this client deployment');
  }
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
    'Date', 'Branch', 'Value (BHD)', 'Payment', 'Pharmacist', 'Driver', 'Block', 'Area', 'Governorate', 'Outside Governorate', 'Notes'
  ]);
  header.font = { bold: true };
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });

  orders.forEach(order => {
    sheet.addRow([
      order.orderDate,
      order.branchName || '',
      Number(order.valueBhd.toFixed(3)),
      order.paymentType,
      order.pharmacistName || '',
      order.driverName || '',
      order.blockNumber || '',
      order.areaName || '',
      order.governorate || '',
      order.isOutsideGovernorate ? 'YES' : '',
      order.notes || ''
    ]);
  });

  sheet.columns.forEach(col => { col.width = 16; });
  sheet.getColumn(3).numFmt = '0.000';

  const totalRow = sheet.addRow([
    'TOTAL', '', Number(orders.reduce((a, o) => a + o.valueBhd, 0).toFixed(3)), `${orders.length} orders`
  ]);
  totalRow.font = { bold: true };

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
