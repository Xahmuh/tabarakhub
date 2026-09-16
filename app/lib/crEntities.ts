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

import { INITIAL_21_CRS, LOCAL_STORAGE_CR_KEY } from '../../services/crService';

export const getAdminRegisteredCrs = (): RegisteredCr[] => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_CR_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => {
            let en = item.cr_name || '';
            let ar = item.cr_name_ar || '';
            if (en.startsWith('{')) {
              try {
                const p = JSON.parse(en);
                en = p.en || en;
                ar = p.ar || ar;
              } catch {}
            }
            const matched = INITIAL_21_CRS.find(c => c.cr_number === item.cr_number || c.id === item.id);
            if (!ar && matched) {
              ar = matched.cr_name_ar || '';
            }

            return {
              ...item,
              cr_name: en,
              cr_name_ar: ar,
              expiry_date: item.expiry_date || matched?.expiry_date || undefined,
              nhra_license_no: item.nhra_license_no || matched?.nhra_license_no || undefined,
              nhra_expiry_date: item.nhra_expiry_date || matched?.nhra_expiry_date || undefined,
              logo_url: item.logo_url || DEFAULT_GROUP_LOGO,
              signature_url: item.signature_url || DEFAULT_SIGNATURE,
              stamp_url: (item.stamp_url && !item.stamp_url.includes('APPROVED'))
                ? item.stamp_url
                : generateCrStampSvg(ar, en, item.cr_number),
              address_en: item.address_en || 'Kingdom of Bahrain',
              address_ar: item.address_ar || 'مملكة البحرين',
              phone: item.phone || '+973 33866650',
              email: item.email || 'tabarakph.info@gmail.com'
            };
          });
        }
      }
    } catch (e) {}
  }

  return INITIAL_21_CRS.map(c => ({
    ...c,
    cr_name_ar: c.cr_name_ar || '',
    logo_url: c.logo_url || DEFAULT_GROUP_LOGO,
    signature_url: c.signature_url || DEFAULT_SIGNATURE,
    stamp_url: c.stamp_url || generateCrStampSvg(c.cr_name_ar, c.cr_name, c.cr_number)
  }));
};

