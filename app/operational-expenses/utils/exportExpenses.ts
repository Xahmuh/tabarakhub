import { ExpenseTransaction, VehicleOdometerHistory } from '../../../types';

const addSheet = (workbook: any, sheetName: string, rows: Record<string, any>[]) => {
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));
  if (rows.length === 0) return;

  const headers = Array.from(new Set(rows.flatMap(row => Object.keys(row))));

  worksheet.columns = headers.map(header => ({
    header,
    key: header,
    width: Math.min(Math.max(header.length + 4, 15), 45)
  }));

  rows.forEach(row => worksheet.addRow(row));
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Calculate & add Total row at the bottom of the table
  const totalRow: Record<string, any> = {};
  headers.forEach((header, index) => {
    if (index === 0) {
      totalRow[header] = 'TOTAL / المجموع';
    } else {
      const lowerHeader = header.toLowerCase();
      const isNumericCol = rows.some(r => typeof r[header] === 'number');
      const isPercentageOrRate = lowerHeader.includes('share') || lowerHeader.includes('price');

      if (isNumericCol && !isPercentageOrRate) {
        const sum = rows.reduce((acc, r) => acc + (typeof r[header] === 'number' ? r[header] : 0), 0);
        if (lowerHeader.includes('bhd') || lowerHeader.includes('cost') || lowerHeader.includes('amount')) {
          totalRow[header] = Number(sum.toFixed(3));
        } else if (lowerHeader.includes('liters') || lowerHeader.includes('distance') || lowerHeader.includes('km')) {
          totalRow[header] = Number(sum.toFixed(1));
        } else {
          totalRow[header] = sum;
        }
      } else if (lowerHeader.includes('share')) {
        totalRow[header] = '100%';
      } else {
        totalRow[header] = '—';
      }
    }
  });

  const addedTotalRow = worksheet.addRow(totalRow);
  addedTotalRow.font = { bold: true };
  addedTotalRow.eachCell((cell: any) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'F1F5F9' }
    };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'double' }
    };
  });
};

