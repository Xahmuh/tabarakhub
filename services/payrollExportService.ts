import ExcelJS from 'exceljs';
import { getPayrollMonthBounds, isValidBahrainIban } from '../lib/payrollSafety';

/** A frozen, published run supplied by a trusted payroll API, never a browser estimate. */
export interface PublishedPayrollExportRun {
  id: string;
  payMonth: string;
  status: 'published';
  publishedAt: string;
  ownerApprovedBy: string;
  accountsApprovedBy: string;
  employees: PublishedPayrollExportEmployee[];
}

export interface PublishedPayrollExportEmployee {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  cprOrGccId: string;
  iban: string;
  branchName: string;
  /** Fixed amount registered with LMRA and payable through WPS. */
  fixedSalaryBhd: number;
  approvedEarningsBhd: number;
  approvedDeductionsBhd: number;
  /** Explicit portion of deductions allocated to fixed pay, after bonus/commission. */
  fixedSalaryDeductionBhd: number;
  netPayableBhd: number;
}

export const LMRA_WPS_HEADERS = [
  'CPR/GCC ID', 'Worker Name', 'IBAN/Wallet Number', 'Currency',
  'Fixed Salary', 'Social Allowance', 'Variable Salary BHD',
  'Total Amount BHD', 'Salary Month', 'Salary Year'
] as const;

export const COMPANY_PAYROLL_HEADERS = [
  'Employee Code', 'CPR/GCC ID', 'Worker Name', 'Branch', 'IBAN/Wallet Number',
  'LMRA Fixed Salary BHD', 'Approved Earnings BHD', 'Approved Deductions BHD',
  'Fixed Salary Deductions BHD', 'Net Payable BHD', 'Salary Month', 'Salary Year', 'Payroll Run ID',
  'Published At', 'Owner Approved By', 'Accounts Approved By'
] as const;

const requireText = (value: string, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
};

const moneyInFils = (value: number, field: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
      !Number.isSafeInteger(Math.round(value * 1000)) ||
      Math.abs(value * 1000 - Math.round(value * 1000)) > 0.000001) {
    throw new Error(`${field} must be a nonnegative BHD amount with at most 3 decimals`);
  }
  return Math.round(value * 1000);
};

const validatedRun = (run: PublishedPayrollExportRun): { month: number; year: number } => {
  if (!run || run.status !== 'published') throw new Error('A published payroll run is required');
  requireText(run.id, 'Payroll run ID');
  requireText(run.publishedAt, 'Published timestamp');
  if (!Number.isFinite(Date.parse(run.publishedAt))) throw new Error('Published timestamp is invalid');
  const owner = requireText(run.ownerApprovedBy, 'Owner approval');
  const accounts = requireText(run.accountsApprovedBy, 'Accounts approval');
  if (owner === accounts) throw new Error('Owner and Accounts approvals must be by different users');
  getPayrollMonthBounds(run.payMonth);
  if (!Array.isArray(run.employees) || run.employees.length === 0) {
    throw new Error('A published payroll run must contain employees');
  }
  const seenIds = new Set<string>();
  const seenCprs = new Set<string>();
  for (const employee of run.employees) {
    const id = requireText(employee.employeeId, 'Employee ID');
    requireText(employee.employeeCode, 'Employee code');
    requireText(employee.fullName, 'Worker name');
    requireText(employee.branchName, 'Branch');
    const cpr = requireText(employee.cprOrGccId, 'CPR/GCC ID');
    if (!/^\d{9,15}$/.test(cpr)) throw new Error(`Invalid CPR/GCC ID for ${id}`);
    const iban = requireText(employee.iban, 'IBAN').replace(/\s+/g, '').toUpperCase();
    if (!isValidBahrainIban(iban)) throw new Error(`Invalid Bahrain IBAN for ${id}`);
    if (seenIds.has(id) || seenCprs.has(cpr)) throw new Error('Duplicate employee or CPR/GCC ID in payroll run');
    seenIds.add(id);
    seenCprs.add(cpr);
    const fixed = moneyInFils(employee.fixedSalaryBhd, 'Fixed salary');
    if (fixed === 0) throw new Error(`Fixed salary is missing for ${id}`);
    const earnings = moneyInFils(employee.approvedEarningsBhd, 'Approved earnings');
    const deductions = moneyInFils(employee.approvedDeductionsBhd, 'Approved deductions');
    const fixedDeductions = moneyInFils(employee.fixedSalaryDeductionBhd, 'Fixed salary deductions');
    const net = moneyInFils(employee.netPayableBhd, 'Net payable');
    if (fixedDeductions > fixed || fixedDeductions > deductions || deductions - fixedDeductions > earnings) {
      throw new Error(`Deductions must use approved commission/bonus before fixed salary for ${id}`);
    }
    if (fixed + earnings - deductions !== net) throw new Error(`Unreconciled payroll amount for ${id}`);
  }
  return { year: Number(run.payMonth.slice(0, 4)), month: Number(run.payMonth.slice(5, 7)) };
};

