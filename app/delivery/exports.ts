import type { Row, Workbook } from 'exceljs';
import { isModuleEnabled } from '../../config/clientConfig';
import { DeliveryDriverDutyReportRow, DeliveryOrder } from '../../types';

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

const styleHeader = (row: Row) => {
  row.font = { bold: true };
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const deliveryOrderNumber = (order: DeliveryOrder) => order.orderNumber || `#${order.id.slice(0, 8)}`;

const formatDutyDateTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const formatDutyHours = (minutes: number) => {
  const safe = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

const groupDutyRowsByDate = (rows: DeliveryDriverDutyReportRow[]) => {
  const map = new Map<string, {
    date: string;
    drivers: Set<string>;
    shifts: number;
    minutes: number;
    assigned: number;
    pickedUp: number;
    actual: number;
    internal: number;
    delivered: number;
    cancelled: number;
  }>();

  rows.forEach(row => {
    const current = map.get(row.statDate) || {
      date: row.statDate,
      drivers: new Set<string>(),
      shifts: 0,
      minutes: 0,
      assigned: 0,
      pickedUp: 0,
      actual: 0,
      internal: 0,
      delivered: 0,
      cancelled: 0
    };
    current.drivers.add(row.driverId);
    current.shifts += row.shiftCount;
    current.minutes += row.totalWorkingMinutes;
    current.assigned += row.assignedCount;
    current.pickedUp += row.pickedUpCount;
    current.actual += row.actualDeliveryCount;
    current.internal += row.internalTransferCount;
    current.delivered += row.deliveredCount;
    current.cancelled += row.cancelledCount;
    map.set(row.statDate, current);
  });

  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
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

const deliveryAreaLabel = (order: DeliveryOrder) => (
  order.areaName || (order.blockNumber ? 'Unknown area' : 'No mapped area')
);

const addKpiSheet = (
  workbook: Workbook,
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
  const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
    import('exceljs'),
    import('file-saver'),
  ]);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Delivery Orders');

  sheet.addRow([title]);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.addRow([]);

  const header = sheet.addRow([
    'Order #', 'Date', 'Type', 'Branch', 'From Branch', 'To Branch', 'Value (BHD)', 'Payment', 'Pharmacist', 'Driver ID', 'Driver', 'Block', 'Area', 'Governorate', 'Outside Governorate', 'Notes'
  ]);
  styleHeader(header);

  orders.forEach(order => {
    sheet.addRow([
      deliveryOrderNumber(order),
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
  sheet.getColumn(7).numFmt = '0.000';

  const totalRow = sheet.addRow([
    'TOTAL', '', '', '', '', '', Number(orders.reduce((a, o) => a + o.valueBhd, 0).toFixed(3)), `${orders.length} orders`
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
      order => `${order.governorate || 'No governorate'}|${deliveryAreaLabel(order)}`,
      deliveryAreaLabel,
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
  const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
    import('exceljs'),
    import('file-saver'),
  ]);
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

export const exportDriverDutyToExcel = async (
  rows: DeliveryDriverDutyReportRow[],
  title: string,
  fileName: string
) => {
  assertExcelEnabled();
  const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
    import('exceljs'),
    import('file-saver'),
  ]);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tabarak Hub';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Date Summary');
  summarySheet.addRow([title]);
  summarySheet.getRow(1).font = { bold: true, size: 14 };
  summarySheet.addRow([`Generated: ${formatDutyDateTime(new Date().toISOString())}`]);
  summarySheet.addRow([]);
  styleHeader(summarySheet.addRow([
    'Date',
    'Drivers',
    'Duty Sessions',
    'Working Hours',
    'Working Minutes',
    'Assigned',
    'Picked Up',
    'Actual Delivery',
    'Internal Transfer',
    'Delivered',
    'Cancelled'
  ]));

  groupDutyRowsByDate(rows).forEach(group => {
    summarySheet.addRow([
      group.date,
      group.drivers.size,
      group.shifts,
      formatDutyHours(group.minutes),
      group.minutes,
      group.assigned,
      group.pickedUp,
      group.actual,
      group.internal,
      group.delivered,
      group.cancelled
    ]);
  });

  const detailSheet = workbook.addWorksheet('Duty Details');
  detailSheet.addRow([title]);
  detailSheet.getRow(1).font = { bold: true, size: 14 };
  detailSheet.addRow([]);
  styleHeader(detailSheet.addRow([
    'Date',
    'Driver Code',
    'Driver Name',
    'Started Duty',
    'Finished Duty',
    'Duty Sessions',
    'Working Hours',
    'Working Minutes',
    'Start Branch',
    'Start Latitude',
    'Start Longitude',
    'Branch Distance (m)',
    'Assigned',
    'Picked Up',
    'Actual Delivery',
    'Internal Transfer',
    'Delivered',
    'Cancelled'
  ]));

  rows.forEach(row => {
    detailSheet.addRow([
      row.statDate,
      row.driverCode || '',
      row.driverName,
      formatDutyDateTime(row.firstOnlineAt),
      formatDutyDateTime(row.lastOfflineAt),
      row.shiftCount,
      formatDutyHours(row.totalWorkingMinutes),
      row.totalWorkingMinutes,
      row.startedBranchName || '',
      row.startedLat ?? '',
      row.startedLng ?? '',
      row.startedDistanceM ?? '',
      row.assignedCount,
      row.pickedUpCount,
      row.actualDeliveryCount,
      row.internalTransferCount,
      row.deliveredCount,
      row.cancelledCount
    ]);
  });

  const totalMinutes = rows.reduce((acc, row) => acc + row.totalWorkingMinutes, 0);
  const totalRow = detailSheet.addRow([
    'TOTAL',
    '',
    `${new Set(rows.map(row => row.driverId)).size} drivers`,
    '',
    '',
    rows.reduce((acc, row) => acc + row.shiftCount, 0),
    formatDutyHours(totalMinutes),
    totalMinutes,
    '',
    '',
    '',
    '',
    rows.reduce((acc, row) => acc + row.assignedCount, 0),
    rows.reduce((acc, row) => acc + row.pickedUpCount, 0),
    rows.reduce((acc, row) => acc + row.actualDeliveryCount, 0),
    rows.reduce((acc, row) => acc + row.internalTransferCount, 0),
    rows.reduce((acc, row) => acc + row.deliveredCount, 0),
    rows.reduce((acc, row) => acc + row.cancelledCount, 0)
  ]);
  totalRow.font = { bold: true };

  [summarySheet, detailSheet].forEach(sheet => {
    sheet.columns.forEach((column, index) => {
      column.width = index === 2 ? 26 : 18;
    });
  });

  detailSheet.getColumn(10).numFmt = '0.000000';
  detailSheet.getColumn(11).numFmt = '0.000000';
  detailSheet.getColumn(12).numFmt = '0';

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${fileName}.xlsx`
  );
};

export const printDriverDutyReport = (
  rows: DeliveryDriverDutyReportRow[],
  title: string,
  fileName: string
) => {
  const printWindow = window.open('', '_blank', 'width=1200,height=800');
  if (!printWindow) {
    throw new Error('Could not open the PDF print window. Please allow pop-ups for this site.');
  }

  const totals = rows.reduce((acc, row) => {
    acc.minutes += row.totalWorkingMinutes;
    acc.shifts += row.shiftCount;
    acc.actual += row.actualDeliveryCount;
    acc.internal += row.internalTransferCount;
    acc.delivered += row.deliveredCount;
    acc.cancelled += row.cancelledCount;
    acc.drivers.add(row.driverId);
    return acc;
  }, {
    minutes: 0,
    shifts: 0,
    actual: 0,
    internal: 0,
    delivered: 0,
    cancelled: 0,
    drivers: new Set<string>()
  });

  const bodyRows = rows.map(row => `
    <tr>
      <td>${escapeHtml(row.statDate)}</td>
      <td>${escapeHtml(row.driverCode || '')}</td>
      <td>${escapeHtml(row.driverName)}</td>
      <td>${escapeHtml(formatDutyDateTime(row.firstOnlineAt))}</td>
      <td>${escapeHtml(formatDutyDateTime(row.lastOfflineAt))}</td>
      <td>${escapeHtml(row.shiftCount)}</td>
      <td>${escapeHtml(formatDutyHours(row.totalWorkingMinutes))}</td>
      <td>${escapeHtml(row.startedBranchName || '')}</td>
      <td>${escapeHtml(row.assignedCount)}</td>
      <td>${escapeHtml(row.pickedUpCount)}</td>
      <td>${escapeHtml(row.actualDeliveryCount)}</td>
      <td>${escapeHtml(row.internalTransferCount)}</td>
      <td>${escapeHtml(row.deliveredCount)}</td>
      <td>${escapeHtml(row.cancelledCount)}</td>
    </tr>
  `).join('');

  const dateSummaryRows = groupDutyRowsByDate(rows).map(group => `
    <tr>
      <td>${escapeHtml(group.date)}</td>
      <td>${escapeHtml(group.drivers.size)}</td>
      <td>${escapeHtml(group.shifts)}</td>
      <td>${escapeHtml(formatDutyHours(group.minutes))}</td>
      <td>${escapeHtml(group.actual)}</td>
      <td>${escapeHtml(group.internal)}</td>
      <td>${escapeHtml(group.delivered)}</td>
      <td>${escapeHtml(group.cancelled)}</td>
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
          h2 { margin: 28px 0 10px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.12em; color: #991b1b; }
          .meta { margin-top: 6px; color: #64748b; font-size: 12px; font-weight: 700; }
          .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-top: 18px; }
          .kpi { border: 1px solid #e2e8f0; padding: 10px; }
          .kpi span { display: block; color: #64748b; font-size: 9px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; }
          .kpi strong { display: block; margin-top: 4px; font-size: 17px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
          th { background: #f8fafc; color: #475569; font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; }
          th, td { border: 1px solid #e2e8f0; padding: 7px; text-align: left; vertical-align: top; }
          tr:nth-child(even) td { background: #fcfcfd; }
          @page { size: landscape; margin: 12mm; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">Generated: ${escapeHtml(formatDutyDateTime(new Date().toISOString()))}</div>
        <div class="kpis">
          <div class="kpi"><span>Drivers</span><strong>${totals.drivers.size}</strong></div>
          <div class="kpi"><span>Sessions</span><strong>${totals.shifts}</strong></div>
          <div class="kpi"><span>Work hours</span><strong>${escapeHtml(formatDutyHours(totals.minutes))}</strong></div>
          <div class="kpi"><span>Actual</span><strong>${totals.actual}</strong></div>
          <div class="kpi"><span>Internal</span><strong>${totals.internal}</strong></div>
          <div class="kpi"><span>Closed</span><strong>${totals.delivered + totals.cancelled}</strong></div>
        </div>
        <h2>Date summary</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Drivers</th><th>Sessions</th><th>Hours</th><th>Actual</th><th>Internal</th><th>Delivered</th><th>Cancelled</th>
            </tr>
          </thead>
          <tbody>${dateSummaryRows || '<tr><td colspan="8">No data</td></tr>'}</tbody>
        </table>
        <h2>Duty details</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Code</th><th>Driver</th><th>Started</th><th>Finished</th><th>Sessions</th><th>Hours</th><th>Start branch</th><th>Assigned</th><th>Picked up</th><th>Actual</th><th>Internal</th><th>Delivered</th><th>Cancelled</th>
            </tr>
          </thead>
          <tbody>${bodyRows || '<tr><td colspan="14">No data</td></tr>'}</tbody>
        </table>
      </body>
    </html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
};

/** Open the browser print dialog targeting a printable section (PDF via "Save as PDF"). */
export const printReport = () => {
  window.print();
};
