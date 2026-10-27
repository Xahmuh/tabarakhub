import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Printer,
  Download,
  Copy,
  Check,
  Building2,
  Globe2,
  FileText,
  User,
  CreditCard,
  Briefcase,
  Award,
  Calendar,
  Banknote,
  Landmark,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  Eye,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  Info,
  Search,
  CheckCircle2,
  Filter,
  Pill,
  Users,
  X,
  Languages,
  SlidersHorizontal
} from 'lucide-react';
import { RegisteredCr, getAdminRegisteredCrs, DEFAULT_GROUP_LOGO, DEFAULT_SIGNATURE, generateCrStampSvg } from '../lib/crEntities';
import { crService, CR_UPDATED_EVENT } from '../../services/crService';
import {
  HrLetterType,
  HrLetterData,
  generateHrLetterDocxBlob,
  resolveNationality,
  resolveJobTitle,
  cleanBilingualString
} from '../lib/hrLetterDocxGenerator';
import { workforceService, Employee } from '../../services/workforceService';

const FALLBACK_EMPLOYEES: Employee[] = [
  {
    id: 'emp-ph-1',
    code: 'E001',
    full_name: 'Dr. Ali Hassan Mohamed',
    category: 'Pharmacist',
    cpr_number: '910284712',
    phone: '+973 39123456',
    email: 'ali.hassan@tabarak.com',
    nationality: 'Egyptian / مصري',
    status: 'Active',
    notes: 'Senior Licensed Pharmacist',
    salary_matrix: {
      basicSalary: 150.000,
      housing: 30.000,
      transportation: 0.000,
      jobResponsibilityBonus: 90.000,
      longShiftIncentive: 0.000,
      totalSalary: 270.000,
      expatPp: 'A29381726',
      expatCpr: '910284712',
      nationality: 'Egyptian / مصري',
      nhraLicenseNo: 'NHRA/PH/2021/3941',
      gender: 'Male'
    }
  },
  {
    id: 'emp-ph-2',
    code: 'E002',
    full_name: 'Dr. Mahmoud Ahmed Elsayed',
    category: 'Pharmacist',
    cpr_number: '890412354',
    phone: '+973 33866650',
    email: 'mahmoud.elsayed@tabarak.com',
    nationality: 'Egyptian / مصري',
    status: 'Active',
    notes: 'Licensed Pharmacist / مسؤول الصيدلية',
    salary_matrix: {
      basicSalary: 180.000,
      housing: 40.000,
      transportation: 0.000,
      jobResponsibilityBonus: 80.000,
      longShiftIncentive: 0.000,
      totalSalary: 300.000,
      expatPp: 'A98213456',
      expatCpr: '890412354',
      nationality: 'Egyptian / مصري',
      nhraLicenseNo: '32000185',
      gender: 'Male'
    }
  },
  {
    id: 'emp-ph-3',
    code: 'E003',
    full_name: 'Dr. Maryam Jassim Al-Khalifa',
    category: 'Pharmacist',
    cpr_number: '950819283',
    phone: '+973 38192837',
    email: 'maryam.khalifa@tabarak.com',
    nationality: 'Bahraini / بحريني',
    status: 'Active',
    notes: 'Clinical Pharmacist',
    salary_matrix: {
      basicSalary: 220.000,
      housing: 40.000,
      transportation: 20.000,
      jobResponsibilityBonus: 60.000,
      longShiftIncentive: 0.000,
      totalSalary: 340.000,
      expatPp: 'B10293847',
      expatCpr: '950819283',
      nationality: 'Bahraini / بحريني',
      nhraLicenseNo: 'NHRA/AP/2023/1029',
      gender: 'Female'
    }
  },
  {
    id: 'emp-ph-4',
    code: 'E004',
    full_name: 'Dr. Mostafa Ebrahim Khalil',
    category: 'Pharmacist',
    cpr_number: '920318491',
    phone: '+973 39281746',
    email: 'mostafa.khalil@tabarak.com',
    nationality: 'Egyptian / مصري',
    status: 'Active',
    notes: 'Licensed Pharmacist',
    salary_matrix: {
      basicSalary: 160.000,
      housing: 35.000,
      transportation: 15.000,
      jobResponsibilityBonus: 70.000,
      longShiftIncentive: 0.000,
      totalSalary: 280.000,
      expatPp: 'A38472910',
      expatCpr: '920318491',
      nationality: 'Egyptian / مصري',
      nhraLicenseNo: 'NHRA/PH/2022/4102',
      gender: 'Male'
    }
  },
  {
    id: 'emp-dr-1',
    code: 'D001',
    full_name: 'Ahmed Hassan Driver',
    category: 'Driver',
    cpr_number: '840192837',
    phone: '+973 35123456',
    nationality: 'Egyptian / مصري',
    status: 'Active',
    notes: 'سائق خدمات وتوصيل أدوية',
    salary_matrix: {
      basicSalary: 120.000,
      housing: 25.000,
      transportation: 20.000,
      jobResponsibilityBonus: 75.000,
      longShiftIncentive: 0.000,
      totalSalary: 240.000,
      expatPp: 'M48392019',
      expatCpr: '840192837',
      nationality: 'Egyptian / مصري'
    }
  },
  {
    id: 'emp-dr-2',
    code: 'D002',
    full_name: 'Ramesh Kumar Suresh',
    category: 'Driver',
    cpr_number: '860293847',
    phone: '+973 36123456',
    nationality: 'Indian / هندي',
    status: 'Active',
    notes: 'Logistics Fleet Driver',
    salary_matrix: {
      basicSalary: 110.000,
      housing: 25.000,
      transportation: 20.000,
      jobResponsibilityBonus: 65.000,
      longShiftIncentive: 0.000,
      totalSalary: 220.000,
      expatPp: 'N82910482',
      expatCpr: '860293847',
      nationality: 'Indian / هندي'
    }
  },
  {
    id: 'emp-mg-1',
    code: 'M001',
    full_name: 'Karim Mostafa Radwan',
    category: 'Management',
    cpr_number: '880319482',
    phone: '+973 37123456',
    nationality: 'Egyptian / مصري',
    status: 'Active',
    notes: 'Finance & Accounting Specialist',
    salary_matrix: {
      basicSalary: 350.000,
      housing: 50.000,
      transportation: 30.000,
      jobResponsibilityBonus: 120.000,
      longShiftIncentive: 0.000,
      totalSalary: 550.000,
      expatPp: 'C39485721',
      expatCpr: '880319482',
      nationality: 'Egyptian / مصري'
    }
  },
  {
    id: 'emp-wk-1',
    code: 'W001',
    full_name: 'Bilal Mohammad Farooq',
    category: 'Worker',
    cpr_number: '930419284',
    phone: '+973 34123456',
    nationality: 'Pakistani / باكستاني',
    status: 'Active',
    notes: 'Warehouse & Operations Staff',
    salary_matrix: {
      basicSalary: 100.000,
      housing: 20.000,
      transportation: 15.000,
      jobResponsibilityBonus: 50.000,
      longShiftIncentive: 0.000,
      totalSalary: 185.000,
      expatPp: 'P29481023',
      expatCpr: '930419284',
      nationality: 'Pakistani / باكستاني'
    }
  }
];

export interface DocumentTypeOption {
  id: HrLetterType;
  labelEn: string;
  labelAr: string;
  hintEn: 'History' | 'Active job' | 'Payroll' | 'Approval' | 'Banking' | 'Travel';
  hintAr: string;
  subEn: string;
  subAr: string;
  icon: any;
  tone: string;
  tagColor: string;
}

export const DOCUMENT_TYPE_OPTIONS: DocumentTypeOption[] = [
  {
    id: 'experience_certificate',
    labelEn: 'Experience Certificate',
    labelAr: 'شهادة خبرة وخدمة وظيفية',
    hintEn: 'History',
    hintAr: 'سجل الخدمة والخبرة',
    subEn: 'Official Certificate of Service & Experience',
    subAr: 'بيان الخبرة والكفاءة والسيرة المهنية للموظف',
    icon: Award,
    tone: 'red',
    tagColor: 'bg-red-50 text-red-600 border border-red-200'
  },
  {
    id: 'active_employment',
    labelEn: 'Employment Certificate',
    labelAr: 'شهادة إثبات عمل',
    hintEn: 'Active job',
    hintAr: 'على رأس العمل',
    subEn: 'Certificate of Active Employment',
    subAr: 'إفادة رسمية بالاستمرار على رأس العمل لمن يهمه الأمر',
    icon: Briefcase,
    tone: 'red',
    tagColor: 'bg-red-50 text-red-600 border border-red-200'
  },
  {
    id: 'bank_salary_iban',
    labelEn: 'Salary Certificate',
    labelAr: 'شهادة تفاصيل الراتب واعتماد الحساب',
    hintEn: 'Payroll',
    hintAr: 'مفردات الراتب والآيبان',
    subEn: 'Salary Details & Bank Confirmation',
    subAr: 'بيان مفردات الراتب الشهري المعتمد ورقم الآيبان',
    icon: Banknote,
    tone: 'red',
    tagColor: 'bg-red-50 text-red-600 border border-red-200'
  },
  {
    id: 'noc_transfer',
    labelEn: 'NOC',
    labelAr: 'شهادة عدم ممانعة نقل كفالة (NOC)',
    hintEn: 'Approval',
    hintAr: 'موافقة واعتماد',
    subEn: 'No Objection for Sponsorship Transfer',
    subAr: 'خطاب رسمي لعدم ممانعة الانتقال والالتحاق بشركة أخرى',
    icon: ShieldCheck,
    tone: 'red',
    tagColor: 'bg-red-50 text-red-600 border border-red-200'
  },
  {
    id: 'bank_salary_undertaking',
    labelEn: 'Bank Letter',
    labelAr: 'خطاب وتعهد بنكي لتثبيت تحويل الراتب',
    hintEn: 'Banking',
    hintAr: 'معاملات وقروض بنكية',
    subEn: 'Salary Transfer Undertaking to Bank',
    subAr: 'تعهد والتزام مصرفي غير قابل للإلغاء لمنح التمويل والقروض',
    icon: Landmark,
    tone: 'red',
    tagColor: 'bg-red-50 text-red-600 border border-red-200'
  },
  {
    id: 'embassy_salary',
    labelEn: 'Embassy Letter',
    labelAr: 'شهادة تعريف عمل وراتب للسفارات',
    hintEn: 'Travel',
    hintAr: 'سفر وتأشيرات',
    subEn: 'Employment & Salary Certificate for Embassy',
    subAr: 'مستند رسمي لطلبات التأشيرات والشنغن والسفارات',
    icon: Globe2,
    tone: 'red',
    tagColor: 'bg-red-50 text-red-600 border border-red-200'
  }
];

export interface OfficialHrLetterGeneratorProps {
  initialEmployee?: any;
  onBack?: () => void;
  standalone?: boolean;
}

