import { OperationalRenewalRecord, OperationalRenewalType } from '../../../types';
import { getOperationalEntityDisplayName, resolveSmartCostCenter } from '../../../services/operationalRenewalService';

// Category Friendly Names & Descriptions
const CATEGORY_META: Record<OperationalRenewalType, { label: string; desc: string }> = {
  CR: { label: 'Commercial Registration', desc: 'MOIC Commercial Registration & Commercial Activities' },
  CHAMBER_OF_COMMERCE: { label: 'Chamber of Commerce', desc: 'Bahrain Chamber of Commerce & Industry (BCCI)' },
  WORK_PERMIT: { label: 'Expat Work Permit (LMRA)', desc: 'LMRA Work Permit, Visa & Expat Healthcare' },
  NHRA_PHARMACY: { label: 'NHRA Pharmacy Facility', desc: 'NHRA 3-Year Licensed Healthcare Facility' },
  NHRA_PHARMACIST: { label: 'NHRA Pharmacist License', desc: 'NHRA Professional Pharmacist Practice License' },
  NHRA: { label: 'NHRA Regulatory License', desc: 'NHRA Facility & Professional Licensing' },
  FLEET_VEHICLE: { label: 'Fleet Vehicle & Traffic', desc: 'General Directorate of Traffic, Compulsory Insurance & Inspection' },
  OTHER: { label: 'Other Operational Licenses', desc: 'Municipal, Civil Defense, Signboard & Advertising Permits' }
};

/**
 * Render Executive KPI Header Card in Excel sheet
 */
const renderKpiCard = (
  sheet: any,
  startCol: number,
  endCol: number,
  startRow: number,
  title: string,
  metric: string,
  sublabel: string,
  bgArgb: string,
  textArgb: string,
  borderArgb: string
) => {
  // Title Row
  sheet.mergeCells(startRow, startCol, startRow, endCol);
  const titleCell = sheet.getCell(startRow, startCol);
  titleCell.value = title.toUpperCase();
  titleCell.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: textArgb } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Metric Row (Large bold value)
  sheet.mergeCells(startRow + 1, startCol, startRow + 1, endCol);
  const metricCell = sheet.getCell(startRow + 1, startCol);
  metricCell.value = metric;
  metricCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: textArgb } };
  metricCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Subtitle Row
  sheet.mergeCells(startRow + 2, startCol, startRow + 2, endCol);
  const subCell = sheet.getCell(startRow + 2, startCol);
  subCell.value = sublabel;
  subCell.font = { name: 'Segoe UI', size: 7.5, italic: true, color: { argb: 'FF64748B' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Border & Background Fill
  for (let r = startRow; r <= startRow + 2; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = sheet.getCell(r, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      cell.border = {
        top: { style: r === startRow ? 'medium' : 'thin', color: { argb: borderArgb } },
        bottom: { style: r === startRow + 2 ? 'medium' : 'thin', color: { argb: borderArgb } },
        left: { style: c === startCol ? 'medium' : 'thin', color: { argb: borderArgb } },
        right: { style: c === endCol ? 'medium' : 'thin', color: { argb: borderArgb } }
      };
    }
  }
};

/**
 * Apply cell borders and alignment
 */
const styleDataCell = (
  cell: any,
  isEven: boolean,
  align: 'left' | 'center' | 'right' = 'left',
  numFmt?: string
) => {
  cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF0F172A' } };
  cell.alignment = { vertical: 'middle', horizontal: align };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' }
  };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };
  if (numFmt) cell.numFmt = numFmt;
};

/**
 * Auto-adjust column widths starting from a given table header row
 */
const autoFitColumns = (sheet: any, tableHeaderRow: number) => {
  sheet.columns.forEach((col: any) => {
    let maxLen = 12;
    col.eachCell({ includeEmpty: false }, (cell: any, rowNum: number) => {
      if (rowNum >= tableHeaderRow) {
        const val = cell.value !== undefined && cell.value !== null ? cell.value.toString() : '';
        if (val.length > maxLen) {
          maxLen = Math.min(val.length + 3, 45);
        }
      }
    });
    col.width = Math.max(col.width || 12, maxLen);
  });
};

/**
 * Export filtered renewals list to a fully structured, multi-tab Executive Excel Workbook
 */
