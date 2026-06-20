import type { Row } from 'exceljs';
import { isModuleEnabled } from '../../config/clientConfig';
import type { BenefitPayTransfer, BenefitPayTransferType } from '../../types';

export type BenefitPayExportSortMode = 'time' | 'branch';

interface BenefitPayExportOptions {
  consolidated?: boolean;
  sortMode?: BenefitPayExportSortMode;
}

const assertExcelEnabled = () => {
  if (!isModuleEnabled('excelExport')) {
    throw new Error('Excel export is disabled for this client deployment');
  }
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const styleHeader = (row: Row) => {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF111827' } },
      bottom: { style: 'thin', color: { argb: 'FF111827' } },
      left: { style: 'thin', color: { argb: 'FF111827' } },
      right: { style: 'thin', color: { argb: 'FF111827' } }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
};

const compactDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-');
  return `${day || ''}${month || ''}${(year || '').slice(-2)}`;
};

const displayDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-');
  return `${Number(day)}/${Number(month)}/${year}`;
};

const formatBhd = (value: number) => Number(value || 0).toFixed(3);

const sourceLabel = (row: BenefitPayTransfer) =>
  row.source === 'delivery' ? `Delivery ${row.deliveryOrderNumber || ''}`.trim() : 'In-store';

const branchLabel = (row: BenefitPayTransfer) =>
  [row.branchCode, row.branchName].filter(Boolean).join(' - ') || 'Unknown branch';

const TRANSFER_TYPE_LABELS: Record<BenefitPayTransferType, string> = {
  AFS: 'Transfer AFS Benefit',
  CREDIMAX: 'Transfer Credimax Benefit',
  IBAN: 'Transfer IBAN Benefit'
};

const TRANSFER_TYPE_WIDTHS: Record<BenefitPayTransferType, number> = {
  AFS: 22,
  CREDIMAX: 24,
  IBAN: 22
};

const TRANSFER_TYPES: BenefitPayTransferType[] = ['AFS', 'CREDIMAX', 'IBAN'];

const totalsByType = (rows: BenefitPayTransfer[]) => rows.reduce((acc, row) => {
  acc.total += row.valueBhd;
  acc.count += 1;
  acc[row.transferType] += row.valueBhd;
  if (row.source === 'delivery') acc.delivery += row.valueBhd;
  else acc.manual += row.valueBhd;
  return acc;
}, {
  AFS: 0,
  CREDIMAX: 0,
  IBAN: 0,
  manual: 0,
  delivery: 0,
  total: 0,
  count: 0
});

const activeTransferTypes = (rows: BenefitPayTransfer[], totals: ReturnType<typeof totalsByType>) =>
  TRANSFER_TYPES.filter(type =>
    totals[type] > 0
    || rows.some(row => row.transferType === type && Number(row.valueBhd || 0) > 0)
  );

const compareByTime = (a: BenefitPayTransfer, b: BenefitPayTransfer) =>
  b.transferDate.localeCompare(a.transferDate)
  || b.transferTime.localeCompare(a.transferTime)
  || b.serialNumber.localeCompare(a.serialNumber);

const compareByBranch = (a: BenefitPayTransfer, b: BenefitPayTransfer) =>
  (a.branchCode || '').localeCompare(b.branchCode || '')
  || (a.branchName || '').localeCompare(b.branchName || '')
  || compareByTime(a, b);

const sortRows = (rows: BenefitPayTransfer[], sortMode: BenefitPayExportSortMode = 'time') =>
  [...rows].sort(sortMode === 'branch' ? compareByBranch : compareByTime);

const sanitizeSheetName = (name: string, fallback: string) => {
  const cleaned = (name || fallback)
    .replace(/[\\/?*[\]:]/g, '-')
    .trim()
    .slice(0, 31);
  return cleaned || fallback;
};

