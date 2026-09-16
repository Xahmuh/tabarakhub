import { supabaseClient } from '../lib/supabaseClient';
import { generateCrStampSvg, DEFAULT_GROUP_LOGO, DEFAULT_SIGNATURE } from '../app/lib/crEntities';

export interface RegisteredCr {
  id: string;
  cr_name: string; // Official English Name (يظهر في الترويسة بالإنجليزي)
  cr_name_ar?: string; // Official Arabic Name (يظهر في الترويسة بالعربي)
  cr_number: string;
  is_master: boolean;
  parent_cr_number?: string;
  linked_branch_id?: string;
  linked_branch_name?: string;
  tax_number?: string;
  expiry_date?: string;
  nhra_license_no?: string;
  nhra_expiry_date?: string;
  address_en?: string;
  address_ar?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  signature_url?: string;
  stamp_url?: string;
  created_at?: string;
  updated_at?: string;
}

export const LOCAL_STORAGE_CR_KEY = 'tabarak_registered_crs';
export const CR_UPDATED_EVENT = 'tabarak_registered_crs_updated';

export const INITIAL_21_CRS: RegisteredCr[] = [
  // 1. Tabarak Pharmacy CO W.L.L (Master Group CR) - T001
  {
    id: 'cr-t-001',
    cr_name: 'Tabarak Pharmacy CO W.L.L',
    cr_name_ar: 'شركة صيدلية تبارك ذ.م.م',
    cr_number: '127506-01',
    is_master: true,
    linked_branch_id: '1b3b2924-ef34-4626-a77f-33227f2915ad',
    linked_branch_name: 'Tabarak Pharmacy - Jerdab (T001)',
    tax_number: '3000987654321',
    phone: '+973 38917111',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Building 102, Road 20, Block 320, Jerdab, Kingdom of Bahrain',
    address_ar: 'مبنى 102، طريق 20، مجمع 320، جرداب، مملكة البحرين',
    expiry_date: '2027-12-31',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('شركة صيدلية تبارك ذ.م.م', 'Tabarak Pharmacy CO W.L.L', '127506-01')
  },
  // 2. Tabarak Qalali Station - T002
  {
    id: 'cr-t-002',
    cr_name: 'Tabarak Pharmacy - Qalali Station',
    cr_name_ar: 'صيدلية تبارك - محطة قلالي ذ.م.م',
    cr_number: '127506-02',
    is_master: false,
    parent_cr_number: '127506-01',
    linked_branch_id: '806e481f-8264-4863-aa5c-6eddd36f7d71',
    linked_branch_name: 'Tabarak Pharmacy - Qalali Station (T002)',
    tax_number: '3000987654321',
    phone: '+973 38208666',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Qalali Petrol Station, Qalali, Kingdom of Bahrain',
    address_ar: 'محطة وقود قلالي، قلالي، مملكة البحرين',
    expiry_date: '2026-11-30',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية تبارك - محطة قلالي ذ.م.م', 'Tabarak Pharmacy - Qalali Station', '127506-02')
  },
  // 3. Tabarak Hidd Station - T003
  {
    id: 'cr-t-003',
    cr_name: 'Tabarak Pharmacy - Hidd Station',
    cr_name_ar: 'صيدلية تبارك - محطة الحد ذ.م.م',
    cr_number: '127506-03',
    is_master: false,
    parent_cr_number: '127506-01',
    linked_branch_id: '35448ef7-1b91-4d48-8ad6-73fcfe020767',
    linked_branch_name: 'Tabarak Pharmacy - Hidd Station (T003)',
    tax_number: '3000987654321',
    phone: '+973 38844554',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Hidd Petrol Station, Hidd, Kingdom of Bahrain',
    address_ar: 'محطة وقود الحد، الحد، مملكة البحرين',
    expiry_date: '2026-12-15',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية تبارك - محطة الحد ذ.م.م', 'Tabarak Pharmacy - Hidd Station', '127506-03')
  },
  // 4. Tabarak Janabiya Branch - T004
  {
    id: 'cr-t-004',
    cr_name: 'Tabarak Pharmacy - Janabiya branch',
    cr_name_ar: 'صيدلية تبارك - فرع الجنبية ذ.م.م',
    cr_number: '127506-04',
    is_master: false,
    parent_cr_number: '127506-01',
    linked_branch_id: '54c9c2cd-c11f-45e9-ae8b-17af071a9706',
    linked_branch_name: 'Tabarak Pharmacy - Janabiya branch (T004)',
    tax_number: '3000987654321',
    phone: '+973 32000735',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Janabiya Highway, Block 575, Kingdom of Bahrain',
    address_ar: 'شارع الجنبية، مجمع 575، مملكة البحرين',
    expiry_date: '2026-10-20',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية تبارك - فرع الجنبية ذ.م.م', 'Tabarak Pharmacy - Janabiya branch', '127506-04')
  },
  // 5. Tabarak West Riffa - T005
  {
    id: 'cr-t-005',
    cr_name: 'Tabarak Pharmacy - West Riffa',
    cr_name_ar: 'صيدلية تبارك - الرفاع الغربي ذ.م.م',
    cr_number: '127506-05',
    is_master: false,
    parent_cr_number: '127506-01',
    linked_branch_id: '2cb10ffc-fa88-49c9-9b72-a13089c51879',
    linked_branch_name: 'Tabarak Pharmacy - West Riffa (T005)',
    tax_number: '3000987654321',
    phone: '+973 38871711',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Riffa Avenue, Block 905, West Riffa, Kingdom of Bahrain',
    address_ar: 'شارع الرفاع، مجمع 905، الرفاع الغربي، مملكة البحرين',
    expiry_date: '2027-01-30',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية تبارك - الرفاع الغربي ذ.م.م', 'Tabarak Pharmacy - West Riffa', '127506-05')
  },
  // 6. Tabarak Juffair - T006
  {
    id: 'cr-t-006',
    cr_name: 'Tabarak Pharmacy - Juffair branch',
    cr_name_ar: 'صيدلية تبارك - فرع الجفير ذ.م.م',
    cr_number: '127506-06',
    is_master: false,
    parent_cr_number: '127506-01',
    linked_branch_id: 'eb8156ab-79e8-40da-8300-1fb08de96a46',
    linked_branch_name: 'Tabarak Pharmacy - Juffair branch (T006)',
    tax_number: '3000987654321',
    phone: '+973 66787848',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Juffair Commercial Mall, Juffair, Kingdom of Bahrain',
    address_ar: 'مجمع الجفير التجاري، الجفير، مملكة البحرين',
    expiry_date: '2027-03-15',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية تبارك - فرع الجفير ذ.م.م', 'Tabarak Pharmacy - Juffair branch', '127506-06')
  },
  // 7. Tabarak Karana - T007
  {
    id: 'cr-t-007',
    cr_name: 'Tabarak Pharmacy - Karana Branch',
    cr_name_ar: 'صيدلية تبارك - فرع كرانة ذ.م.م',
    cr_number: '127506-07',
    is_master: false,
    parent_cr_number: '127506-01',
    linked_branch_id: 'eea51a55-f441-4ca4-a70f-2851faf0820a',
    linked_branch_name: 'Tabarak Pharmacy - Karana Branch (T007)',
    tax_number: '3000987654321',
    phone: '+973 38868699',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Budaiya Highway, Karana, Kingdom of Bahrain',
    address_ar: 'شارع البديع العام، كرانة، مملكة البحرين',
    expiry_date: '2027-04-10',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية تبارك - فرع كرانة ذ.م.م', 'Tabarak Pharmacy - Karana Branch', '127506-07')
  },
  // 8. Tabarak Hidd Club - T008
  {
    id: 'cr-t-008',
    cr_name: 'Tabarak Pharmacy - Hidd Club',
    cr_name_ar: 'صيدلية تبارك - نادي الحد ذ.م.م',
    cr_number: '127506-08',
    is_master: false,
    parent_cr_number: '127506-01',
    linked_branch_id: '575225e6-4dcb-4fd0-806b-e09fc6508477',
    linked_branch_name: 'Tabarak Pharmacy - Hidd Club (T008)',
    tax_number: '3000987654321',
    phone: '+973 33700980',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Hidd Sports Club Complex, Hidd, Kingdom of Bahrain',
    address_ar: 'مجمع نادي الحد الرياضي، الحد، مملكة البحرين',
    expiry_date: '2027-05-20',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية تبارك - نادي الحد ذ.م.م', 'Tabarak Pharmacy - Hidd Club', '127506-08')
  },
  // 9. Tabarak Qalali 2 - T009
  {
    id: 'cr-t-009',
    cr_name: 'Tabarak Pharmacy - Qalali 2',
    cr_name_ar: 'صيدلية تبارك - قلالي 2 ذ.م.م',
    cr_number: '127506-09',
    is_master: false,
    parent_cr_number: '127506-01',
    linked_branch_id: 'f42e155a-685b-4789-bed7-c9d419160149',
    linked_branch_name: 'Tabarak Pharmacy - Qalali 2 (T009)',
    tax_number: '3000987654321',
    phone: '+973 37446995',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Avenue 52, Qalali, Kingdom of Bahrain',
    address_ar: 'شارع 52، قلالي، مملكة البحرين',
    expiry_date: '2027-06-15',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية تبارك - قلالي 2 ذ.م.م', 'Tabarak Pharmacy - Qalali 2', '127506-09')
  },
  // 10. Tabarak Mashtan - T010
  {
    id: 'cr-t-010',
    cr_name: 'Tabarak Pharmacy - Mashtan',
    cr_name_ar: 'صيدلية تبارك - مشتان ذ.م.م',
    cr_number: '127506-10',
    is_master: false,
    parent_cr_number: '127506-01',
    linked_branch_id: 'ac3367db-2d37-4fbd-90f8-466a331dbe43',
    linked_branch_name: 'Tabarak Pharmacy - Mashtan (T010)',
    tax_number: '3000987654321',
    phone: '+973 37446996',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Mashtan Avenue, Riffa, Kingdom of Bahrain',
    address_ar: 'شارع مشتان، الرفاع، مملكة البحرين',
    expiry_date: '2027-07-25',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية تبارك - مشتان ذ.م.م', 'Tabarak Pharmacy - Mashtan', '127506-10')
  },

  // 11. Alhoda Pharmacy - Tubli (Master Group CR) - H001
  {
    id: 'cr-h-001',
    cr_name: 'Alhoda Pharmacy WLL',
    cr_name_ar: 'صيدلية الهدى ذ.م.م',
    cr_number: '106723-01',
    is_master: true,
    linked_branch_id: 'b9ddaed5-b104-4112-8dd9-dad1e1b9b7f3',
    linked_branch_name: 'Alhoda Pharmacy - Tubli branch (H001)',
    tax_number: '3000987654322',
    phone: '+973 38918111',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Tubli Highway, Block 711, Tubli, Kingdom of Bahrain',
    address_ar: 'شارع توبلي العام، مجمع 711، توبلي، مملكة البحرين',
    expiry_date: '2027-08-30',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية الهدى ذ.م.م', 'Alhoda Pharmacy WLL', '106723-01')
  },
  // 12. Alnahar Pharmacy - Jerdab - H002
  {
    id: 'cr-h-002',
    cr_name: 'Al Nahar Pharmacy W.L.L',
    cr_name_ar: 'صيدلية النهار ذ.م.م',
    cr_number: '106723-02',
    is_master: false,
    parent_cr_number: '106723-01',
    linked_branch_id: 'b9b91ba2-09f8-4d0e-b271-c5ca37472629',
    linked_branch_name: 'Alnahar Pharmacy - Jerdab branch (H002)',
    tax_number: '3000987654322',
    phone: '+973 38239111',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Road 411, Jerdab, Kingdom of Bahrain',
    address_ar: 'طريق 411، جرداب، مملكة البحرين',
    expiry_date: '2026-11-20',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية النهار ذ.م.م', 'Al Nahar Pharmacy W.L.L', '106723-02')
  },
  // 13. Alhoda Pharmacy - Isa Town - H003
  {
    id: 'cr-h-003',
    cr_name: 'Alhoda Pharmacy - Isa Town',
    cr_name_ar: 'صيدلية الهدى - مدينة عيسى ذ.م.م',
    cr_number: '106723-03',
    is_master: false,
    parent_cr_number: '106723-01',
    linked_branch_id: '2b062ff8-aa8a-4d75-8cc1-e609c65ab161',
    linked_branch_name: 'Alhoda Pharmacy - Isa Town (H003)',
    tax_number: '3000987654322',
    phone: '+973 39236111',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Avenue 1, Isa Town, Kingdom of Bahrain',
    address_ar: 'شارع 1، مدينة عيسى، مملكة البحرين',
    expiry_date: '2027-02-14',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية الهدى - مدينة عيسى ذ.م.م', 'Alhoda Pharmacy - Isa Town', '106723-03')
  },
  // 14. Alhoda Pharmacy - Sanad - H004
  {
    id: 'cr-h-004',
    cr_name: 'Alhoda Pharmacy - Sanad branch',
    cr_name_ar: 'صيدلية الهدى - فرع سند ذ.م.م',
    cr_number: '106723-04',
    is_master: false,
    parent_cr_number: '106723-01',
    linked_branch_id: '52325c35-d273-4b6f-bed1-aef28d55cc37',
    linked_branch_name: 'Alhoda Pharmacy - Sanad branch (H004)',
    tax_number: '3000987654322',
    phone: '+973 33577910',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Avenue 77, Sanad, Kingdom of Bahrain',
    address_ar: 'شارع 77، سند، مملكة البحرين',
    expiry_date: '2026-10-18',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية الهدى - فرع سند ذ.م.م', 'Alhoda Pharmacy - Sanad branch', '106723-04')
  },
  // 15. Alhoda Pharmacy - Budaiya - H005
  {
    id: 'cr-h-005',
    cr_name: 'Alhoda Pharmacy - Budaiya branch',
    cr_name_ar: 'صيدلية الهدى - فرع البديع ذ.م.م',
    cr_number: '106723-05',
    is_master: false,
    parent_cr_number: '106723-01',
    linked_branch_id: 'a26d4e01-3647-4eb3-ba3a-3b5e3c740037',
    linked_branch_name: 'Alhoda Pharmacy - Budaiya branch (H005)',
    tax_number: '3000987654322',
    phone: '+973 32235002',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Budaiya Commercial Complex, Budaiya, Kingdom of Bahrain',
    address_ar: 'مجمع البديع التجاري، البديع، مملكة البحرين',
    expiry_date: '2027-09-01',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية الهدى - فرع البديع ذ.م.م', 'Alhoda Pharmacy - Budaiya branch', '106723-05')
  },

  // 16. Sanad 1 Pharmacy - Club (Master Group CR) - S001
  {
    id: 'cr-s-001',
    cr_name: 'Sanad Pharmacy WLL',
    cr_name_ar: 'صيدلية سند ذ.م.م',
    cr_number: '145842-01',
    is_master: true,
    linked_branch_id: '1b75e849-fb83-4f7c-89ec-344068a0c17c',
    linked_branch_name: 'Sanad 1 Pharmacy - Club (S001)',
    tax_number: '3000987654323',
    phone: '+973 38877767',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Sanad Sports Club Complex, Sanad, Kingdom of Bahrain',
    address_ar: 'مجمع نادي سند الرياضي، سند، مملكة البحرين',
    expiry_date: '2027-11-12',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية سند ذ.م.م', 'Sanad Pharmacy WLL', '145842-01')
  },
  // 17. Jamila Pharmacy - Zinj - S002
  {
    id: 'cr-s-002',
    cr_name: 'Jamila Pharmacy W.L.L',
    cr_name_ar: 'صيدلية جميلة ذ.م.م',
    cr_number: '145842-02',
    is_master: false,
    parent_cr_number: '145842-01',
    linked_branch_id: '8d428bcb-9594-43a9-a2f9-d684c0f7fd25',
    linked_branch_name: 'Jamila Pharmacy - Zinj branch (S002)',
    tax_number: '3000987654323',
    phone: '+973 39910214',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Shaikh Isa Highway, Zinj, Kingdom of Bahrain',
    address_ar: 'شارع الشيخ عيسى، الزنج، مملكة البحرين',
    expiry_date: '2026-12-30',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية جميلة ذ.م.م', 'Jamila Pharmacy W.L.L', '145842-02')
  },
  // 18. Janabiya Square Pharmacy - S003
  {
    id: 'cr-s-003',
    cr_name: 'Janabiya Square Pharmacy W.L.L',
    cr_name_ar: 'صيدلية جنبية سكوير ذ.م.م',
    cr_number: '145842-03',
    is_master: false,
    parent_cr_number: '145842-01',
    linked_branch_id: '61d320bb-5f30-47ff-bdcc-fa737e837088',
    linked_branch_name: 'Janabiya Square Pharmacy (S003)',
    tax_number: '3000987654323',
    phone: '+973 39910215',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Janabiya Square Commercial Complex, Janabiya, Kingdom of Bahrain',
    address_ar: 'مجمع جنبية سكوير التجاري، الجنبية، مملكة البحرين',
    expiry_date: '2027-04-18',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية جنبية سكوير ذ.م.م', 'Janabiya Square Pharmacy W.L.L', '145842-03')
  },
  // 19. Sanad 2 Pharmacy - Station - S004
  {
    id: 'cr-s-004',
    cr_name: 'Sanad Pharmacy 2 W.L.L',
    cr_name_ar: 'صيدلية سند 2 ذ.م.م',
    cr_number: '145842-04',
    is_master: false,
    parent_cr_number: '145842-01',
    linked_branch_id: '9efda513-5566-4ad2-8342-b11732ba3eac',
    linked_branch_name: 'Sanad 2 Pharmacy - Station (S004)',
    tax_number: '3000987654323',
    phone: '+973 33577910',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Sanad Petrol Station, Sanad, Kingdom of Bahrain',
    address_ar: 'محطة وقود سند، سند، مملكة البحرين',
    expiry_date: '2027-05-15',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية سند 2 ذ.م.م', 'Sanad Pharmacy 2 W.L.L', '145842-04')
  },

  // 20. Damistan Pharmacy WLL (Master Group CR) - D002
  {
    id: 'cr-d-002',
    cr_name: 'Damistan Pharmacy WLL',
    cr_name_ar: 'صيدلية دمستان ذ.م.م',
    cr_number: '172593-01',
    is_master: true,
    linked_branch_id: '67a3254b-ea60-4aed-951f-7138da422597',
    linked_branch_name: 'Damistan Pharmacy (D002)',
    tax_number: '3000987654324',
    phone: '+973 32022030',
    email: 'tabarakph.info@gmail.com',
    address_en: 'Zallaq Highway, Block 1019, Damistan, Kingdom of Bahrain',
    address_ar: 'شارع الزلاق، مجمع 1019، دمستان، مملكة البحرين',
    expiry_date: '2027-06-25',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية دمستان ذ.م.م', 'Damistan Pharmacy WLL', '172593-01')
  },
  // 21. District Pharmacy - D001
  {
    id: 'cr-d-001',
    cr_name: 'District Pharmacy W.L.L',
    cr_name_ar: 'صيدلية الدستركت ذ.م.م',
    cr_number: '172593-02',
    is_master: false,
    parent_cr_number: '172593-01',
    linked_branch_id: 'd108dae1-93ba-4768-af9a-b69d512ad077',
    linked_branch_name: 'District Pharmacy (D001)',
    tax_number: '3000987654324',
    phone: '+973 39500081',
    email: 'tabarakph.info@gmail.com',
    address_en: 'District 1 Mall, Janabiya, Kingdom of Bahrain',
    address_ar: 'مجمع دستركت 1 التجاري، الجنبية، مملكة البحرين',
    expiry_date: '2027-08-10',
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg('صيدلية الدستركت ذ.م.م', 'District Pharmacy W.L.L', '172593-02')
  }
];

