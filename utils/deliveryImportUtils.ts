import {
  DeliveryBlock,
  DeliveryDriver,
  DeliveryOrderInput,
  DeliveryPaymentType,
  DeliveryPaymentTypeConfig,
  Pharmacist
} from '../types';
import { isModuleEnabled } from '../config/clientConfig';
import {
  DEFAULT_DELIVERY_PAYMENT_TYPES,
  isDeliveryPaymentBlockExempt,
  isTalabatDeliveryPayment,
  normalizeDeliveryPaymentCode
} from '../lib/deliveryPaymentTypes';
import { saveAs } from 'file-saver';

export const DELIVERY_ORDER_IMPORT_ACCEPT = '.xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MAX_DELIVERY_ORDER_IMPORT_BYTES = 5 * 1024 * 1024;
export const DELIVERY_ORDER_IMPORT_TEMPLATE_HEADERS = [
  'order_date',
  'value_bhd',
  'payment_type',
  'block_number',
  'area_name',
  'pharmacist',
  'driver',
  'notes'
] as const;

type DeliveryImportField =
  | 'orderDate'
  | 'valueBhd'
  | 'paymentType'
  | 'blockNumber'
  | 'areaName'
  | 'pharmacist'
  | 'driver'
  | 'notes';

interface ParsedDeliveryFileRow {
  rowNumber: number;
  values: Record<string, unknown>;
}

export interface DeliveryOrderImportContext {
  branchId: string;
  pharmacists: Pharmacist[];
  drivers: DeliveryDriver[];
  blocks: DeliveryBlock[];
  paymentTypes?: DeliveryPaymentTypeConfig[];
}

export interface DeliveryOrderImportRow {
  rowNumber: number;
  input: DeliveryOrderInput;
}

export interface DeliveryOrderImportError {
  row: number;
  message: string;
}

export interface DeliveryOrderImportProgress {
  percent: number;
  label: string;
  detail?: string;
}

export interface DeliveryOrderImportResult {
  validRows: DeliveryOrderImportRow[];
  errors: DeliveryOrderImportError[];
  totalRows: number;
}

export interface DeliveryOrderTemplateContext extends DeliveryOrderImportContext {
  branchName?: string;
  branchCode?: string;
}

const FIELD_ALIASES: Record<DeliveryImportField, string[]> = {
  orderDate: ['order_date', 'order date', 'date', 'invoice date', 'delivery date'],
  valueBhd: ['value_bhd', 'value bhd', 'value (bhd)', 'order value', 'invoice value', 'amount', 'value', 'total'],
  paymentType: ['payment_type', 'payment type', 'payment', 'payment method', 'method', 'pay type'],
  blockNumber: ['block_number', 'block number', 'block no', 'block no.', 'block', 'block/area'],
  areaName: ['area_name', 'area name', 'area', 'block area'],
  pharmacist: ['pharmacist', 'pharmacist name', 'pharmacist code', 'pharmacist_code', 'pharmacist id'],
  driver: ['driver', 'driver name', 'driver code', 'driver_code', 'driver id'],
  notes: ['notes', 'note', 'remark', 'remarks']
};

const stripBom = (value: string) => value.replace(/^\uFEFF/, '');

const pad2 = (value: number) => String(value).padStart(2, '0');

const toText = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
};

const normalizeHeader = (value: unknown) =>
  stripBom(toText(value))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeLookup = (value: unknown) =>
  stripBom(toText(value))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizedAliases = Object.fromEntries(
  Object.entries(FIELD_ALIASES).map(([field, aliases]) => [
    field,
    aliases.map(normalizeHeader)
  ])
) as Record<DeliveryImportField, string[]>;

const reportProgress = (
  onProgress: ((progress: DeliveryOrderImportProgress) => void) | undefined,
  percent: number,
  label: string,
  detail?: string
) => {
  onProgress?.({ percent, label, detail });
};

const createTemplateWorkbook = async () => {
  if (!isModuleEnabled('excelExport')) {
    throw new Error('Excel import/export is disabled for this client deployment');
  }
  const ExcelJS = await import('exceljs');
  return new ExcelJS.Workbook();
};

const safeSheetName = (value: string) => value.replace(/[*?:/\\[\]]/g, ' ').slice(0, 31);

const styleTemplateHeader = (row: any) => {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.height = 22;
  row.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF7F1D1D' } } };
  });
};