export const OfficialHrLetterGenerator: React.FC<OfficialHrLetterGeneratorProps> = ({
  initialEmployee,
  onBack,
  standalone = false
}) => {
  // CR Entities - Real-time state connected to Supabase and Project Settings
  const [registeredCrs, setRegisteredCrs] = useState<RegisteredCr[]>(() => getAdminRegisteredCrs());
  const [selectedCrId, setSelectedCrId] = useState<string>(() => {
    const list = getAdminRegisteredCrs();
    return list[0]?.id || 'cr-1';
  });

  useEffect(() => {
    // 1. Initial async sync from Supabase
    crService.list().then(crs => {
      if (crs && crs.length > 0) {
        setRegisteredCrs(crs);
      }
    }).catch(console.error);

    // 2. Listen to real-time updates when CR names are edited in Project Settings
    const handleCrUpdated = () => {
      crService.list().then(crs => {
        if (crs && crs.length > 0) {
          setRegisteredCrs(crs);
        }
      }).catch(console.error);
    };

    window.addEventListener(CR_UPDATED_EVENT, handleCrUpdated);
    window.addEventListener('storage', handleCrUpdated);
    return () => {
      window.removeEventListener(CR_UPDATED_EVENT, handleCrUpdated);
      window.removeEventListener('storage', handleCrUpdated);
    };
  }, []);

  const selectedCr = useMemo(() => {
    return registeredCrs.find(c => c.id === selectedCrId) || registeredCrs[0] || getAdminRegisteredCrs()[0];
  }, [registeredCrs, selectedCrId]);

  // Letter Language State (Controls generated A4 document letter ONLY; module itself is in English)
  const [letterLang, setLetterLang] = useState<'ar' | 'en'>(() => {
    if (initialEmployee?.initialLang === 'en' || initialEmployee?.initialLang === 'ar') {
      return initialEmployee.initialLang;
    }
    return 'en';
  });
  const isLetterAr = letterLang === 'ar';
  // Keep lang and isAr as aliases for document letter rendering & export
  const lang = letterLang;
  const isAr = isLetterAr;

  // Gender State (male / female phrasing for certificates & letters)
  const [letterGender, setLetterGender] = useState<'male' | 'female'>(() => {
    const initGen = initialEmployee?.gender || initialEmployee?.salary_matrix?.gender;
    if (initGen && String(initGen).toLowerCase().includes('female')) {
      return 'female';
    }
    return 'male';
  });
  const isFemale = letterGender === 'female';

  // Letter / Document Type State (Matching HR Self Service: History, Active job, Payroll, Approval, Banking, Travel)
  const [letterType, setLetterType] = useState<HrLetterType>('experience_certificate');
  const [isDocTypeDropdownOpen, setIsDocTypeDropdownOpen] = useState<boolean>(false);
  const [docTypeSearchQuery, setDocTypeSearchQuery] = useState<string>('');
  const [docHintFilter, setDocHintFilter] = useState<string>('all');
  const docTypeDropdownRef = useRef<HTMLDivElement>(null);

  // Without Seal & Signature State
  const [withoutSealAndSignature, setWithoutSealAndSignature] = useState<boolean>(false);

  // Preview Zoom State
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Reference Number Generator
  const generateRefNo = (code?: string) => {
    const d = new Date();
    const yearMonth = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `HR/LET/${yearMonth}/${code ? code.toUpperCase() : rand}`;
  };

  const [refNo, setRefNo] = useState<string>(() => generateRefNo(initialEmployee?.code));
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Employee Identity Fields
  const [employeeName, setEmployeeName] = useState<string>(initialEmployee?.full_name || '');
  const [cpr, setCpr] = useState<string>(initialEmployee?.cpr_number || initialEmployee?.salary_matrix?.expatCpr || '');
  const [passport, setPassport] = useState<string>(initialEmployee?.salary_matrix?.expatPp || '');
  const [nationality, setNationality] = useState<string>(() => {
    const initL = (initialEmployee?.initialLang === 'en' || initialEmployee?.initialLang === 'ar') ? initialEmployee.initialLang : 'en';
    const rawNat = initialEmployee?.nationality || initialEmployee?.salary_matrix?.nationality;
    if (!rawNat) return '';
    const initGen = (initialEmployee?.gender || initialEmployee?.salary_matrix?.gender) && String(initialEmployee?.gender || initialEmployee?.salary_matrix?.gender).toLowerCase().includes('female') ? 'female' : 'male';
    return resolveNationality(rawNat, initL, initGen);
  });
  const [jobTitle, setJobTitle] = useState<string>(() => {
    if (!initialEmployee) return '';
    const initL = (initialEmployee?.initialLang === 'en' || initialEmployee?.initialLang === 'ar') ? initialEmployee.initialLang : 'en';
    const prefix = (initialEmployee?.code || '').trim().toUpperCase().charAt(0);
    const derivedTitle = initialEmployee?.jobTitle || initialEmployee?.category || (prefix === 'E' ? 'Pharmacist' : prefix === 'D' ? 'Driver' : prefix === 'M' ? 'Management' : prefix === 'W' ? 'Worker' : 'Pharmacist');
    const initGen = (initialEmployee?.gender || initialEmployee?.salary_matrix?.gender) && String(initialEmployee?.gender || initialEmployee?.salary_matrix?.gender).toLowerCase().includes('female') ? 'female' : 'male';
    return resolveJobTitle(derivedTitle, initL, prefix, initGen);
  });
  const [nhraLicense, setNhraLicense] = useState<string>(initialEmployee?.salary_matrix?.nhraLicenseNo || '');

  // Letter Document Output Language Switcher (Affects generated A4 letter only)
  const handleLetterLanguageSwitch = (newLang: 'ar' | 'en') => {
    setLetterLang(newLang);
    setNationality(prev => resolveNationality(prev, newLang, letterGender));
    const prefix = (selectedEmployee?.code || initialEmployee?.code || '').trim().toUpperCase().charAt(0);
    setJobTitle(prev => resolveJobTitle(prev, newLang, prefix, letterGender));
    setDestinationName(prev => cleanBilingualString(prev, newLang));
    setBankName(prev => cleanBilingualString(prev, newLang));
    setNewCompanyName(prev => cleanBilingualString(prev, newLang));
  };

  // Gender Switcher (Male / Female phrasing)
  const handleGenderSwitch = (newGender: 'male' | 'female') => {
    setLetterGender(newGender);
    setNationality(prev => resolveNationality(prev, lang, newGender));
    const prefix = (selectedEmployee?.code || initialEmployee?.code || '').trim().toUpperCase().charAt(0);
    setJobTitle(prev => resolveJobTitle(prev, lang, prefix, newGender));
  };

  // Dates
  const [joinDate, setJoinDate] = useState<string>(initialEmployee?.created_at?.split('T')[0] || '');
  const [endDate, setEndDate] = useState<string>('');

  // Financial Matrix Breakdown (BHD - 3 Decimal Places)
  const [basicSalary, setBasicSalary] = useState<number>(initialEmployee?.salary_matrix?.basicSalary ?? 0);
  const [housingAllowance, setHousingAllowance] = useState<number>(initialEmployee?.salary_matrix?.housing ?? 0);
  const [transportationAllowance, setTransportationAllowance] = useState<number>(initialEmployee?.salary_matrix?.transportation ?? 0);
  const [incentiveBonus, setIncentiveBonus] = useState<number>(
    initialEmployee?.salary_matrix?.jobResponsibilityBonus ??
    initialEmployee?.salary_matrix?.longShiftIncentive ??
    0
  );
  const [isManualTotal, setIsManualTotal] = useState<boolean>(false);
  const [manualTotalSalary, setManualTotalSalary] = useState<number>(0);

  const calculatedTotalSalary = useMemo(() => {
    return Number((basicSalary + housingAllowance + transportationAllowance + incentiveBonus).toFixed(3));
  }, [basicSalary, housingAllowance, transportationAllowance, incentiveBonus]);

  const effectiveTotalSalary = isManualTotal ? manualTotalSalary : calculatedTotalSalary;

  // Contextual Destination & Bank Fields
  const [bankName, setBankName] = useState<string>('National Bank of Bahrain (NBB) / بنك البحرين الوطني');
  const [iban, setIban] = useState<string>('BH29NBOB00000012345678');
  const [destinationName, setDestinationName] = useState<string>('Embassy of France in Bahrain / سفارة فرنسا');
  const [newCompanyName, setNewCompanyName] = useState<string>('Gulf Health Solutions W.L.L / شركة حلول الخليج الصحية');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [customAddressee, setCustomAddressee] = useState<string>('');

  // Signatory Meta (Persisted to localStorage so user changes are remembered across sessions)
  const [signatoryName, setSignatoryName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tabarak_hr_letter_signatory_name');
      if (saved !== null) return saved;
    }
    return 'Dr. Fathy Saad Amin';
  });
  const [signatoryRoleAr, setSignatoryRoleAr] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tabarak_hr_letter_signatory_role_ar');
      if (saved !== null) return saved;
    }
    return 'المدير العام';
  });
  const [signatoryRoleEn, setSignatoryRoleEn] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tabarak_hr_letter_signatory_role_en');
      if (saved !== null) return saved;
    }
    return 'General Manager';
  });

  const handleUpdateSignatoryName = (val: string) => {
    setSignatoryName(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tabarak_hr_letter_signatory_name', val);
    }
  };

  const handleUpdateSignatoryRoleAr = (val: string) => {
    setSignatoryRoleAr(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tabarak_hr_letter_signatory_role_ar', val);
    }
  };

  const handleUpdateSignatoryRoleEn = (val: string) => {
    setSignatoryRoleEn(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tabarak_hr_letter_signatory_role_en', val);
    }
  };

  const handleApplyPresetRole = (ar: string, en: string) => {
    handleUpdateSignatoryRoleAr(ar);
    handleUpdateSignatoryRoleEn(en);
  };

  // Copy Feedback Toast State
  const [copied, setCopied] = useState<boolean>(false);
  const [isDownloadingWord, setIsDownloadingWord] = useState<boolean>(false);

  // Sync initial employee / request data if updated
  useEffect(() => {
    if (initialEmployee) {
      // 1. Employee Full Name
      const name = initialEmployee.passportName || initialEmployee.employeeName || initialEmployee.full_name;
      if (name) setEmployeeName(name);

      // 2. CPR Number
      const cprVal = initialEmployee.cpr || initialEmployee.cpr_number || initialEmployee.salary_matrix?.expatCpr;
      if (cprVal) setCpr(cprVal);

      // 3. Passport Number
      const ppVal = initialEmployee.passport || initialEmployee.salary_matrix?.expatPp;
      if (ppVal) setPassport(ppVal);

      // 4. NHRA License
      const licVal = initialEmployee.license || initialEmployee.salary_matrix?.nhraLicenseNo;
      if (licVal) setNhraLicense(licVal);

      // 5. Joining Date
      const jd = initialEmployee.joinDate || initialEmployee.created_at?.split('T')[0];
      if (jd) setJoinDate(jd);

      // 6. Reference Number
      if (initialEmployee.refNum) {
        setRefNo(initialEmployee.refNum);
      } else if (initialEmployee.code) {
        setRefNo(generateRefNo(initialEmployee.code));
      }

      // 7. Sponsor / CR Entity matching
      if (initialEmployee.sponsor || initialEmployee.location) {
        const querySponsor = (initialEmployee.sponsor || initialEmployee.location || '').toLowerCase();
        const matched = registeredCrs.find(c =>
          c.cr_name?.toLowerCase().includes(querySponsor) ||
          c.cr_name_ar?.includes(initialEmployee.sponsor || '') ||
          c.linked_branch_name?.toLowerCase().includes(querySponsor) ||
          c.branches?.some((b: string) => b.toLowerCase().includes(querySponsor))
        );
        if (matched) {
          setSelectedCrId(matched.id);
        }
      }

      // 8. Document Type matching (docTypes array or letterType)
      if (initialEmployee.letterType) {
        setLetterType(initialEmployee.letterType);
      } else if (Array.isArray(initialEmployee.docTypes) && initialEmployee.docTypes.length > 0) {
        const dt = initialEmployee.docTypes.join(' ').toLowerCase();
        if (dt.includes('experience')) setLetterType('experience_certificate');
        else if (dt.includes('employment')) setLetterType('active_employment');
        else if (dt.includes('salary')) setLetterType('bank_salary_iban');
        else if (dt.includes('noc')) setLetterType('noc_transfer');
        else if (dt.includes('bank')) setLetterType('bank_salary_undertaking');
        else if (dt.includes('embassy')) setLetterType('embassy_salary');
      }

      // 9. Purpose / Destination / Bank
      if (initialEmployee.docReason) {
        setDestinationName(initialEmployee.docReason);
      }

      // 10. Financial Salary Matrix
      if (initialEmployee.salary) {
        const salNum = parseFloat(initialEmployee.salary);
        if (!isNaN(salNum) && salNum > 0) {
          const basic = Number((salNum * 0.6).toFixed(3));
          const housing = Number((salNum * 0.15).toFixed(3));
          const bonus = Number((salNum - basic - housing).toFixed(3));
          setBasicSalary(basic);
          setHousingAllowance(housing);
          setTransportationAllowance(0.000);
          setIncentiveBonus(bonus);
          setIsManualTotal(true);
          setManualTotalSalary(salNum);
        }
      } else if (initialEmployee.salary_matrix) {
        const sm = initialEmployee.salary_matrix;
        if (sm.basicSalary !== undefined) setBasicSalary(sm.basicSalary);
        if (sm.housing !== undefined) setHousingAllowance(sm.housing);
        if (sm.transportation !== undefined) setTransportationAllowance(sm.transportation);
        if (sm.jobResponsibilityBonus !== undefined || sm.longShiftIncentive !== undefined) {
          setIncentiveBonus((sm.jobResponsibilityBonus || 0) + (sm.longShiftIncentive || 0));
        }
        if (sm.totalSalary !== undefined) {
          setIsManualTotal(true);
          setManualTotalSalary(sm.totalSalary);
        }
      }

      // 11. Nationality & Job Title resolution (Strict language purity)
      const currentOrInitLang = (initialEmployee.initialLang === 'en' || initialEmployee.initialLang === 'ar')
        ? initialEmployee.initialLang
        : lang;
      if (initialEmployee.initialLang) {
        setLetterLang(currentOrInitLang);
      }
      const rawNat = initialEmployee.nationality || initialEmployee.salary_matrix?.nationality;
      if (rawNat) {
        setNationality(resolveNationality(rawNat, currentOrInitLang));
      }
      const prefix = (initialEmployee.code || '').trim().toUpperCase().charAt(0);
      const derivedTitle = initialEmployee.jobTitle || initialEmployee.category || (prefix === 'E' ? 'Pharmacist' : prefix === 'D' ? 'Driver' : prefix === 'M' ? 'Management' : prefix === 'W' ? 'Worker' : 'Pharmacist');
      setJobTitle(resolveJobTitle(derivedTitle, currentOrInitLang, prefix));
      if (initialEmployee.docReason) setDestinationName(cleanBilingualString(initialEmployee.docReason, currentOrInitLang));
    }
  }, [initialEmployee, registeredCrs]);

  // Check if salary breakdown is mandatory for current type
  const isSalaryRequired = useMemo(() => {
    return ['embassy_salary', 'bank_salary_iban', 'bank_salary_undertaking'].includes(letterType);
  }, [letterType]);

  // Workforce Database State & Quick Employee Selection
  const [employeesList, setEmployeesList] = useState<Employee[]>(FALLBACK_EMPLOYEES);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(false);
  const [staffCategoryFilter, setStaffCategoryFilter] = useState<'Pharmacist' | 'Others' | 'All'>('Pharmacist');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(initialEmployee?.id || null);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState<string>('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState<boolean>(false);
  const [isSection2DropdownOpen, setIsSection2DropdownOpen] = useState<boolean>(false);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);
  const section2DropdownRef = useRef<HTMLDivElement>(null);

  // Fetch employees from workforceService (with fallback merge)
  useEffect(() => {
    let isMounted = true;
    const fetchEmployees = async () => {
      try {
        setIsLoadingEmployees(true);
        const data = await workforceService.getAllEmployees();
        if (isMounted && data && data.length > 0) {
          const existingIds = new Set(data.map(e => e.id));
          const merged = [...data];
          // Ensure fallback employees are also available if not already in DB
          FALLBACK_EMPLOYEES.forEach(fe => {
            if (!existingIds.has(fe.id) && !merged.some(m => m.full_name.trim().toLowerCase() === fe.full_name.trim().toLowerCase())) {
              merged.push(fe);
            }
          });
          setEmployeesList(merged);
        }
      } catch (err) {
        console.warn('Could not load workforce employees, using fallback list', err);
      } finally {
        if (isMounted) setIsLoadingEmployees(false);
      }
    };
    fetchEmployees();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target as Node)) {
        setIsEmployeeDropdownOpen(false);
      }
      if (section2DropdownRef.current && !section2DropdownRef.current.contains(event.target as Node)) {
        setIsSection2DropdownOpen(false);
      }
      if (docTypeDropdownRef.current && !docTypeDropdownRef.current.contains(event.target as Node)) {
        setIsDocTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Selected document type option & filtered options
  const selectedDocOption = useMemo(() => {
    return DOCUMENT_TYPE_OPTIONS.find(d => d.id === letterType) || DOCUMENT_TYPE_OPTIONS[0];
  }, [letterType]);

  const filteredDocTypes = useMemo(() => {
    let list = DOCUMENT_TYPE_OPTIONS;
    if (docHintFilter !== 'all') {
      list = list.filter(d => d.hintEn.toLowerCase() === docHintFilter.toLowerCase());
    }
    if (!docTypeSearchQuery.trim()) {
      return list;
    }
    const q = docTypeSearchQuery.trim().toLowerCase();
    return list.filter(d =>
      d.labelEn.toLowerCase().includes(q) ||
      d.labelAr.toLowerCase().includes(q) ||
      d.hintEn.toLowerCase().includes(q) ||
      d.hintAr.toLowerCase().includes(q) ||
      d.subEn.toLowerCase().includes(q) ||
      d.subAr.toLowerCase().includes(q)
    );
  }, [docTypeSearchQuery, docHintFilter]);

  // Category counts
  const pharmacistsCount = useMemo(() => {
    return employeesList.filter(e => e.category === 'Pharmacist').length;
  }, [employeesList]);

  const othersCount = useMemo(() => {
    return employeesList.filter(e => e.category !== 'Pharmacist').length;
  }, [employeesList]);

  // Filtered employees list based on category & search query
  const filteredEmployees = useMemo(() => {
    let list = employeesList;
    if (staffCategoryFilter === 'Pharmacist') {
      list = list.filter(e => e.category === 'Pharmacist');
    } else if (staffCategoryFilter === 'Others') {
      list = list.filter(e => e.category !== 'Pharmacist');
    }

    if (!employeeSearchQuery.trim()) {
      return list;
    }
    const q = employeeSearchQuery.trim().toLowerCase();
    return list.filter(e =>
      (e.full_name && e.full_name.toLowerCase().includes(q)) ||
      (e.cpr_number && e.cpr_number.toLowerCase().includes(q)) ||
      (e.code && e.code.toLowerCase().includes(q)) ||
      (e.salary_matrix?.expatPp && e.salary_matrix.expatPp.toLowerCase().includes(q)) ||
      (e.salary_matrix?.nhraLicenseNo && e.salary_matrix.nhraLicenseNo.toLowerCase().includes(q)) ||
      (e.notes && e.notes.toLowerCase().includes(q)) ||
      (e.category && e.category.toLowerCase().includes(q))
    );
  }, [employeesList, staffCategoryFilter, employeeSearchQuery]);

  const selectedEmployee = useMemo(() => {
    return employeesList.find(e => e.id === selectedEmployeeId) || null;
  }, [employeesList, selectedEmployeeId]);

  // Handle employee selection & autofill all cells (which remain 100% editable)
  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployeeId(emp.id);
    setEmployeeName(emp.full_name);

    if (emp.cpr_number) {
      setCpr(emp.cpr_number);
    } else if (emp.salary_matrix?.expatCpr) {
      setCpr(emp.salary_matrix.expatCpr);
    }

    if (emp.salary_matrix?.expatPp) {
      setPassport(emp.salary_matrix.expatPp);
    }

    // Gender auto-detection from Employee profile or salary matrix
    const empGenRaw = emp.gender || emp.salary_matrix?.gender;
    const detectedGen: 'male' | 'female' = (empGenRaw && String(empGenRaw).toLowerCase().includes('female')) ? 'female' : 'male';
    setLetterGender(detectedGen);

    // Role / Job title & NHRA License automatically derived from Staff Category & Prefix Code
    // Prefix codes: E -> Pharmacist, D -> Driver, M -> Management, W -> Worker
    const prefix = (emp.code || '').trim().toUpperCase().charAt(0);
    const isPharmacist = emp.category === 'Pharmacist' || prefix === 'E';
    const isDriver = emp.category === 'Driver' || prefix === 'D';
    const isManagement = emp.category === 'Management' || prefix === 'M';
    const isWorker = emp.category === 'Worker' || prefix === 'W';

    if (isPharmacist) {
      const isAsst = emp.notes?.toLowerCase().includes('assistant') || emp.full_name.toLowerCase().includes('assistant') || emp.notes?.includes('مساعد');
      if (isAsst) {
        setJobTitle(isAr ? (detectedGen === 'female' ? 'مساعدة صيدلي' : 'مساعد صيدلي') : 'Assistant Pharmacist');
      } else {
        setJobTitle(isAr ? (detectedGen === 'female' ? 'صيدلانية' : 'صيدلي') : 'Licensed Pharmacist');
      }

      if (emp.salary_matrix?.nhraLicenseNo) {
        setNhraLicense(emp.salary_matrix.nhraLicenseNo);
      } else {
        setNhraLicense('');
      }
    } else if (isDriver) {
      setJobTitle(isAr ? (detectedGen === 'female' ? 'سائقة خدمات وتوصيل أدوية' : 'سائق خدمات وتوصيل أدوية') : 'Logistics & Pharmacy Delivery Driver');
      setNhraLicense('');
    } else if (isManagement) {
      setJobTitle(isAr ? (detectedGen === 'female' ? 'مسؤولة إدارية ومالية' : 'مسؤول إداري ومالي') : 'Administrative & Management Staff');
      setNhraLicense('');
    } else if (isWorker) {
      setJobTitle(isAr ? (detectedGen === 'female' ? 'عاملة تشغيل وخدمات ومخازن' : 'عامل تشغيل وخدمات ومخازن') : 'Warehouse & Operations Staff');
      setNhraLicense('');
    } else {
      setJobTitle(isAr ? (detectedGen === 'female' ? 'موظفة' : 'موظف') : 'Staff Member');
      setNhraLicense('');
    }

    // Nationality: Automatically read from Workforce Directory (emp.nationality or emp.salary_matrix?.nationality)
    const rawNat = emp.nationality || emp.salary_matrix?.nationality;
    if (rawNat) {
      setNationality(resolveNationality(rawNat, lang, detectedGen));
    } else {
      // Fallback defaults if not yet assigned on employee card
      if (isPharmacist) {
        if (emp.notes?.includes('بحريني') || emp.notes?.toLowerCase().includes('bahraini') || emp.full_name.toLowerCase().includes('khalifa')) {
          setNationality(isAr ? (detectedGen === 'female' ? 'بحرينية' : 'بحريني') : 'Bahraini');
        } else {
          setNationality(isAr ? (detectedGen === 'female' ? 'مصرية' : 'مصري') : 'Egyptian');
        }
      } else if (isDriver) {
        setNationality(isAr ? (detectedGen === 'female' ? 'هندية' : 'هندي') : 'Indian');
      } else if (isWorker) {
        setNationality(isAr ? (detectedGen === 'female' ? 'باكستانية' : 'باكستاني') : 'Pakistani');
      } else {
        setNationality(isAr ? (detectedGen === 'female' ? 'بحرينية' : 'بحريني') : 'Bahraini');
      }
    }

    // Salary matrix autofill
    if (emp.salary_matrix) {
      const sm = emp.salary_matrix;
      if (sm.basicSalary !== undefined) setBasicSalary(sm.basicSalary);
      if (sm.housing !== undefined) setHousingAllowance(sm.housing);
      if (sm.transportation !== undefined) setTransportationAllowance(sm.transportation);
      if (sm.jobResponsibilityBonus !== undefined || sm.longShiftIncentive !== undefined) {
        setIncentiveBonus((sm.jobResponsibilityBonus || 0) + (sm.longShiftIncentive || 0));
      }
    }

    // Reference number
    if (emp.code) {
      setRefNo(generateRefNo(emp.code));
    } else {
      setRefNo(generateRefNo());
    }

    setIsEmployeeDropdownOpen(false);
    setIsSection2DropdownOpen(false);
  };

  // Letter Titles & Subjects Mapping
  const letterTitles = {
    noc_transfer: {
      ar: 'شهادة عدم ممانعة لنقل الكفالة والخدمات (NOC)',
      en: 'NO OBJECTION CERTIFICATE FOR SPONSORSHIP TRANSFER (NOC)',
      subAr: 'خطاب رسمي لعدم ممانعة الانتقال والالتحاق بشركة أخرى',
      subEn: 'Official Transfer & Sponsorship Clearance Certificate'
    },
    experience_certificate: {
      ar: 'شهادة خبرة وخدمة وظيفية رسمية',
      en: 'OFFICIAL CERTIFICATE OF SERVICE & EXPERIENCE',
      subAr: 'بيان الخبرة والكفاءة والسيرة المهنية للموظف',
      subEn: 'Professional Service Record & Performance Certificate'
    },
    active_employment: {
      ar: 'شهادة إثبات عمل',
      en: 'CERTIFICATE OF ACTIVE EMPLOYMENT',
      subAr: 'إفادة رسمية بالاستمرار على رأس العمل لمن يهمه الأمر',
      subEn: 'Official Confirmation of Current Active Employment'
    },
    embassy_salary: {
      ar: 'شهادة تعريف عمل وراتب موجهة للسفارات',
      en: 'EMPLOYMENT & SALARY CERTIFICATE FOR EMBASSY',
      subAr: 'مستند رسمي لطلبات التأشيرات والشنغن والسفارات',
      subEn: 'Official Verification Letter for Visa & Embassy Purposes'
    },
    bank_salary_iban: {
      ar: 'شهادة تفاصيل الراتب واعتماد الحساب البنكي',
      en: 'SALARY DETAILS & BANK ACCOUNT CONFIRMATION',
      subAr: 'بيان مفردات الراتب الشهري المعتمد ورقم الآيبان',
      subEn: 'Monthly Salary Breakdown & IBAN Verification Letter'
    },
    bank_salary_undertaking: {
      ar: 'خطاب تعهد وتثبيت تحويل راتب لقرض بنكي',
      en: 'IRREVOCABLE SALARY TRANSFER UNDERTAKING TO BANK',
      subAr: 'تعهد والتزام مصرفي غير قابل للإلغاء لمنح التمويل والقروض',
      subEn: 'Official Irrevocable Undertaking for Bank Loan & Facilities'
    }
  };

  // Language-Pure Resolved Attributes
  const resolvedNationality = useMemo(() => resolveNationality(nationality, lang, letterGender), [nationality, lang, letterGender]);
  const resolvedJobTitle = useMemo(() => resolveJobTitle(jobTitle, lang, undefined, letterGender), [jobTitle, lang, letterGender]);
  const resolvedDestination = useMemo(() => cleanBilingualString(destinationName, lang), [destinationName, lang]);
  const resolvedNewCompany = useMemo(() => cleanBilingualString(newCompanyName, lang), [newCompanyName, lang]);
  const resolvedBank = useMemo(() => cleanBilingualString(bankName, lang), [bankName, lang]);

  // Addressee Header (Dynamic Default vs Custom Override)
  const defaultAddresseeHeader = useMemo(() => {
    if (letterType === 'embassy_salary') {
      return isAr
        ? `إلى: ${resolvedDestination || 'السفارة / القنصلية الموقرة'}`
        : `To: ${resolvedDestination || 'The Respective Embassy / Consulate'}`;
    }
    if (letterType === 'bank_salary_iban') {
      return isAr
        ? `إلى: إدارة العمليات المصرفية - ${resolvedBank || 'المصرف الموقر'}`
        : `To: Banking Operations Department - ${resolvedBank || 'The Respective Bank'}`;
    }
    if (letterType === 'bank_salary_undertaking') {
      return isAr
        ? `إلى: إدارة الائتمان والتمويل - ${resolvedBank || 'المصرف الموقر'}`
        : `To: Credit & Loans Department - ${resolvedBank || 'The Respective Bank'}`;
    }
    return isAr ? 'إلى من يهمه الأمر،' : 'To Whom It May Concern,';
  }, [letterType, isAr, resolvedDestination, resolvedBank]);

  const effectiveAddresseeHeader = useMemo(() => {
    return customAddressee.trim() ? customAddressee.trim() : defaultAddresseeHeader;
  }, [customAddressee, defaultAddresseeHeader]);

  // Preamble logic
  const holderWordAr = isFemale ? 'حاملة' : 'حامل';
  const workWordAr = isFemale ? 'تعمل لدينا' : 'يعمل لدينا';

  const arPreamble = `تشهد شركة ${selectedCr.cr_name_ar} (سجل تجاري رقم: ${selectedCr.cr_number}) بأن ${employeeName}، ${resolvedNationality} الجنسية، ${holderWordAr} بطاقة هوية رقم (${cpr}) وجواز سفر رقم (${passport})، ${workWordAr} بوظيفة (${resolvedJobTitle})${nhraLicense ? `، وترخيص مزاولة المهنة من الهيئة الوطنية لتنظيم المهن والخدمات الصحية (NHRA) رقم: (${nhraLicense})` : ''} اعتباراً من تاريخ ${joinDate}`;

  const enPreamble = `This is to certify that ${employeeName},  ${resolvedNationality} national holding CPR No. ${cpr} and Passport No. ${passport}, is employed with ${selectedCr.cr_name} (CR No: ${selectedCr.cr_number}) as ${resolvedJobTitle}${nhraLicense ? `, licensed by NHRA under License No: (${nhraLicense})` : ''} since ${joinDate}`;

  // Generated Body Clauses
  const letterBodyContent = useMemo(() => {
    switch (letterType) {
      case 'noc_transfer':
        return isAr
          ? `${arPreamble}... وتفيد الشركة بأنه لا مانع لدينا من نقل ${isFemale ? 'كفالتها/إقامتها والتحاقها' : 'كفالته/إقامته والتحاقه'} بالعمل لدى شركة ${resolvedNewCompany || '[اسم الشركة الجديدة]'}، دون أي التزام أو مسؤولية قانونية أو مالية تترتب على شركتنا تجاه الغير، وتم إصدار هذه الشهادة بناءً على ${isFemale ? 'طلبها' : 'طلبه'}.`
          : `${enPreamble}... ${selectedCr.cr_name} confirms that we have no objection to the transfer of ${isFemale ? 'her' : 'his'} sponsorship and employment to ${resolvedNewCompany || '[New Company Name]'}, without any legal or financial liability on our part towards third parties. This certificate is issued upon ${isFemale ? 'her' : 'his'} request.`;

      case 'experience_certificate':
        return isAr
          ? `تشهد إدارة شركة ${selectedCr.cr_name_ar} (سجل تجاري رقم: ${selectedCr.cr_number}) بأن ${employeeName}، ${resolvedNationality} الجنسية، ${isFemale ? 'حاملة' : 'حامل'} بطاقة هوية رقم (${cpr}) وجواز سفر رقم (${passport})${nhraLicense ? `، ترخيص نهرا رقم (${nhraLicense})` : ''}، قد اكتسب${isFemale ? 'ت' : ''} خبرة وظيفية لدينا بالعمل بمسمى (${resolvedJobTitle}) وذلك خلال الفترة من ${joinDate} حتى ${endDate || '[تاريخ انتهاء الخدمة]'}. وخلال فترة عمل${isFemale ? 'ها أظهرت' : 'ه أظهر'} كفاءة مهنية عالية والتزاماً تاماً بالمسؤوليات والمهام الموكلة إلي${isFemale ? 'ها، وكانت حسنة' : 'ه، وكان حسن'} السيرة والسلوك. قُدمت له${isFemale ? 'ا' : ''} هذه الشهادة بناءً على طلب${isFemale ? 'ها' : 'ه'} مع تمنياتنا له${isFemale ? 'ا' : ''} بمزيد من التوفيق والنجاح المهني.`
          : `This is to certify that ${employeeName},  ${resolvedNationality} national holding CPR No. ${cpr} and Passport No. ${passport}${nhraLicense ? `, NHRA License No: ${nhraLicense}` : ''}, has acquired professional work experience with ${selectedCr.cr_name} (CR No: ${selectedCr.cr_number}) serving as ${resolvedJobTitle} from ${joinDate} to ${endDate || '[End Date]'}. Throughout ${isFemale ? 'her' : 'his'} tenure, ${isFemale ? 'she' : 'he'} demonstrated high professional competence, integrity, and dedication to all assigned responsibilities. This certificate is issued upon ${isFemale ? 'her' : 'his'} request, wishing ${isFemale ? 'her' : 'him'} continued career success.`;

      case 'active_employment':
        return isAr
          ? `${arPreamble} بموجب عقد عمل ساري المفعول وحتى تاريخه، وما زال${isFemale ? 'ت على رأس عملها' : ' على رأس عمله'}. أعطيت له${isFemale ? 'ا' : ''} هذه الشهادة بناءً على طلب${isFemale ? 'ها' : 'ه'} لتقديمها للجهات المعنية دون أدنى مسؤولية على الشركة.`
          : `${enPreamble} under an active, valid employment contract and continues to be in active service to date. This letter is issued upon ${isFemale ? 'her' : 'his'} request for official purposes without liability on the company.`;

      case 'embassy_salary':
        return isAr
          ? `${arPreamble} بدوام كامل ومستمر${isFemale ? 'ة' : ''} بالعمل.\nنوضح أدناه جدول مفردات الراتب الشهري المعتمد للموظف${isFemale ? 'ة' : ''}:`
          : `${enPreamble} on a full-time, active employment status.\nPlease find below the approved monthly salary matrix breakdown for the employee:`;

      case 'bank_salary_iban':
        return isAr
          ? `${arPreamble}.\nنحيطكم علماً بمفردات الراتب الشهري للمذكور${isFemale ? 'ة' : ''} كما هو موضح بالجدول أدناه:`
          : `${enPreamble}.\nPlease find below the detailed monthly salary matrix breakdown for the employee:`;

      case 'bank_salary_undertaking':
        return isAr
          ? `بناءً على طلب الموظف${isFemale ? 'ة' : ''}، ${arPreamble}.\nنوضح أدناه مفردات راتبه${isFemale ? 'ا' : ''} الشهري:`
          : `Upon the request of the employee, ${enPreamble}.\nPlease find below the monthly salary matrix breakdown:`;
    }
  }, [letterType, isAr, isFemale, arPreamble, enPreamble, selectedCr, employeeName, resolvedNationality, cpr, passport, resolvedJobTitle, nhraLicense, joinDate, endDate, resolvedNewCompany]);

  // Post-table paragraph text
  const postTableClause = useMemo(() => {
    if (letterType === 'embassy_salary') {
      return isAr
        ? (isFemale ? 'كما نؤكد أن الشركة وافقت على منحها إجازة رسمية للسفر، وستعود لمباشرة عملها فور انتهاء الإجازة.' : 'كما نؤكد أن الشركة وافقت على منحه إجازة رسمية للسفر، وسيعود لمباشرة عمله فور انتهاء الإجازة.')
        : (isFemale ? 'We confirm that approved leave has been granted for her travel, and she will resume her official employment upon return.' : 'We confirm that approved leave has been granted for his travel, and he will resume his official employment upon return.');
    }
    if (letterType === 'bank_salary_iban') {
      return isAr
        ? (isFemale ? `ويتم تحويل صافي راتبها الشهري بانتظام إلى حسابها المصرفي لديكم رقم الآيبان: ${iban || '[رقم الآيبان]'}.` : `ويتم تحويل صافي راتبه الشهري بانتظام إلى حسابه المصرفي لديكم رقم الآيبان: ${iban || '[رقم الآيبان]'}.`)
        : (isFemale ? `Her net monthly salary is regularly transferred directly to her account with your bank under IBAN: ${iban || '[IBAN Number]'}.` : `His net monthly salary is regularly transferred directly to his account with your bank under IBAN: ${iban || '[IBAN Number]'}.`);
    }
    if (letterType === 'bank_salary_undertaking') {
      return isAr
        ? (isFemale ? `ونتعهد نحن شركة ${selectedCr.cr_name_ar} بتحويل راتبها الشهري إلى حسابها لديكم رقم الآيبان (${iban || '[رقم الآيبان]'}). كما نتعهد بعدم إيقاف أو تحويل الراتب لبنك آخر، أو صرف مستحقات مكافأة نهاية الخدمة إلا بعد استلام خطاب براءة ذمة رسمي ونهائي من مصرفكم الموقر.` : `ونتعهد نحن شركة ${selectedCr.cr_name_ar} بتحويل راتبه الشهري إلى حسابه لديكم رقم الآيبان (${iban || '[رقم الآيبان]'}). كما نتعهد بعدم إيقاف أو تحويل الراتب لبنك آخر، أو صرف مستحقات مكافأة نهاية الخدمة إلا بعد استلام خطاب براءة ذمة رسمي ونهائي من مصرفكم الموقر.`)
        : (isFemale ? `${selectedCr.cr_name} irrevocably undertakes to transfer her monthly salary directly to her account with your bank (IBAN: ${iban || '[IBAN Number]'}). We further undertake not to divert or cease her salary transfer, nor release end-of-service gratuity, without receiving an official written clearance letter from your bank.` : `${selectedCr.cr_name} irrevocably undertakes to transfer his monthly salary directly to his account with your bank (IBAN: ${iban || '[IBAN Number]'}). We further undertake not to divert or cease his salary transfer, nor release end-of-service gratuity, without receiving an official written clearance letter from your bank.`);
    }
    return '';
  }, [letterType, isAr, isFemale, selectedCr, iban]);

  // Print Document Trigger
  const handlePrint = () => {
    const letterElem = document.getElementById('printable-official-hr-sheet');
    if (!letterElem) {
      window.print();
      return;
    }

    const printWin = window.open('', '_blank', 'width=950,height=1100');
    if (!printWin) {
      window.print();
      return;
    }

    const content = letterElem.innerHTML;
    const docTitle = `Official_HR_Letter_${refNo.replace(/[^a-zA-Z0-9]/g, '_')}_${letterType}${withoutSealAndSignature ? '_NoSealNoSign' : ''}`;

    printWin.document.write(`
      <!DOCTYPE html>
      <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
      <head>
        <title>${docTitle}</title>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          @media print {
            body { margin: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .no-print { display: none !important; }
          }
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            font-family: ${isAr ? "'Cairo', Arial, sans-serif" : "Arial, 'Inter', sans-serif"} !important;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .a4-page {
            width: 210mm;
            min-height: 297mm;
            padding: 18mm 18mm;
            margin: 0 auto;
            box-sizing: border-box;
            background: #fff;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .header-table {
            width: 100%;
            border-bottom: 3px solid #0f172a !important;
            padding-bottom: 14px !important;
            margin-bottom: 20px !important;
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
            direction: ${isAr ? 'rtl' : 'ltr'} !important;
          }
          .cr-logo-wrap {
            flex-shrink: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .cr-logo {
            max-height: 75px !important;
            max-width: 120px !important;
            object-fit: contain !important;
            display: block !important;
          }
          .cr-text-block {
            flex: 1 !important;
            text-align: ${isAr ? 'right' : 'left'} !important;
            ${isAr ? 'margin-right: 12px !important; margin-left: 0 !important;' : 'margin-left: 12px !important; margin-right: 0 !important;'}
          }
          .cr-title-en {
            font-size: 17.5px !important;
            font-weight: 900 !important;
            color: #0f172a !important;
            text-transform: uppercase !important;
            letter-spacing: -0.2px !important;
            font-family: Arial, sans-serif !important;
            text-align: ${isAr ? 'right' : 'left'} !important;
          }
          .cr-title-ar {
            font-size: 15.5px !important;
            font-weight: 800 !important;
            color: #1e293b !important;
            margin-top: 3px !important;
            direction: rtl !important;
            text-align: ${isAr ? 'right' : 'left'} !important;
          }
          .cr-meta {
            font-size: 10.5px !important;
            font-family: monospace !important;
            font-weight: 600 !important;
            color: #475569 !important;
            margin-top: 5px !important;
            line-height: 1.45 !important;
            text-align: ${isAr ? 'right' : 'left'} !important;
          }
          .doc-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            border-bottom: 1px solid #e2e8f0 !important;
            padding-bottom: 10px !important;
            margin-bottom: 20px !important;
            font-size: 12.5px !important;
            direction: ${isAr ? 'rtl' : 'ltr'} !important;
          }
          .doc-ref {
            font-family: monospace !important;
            font-weight: bold !important;
            color: #0284c7 !important;
            background: #f0f9ff !important;
            padding: 2px 8px !important;
            border-radius: 4px !important;
            border: 1px solid #bae6fd !important;
          }
          .footer-section {
            margin-top: 35px !important;
            padding-top: 20px !important;
            border-top: 1px solid #e2e8f0 !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-end !important;
            direction: ltr !important;
          }
          .sig-box {
            text-align: center !important;
            width: 220px !important;
          }
          .sig-img {
            max-height: 80px !important;
            max-width: 200px !important;
            object-fit: contain !important;
            filter: contrast(1.2) !important;
          }
          .sig-name {
            font-size: 13px !important;
            font-weight: 900 !important;
            color: #0f172a !important;
            margin-top: 5px !important;
          }
          .sig-title {
            font-size: 11px !important;
            font-weight: 800 !important;
            color: #0284c7 !important;
            text-transform: uppercase !important;
          }
          .seal-box {
            width: 220px !important;
            border: 1.5px solid #94a3b8 !important;
            border-radius: 10px !important;
            padding: 10px !important;
            text-align: center !important;
            background: #f8fafc !important;
          }
          .seal-label {
            font-size: 9px !important;
            font-weight: 900 !important;
            text-transform: uppercase !important;
            color: #475569 !important;
            border-bottom: 1px solid #cbd5e1 !important;
            padding-bottom: 4px !important;
            margin-bottom: 8px !important;
            display: block !important;
            letter-spacing: 0.5px !important;
          }
          .seal-img {
            max-height: 90px !important;
            width: 100% !important;
            object-fit: contain !important;
            display: block !important;
            margin: 0 auto !important;
          }
        </style>
      </head>
      <body>
        <div class="a4-page">
          ${content}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 350);
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  // Download Word Document
  const handleDownloadWord = async () => {
    try {
      setIsDownloadingWord(true);
      const letterData: HrLetterData = {
        letterType,
        lang,
        gender: letterGender,
        cr: selectedCr,
        refNo,
        issueDate,
        withoutSealAndSignature,
        employeeName,
        cpr,
        passport,
        nationality: resolvedNationality,
        jobTitle: resolvedJobTitle,
        nhraLicense: nhraLicense.trim() ? nhraLicense.trim() : undefined,
        joinDate,
        endDate: letterType === 'experience_certificate' ? endDate : undefined,
        basicSalary,
        housingAllowance,
        transportationAllowance,
        incentiveBonus,
        totalSalary: effectiveTotalSalary,
        bankName: resolvedBank,
        iban,
        destinationName: resolvedDestination,
        newCompanyName: resolvedNewCompany,
        customNotes: customNotes.trim() ? customNotes.trim() : undefined,
        customAddressee: customAddressee.trim() ? customAddressee.trim() : undefined,
        signatoryName,
        signatoryRole: isAr ? signatoryRoleAr : signatoryRoleEn
      };

      const blob = await generateHrLetterDocxBlob(letterData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Official_HR_Letter_${employeeName.replace(/[^a-zA-Z0-9]/g, '_')}_${letterType}${withoutSealAndSignature ? '_NoSealNoSign' : ''}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Word generation failed:', e);
      alert(isAr ? 'حدث خطأ أثناء تصدير مستند Word' : 'Failed to export Word document');
    } finally {
      setIsDownloadingWord(false);
    }
  };

  // Copy plain text to clipboard
  const handleCopyText = () => {
    const lines: string[] = [];
    lines.push(isAr ? selectedCr.cr_name_ar : selectedCr.cr_name);
    lines.push(`CR NO: ${selectedCr.cr_number} | Date: ${issueDate} | Ref: ${refNo}`);
    lines.push('--------------------------------------------------');
    lines.push(letterTitles[letterType][lang].toUpperCase());
    lines.push('--------------------------------------------------');
    lines.push(effectiveAddresseeHeader);
    lines.push(letterBodyContent);
    if (isSalaryRequired) {
      lines.push('\n[Salary Matrix Breakdown - BHD]');
      lines.push(`Basic Salary: ${basicSalary.toFixed(3)} BHD`);
      lines.push(`Housing: ${housingAllowance.toFixed(3)} BHD`);
      lines.push(`Transportation: ${transportationAllowance.toFixed(3)} BHD`);
      lines.push(`Incentive Bonus: ${incentiveBonus.toFixed(3)} BHD`);
      lines.push(`TOTAL MONTHLY: ${effectiveTotalSalary.toFixed(3)} BHD\n`);
      if (postTableClause) lines.push(postTableClause);
    }
    if (customNotes.trim()) {
      lines.push(`\nNote: ${customNotes.trim()}`);
    }
    lines.push('\n' + (isAr ? signatoryRoleAr : signatoryRoleEn) + ': ' + signatoryName);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans selection:bg-brand/10 direction-ltr">
      {/* Top Application Header Bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 py-3.5 shrink-0">
        <div className="max-w-[1640px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Title */}
          <div className="flex items-center gap-3.5">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80 transition-all cursor-pointer active:scale-95"
                title="Back to Workforce Directory"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Award className="w-5 h-5 text-brand" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">
                  Official HR Letter &amp; Corporate Identity Generator
                </h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80">
                  Official Suite
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Standardized legal certificates, NHRA verification &amp; corporate CR letterhead
              </p>
            </div>
          </div>

          {/* Global Document Settings & Export Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Document Language Segmented Control */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-500 pl-2.5 pr-1.5 flex items-center gap-1">
                <Languages className="w-3.5 h-3.5 text-slate-400" />
                <span>Language:</span>
              </span>
              <button
                type="button"
                onClick={() => handleLetterLanguageSwitch('en')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  letterLang === 'en'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => handleLetterLanguageSwitch('ar')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  letterLang === 'ar'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                عربي
              </button>
            </div>

            {/* Gender Phrasing Segmented Control */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-500 pl-2.5 pr-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Gender:</span>
              </span>
              <button
                type="button"
                onClick={() => handleGenderSwitch('male')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  letterGender === 'male'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Male phrasing (مصري / حامل / يعمل)"
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => handleGenderSwitch('female')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  letterGender === 'female'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Female phrasing (مصرية / حاملة / تعمل)"
              >
                Female
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 hidden sm:block mx-0.5" />

            {/* Without Seal & Signature Toggle */}
            <label
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all border select-none ${
                withoutSealAndSignature
                  ? 'bg-amber-50/90 text-amber-800 border-amber-200'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200/80'
              }`}
              title="Hide digital seal and signature for physical stamping on pre-printed letterhead"
            >
              <input
                type="checkbox"
                checked={withoutSealAndSignature}
                onChange={(e) => setWithoutSealAndSignature(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-slate-900 focus:ring-0 border-slate-300 accent-slate-900 cursor-pointer"
              />
              <span>No Digital Stamp</span>
            </label>

            {/* Copy Text */}
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Copy plain text to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Word Download */}
            <button
              type="button"
              onClick={handleDownloadWord}
              disabled={isDownloadingWord}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
              title="Download Microsoft Word (.docx)"
            >
              <Download className="w-3.5 h-3.5 text-brand" />
              <span>{isDownloadingWord ? 'Exporting...' : 'Word (.docx)'}</span>
            </button>

            {/* Print / Save PDF */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
              title="Print or save as official PDF"
            >
              <Printer className="w-3.5 h-3.5 text-brand" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Balanced Workspace */}
      <main className="flex-1 max-w-[1640px] w-full mx-auto px-4 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ================= LEFT COLUMN: ORGANIZED CONFIGURATION PANEL (5 COLS) ================= */}
          <aside className="lg:col-span-5 space-y-5">
            {/* STEP 1: CORPORATE ENTITY & TEMPLATE TYPE */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Corporate Identity &amp; Document Type
                  </h2>
                </div>
                <span className="text-[11px] font-mono font-semibold text-slate-500 bg-slate-50 px-2.5 py-0.5 rounded-md border border-slate-200/70">
                  CR: {selectedCr.cr_number}
                </span>
              </div>

              {/* Emitting Corporate Entity Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Issuing Commercial Registration (CR)
                  </label>
                  {selectedCr.is_master && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold border border-amber-200/60">
                      Master Entity
                    </span>
                  )}
                </div>
                <select
                  value={selectedCrId}
                  onChange={(e) => setSelectedCrId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 transition-all cursor-pointer"
                >
                  {registeredCrs.map(c => {
                    const branchLabel = c.linked_branch_name ? ` [${c.linked_branch_name}]` : '';
                    const arLabel = c.cr_name_ar ? ` — ${c.cr_name_ar}` : '';
                    return (
                      <option key={c.id} value={c.id}>
                        {c.cr_name} (CR: {c.cr_number}){arLabel}{branchLabel}
                      </option>
                    );
                  })}
                </select>

                {/* Clean Entity Identity Summary Pill */}
                <div className="px-3.5 py-2.5 bg-slate-50/60 border border-slate-200/60 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{selectedCr.cr_name}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {selectedCr.linked_branch_name ? `Branch: ${selectedCr.linked_branch_name} • ` : ''}
                      Tel: {selectedCr.phone || '+973 33866650'}
                    </p>
                  </div>
                  <div className="text-right shrink-0 dir-rtl">
                    <p className="font-bold text-slate-800">{selectedCr.cr_name_ar || '-'}</p>
                    <p className="text-[10px] font-mono text-slate-500">CR #{selectedCr.cr_number}</p>
                  </div>
                </div>
              </div>

              {/* 6 Official Document Templates Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Select Letter Template
                  </label>
                  <span className="text-[11px] text-slate-400">6 Official Templates</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {DOCUMENT_TYPE_OPTIONS.map(doc => {
                    const isSelected = letterType === doc.id;
                    const DocIcon = doc.icon;
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setLetterType(doc.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer relative ${
                          isSelected
                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                            : 'bg-slate-50/60 hover:bg-slate-100/70 border-slate-200/80 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-white/15 text-white' : 'bg-white text-slate-600 border border-slate-200/80'
                          }`}>
                            <DocIcon className="w-3.5 h-3.5" />
                          </div>
                          <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-white/15 text-slate-200' : 'bg-slate-200/70 text-slate-500'
                          }`}>
                            {doc.hintEn}
                          </span>
                        </div>

                        <div className="min-w-0 w-full">
                          <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                            {doc.labelEn}
                          </p>
                          <p className={`text-[10px] truncate mt-0.5 dir-rtl text-left ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                            {doc.labelAr}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Document Reference, Date & Addressee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 border-t border-slate-100">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">Reference Number</label>
                    <button
                      type="button"
                      onClick={() => setRefNo(generateRefNo())}
                      className="text-[11px] text-slate-500 hover:text-slate-900 cursor-pointer flex items-center gap-1 transition-colors"
                      title="Generate new reference number"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={refNo}
                    onChange={(e) => setRefNo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-mono font-semibold outline-none focus:border-slate-400 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Issue Date</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 transition-all"
                  />
                </div>
              </div>

              {/* Addressee Override */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Addressee Header <span className="text-slate-400 font-normal">(Optional override)</span>
                  </label>
                  {customAddressee.trim() && (
                    <button
                      type="button"
                      onClick={() => setCustomAddressee('')}
                      className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                    >
                      Use Default
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={customAddressee}
                  onChange={(e) => setCustomAddressee(e.target.value)}
                  placeholder={defaultAddresseeHeader}
                  className="w-full px-3.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 transition-all"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: isAr ? 'إلى من يهمه الأمر' : 'To Whom It May Concern', val: isAr ? 'إلى من يهمه الأمر،' : 'To Whom It May Concern,' },
                    { label: 'NHRA', val: isAr ? 'إلى: الهيئة الوطنية لتنظيم المهن والخدمات الصحية (NHRA)' : 'To: National Health Regulatory Authority (NHRA)' },
                    { label: isAr ? 'وزارة الصحة' : 'Ministry of Health', val: isAr ? 'إلى: وزارة الصحة' : 'To: Ministry of Health' },
                    { label: 'NBB Bank', val: isAr ? 'إلى: بنك البحرين الوطني (NBB)' : 'To: National Bank of Bahrain (NBB)' }
                  ].map(item => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setCustomAddressee(item.val)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100/80 hover:bg-slate-200/70 text-[11px] font-medium text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* STEP 2: EMPLOYEE DIRECTORY & IDENTITY DETAILS */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Employee Identity &amp; Service Record
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {nhraLicense.trim() && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/70">
                      NHRA Licensed
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 font-mono">
                    {isLoadingEmployees ? 'Syncing...' : `${employeesList.length} Staff`}
                  </span>
                </div>
              </div>

              {/* Unified Quick Employee Directory Lookup */}
              <div className="space-y-2.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/70" ref={employeeDropdownRef}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <span>Autofill from Workforce Directory</span>
                  </span>

                  {/* Category Filter Pills */}
                  <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200/80 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setStaffCategoryFilter('Pharmacist');
                        setIsEmployeeDropdownOpen(true);
                      }}
                      className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                        staffCategoryFilter === 'Pharmacist'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pharmacists ({pharmacistsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffCategoryFilter('Others');
                        setIsEmployeeDropdownOpen(true);
                      }}
                      className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                        staffCategoryFilter === 'Others'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Others ({othersCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffCategoryFilter('All');
                        setIsEmployeeDropdownOpen(true);
                      }}
                      className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                        staffCategoryFilter === 'All'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All
                    </button>
                  </div>
                </div>

                {/* Dropdown Selector Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                    className="w-full px-3.5 py-2.5 bg-white hover:bg-slate-50/50 border border-slate-200/90 rounded-xl text-left transition-all flex items-center justify-between gap-2 cursor-pointer shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      {selectedEmployee ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {selectedEmployee.full_name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200/80">
                              {selectedEmployee.code}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 truncate shrink-0">
                            CPR: {selectedEmployee.cpr_number || selectedEmployee.salary_matrix?.expatCpr || 'N/A'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Select an employee to populate fields automatically...
                        </span>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                      isEmployeeDropdownOpen ? 'rotate-180 text-slate-900' : ''
                    }`} />
                  </button>

                  {isEmployeeDropdownOpen && (
                    <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 space-y-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          autoFocus
                          value={employeeSearchQuery}
                          onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                          placeholder="Search by name, CPR, passport, or code..."
                          className="w-full pl-9 pr-8 py-2 bg-slate-50 focus:bg-white text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 transition-all"
                        />
                        {employeeSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setEmployeeSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
                        {filteredEmployees.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">
                            No matching employee found
                          </div>
                        ) : (
                          filteredEmployees.map((emp) => {
                            const isSelected = emp.id === selectedEmployeeId;
                            const isPharm = emp.category === 'Pharmacist';
                            return (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => handleSelectEmployee(emp)}
                                className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                                  isSelected
                                    ? 'bg-slate-900 text-white'
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                      {emp.full_name}
                                    </p>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                      isSelected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {emp.code}
                                    </span>
                                  </div>
                                  <div className={`flex items-center gap-2 text-[10px] truncate mt-0.5 ${
                                    isSelected ? 'text-slate-300' : 'text-slate-500'
                                  }`}>
                                    <span>CPR: {emp.cpr_number || emp.salary_matrix?.expatCpr || 'N/A'}</span>
                                    {(emp.nationality || emp.salary_matrix?.nationality) && (
                                      <span>• {resolveNationality(emp.nationality || emp.salary_matrix?.nationality, lang)}</span>
                                    )}
                                    {isPharm && emp.salary_matrix?.nhraLicenseNo && (
                                      <span className="font-mono">• NHRA: {emp.salary_matrix.nhraLicenseNo}</span>
                                    )}
                                  </div>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {selectedEmployee && (
                  <div className="flex items-center justify-between px-1 pt-0.5 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Fields autofilled — you can edit any detail below</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmployeeId(null);
                        setEmployeeSearchQuery('');
                        setEmployeeName('');
                        setCpr('');
                        setPassport('');
                        setNationality('');
                        setJobTitle('');
                        setNhraLicense('');
                        setJoinDate('');
                        setEndDate('');
                        setBasicSalary(0);
                        setHousingAllowance(0);
                        setTransportationAllowance(0);
                        setIncentiveBonus(0);
                        setIsManualTotal(false);
                        setManualTotalSalary(0);
                      }}
                      className="text-slate-500 hover:text-slate-900 underline cursor-pointer font-medium"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Employee Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Employee Full Name (As in Passport / CPR)
                </label>
                <input
                  type="text"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="e.g. Dr. Ali Hassan Mohamed"
                  className="w-full px-3.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 transition-all"
                />
              </div>

              {/* CPR & Passport */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">CPR / Identity Number</label>
                  <input
                    type="text"
                    value={cpr}
                    onChange={(e) => setCpr(e.target.value)}
                    placeholder="e.g. 910542318"
                    className="w-full px-3.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-mono font-semibold outline-none focus:border-slate-400 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Passport Number</label>
                  <input
                    type="text"
                    value={passport}
                    onChange={(e) => setPassport(e.target.value)}
                    placeholder="e.g. A28491823"
                    className="w-full px-3.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-mono font-semibold outline-none focus:border-slate-400 transition-all"
                  />
                </div>
              </div>

              {/* Nationality & Job Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Nationality</label>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    placeholder="e.g. Egyptian / Bahraini"
                    className="w-full px-3.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Job Title / Designation</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Licensed Pharmacist"
                    className="w-full px-3.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 transition-all"
                  />
                </div>
              </div>

              {/* NHRA License & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 border-t border-slate-100">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>NHRA License No.</span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </label>
                  <input
                    type="text"
                    value={nhraLicense}
                    onChange={(e) => setNhraLicense(e.target.value)}
                    placeholder="Leave blank if non-medical"
                    className="w-full px-3.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-mono font-semibold outline-none focus:border-slate-400 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Date of Joining</label>
                  <input
                    type="date"
                    value={joinDate}
                    onChange={(e) => setJoinDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 transition-all"
                  />
                </div>
              </div>

              {letterType === 'experience_certificate' && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-amber-800 block">
                    Service End Date (For Experience Certificate)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-amber-50/40 hover:bg-amber-50/70 focus:bg-white text-slate-900 border border-amber-300/80 rounded-xl text-xs font-semibold outline-none focus:border-amber-500 transition-all"
                  />
                </div>
              )}
            </div>

            {/* CONTEXTUAL DESTINATION / BANKING DETAILS (IF APPLICABLE) */}
            {(letterType === 'noc_transfer' || letterType === 'embassy_salary' || letterType === 'bank_salary_iban' || letterType === 'bank_salary_undertaking') && (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-slate-700" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Destination &amp; Banking Details
                    </h2>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                    Contextual Fields
                  </span>
                </div>

                {letterType === 'noc_transfer' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      New Employer / Company Name (For Transfer)
                    </label>
                    <input
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="e.g. Gulf Health Solutions W.L.L / شركة حلول الخليج الصحية"
                      className="w-full px-3.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 transition-all"
                    />
                  </div>
                )}

                {letterType === 'embassy_salary' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Destination Embassy / Consulate Name
                    </label>
                    <input
                      type="text"
                      value={destinationName}
                      onChange={(e) => setDestinationName(e.target.value)}
                      placeholder="e.g. Embassy of France in Bahrain / سفارة فرنسا"
                      className="w-full px-3.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 transition-all"
                    />
                  </div>
                )}

                {(letterType === 'bank_salary_iban' || letterType === 'bank_salary_undertaking') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 block">Bank Name</label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. National Bank of Bahrain (NBB)"
                        className="w-full px-3.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 block">Employee IBAN Number</label>
                      <input
                        type="text"
                        value={iban}
                        onChange={(e) => setIban(e.target.value.toUpperCase())}
                        placeholder="BH29NBOB00000012345678"
                        className="w-full px-3.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-mono font-semibold outline-none focus:border-slate-400 tracking-wide transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: MONTHLY SALARY MATRIX BREAKDOWN (BHD) */}
            <div className={`bg-white border rounded-2xl p-5 shadow-2xs space-y-4 transition-all ${
              isSalaryRequired ? 'border-slate-300' : 'border-slate-200/80'
            }`}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                    3
                  </span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Monthly Salary Matrix (BHD)
                  </h2>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${
                  isSalaryRequired
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                    : 'bg-slate-50 text-slate-500 border-slate-200/70'
                }`}>
                  {isSalaryRequired ? 'Included in Document' : 'Not Shown on Current Template'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-600 block">Basic Salary</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={basicSalary}
                      onChange={(e) => setBasicSalary(parseFloat(e.target.value) || 0)}
                      className="w-full pl-9 pr-2.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-mono font-semibold outline-none focus:border-slate-400 text-right transition-all"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-mono">BHD</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-600 block">Housing</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={housingAllowance}
                      onChange={(e) => setHousingAllowance(parseFloat(e.target.value) || 0)}
                      className="w-full pl-9 pr-2.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-mono font-semibold outline-none focus:border-slate-400 text-right transition-all"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-mono">BHD</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-600 block">Transport</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={transportationAllowance}
                      onChange={(e) => setTransportationAllowance(parseFloat(e.target.value) || 0)}
                      className="w-full pl-9 pr-2.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-mono font-semibold outline-none focus:border-slate-400 text-right transition-all"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-mono">BHD</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-600 block">Incentives</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={incentiveBonus}
                      onChange={(e) => setIncentiveBonus(parseFloat(e.target.value) || 0)}
                      className="w-full pl-9 pr-2.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-mono font-semibold outline-none focus:border-slate-400 text-right transition-all"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-mono">BHD</span>
                  </div>
                </div>
              </div>

              {/* Net Monthly Total Bar */}
              <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900">Total Monthly Net Salary</p>
                  <label className="text-[11px] text-slate-500 flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isManualTotal}
                      onChange={(e) => {
                        setIsManualTotal(e.target.checked);
                        if (!e.target.checked) setManualTotalSalary(calculatedTotalSalary);
                      }}
                      className="rounded text-slate-900 accent-slate-900 w-3.5 h-3.5"
                    />
                    <span>Manual total override</span>
                  </label>
                </div>

                <div className="text-right">
                  {isManualTotal ? (
                    <div className="relative w-32">
                      <input
                        type="number"
                        step="0.001"
                        value={manualTotalSalary}
                        onChange={(e) => setManualTotalSalary(parseFloat(e.target.value) || 0)}
                        className="w-full pl-9 pr-2.5 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm font-mono font-bold text-right outline-none focus:border-slate-500"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">BHD</span>
                    </div>
                  ) : (
                    <div className="text-base font-bold font-mono text-slate-900">
                      {effectiveTotalSalary.toFixed(3)} <span className="text-xs text-slate-500 font-normal">BHD</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* STEP 4: SIGNATORY & ADDITIONAL REMARKS */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                    4
                  </span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Signatory &amp; Custom Remarks
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-700 block">
                    Authorized Signatory
                  </label>
                  <input
                    type="text"
                    value={signatoryName}
                    onChange={(e) => handleUpdateSignatoryName(e.target.value)}
                    placeholder="Dr. Fathy Saad Amin"
                    className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                    <span>Title (Arabic)</span>
                    {isLetterAr && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Active on Letter" />}
                  </label>
                  <input
                    type="text"
                    value={signatoryRoleAr}
                    onChange={(e) => handleUpdateSignatoryRoleAr(e.target.value)}
                    placeholder="المدير العام"
                    className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 transition-all dir-rtl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                    <span>Title (English)</span>
                    {!isLetterAr && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Active on Letter" />}
                  </label>
                  <input
                    type="text"
                    value={signatoryRoleEn}
                    onChange={(e) => handleUpdateSignatoryRoleEn(e.target.value)}
                    placeholder="General Manager"
                    className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 transition-all"
                  />
                </div>
              </div>

              {/* Role Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { ar: 'المدير العام', en: 'General Manager' },
                  { ar: 'المدير التنفيذي', en: 'CEO' },
                  { ar: 'مدير الموارد البشرية', en: 'HR Manager' },
                  { ar: 'المفوض بالتوقيع', en: 'Authorized Signatory' }
                ].map((preset) => {
                  const isSelected = signatoryRoleAr === preset.ar && signatoryRoleEn === preset.en;
                  return (
                    <button
                      key={preset.en}
                      type="button"
                      onClick={() => handleApplyPresetRole(preset.ar, preset.en)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-600'
                      }`}
                    >
                      {preset.en} • {preset.ar}
                    </button>
                  );
                })}
              </div>

              {/* Additional Custom Notes */}
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <label className="text-xs font-semibold text-slate-700 block">
                  Additional Remarks / Custom Clause <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Optional custom note to append to the letter body..."
                  className="w-full px-3.5 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 border border-slate-200/90 rounded-xl text-xs outline-none focus:border-slate-400 transition-all"
                />
              </div>
            </div>
          </aside>

          {/* ================= RIGHT COLUMN: STICKY LIVE A4 DOCUMENT PREVIEW (7 COLS) ================= */}
          <section className="lg:col-span-7 lg:sticky lg:top-20 flex flex-col items-center space-y-3">
            {/* Clean Preview Toolbar */}
            <div className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-slate-200/80 rounded-2xl text-xs text-slate-600 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-800">
                  Live A4 Document Preview
                </span>
                <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                  210mm &times; 297mm
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(70, prev - 10))}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] text-slate-700 min-w-[44px] text-center font-semibold">
                  {zoomLevel}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(120, prev + 10))}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                {zoomLevel !== 100 && (
                  <button
                    type="button"
                    onClick={() => setZoomLevel(100)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-700 font-semibold transition-all cursor-pointer ml-1"
                  >
                    100%
                  </button>
                )}
              </div>
            </div>

            {/* Calm & Balanced A4 Canvas Viewport */}
            <div className="w-full flex justify-center overflow-x-auto py-6 px-4 sm:px-8 bg-slate-200/50 rounded-3xl border border-slate-200/80 min-h-[1140px]">
              <div
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out'
                }}
                className="transition-all"
              >
                {/* THE OFFICIAL PRINTABLE A4 DOCUMENT */}
                <div
                  id="printable-official-hr-sheet"
                  dir={isAr ? 'rtl' : 'ltr'}
                  className="w-[780px] min-h-[1080px] bg-white text-slate-900 rounded-sm shadow-xl ring-1 ring-slate-900/5 p-10 sm:p-12 relative select-text flex flex-col justify-between font-sans"
                  style={{
                    fontFamily: isAr ? "'Cairo', 'Segoe UI', Tahoma, sans-serif" : "'Inter', Arial, sans-serif"
                  }}
                >
                  {/* 1. OFFICIAL CR BRAND LETTERHEAD */}
                  <div className="space-y-4">
                    <div
                      className="header-table"
                      dir={isAr ? 'rtl' : 'ltr'}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        borderBottom: '3px solid #0f172a',
                        paddingBottom: '14px',
                        marginBottom: '20px',
                        direction: isAr ? 'rtl' : 'ltr'
                      }}
                    >
                      {/* CR Logo */}
                      <div
                        className="cr-logo-wrap"
                        style={{
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <img
                          src={selectedCr.logo_url || DEFAULT_GROUP_LOGO}
                          className="cr-logo"
                          alt="Corporate CR Logo"
                          style={{
                            maxHeight: '75px',
                            maxWidth: '120px',
                            objectFit: 'contain',
                            display: 'block'
                          }}
                        />
                      </div>

                      {/* CR Entity Identity & Contact Meta */}
                      <div
                        className="cr-text-block"
                        style={{
                          flex: 1,
                          textAlign: isAr ? 'right' : 'left',
                          marginRight: isAr ? '12px' : '0px',
                          marginLeft: isAr ? '0px' : '12px'
                        }}
                      >
                        <div
                          className="cr-title-en"
                          style={{
                            fontSize: '17.5px',
                            fontWeight: 900,
                            color: '#0f172a',
                            textTransform: 'uppercase',
                            letterSpacing: '-0.2px',
                            fontFamily: 'Arial, sans-serif',
                            textAlign: isAr ? 'right' : 'left'
                          }}
                        >
                          {selectedCr.cr_name || 'Tabarak Pharmacy CO W.L.L'}
                        </div>
                        <div
                          className="cr-title-ar"
                          style={{
                            fontSize: '15.5px',
                            fontWeight: 800,
                            color: '#1e293b',
                            marginTop: '3px',
                            direction: 'rtl',
                            textAlign: isAr ? 'right' : 'left'
                          }}
                        >
                          {selectedCr.cr_name_ar || 'شركة صيدلية تبارك ذ.م.م'}
                        </div>
                        <div
                          className="cr-meta"
                          style={{
                            fontSize: '10.5px',
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: '#475569',
                            marginTop: '5px',
                            lineHeight: '1.45',
                            textAlign: isAr ? 'right' : 'left'
                          }}
                        >
                          <div>
                            <strong>CR NO:</strong> {selectedCr.cr_number || '127506-01'} &nbsp;&bull;&nbsp;{' '}
                            <strong>Contact No:</strong> {selectedCr.phone || '+973 33866650'}
                          </div>
                          <div>
                            <strong>{isAr ? 'البريد الإلكتروني:' : 'Email Address:'}</strong> tabarakph.info@gmail.com{' '}
                            &nbsp;&bull;&nbsp; {isAr ? 'مملكة البحرين' : 'Kingdom of Bahrain'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Date & Ref Document Sub-Header Bar */}
                    <div
                      className="doc-header flex justify-between items-center border-b border-slate-200 pb-2.5 mb-5"
                      dir={isAr ? 'rtl' : 'ltr'}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid #e2e8f0',
                        paddingBottom: '10px',
                        marginBottom: '20px',
                        fontSize: '12.5px',
                        direction: isAr ? 'rtl' : 'ltr'
                      }}
                    >
                      <div style={{ fontSize: '12.5px', color: '#334155' }}>
                        {isAr ? 'التاريخ:' : 'Date:'}{' '}
                        <strong style={{ color: '#0f172a' }}>{issueDate}</strong>
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#334155' }}>
                        {isAr ? 'المرجع:' : 'Ref:'}{' '}
                        <span
                          className="doc-ref font-mono font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded border border-sky-200"
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            color: '#0284c7',
                            background: '#f0f9ff',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: '1px solid #bae6fd'
                          }}
                        >
                          {refNo}
                        </span>
                      </div>
                    </div>

                    {/* 2. DOCUMENT TITLE & SUBJECT BADGE */}
                    <div className="text-center py-3 border-b border-slate-100 space-y-1">
                      <h1 className="text-base sm:text-lg font-black uppercase text-slate-950 tracking-wider">
                        {letterTitles[letterType][lang]}
                      </h1>
                      <p className="text-xs font-bold text-brand">
                        {isAr ? letterTitles[letterType].subAr : letterTitles[letterType].subEn}
                      </p>
                    </div>

                    {/* 3. ADDRESSEE / DESTINATION */}
                    <div className="pt-2 text-xs font-bold text-slate-900">
                      <div className="space-y-0.5">
                        <p className="text-sm font-black text-slate-950">
                          {effectiveAddresseeHeader}
                        </p>
                        {!customAddressee.trim() && letterType === 'embassy_salary' && (
                          <p className="text-[11px] text-slate-600">
                            {isAr ? 'الموضوع: شهادة عمل وتعريف راتب' : 'Subject: Employment & Salary Verification Letter'}
                          </p>
                        )}
                        {!customAddressee.trim() && letterType === 'bank_salary_iban' && (
                          <p className="text-[11px] text-slate-600">
                            {isAr ? 'الموضوع: شهادة تفاصيل الراتب واعتماد الحساب البنكي' : 'Subject: Salary Certificate & IBAN Confirmation'}
                          </p>
                        )}
                        {!customAddressee.trim() && letterType === 'bank_salary_undertaking' && (
                          <p className="text-[11px] text-slate-600">
                            {isAr ? 'الموضوع: تعهد تحويل راتب غير قابل للإلغاء' : 'Subject: Irrevocable Salary Transfer Undertaking'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 4. STANDARDIZED PREAMBLE & CORE LETTER BODY */}
                    <div className="space-y-4 text-xs sm:text-[13px] leading-relaxed text-slate-800 text-justify pt-1">
                      <p className="leading-loose">
                        {letterBodyContent}
                      </p>

                      {/* 5. SALARY MATRIX TABLE (MANDATORY FOR EMBASSY, BANK, LOAN LETTERS) */}
                      {isSalaryRequired && (
                        <div className="my-5 p-1 bg-slate-50 border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
                          <div className="bg-slate-200/80 px-3 py-1.5 border-b border-slate-300 flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-700">
                            <span>{isAr ? 'جدول مفردات الراتب الشهري المعتمد:' : 'Monthly Salary Matrix Breakdown:'}</span>
                            <span>Bahraini Dinars (BHD)</span>
                          </div>

                          <table className="w-full text-xs text-slate-900 border-collapse">
                            <thead>
                              <tr className="border-b border-slate-300 bg-white">
                                <th className={`py-2 px-3 font-black ${isAr ? 'text-right' : 'text-left'}`}>
                                  {isAr ? 'البيان / تفاصيل المخصص' : 'Description / Component'}
                                </th>
                                <th className={`py-2 px-3 font-black ${isAr ? 'text-left' : 'text-right'}`}>
                                  {isAr ? 'المبلغ الشهري (د.ب)' : 'Monthly Amount (BHD)'}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              <tr>
                                <td className="py-1.5 px-3 text-slate-700">
                                  {isAr ? 'الراتب الأساسي' : 'Basic Salary'}
                                </td>
                                <td className={`py-1.5 px-3 font-mono font-bold ${isAr ? 'text-left' : 'text-right'}`}>
                                  {basicSalary.toFixed(3)} BHD
                                </td>
                              </tr>
                              <tr className="bg-slate-50/60">
                                <td className="py-1.5 px-3 text-slate-700">
                                  {isAr ? 'بدل السكن' : 'Housing Allowance'}
                                </td>
                                <td className={`py-1.5 px-3 font-mono font-bold ${isAr ? 'text-left' : 'text-right'}`}>
                                  {housingAllowance.toFixed(3)} BHD
                                </td>
                              </tr>
                              <tr>
                                <td className="py-1.5 px-3 text-slate-700">
                                  {isAr ? 'بدل المواصلات' : 'Transportation Allowance'}
                                </td>
                                <td className={`py-1.5 px-3 font-mono font-bold ${isAr ? 'text-left' : 'text-right'}`}>
                                  {transportationAllowance.toFixed(3)} BHD
                                </td>
                              </tr>
                              <tr className="bg-slate-50/60">
                                <td className="py-1.5 px-3 text-slate-700">
                                  {isAr ? 'علاوة الحوافز والمسؤولية المهنية' : 'Incentive / Responsibility Bonus'}
                                </td>
                                <td className={`py-1.5 px-3 font-mono font-bold ${isAr ? 'text-left' : 'text-right'}`}>
                                  {incentiveBonus.toFixed(3)} BHD
                                </td>
                              </tr>
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-slate-900 bg-emerald-50/70 font-black text-emerald-900 text-[13px]">
                                <td className="py-2.5 px-3">
                                  {isAr ? 'إجمالي صافي الراتب الشهري:' : 'TOTAL MONTHLY SALARY:'}
                                </td>
                                <td className={`py-2.5 px-3 font-mono text-sm ${isAr ? 'text-left' : 'text-right'}`}>
                                  {effectiveTotalSalary.toFixed(3)} BHD
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}

                      {/* Post Table Clause */}
                      {postTableClause && (
                        <p className="leading-loose font-medium">
                          {postTableClause}
                        </p>
                      )}

                      {/* Custom Notes if provided */}
                      {customNotes.trim() && (
                        <p className="p-2.5 bg-slate-50 border-l-4 border-slate-400 rounded text-xs text-slate-700 italic">
                          {customNotes.trim()}
                        </p>
                      )}

                      {/* General Disclaimer */}
                      <p className="text-[11px] text-slate-500 pt-2">
                        {isAr
                          ? 'تم إصدار هذه الشهادة بناءً على طلب الموظف لاستخدامها في الأغراض الرسمية، دون أدنى مسؤولية أو التزام مالي يترتب على الشركة تجاه الغير.'
                          : "This certificate is issued upon the employee's request for official purposes without any financial liability or commitment on the company's part."}
                      </p>
                    </div>
                  </div>

                  {/* 6. OFFICIAL FOOTER: AUTHORIZED SIGNATORY & COMPANY SEAL */}
                  <div
                    className="footer-section pt-8 border-t border-slate-200 flex items-end justify-between mt-10"
                    dir="ltr"
                    style={{
                      marginTop: '40px',
                      paddingTop: '20px',
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                      direction: 'ltr'
                    }}
                  >
                    {/* Authorized Signatory Block */}
                    <div className="sig-box text-center" style={{ textAlign: 'center', width: '220px' }}>
                      <div style={{ height: '75px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {!withoutSealAndSignature ? (
                          <img
                            src={selectedCr.signature_url || DEFAULT_SIGNATURE}
                            alt="CEO Signature"
                            className="sig-img"
                            style={{
                              maxHeight: '80px',
                              maxWidth: '200px',
                              objectFit: 'contain',
                              filter: 'contrast(1.2)'
                            }}
                          />
                        ) : (
                          <div style={{ height: '75px' }} />
                        )}
                      </div>
                      <div className="sig-name" style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', marginTop: '5px' }}>
                        {signatoryName || 'Authorized Signatory'}
                      </div>
                      <div className="sig-title" style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
                        {isAr ? (signatoryRoleAr || signatoryRoleEn) : (signatoryRoleEn || signatoryRoleAr)}
                      </div>
                    </div>

                    {/* Official Company Seal Block */}
                    <div
                      className="seal-box"
                      style={{
                        width: '220px',
                        border: withoutSealAndSignature ? '1.5px dashed #cbd5e1' : '1.5px solid #94a3b8',
                        borderRadius: '10px',
                        padding: '10px',
                        textAlign: 'center',
                        background: withoutSealAndSignature ? '#ffffff' : '#f8fafc'
                      }}
                    >
                      <span
                        className="seal-label"
                        style={{
                          fontSize: '9px',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          color: '#475569',
                          borderBottom: '1px solid #cbd5e1',
                          paddingBottom: '4px',
                          marginBottom: '8px',
                          display: 'block',
                          letterSpacing: '0.5px'
                        }}
                      >
                        {isAr ? "ختم المنشأة الرسمي • Company's Seal" : "Company's Seal"}
                      </span>
                      <div style={{ height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {!withoutSealAndSignature ? (
                          <img
                            src={selectedCr.stamp_url || generateCrStampSvg(selectedCr.cr_name_ar, selectedCr.cr_name, selectedCr.cr_number)}
                            alt="Official Corporate Seal"
                            className="seal-img"
                            style={{ maxHeight: '90px', width: '100%', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                          />
                        ) : (
                          <div style={{ height: '90px' }} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default OfficialHrLetterGenerator;