const parseRowToCr = (row: any): RegisteredCr => {
  let enName = row.cr_name || '';
  let arName = '';
  let branchName = '';
  let phone = '+973 33866650';
  let email = 'tabarakph.info@gmail.com';
  let addressEn = 'Kingdom of Bahrain';
  let addressAr = 'مملكة البحرين';
  let nhraLicNo = row.nhra_license_no || '';
  let nhraExpDate = row.nhra_expiry_date || '';

  let updatedAt = row.updated_at || undefined;

  // Check if cr_name contains packed JSON
  if (row.cr_name && typeof row.cr_name === 'string' && row.cr_name.startsWith('{')) {
    try {
      const parsed = JSON.parse(row.cr_name);
      enName = parsed.en || parsed.name || enName;
      arName = parsed.ar || parsed.name_ar || '';
      branchName = parsed.branch_name || '';
      if (parsed.phone) phone = parsed.phone;
      if (parsed.email) email = parsed.email;
      if (parsed.address_en) addressEn = parsed.address_en;
      if (parsed.address_ar) addressAr = parsed.address_ar;
      if (parsed.nhra_license_no) nhraLicNo = parsed.nhra_license_no;
      if (parsed.nhra_expiry_date) nhraExpDate = parsed.nhra_expiry_date;
      if (parsed.updated_at) updatedAt = parsed.updated_at;
    } catch {
      // Keep plain string
    }
  }

  let expiryDate = row.expiry_date || undefined;

  // Check default matching if arName or expiryDate is empty
  const match = INITIAL_21_CRS.find(c => c.cr_number === row.cr_number || c.id === row.id);
  if (match) {
    if (!arName) arName = match.cr_name_ar || '';
    if (!branchName) branchName = match.linked_branch_name || '';
    if (!expiryDate) expiryDate = match.expiry_date || undefined;
    if (!nhraLicNo) nhraLicNo = match.nhra_license_no || '';
    if (!nhraExpDate) nhraExpDate = match.nhra_expiry_date || '';
    if (match.phone && phone === '+973 33866650') phone = match.phone;
    if (match.email && email === 'tabarakph.info@gmail.com') email = match.email;
    if (match.address_en && addressEn === 'Kingdom of Bahrain') addressEn = match.address_en;
    if (match.address_ar && addressAr === 'مملكة البحرين') addressAr = match.address_ar;
  }

  return {
    id: row.id,
    cr_name: enName,
    cr_name_ar: arName,
    cr_number: row.cr_number,
    is_master: Boolean(row.is_master),
    parent_cr_number: row.parent_cr_number || undefined,
    linked_branch_id: row.linked_branch_id || undefined,
    linked_branch_name: branchName || undefined,
    tax_number: row.tax_number || '3000987654321',
    expiry_date: expiryDate,
    nhra_license_no: nhraLicNo || undefined,
    nhra_expiry_date: nhraExpDate || undefined,
    phone,
    email,
    address_en: addressEn,
    address_ar: addressAr,
    logo_url: DEFAULT_GROUP_LOGO,
    signature_url: DEFAULT_SIGNATURE,
    stamp_url: generateCrStampSvg(arName, enName, row.cr_number),
    created_at: row.created_at,
    updated_at: updatedAt
  };
};