export const exportRenewalsToExcel = async (
  records: OperationalRenewalRecord[],
  fileName = 'Operational_Renewals_Executive_Report'
) => {
  const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
    import('exceljs'),
    import('file-saver')
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tabarak Pharmacy Group — Operations & Compliance';
  workbook.lastModifiedBy = 'Tabarak Hub Automated System';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Aggregate Metrics
  const totalRecords = records.length;
  const expiredCount = records.filter(r => r.severity === 'EXPIRED').length;
  const criticalCount = records.filter(r => r.severity === 'CRITICAL').length;
  const urgentCount = records.filter(r => r.severity === 'URGENT').length;
  const warningCount = records.filter(r => r.severity === 'WARNING').length;
  const compliantCount = records.filter(r => r.severity === 'NORMAL' || r.severity === 'UPCOMING').length;

  const totalEstimated = records.reduce((sum, r) => sum + (Number(r.estimatedCost) || 0), 0);
  const totalPaid = records.reduce((sum, r) => {
    if (r.paymentStatus === 'PAID') {
      return sum + (r.actualCost !== undefined ? Number(r.actualCost) : Number(r.estimatedCost) || 0);
    }
    return sum;
  }, 0);
  const totalPending = Math.max(0, totalEstimated - totalPaid);
  const settlementRate = totalEstimated > 0 ? ((totalPaid / totalEstimated) * 100).toFixed(1) : '0.0';

  const generatedDateStr = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  // ============================================================================
  // TAB 1: RENEWALS MASTER LOG
  // ============================================================================
  const masterSheet = workbook.addWorksheet('Renewals Master Log', {
    properties: { tabColor: { argb: 'FF0F172A' } }
  });

  // Header Title Banner
  masterSheet.mergeCells('A1:O1');
  const mTitleCell = masterSheet.getCell('A1');
  mTitleCell.value = 'TABARAK PHARMACY GROUP — OPERATIONAL COMPLIANCE & RENEWALS MASTER LOG';
  mTitleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF0F172A' } };
  mTitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  masterSheet.getRow(1).height = 24;

  masterSheet.mergeCells('A2:O2');
  const mSubCell = masterSheet.getCell('A2');
  mSubCell.value = `Official regulatory compliance audit trail, license expiries, and cost center allocations · Generated on: ${generatedDateStr}`;
  mSubCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };
  mSubCell.alignment = { vertical: 'middle', horizontal: 'left' };
  masterSheet.getRow(2).height = 18;

  // Header KPI Cards (Row 4 to 6)
  renderKpiCard(
    masterSheet, 2, 4, 4,
    'Total Obligations',
    `${totalRecords} Records`,
    `Budget: ${totalEstimated.toLocaleString('en-US', { minimumFractionDigits: 3 })} BHD`,
    'FFF8FAFC', 'FF0F172A', 'FFCBD5E1'
  );

  renderKpiCard(
    masterSheet, 5, 7, 4,
    'Immediate Attention',
    `${expiredCount} Expired · ${criticalCount} Critical`,
    'High regulatory penalty exposure',
    'FFFFF1F2', 'FFE11D48', 'FFFECDD3'
  );

  renderKpiCard(
    masterSheet, 8, 10, 4,
    'Upcoming (30-60 Days)',
    `${urgentCount + warningCount} Documents`,
    `${urgentCount} Urgent (≤30d) · ${warningCount} Warning (≤60d)`,
    'FFFFFBEB', 'FFD97706', 'FFFDE68A'
  );

  renderKpiCard(
    masterSheet, 11, 14, 4,
    'Settlement Progress',
    `${settlementRate}% Settled`,
    `Paid: ${totalPaid.toFixed(3)} BHD · Due: ${totalPending.toFixed(3)} BHD`,
    'FFECFDF5', 'FF059669', 'FFA7F3D0'
  );

  masterSheet.getRow(4).height = 16;
  masterSheet.getRow(5).height = 22;
  masterSheet.getRow(6).height = 16;

  // Table Headers (Row 8)
  const masterHeaders = [
    'Priority',
    'Category',
    'Entity / Holder Name',
    'Document Type',
    'Document Number',
    'Cost Center Code',
    'Cost Center Name',
    'Expiry Date',
    'Days Left',
    'Target Payment Date',
    'Estimated Cost (BHD)',
    'Paid Amount (BHD)',
    'Payment Status',
    'Payment Method & Ref',
    'Audit & Notes'
  ];

  const headerRow = masterSheet.getRow(8);
  headerRow.values = masterHeaders;
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } }
    };
  });

  // Table Data Rows
  records.forEach((r, idx) => {
    const isEven = idx % 2 === 0;
    const rowNum = 9 + idx;
    const est = Number(r.estimatedCost) || 0;
    const act = r.actualCost !== undefined ? Number(r.actualCost) : (r.paymentStatus === 'PAID' ? est : 0);
    const costCenter = resolveSmartCostCenter(r.renewalType, r.branchName, r.branchId, r.entityName, r.metadata);

    const row = masterSheet.getRow(rowNum);
    row.height = 22;
    row.values = [
      r.severity,
      CATEGORY_META[r.renewalType]?.label || r.renewalType,
      getOperationalEntityDisplayName(r),
      r.documentType,
      r.documentNumber,
      r.costCenterCode || costCenter.code,
      r.costCenterName || costCenter.name,
      r.expiryDate,
      r.daysRemaining,
      r.plannedPaymentDate || '—',
      est,
      r.paymentStatus === 'PAID' ? act : 0,
      r.paymentStatus || 'UNPAID',
      r.paymentReference ? `${r.paymentMethod || 'OTHER'} (#${r.paymentReference})` : (r.paymentMethod || '—'),
      r.notes || ''
    ];

    // Format individual cells
    styleDataCell(row.getCell(1), isEven, 'center');
    styleDataCell(row.getCell(2), isEven, 'left');
    styleDataCell(row.getCell(3), isEven, 'left');
    styleDataCell(row.getCell(4), isEven, 'left');
    styleDataCell(row.getCell(5), isEven, 'center');
    styleDataCell(row.getCell(6), isEven, 'center');
    styleDataCell(row.getCell(7), isEven, 'left');
    styleDataCell(row.getCell(8), isEven, 'center');
    styleDataCell(row.getCell(9), isEven, 'center', '#,##0');
    styleDataCell(row.getCell(10), isEven, 'center');
    styleDataCell(row.getCell(11), isEven, 'right', '#,##0.000');
    styleDataCell(row.getCell(12), isEven, 'right', '#,##0.000');
    styleDataCell(row.getCell(13), isEven, 'center');
    styleDataCell(row.getCell(14), isEven, 'left');
    styleDataCell(row.getCell(15), isEven, 'left');

    // Colorize Priority cell
    const pCell = row.getCell(1);
    pCell.font = { name: 'Segoe UI', size: 9, bold: true };
    if (r.severity === 'EXPIRED') {
      pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
      pCell.font = { color: { argb: 'FFE11D48' }, bold: true };
    } else if (r.severity === 'CRITICAL') {
      pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEB' } };
      pCell.font = { color: { argb: 'FFDC2626' }, bold: true };
    } else if (r.severity === 'URGENT') {
      pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
      pCell.font = { color: { argb: 'FFD97706' }, bold: true };
    } else if (r.severity === 'WARNING') {
      pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEFCE8' } };
      pCell.font = { color: { argb: 'FFCA8A04' }, bold: true };
    } else {
      pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
      pCell.font = { color: { argb: 'FF059669' }, bold: true };
    }

    // Payment Status badge styling
    const payCell = row.getCell(13);
    if (r.paymentStatus === 'PAID') {
      payCell.font = { color: { argb: 'FF059669' }, bold: true };
    } else if (r.paymentStatus === 'SCHEDULED') {
      payCell.font = { color: { argb: 'FF2563EB' }, bold: true };
    } else {
      payCell.font = { color: { argb: 'FFE11D48' }, bold: true };
    }
  });

  // Summary Row at bottom
  const mSummaryRowNum = 9 + records.length;
  const mSummaryRow = masterSheet.getRow(mSummaryRowNum);
  mSummaryRow.height = 24;
  mSummaryRow.values = [
    '', '', 'TOTAL ALLOCATIONS', '', '', '', '', '', '', '',
    totalEstimated,
    totalPaid,
    `${settlementRate}% Settled`,
    '', ''
  ];
  for (let c = 1; c <= 15; c++) {
    const cell = mSummaryRow.getCell(c);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } }
    };
    if (c === 11 || c === 12) {
      cell.numFmt = '#,##0.000';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (c === 13) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  }

  autoFitColumns(masterSheet, 8);
  masterSheet.views = [{ showGridLines: true, state: 'frozen', ySplit: 8, xSplit: 0 }];

  // ============================================================================
  // TAB 2: PIVOT — BY COST CENTER
  // ============================================================================
  const ccSheet = workbook.addWorksheet('Pivot - By Cost Center', {
    properties: { tabColor: { argb: 'FF4338CA' } }
  });

  // Title Banner
  ccSheet.mergeCells('A1:I1');
  const ccTitle = ccSheet.getCell('A1');
  ccTitle.value = 'BUDGET ALLOCATION & CASH OUTFLOW BY COST CENTER';
  ccTitle.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF1E1B4B' } };
  ccTitle.alignment = { vertical: 'middle', horizontal: 'left' };
  ccSheet.getRow(1).height = 24;

  ccSheet.mergeCells('A2:I2');
  const ccSub = ccSheet.getCell('A2');
  ccSub.value = 'Consolidated operational renewal commitments categorized by branch, pharmacy facility, headquarters and fleet cost centers';
  ccSub.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };
  ccSheet.getRow(2).height = 18;

  // Group by Cost Center
  const costCenterMap = new Map<string, {
    code: string;
    name: string;
    type: string;
    totalCount: number;
    atRiskCount: number;
    estimatedCost: number;
    paidCost: number;
  }>();

  records.forEach(r => {
    const cc = resolveSmartCostCenter(r.renewalType, r.branchName, r.branchId, r.entityName, r.metadata);
    const code = r.costCenterCode || cc.code;
    const name = r.costCenterName || cc.name;
    const est = Number(r.estimatedCost) || 0;
    const paid = r.paymentStatus === 'PAID' ? (r.actualCost !== undefined ? Number(r.actualCost) : est) : 0;
    const isAtRisk = r.severity === 'EXPIRED' || r.severity === 'CRITICAL' || r.severity === 'URGENT';

    const existing = costCenterMap.get(code) || {
      code,
      name,
      type: cc.type,
      totalCount: 0,
      atRiskCount: 0,
      estimatedCost: 0,
      paidCost: 0
    };

    existing.totalCount += 1;
    if (isAtRisk) existing.atRiskCount += 1;
    existing.estimatedCost += est;
    existing.paidCost += paid;

    costCenterMap.set(code, existing);
  });

  const costCenterList = Array.from(costCenterMap.values()).sort((a, b) => b.estimatedCost - a.estimatedCost);

  // KPI Header Cards on Cost Center Tab
  renderKpiCard(
    ccSheet, 1, 3, 4,
    'Cost Centers Count',
    `${costCenterList.length} Active Centers`,
    'Holding, Branch, and Regulatory',
    'FFF5F3FF', 'FF4338CA', 'FFDDD6FE'
  );

  renderKpiCard(
    ccSheet, 4, 6, 4,
    'Total Budget Allocation',
    `${totalEstimated.toLocaleString('en-US', { minimumFractionDigits: 3 })} BHD`,
    `Paid: ${totalPaid.toFixed(3)} BHD (${settlementRate}%)`,
    'FFF8FAFC', 'FF0F172A', 'FFCBD5E1'
  );

  renderKpiCard(
    ccSheet, 7, 9, 4,
    'Pending Settlement',
    `${totalPending.toLocaleString('en-US', { minimumFractionDigits: 3 })} BHD`,
    `${records.filter(r => r.paymentStatus !== 'PAID').length} Outstanding Payments`,
    'FFFFFBEB', 'FFD97706', 'FFFDE68A'
  );

  ccSheet.getRow(4).height = 16;
  ccSheet.getRow(5).height = 22;
  ccSheet.getRow(6).height = 16;

  // Cost Center Table Headers (Row 8)
  const ccHeaders = [
    'Cost Center Code',
    'Cost Center Description',
    'Entity Type',
    'Total Items',
    'At Risk (≤30d)',
    'Total Budget (BHD)',
    'Settled Paid (BHD)',
    'Outstanding Due (BHD)',
    'Settlement %'
  ];

  const ccHeaderRow = ccSheet.getRow(8);
  ccHeaderRow.values = ccHeaders;
  ccHeaderRow.height = 28;
  ccHeaderRow.eachCell(cell => {
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF312E81' } },
      bottom: { style: 'medium', color: { argb: 'FF312E81' } }
    };
  });

  costCenterList.forEach((cc, idx) => {
    const isEven = idx % 2 === 0;
    const rowNum = 9 + idx;
    const remaining = Math.max(0, cc.estimatedCost - cc.paidCost);
    const rate = cc.estimatedCost > 0 ? (cc.paidCost / cc.estimatedCost) : 0;

    const row = ccSheet.getRow(rowNum);
    row.height = 22;
    row.values = [
      cc.code,
      cc.name,
      cc.type,
      cc.totalCount,
      cc.atRiskCount,
      cc.estimatedCost,
      cc.paidCost,
      remaining,
      rate
    ];

    styleDataCell(row.getCell(1), isEven, 'center');
    styleDataCell(row.getCell(2), isEven, 'left');
    styleDataCell(row.getCell(3), isEven, 'center');
    styleDataCell(row.getCell(4), isEven, 'center', '#,##0');
    styleDataCell(row.getCell(5), isEven, 'center', '#,##0');
    styleDataCell(row.getCell(6), isEven, 'right', '#,##0.000');
    styleDataCell(row.getCell(7), isEven, 'right', '#,##0.000');
    styleDataCell(row.getCell(8), isEven, 'right', '#,##0.000');
    styleDataCell(row.getCell(9), isEven, 'center', '0.0%');

    if (cc.atRiskCount > 0) {
      row.getCell(5).font = { color: { argb: 'FFE11D48' }, bold: true };
    }
  });

  // Summary Row
  const ccSummaryRowNum = 9 + costCenterList.length;
  const ccSummaryRow = ccSheet.getRow(ccSummaryRowNum);
  ccSummaryRow.height = 24;
  ccSummaryRow.values = [
    '', 'TOTAL SUMMARY', '', totalRecords,
    expiredCount + criticalCount + urgentCount,
    totalEstimated,
    totalPaid,
    totalPending,
    totalEstimated > 0 ? (totalPaid / totalEstimated) : 0
  ];
  for (let c = 1; c <= 9; c++) {
    const cell = ccSummaryRow.getCell(c);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E1B4B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF312E81' } },
      bottom: { style: 'double', color: { argb: 'FF312E81' } }
    };
    if (c === 6 || c === 7 || c === 8) {
      cell.numFmt = '#,##0.000';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (c === 9) {
      cell.numFmt = '0.0%';
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else if (c === 4 || c === 5) {
      cell.numFmt = '#,##0';
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  }

  autoFitColumns(ccSheet, 8);
  ccSheet.views = [{ showGridLines: true, state: 'frozen', ySplit: 8, xSplit: 0 }];

  // ============================================================================
  // TAB 3: PIVOT — BY REGULATORY CATEGORY
  // ============================================================================
  const catSheet = workbook.addWorksheet('Pivot - By Category', {
    properties: { tabColor: { argb: 'FF0284C7' } }
  });

  // Title Banner
  catSheet.mergeCells('A1:J1');
  const catTitle = catSheet.getCell('A1');
  catTitle.value = 'REGULATORY RENEWALS ANALYSIS BY CATEGORY';
  catTitle.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF0C4A6E' } };
  catTitle.alignment = { vertical: 'middle', horizontal: 'left' };
  catSheet.getRow(1).height = 24;

  catSheet.mergeCells('A2:J2');
  const catSub = catSheet.getCell('A2');
  catSub.value = 'Breakdown across CRs, BCCI, Work Permits (LMRA), NHRA Facility & Pharmacist Licenses, and Fleet Vehicles';
  catSub.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };
  catSheet.getRow(2).height = 18;

  // Group by Category
  const catMap = new Map<OperationalRenewalType, {
    type: OperationalRenewalType;
    total: number;
    expired: number;
    critical: number;
    urgent: number;
    warning: number;
    normal: number;
    estimated: number;
    paid: number;
  }>();

  records.forEach(r => {
    const existing = catMap.get(r.renewalType) || {
      type: r.renewalType,
      total: 0,
      expired: 0,
      critical: 0,
      urgent: 0,
      warning: 0,
      normal: 0,
      estimated: 0,
      paid: 0
    };

    existing.total += 1;
    if (r.severity === 'EXPIRED') existing.expired += 1;
    else if (r.severity === 'CRITICAL') existing.critical += 1;
    else if (r.severity === 'URGENT') existing.urgent += 1;
    else if (r.severity === 'WARNING') existing.warning += 1;
    else existing.normal += 1;

    const est = Number(r.estimatedCost) || 0;
    const paid = r.paymentStatus === 'PAID' ? (r.actualCost !== undefined ? Number(r.actualCost) : est) : 0;
    existing.estimated += est;
    existing.paid += paid;

    catMap.set(r.renewalType, existing);
  });

  const catList = Array.from(catMap.values()).sort((a, b) => b.estimated - a.estimated);

  // Category KPI Cards
  renderKpiCard(
    catSheet, 1, 3, 4,
    'Regulated Categories',
    `${catList.length} Categories`,
    'All statutory renewal disciplines',
    'FFF0F9FF', 'FF0284C7', 'FFBAE6FD'
  );

  renderKpiCard(
    catSheet, 4, 6, 4,
    'Compliance Health',
    `${compliantCount} of ${totalRecords} Compliant`,
    `${totalRecords > 0 ? ((compliantCount / totalRecords) * 100).toFixed(0) : 0}% licenses in good standing (>60d)`,
    'FFECFDF5', 'FF059669', 'FFA7F3D0'
  );

  renderKpiCard(
    catSheet, 7, 10, 4,
    'Category Budget',
    `${totalEstimated.toLocaleString('en-US', { minimumFractionDigits: 3 })} BHD`,
    `Settled: ${totalPaid.toFixed(3)} BHD · Remaining: ${totalPending.toFixed(3)} BHD`,
    'FFF8FAFC', 'FF0F172A', 'FFCBD5E1'
  );

  catSheet.getRow(4).height = 16;
  catSheet.getRow(5).height = 22;
  catSheet.getRow(6).height = 16;

  // Category Table Headers (Row 8)
  const catHeaders = [
    'Category',
    'Description / Authority',
    'Total Items',
    'Expired (<0d)',
    'Critical (≤7d)',
    'Urgent (≤30d)',
    'Normal (>30d)',
    'Total Cost (BHD)',
    'Paid (BHD)',
    'Pending (BHD)'
  ];

  const catHeaderRow = catSheet.getRow(8);
  catHeaderRow.values = catHeaders;
  catHeaderRow.height = 28;
  catHeaderRow.eachCell(cell => {
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF075985' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF075985' } },
      bottom: { style: 'medium', color: { argb: 'FF075985' } }
    };
  });

  catList.forEach((c, idx) => {
    const isEven = idx % 2 === 0;
    const rowNum = 9 + idx;
    const meta = CATEGORY_META[c.type];
    const pending = Math.max(0, c.estimated - c.paid);

    const row = catSheet.getRow(rowNum);
    row.height = 22;
    row.values = [
      meta?.label || c.type,
      meta?.desc || '',
      c.total,
      c.expired,
      c.critical,
      c.urgent,
      c.warning + c.normal,
      c.estimated,
      c.paid,
      pending
    ];

    styleDataCell(row.getCell(1), isEven, 'left');
    styleDataCell(row.getCell(2), isEven, 'left');
    styleDataCell(row.getCell(3), isEven, 'center', '#,##0');
    styleDataCell(row.getCell(4), isEven, 'center', '#,##0');
    styleDataCell(row.getCell(5), isEven, 'center', '#,##0');
    styleDataCell(row.getCell(6), isEven, 'center', '#,##0');
    styleDataCell(row.getCell(7), isEven, 'center', '#,##0');
    styleDataCell(row.getCell(8), isEven, 'right', '#,##0.000');
    styleDataCell(row.getCell(9), isEven, 'right', '#,##0.000');
    styleDataCell(row.getCell(10), isEven, 'right', '#,##0.000');

    if (c.expired > 0) row.getCell(4).font = { color: { argb: 'FFE11D48' }, bold: true };
    if (c.critical > 0) row.getCell(5).font = { color: { argb: 'FFDC2626' }, bold: true };
    if (c.urgent > 0) row.getCell(6).font = { color: { argb: 'FFD97706' }, bold: true };
  });

  // Summary Row
  const catSummaryRowNum = 9 + catList.length;
  const catSummaryRow = catSheet.getRow(catSummaryRowNum);
  catSummaryRow.height = 24;
  catSummaryRow.values = [
    'TOTAL SUMMARY', '', totalRecords,
    expiredCount, criticalCount, urgentCount, warningCount + compliantCount,
    totalEstimated, totalPaid, totalPending
  ];
  for (let c = 1; c <= 10; c++) {
    const cell = catSummaryRow.getCell(c);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0C4A6E' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF075985' } },
      bottom: { style: 'double', color: { argb: 'FF075985' } }
    };
    if (c >= 8) {
      cell.numFmt = '#,##0.000';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (c >= 3 && c <= 7) {
      cell.numFmt = '#,##0';
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  }

  autoFitColumns(catSheet, 8);
  catSheet.views = [{ showGridLines: true, state: 'frozen', ySplit: 8, xSplit: 0 }];

  // ============================================================================
  // TAB 4: PIVOT — MONTHLY CASH OUTFLOW
  // ============================================================================
  const flowSheet = workbook.addWorksheet('Pivot - Cash Flow Schedule', {
    properties: { tabColor: { argb: 'FF059669' } }
  });

  // Title Banner
  flowSheet.mergeCells('A1:G1');
  const flowTitle = flowSheet.getCell('A1');
  flowTitle.value = 'PROJECTED MONTHLY CASH OUTFLOW & PAYMENT SCHEDULE';
  flowTitle.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF064E3B' } };
  flowTitle.alignment = { vertical: 'middle', horizontal: 'left' };
  flowSheet.getRow(1).height = 24;

  flowSheet.mergeCells('A2:G2');
  const flowSub = flowSheet.getCell('A2');
  flowSub.value = 'Scheduled renewal liquidity disbursements based on target payment dates and expiration commitments';
  flowSub.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };
  flowSheet.getRow(2).height = 18;

  // Group by Month (YYYY-MM)
  const monthMap = new Map<string, {
    month: string;
    count: number;
    estimated: number;
    paid: number;
  }>();

  records.forEach(r => {
    const rawDate = r.plannedPaymentDate || r.expiryDate;
    const month = rawDate && rawDate.length >= 7 ? rawDate.slice(0, 7) : 'Unscheduled';
    const est = Number(r.estimatedCost) || 0;
    const paid = r.paymentStatus === 'PAID' ? (r.actualCost !== undefined ? Number(r.actualCost) : est) : 0;

    const existing = monthMap.get(month) || {
      month,
      count: 0,
      estimated: 0,
      paid: 0
    };

    existing.count += 1;
    existing.estimated += est;
    existing.paid += paid;

    monthMap.set(month, existing);
  });

  const monthList = Array.from(monthMap.values()).sort((a, b) => {
    if (a.month === 'Unscheduled') return 1;
    if (b.month === 'Unscheduled') return -1;
    return a.month.localeCompare(b.month);
  });

  // Peak Month calculation
  const peakMonthObj = [...monthList].sort((a, b) => b.estimated - a.estimated)[0];
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const currentMonthObj = monthMap.get(currentMonthStr);

  // Cash Flow KPI Cards
  renderKpiCard(
    flowSheet, 1, 2, 4,
    'Scheduled Months',
    `${monthList.length} Timeline Windows`,
    'Monthly outflow horizon',
    'FFF8FAFC', 'FF0F172A', 'FFCBD5E1'
  );

  renderKpiCard(
    flowSheet, 3, 4, 4,
    'Peak Outflow Month',
    peakMonthObj ? `${peakMonthObj.month}` : '—',
    peakMonthObj ? `Peak Demand: ${peakMonthObj.estimated.toFixed(3)} BHD` : 'No commitments',
    'FFFFFBEB', 'FFD97706', 'FFFDE68A'
  );

  renderKpiCard(
    flowSheet, 5, 7, 4,
    'Current Month Outflow',
    currentMonthObj ? `${currentMonthObj.estimated.toFixed(3)} BHD` : '0.000 BHD',
    currentMonthObj ? `${currentMonthObj.count} obligations in ${currentMonthStr}` : 'No current month commitments',
    'FFECFDF5', 'FF059669', 'FFA7F3D0'
  );

  flowSheet.getRow(4).height = 16;
  flowSheet.getRow(5).height = 22;
  flowSheet.getRow(6).height = 16;

  // Monthly Outflow Table Headers (Row 8)
  const flowHeaders = [
    'Target Month',
    'Number of Renewals',
    'Total Scheduled Outflow (BHD)',
    'Settled Paid (BHD)',
    'Pending Outflow (BHD)',
    'Settlement %',
    'Cash Status'
  ];

  const flowHeaderRow = flowSheet.getRow(8);
  flowHeaderRow.values = flowHeaders;
  flowHeaderRow.height = 28;
  flowHeaderRow.eachCell(cell => {
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF064E3B' } },
      bottom: { style: 'medium', color: { argb: 'FF064E3B' } }
    };
  });

  monthList.forEach((m, idx) => {
    const isEven = idx % 2 === 0;
    const rowNum = 9 + idx;
    const pending = Math.max(0, m.estimated - m.paid);
    const rate = m.estimated > 0 ? (m.paid / m.estimated) : 0;
    const status = rate >= 0.999 ? 'Fully Settled' : (rate > 0 ? 'Partially Paid' : 'Pending Payment');

    const row = flowSheet.getRow(rowNum);
    row.height = 22;
    row.values = [
      m.month,
      m.count,
      m.estimated,
      m.paid,
      pending,
      rate,
      status
    ];

    styleDataCell(row.getCell(1), isEven, 'center');
    styleDataCell(row.getCell(2), isEven, 'center', '#,##0');
    styleDataCell(row.getCell(3), isEven, 'right', '#,##0.000');
    styleDataCell(row.getCell(4), isEven, 'right', '#,##0.000');
    styleDataCell(row.getCell(5), isEven, 'right', '#,##0.000');
    styleDataCell(row.getCell(6), isEven, 'center', '0.0%');
    styleDataCell(row.getCell(7), isEven, 'center');

    const stCell = row.getCell(7);
    if (status === 'Fully Settled') {
      stCell.font = { color: { argb: 'FF059669' }, bold: true };
    } else if (status === 'Partially Paid') {
      stCell.font = { color: { argb: 'FF2563EB' }, bold: true };
    } else {
      stCell.font = { color: { argb: 'FFD97706' }, bold: true };
    }
  });

  // Summary Row
  const flowSummaryRowNum = 9 + monthList.length;
  const flowSummaryRow = flowSheet.getRow(flowSummaryRowNum);
  flowSummaryRow.height = 24;
  flowSummaryRow.values = [
    'TOTAL SCHEDULED', totalRecords,
    totalEstimated, totalPaid, totalPending,
    totalEstimated > 0 ? (totalPaid / totalEstimated) : 0,
    `${settlementRate}% Realized`
  ];
  for (let c = 1; c <= 7; c++) {
    const cell = flowSummaryRow.getCell(c);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF064E3B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF064E3B' } },
      bottom: { style: 'double', color: { argb: 'FF064E3B' } }
    };
    if (c >= 3 && c <= 5) {
      cell.numFmt = '#,##0.000';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (c === 2) {
      cell.numFmt = '#,##0';
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else if (c === 6) {
      cell.numFmt = '0.0%';
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  }

  autoFitColumns(flowSheet, 8);
  flowSheet.views = [{ showGridLines: true, state: 'frozen', ySplit: 8, xSplit: 0 }];

  // Write and Save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  saveAs(blob, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * Export filtered renewals list to CSV (Clean English)
 */
export const exportRenewalsToCsv = (
  records: OperationalRenewalRecord[],
  fileName = 'Operational_Renewals'
) => {
  const headers = [
    'Priority',
    'Category',
    'Entity Name',
    'Document Type',
    'Document Number',
    'Cost Center Code',
    'Cost Center Name',
    'Estimated Fee BHD',
    'Actual Paid BHD',
    'Payment Status',
    'Expiry Date',
    'Target Payment Date',
    'Days Remaining',
    'Notes'
  ];

  const rows = records.map(r => {
    const costCenter = resolveSmartCostCenter(r.renewalType, r.branchName, r.branchId, r.entityName, r.metadata);
    return [
      r.severity,
      CATEGORY_META[r.renewalType]?.label || r.renewalType,
      `"${(getOperationalEntityDisplayName(r) || '').replace(/"/g, '""')}"`,
      `"${(r.documentType || '').replace(/"/g, '""')}"`,
      `"${(r.documentNumber || '').replace(/"/g, '""')}"`,
      `"${(r.costCenterCode || costCenter.code || '').replace(/"/g, '""')}"`,
      `"${(r.costCenterName || costCenter.name || '').replace(/"/g, '""')}"`,
      r.estimatedCost !== undefined ? Number(r.estimatedCost).toFixed(3) : '0.000',
      r.actualCost !== undefined ? Number(r.actualCost).toFixed(3) : (r.paymentStatus === 'PAID' ? Number(r.estimatedCost).toFixed(3) : ''),
      r.paymentStatus || 'UNPAID',
      r.expiryDate,
      r.plannedPaymentDate || '',
      r.daysRemaining,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ];
  });

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

/**
 * Print-Friendly Operational Report view (100% English)
 */
export const printOperationalRenewalsReport = (
  records: OperationalRenewalRecord[],
  activeFilterLabel = 'All Records'
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const expiredCount = records.filter(r => r.severity === 'EXPIRED').length;
  const criticalCount = records.filter(r => r.severity === 'CRITICAL').length;
  const urgentCount = records.filter(r => r.severity === 'URGENT').length;
  const warningCount = records.filter(r => r.severity === 'WARNING').length;

  const totalEstimated = records.reduce((sum, r) => sum + (Number(r.estimatedCost) || 0), 0);
  const totalPaid = records.reduce((sum, r) => {
    if (r.paymentStatus === 'PAID') {
      return sum + (r.actualCost !== undefined ? Number(r.actualCost) : Number(r.estimatedCost) || 0);
    }
    return sum;
  }, 0);

  const tableRows = records
    .map(
      r => `
      <tr>
        <td style="text-align: center; font-weight: bold; color: ${
          r.severity === 'EXPIRED'
            ? '#e11d48'
            : r.severity === 'CRITICAL'
            ? '#dc2626'
            : r.severity === 'URGENT'
            ? '#d97706'
            : '#475569'
        };">
          ${r.severity}
        </td>
        <td><strong>${getOperationalEntityDisplayName(r)}</strong></td>
        <td>${r.documentType}</td>
        <td><code>${r.documentNumber}</code></td>
        <td style="font-weight: 600;">${r.expiryDate}</td>
        <td style="text-align: center; font-weight: bold;">
          ${r.daysRemaining < 0 ? `-${Math.abs(r.daysRemaining)}d` : `${r.daysRemaining}d`}
        </td>
        <td style="text-align: right; font-family: monospace; font-weight: bold;">
          ${(Number(r.estimatedCost) || 0).toFixed(3)} BHD
        </td>
        <td style="text-align: center; font-weight: bold; color: ${r.paymentStatus === 'PAID' ? '#059669' : '#e11d48'};">
          ${r.paymentStatus || 'UNPAID'}
        </td>
      </tr>
    `
    )
    .join('');

  printWindow.document.write(`<!DOCTYPE html>
    <html dir="ltr">
      <head>
        <title>Operational Renewals & Compliance Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #0f172a; font-size: 11px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 18px; font-weight: 900; margin: 0; color: #0f172a; letter-spacing: -0.02em; }
          .subtitle { color: #64748b; margin-top: 4px; font-size: 11px; }
          .meta { text-align: right; font-size: 10px; color: #475569; }
          .kpis { display: flex; gap: 12px; margin-bottom: 20px; }
          .kpi-box { border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 8px; flex: 1; text-align: center; }
          .kpi-num { font-size: 18px; font-weight: 900; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
          th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
          th { background-color: #f8fafc; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #334155; }
          tr:nth-child(even) { background-color: #fcfdfe; }
          @media print {
            body { padding: 0; }
            @page { size: landscape; margin: 12mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">TABARAK PHARMACY GROUP — OPERATIONAL COMPLIANCE & RENEWALS</h1>
            <div class="subtitle">Official Statutory Expiry Tracking & Financial Allocation Audit Report · Filter: ${activeFilterLabel}</div>
          </div>
          <div class="meta">
            <div><strong>Generated:</strong> ${new Date().toLocaleString('en-GB')}</div>
            <div><strong>Total Licenses:</strong> ${records.length} | <strong>Budget:</strong> ${totalEstimated.toFixed(3)} BHD</div>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi-box" style="border-left: 4px solid #e11d48;">
            <div>Expired</div>
            <div class="kpi-num" style="color: #e11d48;">${expiredCount}</div>
          </div>
          <div class="kpi-box" style="border-left: 4px solid #dc2626;">
            <div>Critical (&le; 7 Days)</div>
            <div class="kpi-num" style="color: #dc2626;">${criticalCount}</div>
          </div>
          <div class="kpi-box" style="border-left: 4px solid #d97706;">
            <div>Urgent (&le; 30 Days)</div>
            <div class="kpi-num" style="color: #d97706;">${urgentCount}</div>
          </div>
          <div class="kpi-box" style="border-left: 4px solid #ca8a04;">
            <div>Warning (&le; 60 Days)</div>
            <div class="kpi-num" style="color: #ca8a04;">${warningCount}</div>
          </div>
          <div class="kpi-box" style="border-left: 4px solid #059669;">
            <div>Paid Budget</div>
            <div class="kpi-num" style="color: #059669;">${totalPaid.toFixed(1)} BHD</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 70px; text-align: center;">Priority</th>
              <th>Entity / License Holder</th>
              <th>Document Type</th>
              <th>Document No</th>
              <th>Expiry Date</th>
              <th style="text-align: center; width: 65px;">Days Left</th>
              <th style="text-align: right; width: 90px;">Estimated Fee</th>
              <th style="text-align: center; width: 80px;">Payment Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
    </html>`);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 350);
};