const styleReferenceHeader = (row: any) => {
  row.font = { bold: true, color: { argb: 'FF0F172A' } };
  row.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });
};

const addReferenceSheet = (
  workbook: any,
  name: string,
  columns: Array<{ header: string; key: string; width: number }>,
  rows: Array<Record<string, string | number | boolean | null | undefined>>
) => {
  const sheet = workbook.addWorksheet(safeSheetName(name));
  sheet.columns = columns;
  styleReferenceHeader(sheet.getRow(1));
  rows.forEach(row => sheet.addRow(row));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return sheet;
};

const buildDisplayValue = (...parts: Array<string | undefined | null>) =>
  parts.filter(Boolean).join(' - ');

export const generateDeliveryOrderTemplate = async (context: DeliveryOrderTemplateContext) => {
  const workbook = await createTemplateWorkbook();
  workbook.creator = 'Tabarak Hub';
  workbook.created = new Date();

  const activePaymentTypes = (context.paymentTypes && context.paymentTypes.length > 0
    ? context.paymentTypes
    : DEFAULT_DELIVERY_PAYMENT_TYPES
  ).filter(type => type.isActive);
  const defaultPayment = activePaymentTypes.find(type => type.code === 'CASH') || activePaymentTypes[0];
  const samplePharmacist = context.pharmacists[0];
  const sampleDriver = context.drivers[0];
  const sampleBlock = context.blocks[0];
  const templateDate = new Date();
  const templateDateKey = `${templateDate.getFullYear()}-${String(templateDate.getMonth() + 1).padStart(2, '0')}-${String(templateDate.getDate()).padStart(2, '0')}`;

  const ordersSheet = workbook.addWorksheet('Delivery Orders Template');
  ordersSheet.columns = [
    { header: 'order_date', key: 'order_date', width: 16 },
    { header: 'value_bhd', key: 'value_bhd', width: 14 },
    { header: 'payment_type', key: 'payment_type', width: 18 },
    { header: 'block_number', key: 'block_number', width: 18 },
    { header: 'area_name', key: 'area_name', width: 24 },
    { header: 'pharmacist', key: 'pharmacist', width: 32 },
    { header: 'driver', key: 'driver', width: 32 },
    { header: 'notes', key: 'notes', width: 40 }
  ];
  styleTemplateHeader(ordersSheet.getRow(1));

  ordersSheet.addRow({
    order_date: templateDateKey,
    value_bhd: 2.950,
    payment_type: defaultPayment?.code || 'CASH',
    block_number: sampleBlock?.blockNumber || '332',
    area_name: sampleBlock?.areaName || '',
    pharmacist: samplePharmacist ? buildDisplayValue(samplePharmacist.code, samplePharmacist.name) : 'Use pharmacist code or exact name',
    driver: sampleDriver ? buildDisplayValue(sampleDriver.driverCode, sampleDriver.name) : 'Use driver code or exact name',
    notes: 'Example row - replace or delete'
  });

  if (activePaymentTypes.some(type => isTalabatDeliveryPayment(type.code))) {
    ordersSheet.addRow({
      order_date: templateDateKey,
      value_bhd: 1.500,
      payment_type: 'TALABAT',
      block_number: '',
      area_name: '',
      pharmacist: samplePharmacist ? buildDisplayValue(samplePharmacist.code, samplePharmacist.name) : 'Use pharmacist code or exact name',
      driver: '',
      notes: 'Talabat example - driver and block are not required if Talabat is configured as block-exempt'
    });
  }

  for (let row = ordersSheet.rowCount + 1; row <= 250; row++) {
    ordersSheet.addRow({});
  }

  ordersSheet.views = [{ state: 'frozen', ySplit: 1 }];
  ordersSheet.getColumn('value_bhd').numFmt = '0.000';
  ordersSheet.getColumn('order_date').numFmt = 'yyyy-mm-dd';
  ordersSheet.eachRow((row: any, rowNumber: number) => {
    if (rowNumber === 1) return;
    row.eachCell((cell: any) => {
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
    });
  });

  const rulesSheet = workbook.addWorksheet('Import Rules');
  rulesSheet.columns = [
    { header: 'Field', key: 'field', width: 20 },
    { header: 'Required', key: 'required', width: 14 },
    { header: 'How to fill', key: 'details', width: 82 }
  ];
  styleReferenceHeader(rulesSheet.getRow(1));
  rulesSheet.addRows([
    { field: 'order_date', required: 'Yes', details: 'Use yyyy-mm-dd, or an Excel date. Example: 2026-06-17.' },
    { field: 'value_bhd', required: 'Yes', details: 'Numeric BHD amount. Use decimals only, without currency text. Example: 2.950.' },
    { field: 'payment_type', required: 'Yes', details: `Use payment code or label from Payment Types sheet. Active now: ${activePaymentTypes.map(type => type.code).join(', ') || 'No active payment types loaded'}.` },
    { field: 'block_number', required: 'Usually', details: 'Required for payment types that need block coverage. You can use area_name only if it uniquely matches one block.' },
    { field: 'area_name', required: 'Optional', details: 'Optional helper. If block_number is blank and area matches exactly one block, the system can resolve it.' },
    { field: 'pharmacist', required: 'Yes', details: 'Use pharmacist code, exact name, or ID from Pharmacists sheet. Must be assigned to this branch.' },
    { field: 'driver', required: 'Yes except Talabat', details: 'Use driver code, exact name, or ID from Drivers sheet. Leave blank for Talabat orders.' },
    { field: 'notes', required: 'No', details: 'Optional remark for audit or operations.' },
    { field: 'file size', required: 'Limit', details: 'Upload file must be .xlsx or .csv and 5MB or smaller.' },
    { field: 'do not edit headers', required: 'Important', details: `Keep the first row headers exactly as: ${DELIVERY_ORDER_IMPORT_TEMPLATE_HEADERS.join(', ')}.` }
  ]);

  addReferenceSheet(
    workbook,
    'Payment Types',
    [
      { header: 'code', key: 'code', width: 18 },
      { header: 'label', key: 'label', width: 24 },
      { header: 'requires_block', key: 'requires_block', width: 18 },
      { header: 'active', key: 'active', width: 12 }
    ],
    activePaymentTypes.map(type => ({
      code: type.code,
      label: type.label,
      requires_block: type.requiresBlock ? 'YES' : 'NO',
      active: type.isActive ? 'YES' : 'NO'
    }))
  );

  addReferenceSheet(
    workbook,
    'Pharmacists',
    [
      { header: 'code', key: 'code', width: 18 },
      { header: 'name', key: 'name', width: 32 },
      { header: 'value_to_use', key: 'value', width: 42 }
    ],
    context.pharmacists.map(pharmacist => ({
      code: pharmacist.code || '',
      name: pharmacist.name,
      value: buildDisplayValue(pharmacist.code, pharmacist.name) || pharmacist.name
    }))
  );

  addReferenceSheet(
    workbook,
    'Drivers',
    [
      { header: 'code', key: 'code', width: 18 },
      { header: 'name', key: 'name', width: 32 },
      { header: 'value_to_use', key: 'value', width: 42 },
      { header: 'active', key: 'active', width: 12 }
    ],
    context.drivers.map(driver => ({
      code: driver.driverCode || '',
      name: driver.name,
      value: buildDisplayValue(driver.driverCode, driver.name) || driver.name,
      active: driver.isActive ? 'YES' : 'NO'
    }))
  );

  addReferenceSheet(
    workbook,
    'Blocks',
    [
      { header: 'block_number', key: 'block_number', width: 18 },
      { header: 'area_name', key: 'area_name', width: 32 },
      { header: 'governorate', key: 'governorate', width: 18 }
    ],
    context.blocks.map(block => ({
      block_number: block.blockNumber,
      area_name: block.areaName,
      governorate: block.governorate
    }))
  );

  const paymentListFormula = `'Payment Types'!$A$2:$A$${Math.max(activePaymentTypes.length + 1, 2)}`;
  const pharmacistListFormula = `'Pharmacists'!$C$2:$C$${Math.max(context.pharmacists.length + 1, 2)}`;
  const driverListFormula = `'Drivers'!$C$2:$C$${Math.max(context.drivers.length + 1, 2)}`;
  const blockListFormula = `'Blocks'!$A$2:$A$${Math.max(context.blocks.length + 1, 2)}`;

  for (let rowNumber = 2; rowNumber <= 250; rowNumber++) {
    ordersSheet.getCell(`A${rowNumber}`).dataValidation = {
      type: 'date',
      operator: 'greaterThanOrEqual',
      formulae: [new Date(2020, 0, 1)],
      allowBlank: false,
      showErrorMessage: true,
      errorTitle: 'Invalid date',
      error: 'Use a valid delivery date.'
    };
    ordersSheet.getCell(`B${rowNumber}`).dataValidation = {
      type: 'decimal',
      operator: 'greaterThan',
      formulae: [0],
      allowBlank: false,
      showErrorMessage: true,
      errorTitle: 'Invalid value',
      error: 'Order value must be greater than zero.'
    };
    ordersSheet.getCell(`C${rowNumber}`).dataValidation = {
      type: 'list',
      formulae: [paymentListFormula],
      allowBlank: false
    };
    ordersSheet.getCell(`D${rowNumber}`).dataValidation = {
      type: 'list',
      formulae: [blockListFormula],
      allowBlank: true
    };
    ordersSheet.getCell(`F${rowNumber}`).dataValidation = {
      type: 'list',
      formulae: [pharmacistListFormula],
      allowBlank: false
    };
    ordersSheet.getCell(`G${rowNumber}`).dataValidation = {
      type: 'list',
      formulae: [driverListFormula],
      allowBlank: true
    };
  }

  const branchSegment = [context.branchCode, context.branchName]
    .filter(Boolean)
    .join('_')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'branch';
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `delivery_bulk_upload_template_${branchSegment}.xlsx`
  );
};

export const isSupportedDeliveryOrderImportFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith('.xlsx') || lowerName.endsWith('.csv');
};

const detectDelimiter = (text: string): ',' | ';' | '\t' => {
  const sample = text.slice(0, 4096);
  const candidates: Array<',' | ';' | '\t'> = [',', ';', '\t'];
  const counts = new Map<',' | ';' | '\t', number>(candidates.map(candidate => [candidate, 0]));
  let inQuotes = false;

  for (let index = 0; index < sample.length; index++) {
    const char = sample[index];
    if (char === '"') {
      if (inQuotes && sample[index + 1] === '"') {
        index++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && (char === '\n' || char === '\r')) break;
    if (!inQuotes && counts.has(char as ',' | ';' | '\t')) {
      counts.set(char as ',' | ';' | '\t', (counts.get(char as ',' | ';' | '\t') || 0) + 1);
    }
  }

  return candidates.sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0))[0];
};

const parseDelimitedRows = (text: string, delimiter: ',' | ';' | '\t') => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = '';
  };

  const pushRow = () => {
    pushCell();
    if (row.some(value => value.trim() !== '')) {
      rows.push(row);
    }
    row = [];
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      pushCell();
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[index + 1] === '\n') index++;
      pushRow();
      continue;
    }

    cell += char;
  }

  if (cell || row.length > 0) {
    pushRow();
  }

  return rows;
};

