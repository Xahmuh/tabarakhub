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
    <div className="min-h-screen bg-[#fafafa] mesh-gradient-bg text-slate-900 flex flex-col font-sans selection:bg-brand/10 direction-ltr">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 px-4 lg:px-6 py-3 shrink-0 shadow-xs">
        <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Title */}
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-all cursor-pointer active:scale-95"
                title="Back to Workforce Directory"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-10 h-10 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shadow-2xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                  Official HR Letter & Corporate Identity Generator
                </h1>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
                  v2.5 Live
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Automated legal letters with NHRA verification, salary breakdown matrix, and corporate CR identity
              </p>
            </div>
          </div>

          {/* Quick Global Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Letter Document Output Language Switcher (Affects generated A4 letter only) */}
            <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 pl-2 pr-1 flex items-center gap-1">
                <Languages className="w-3.5 h-3.5 text-brand" />
                <span>Letter Language:</span>
              </span>
              <button
                type="button"
                onClick={() => handleLetterLanguageSwitch('en')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  letterLang === 'en'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => handleLetterLanguageSwitch('ar')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  letterLang === 'ar'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                عربي (Arabic)
              </button>
            </div>

            {/* Gender Phrasing Switcher (Male / Female) */}
            <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 pl-2 pr-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-brand" />
                <span>Gender / الجنس:</span>
              </span>
              <button
                type="button"
                onClick={() => handleGenderSwitch('male')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  letterGender === 'male'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
                title="Male phrasing (مصري / حامل / يعمل / طلبه)"
              >
                Male (ذكر)
              </button>
              <button
                type="button"
                onClick={() => handleGenderSwitch('female')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  letterGender === 'female'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
                title="Female phrasing (مصرية / حاملة / تعمل / طلبها)"
              >
                Female (أنثى)
              </button>
            </div>

            {/* Without Seal & Signature Checkbox */}
            <label
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border select-none ${
                withoutSealAndSignature
                  ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="Hide digital seal and signature for pre-printed letterhead or physical ink stamping"
            >
              <input
                type="checkbox"
                checked={withoutSealAndSignature}
                onChange={(e) => setWithoutSealAndSignature(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 focus:ring-offset-0 bg-white border-slate-300 accent-amber-600 cursor-pointer"
              />
              <span className="whitespace-nowrap">
                Without seal & signature
              </span>
            </label>

            {/* Copy Text Button */}
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Copy letter text to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>

            {/* Word Download */}
            <button
              type="button"
              onClick={handleDownloadWord}
              disabled={isDownloadingWord}
              className="px-3.5 py-1.5 bg-gradient-to-r from-brand to-red-700 hover:from-brand-hover hover:to-red-800 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-brand/20 active:scale-95 disabled:opacity-50"
              title="Download official Microsoft Word document (.docx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloadingWord ? 'Generating...' : 'Word (.docx)'}</span>
            </button>

            {/* Print / Save PDF Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
              title="Print directly or save as official PDF"
            >
              <Printer className="w-4 h-4 text-brand" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 lg:p-6 space-y-6">
        {/* Top 2-Column Split: Form Inputs (5 cols) & Live A4 Preview (7 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ================= LEFT COLUMN: FORM INPUTS & SELECTORS (5 COLS) ================= */}
          <aside className="lg:col-span-5 space-y-5">
          {/* Quick Presets Bar: Pharmacist / Others with Searchable Dropdown */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-brand" />
                <span>
                  Quick Employee Presets: Pharmacists / Other Roles
                </span>
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                {isLoadingEmployees ? (
                  <span className="flex items-center gap-1 text-amber-600 font-bold">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Syncing...</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-mono">
                    {employeesList.length} in Database
                  </span>
                )}
              </div>
            </div>

            {/* Category Filter Selector Buttons (Pharmacist / Others / All) */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setStaffCategoryFilter('Pharmacist');
                  setIsEmployeeDropdownOpen(true);
                }}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                  staffCategoryFilter === 'Pharmacist'
                    ? 'bg-brand/10 border-brand text-brand shadow-xs shadow-brand/10 ring-1 ring-brand/20'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Pill className="w-3.5 h-3.5 text-brand shrink-0" />
                  <span className="truncate">Pharmacists</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                  staffCategoryFilter === 'Pharmacist' ? 'bg-brand text-white' : 'bg-slate-200/80 text-slate-700'
                }`}>
                  {pharmacistsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStaffCategoryFilter('Others');
                  setIsEmployeeDropdownOpen(true);
                }}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                  staffCategoryFilter === 'Others'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-xs shadow-indigo-100 ring-1 ring-indigo-200'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">Others</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                  staffCategoryFilter === 'Others' ? 'bg-indigo-600 text-white' : 'bg-slate-200/80 text-slate-700'
                }`}>
                  {othersCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStaffCategoryFilter('All');
                  setIsEmployeeDropdownOpen(true);
                }}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                  staffCategoryFilter === 'All'
                    ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Globe2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">All Staff</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200/80 text-slate-700 font-mono">
                  {employeesList.length}
                </span>
              </button>
            </div>

            {/* Searchable Dropdown Menu Container */}
            <div className="relative" ref={employeeDropdownRef}>
              {/* Dropdown Trigger Box */}
              <button
                type="button"
                onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 hover:border-brand/60 rounded-xl text-left transition-all flex items-center justify-between gap-2 cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0 text-brand">
                    <Search className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    {selectedEmployee ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900 truncate">{selectedEmployee.full_name}</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">
                            {selectedEmployee.code}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">
                          {selectedEmployee.category === 'Pharmacist'
                            ? `Pharmacist • NHRA: ${selectedEmployee.salary_matrix?.nhraLicenseNo || 'Licensed'}`
                            : (selectedEmployee.notes || selectedEmployee.category)}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-bold text-slate-700 group-hover:text-slate-900 truncate">
                          Choose employee from dropdown to autofill...
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {staffCategoryFilter === 'Pharmacist'
                            ? 'Showing Pharmacists only'
                            : staffCategoryFilter === 'Others'
                            ? 'Showing Others only'
                            : 'Showing All staff'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                  isEmployeeDropdownOpen ? 'rotate-180 text-brand' : ''
                }`} />
              </button>

              {/* Dropdown Content Menu */}
              {isEmployeeDropdownOpen && (
                <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 space-y-2 ring-1 ring-black/5">
                  {/* Search Input Box */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      value={employeeSearchQuery}
                      onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                      placeholder={
                        staffCategoryFilter === 'Pharmacist'
                          ? 'Search pharmacist by name, CPR, license...'
                          : 'Search by name, CPR, code...'
                      }
                      className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand transition-all"
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

                  {/* Active Filter Pill indicator */}
                  <div className="flex items-center justify-between px-1 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1 font-medium">
                      <Filter className="w-3 h-3 text-brand" />
                      <span>
                        {staffCategoryFilter === 'Pharmacist'
                          ? 'Pharmacists Only'
                          : staffCategoryFilter === 'Others'
                          ? 'Non-Pharmacists Only'
                          : 'All Staff'}
                      </span>
                    </span>
                    <span className="font-mono">{filteredEmployees.length} results</span>
                  </div>

                  {/* Employee Items List */}
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
                    {filteredEmployees.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No employee matches your search
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
                            className={`w-full p-2 rounded-xl text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                              isSelected
                                ? 'bg-brand/10 border border-brand/30 text-slate-900'
                                : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isPharm ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}>
                                {isPharm ? <Pill className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-slate-900 truncate">{emp.full_name}</p>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">
                                    {emp.code}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 truncate">
                                  <span>CPR: {emp.cpr_number || emp.salary_matrix?.expatCpr || 'N/A'}</span>
                                  {(emp.nationality || emp.salary_matrix?.nationality) && (
                                    <span className="text-blue-600 font-medium">
                                      • {resolveNationality(emp.nationality || emp.salary_matrix?.nationality, lang)}
                                    </span>
                                  )}
                                  {isPharm && emp.salary_matrix?.nhraLicenseNo && (
                                    <span className="text-brand font-mono">
                                      NHRA: {emp.salary_matrix.nhraLicenseNo}
                                    </span>
                                  )}
                                  {!isPharm && emp.notes && (
                                    <span className="text-slate-400 truncate">• {emp.notes}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Helper Notice / Confirmation */}
            {selectedEmployee && (
              <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Data autofilled — all fields below remain 100% editable.
                  </span>
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
                  className="text-slate-500 hover:text-slate-800 underline text-[9px] cursor-pointer font-bold"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>

          {/* Section 1: Corporate Entity & Letter Type Selector */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all space-y-4">
            <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-brand flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                <span>1. Entity CR & Letter Type</span>
              </h3>
              <span className="text-[10px] text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">CR: {selectedCr.cr_number}</span>
            </div>

            {/* Corporate Entity Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Emitting Corporate Entity (CR):</span>
                {selectedCr.is_master && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200">
                    Master Parent CR
                  </span>
                )}
              </label>
              <select
                value={selectedCrId}
                onChange={(e) => setSelectedCrId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand transition-all cursor-pointer shadow-2xs"
              >
                {registeredCrs.map(c => {
                  const branchLabel = c.linked_branch_name ? ` [${c.linked_branch_name}]` : '';
                  const arLabel = c.cr_name_ar ? ` | ${c.cr_name_ar}` : '';
                  return (
                    <option key={c.id} value={c.id}>
                      {c.cr_name} — (CR: {c.cr_number}){arLabel}{branchLabel}
                    </option>
                  );
                })}
              </select>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 font-bold text-slate-800">
                  <span className="uppercase text-slate-950 font-black text-xs">
                    {selectedCr.cr_name}
                  </span>
                  <span className="text-right dir-rtl font-sans text-brand font-black">
                    {selectedCr.cr_name_ar || '-'}
                  </span>
                </div>
                {selectedCr.linked_branch_name && (
                  <div className="text-[10px] text-slate-500">
                    الفرع  المرتبط: <span className="font-bold text-slate-700">{selectedCr.linked_branch_name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono pt-1">
                  <span className="font-bold text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/20">
                    CR: {selectedCr.cr_number}
                  </span>
                  <span className="text-slate-500">{selectedCr.phone || '+973 33866650'}</span>
                </div>
              </div>
            </div>

            {/* Document Type Selector: Searchable Dropdown & 6 Presets (History, Active job, Payroll, Approval, Banking, Travel) */}
            <div className="space-y-2.5 pt-1" ref={docTypeDropdownRef}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-brand" />
                  <span>Official Document Type:</span>
                </label>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-mono">
                  6 Official Templates
                </span>
              </div>

              {/* Searchable Dropdown Combobox Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDocTypeDropdownOpen(!isDocTypeDropdownOpen)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 hover:border-brand rounded-xl text-left transition-all flex items-center justify-between gap-2 cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0 text-brand">
                      {selectedDocOption?.icon ? <selectedDocOption.icon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-xs font-black text-slate-900 truncate">
                        {selectedDocOption?.labelEn}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {selectedDocOption?.subEn}
                      </p>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                    isDocTypeDropdownOpen ? 'rotate-180 text-brand' : ''
                  }`} />
                </button>

                {/* Searchable Dropdown Panel */}
                {isDocTypeDropdownOpen && (
                  <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 space-y-2 ring-1 ring-black/5">
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        autoFocus
                        value={docTypeSearchQuery}
                        onChange={(e) => setDocTypeSearchQuery(e.target.value)}
                        placeholder="Search document type (Travel, Banking, Payroll, etc.)..."
                        className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand transition-all"
                      />
                      {docTypeSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setDocTypeSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar text-[10px]">
                      {['all', 'History', 'Active job', 'Payroll', 'Approval', 'Banking', 'Travel'].map(hint => (
                        <button
                          key={hint}
                          type="button"
                          onClick={() => setDocHintFilter(hint)}
                          className={`px-2 py-0.5 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                            docHintFilter === hint
                              ? 'bg-brand text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {hint === 'all' ? 'All' : hint}
                        </button>
                      ))}
                    </div>

                    {/* Document Options List */}
                    <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                      {filteredDocTypes.length === 0 ? (
                        <p className="p-3 text-center text-xs text-slate-400">
                          No document type matches
                        </p>
                      ) : (
                        filteredDocTypes.map(doc => {
                          const isSelected = letterType === doc.id;
                          const DocIcon = doc.icon;
                          return (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => {
                                setLetterType(doc.id);
                                setIsDocTypeDropdownOpen(false);
                              }}
                              className={`w-full p-2 rounded-xl text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-brand/10 border border-brand/30 text-slate-900'
                                  : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-brand">
                                  <DocIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="font-black text-xs text-slate-900 truncate">
                                    {doc.labelEn}
                                  </span>
                                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                    {doc.subEn}
                                  </p>
                                </div>
                              </div>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Document Presets Grid (The 6 Cards matching HR Self Service) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {DOCUMENT_TYPE_OPTIONS.map(doc => {
                  const isSelected = letterType === doc.id;
                  const DocIcon = doc.icon;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setLetterType(doc.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? 'bg-brand/[0.04] border-brand ring-2 ring-brand/20 shadow-xs'
                          : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                          isSelected ? 'bg-brand text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <DocIcon className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      <div className="min-w-0 w-full">
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-brand font-black' : 'text-slate-800'}`}>
                          {doc.labelEn}
                        </p>
                        <p className="text-[9px] text-slate-500 truncate">
                          {doc.subEn}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-brand" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ref No & Issue Date */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700">Ref No:</label>
                  <button
                    type="button"
                    onClick={() => setRefNo(generateRefNo())}
                    className="text-[10px] text-brand hover:underline cursor-pointer flex items-center gap-0.5"
                    title="Regenerate Ref No"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>New</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-brand transition-all shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Issue Date:</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Optional Addressee Header Input & Quick Presets */}
            <div className="space-y-1.5 p-3 bg-slate-50/80 border border-slate-200/90 rounded-xl">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-brand" />
                  <span>{isAr ? 'جهة الخطاب / الديباجة (افتراضي: إلى من يهمه الأمر):' : 'Addressee Header (Default: To Whom It May Concern):'}</span>
                </label>
                <span className="text-[10px] text-slate-500 font-medium">{isAr ? 'اختياري / قابل للتعديل' : 'Optional / Editable'}</span>
              </div>
              <input
                type="text"
                value={customAddressee}
                onChange={(e) => setCustomAddressee(e.target.value)}
                placeholder={defaultAddresseeHeader}
                className="w-full px-3 py-1.5 bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand shadow-2xs"
              />
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <span className="text-[10px] text-slate-400 font-bold mr-0.5">{isAr ? 'اختصارات:' : 'Presets:'}</span>
                <button
                  type="button"
                  onClick={() => setCustomAddressee(isAr ? 'إلى من يهمه الأمر،' : 'To Whom It May Concern,')}
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 transition-all cursor-pointer shadow-2xs"
                >
                  {isAr ? 'إلى من يهمه الأمر،' : 'To Whom It May Concern,'}
                </button>
                <button
                  type="button"
                  onClick={() => setCustomAddressee(isAr ? 'إلى: الهيئة الوطنية لتنظيم المهن والخدمات الصحية (NHRA)' : 'To: National Health Regulatory Authority (NHRA)')}
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 transition-all cursor-pointer shadow-2xs"
                >
                  {isAr ? 'إلى: الهيئة الوطنية (NHRA)' : 'To: NHRA'}
                </button>
                <button
                  type="button"
                  onClick={() => setCustomAddressee(isAr ? 'إلى: وزارة الصحة' : 'To: Ministry of Health')}
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 transition-all cursor-pointer shadow-2xs"
                >
                  {isAr ? 'إلى: وزارة الصحة' : 'To: Ministry of Health'}
                </button>
                <button
                  type="button"
                  onClick={() => setCustomAddressee(isAr ? 'إلى: بنك البحرين الوطني (NBB)' : 'To: National Bank of Bahrain (NBB)')}
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 transition-all cursor-pointer shadow-2xs"
                >
                  {isAr ? 'إلى: بنك البحرين الوطني' : 'To: NBB'}
                </button>
                {customAddressee.trim() && (
                  <button
                    type="button"
                    onClick={() => setCustomAddressee('')}
                    className="px-2 py-0.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-[10px] font-bold text-slate-700 transition-all cursor-pointer ml-auto"
                  >
                    {isAr ? 'إعادة للافتراضي' : 'Reset Default'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Employee Identity & NHRA Licensing */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all space-y-4">
            <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-brand flex items-center gap-1.5">
                <User className="w-4 h-4" />
                <span>2. Employee Identity & NHRA License</span>
              </h3>
              {nhraLicense.trim() && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  NHRA Verified
                </span>
              )}
            </div>

            {/* Employee Full Name with Searchable Dropdown & Direct Database Picker */}
            <div className="space-y-1.5" ref={section2DropdownRef}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-brand" />
                  <span>Employee Full Name:</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Fully editable</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSection2DropdownOpen(!isSection2DropdownOpen)}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Search className="w-3 h-3" />
                    <span>Employee DB</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${isSection2DropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    placeholder="Type employee name or pick from dropdown..."
                    className="w-full px-3.5 py-2 pr-8 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand transition-all shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setIsSection2DropdownOpen(!isSection2DropdownOpen)}
                    className="absolute right-2.5 text-slate-400 hover:text-brand cursor-pointer p-1"
                    title="Open employee list"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isSection2DropdownOpen ? 'rotate-180 text-brand' : ''}`} />
                  </button>
                </div>

                {/* Section 2 Searchable Dropdown Menu */}
                {isSection2DropdownOpen && (
                  <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 space-y-2 ring-1 ring-black/5">
                    {/* Category Filter Pills */}
                    <div className="flex items-center justify-between gap-1 text-xs">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setStaffCategoryFilter('Pharmacist')}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            staffCategoryFilter === 'Pharmacist'
                              ? 'bg-brand text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <Pill className="w-3 h-3 text-white" />
                          <span>Pharmacists ({pharmacistsCount})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStaffCategoryFilter('Others')}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            staffCategoryFilter === 'Others'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <Users className="w-3 h-3 text-white" />
                          <span>Others ({othersCount})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStaffCategoryFilter('All')}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            staffCategoryFilter === 'All'
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <Globe2 className="w-3 h-3 text-white" />
                          <span>All Staff</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSection2DropdownOpen(false)}
                        className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Search Field */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        autoFocus
                        value={employeeSearchQuery}
                        onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                        placeholder={
                          staffCategoryFilter === 'Pharmacist'
                            ? 'Filter pharmacists...'
                            : 'Filter employees...'
                        }
                        className="w-full pl-8 pr-7 py-1.5 bg-slate-50 text-slate-900 text-xs placeholder-slate-400 rounded-lg border border-slate-200 outline-none focus:border-brand focus:bg-white"
                      />
                      {employeeSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setEmployeeSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Employee List */}
                    <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                      {filteredEmployees.length === 0 ? (
                        <p className="p-3 text-center text-xs text-slate-400">
                          No matches found
                        </p>
                      ) : (
                        filteredEmployees.map((emp) => {
                          const isSelected = emp.id === selectedEmployeeId || employeeName === emp.full_name;
                          const isPharm = emp.category === 'Pharmacist';
                          return (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => handleSelectEmployee(emp)}
                              className={`w-full p-2 rounded-xl text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-brand/10 border border-brand/30 text-slate-900'
                                  : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-transparent'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="shrink-0">{isPharm ? <Pill className="w-3.5 h-3.5 text-brand" /> : <User className="w-3.5 h-3.5 text-slate-400" />}</span>
                                  <span className="font-bold text-xs text-slate-900 truncate">{emp.full_name}</span>
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">
                                    {emp.code}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span>CPR: {emp.cpr_number || emp.salary_matrix?.expatCpr || '-'}</span>
                                  {(emp.nationality || emp.salary_matrix?.nationality) && (
                                    <span className="text-blue-600 font-medium">
                                      • {resolveNationality(emp.nationality || emp.salary_matrix?.nationality, lang)}
                                    </span>
                                  )}
                                  {isPharm && emp.salary_matrix?.nhraLicenseNo && (
                                    <span className="text-brand font-mono">NHRA: {emp.salary_matrix.nhraLicenseNo}</span>
                                  )}
                                  {!isPharm && emp.notes && (
                                    <span className="text-slate-400 truncate">• {emp.notes}</span>
                                  )}
                                </div>
                              </div>
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CPR & Passport Numbers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">CPR / National ID:</label>
                <input
                  type="text"
                  value={cpr}
                  onChange={(e) => setCpr(e.target.value)}
                  placeholder="e.g. 910542318"
                  className="w-full px-3 py-1.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-brand shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Passport Number:</label>
                <input
                  type="text"
                  value={passport}
                  onChange={(e) => setPassport(e.target.value)}
                  placeholder="e.g. A28491823"
                  className="w-full px-3 py-1.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-brand shadow-2xs"
                />
              </div>
            </div>

            {/* Nationality & Job Title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nationality:</label>
                <input
                  type="text"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  placeholder="e.g. Bahraini / بحريني"
                  className="w-full px-3 py-1.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Job Title / Role:</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Licensed Pharmacist"
                  className="w-full px-3 py-1.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand shadow-2xs"
                />
              </div>
            </div>

            {/* NHRA Professional License (Conditional / Dynamic) */}
            <div className="space-y-1.5 p-3.5 bg-purple-50/60 rounded-xl border border-purple-200/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                  <span>NHRA Professional License No:</span>
                </label>
                <span className="text-[10px] text-purple-600 font-medium">Optional for Medical Staff</span>
              </div>
              <input
                type="text"
                value={nhraLicense}
                onChange={(e) => setNhraLicense(e.target.value)}
                placeholder="e.g. NHRA/PH/2022/4912 or leave blank if non-medical"
                className="w-full px-3 py-1.5 bg-white text-purple-950 border border-purple-200 rounded-lg text-xs font-mono font-bold outline-none focus:border-purple-500 shadow-2xs"
              />
              <p className="text-[10px] text-purple-700/80">
                If filled, it automatically appends to the standardized legal preamble.
              </p>
            </div>

            {/* Joining Date & End Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-brand" />
                  <span>Date of Joining:</span>
                </label>
                <input
                  type="date"
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand shadow-2xs"
                />
              </div>

              {letterType === 'experience_certificate' ? (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-amber-800 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>Service End Date: *</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-amber-300 rounded-xl text-xs font-bold outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>
              ) : (
                <div className="flex items-center text-[11px] text-slate-500 pt-5 font-medium">
                  <span>Active service to present date</span>
                </div>
              )}
            </div>
          </div>

          {/* Contextual Fields: NOC Company, Embassy, Bank & IBAN */}
          {(letterType === 'noc_transfer' || letterType === 'embassy_salary' || letterType === 'bank_salary_iban' || letterType === 'bank_salary_undertaking') && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all space-y-4">
              <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-brand flex items-center gap-1.5">
                  <Landmark className="w-4 h-4" />
                  <span>Destination & Banking Details</span>
                </h3>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-brand/10 text-brand font-bold border border-brand/20">
                  For Selected Letter
                </span>
              </div>

              {/* NOC Transfer: New Company Name */}
              {letterType === 'noc_transfer' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    New Company Name (For Sponsorship Transfer): *
                  </label>
                  <input
                    type="text"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="e.g. Gulf Health Solutions W.L.L / شركة حلول الخليج الصحية"
                    className="w-full px-3.5 py-2 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand shadow-2xs"
                  />
                </div>
              )}

              {/* Embassy Destination */}
              {letterType === 'embassy_salary' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Addressee / Embassy Name: *
                  </label>
                  <input
                    type="text"
                    value={destinationName}
                    onChange={(e) => setDestinationName(e.target.value)}
                    placeholder="e.g. Embassy of France / سفارة الجمهورية الفرنسية"
                    className="w-full px-3.5 py-2 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand shadow-2xs"
                  />
                </div>
              )}

              {/* Bank Name & IBAN */}
              {(letterType === 'bank_salary_iban' || letterType === 'bank_salary_undertaking') && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Bank Name: *
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. National Bank of Bahrain (NBB) / بنك البحرين الوطني"
                      className="w-full px-3.5 py-2 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>IBAN Number: *</span>
                      <span className="text-[10px] text-slate-500 font-mono">Bahrain IBAN format</span>
                    </label>
                    <input
                      type="text"
                      value={iban}
                      onChange={(e) => setIban(e.target.value.toUpperCase())}
                      placeholder="BH29NBOB00000012345678"
                      className="w-full px-3.5 py-2 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-brand tracking-wider shadow-2xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ================= RIGHT COLUMN: LIVE A4 PREVIEW SHEET (7 COLS) ================= */}
        <section className="lg:col-span-7 flex flex-col items-center space-y-4">
          {/* Zoom & View Controls Bar */}
          <div className="w-full flex items-center justify-between px-4 py-2.5 bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-2xl text-xs text-slate-600 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-brand/10 flex items-center justify-center">
                <Eye className="w-3.5 h-3.5 text-brand" />
              </div>
              <span className="font-bold text-slate-900">
                Live Official A4 Document Preview:
              </span>
              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-mono font-medium border border-slate-200">
                210mm &times; 297mm (A4 Portrait)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.max(70, prev - 10))}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] text-slate-900 min-w-[42px] text-center font-bold px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.min(130, prev + 10))}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-700 font-bold transition-all cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          {/* A4 Sheet Viewport Container */}
          <div className="w-full flex justify-center overflow-x-auto p-4 sm:p-8 bg-slate-100/90 rounded-3xl border border-slate-200/80 shadow-inner tech-grid min-h-[1180px]">
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
                className={`w-[780px] min-h-[1100px] bg-white text-slate-900 rounded-xs shadow-2xl ring-1 ring-slate-900/10 p-10 sm:p-12 border border-slate-200 relative select-text flex flex-col justify-between ${
                  isAr ? 'font-sans' : 'font-sans'
                }`}
                style={{
                  fontFamily: isAr ? "'Cairo', 'Segoe UI', Tahoma, sans-serif" : "'Inter', Arial, sans-serif"
                }}
              >
                {/* 1. OFFICIAL CR BRAND LETTERHEAD (CLOSE PROXIMITY TO LOGO: LEFT IN EN, RIGHT IN AR) */}
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

                    {/* CR Entity Identity & Contact Meta (Close to Logo, Right in AR, Left in EN) */}
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

                {/* 6. OFFICIAL FOOTER: AUTHORIZED SIGNATORY & COMPANY SEAL (MATCHING REGISTERED CRS) */}
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

        {/* ================= BOTTOM 2-COLUMN SECTION: SALARY MATRIX & SIGNATORY DETAILS ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Section 3: Monthly Salary Matrix Breakdown (BHD) */}
          <div className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all space-y-4 ${
            isSalaryRequired ? 'border-brand/40 ring-1 ring-brand/20' : 'border-slate-200/90'
          }`}>
            <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-700">
                  3. Monthly Salary Matrix Breakdown (BHD)
                </h3>
              </div>
              <span className={`text-[9px] px-2 py-0.5 rounded font-bold border ${
                isSalaryRequired ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {isSalaryRequired ? 'Required for Letter' : 'Optional'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Basic Salary */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Basic:</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-brand text-right shadow-2xs"
                  />
                  <span className="absolute left-2 top-2 text-[9px] text-slate-400 font-mono">BHD</span>
                </div>
              </div>

              {/* Housing Allowance */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Housing:</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={housingAllowance}
                    onChange={(e) => setHousingAllowance(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-brand text-right shadow-2xs"
                  />
                  <span className="absolute left-2 top-2 text-[9px] text-slate-400 font-mono">BHD</span>
                </div>
              </div>

              {/* Transportation Allowance */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Transport:</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={transportationAllowance}
                    onChange={(e) => setTransportationAllowance(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-brand text-right shadow-2xs"
                  />
                  <span className="absolute left-2 top-2 text-[9px] text-slate-400 font-mono">BHD</span>
                </div>
              </div>

              {/* Incentive / Bonus */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Incentive:</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={incentiveBonus}
                    onChange={(e) => setIncentiveBonus(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-brand text-right shadow-2xs"
                  />
                  <span className="absolute left-2 top-2 text-[9px] text-slate-400 font-mono">BHD</span>
                </div>
              </div>
            </div>

            {/* Total Monthly Salary Display & Custom Override */}
            <div className="p-3.5 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white rounded-2xl border border-emerald-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-emerald-950">
                  Total Monthly Net Salary:
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <label className="text-[10px] text-slate-600 flex items-center gap-1 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={isManualTotal}
                      onChange={(e) => {
                        setIsManualTotal(e.target.checked);
                        if (!e.target.checked) setManualTotalSalary(calculatedTotalSalary);
                      }}
                      className="rounded text-brand accent-brand"
                    />
                    <span>Manual Override Total</span>
                  </label>
                </div>
              </div>

              <div className="text-right">
                {isManualTotal ? (
                  <div className="relative w-32">
                    <input
                      type="number"
                      step="0.001"
                      value={manualTotalSalary}
                      onChange={(e) => setManualTotalSalary(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-white text-emerald-800 border border-emerald-400 rounded-lg text-sm font-mono font-black text-right shadow-inner"
                    />
                    <span className="absolute left-2 top-1.5 text-[10px] text-emerald-600 font-mono font-bold">BHD</span>
                  </div>
                ) : (
                  <div className="text-base sm:text-lg font-black font-mono text-emerald-800">
                    {effectiveTotalSalary.toFixed(3)} <span className="text-xs text-emerald-600 font-normal">BHD</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Custom Letter Notes & Signatory Control */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all space-y-3">
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-brand" />
                <span>4. Additional Notes & Signatory Details</span>
              </h3>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">
                Custom Clause / Specific Notes to append:
              </label>
              <textarea
                rows={2}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Optional custom paragraph or remark..."
                className="w-full px-3 py-2 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs outline-none focus:border-brand shadow-2xs transition-all"
              />
            </div>

            <div className="space-y-3 pt-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Authorized Signatory Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Authorized Signatory (المفوض بالتوقيع):
                  </label>
                  <input
                    type="text"
                    value={signatoryName}
                    onChange={(e) => handleUpdateSignatoryName(e.target.value)}
                    placeholder="e.g. Dr. Fathy Saad Amin"
                    className="w-full px-3 py-1.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand shadow-2xs transition-all"
                  />
                </div>

                {/* 2. Signatory Title (Arabic for Letter) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                    <span>Signatory Title (Arabic for Letter):</span>
                    {isLetterAr && <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-black border border-emerald-200">Active on Letter</span>}
                  </label>
                  <input
                    type="text"
                    value={signatoryRoleAr}
                    onChange={(e) => handleUpdateSignatoryRoleAr(e.target.value)}
                    placeholder="مثال: المدير العام / المدير التنفيذي"
                    className={`w-full px-3 py-1.5 text-slate-900 border rounded-xl text-xs font-bold outline-none focus:border-brand shadow-2xs transition-all ${
                      isLetterAr ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-400/30' : 'bg-slate-50 hover:bg-white focus:bg-white border-slate-200'
                    }`}
                  />
                </div>

                {/* 3. Signatory Title (English for Letter) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                    <span>Signatory Title (English for Letter):</span>
                    {!isLetterAr && <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-black border border-emerald-200">Active on Letter</span>}
                  </label>
                  <input
                    type="text"
                    value={signatoryRoleEn}
                    onChange={(e) => handleUpdateSignatoryRoleEn(e.target.value)}
                    placeholder="e.g. General Manager / CEO"
                    className={`w-full px-3 py-1.5 text-slate-900 border rounded-xl text-xs font-bold outline-none focus:border-brand shadow-2xs transition-all ${
                      !isLetterAr ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-400/30' : 'bg-slate-50 hover:bg-white focus:bg-white border-slate-200'
                    }`}
                  />
                </div>
              </div>

              {/* Quick Title Presets */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Title Presets:</span>
                {[
                  { ar: 'المدير العام', en: 'General Manager' },
                  { ar: 'المدير التنفيذي', en: 'CEO' },
                  { ar: 'مدير الموارد البشرية', en: 'HR Manager' },
                  { ar: 'المفوض بالتوقيع', en: 'Authorized Signatory' },
                  { ar: 'مدير العمليات', en: 'Operations Manager' },
                  { ar: 'مدير الصيدلية', en: 'Pharmacy Manager' }
                ].map((preset) => {
                  const isSelected = signatoryRoleAr === preset.ar && signatoryRoleEn === preset.en;
                  return (
                    <button
                      key={preset.en}
                      type="button"
                      onClick={() => handleApplyPresetRole(preset.ar, preset.en)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-brand text-white shadow-xs ring-1 ring-brand'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                      }`}
                      title={`Set title to ${preset.ar} / ${preset.en}`}
                    >
                      {preset.ar} ({preset.en})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OfficialHrLetterGenerator;
