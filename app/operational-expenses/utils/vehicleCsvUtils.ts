export interface ParsedVehicleCsvRow {
  rowNumber: number;
  plateNumber: string;
  vehicleCode: string;
  vehicleType: string;
  ownershipType: 'Internal' | 'External';
  crNumber: string;
  registrationExpiryDate: string;
  initialOdometer: number;
  assignedStaffCodes: string[];
  isValid: boolean;
  error?: string;
}

const stripBom = (val: string) => val.replace(/^\uFEFF/, '');

export const downloadVehicleCsvTemplate = () => {
  const headers = [
    'Plate Number',
    'Vehicle Code',
    'Type',
    'Ownership',
    'CR No.',
    'Reg. Expiry',
    'Initial Odometer',
    'Assigned Staff Codes'
  ];
  const sampleRows = [
    ['123456', 'V-001', 'Motorcycle', 'Internal', '102030-1', '12/31/2026', '0', 'D001, D002'],
    ['654321', 'V-002', 'Car', 'External', '203040-2', '06/30/2027', '15000', 'W003']
  ];

  const csvContent = [
    headers.join(','),
    ...sampleRows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'vehicle_fleet_import_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportVehiclesToCsv = (vehicles: any[], getLinkedEmployeesFn?: (v: any) => any[]) => {
  const headers = [
    'Plate Number',
    'Vehicle Code',
    'Type',
    'Ownership',
    'CR No.',
    'Reg. Expiry',
    'Initial Odometer',
    'Status',
    'Assigned Staff Codes',
    'Assigned Staff Name'
  ];

  const rows = vehicles.map(v => {
    const linked = getLinkedEmployeesFn ? getLinkedEmployeesFn(v) : [];
    const staffCodesStr = linked.map(emp => emp.code).join(', ');
    const staffNamesStr = linked.map(emp => emp.full_name || emp.name || '').filter(Boolean).join(', ');

    return [
      v.plateNumber || '',
      v.vehicleCode || '',
      v.vehicleType || 'Motorcycle',
      v.ownershipType === 'External' ? 'External' : 'Internal',
      v.crNumber || '',
      v.registrationExpiryDate || '',
      String(v.initialOdometer || 0),
      v.status || 'Active',
      staffCodesStr,
      staffNamesStr
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `fleet_vehicles_export_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const detectDelimiter = (text: string): ',' | ';' | '\t' => {
  const sample = text.slice(0, 2048);
  const commas = (sample.match(/,/g) || []).length;
  const semicolons = (sample.match(/;/g) || []).length;
  const tabs = (sample.match(/\t/g) || []).length;
  if (semicolons > commas && semicolons > tabs) return ';';
  if (tabs > commas && tabs > semicolons) return '\t';
  return ',';
};

const parseCsvLines = (text: string, delimiter: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i++;
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

const cleanHeader = (str: string) => str.toLowerCase().trim().replace(/[^\w\u0600-\u06FF]/g, '');

const normalizeDateStr = (dateStr: string): string => {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // YYYY/MM/DD or YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YYYY or MM/DD/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const [, n1, n2, year] = dmyMatch;
    const p1 = parseInt(n1, 10);
    const p2 = parseInt(n2, 10);

    let day = p1;
    let month = p2;

    if (p1 > 12) {
      // n1 is day (e.g. 30/09/2026)
      day = p1;
      month = p2;
    } else if (p2 > 12) {
      // n2 is day (e.g. 09/30/2026)
      day = p2;
      month = p1;
    } else {
      // Default to DD/MM/YYYY
      day = p1;
      month = p2;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return trimmed;
};

const parseOwnershipType = (val: string): 'Internal' | 'External' => {
  if (!val) return 'Internal';
  const v = val.toLowerCase().trim();
  if (
    v.includes('ext') ||
    v.includes('flex') ||
    v.includes('خارج') ||
    v.includes('فلب') ||
    v.includes('درايف') ||
    v.includes('سائق') ||
    v.includes('أجر') ||
    v.includes('إيجار') ||
    v.includes('ايجار') ||
    v.includes('مؤجر')
  ) {
    return 'External';
  }
  return 'Internal';
};

const parseOdometerVal = (val: string): number => {
  if (!val) return 0;
  const digitsOnly = val.replace(/,/g, '').replace(/[^\d.]/g, '');
  if (!digitsOnly) return 0;
  const num = Number(digitsOnly);
  return isNaN(num) ? 0 : num;
};

export const parseVehicleCsv = (fileText: string): ParsedVehicleCsvRow[] => {
  const cleanText = stripBom(fileText);
  const delimiter = detectDelimiter(cleanText);
  const rawRows = parseCsvLines(cleanText, delimiter);

  if (rawRows.length === 0) return [];

  const rawHeaders = rawRows[0];
  const cleanedHeaders = rawHeaders.map(cleanHeader);
  const dataRows = rawRows.slice(1);

  const findHeaderIdx = (aliases: string[]): number => {
    for (const alias of aliases) {
      const cleanedAlias = cleanHeader(alias);
      if (!cleanedAlias) continue;
      const idx = cleanedHeaders.findIndex(h => h.includes(cleanedAlias));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const plateIdx = findHeaderIdx(['plate_number', 'platenumber', 'plate_no', 'plate', 'plateno', 'رقم_اللوحة', 'اللوحة', 'لوحة', 'رقملوحة']);
  const codeIdx = findHeaderIdx(['vehicle_code', 'vehiclecode', 'vehicle_id', 'code', 'كود_المركبة', 'كودمركبة', 'كود', 'رمز']);
  const typeIdx = findHeaderIdx(['vehicle_type', 'vehicletype', 'type', 'نوع_المركبة', 'نوعمركبة', 'النوع', 'نوع']);
  const ownIdx = findHeaderIdx(['ownership_type', 'ownershiptype', 'ownership', 'الملكية', 'نوع_الملكية', 'نوعملكية', 'ملكية', 'مالك', 'عائدية']);
  const crIdx = findHeaderIdx(['cr_number', 'crnumber', 'cr_no', 'crno', 'cr', 'السجل_التجاري', 'رقم_السجل', 'السجل', 'سجل']);
  const expiryIdx = findHeaderIdx(['registration_expiry_date', 'registrationexpirydate', 'expiry_date', 'expirydate', 'reg_expiry', 'regexpiry', 'expiry', 'تاريخ_الانتهاء', 'انتهاء', 'انتهاء_التسجيل', 'تاريخ_التسجيل', 'التسجيل']);
  const odoIdx = findHeaderIdx(['initial_odometer', 'initialodometer', 'initial_odo', 'initialodo', 'odometer', 'odo', 'العداد_الأولي', 'العدادالأولي', 'العداد', 'عداد', 'قراءة_العداد']);
  const staffIdx = findHeaderIdx(['assigned_staff_codes', 'assigned_staff', 'driver_codes', 'assigned_vehicles', 'driver_code', 'drivers', 'assigned_drivers', 'كود_الموظف', 'السائقين', 'الموصلين', 'الموظفين', 'المسندين', 'موظفين']);

  return dataRows.map((row, idx) => {
    const rowNumber = idx + 2;

    const plateNumber = plateIdx !== -1 ? (row[plateIdx] || '') : (row[0] || '');
    const vehicleCode = codeIdx !== -1 ? (row[codeIdx] || '') : (row[1] || '');
    const rawType = typeIdx !== -1 ? (row[typeIdx] || '') : (row[2] || '');
    const rawOwn = ownIdx !== -1 ? (row[ownIdx] || '') : (row[3] || '');
    const crNumber = crIdx !== -1 ? (row[crIdx] || '') : (row[4] || '');
    const rawExpiry = expiryIdx !== -1 ? (row[expiryIdx] || '') : (row[5] || '');
    const rawOdo = odoIdx !== -1 ? (row[odoIdx] || '') : (row[6] || '');
    const rawStaff = staffIdx !== -1 ? (row[staffIdx] || '') : (row[7] || '');

    let vehicleType = 'Motorcycle';
    const rawT = rawType.toLowerCase();
    if (rawT.includes('car') || rawT.includes('سيارة')) {
      vehicleType = 'Car';
    } else if (rawT.includes('truck') || rawT.includes('شاحنة')) {
      vehicleType = 'Truck';
    } else if (rawT.includes('van') || rawT.includes('فان')) {
      vehicleType = 'Van';
    } else if (rawT.includes('bus') || rawT.includes('حافلة')) {
      vehicleType = 'Bus';
    }

    const ownershipType = parseOwnershipType(rawOwn);
    const registrationExpiryDate = normalizeDateStr(rawExpiry);
    const initialOdometer = parseOdometerVal(rawOdo);

    const assignedStaffCodes = rawStaff
      ? rawStaff.split(/[,;\/]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
      : [];

    let isValid = true;
    let error: string | undefined;

    if (!plateNumber && !vehicleCode) {
      isValid = false;
      error = 'Plate number or vehicle code is required';
    }

    return {
      rowNumber,
      plateNumber,
      vehicleCode,
      vehicleType,
      ownershipType,
      crNumber,
      registrationExpiryDate,
      initialOdometer,
      assignedStaffCodes,
      isValid,
      error
    };
  });
};
