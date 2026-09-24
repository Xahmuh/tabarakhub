import {
  RegisteredCr,
  DEFAULT_GROUP_LOGO,
  DEFAULT_SIGNATURE,
  generateCrStampSvg,
  DEFAULT_STAMP
} from '../../lib/crEntities';

export {
  type RegisteredCr,
  DEFAULT_GROUP_LOGO,
  DEFAULT_SIGNATURE,
  generateCrStampSvg,
  DEFAULT_STAMP
};

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

