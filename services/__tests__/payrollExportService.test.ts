import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  buildCompanyPayrollWorkbook,
  buildLmraWpsWorkbook,
  COMPANY_PAYROLL_HEADERS,
  LMRA_WPS_HEADERS,
  createCompanyPayrollTemplateWorkbook,
  createLmraWpsTemplateWorkbook,
  type PublishedPayrollExportRun
} from '../payrollExportService';

// Synthetic identifiers only: never copy the user-supplied template's sample rows.
const ibanBody = 'TEST00000000000000';
const rearranged = `${ibanBody}BH00`;
let remainder = 0;
for (const char of rearranged) {
  const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
}
const iban = `BH${String(98 - remainder).padStart(2, '0')}${ibanBody}`;

const run: PublishedPayrollExportRun = {
  id: 'synthetic-run', payMonth: '2026-10', status: 'published',
  publishedAt: '2026-10-31T12:00:00Z', ownerApprovedBy: 'owner-user',
  accountsApprovedBy: 'accounts-user',
  employees: [{ employeeId: 'synthetic-employee', employeeCode: 'E-001',
    fullName: 'Synthetic Employee', cprOrGccId: '012345678', iban,
    branchName: 'Test Branch', fixedSalaryBhd: 300.125,
    approvedEarningsBhd: 0, approvedDeductionsBhd: 0, fixedSalaryDeductionBhd: 0,
    netPayableBhd: 300.125 }]
};

const roundTrip = async (workbook: ExcelJS.Workbook): Promise<ExcelJS.Workbook> => {
  const buffer = await workbook.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer as any);
  return loaded;
};
const rowValues = (row: ExcelJS.Row): ExcelJS.CellValue[] =>
  (row.values as ExcelJS.CellValue[]).slice(1);
assert.equal(createCompanyPayrollTemplateWorkbook().getWorksheet(1)?.rowCount, 1);
assert.equal(createLmraWpsTemplateWorkbook().getWorksheet(1)?.rowCount, 1);

const lmra = (await roundTrip(buildLmraWpsWorkbook(run))).getWorksheet('WPS - Salary File');
assert(lmra);
assert.deepEqual(rowValues(lmra.getRow(1)), [...LMRA_WPS_HEADERS]);
assert.equal(lmra.rowCount, 2);
assert.deepEqual(rowValues(lmra.getRow(2)), [
  '012345678', 'Synthetic Employee', iban, 'BHD', 300.125,
  0, 0, 300.125, 10, 2026
]);
assert.equal(lmra.getRow(2).getCell(1).type, ExcelJS.ValueType.String);
assert.equal(lmra.getRow(2).getCell(6).type, ExcelJS.ValueType.Number);
assert.equal(lmra.getRow(2).getCell(7).type, ExcelJS.ValueType.Number);

const company = (await roundTrip(buildCompanyPayrollWorkbook(run))).getWorksheet('Company Payroll');
assert(company);
assert.deepEqual(rowValues(company.getRow(1)), [...COMPANY_PAYROLL_HEADERS]);
assert.equal(company.getRow(2).getCell(2).value, '012345678');
assert.equal(company.getRow(2).getCell(10).value, 300.125);
assert.equal(company.getRow(2).getCell(13).value, 'synthetic-run');

const adjusted: PublishedPayrollExportRun = {
  ...run, employees: [{ ...run.employees[0], approvedEarningsBhd: 25,
    approvedDeductionsBhd: 5, netPayableBhd: 320.125 }]
};
assert.equal(buildCompanyPayrollWorkbook(adjusted).getWorksheet(1)?.getRow(2).getCell(10).value, 320.125);
assert.equal(buildLmraWpsWorkbook(adjusted).getWorksheet(1)?.getRow(2).getCell(8).value, 300.125);
const fixedDeduction: PublishedPayrollExportRun = {
  ...run, employees: [{ ...run.employees[0], approvedDeductionsBhd: 10,
    fixedSalaryDeductionBhd: 10, netPayableBhd: 290.125 }]
};
assert.throws(() => buildLmraWpsWorkbook(fixedDeduction), /WPS mapping review/);
assert.throws(() => buildCompanyPayrollWorkbook({ ...run, employees: [{ ...run.employees[0],
  approvedDeductionsBhd: 10, fixedSalaryDeductionBhd: 0, netPayableBhd: 290.125 }] }),
  /commission\/bonus before fixed salary/);
assert.throws(() => buildCompanyPayrollWorkbook({ ...run, status: 'draft' as any }), /published payroll run/);
assert.throws(() => buildCompanyPayrollWorkbook({ ...run, accountsApprovedBy: 'owner-user' }), /different users/);
assert.throws(() => buildCompanyPayrollWorkbook({ ...run, employees: [{ ...run.employees[0],
  netPayableBhd: 300.126 }] }), /Unreconciled payroll amount/);
assert.throws(() => buildLmraWpsWorkbook({ ...run, employees: [{ ...run.employees[0],
  iban: 'BH00INVALID' }] }), /Invalid Bahrain IBAN/);
console.log('Payroll export workbook tests passed');