const packCrToPayload = (cr: RegisteredCr) => {
  const packedNameJson = JSON.stringify({
    en: cr.cr_name,
    ar: cr.cr_name_ar || '',
    branch_name: cr.linked_branch_name || '',
    phone: cr.phone || '',
    email: cr.email || '',
    address_en: cr.address_en || '',
    address_ar: cr.address_ar || '',
    nhra_license_no: cr.nhra_license_no || '',
    nhra_expiry_date: cr.nhra_expiry_date || '',
    updated_at: cr.updated_at || new Date().toISOString()
  });

  return {
    id: cr.id,
    cr_name: packedNameJson,
    cr_number: cr.cr_number,
    is_master: Boolean(cr.is_master),
    parent_cr_number: cr.parent_cr_number || null,
    linked_branch_id: cr.linked_branch_id || null,
    tax_number: cr.tax_number || null,
    expiry_date: cr.expiry_date || null
  };
};

export const crService = {
  /**
   * Fetch all registered commercial registrations from Supabase (fallback to localStorage and INITIAL_21_CRS)
   */
  list: async (): Promise<RegisteredCr[]> => {
    let cloudList: RegisteredCr[] = [];

    try {
      const { data, error } = await supabaseClient
        .from('registered_crs')
        .select('*')
        .order('is_master', { ascending: false })
        .order('cr_number', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        cloudList = data.map(parseRowToCr);
      }
    } catch (e) {
      console.warn('Error fetching registered_crs from Supabase:', e);
    }

    // If Supabase has data, sync it to localStorage and return
    if (cloudList.length > 0) {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LOCAL_STORAGE_CR_KEY, JSON.stringify(cloudList));
        } catch {}
      }
      return cloudList;
    }

    // If Supabase is empty, check localStorage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_CR_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length >= 10) {
            // Seed to cloud in background
            crService.saveAll(parsed).catch(() => {});
            return parsed;
          }
        }
      } catch {}
    }

    // Auto-seed INITIAL_21_CRS to cloud and localStorage
    crService.saveAll(INITIAL_21_CRS).catch(() => {});
    return INITIAL_21_CRS;
  },

  /**
   * Save a single CR to Supabase and update localStorage
   */
  save: async (cr: RegisteredCr): Promise<RegisteredCr> => {
    const payload = packCrToPayload(cr);

    try {
      const { error } = await supabaseClient
        .from('registered_crs')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn('Could not upsert into registered_crs in Supabase:', error);
      }
    } catch (e) {
      console.warn('Failed to upsert registered_cr:', e);
    }

    // Update localStorage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_CR_KEY);
        const currentList: RegisteredCr[] = saved ? JSON.parse(saved) : [...INITIAL_21_CRS];
        const existingIdx = currentList.findIndex(c => c.id === cr.id || c.cr_number === cr.cr_number);
        if (existingIdx !== -1) {
          currentList[existingIdx] = cr;
        } else {
          currentList.push(cr);
        }
        localStorage.setItem(LOCAL_STORAGE_CR_KEY, JSON.stringify(currentList));
        window.dispatchEvent(new CustomEvent(CR_UPDATED_EVENT, { detail: currentList }));
      } catch {}
    }

    return cr;
  },

  /**
   * Save multiple CRs to Supabase and localStorage
   */
  saveAll: async (crs: RegisteredCr[]): Promise<RegisteredCr[]> => {
    const payloads = crs.map(packCrToPayload);

    try {
      const { error } = await supabaseClient
        .from('registered_crs')
        .upsert(payloads, { onConflict: 'id' });

      if (error) {
        console.warn('Could not bulk upsert into registered_crs:', error);
      }
    } catch (e) {
      console.warn('Failed bulk upsert registered_crs:', e);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_CR_KEY, JSON.stringify(crs));
        window.dispatchEvent(new CustomEvent(CR_UPDATED_EVENT, { detail: crs }));
      } catch {}
    }

    return crs;
  },

  /**
   * Delete a CR by ID
   */
  delete: async (id: string): Promise<boolean> => {
    try {
      await supabaseClient.from('registered_crs').delete().eq('id', id);
    } catch (e) {
      console.warn('Failed to delete registered_cr:', e);
    }

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_CR_KEY);
        if (saved) {
          const currentList: RegisteredCr[] = JSON.parse(saved);
          const updated = currentList.filter(c => c.id !== id);
          localStorage.setItem(LOCAL_STORAGE_CR_KEY, JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent(CR_UPDATED_EVENT, { detail: updated }));
        }
      } catch {}
    }

    return true;
  }
};