const addSheetWithUniqueName = (workbook: any, requestedName: string) => {
  const baseName = sanitizeSheetName(requestedName, 'Sheet');
  let nextName = baseName;
  let index = 2;
  while (workbook.getWorksheet(nextName)) {
    const suffix = ` ${index}`;
    nextName = `${baseName.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }
  return workbook.addWorksheet(nextName);
};

const addLedgerSheet = (
  workbook: any,
  sheetName: string,
  rows: BenefitPayTransfer[],
  title: string,
  options: { includeBranch?: boolean; sortMode?: BenefitPayExportSortMode } = {}
) => {
  const sheet = addSheetWithUniqueName(workbook, sheetName);
  sheet.addRow([title]);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.addRow([`Generated: ${new Date().toLocaleString('en-GB')}`]);
  sheet.addRow([]);

  const sorted = sortRows(rows, options.sortMode);
  const totals = totalsByType(sorted);
  const visibleTransferTypes = activeTransferTypes(sorted, totals);

  styleHeader(sheet.addRow([
    'No',
    ...(options.includeBranch ? ['Branch'] : []),
    'SN',
    'Date',
    ...visibleTransferTypes.map(type => TRANSFER_TYPE_LABELS[type]),
    'Time of Transfer',
    'Pharmacist',
    'Source'
  ]));

  sorted.forEach((row, index) => {
    const sheetRow = sheet.addRow([
      index + 1,
      ...(options.includeBranch ? [branchLabel(row)] : []),
      row.serialNumber,
      displayDate(row.transferDate),
      ...visibleTransferTypes.map(type => row.transferType === type ? Number(row.valueBhd.toFixed(3)) : ''),
      row.transferTime,
      row.pharmacistName || '',
      sourceLabel(row)
    ]);
    sheetRow.eachCell(cell => {
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF111827' } },
        left: { style: 'thin', color: { argb: 'FF111827' } },
        right: { style: 'thin', color: { argb: 'FF111827' } }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    sheetRow.getCell(options.includeBranch ? 4 : 3).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' }
    };
  });

  sheet.addRow([]);
  const totalRow = sheet.addRow([
    'TOTAL',
    ...(options.includeBranch ? [''] : []),
    '',
    '',
    ...visibleTransferTypes.map(type => Number(totals[type].toFixed(3))),
    '',
    `${totals.count} transfers`,
    Number(totals.total.toFixed(3))
  ]);
  totalRow.font = { bold: true };
  totalRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = { top: { style: 'thin', color: { argb: 'FF111827' } } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const sheetWidths = [
    8,
    ...(options.includeBranch ? [34] : []),
    22,
    14,
    ...visibleTransferTypes.map(type => TRANSFER_TYPE_WIDTHS[type]),
    18,
    24,
    26
  ];
  sheet.columns.forEach((column: any, index: number) => {
    column.width = sheetWidths[index] || 18;
    const transferStartIndex = options.includeBranch ? 4 : 3;
    if (index >= transferStartIndex && index < transferStartIndex + visibleTransferTypes.length) column.numFmt = '0.000';
  });

  return { sheet, totals };
};

const addSummarySheet = (workbook: any, rows: BenefitPayTransfer[], title: string) => {
  const summary = addSheetWithUniqueName(workbook, 'Summary');
  const sorted = sortRows(rows, 'branch');
  const grouped = sorted.reduce((acc, row) => {
    const key = row.branchCode || row.branchId;
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(row);
    return acc;
  }, new Map<string, BenefitPayTransfer[]>());
  const grandTotals = totalsByType(sorted);

  summary.addRow([title]);
  summary.getRow(1).font = { bold: true, size: 14 };
  summary.addRow([`Generated: ${new Date().toLocaleString('en-GB')}`]);
  summary.addRow([]);
  styleHeader(summary.addRow([
    'Branch Code',
    'Branch',
    'Transfers',
    'AFS',
    'Credimax',
    'IBAN',
    'In-store',
    'Delivery',
    'Grand Total'
  ]));

  Array.from(grouped.entries()).forEach(([, branchRows]) => {
    const first = branchRows[0];
    const totals = totalsByType(branchRows);
    summary.addRow([
      first.branchCode || '-',
      first.branchName || '-',
      totals.count,
      Number(totals.AFS.toFixed(3)),
      Number(totals.CREDIMAX.toFixed(3)),
      Number(totals.IBAN.toFixed(3)),
      Number(totals.manual.toFixed(3)),
      Number(totals.delivery.toFixed(3)),
      Number(totals.total.toFixed(3))
    ]);
  });

  summary.addRow([]);
  const totalRow = summary.addRow([
    'TOTAL',
    '',
    grandTotals.count,
    Number(grandTotals.AFS.toFixed(3)),
    Number(grandTotals.CREDIMAX.toFixed(3)),
    Number(grandTotals.IBAN.toFixed(3)),
    Number(grandTotals.manual.toFixed(3)),
    Number(grandTotals.delivery.toFixed(3)),
    Number(grandTotals.total.toFixed(3))
  ]);
  totalRow.font = { bold: true };
  totalRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  });

  summary.columns.forEach((column: any, index: number) => {
    column.width = [16, 34, 12, 14, 14, 14, 14, 14, 16][index] || 14;
    if (index >= 3) column.numFmt = '0.000';
  });
};

export const benefitPayExportFileName = (
  branchCode: string,
  from: string,
  to: string
) => `${branchCode || 'ALL'}-BP-${from === to ? compactDate(from) : `${compactDate(from)}-${compactDate(to)}`}`;

export const benefitPayConsolidatedExportFileName = (
  from: string,
  to: string
) => `BP - ${from === to ? compactDate(from) : `${compactDate(from)}-${compactDate(to)}`}`;

export const exportBenefitPayToExcel = async (
  rows: BenefitPayTransfer[],
  title: string,
  fileName: string,
  options: BenefitPayExportOptions = {}
) => {
  assertExcelEnabled();
  const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
    import('exceljs'),
    import('file-saver')
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tabarak Hub';
  workbook.created = new Date();

  if (options.consolidated) {
    addLedgerSheet(workbook, 'Consolidated', rows, title, {
      includeBranch: true,
      sortMode: options.sortMode
    });

    const sortedBranchGroups = sortRows(rows, 'branch').reduce((acc, row) => {
      const key = row.branchCode || row.branchId;
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key)!.push(row);
      return acc;
    }, new Map<string, BenefitPayTransfer[]>());

    Array.from(sortedBranchGroups.entries()).forEach(([key, branchRows]) => {
      const first = branchRows[0];
      addLedgerSheet(
        workbook,
        first.branchCode || key,
        branchRows,
        `${branchLabel(first)} - Benefit Pay Ledger`,
        { sortMode: 'time' }
      );
    });

    addSummarySheet(workbook, rows, `${title} - Summary`);
  } else {
    addLedgerSheet(workbook, 'BP Sheet', rows, title, { sortMode: options.sortMode });
    addSummarySheet(workbook, rows, `${title} - Summary`);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${fileName}.xlsx`
  );
};

