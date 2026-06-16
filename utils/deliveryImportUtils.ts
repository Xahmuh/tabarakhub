import {
  DeliveryBlock,
  DeliveryDriver,
  DeliveryOrderInput,
  DeliveryPaymentType,
  DeliveryPaymentTypeConfig,
  Pharmacist
} from '../types';
import {
  DEFAULT_DELIVERY_PAYMENT_TYPES,
  isDeliveryPaymentBlockExempt,
  isTalabatDeliveryPayment,
  normalizeDeliveryPaymentCode
} from '../lib/deliveryPaymentTypes';

export const DELIVERY_ORDER_IMPORT_ACCEPT = '.xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MAX_DELIVERY_ORDER_IMPORT_BYTES = 5 * 1024 * 1024;

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
    pharmacist.name
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
    driver.name
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