const excelCellToValue = (value: any): unknown => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(excelCellToValue).join(' ');
  if ('result' in value) return excelCellToValue(value.result);
  if ('text' in value) return value.text;
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((part: any) => part.text || '').join('');
  }
  return '';
};

const rowsFromCsv = async (file: File): Promise<ParsedDeliveryFileRow[]> => {
  const text = await file.text();
  const rawRows = parseDelimitedRows(text, detectDelimiter(text));
  if (rawRows.length < 2) return [];
  const headers = rawRows[0].map(normalizeHeader);

  return rawRows.slice(1).map((row, index) => {
    const values: Record<string, unknown> = {};
    headers.forEach((header, cellIndex) => {
      if (header) values[header] = row[cellIndex] ?? '';
    });
    return { rowNumber: index + 2, values };
  }).filter(row => Object.values(row.values).some(value => toText(value) !== ''));
};

const rowsFromXlsx = async (file: File): Promise<ParsedDeliveryFileRow[]> => {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  for (let column = 1; column <= headerRow.cellCount; column++) {
    headers[column - 1] = normalizeHeader(excelCellToValue(headerRow.getCell(column).value));
  }

  const rows: ParsedDeliveryFileRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, unknown> = {};
    let hasValue = false;
    for (let column = 1; column <= headers.length; column++) {
      const header = headers[column - 1];
      if (!header) continue;
      const value = excelCellToValue(row.getCell(column).value);
      values[header] = value;
      if (value instanceof Date || toText(value) !== '') hasValue = true;
    }
    if (hasValue) rows.push({ rowNumber, values });
  });

  return rows;
};

const getFieldValue = (row: ParsedDeliveryFileRow, field: DeliveryImportField) => {
  for (const alias of normalizedAliases[field]) {
    if (Object.prototype.hasOwnProperty.call(row.values, alias)) {
      return row.values[alias];
    }
  }
  return '';
};