export const printBenefitPayReport = (
  rows: BenefitPayTransfer[],
  title: string,
  fileName: string
) => {
  const printWindow = window.open('', '_blank', 'width=1200,height=800');
  if (!printWindow) throw new Error('Could not open the PDF print window. Please allow pop-ups for this site.');

  const sorted = sortRows(rows, 'time');
  const totals = totalsByType(sorted);
  const visibleTransferTypes = activeTransferTypes(sorted, totals);
  const transferHeaderCells = visibleTransferTypes
    .map(type => `<th>${escapeHtml(TRANSFER_TYPE_LABELS[type])}</th>`)
    .join('');
  const transferFooterCells = visibleTransferTypes
    .map(type => `<td>${escapeHtml(formatBhd(totals[type]))}</td>`)
    .join('');
  const columnCount = 6 + visibleTransferTypes.length;
  const bodyRows = sorted
    .map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.serialNumber)}</td>
        <td>${escapeHtml(displayDate(row.transferDate))}</td>
        ${visibleTransferTypes.map(type => `<td>${row.transferType === type ? escapeHtml(formatBhd(row.valueBhd)) : ''}</td>`).join('')}
        <td>${escapeHtml(row.transferTime)}</td>
        <td>${escapeHtml(row.pharmacistName || '')}</td>
        <td>${escapeHtml(sourceLabel(row))}</td>
      </tr>
    `).join('');

  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <title>${escapeHtml(fileName)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 28px; color: #0f172a; font-family: Inter, Arial, sans-serif; }
          h1 { margin: 0; font-size: 22px; letter-spacing: -0.02em; }
          .meta { margin-top: 6px; color: #64748b; font-size: 12px; font-weight: 700; }
          .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 18px; }
          .kpi { border: 1px solid #e2e8f0; padding: 10px; }
          .kpi span { display: block; color: #64748b; font-size: 9px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; }
          .kpi strong { display: block; margin-top: 4px; font-size: 17px; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 10px; }
          th { background: #0f172a; color: #fff; font-size: 8px; letter-spacing: 0.08em; }
          th, td { border: 1px solid #111827; padding: 7px; text-align: center; vertical-align: top; }
          td:nth-child(3) { background: #ffff00; }
          tfoot td { background: #e2e8f0; font-weight: 900; }
          @page { size: landscape; margin: 12mm; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">Generated: ${escapeHtml(new Date().toLocaleString('en-GB'))}</div>
        <div class="kpis">
          <div class="kpi"><span>Transfers</span><strong>${totals.count}</strong></div>
          <div class="kpi"><span>AFS</span><strong>${escapeHtml(formatBhd(totals.AFS))}</strong></div>
          <div class="kpi"><span>Credimax</span><strong>${escapeHtml(formatBhd(totals.CREDIMAX))}</strong></div>
          <div class="kpi"><span>IBAN</span><strong>${escapeHtml(formatBhd(totals.IBAN))}</strong></div>
          <div class="kpi"><span>Total</span><strong>${escapeHtml(formatBhd(totals.total))}</strong></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>No</th><th>SN</th><th>Date</th>${transferHeaderCells}<th>Time of Transfer</th><th>Pharmacist</th><th>Source</th>
            </tr>
          </thead>
          <tbody>${bodyRows || `<tr><td colspan="${columnCount}">No data</td></tr>`}</tbody>
          <tfoot>
            <tr><td>TOTAL</td><td></td><td></td>${transferFooterCells}<td></td><td>${totals.count} transfers</td><td>${escapeHtml(formatBhd(totals.total))}</td></tr>
          </tfoot>
        </table>
      </body>
    </html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
};