const buildMonthlyPivotRows = (
  expensesList: ExpenseTransaction[],
  categorySlug?: string
) => {
  const filtered = categorySlug
    ? expensesList.filter(e => e.categorySlug === categorySlug)
    : expensesList;

  if (filtered.length === 0) return [];

  // Extract all unique YYYY-MM months from the expenses sorted chronologically
  const monthKeys = Array.from(
    new Set(filtered.map(e => (e.expenseDate || '').slice(0, 7)).filter(Boolean))
  ).sort();

  if (monthKeys.length === 0) return [];

  // Map month key (2026-08) to display label (Aug 2026)
  const formatMonthLabel = (ym: string) => {
    const [year, month] = ym.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Group by vehicle
  const vehicleGroupMap: Record<
    string,
    {
      plateNumber: string;
      vehicleCode: string;
      ownershipType: string;
      driverName: string;
      branchName: string;
      monthlyTotals: Record<string, number>;
      grandTotal: number;
      totalDistance: number;
    }
  > = {};

  filtered.forEach(e => {
    const plate = e.plateNumber?.trim() || '';
    const vCode = e.vehicleCode?.trim() || '';
    if (!plate && !vCode && !e.vehicleId) return;

    const key = plate || vCode || e.vehicleId || 'Unknown';
    const monthKey = (e.expenseDate || '').slice(0, 7);

    if (!vehicleGroupMap[key]) {
      vehicleGroupMap[key] = {
        plateNumber: plate || '—',
        vehicleCode: vCode || '—',
        ownershipType: e.ownershipType === 'External' ? 'Flexi (External)' : 'Internal',
        driverName: e.driverName || '—',
        branchName: e.branchCode ? `${e.branchName || ''} (${e.branchCode})` : '—',
        monthlyTotals: {},
        grandTotal: 0,
        totalDistance: 0
      };
    }

    if (!vehicleGroupMap[key].monthlyTotals[monthKey]) {
      vehicleGroupMap[key].monthlyTotals[monthKey] = 0;
    }

    vehicleGroupMap[key].monthlyTotals[monthKey] += e.amount;
    vehicleGroupMap[key].grandTotal += e.amount;

    if (e.fuelDetails && (e.fuelDetails.distanceSincePrevious || 0) > 0) {
      vehicleGroupMap[key].totalDistance += e.fuelDetails.distanceSincePrevious;
    }

    if (e.driverName && vehicleGroupMap[key].driverName === '—') {
      vehicleGroupMap[key].driverName = e.driverName;
    }
  });

  const sortedVehicles = Object.values(vehicleGroupMap).sort(
    (a, b) => b.grandTotal - a.grandTotal
  );

  return sortedVehicles.map((v, index) => {
    const row: Record<string, any> = {
      'S/N': index + 1,
      'Plate Number / رقم اللوحة': v.plateNumber !== '—' ? v.plateNumber : v.vehicleCode,
      'Vehicle Code / كود المركبة': v.vehicleCode,
      'Ownership Type / تصنيف الملكية': v.ownershipType
    };

    monthKeys.forEach(mKey => {
      const colName = `${formatMonthLabel(mKey)} (BHD)`;
      const amount = v.monthlyTotals[mKey] || 0;
      row[colName] = Number(amount.toFixed(3));
    });

    row['Total Expenses (BHD)'] = Number(v.grandTotal.toFixed(3));
    row['Distance Driven (KM)'] = Number(v.totalDistance.toFixed(1));
    row['Cost / KM (BHD/km)'] = v.totalDistance > 0 ? Number((v.grandTotal / v.totalDistance).toFixed(3)) : '—';
    return row;
  });
};

export const exportExpensesToExcel = async (expenses: ExpenseTransaction[], fileName = 'Operational_Expenses_Report') => {
  if (!expenses || expenses.length === 0) return;

  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  // 1. Detailed Transactions Sheet
  const detailedRows = expenses.map(e => ({
    'Reference No': e.referenceNo,
    'Status': e.status || 'Active',
    'Date': e.expenseDate,
    'Time': e.expenseTime || '—',
    'Branch': e.branchCode || '—',
    'Recorded By (Pharmacist)': e.createdBy || 'Not Specified',
    'Category': e.categoryName || '—',
    'Description': e.description || '—',
    'Paid To': e.paidTo || '—',
    'Amount (BHD)': Number(e.amount.toFixed(3)),
    'Driver': e.driverName || '—',
    'Vehicle Plate': e.plateNumber || '—',
    'Vehicle Code': e.vehicleCode || '—',
    'Ownership Type': e.ownershipType === 'External' ? 'Flexi (External)' : 'Internal',
    'Odometer (km)': e.fuelDetails?.currentOdometer || '—',
    'Distance (km)': e.fuelDetails?.distanceSincePrevious || '—',
    'Liters': e.fuelDetails?.liters || '—',
    'Price/Liter': e.fuelDetails?.fuelPricePerLiter || '—',
    'Cost/KM (BHD/km)': (e.fuelDetails?.distanceSincePrevious && e.fuelDetails.distanceSincePrevious > 0)
      ? Number((e.amount / e.fuelDetails.distanceSincePrevious).toFixed(3))
      : '—',
    'Receipt Provided to Accounts': e.receiptProvidedToAccounts ? 'Yes' : 'No'
  }));

  // 2. Vehicle Summary Sheet (Primary KPI - Vehicles Only)
  const vehicleMap: Record<string, { count: number; total: number; distance: number; ownershipType: string }> = {};
  expenses.forEach(e => {
    const plate = e.plateNumber?.trim();
    const vCode = e.vehicleCode?.trim();
    if (!plate && !vCode && !e.vehicleId) return;

    const key = plate ? `Plate: ${plate}` : `Code: ${vCode}`;
    if (!vehicleMap[key]) {
      vehicleMap[key] = {
        count: 0,
        total: 0,
        distance: 0,
        ownershipType: e.ownershipType === 'External' ? 'Flexi (External)' : 'Internal'
      };
    }
    vehicleMap[key].count++;
    vehicleMap[key].total += e.amount;
    if (e.fuelDetails) vehicleMap[key].distance += e.fuelDetails.distanceSincePrevious || 0;
  });

  const vehicleSummary = Object.entries(vehicleMap)
    .map(([veh, stats]) => ({
      'Vehicle Plate / Code': veh,
      'Ownership Type / تصنيف الملكية': stats.ownershipType,
      'Total Transactions': stats.count,
      'Total Distance (km)': stats.distance,
      'Total Amount (BHD)': Number(stats.total.toFixed(3)),
      'Cost / KM (BHD/km)': stats.distance > 0 ? Number((stats.total / stats.distance).toFixed(3)) : '—',
      'Share of Total (%)': grandTotal > 0 ? Number(((stats.total / grandTotal) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b['Total Amount (BHD)'] - a['Total Amount (BHD)']);

  // 3. Pharmacist Summary Sheet
  const pharmacistMap: Record<string, { count: number; total: number }> = {};
  expenses.forEach(e => {
    const key = e.createdBy?.trim() || 'Not Specified';
    if (!pharmacistMap[key]) pharmacistMap[key] = { count: 0, total: 0 };
    pharmacistMap[key].count++;
    pharmacistMap[key].total += e.amount;
  });

  const pharmacistSummary = Object.entries(pharmacistMap)
    .map(([name, stats]) => ({
      'Pharmacist / Recorded By': name,
      'Total Transactions': stats.count,
      'Total Amount (BHD)': Number(stats.total.toFixed(3)),
      'Share of Total (%)': grandTotal > 0 ? Number(((stats.total / grandTotal) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b['Total Amount (BHD)'] - a['Total Amount (BHD)']);

  // 4. Category Summary Sheet
  const categoryMap: Record<string, { count: number; total: number }> = {};
  expenses.forEach(e => {
    const key = e.categoryName || 'Unknown';
    if (!categoryMap[key]) categoryMap[key] = { count: 0, total: 0 };
    categoryMap[key].count++;
    categoryMap[key].total += e.amount;
  });

  const categorySummary = Object.entries(categoryMap)
    .map(([category, stats]) => ({
      'Category': category,
      'Total Transactions': stats.count,
      'Total Amount (BHD)': Number(stats.total.toFixed(3)),
      'Share of Total (%)': grandTotal > 0 ? Number(((stats.total / grandTotal) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b['Total Amount (BHD)'] - a['Total Amount (BHD)']);

  // 5. Fuel Report Sheet
  const fuelExpenses = expenses.filter(e => e.categorySlug === 'fuel' && e.fuelDetails);
  const fuelRows = fuelExpenses.map(e => ({
    'Reference No': e.referenceNo,
    'Date': e.expenseDate,
    'Recorded By (Pharmacist)': e.createdBy || 'Not Specified',
    'Driver': e.driverName || '—',
    'Vehicle Plate': e.plateNumber || '—',
    'Vehicle Code': e.vehicleCode || '—',
    'Ownership Type': e.ownershipType === 'External' ? 'Flexi (External)' : 'Internal',
    'Distance (km)': e.fuelDetails?.distanceSincePrevious || 0,
    'Liters': e.fuelDetails?.liters || 0,
    'Cost (BHD)': Number(e.amount.toFixed(3)),
    'Cost / KM (BHD/km)': (e.fuelDetails?.distanceSincePrevious && e.fuelDetails.distanceSincePrevious > 0)
      ? Number((e.amount / e.fuelDetails.distanceSincePrevious).toFixed(3))
      : '—'
  }));

  // 6. Vehicle Services Report Sheet
  const vehicleServicesExpenses = expenses.filter(e => e.categorySlug === 'vehicle_services');
  const vehicleServicesRows = vehicleServicesExpenses.map(e => ({
    'Reference No': e.referenceNo,
    'Date': e.expenseDate,
    'Recorded By (Pharmacist)': e.createdBy || 'Not Specified',
    'Driver': e.driverName || '—',
    'Vehicle Plate': e.plateNumber || '—',
    'Vehicle Code': e.vehicleCode || '—',
    'Ownership Type': e.ownershipType === 'External' ? 'Flexi (External)' : 'Internal',
    'Service Description': e.description || '—',
    'Paid To': e.paidTo || '—',
    'Cost (BHD)': Number(e.amount.toFixed(3))
  }));

  // 7. Monthly Pivot Breakdown for Fuel & Vehicle Services
  const fuelPivotRows = buildMonthlyPivotRows(expenses, 'fuel');
  const vehicleServicesPivotRows = buildMonthlyPivotRows(expenses, 'vehicle_services');

  const ExcelJS = await import('exceljs');
  const { saveAs } = await import('file-saver');
  const workbook = new ExcelJS.Workbook();

  addSheet(workbook, 'All Transactions', detailedRows);
  addSheet(workbook, 'By Vehicle Plate', vehicleSummary);
  addSheet(workbook, 'By Category', categorySummary);
  addSheet(workbook, 'By Pharmacist', pharmacistSummary);
  if (fuelRows.length > 0) {
    addSheet(workbook, 'Fuel Report', fuelRows);
  }
  if (fuelPivotRows.length > 0) {
    addSheet(workbook, 'Fuel Pivot (Monthly)', fuelPivotRows);
  }
  if (vehicleServicesRows.length > 0) {
    addSheet(workbook, 'Vehicle Services Report', vehicleServicesRows);
  }
  if (vehicleServicesPivotRows.length > 0) {
    addSheet(workbook, 'Vehicle Services Pivot', vehicleServicesPivotRows);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`
  );
};

export const exportExpensesToCSV = (expenses: ExpenseTransaction[], fileName = 'Operational_Expenses_Report') => {
  if (!expenses || expenses.length === 0) return;

  const headers = [
    'Reference No',
    'Date',
    'Time',
    'Branch',
    'Recorded By (Pharmacist)',
    'Category',
    'Description',
    'Paid To',
    'Amount (BHD)',
    'Driver',
    'Vehicle Plate',
    'Vehicle Code',
    'Ownership Type',
    'Odometer (km)',
    'Distance (km)',
    'Liters',
    'Price/Liter',
    'Cost/KM (BHD/km)',
    'Receipt Provided'
  ];

  const rows = expenses.map(e => [
    e.referenceNo || '',
    e.expenseDate || '',
    e.expenseTime || '',
    e.branchCode || '',
    `"${(e.createdBy || 'Not Specified').replace(/"/g, '""')}"`,
    `"${(e.categoryName || '').replace(/"/g, '""')}"`,
    `"${(e.description || '').replace(/"/g, '""')}"`,
    `"${(e.paidTo || '').replace(/"/g, '""')}"`,
    e.amount.toFixed(3),
    `"${(e.driverName || '').replace(/"/g, '""')}"`,
    `"${(e.plateNumber || '').replace(/"/g, '""')}"`,
    `"${(e.vehicleCode || '').replace(/"/g, '""')}"`,
    e.ownershipType === 'External' ? 'Flexi' : 'Internal',
    e.fuelDetails?.currentOdometer || '',
    e.fuelDetails?.distanceSincePrevious || '',
    e.fuelDetails?.liters || '',
    e.fuelDetails?.fuelPricePerLiter || '',
    (e.fuelDetails?.distanceSincePrevious && e.fuelDetails.distanceSincePrevious > 0)
      ? (e.amount / e.fuelDetails.distanceSincePrevious).toFixed(3)
      : '',
    e.receiptProvidedToAccounts ? 'Yes' : 'No'
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportVehicleOdometerToExcel = async (
  vehicle: { plateNumber?: string; vehicleCode: string; vehicleType: string; crNumber?: string; registrationExpiryDate?: string },
  history: VehicleOdometerHistory[]
) => {
  const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
    import('exceljs'),
    import('file-saver'),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tabarak Hub';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Odometer History');

  // Title
  sheet.addRow([`Odometer & Expense History — ${vehicle.plateNumber ? `Plate: ${vehicle.plateNumber}` : vehicle.vehicleCode}`]);
  sheet.getRow(1).font = { bold: true, size: 14 };
  const extraInfo = [
    `Vehicle Code: ${vehicle.vehicleCode}`,
    `Type: ${vehicle.vehicleType}`,
    vehicle.crNumber ? `CR No: ${vehicle.crNumber}` : null,
    vehicle.registrationExpiryDate ? `Reg. Expiry: ${vehicle.registrationExpiryDate}` : null,
    `Generated: ${new Date().toLocaleDateString('en-GB')}`
  ].filter(Boolean).join(' | ');
  sheet.addRow([extraInfo]);
  sheet.getRow(2).font = { color: { argb: 'FF64748B' }, size: 10 };
  sheet.addRow([]);

  // Headers
  const headerRow = sheet.addRow(['#', 'Date & Time', 'Odometer Reading (km)', 'Driver Name', 'Location / Branch', 'Amount Paid (BHD)', 'Source Type']);
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });

  // Sort history chronologically from oldest to newest (so INITIAL is row #1)
  const sortedHistory = [...history].sort((a, b) => {
    if (a.sourceType === 'INITIAL' && b.sourceType !== 'INITIAL') return -1;
    if (b.sourceType === 'INITIAL' && a.sourceType !== 'INITIAL') return 1;
    const dateA = new Date(a.readingDate || a.createdAt).getTime();
    const dateB = new Date(b.readingDate || b.createdAt).getTime();
    return dateA - dateB;
  });

  sortedHistory.forEach((row, idx) => {
    const formattedDate = new Date(row.readingDate || row.createdAt).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    sheet.addRow([
      idx + 1,
      formattedDate,
      row.odometerReading,
      row.driverName || '—',
      row.location || row.branchName || '—',
      row.amount !== undefined ? row.amount : '—',
      row.sourceType.replace(/_/g, ' ')
    ]);
  });

  sheet.columns.forEach(col => { col.width = 20; });
  sheet.getColumn(1).width = 8;
  sheet.getColumn(3).numFmt = '#,##0.0';
  sheet.getColumn(6).numFmt = '0.000';

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `Odometer_History_${(vehicle.plateNumber || vehicle.vehicleCode).replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
};

export const exportExpensesToPDF = (
  expenses: ExpenseTransaction[],
  title = 'Operational Expenses Report',
  branchName = 'All Branches'
) => {
  if (!expenses || expenses.length === 0) return;

  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  // Group by Category
  const categoryMap: Record<string, { name: string; count: number; total: number }> = {};
  expenses.forEach(e => {
    const key = e.categoryName || 'General';
    if (!categoryMap[key]) categoryMap[key] = { name: key, count: 0, total: 0 };
    categoryMap[key].count++;
    categoryMap[key].total += e.amount;
  });

  // Group by Vehicle Plate (Vehicles Only)
  const vehicleMap: Record<string, { count: number; total: number; distance: number }> = {};
  expenses.forEach(e => {
    const plate = e.plateNumber?.trim();
    const vCode = e.vehicleCode?.trim();
    if (!plate && !vCode && !e.vehicleId) return;

    const key = plate ? `Plate: ${plate}` : `Code: ${vCode}`;
    if (!vehicleMap[key]) vehicleMap[key] = { count: 0, total: 0, distance: 0 };
    vehicleMap[key].count++;
    vehicleMap[key].total += e.amount;
    if (e.fuelDetails) vehicleMap[key].distance += e.fuelDetails.distanceSincePrevious || 0;
  });

  const printWindow = window.open('', '_blank', 'width=1100,height=850');
  if (!printWindow) {
    alert('Could not open the PDF print window. Please allow pop-ups for this site.');
    return;
  }

  const escapeHtml = (val: any) => String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const transactionRows = expenses.map((e, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHtml(e.referenceNo)}</td>
      <td>${escapeHtml(e.expenseDate)}</td>
      <td>${escapeHtml(e.branchCode || '—')}</td>
      <td>${escapeHtml(e.categoryName || '—')}</td>
      <td>${escapeHtml(e.description || '—')}</td>
      <td>${escapeHtml(e.createdBy || '—')}</td>
      <td>${escapeHtml(e.driverName || '—')}</td>
      <td>${escapeHtml(e.plateNumber ? `Plate: ${e.plateNumber}` : (e.vehicleCode || '—'))}</td>
      <td style="text-align: right; font-weight: bold;">${e.amount.toFixed(3)} BHD</td>
    </tr>
  `).join('');

  const categoryRows = Object.values(categoryMap).map(c => `
    <tr>
      <td>${escapeHtml(c.name)}</td>
      <td>${c.count}</td>
      <td style="text-align: right; font-weight: bold;">${c.total.toFixed(3)} BHD</td>
      <td style="text-align: right;">${grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : 0}%</td>
    </tr>
  `).join('');

  const vehicleRows = Object.entries(vehicleMap).map(([veh, stats]) => `
    <tr>
      <td>${escapeHtml(veh)}</td>
      <td>${stats.count}</td>
      <td>${stats.distance > 0 ? `${stats.distance.toLocaleString()} km` : '—'}</td>
      <td style="text-align: right; font-weight: bold;">${stats.total.toFixed(3)} BHD</td>
      <td style="text-align: right;">${grandTotal > 0 ? ((stats.total / grandTotal) * 100).toFixed(1) : 0}%</td>
    </tr>
  `).join('');

  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)} - ${escapeHtml(branchName)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 24px; color: #0f172a; font-family: Inter, Arial, sans-serif; font-size: 11px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
          h1 { margin: 0; font-size: 20px; font-weight: 900; color: #000; }
          .meta { color: #64748b; font-size: 11px; font-weight: 600; }
          .branch-badge { font-size: 13px; font-weight: 800; color: #059669; margin-top: 4px; display: inline-block; }
          .kpis { display: flex; gap: 16px; margin-bottom: 20px; }
          .kpi { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
          .kpi span { display: block; color: #64748b; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
          .kpi strong { display: block; margin-top: 4px; font-size: 18px; color: #0f172a; }
          h2 { margin: 20px 0 8px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #334155; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; }
          th { background: #f1f5f9; color: #475569; font-size: 9px; text-transform: uppercase; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
          td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: middle; }
          tr:nth-child(even) td { background: #f8fafc; }
          .total-row td { font-weight: bold; background: #f1f5f9; border-top: 2px solid #cbd5e1; }
          @media print {
            @page { size: landscape; margin: 10mm; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Operational Expenses Report</h1>
            <div class="branch-badge">Branch: ${escapeHtml(branchName)}</div>
          </div>
          <div class="meta" style="text-align: right;">
            <div>Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div>Total Transactions: ${expenses.length}</div>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi">
            <span>Total Expenses</span>
            <strong>${grandTotal.toFixed(3)} BHD</strong>
          </div>
          <div class="kpi">
            <span>Total Transactions</span>
            <strong>${expenses.length}</strong>
          </div>
          <div class="kpi">
            <span>Vehicles Active</span>
            <strong>${Object.keys(vehicleMap).length}</strong>
          </div>
        </div>

        <h2>Category Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Transactions</th>
              <th style="text-align: right;">Total Amount</th>
              <th style="text-align: right;">Share %</th>
            </tr>
          </thead>
          <tbody>${categoryRows}</tbody>
        </table>

        <h2>Vehicle Plate Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Vehicle Plate / Code</th>
              <th>Transactions</th>
              <th>Distance Driven</th>
              <th style="text-align: right;">Total Amount</th>
              <th style="text-align: right;">Share %</th>
            </tr>
          </thead>
          <tbody>${vehicleRows}</tbody>
        </table>

        <h2>All Transactions Log</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Ref No</th>
              <th>Date</th>
              <th>Branch</th>
              <th>Category</th>
              <th>Description</th>
              <th>Recorded By</th>
              <th>Driver</th>
              <th>Vehicle Plate</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${transactionRows}
            <tr class="total-row">
              <td colspan="9" style="text-align: right;">GRAND TOTAL:</td>
              <td style="text-align: right; color: #059669;">${grandTotal.toFixed(3)} BHD</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>`);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
};
