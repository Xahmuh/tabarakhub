import { saveAs } from 'file-saver';
import { supabaseClient } from '../../../lib/supabaseClient';
import {
  workforceService,
  StaffCategory,
  StaffStatus,
  EmployeeBranchAssignment
} from '../../../services/workforceService';

export interface DefaultBranchOption {
  code: string;
  name: string;
}

export interface DefaultVehicleOption {
  plateNumber: string;
  type: string;
  model: string;
  ownership: string;
}

export const DEFAULT_BRANCHES: DefaultBranchOption[] = [
  { code: 'B01', name: 'Branch 01 - Riffa' },
  { code: 'B02', name: 'Branch 02 - Muharraq' },
  { code: 'B03', name: 'Branch 03 - Manama' },
  { code: 'B04', name: 'Branch 04 - Isa Town' },
  { code: 'B05', name: 'Branch 05 - Hamad Town' },
];

export const DEFAULT_FLEET_VEHICLES: DefaultVehicleOption[] = [
  { plateNumber: '654321', type: 'Motorcycle', model: 'Honda 125', ownership: 'Company' },
  { plateNumber: '123456', type: 'Car', model: 'Toyota Yaris', ownership: 'Company' },
  { plateNumber: '789012', type: 'Van', model: 'Nissan Urvan', ownership: 'Company' },
  { plateNumber: '345678', type: 'Motorcycle', model: 'Suzuki GN125', ownership: 'Rented' },
  { plateNumber: '901234', type: 'Car', model: 'Hyundai Accent', ownership: 'Rented' },
  { plateNumber: '567890', type: 'Motorcycle', model: 'Yamaha YBR', ownership: 'Private' },
  { plateNumber: '234567', type: 'Car', model: 'Kia Picanto', ownership: 'Private' },
  { plateNumber: '890123', type: 'Van', model: 'Toyota HiAce', ownership: 'Company' },
  { plateNumber: '456789', type: 'Motorcycle', model: 'Bajaj Boxer', ownership: 'Company' },
  { plateNumber: '012345', type: 'Car', model: 'Nissan Sunny', ownership: 'Company' },
];

  export const exportWorkforceToCsv = (employees: any[], isRtl: boolean, showToast: (msg: string, type?: string) => void) => {
    if (!employees || employees.length === 0) {
      showToast(isRtl ? 'لا يوجد موظفين للتصدير' : 'No employees to export', 'error');
      return;
    }

    const headers = [
      'Code',
      'Full Name',
      'Category',
      'Company',
      'CR',
      'CPR Number',
      'Passport Number',
      'PP Expiry Date',
      'Gender',
      'Visa Type',
      'WP Expiry Date',
      'Nationality',
      'IBAN',
      'Basic Salary',
      'Housing',
      'Transportation',
      'Total Fixed',
      'Job Responsibility Bonus',
      'Long Shift Incentive',
      'Total Variable',
      '1% GOSI',
      'EWA Fees',
      'Others Deduction',
      'Payroll Ded Loan',
      'Total Deductions',
      'Net Salary',
      'Phone',
      'Email',
      'Status',
      'Notes',
      'Assigned Vehicles',
      'Assigned Branches'
    ];

    const rows = employees.map(emp => {
      const branchesStr = (emp.assignments || [])
        .map(a => `${a.branch_name || a.branch_id}${a.is_primary ? ' (Primary)' : ''}`)
        .join('; ');
      const vehiclesStr = (emp.assigned_vehicles || []).join('; ');
      const sm = emp.salary_matrix || {};

      return [
        emp.code,
        emp.full_name,
        emp.category,
        sm.company || '',
        sm.cr || '',
        sm.expatCpr || emp.cpr_number || '',
        sm.expatPp || emp.passport_number || '',
        sm.expatPpExpiryDate || sm.ppExpiryDate || emp.passport_expiry_date || '',
        sm.gender || emp.gender || 'Male',
        sm.visaType || emp.visa_type || 'Internal',
        sm.wpExpiryDate || sm.visaExpiryDate || emp.wp_expiry_date || '',
        sm.nationality || emp.nationality || '',
        sm.iban || '',
        sm.basicSalary !== undefined ? sm.basicSalary : '',
        sm.housing !== undefined ? sm.housing : '',
        sm.transportation !== undefined ? sm.transportation : '',
        sm.totalFixed !== undefined ? sm.totalFixed : '',
        sm.jobResponsibilityBonus !== undefined ? sm.jobResponsibilityBonus : '',
        sm.longShiftIncentive !== undefined ? sm.longShiftIncentive : '',
        sm.totalVariable !== undefined ? sm.totalVariable : '',
        sm.gosi1Pct !== undefined ? sm.gosi1Pct : '',
        sm.ewaFees !== undefined ? sm.ewaFees : '',
        sm.othersDeduction !== undefined ? sm.othersDeduction : '',
        sm.payrollDedLoan !== undefined ? sm.payrollDedLoan : '',
        sm.totalDeductions !== undefined ? sm.totalDeductions : '',
        sm.netSalary !== undefined ? sm.netSalary : '',
        emp.phone || '',
        emp.email || '',
        emp.status,
        emp.notes || '',
        vehiclesStr,
        branchesStr
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Tabarak_Workforce_Directory_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(isRtl ? 'تم تصدير ملف الإكسيل بنجاح' : 'Excel file exported successfully', 'success');
  };

  export const downloadWorkforceExcelTemplate = async (isRtl: boolean, showToast: (msg: string, type?: string) => void) => {
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Tabarak HR Hub';
      workbook.created = new Date();

      // 1. Workforce Template Sheet
      const worksheet = workbook.addWorksheet(isRtl ? 'قالب كادر العمل' : 'Workforce Template', {
        views: [{ rightToLeft: isRtl }]
      });

      const templateHeaders = [
        { header: 'Code', key: 'code', width: 12 },
        { header: 'Full Name', key: 'full_name', width: 25 },
        { header: 'Category', key: 'category', width: 16 },
        { header: 'Company', key: 'company', width: 28 },
        { header: 'CR', key: 'cr', width: 16 },
        { header: 'CPR Number', key: 'cpr_number', width: 16 },
        { header: 'Passport Number', key: 'passport', width: 16 },
        { header: 'PP Expiry Date', key: 'pp_expiry', width: 16 },
        { header: 'Gender', key: 'gender', width: 12 },
        { header: 'Visa Type', key: 'visa_type', width: 14 },
        { header: 'WP Expiry Date', key: 'wp_expiry', width: 16 },
        { header: 'Nationality', key: 'nationality', width: 18 },
        { header: 'IBAN', key: 'iban', width: 26 },
        { header: 'Basic Salary', key: 'basic_salary', width: 14 },
        { header: 'Housing', key: 'housing', width: 12 },
        { header: 'Transportation', key: 'transportation', width: 14 },
        { header: 'Job Responsibility Bonus', key: 'resp_bonus', width: 22 },
        { header: 'Long Shift Incentive', key: 'shift_incentive', width: 20 },
        { header: '1% GOSI', key: 'gosi', width: 12 },
        { header: 'EWA Fees', key: 'ewa', width: 12 },
        { header: 'Others Deduction', key: 'others_ded', width: 16 },
        { header: 'Payroll Ded Loan', key: 'loan', width: 16 },
        { header: 'Phone', key: 'phone', width: 18 },
        { header: 'Email', key: 'email', width: 26 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Notes', key: 'notes', width: 28 },
        { header: 'Assigned Vehicles', key: 'vehicles', width: 22 },
        { header: 'Assigned Branches', key: 'branches', width: 42 }
      ];

      worksheet.columns = templateHeaders;

      // Style Header Row
      const headerRow = worksheet.getRow(1);
      headerRow.height = 28;
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Segoe UI' };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E293B' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF0F172A' } },
          bottom: { style: 'medium', color: { argb: 'FF0284C7' } },
          left: { style: 'thin', color: { argb: 'FF334155' } },
          right: { style: 'thin', color: { argb: 'FF334155' } }
        };
      });

      // Sample Demo Data Rows (one for each category)
      const sampleRows = [
        {
          code: 'E001',
          full_name: 'Dr. Ali Hassan',
          category: 'Pharmacist',
          company: 'Tabarak Pharmacy CO W.L.L',
          cr: '127506-01',
          cpr_number: '910284712',
          passport: 'A29381726',
          pp_expiry: '2028-06-30',
          gender: 'Male',
          visa_type: 'Internal',
          wp_expiry: '2026-12-31',
          nationality: 'Bahraini',
          iban: 'BH67BMBO00000000123456',
          basic_salary: 180,
          housing: 40,
          transportation: 20,
          resp_bonus: 60,
          shift_incentive: 0,
          gosi: 1.8,
          ewa: 0,
          others_ded: 0,
          loan: 0,
          phone: '+973 39123456',
          email: 'ali.hassan@tabarak.com',
          status: 'Active',
          notes: 'Senior in-charge pharmacist',
          vehicles: '',
          branches: 'Main Pharmacy - Manama (Primary); Riffa Branch'
        },
        {
          code: 'D001',
          full_name: 'Mohammed Saeed',
          category: 'Driver',
          company: 'Tabarak Pharmacy CO W.L.L',
          cr: '127506-01',
          cpr_number: '880312456',
          passport: 'P88712345',
          pp_expiry: '2027-09-20',
          gender: 'Male',
          visa_type: 'Flexi',
          wp_expiry: '2026-11-15',
          nationality: 'Indian',
          iban: 'BH45BMBO00000000654321',
          basic_salary: 150,
          housing: 30,
          transportation: 20,
          resp_bonus: 40,
          shift_incentive: 30,
          gosi: 0,
          ewa: 0,
          others_ded: 0,
          loan: 0,
          phone: '+973 33112233',
          email: 'mohammed.driver@tabarak.com',
          status: 'Active',
          notes: 'Express pharmacy delivery driver',
          vehicles: 'V-001; V-002',
          branches: 'Riffa Branch (Primary); Sitra Branch'
        },
        {
          code: 'W001',
          full_name: 'Ramesh Kumar',
          category: 'Worker',
          company: 'District Pharmacy W.L.L',
          cr: '172593-02',
          cpr_number: '940567890',
          passport: 'N44332211',
          pp_expiry: '2026-12-01',
          gender: 'Male',
          visa_type: 'Internal',
          wp_expiry: '2026-10-30',
          nationality: 'Indian',
          iban: 'BH12BMBO00000000987654',
          basic_salary: 120,
          housing: 30,
          transportation: 10,
          resp_bonus: 20,
          shift_incentive: 0,
          gosi: 0,
          ewa: 0,
          others_ded: 0,
          loan: 0,
          phone: '+973 35554444',
          email: 'ramesh.w@tabarak.com',
          status: 'Active',
          notes: 'Inventory storage & packaging',
          vehicles: '',
          branches: 'Hidd Branch (Primary)'
        },
        {
          code: 'M001',
          full_name: 'Sara Al-Kooheji',
          category: 'Management',
          company: 'Tabarak Pharmacy CO W.L.L',
          cr: '127506-01',
          cpr_number: '900812345',
          passport: 'B11223344',
          pp_expiry: '2029-04-10',
          gender: 'Female',
          visa_type: 'Internal',
          wp_expiry: '2027-01-01',
          nationality: 'Bahraini',
          iban: 'BH99BMBO00000000112233',
          basic_salary: 400,
          housing: 80,
          transportation: 40,
          resp_bonus: 100,
          shift_incentive: 0,
          gosi: 4.0,
          ewa: 0,
          others_ded: 0,
          loan: 0,
          phone: '+973 39887766',
          email: 'sara.admin@tabarak.com',
          status: 'Active',
          notes: 'Head Office HR & Operations Manager',
          vehicles: '',
          branches: 'Main Pharmacy - Manama (Primary)'
        }
      ];

      sampleRows.forEach((rowData, idx) => {
        const row = worksheet.addRow(rowData);
        row.height = 22;
        const isEven = idx % 2 === 0;
        row.eachCell(cell => {
          cell.font = { size: 9.5, name: 'Segoe UI' };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
      });

      // 2. Instructions Sheet
      const infoSheet = workbook.addWorksheet(isRtl ? 'دليل التعليمات' : 'Instructions & Guide', {
        views: [{ rightToLeft: isRtl }]
      });

      infoSheet.columns = [
        { header: isRtl ? 'الحقل' : 'Field', key: 'field', width: 25 },
        { header: isRtl ? 'القيم المسموحة / الصيغة' : 'Allowed Values / Format', key: 'allowed', width: 45 },
        { header: isRtl ? 'ملاحظات وتوجيهات' : 'Notes & Description', key: 'notes', width: 45 }
      ];

      const infoHeaderRow = infoSheet.getRow(1);
      infoHeaderRow.height = 26;
      infoHeaderRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      const guideRows = [
        {
          field: 'Code (الكود)',
          allowed: 'E001, D001, W001, M001...',
          notes: isRtl ? 'اختياري. إذا تُرك فارغاً سيقوم النظام بتوليد كود تلقائي حسب الفئة' : 'Optional. If left blank, next available code will be generated.'
        },
        {
          field: 'Category (الفئة)',
          allowed: 'Pharmacist, Driver, Worker, Management (أو صيدلي، سائق، عامل، إدارة)',
          notes: isRtl ? 'إلزامي لتحديد كود الفئة والصلاحيات' : 'Required to set staff category and automatic prefix.'
        },
        {
          field: 'Status (الحالة)',
          allowed: 'Active, Inactive, OnLeave (أو نشط، موقوف، في إجازة)',
          notes: isRtl ? 'الافتراضي هو Active (نشط)' : 'Default is Active.'
        },
        {
          field: 'Gender (الجنس)',
          allowed: 'Male, Female (أو ذكر، أنثى)',
          notes: isRtl ? 'الافتراضي Male' : 'Default is Male.'
        },
        {
          field: 'Visa Type (نوع الإقامة)',
          allowed: 'Internal, Flexi (أو كفالة داخلية، فليكسي)',
          notes: isRtl ? 'الافتراضي Internal' : 'Default is Internal.'
        },
        {
          field: 'Assigned Branches (الفروع المسندة)',
          allowed: 'Main Pharmacy - Manama (Primary); Riffa Branch...',
          notes: isRtl ? 'افصل بين الفروع بفاصلة منقوطة (;). أضف (Primary) لتحديد الفرع الرئيسي' : 'Separate branches with semicolon (;). Add (Primary) for main branch.'
        },
        {
          field: 'Assigned Vehicles (المركبات المسندة)',
          allowed: 'V-001; V-002 (أو أرقام اللوحات)',
          notes: isRtl ? 'خاص بالسائقين. افصل بين أرقام المركبات بفاصلة منقوطة (;)' : 'For drivers. Separate multiple vehicles with semicolon (;).'
        },
        {
          field: 'Salary Fields (بنود الراتب)',
          allowed: 'أرقام فقط (مثال: 180, 40, 20)',
          notes: isRtl ? 'يتم حساب إجمالي الراتب والاستقطاعات وصافي الراتب تلقائياً' : 'Total Fixed, Variable, Deductions, and Net Salary calculate automatically.'
        }
      ];

      guideRows.forEach(g => {
        const row = infoSheet.addRow(g);
        row.height = 22;
        row.eachCell(cell => {
          cell.font = { size: 9.5 };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'Tabarak_Workforce_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(
        isRtl ? 'تم تحميل نموذج الإكسيل بنجاح (XLSX)' : 'Excel template downloaded successfully',
        'success'
      );
    } catch (err: any) {
      console.error('Template download error:', err);
      showToast(isRtl ? 'فشل تحميل النموذج' : 'Failed to download template', 'error');
    }
  };

  export const importWorkforceFromExcel = async (
    file: File,
    isRtl: boolean,
    branches: any[],
    grid20Branches: any[],
    showToast: (msg: string, type?: string) => void,
    onComplete: () => Promise<void>
  ) => {

    try {
      let rawRows: string[][] = [];
      const fileNameLower = file.name.toLowerCase();
      const isExcel = fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls');

      if (isExcel) {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          showToast(isRtl ? 'ملف الإكسيل لا يحتوي على أوراق عمل صالحة' : 'Excel file has no worksheets', 'error');
          return;
        }

        worksheet.eachRow({ includeEmpty: false }, row => {
          const rowValues: string[] = [];
          const cellCount = Math.max(row.cellCount, worksheet.columnCount || 0, 30);
          for (let col = 1; col <= cellCount; col++) {
            const cell = row.getCell(col);
            const val = cell.value;
            if (val === null || val === undefined) {
              rowValues.push('');
            } else if (typeof val === 'object' && 'text' in val) {
              rowValues.push(String((val as any).text || '').trim());
            } else if (typeof val === 'object' && 'result' in val) {
              rowValues.push(String((val as any).result || '').trim());
            } else if (val instanceof Date) {
              rowValues.push(val.toISOString().split('T')[0]);
            } else {
              rowValues.push(String(val).trim());
            }
          }
          if (rowValues.some(v => v !== '')) {
            rawRows.push(rowValues);
          }
        });
      } else {
        // CSV Parsing
        const text = await file.text();
        const cleanText = text.replace(/^\uFEFF/, '');

        const sample = cleanText.slice(0, 2048);
        const commas = (sample.match(/,/g) || []).length;
        const semicolons = (sample.match(/;/g) || []).length;
        const tabs = (sample.match(/\t/g) || []).length;
        let delimiter = ',';
        if (semicolons > commas && semicolons > tabs) delimiter = ';';
        else if (tabs > commas && tabs > semicolons) delimiter = '\t';

        const parseCsv = (txt: string, delim: string): string[][] => {
          const rows: string[][] = [];
          let currentRow: string[] = [];
          let currentCell = '';
          let inQuotes = false;
          for (let i = 0; i < txt.length; i++) {
            const char = txt[i];
            if (char === '"') {
              if (inQuotes && txt[i + 1] === '"') {
                currentCell += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === delim && !inQuotes) {
              currentRow.push(currentCell.trim());
              currentCell = '';
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
              if (char === '\r' && txt[i + 1] === '\n') i++;
              currentRow.push(currentCell.trim());
              if (currentRow.some(c => c !== '')) rows.push(currentRow);
              currentRow = [];
              currentCell = '';
            } else {
              currentCell += char;
            }
          }
          if (currentCell || currentRow.length > 0) {
            currentRow.push(currentCell.trim());
            if (currentRow.some(c => c !== '')) rows.push(currentRow);
          }
          return rows;
        };

        rawRows = parseCsv(cleanText, delimiter);
      }

      if (rawRows.length < 2) {
        showToast(isRtl ? 'ملف الإكسيل فارغ أو لا يحتوي على صفوف بيانات' : 'File is empty or contains no data rows', 'error');
        return;
      }

      // Normalization preserves Arabic characters and English alphanumeric
      const headers = rawRows[0].map(h =>
        String(h || '')
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9_\u0600-\u06FF]/g, '')
      );

      const findHeaderIdx = (aliases: string[]) => {
        const normalizedAliases = aliases.map(a => a.toLowerCase().replace(/[^a-z0-9_\u0600-\u06FF]/g, ''));
        return headers.findIndex(h => normalizedAliases.includes(h));
      };

      const codeIdx = findHeaderIdx(['code', 'empcode', 'employeecode', 'كود', 'كودالموظف', 'رقمالموظف']);
      const nameIdx = findHeaderIdx(['fullname', 'name', 'full_name', 'الاسم', 'اسمالموظف', 'الاسمبالكامل', 'الاسم_الكامل']);
      const catIdx = findHeaderIdx(['category', 'staffcategory', 'الفئة', 'فئة', 'نوعالموظف', 'الوظيفة']);
      const companyIdx = findHeaderIdx(['company', 'companyname', 'الشركة', 'اسمالشركة']);
      const crIdx = findHeaderIdx(['cr', 'crnumber', 'السجلالتجاري', 'السجل', 'رقمالسجل']);
      const cprIdx = findHeaderIdx(['cprnumber', 'cpr', 'cpr_number', 'expatcpr', 'الرقمالشخصي', 'الرقم_الشخصي', 'البطاقةالذكية']);
      const passportIdx = findHeaderIdx(['expatpp', 'passport', 'passportnumber', 'جوازالسفر', 'رقمالجواز', 'الجواز']);
      const ppExpiryIdx = findHeaderIdx(['ppexpiry', 'ppexpirydate', 'passportexpiry', 'passportexpirydate', 'انتهاءالجواز', 'تاريخانتهاءالجواز', 'صلاحيةالجواز']);
      const genderIdx = findHeaderIdx(['gender', 'الجنس', 'النوع']);
      const visaTypeIdx = findHeaderIdx(['visatype', 'visa', 'نوعالتأشيرة', 'نوعالاقامة', 'نوعالإقامة', 'الإقامة', 'الكفالة']);
      const wpExpiryIdx = findHeaderIdx(['wpexpiry', 'wpexpirydate', 'visaexpiry', 'visaexpirydate', 'انتهاءالاقامة', 'انتهاءالإقامة', 'تاريخانتهاءالإقامة', 'انتهاءتصريحالعمل']);
      const nationalityIdx = findHeaderIdx(['nationality', 'الجنسية', 'جنسية']);
      const ibanIdx = findHeaderIdx(['iban', 'ibanaccount', 'الحسابالبنكي', 'الايبان', 'الآيبان']);

      const basicSalaryIdx = findHeaderIdx(['basicsalary', 'basic', 'الراتبالأساسي', 'الراتبالاساسي', 'اساسي']);
      const housingIdx = findHeaderIdx(['housing', 'housingallowance', 'بدلالسكن', 'بدلاكسكن', 'سكن']);
      const transportIdx = findHeaderIdx(['transportation', 'transport', 'transportallowance', 'بدلمواصلات', 'بدلالمواصلات', 'مواصلات']);
      const respBonusIdx = findHeaderIdx(['jobresponsibilitybonus', 'responsibilitybonus', 'retentionbonus', 'مكافأةالمسؤولية', 'بدلمسؤولية']);
      const shiftIncentiveIdx = findHeaderIdx(['longshiftincentive', 'shiftincentive', 'حافزالبصمة', 'حافزالوردية']);

      const gosiIdx = findHeaderIdx(['1gosi', 'gosi1pct', 'gosi', 'تأمينات', 'تأمين']);
      const ewaIdx = findHeaderIdx(['ewafees', 'ewa', 'كهرباء', 'كهرباءوماء']);
      const othersDedIdx = findHeaderIdx(['othersdeduction', 'othersded', 'استقطاعاتأخرى', 'خصوماتأخرى']);
      const loanIdx = findHeaderIdx(['payrolldedloan', 'payrollded', 'loan', 'قرض', 'سلفة', 'سلف']);

      const phoneIdx = findHeaderIdx(['phone', 'phonenumber', 'mobile', 'الهاتف', 'رقمالهاتف', 'الجوال']);
      const emailIdx = findHeaderIdx(['email', 'البريد', 'البريدالإلكتروني']);
      const statusIdx = findHeaderIdx(['status', 'الحالة', 'حالة']);
      const notesIdx = findHeaderIdx(['notes', 'ملاحظات', 'ملاحظة']);
      const vehiclesIdx = findHeaderIdx(['assignedvehicles', 'vehicles', 'fleet', 'motorcycles', 'موتسيكلات', 'مركبات', 'اسطول']);
      const branchesIdx = findHeaderIdx(['assignedbranches', 'branches', 'الفروع', 'الفروعالمسندة', 'فروع']);

      const parseAmount = (val: any): number | undefined => {
        if (val === undefined || val === null || val === '') return undefined;
        const clean = String(val).replace(/[^0-9.-]/g, '');
        const num = parseFloat(clean);
        return isNaN(num) ? undefined : num;
      };

      const dataRows = rawRows.slice(1);
      let updatedCount = 0;
      let addedCount = 0;

      const existingList = await workforceService.getAllEmployees();

      for (const row of dataRows) {
        const rawCode = codeIdx !== -1 ? (row[codeIdx] || '').trim() : (row[0] || '').trim();
        const rawName = nameIdx !== -1 ? (row[nameIdx] || '').trim() : (row[1] || '').trim();
        const rawCat = catIdx !== -1 ? (row[catIdx] || '').trim() : (row[2] || '').trim();
        const rawCompany = companyIdx !== -1 ? (row[companyIdx] || '').trim() : '';
        const rawCr = crIdx !== -1 ? (row[crIdx] || '').trim() : '';
        const rawCpr = cprIdx !== -1 ? (row[cprIdx] || '').trim() : '';
        const rawPassport = passportIdx !== -1 ? (row[passportIdx] || '').trim() : '';
        const rawPpExpiry = ppExpiryIdx !== -1 ? (row[ppExpiryIdx] || '').trim() : '';
        const rawGender = genderIdx !== -1 ? (row[genderIdx] || '').trim() : '';
        const rawVisa = visaTypeIdx !== -1 ? (row[visaTypeIdx] || '').trim() : '';
        const rawWpExpiry = wpExpiryIdx !== -1 ? (row[wpExpiryIdx] || '').trim() : '';
        const rawNationality = nationalityIdx !== -1 ? (row[nationalityIdx] || '').trim() : '';
        const rawIban = ibanIdx !== -1 ? (row[ibanIdx] || '').trim() : '';

        const rawPhone = phoneIdx !== -1 ? (row[phoneIdx] || '').trim() : '';
        const rawEmail = emailIdx !== -1 ? (row[emailIdx] || '').trim() : '';
        const rawStatus = statusIdx !== -1 ? (row[statusIdx] || '').trim() : '';
        const rawNotes = notesIdx !== -1 ? (row[notesIdx] || '').trim() : '';
        const rawVehicles = vehiclesIdx !== -1 ? (row[vehiclesIdx] || '').trim() : '';
        const rawBranches = branchesIdx !== -1 ? (row[branchesIdx] || '').trim() : '';

        if (!rawName && !rawCode) continue;

        let category: StaffCategory = 'Worker';
        const catLower = rawCat.toLowerCase();
        if (catLower.includes('pharm') || catLower.includes('صيدل') || catLower === 'e') category = 'Pharmacist';
        else if (catLower.includes('driv') || catLower.includes('سائق') || catLower === 'd') category = 'Driver';
        else if (catLower.includes('manag') || catLower.includes('إدار') || catLower.includes('انشائ') || catLower === 'm') category = 'Management';

        let status: StaffStatus = 'Active';
        const statusLower = rawStatus.toLowerCase();
        if (statusLower.includes('leave') || statusLower.includes('إجازة') || statusLower.includes('اجازة')) status = 'OnLeave';
        else if (statusLower.includes('inact') || statusLower.includes('غير') || statusLower.includes('موقوف')) status = 'Inactive';

        let gender: 'Male' | 'Female' | undefined = undefined;
        if (rawGender) {
          const gLower = rawGender.toLowerCase();
          if (gLower.includes('fem') || gLower.includes('أنث') || gLower.includes('انث') || gLower === 'f') gender = 'Female';
          else if (gLower.includes('male') || gLower.includes('ذكر') || gLower.includes('رجل') || gLower === 'm') gender = 'Male';
        }

        let visaType: 'Internal' | 'Flexi' | undefined = undefined;
        if (rawVisa) {
          const vLower = rawVisa.toLowerCase();
          if (vLower.includes('flex') || vLower.includes('فليكس') || vLower.includes('فلِكس')) visaType = 'Flexi';
          else if (vLower.includes('inter') || vLower.includes('داخل') || vLower.includes('كفال')) visaType = 'Internal';
        }

        const nationality = rawNationality || undefined;

        const parsedVehicles = rawVehicles
          ? rawVehicles.split(/[;,]/).map(v => v.trim().toUpperCase()).filter(Boolean)
          : undefined;

        // Parse branch assignments
        const parsedBranches: EmployeeBranchAssignment[] = [];
        if (rawBranches) {
          const branchTokens = rawBranches.split(/[;,]/).map(t => t.trim()).filter(Boolean);
          branchTokens.forEach((token, idx) => {
            const isPrimary = token.toLowerCase().includes('primary') || token.includes('رئيسي') || idx === 0;
            const cleanToken = token.replace(/\(primary\)/gi, '').replace(/\(رئيسي\)/gi, '').replace(/\(الرئيسي\)/gi, '').trim();

            const matchedBranch = branches.find(b =>
              (b.name && b.name.toLowerCase().trim() === cleanToken.toLowerCase()) ||
              (b.name && b.name.toLowerCase().includes(cleanToken.toLowerCase())) ||
              (b.code && b.code.toUpperCase() === cleanToken.toUpperCase()) ||
              (b.id && b.id.toUpperCase() === cleanToken.toUpperCase())
            ) || grid20Branches.find(b =>
              (b.name && b.name.toLowerCase().includes(cleanToken.toLowerCase())) ||
              (b.code && b.code.toUpperCase() === cleanToken.toUpperCase())
            );

            const branchId = matchedBranch?.id || matchedBranch?.code || cleanToken;
            const branchName = matchedBranch?.name || cleanToken;
            const lat = matchedBranch?.lat ? Number(matchedBranch.lat) : 26.2285;
            const lng = matchedBranch?.lng ? Number(matchedBranch.lng) : 50.5860;

            parsedBranches.push({
              branch_id: branchId,
              branch_name: branchName,
              lat,
              lng,
              geofence_radius_meters: 50,
              is_primary: isPrimary
            });
          });
        }

        // Salary amounts
        const bSalary = basicSalaryIdx !== -1 ? parseAmount(row[basicSalaryIdx]) : undefined;
        const hSalary = housingIdx !== -1 ? parseAmount(row[housingIdx]) : undefined;
        const tSalary = transportIdx !== -1 ? parseAmount(row[transportIdx]) : undefined;
        const rBonus = respBonusIdx !== -1 ? parseAmount(row[respBonusIdx]) : undefined;
        const sIncentive = shiftIncentiveIdx !== -1 ? parseAmount(row[shiftIncentiveIdx]) : undefined;
        const gosiVal = gosiIdx !== -1 ? parseAmount(row[gosiIdx]) : undefined;
        const ewaVal = ewaIdx !== -1 ? parseAmount(row[ewaIdx]) : undefined;
        const othVal = othersDedIdx !== -1 ? parseAmount(row[othersDedIdx]) : undefined;
        const loanVal = loanIdx !== -1 ? parseAmount(row[loanIdx]) : undefined;

        // Match existing employee
        const existingEmp = existingList.find(
          e => (rawCode && e.code.toUpperCase() === rawCode.toUpperCase()) ||
               (rawCpr && e.cpr_number && e.cpr_number.trim() === rawCpr.trim()) ||
               (rawName && e.full_name.trim().toLowerCase() === rawName.trim().toLowerCase())
        );

        const currentSm = existingEmp?.salary_matrix || {};
        const newBasic = bSalary !== undefined ? bSalary : (currentSm.basicSalary || 0);
        const newHousing = hSalary !== undefined ? hSalary : (currentSm.housing || 0);
        const newTrans = tSalary !== undefined ? tSalary : (currentSm.transportation || 0);
        const newTotalFixed = newBasic + newHousing + newTrans;

        const newRespBonus = rBonus !== undefined ? rBonus : (currentSm.jobResponsibilityBonus || 0);
        const newShiftIncentive = sIncentive !== undefined ? sIncentive : (currentSm.longShiftIncentive || 0);
        const newTotalVariable = newRespBonus + newShiftIncentive;

        const newGosi = gosiVal !== undefined ? gosiVal : (currentSm.gosi1Pct || 0);
        const newEwa = ewaVal !== undefined ? ewaVal : (currentSm.ewaFees || 0);
        const newOth = othVal !== undefined ? othVal : (currentSm.othersDeduction || 0);
        const newLoan = loanVal !== undefined ? loanVal : (currentSm.payrollDedLoan || 0);
        const newTotalDeductions = newGosi + newEwa + newOth + newLoan;

        const newTotalSalary = newTotalFixed + newTotalVariable;
        const newNetSalary = newTotalSalary - newTotalDeductions;

        const salaryMatrixToSave = {
          company: rawCompany || currentSm.company,
          cr: rawCr || currentSm.cr,
          expatCpr: rawCpr || currentSm.expatCpr,
          expatPp: rawPassport || currentSm.expatPp,
          expatPpExpiryDate: rawPpExpiry || currentSm.expatPpExpiryDate,
          ppExpiryDate: rawPpExpiry || currentSm.ppExpiryDate,
          wpExpiryDate: rawWpExpiry || currentSm.wpExpiryDate,
          visaExpiryDate: rawWpExpiry || currentSm.visaExpiryDate,
          gender: gender !== undefined ? gender : (currentSm.gender || existingEmp?.gender),
          visaType: visaType !== undefined ? visaType : (currentSm.visaType || existingEmp?.visa_type),
          nationality: nationality || currentSm.nationality || existingEmp?.nationality,
          iban: rawIban || currentSm.iban,
          totalSalary: newTotalSalary,
          basicSalary: newBasic,
          housing: newHousing,
          transportation: newTrans,
          totalFixed: newTotalFixed,
          jobResponsibilityBonus: newRespBonus,
          longShiftIncentive: newShiftIncentive,
          totalVariable: newTotalVariable,
          gosi1Pct: newGosi,
          ewaFees: newEwa,
          othersDeduction: newOth,
          payrollDedLoan: newLoan,
          totalDeductions: newTotalDeductions,
          netSalary: newNetSalary
        };

        if (existingEmp) {
          const finalAssignments = parsedBranches.length > 0 ? parsedBranches : (existingEmp.assignments || []);
          await workforceService.saveEmployee(
            {
              id: existingEmp.id,
              code: rawCode ? rawCode.toUpperCase() : existingEmp.code,
              full_name: rawName || existingEmp.full_name,
              category,
              cpr_number: rawCpr || existingEmp.cpr_number,
              passport_number: rawPassport || existingEmp.passport_number,
              passport_expiry_date: rawPpExpiry || existingEmp.passport_expiry_date,
              wp_expiry_date: rawWpExpiry || existingEmp.wp_expiry_date,
              phone: rawPhone || existingEmp.phone,
              email: rawEmail || existingEmp.email,
              gender: gender !== undefined ? gender : existingEmp.gender,
              visa_type: visaType !== undefined ? visaType : existingEmp.visa_type,
              nationality: nationality || existingEmp.nationality,
              status,
              notes: rawNotes || existingEmp.notes,
              driver_id: existingEmp.driver_id,
              pharmacist_id: existingEmp.pharmacist_id,
              assigned_vehicles: parsedVehicles !== undefined ? parsedVehicles : (existingEmp.assigned_vehicles || []),
              salary_matrix: salaryMatrixToSave
            },
            finalAssignments
          );
          updatedCount++;
        } else {
          const nextCode = rawCode ? rawCode.toUpperCase() : workforceService.generateNextCode(category, existingList);
          await workforceService.saveEmployee(
            {
              code: nextCode,
              full_name: rawName,
              category,
              cpr_number: rawCpr || undefined,
              passport_number: rawPassport || undefined,
              passport_expiry_date: rawPpExpiry || undefined,
              wp_expiry_date: rawWpExpiry || undefined,
              phone: rawPhone || undefined,
              email: rawEmail || undefined,
              gender: gender || 'Male',
              visa_type: visaType || 'Internal',
              nationality: nationality || undefined,
              status,
              notes: rawNotes || undefined,
              assigned_vehicles: parsedVehicles || [],
              salary_matrix: salaryMatrixToSave
            },
            parsedBranches
          );
          addedCount++;
        }
      }

      showToast(
        isRtl
          ? `تم الاستيراد بنجاح: ${updatedCount} تعديل، ${addedCount} إضافة جديدة`
          : `Import completed: ${updatedCount} updated, ${addedCount} added`,
        'success'
      );
      await onComplete();
    } catch (err: any) {
      console.error('Import error:', err);
      showToast(
        isRtl ? `حدث خطأ أثناء قراءة ملف الإكسيل: ${err.message || ''}` : `Error importing Excel file: ${err.message || ''}`,
        'error'
      );
    }
  };