const isValidDateKey = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

const dateKeyFromParts = (year: number, month: number, day: number) => {
  const dateKey = `${year}-${pad2(month)}-${pad2(day)}`;
  return isValidDateKey(dateKey) ? dateKey : null;
};

const parseDateKey = (value: unknown) => {
  if (value instanceof Date) {
    return dateKeyFromParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 25000 && value < 80000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return dateKeyFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  const text = toText(value);
  if (!text) return null;
  if (isValidDateKey(text.slice(0, 10))) return text.slice(0, 10);

  const slashDate = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(text);
  if (slashDate) {
    const day = Number(slashDate[1]);
    const month = Number(slashDate[2]);
    const rawYear = Number(slashDate[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return dateKeyFromParts(year, month, day);
  }

  return null;
};

const parseValueBhd = (value: unknown) => {
  const text = toText(value).replace(/bhd/gi, '').replace(/,/g, '').trim();
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parsePaymentType = (value: unknown, paymentTypes?: DeliveryPaymentTypeConfig[]): DeliveryPaymentType | null => {
  const normalized = normalizeLookup(value).replace(/\s+/g, '');
  if (!normalized) return null;
  const configured = paymentTypes && paymentTypes.length > 0 ? paymentTypes : DEFAULT_DELIVERY_PAYMENT_TYPES;
  const aliases = new Map<string, DeliveryPaymentType>();
  configured.forEach(type => {
    aliases.set(normalizeLookup(type.code).replace(/\s+/g, ''), type.code);
    aliases.set(normalizeLookup(type.label).replace(/\s+/g, ''), type.code);
  });
  aliases.set('benefit', 'BP');
  aliases.set('benefitpay', 'BP');
  aliases.set('visa', 'CARD');
  aliases.set('mastercard', 'CARD');
  aliases.set('debit', 'CARD');
  aliases.set('credit', 'CARD');
  aliases.set('talabatgo', 'TALABAT');
  const match = aliases.get(normalized);
  if (match) return match;
  const code = normalizeDeliveryPaymentCode(value == null ? '' : String(value));
  if (configured.some(type => type.code === code)) return code;
  return null;
};

const resolvePharmacist = (value: unknown, pharmacists: Pharmacist[]) => {
  const text = toText(value);
  if (!text) return { id: null, name: null, error: 'Pharmacist is required.' };
  const normalized = normalizeLookup(text);
  const matches = pharmacists.filter(pharmacist => [
    pharmacist.id,
    pharmacist.code,
    pharmacist.name,
    buildDisplayValue(pharmacist.code, pharmacist.name),
    buildDisplayValue(pharmacist.name, pharmacist.code)
  ].some(candidate => normalizeLookup(candidate) === normalized));
  if (matches.length === 1) return { id: matches[0].id, name: matches[0].name, error: null };
  if (matches.length > 1) return { id: null, name: null, error: `Pharmacist "${text}" matches more than one record.` };
  return { id: null, name: null, error: `Pharmacist "${text}" is not assigned to this branch.` };
};

const resolveDriver = (value: unknown, drivers: DeliveryDriver[]) => {
  const text = toText(value);
  if (!text) return { id: null, error: 'Driver is required.' };
  const normalized = normalizeLookup(text);
  const matches = drivers.filter(driver => [
    driver.id,
    driver.driverCode,
    driver.name,
    buildDisplayValue(driver.driverCode, driver.name),
    buildDisplayValue(driver.name, driver.driverCode)
  ].some(candidate => normalizeLookup(candidate) === normalized));
  if (matches.length === 1) return { id: matches[0].id, error: null };
  if (matches.length > 1) return { id: null, error: `Driver "${text}" matches more than one record.` };
  return { id: null, error: `Driver "${text}" was not found.` };
};

const normalizeBlockNumber = (value: unknown) => toText(value).replace(/\s+/g, '');

const resolveBlockNumber = (
  blockValue: unknown,
  areaValue: unknown,
  paymentType: DeliveryPaymentType,
  blocks: DeliveryBlock[],
  paymentTypes?: DeliveryPaymentTypeConfig[]
) => {
  if (isDeliveryPaymentBlockExempt(paymentType, paymentTypes)) return { blockNumber: null, error: null };

  const blockText = normalizeBlockNumber(blockValue);
  if (blockText) {
    const block = blocks.find(item => normalizeBlockNumber(item.blockNumber) === blockText);
    if (block) return { blockNumber: block.blockNumber, error: null };
    return { blockNumber: null, error: `Block "${toText(blockValue)}" is not in the block directory.` };
  }

  const areaText = toText(areaValue);
  if (areaText) {
    const normalizedArea = normalizeLookup(areaText);
    const exactMatches = blocks.filter(block => normalizeLookup(block.areaName) === normalizedArea);
    const matches = exactMatches.length > 0
      ? exactMatches
      : blocks.filter(block => normalizeLookup(block.areaName).includes(normalizedArea));
    const uniqueBlockNumbers = [...new Set(matches.map(block => block.blockNumber))];
    if (uniqueBlockNumbers.length === 1) return { blockNumber: uniqueBlockNumbers[0], error: null };
    if (uniqueBlockNumbers.length > 1) {
      return {
        blockNumber: null,
        error: `Area "${areaText}" matches ${uniqueBlockNumbers.length} blocks. Add a block_number column for this row.`
      };
    }
  }

  return { blockNumber: null, error: 'Block number is required for this payment type.' };
};

export const parseDeliveryOrderUpload = async (
  file: File,
  context: DeliveryOrderImportContext,
  onProgress?: (progress: DeliveryOrderImportProgress) => void
): Promise<DeliveryOrderImportResult> => {
  reportProgress(onProgress, 8, 'Reading delivery file', file.name);
  const rows = file.name.toLowerCase().endsWith('.csv')
    ? await rowsFromCsv(file)
    : await rowsFromXlsx(file);

  reportProgress(onProgress, 26, 'Parsing delivery rows', `${rows.length.toLocaleString()} rows found`);

  const validRows: DeliveryOrderImportRow[] = [];
  const errors: DeliveryOrderImportError[] = [];

  rows.forEach((row, index) => {
    if (index % 50 === 0) {
      reportProgress(
        onProgress,
        30 + Math.round((index / Math.max(rows.length, 1)) * 38),
        'Validating delivery rows',
        `${index.toLocaleString()} of ${rows.length.toLocaleString()} rows checked`
      );
    }

    const orderDate = parseDateKey(getFieldValue(row, 'orderDate'));
    const valueBhd = parseValueBhd(getFieldValue(row, 'valueBhd'));
    const paymentType = parsePaymentType(getFieldValue(row, 'paymentType'), context.paymentTypes);

    if (!orderDate) {
      errors.push({ row: row.rowNumber, message: 'Missing or invalid order date.' });
      return;
    }
    if (!valueBhd) {
      errors.push({ row: row.rowNumber, message: 'Missing or invalid order value.' });
      return;
    }
    if (!paymentType) {
      errors.push({ row: row.rowNumber, message: 'Missing or invalid payment type. Use a configured payment type such as BP, CASH, CARD, TALABAT, or INSURANCE.' });
      return;
    }

    const pharmacist = resolvePharmacist(getFieldValue(row, 'pharmacist'), context.pharmacists);
    if (pharmacist.error) {
      errors.push({ row: row.rowNumber, message: pharmacist.error });
      return;
    }

    const isTalabatOrder = isTalabatDeliveryPayment(paymentType);
    const driver = isTalabatOrder
      ? { id: null, error: null }
      : resolveDriver(getFieldValue(row, 'driver'), context.drivers);
    if (driver.error) {
      errors.push({ row: row.rowNumber, message: driver.error });
      return;
    }

    const block = resolveBlockNumber(
      getFieldValue(row, 'blockNumber'),
      getFieldValue(row, 'areaName'),
      paymentType,
      context.blocks,
      context.paymentTypes
    );
    if (block.error) {
      errors.push({ row: row.rowNumber, message: block.error });
      return;
    }

    validRows.push({
      rowNumber: row.rowNumber,
      input: {
        branchId: context.branchId,
        orderDate,
        valueBhd,
        paymentType,
        pharmacistId: pharmacist.id,
        pharmacistName: pharmacist.name,
        driverId: isTalabatOrder ? null : driver.id,
        blockNumber: block.blockNumber,
        notes: toText(getFieldValue(row, 'notes')) || undefined
      }
    });
  });

  reportProgress(onProgress, 70, 'Delivery file validated', `${validRows.length.toLocaleString()} rows ready`);
  return { validRows, errors, totalRows: rows.length };
};