const setHeader = (sheet: ExcelJS.Worksheet, headers: readonly string[], widths: readonly number[]) => {
  sheet.columns = headers.map((header, index) => ({ header, key: String(index), width: widths[index] }));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.getRow(1).height = 23;
  sheet.getRow(1).eachCell(cell => {
    cell.font = { name: 'Trebuchet MS', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } } };
  });
};

const addRow = (sheet: ExcelJS.Worksheet, values: ReadonlyArray<string | number>, monetaryColumns: number[]) => {
  const row = sheet.addRow([...values]);
  row.eachCell(cell => {
    cell.font = { name: 'Trebuchet MS', size: 11 };
    cell.alignment = { vertical: 'middle' };
    cell.border = { bottom: { style: 'hair', color: { argb: 'FFE0E0E0' } } };
  });
  monetaryColumns.forEach(index => { row.getCell(index).numFmt = '#,##0.000'; });
};

export function createCompanyPayrollTemplateWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Company Payroll');
  setHeader(sheet, COMPANY_PAYROLL_HEADERS, [18, 17, 35, 24, 26, 23, 23, 25, 29, 20, 15, 14, 38, 25, 38, 38]);
  return workbook;
}

export function buildCompanyPayrollWorkbook(run: PublishedPayrollExportRun): ExcelJS.Workbook {
  const { month, year } = validatedRun(run);
  const workbook = createCompanyPayrollTemplateWorkbook();
  const sheet = workbook.getWorksheet('Company Payroll')!;
  for (const employee of run.employees) {
    addRow(sheet, [employee.employeeCode.trim(), employee.cprOrGccId.trim(), employee.fullName.trim(),
      employee.branchName.trim(), employee.iban.replace(/\s+/g, '').toUpperCase(),
      employee.fixedSalaryBhd, employee.approvedEarningsBhd, employee.approvedDeductionsBhd,
      employee.fixedSalaryDeductionBhd, employee.netPayableBhd, month, year, run.id, run.publishedAt,
      run.ownerApprovedBy, run.accountsApprovedBy], [6, 7, 8, 9, 10]);
  }
  return workbook;
}

/**
 * LMRA WPS file follows the supplied 10-column template. It transfers only the
 * LMRA-registered fixed salary. Commission and bonus stay on the company sheet.
 * Fixed-pay deductions require a confirmed WPS column-mapping decision.
 */
export function createLmraWpsTemplateWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('WPS - Salary File');
  setHeader(sheet, LMRA_WPS_HEADERS, [14, 33, 24, 10, 14, 18, 21, 18, 14, 13]);
  return workbook;
}

export function buildLmraWpsWorkbook(run: PublishedPayrollExportRun): ExcelJS.Workbook {
  const { month, year } = validatedRun(run);
  for (const employee of run.employees) {
    if (moneyInFils(employee.fixedSalaryDeductionBhd, 'Fixed salary deductions') > 0) {
      throw new Error(`LMRA fixed-salary deduction needs WPS mapping review for ${employee.employeeCode}`);
    }
  }
  const workbook = createLmraWpsTemplateWorkbook();
  const sheet = workbook.getWorksheet('WPS - Salary File')!;
  for (const employee of run.employees) {
    addRow(sheet, [employee.cprOrGccId.trim(), employee.fullName.trim(),
      employee.iban.replace(/\s+/g, '').toUpperCase(), 'BHD', employee.fixedSalaryBhd,
      0, 0, employee.fixedSalaryBhd, month, year], [5, 6, 7, 8]);
  }
  return workbook;
}
