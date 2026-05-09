
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Product } from '../types';

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
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products Import Template');

    // Define columns
    worksheet.columns = [
        { header: 'internal_code', key: 'internal_code', width: 20 }, // REQUIRED
        { header: 'name', key: 'name', width: 30 },
        { header: 'category', key: 'category', width: 20 },
        { header: 'agent', key: 'agent', width: 20 },
        { header: 'retail price', key: 'default_price', width: 15 },
        { header: 'is_manual', key: 'is_manual', width: 20 },
    ];

    // Add example row
    worksheet.addRow({
        internal_code: 'I17439',
        name: 'Example Product',
        category: 'General',
        agent: 'Distribution Agent',
        default_price: 1.500,
        is_manual: 'Yes'
    });

    // Style header
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'product_import_template.xlsx');
};

export const generateProductListExport = async (products: Product[]) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Product List');

    // Columns: internal_code | name | category | agent | default_price | is_manual
    worksheet.columns = [
        { header: 'internal_code', key: 'internal_code', width: 20 },
        { header: 'name', key: 'name', width: 30 },
        { header: 'category', key: 'category', width: 20 },
        { header: 'agent', key: 'agent', width: 20 },
        { header: 'retail price', key: 'default_price', width: 15 },
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
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
        throw new Error("Invalid Excel file: No worksheet found");
    }

    const validRows: any[] = [];
    const errors: { row: number; message: string }[] = [];

    // Validate headers
    const headerRow = worksheet.getRow(1);
    const fileHeaders: string[] = [];
    headerRow.eachCell((cell) => {
        const val = cell.value?.toString().trim();
        if (val) fileHeaders.push(val);
    });

    // Valid headers based on user request and updated export format
    const expectedHeaders = ['internal_code', 'name', 'category', 'agent', 'retail price', 'extrenal add ( TRUE )'];

    // STRICT VALIDATION
    // We check if all REQUIRED columns are present. 'extrenal add ( TRUE )' matches the export. 
    // If the user uploads an old template, it might fail. We strictly enforce the new format.
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

    const seenCodes = new Set<string>();

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const rowData: any = {};

        // internal_code
        const internalCode = row.getCell(colMap['internal_code']).value?.toString().trim();

        if (!internalCode) {
            // Check empty row
            let text = "";
            row.eachCell(cell => text += cell.value);
            if (!text.trim()) return; // Skip empty row

            errors.push({ row: rowNumber, message: "Missing internal_code" });
            return;
        }

        if (seenCodes.has(internalCode)) {
            errors.push({ row: rowNumber, message: `Duplicate internal_code in file: ${internalCode}` });
            return;
        }
        seenCodes.add(internalCode);

        // Price mapping from 'retail price'
        const defaultPriceVal = row.getCell(colMap['retail price']).value;
        const defaultPrice = Number(defaultPriceVal);

        if (isNaN(defaultPrice)) {
            errors.push({ row: rowNumber, message: "Invalid retail price (must be numeric)" });
            return;
        }

        rowData.internal_code = internalCode;
        rowData.name = row.getCell(colMap['name']).value?.toString().trim() || 'Imported Product';
        rowData.category = row.getCell(colMap['category']).value?.toString().trim() || '';
        rowData.agent = row.getCell(colMap['agent']).value?.toString().trim() || '';
        rowData.default_price = defaultPrice;
        // We force is_manual = true in service, ignoring file value for safety, or we could read it.
        // User said "extrenal add ( TRUE )", implying it's always true.
        rowData.is_manual = true;

        validRows.push(rowData);
    });

    return { validRows, errors };
};
