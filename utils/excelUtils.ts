
import { saveAs } from 'file-saver';
import { Product } from '../types';
import { isModuleEnabled } from '../config/clientConfig';
import { BAHRAIN_VAT_RATE, formatVatLabel, parseVatEnabled } from './vat';

const MAX_PRODUCT_IMPORT_BYTES = 5 * 1024 * 1024;
const normalizeProductInternalCode = (code: unknown) => code?.toString().trim().toUpperCase() || '';

const createWorkbook = async () => {
    if (!isModuleEnabled('excelExport')) {
        throw new Error("Excel import/export is disabled for this client deployment");
    }

    // SECURITY TODO: ExcelJS 4.4.0 currently carries an npm audit warning through
    // its uuid dependency. Product imports parse uploaded XLSX files, so keep this
    // path restricted to trusted admin/manager users and replace ExcelJS or upgrade
    // as soon as upstream publishes a patched release.
    const ExcelJS = await import('exceljs');
    return new ExcelJS.Workbook();
};

export const BRANCH_NAME_MAPPING: Record<string, string> = {
    'Tabarak Pharmacy - Jerdab branch': 'Tabarak 01 - Jerdab',
    'Sanad 1 Pharmacy - Club': 'Sanad 01 - Club',
    'Alhoda Pharmacy - Isa Town': 'Alhoda 03 - Isa Town/AlRabiee',
    'Tabarak Pharmacy - West Riffa': 'Tabarak 05 - W.Riffa',
    'Tabarak Pharmacy - Hidd Station': 'Tabarak 03 - Hidd Station',
    'Alhoda Pharmacy - Sanad branch': 'Alhoda 04 - Sanad',
    'Tabarak Pharmacy - Janabiya branch': 'Tabarak 04 - Janabiya',
    'Tabarak Pharmacy - Hidd Club': 'Tabarak 08 - Hidd Club',
    'Janabiya Square Pharmacy': 'Sanad 03 - Janabiya Sq',
    'Damistan Pharmacy': 'District 02 - Damistan',
    'Tabarak Pharmacy - Qalali Station': 'Tabarak 02 - Qalali Station',
    'Jamila Pharmacy - Zinj branch': 'Sanad 02 - Jamila',
    'Sanad 2 Pharmacy - Station': 'Sanad 04 - Sanad Station',
    'Alhoda Pharmacy - Budaiya branch': 'Alhoda 05 - Budaiya',
    'Tabarak Pharmacy - Qalali 2': 'Tabarak 09 - Qalali 2',
    'Alnahar Pharmacy - Jerdab branch': 'Alhoda 02 - alnahar Jerdab',
    'Alhoda Pharmacy - Tubli branch': 'Alhoda 01 - Tubli',
    'District Pharmacy': 'District 01 - Janabiya',
    'Tabarak Pharmacy - Juffair branch': 'Tabarak 06 - Juffair',
    'Tabarak Pharmacy - Karana Branch': 'Tabarak 07 - Karanah',
    'Tabarak Pharmacy - Mashtan': 'Tabarak 10 - Mashtan'
};

export const mapBranchName = (name: string) => BRANCH_NAME_MAPPING[name.trim()] || name;

export const generateProductTemplate = async () => {
    const workbook = await createWorkbook();
    const worksheet = workbook.addWorksheet('Products Import Template');

    // Define columns
    worksheet.columns = [
        { header: 'internal_code', key: 'internal_code', width: 20 }, // REQUIRED
        { header: 'name', key: 'name', width: 32 },
        { header: 'category', key: 'category', width: 22 },
        { header: 'agent', key: 'agent', width: 24 },
        { header: 'retail price ex vat', key: 'default_price', width: 20 },
        { header: 'vat', key: 'vat', width: 12 },
        { header: 'is_manual', key: 'is_manual', width: 14 },
    ];

    // Add example row
    worksheet.addRow({
        internal_code: 'I17439',
        name: 'Example Product',
        category: 'General',
        agent: 'Distribution Agent',
        default_price: 1.500,
        vat: 'YES',
        is_manual: 'Yes'
    });

    // Style header
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } };
    headerRow.eachCell((cell) => {
        cell.alignment = { vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    });

    const notes = workbook.addWorksheet('Import Rules');
    notes.columns = [
        { header: 'Rule', key: 'rule', width: 36 },
        { header: 'Details', key: 'details', width: 72 },
    ];
    notes.addRows([
        { rule: 'internal_code', details: 'Required and unique. Existing codes will be updated.' },
        { rule: 'name', details: 'Required. If left blank during parsing, the row is rejected.' },
        { rule: 'retail price ex vat', details: 'Required numeric BHD value before VAT. Maximum 3 decimals recommended.' },
        { rule: 'vat', details: `YES applies Bahrain VAT (${Math.round(BAHRAIN_VAT_RATE * 100)}%). NO keeps VAT at 0%.` },
        { rule: 'category / agent', details: 'Optional but recommended for search and reporting.' },
        { rule: 'file size', details: 'Maximum upload size is 5MB.' },
    ]);
    notes.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'product_import_template.xlsx');
};

