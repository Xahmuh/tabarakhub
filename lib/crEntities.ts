export interface RegisteredCr {
  id: string;
  cr_name: string;
  cr_name_ar: string;
  cr_number: string;
  is_master?: boolean;
  parent_cr_number?: string;
  tax_number?: string;
  expiry_date?: string;
  nhra_license_no?: string;
  nhra_expiry_date?: string;
  linked_branch_id?: string;
  linked_branch_name?: string;
  address_en?: string;
  address_ar?: string;
  phone?: string;
  email?: string;
  logo_url: string;
  signature_url: string;
  stamp_url: string;
}

export const DEFAULT_GROUP_LOGO = '/logo.jpg';
export const DEFAULT_SIGNATURE = '/sign.jpg';

export const generateCrStampSvg = (crNameAr?: string, crNameEn?: string, crNumber?: string): string => {
  const arName = (crNameAr || 'مجموعة صيدليات تبارك ذ.م.م').trim();
  const enName = (crNameEn || 'TABARAK PHARMACY GROUP WLL').trim().toUpperCase();
  const crNum = (crNumber || '100234-1').trim();

  const safeAr = arName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeEn = enName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeCr = crNum.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 240" fill="none">
    <rect x="6" y="6" width="488" height="228" rx="2" stroke="#1d2a6b" stroke-width="6" fill="none"/>
    <rect x="16" y="16" width="468" height="208" rx="1" stroke="#1d2a6b" stroke-width="3" fill="none"/>
    <text x="250" y="82" font-family="Arial, sans-serif" font-size="34" font-weight="bold" text-anchor="middle" fill="#1d2a6b">${safeAr}</text>
    <text x="250" y="142" font-family="Arial, sans-serif" font-size="25" font-weight="bold" text-anchor="middle" fill="#1d2a6b">${safeEn}</text>
    <text x="250" y="194" font-family="Arial, sans-serif" font-size="28" font-weight="bold" text-anchor="middle" fill="#1d2a6b">CR ${safeCr}</text>
  </svg>`;

  try {
    if (typeof btoa !== 'undefined') {
      const b64 = btoa(unescape(encodeURIComponent(svg)));
      return `data:image/svg+xml;base64,${b64}`;
    }
  } catch (e) {}

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const DEFAULT_STAMP = generateCrStampSvg('شركة صيدلية تبارك ذ.م.م', 'Tabarak Pharmacy CO W.L.L', '127506-01');

export const getAdminRegisteredCrs = (): any[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('tabarak_registered_crs');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) => ({
          ...item,
          signature_url: DEFAULT_SIGNATURE,
          stamp_url: (item.stamp_url && !item.stamp_url.includes('APPROVED'))
            ? item.stamp_url
            : generateCrStampSvg(item.cr_name_ar, item.cr_name, item.cr_number)
        }));
      }
    }
  } catch (e) {}
  return [
    // 1. Tabarak Pharmacy CO W.L.L
    {
      id: 'cr-1',
      cr_name: 'Tabarak Pharmacy CO W.L.L',
      cr_name_ar: 'شركة صيدلية تبارك ذ.م.م',
      cr_number: '127506-01',
      is_master: true,
      tax_number: '3000987654321',
      logo_url: '/logo.jpg',
      signature_url: DEFAULT_SIGNATURE,
      stamp_url: generateCrStampSvg('شركة صيدلية تبارك ذ.م.م', 'Tabarak Pharmacy CO W.L.L', '127506-01')
    },
    {
      id: 'cr-1-2',
      cr_name: 'Tabarak Pharmacy - Main Branch',
      cr_name_ar: 'صيدلية تبارك - الفرع الرئيسي ذ.م.م',
      cr_number: '127506-02',
      is_master: false,
      parent_cr_number: '127506-01',
      logo_url: '/logo.jpg',
      signature_url: DEFAULT_SIGNATURE,
      stamp_url: generateCrStampSvg('صيدلية تبارك - الفرع الرئيسي ذ.م.م', 'Tabarak Pharmacy - Main Branch', '127506-02')
    },
    // 2. Alhoda Pharmacy WLL
    {
      id: 'cr-2',
      cr_name: 'Alhoda Pharmacy WLL',
      cr_name_ar: 'صيدلية الهدى ذ.م.م',
      cr_number: '106723-01',
      is_master: true,
      tax_number: '3000987654322',
      logo_url: '/logo.jpg',
      signature_url: DEFAULT_SIGNATURE,
      stamp_url: generateCrStampSvg('صيدلية الهدى ذ.م.م', 'Alhoda Pharmacy WLL', '106723-01')
    },
    {
      id: 'cr-2-2',
      cr_name: 'Al Nahar Pharmacy W.L.L',
      cr_name_ar: 'صيدلية النهار ذ.م.م',
      cr_number: '106723-02',
      is_master: false,
      parent_cr_number: '106723-01',
      logo_url: '/logo.jpg',
      signature_url: DEFAULT_SIGNATURE,
      stamp_url: generateCrStampSvg('صيدلية النهار ذ.م.م', 'Al Nahar Pharmacy W.L.L', '106723-02')
    },
    // 3. Sanad Pharmacy WLL
    {
      id: 'cr-3',
      cr_name: 'Sanad Pharmacy WLL',
      cr_name_ar: 'صيدلية سند ذ.م.م',
      cr_number: '145842-01',
      is_master: true,
      tax_number: '3000987654323',
      logo_url: '/logo.jpg',
      signature_url: DEFAULT_SIGNATURE,
      stamp_url: generateCrStampSvg('صيدلية سند ذ.م.م', 'Sanad Pharmacy WLL', '145842-01')
    },
    {
      id: 'cr-3-2',
      cr_name: 'Jamila Pharmacy W.L.L',
      cr_name_ar: 'صيدلية جميلة ذ.م.م',
      cr_number: '145842-02',
      is_master: false,
      parent_cr_number: '145842-01',
      logo_url: '/logo.jpg',
      signature_url: DEFAULT_SIGNATURE,
      stamp_url: generateCrStampSvg('صيدلية جميلة ذ.م.م', 'Jamila Pharmacy W.L.L', '145842-02')
    },
    {
      id: 'cr-3-3',
      cr_name: 'Janabiya Pharmacy W.L.L',
      cr_name_ar: 'صيدلية الجنبية ذ.م.م',
      cr_number: '145842-03',
      is_master: false,
      parent_cr_number: '145842-01',
      logo_url: '/logo.jpg',
      signature_url: DEFAULT_SIGNATURE,
      stamp_url: generateCrStampSvg('صيدلية الجنبية ذ.م.م', 'Janabiya Pharmacy W.L.L', '145842-03')
    },
    {
      id: 'cr-3-4',
      cr_name: 'Sanad Pharmacy 2 W.L.L',
      cr_name_ar: 'صيدلية سند 2 ذ.م.م',
      cr_number: '145842-04',
      is_master: false,
      parent_cr_number: '145842-01',
      logo_url: '/logo.jpg',
      signature_url: DEFAULT_SIGNATURE,
      stamp_url: generateCrStampSvg('صيدلية سند 2 ذ.م.م', 'Sanad Pharmacy 2 W.L.L', '145842-04')
    },
    // 4. Damistan Pharmacy WLL
    {
      id: 'cr-4',
      cr_name: 'Damistan Pharmacy WLL',
      cr_name_ar: 'صيدلية دمستان ذ.م.م',
      cr_number: '172593-01',
      is_master: true,
      tax_number: '3000987654324',
      logo_url: '/logo.jpg',
      signature_url: DEFAULT_SIGNATURE,
      stamp_url: generateCrStampSvg('صيدلية دمستان ذ.م.م', 'Damistan Pharmacy WLL', '172593-01')
    },
    {
      id: 'cr-4-2',
      cr_name: 'District Pharmacy W.L.L',
      cr_name_ar: 'صيدلية الدستركت ذ.م.م',
      cr_number: '172593-02',
      is_master: false,
      parent_cr_number: '172593-01',
      logo_url: '/logo.jpg',
      signature_url: DEFAULT_SIGNATURE,
      stamp_url: generateCrStampSvg('صيدلية الدستركت ذ.م.م', 'District Pharmacy W.L.L', '172593-02')
    }
  ];
};

