import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createCompanyPayrollTemplateWorkbook,
  createLmraWpsTemplateWorkbook
} from '../services/payrollExportService';

const output = resolve('docs/templates');
await mkdir(output, { recursive: true });
await createCompanyPayrollTemplateWorkbook().xlsx.writeFile(resolve(output, 'Company Payroll - Blank.xlsx'));
await createLmraWpsTemplateWorkbook().xlsx.writeFile(resolve(output, 'LMRA WPS - Blank.xlsx'));
console.log('Created two blank payroll templates without employee data');