export const generateProductListExport = async (products: Product[]) => {
    const workbook = await createWorkbook();
    const worksheet = workbook.addWorksheet('Product List');

    // Columns: internal_code | name | category | agent | default_price | vat | is_manual
    worksheet.columns = [
        { header: 'internal_code', key: 'internal_code', width: 20 },
        { header: 'name', key: 'name', width: 30 },
        { header: 'category', key: 'category', width: 20 },
        { header: 'agent', key: 'agent', width: 20 },
        { header: 'retail price ex vat', key: 'default_price', width: 20 },
        { header: 'vat', key: 'vat', width: 15 },
        { header: 'is_manual', key: 'is_manual', width: 15 }
    ];

    // Add rows
    products.forEach(p => {
        worksheet.addRow({
            internal_code: p.internalCode || '',
            name: p.name,
            category: p.category || '',
            agent: p.agent || '',
            default_price: p.defaultPrice,
            vat: formatVatLabel(p.vatEnabled, p.vatRate),
            is_manual: p.isManual ? 'Yes' : 'No'
        });
    });

    // Style header
    worksheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `product_list_export_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export interface ProductImportResult {
    validRows: any[];
    errors: { row: number; message: string }[];
}

export const parseProductUpload = async (file: File): Promise<ProductImportResult> => {
    if (file.size > MAX_PRODUCT_IMPORT_BYTES) {
        throw new Error("Invalid Excel file: Maximum upload size is 5MB");
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = await createWorkbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
        throw new Error("Invalid Excel file: No worksheet found");
    }

    const validRowsByCode = new Map<string, any>();
    const errors: { row: number; message: string }[] = [];

    // Validate headers
    const headerRow = worksheet.getRow(1);
    const fileHeaders: string[] = [];
    headerRow.eachCell((cell) => {
        const val = cell.value?.toString().trim();
        if (val) fileHeaders.push(val);
    });

    // Valid headers match the generated template and product export format.
    const expectedHeaders = ['internal_code', 'name', 'category', 'agent', 'retail price ex vat', 'vat', 'is_manual'];

    // STRICT VALIDATION
    // Keep uploaded files aligned with the generated template and exported list.
    // This prevents silent column shifts during catalog imports.
    const isExactMatch =
        fileHeaders.length === expectedHeaders.length &&
        expectedHeaders.every(h => fileHeaders.includes(h));

    if (!isExactMatch) {
        throw new Error(`Invalid Template. Headers must exactly match: ${expectedHeaders.join(', ')}. Found: ${fileHeaders.join(', ')}`);
    }

    // Map headers to columns
    const colMap: { [key: string]: number } = {};
    headerRow.eachCell((cell, colNumber) => {
        const val = cell.value?.toString().trim();
        if (val && expectedHeaders.includes(val)) {
            colMap[val] = colNumber;
        }
    });

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const rowData: any = {};

        // internal_code
        const internalCode = normalizeProductInternalCode(row.getCell(colMap['internal_code']).value);

        if (!internalCode) {
            // Check empty row
            let text = "";
            row.eachCell(cell => text += cell.value);
            if (!text.trim()) return; // Skip empty row

            errors.push({ row: rowNumber, message: "Missing internal_code" });
            return;
        }

        // Price mapping from 'retail price ex vat'
        const defaultPriceVal = row.getCell(colMap['retail price ex vat']).value;
        const defaultPrice = Number(defaultPriceVal);

        if (isNaN(defaultPrice)) {
            errors.push({ row: rowNumber, message: "Invalid retail price ex vat (must be numeric)" });
            return;
        }

        rowData.internal_code = internalCode;
        const productName = row.getCell(colMap['name']).value?.toString().trim();
        if (!productName) {
            errors.push({ row: rowNumber, message: "Missing product name" });
            return;
        }

        rowData.name = productName;
        rowData.category = row.getCell(colMap['category']).value?.toString().trim() || '';
        rowData.agent = row.getCell(colMap['agent']).value?.toString().trim() || '';
        rowData.default_price = defaultPrice;
        rowData.vat_enabled = parseVatEnabled(row.getCell(colMap['vat']).value);
        // Product imports are manager-owned catalog additions, so the service
        // forces is_manual = true regardless of the uploaded value.
        rowData.is_manual = true;

        validRowsByCode.set(internalCode, rowData);
    });

    return { validRows: Array.from(validRowsByCode.values()), errors };
};
