import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Truck,
  Briefcase,
  ShieldCheck,
  MapPin,
  Plus,
  Search,
  Edit,
  Trash2,
  Building2,
  CheckCircle2,
  X,
  RefreshCw,
  SlidersHorizontal,
  Navigation,
  KeyRound,
  Stethoscope,
  Phone,
  Mail,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  Download,
  Upload,
  Award,
  Printer,
  Eye,
  EyeOff,
  MessageCircle,
  Copy,
  Check,
  Star,
  ShieldAlert,
  CreditCard,
  Calendar,
  Globe2
} from 'lucide-react';
import { BackToModulesButton } from '../shared';
import {
  workforceService,
  Employee,
  EmployeeBranchAssignment,
  StaffCategory,
  StaffStatus,
  CATEGORY_PREFIXES
} from '../../services/workforceService';
import { branchService } from '../../services/branchService';
import { expenseService } from '../../services/expenseService';
import { operationalRenewalService, RENEWALS_UPDATED_EVENT } from '../../services/operationalRenewalService';
import { Branch, Vehicle } from '../../types';
import { generateDocumentBlob } from '../lib/docGenerator';
import { BahrainLicensePlate } from '../operational-expenses/components/BahrainLicensePlate';
import { OfficialHrLetterGenerator } from '../hr-letter-generator/OfficialHrLetterGenerator';

interface WorkforceDirectoryProps {
  lang?: 'ar' | 'en';
  onBack?: () => void;
}

const DEFAULT_BRANCHES: Partial<Branch>[] = [
  { id: 'B1', code: 'MNM', name: 'Main Pharmacy - Manama', lat: 26.2285, lng: 50.5860 },
  { id: 'B2', code: 'RFA', name: 'Riffa Branch', lat: 26.1300, lng: 50.5550 },
  { id: 'B3', code: 'HDR', name: 'Hidd Branch', lat: 26.2400, lng: 50.6500 },
  { id: 'B4', code: 'SIT', name: 'Sitra Branch', lat: 26.1500, lng: 50.6200 }
];

const DEFAULT_FLEET_VEHICLES = [
  { code: 'V-001', plateNumber: '654321', type: 'Motorcycle', ownership: 'Internal', name: 'Honda Wave 110 - Main Branch' },
  { code: 'V-002', plateNumber: '123456', type: 'Motorcycle', ownership: 'Internal', name: 'Yamaha YBR 125 - Manama' },
  { code: 'V-003', plateNumber: '987654', type: 'Motorcycle', ownership: 'External', name: 'Suzuki GD 110 - Riffa' },
  { code: 'V-004', plateNumber: '456789', type: 'Motorcycle', ownership: 'Internal', name: 'Honda CG 125 - Hidd' },
  { code: 'V-005', plateNumber: '334455', type: 'Motorcycle', ownership: 'Internal', name: 'TVS HLX 150 - Sitra' },
  { code: 'V-006', plateNumber: '778899', type: 'Motorcycle', ownership: 'External', name: 'Yamaha LC135 - Muharraq' },
  { code: 'V-007', plateNumber: '112233', type: 'Motorcycle', ownership: 'Internal', name: 'Honda Click 150i - Isa Town' },
  { code: 'V-008', plateNumber: '556677', type: 'Motorcycle', ownership: 'Internal', name: 'Suzuki Smash - Budaiya' }
];

// Premium Flat 2D Vector SVG Graphics
const VectorPharmacist: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M10.5 4.5h3v6h6v3h-6v6h-3v-6h-6v-3h6v-6z" />
  </svg>
);

const VectorDriver: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Main Outer Helmet Shell (Flat Red / Solid Color) */}
    <path
      d="M20 52C20 28 35 14 62 14C80 14 86 28 86 42C86 44 83 46 76 46H52C44 46 40 50 40 58C40 65 46 68 55 68H88C88 80 75 90 58 90C36 90 20 75 20 52Z"
      fill="currentColor"
    />
    {/* Top Curved Accent Stripe */}
    <path
      d="M22 42C26 26 38 18 58 15C74 15 82 22 84 30C78 26 66 22 55 24C41 26 29 32 22 42Z"
      fill="white"
      fillOpacity="0.25"
    />
    {/* Dark Visor Window */}
    <path
      d="M44 42C44 37 48 34 56 34H83C85 34 86 36 86 39V60C86 63 84 64 81 64H56C48 64 44 58 44 50V42Z"
      fill="#1A1D20"
    />
    {/* Visor Hinge Pivot Circle */}
    <circle cx="50" cy="48" r="4" fill="#64748B" />
    <circle cx="50" cy="48" r="1.8" fill="#0F172A" />
    {/* Visor Vertical Reflection Bars */}
    <rect x="68" y="38" width="3.5" height="23" rx="1.5" fill="#FFFFFF" fillOpacity="0.9" />
    <rect x="75" y="38" width="3.5" height="23" rx="1.5" fill="#FFFFFF" fillOpacity="0.9" />
  </svg>
);

// Premium Red Sport Motorcycle (Flat 2D Vector from User Image)
const VectorMotorcycle: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 120 75" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Rear Wheel (Tire, Rim, Axle) */}
    <circle cx="28" cy="48" r="18" fill="#292D32" />
    <circle cx="28" cy="48" r="11" fill="#94A3B8" />
    <circle cx="28" cy="48" r="4" fill="#1E293B" />
    <path d="M28 37V59M17 48H39M20 40L36 56M20 56L36 40" stroke="#CBD5E1" strokeWidth="1.5" />

    {/* Front Wheel (Tire, Rim, Axle) */}
    <circle cx="92" cy="48" r="18" fill="#292D32" />
    <circle cx="92" cy="48" r="11" fill="#94A3B8" />
    <circle cx="92" cy="48" r="4" fill="#1E293B" />
    <path d="M92 37V59M81 48H103M84 40L100 56M84 56L100 40" stroke="#CBD5E1" strokeWidth="1.5" />

    {/* Engine Block & Lower Frame (Black/Dark Grey) */}
    <path d="M42 40H66L60 58H40Z" fill="#1E293B" />
    <circle cx="53" cy="48" r="4" fill="#E2E8F0" />
    <line x1="45" y1="44" x2="60" y2="44" stroke="#64748B" strokeWidth="1.5" />
    <line x1="45" y1="48" x2="58" y2="48" stroke="#64748B" strokeWidth="1.5" />
    <line x1="45" y1="52" x2="55" y2="52" stroke="#64748B" strokeWidth="1.5" />

    {/* Swingarm / Silver Chain Guard */}
    <rect x="28" y="45" width="22" height="6" rx="2" fill="#94A3B8" />

    {/* Bodywork - Grey Mid Frame & Red Sport Gas Tank/Seat */}
    <path d="M25 36L45 36L64 26L48 24Z" fill="#64748B" />
    
    {/* Main Red Sport Gas Tank & Tail Fairing */}
    <path
      d="M16 22C24 22 35 28 48 26C58 24 72 16 80 20C82 22 84 28 84 32H74L60 36C46 44 28 38 16 22Z"
      fill="currentColor"
    />
    {/* Black Sport Seat */}
    <path d="M16 22C22 22 32 26 42 26C35 30 25 30 16 22Z" fill="#1E293B" />
    {/* White/Light Tank Glare Accent */}
    <path d="M52 20C58 18 64 17 68 19C63 21 55 22 50 21Z" fill="#FFFFFF" fillOpacity="0.5" />

    {/* Front Red Headlight Fairing & Cyan Lens */}
    <path d="M78 18L84 20L84 32L76 32Z" fill="currentColor" />
    <path d="M80 22H84V28H80Z" fill="#38BDF8" />
    {/* Windshield */}
    <path d="M70 10L78 18H74Z" fill="#E2E8F0" fillOpacity="0.8" />
    {/* Front Fork Suspension Bars */}
    <path d="M76 26L92 48" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" />
    {/* Handlebars & Mirror */}
    <path d="M72 16L76 12M76 12H80" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="72" cy="12" r="2.5" fill="#475569" />
  </svg>
);

// Premium Red Delivery Van / Car (Flat 2D Vector from User Image)
const VectorDeliveryVan: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 120 70" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Main Red Delivery Van Body */}
    <path
      d="M14 22C14 17 18 14 23 14H66C78 14 86 21 92 28L101 36C104 39 105 42 105 46V54C105 56 103 58 101 58H14C12 58 10 56 10 54V25C10 23 12 22 14 22Z"
      fill="currentColor"
    />
    {/* Dark Underbody Skirt */}
    <rect x="10" y="52" width="95" height="6" fill="#1E293B" />

    {/* Cargo Side Panel Door Outlines */}
    <rect x="15" y="18" width="13" height="15" rx="2" fill="white" fillOpacity="0.08" />
    <rect x="30" y="18" width="24" height="24" rx="3" fill="white" fillOpacity="0.08" />
    <rect x="51" y="30" width="1.5" height="5" rx="0.5" fill="#1E293B" />

    {/* Front Cabin Windshield Window */}
    <path d="M68 18H72C79 18 85 24 88 30L90 35H68V18Z" fill="#E2E8F0" />
    <path d="M70 20H72C77 20 83 25 86 30L88 33H70V20Z" fill="#38BDF8" fillOpacity="0.6" />
    <rect x="68" y="32" width="4" height="1.5" fill="#1E293B" />

    {/* Headlight */}
    <path d="M96 40C101 40 103 42 103 45C103 48 100 50 96 50V40Z" fill="#FEF08A" />

    {/* Rear Wheel (Tire + Rim + Hub) */}
    <circle cx="28" cy="54" r="10" fill="#1E293B" />
    <circle cx="28" cy="54" r="6" fill="#94A3B8" />
    <circle cx="28" cy="54" r="2" fill="#1E293B" />

    {/* Front Wheel (Tire + Rim + Hub) */}
    <circle cx="84" cy="54" r="10" fill="#1E293B" />
    <circle cx="84" cy="54" r="6" fill="#94A3B8" />
    <circle cx="84" cy="54" r="2" fill="#1E293B" />
  </svg>
);

const VectorAllStaff: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

const VectorWorker: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const VectorManagement: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
  </svg>
);

const VectorMale: React.FC<{ className?: string }> = ({ className = "w-3 h-3" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M9.5 11c-2.48 0-4.5 2.02-4.5 4.5S7.02 20 9.5 20s4.5-2.02 4.5-4.5S11.98 11 9.5 11zm0 7c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zm10.5-14h-6v2h2.59l-3.95 3.95c.87.7 1.58 1.58 2.07 2.59L18 8.41V11h2V4z" />
  </svg>
);

const VectorFemale: React.FC<{ className?: string }> = ({ className = "w-3 h-3" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4c-2.76 0-5 2.24-5 5 0 2.37 1.65 4.35 3.88 4.88V16H9v2h1.88v2.5h2.24V18H15v-2h-1.88v-2.12C15.35 13.35 17 11.37 17 9c0-2.76-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z" />
  </svg>
);

const VectorVisaInternal: React.FC<{ className?: string }> = ({ className = "w-3 h-3" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L4 6v6c0 5.25 3.4 10.15 8 11.5 4.6-1.35 8-6.25 8-11.5V6l-8-4zm-1 14.5l-3.5-3.5 1.41-1.41L11 13.67l5.09-5.09 1.41 1.41L11 16.5z" />
  </svg>
);

const VectorVisaFlexi: React.FC<{ className?: string }> = ({ className = "w-3 h-3" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
  </svg>
);

// Load contract types from localStorage (synced with Admin Control Center)
const getAdminContractTypes = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('tabarak_contract_types');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return [
    {
      id: 'cnt-ph-8h-jr',
      contract_title: '8 Hrs Pharmacist Contract - Junior (عقد صيدلي 8 ساعات - مبتدئ)',
      shift_hours: 8,
      category: 'Pharmacist',
      default_basic_bhd: 400,
      housing_bhd: 100,
      transportation_bhd: 50,
      responsibility_bonus_bhd: 0,
      long_shift_incentive_bhd: 0,
      total_salary_bhd: 550,
    },
    {
      id: 'cnt-ph-8h-exp',
      contract_title: '8 Hrs Pharmacist Contract - Experienced (عقد صيدلي 8 ساعات - ذو خبرة)',
      shift_hours: 8,
      category: 'Pharmacist',
      default_basic_bhd: 400,
      housing_bhd: 100,
      transportation_bhd: 50,
      responsibility_bonus_bhd: 50,
      long_shift_incentive_bhd: 0,
      total_salary_bhd: 600,
    },
    {
      id: 'cnt-ph-8h-sr',
      contract_title: '8 Hrs Pharmacist Contract - Senior (عقد صيدلي 8 ساعات - صيدلي أول)',
      shift_hours: 8,
      category: 'Pharmacist',
      default_basic_bhd: 400,
      housing_bhd: 100,
      transportation_bhd: 50,
      responsibility_bonus_bhd: 100,
      long_shift_incentive_bhd: 0,
      total_salary_bhd: 650,
    },
    {
      id: 'cnt-ph-10h-jr',
      contract_title: '10 Hrs Pharmacist Contract - Junior (عقد صيدلي 10 ساعات - مبتدئ)',
      shift_hours: 10,
      category: 'Pharmacist',
      default_basic_bhd: 400,
      housing_bhd: 100,
      transportation_bhd: 50,
      responsibility_bonus_bhd: 0,
      long_shift_incentive_bhd: 100,
      total_salary_bhd: 650,
    },
    {
      id: 'cnt-ph-10h-exp',
      contract_title: '10 Hrs Pharmacist Contract - Experienced (عقد صيدلي 10 ساعات - ذو خبرة)',
      shift_hours: 10,
      category: 'Pharmacist',
      default_basic_bhd: 400,
      housing_bhd: 100,
      transportation_bhd: 50,
      responsibility_bonus_bhd: 50,
      long_shift_incentive_bhd: 100,
      total_salary_bhd: 700,
    },
    {
      id: 'cnt-ph-10h-sr',
      contract_title: '10 Hrs Pharmacist Contract - Senior (عقد صيدلي 10 ساعات - صيدلي أول)',
      shift_hours: 10,
      category: 'Pharmacist',
      default_basic_bhd: 400,
      housing_bhd: 100,
      transportation_bhd: 50,
      responsibility_bonus_bhd: 100,
      long_shift_incentive_bhd: 100,
      total_salary_bhd: 750,
    },
    {
      id: 'cnt-worker-12h',
      contract_title: '12 Hrs Worker Duty Contract (عقد عامل صيدلية 12 ساعة)',
      shift_hours: 12,
      category: 'Worker',
      default_basic_bhd: 350,
      housing_bhd: 0,
      transportation_bhd: 0,
      responsibility_bonus_bhd: 0,
      long_shift_incentive_bhd: 0,
      total_salary_bhd: 350,
    },
    {
      id: 'cnt-driver-8h',
      contract_title: '8 Hrs Fleet Driver Contract (عقد سائق توصيل 8 ساعات)',
      shift_hours: 8,
      category: 'Driver',
      default_basic_bhd: 300,
      housing_bhd: 0,
      transportation_bhd: 0,
      responsibility_bonus_bhd: 0,
      long_shift_incentive_bhd: 0,
      total_salary_bhd: 300,
    }
  ];
};

const DEFAULT_GROUP_LOGO = '/logo.jpg';
const DEFAULT_SIGNATURE = '/sign.jpg';
const generateCrStampSvg = (crNameAr?: string, crNameEn?: string, crNumber?: string): string => {
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

const DEFAULT_STAMP = generateCrStampSvg('مجموعة صيدليات تبارك ذ.م.م', 'TABARAK PHARMACY GROUP WLL', '100234-1');

const getAdminRegisteredCrs = (): any[] => {
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

export const WorkforceDirectory: React.FC<WorkforceDirectoryProps> = ({ lang = 'ar', onBack }) => {
  const isRtl = lang === 'ar';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Partial<Branch>[]>(DEFAULT_BRANCHES);
  const [systemVehicles, setSystemVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'Active' | 'Inactive'>('ALL');
  const [selectedGender, setSelectedGender] = useState<'ALL' | 'Male' | 'Female'>('ALL');
  const [selectedVisaType, setSelectedVisaType] = useState<'ALL' | 'Internal' | 'Flexi'>('ALL');
  const [deletingEmpTarget, setDeletingEmpTarget] = useState<Employee | null>(null);

  // Bulk Selection & Deletion States
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState<boolean>(false);

  // HR Official Letter Modal State
  const [isHrLetterModalOpen, setIsHrLetterModalOpen] = useState<boolean>(false);
  const [selectedLetterEmp, setSelectedLetterEmp] = useState<Employee | null>(null);
  const [selectedLetterType, setSelectedLetterType] = useState<'salary_certificate' | 'employment_certificate' | 'bank_letter'>('salary_certificate');
  const [selectedCrForLetter, setSelectedCrForLetter] = useState<any>(null);
  const [withoutSealAndSignature, setWithoutSealAndSignature] = useState<boolean>(false);

  // Quick Compliance Modal State (PP & WP Expiry Quick Edit)
  const [quickComplianceEmp, setQuickComplianceEmp] = useState<Employee | null>(null);
  const [quickPassport, setQuickPassport] = useState<string>('');
  const [quickPpExpiry, setQuickPpExpiry] = useState<string>('');
  const [originalPpExpiry, setOriginalPpExpiry] = useState<string>('');
  const [selectedPpPresetMonths, setSelectedPpPresetMonths] = useState<number | null>(null);

  const [quickWpExpiry, setQuickWpExpiry] = useState<string>('');
  const [originalWpExpiry, setOriginalWpExpiry] = useState<string>('');
  const [selectedWpPresetMonths, setSelectedWpPresetMonths] = useState<number | null>(null);

  const [quickNhraLicense, setQuickNhraLicense] = useState<string>('');
  const [quickNhraExpiry, setQuickNhraExpiry] = useState<string>('');
  const [originalNhraExpiry, setOriginalNhraExpiry] = useState<string>('');
  const [selectedNhraPresetMonths, setSelectedNhraPresetMonths] = useState<number | null>(null);

  const [quickComplianceLoading, setQuickComplianceLoading] = useState<boolean>(false);

  // Exact day-safe month addition helper for YYYY-MM-DD
  const addMonthsToDate = (baseDateStr?: string, monthsToAdd = 12): string => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const base = (baseDateStr && baseDateStr.trim()) ? baseDateStr.split('T')[0] : todayStr;
      const parts = base.split('-').map(Number);
      if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        throw new Error('Invalid date');
      }

      const year = parts[0];
      const monthIndex = parts[1] - 1; // 0-11
      const day = parts[2];

      const totalMonths = monthIndex + monthsToAdd;
      const targetYear = year + Math.floor(totalMonths / 12);
      const targetMonthIndex = ((totalMonths % 12) + 12) % 12;

      // Calculate days in target month (day 0 of month+1 gives last day of month)
      const daysInTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
      const targetDay = Math.min(day, daysInTargetMonth);

      return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
    } catch {
      const d = new Date();
      d.setMonth(d.getMonth() + monthsToAdd);
      return d.toISOString().split('T')[0];
    }
  };

  const applyWpPreset = (months: number) => {
    if (selectedWpPresetMonths === months) {
      setQuickWpExpiry(originalWpExpiry);
      setSelectedWpPresetMonths(null);
      return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    let baseDateStr = todayStr;
    if (originalWpExpiry && originalWpExpiry.trim()) {
      const parsed = new Date(originalWpExpiry);
      const today = new Date(todayStr);
      if (!isNaN(parsed.getTime()) && parsed > today) {
        baseDateStr = originalWpExpiry.split('T')[0];
      }
    }
    const newDate = addMonthsToDate(baseDateStr, months);
    setQuickWpExpiry(newDate);
    setSelectedWpPresetMonths(months);
  };

  const applyPpPreset = (months: number) => {
    if (selectedPpPresetMonths === months) {
      setQuickPpExpiry(originalPpExpiry);
      setSelectedPpPresetMonths(null);
      return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    let baseDateStr = todayStr;
    if (originalPpExpiry && originalPpExpiry.trim()) {
      const parsed = new Date(originalPpExpiry);
      const today = new Date(todayStr);
      if (!isNaN(parsed.getTime()) && parsed > today) {
        baseDateStr = originalPpExpiry.split('T')[0];
      }
    }
    const newDate = addMonthsToDate(baseDateStr, months);
    setQuickPpExpiry(newDate);
    setSelectedPpPresetMonths(months);
  };

  const applyNhraPreset = (months: number = 24) => {
    if (selectedNhraPresetMonths === months) {
      setQuickNhraExpiry(originalNhraExpiry);
      setSelectedNhraPresetMonths(null);
      return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    let baseDateStr = todayStr;
    if (originalNhraExpiry && originalNhraExpiry.trim()) {
      const parsed = new Date(originalNhraExpiry);
      const today = new Date(todayStr);
      if (!isNaN(parsed.getTime()) && parsed > today) {
        baseDateStr = originalNhraExpiry.split('T')[0];
      }
    }
    const newDate = addMonthsToDate(baseDateStr, months);
    setQuickNhraExpiry(newDate);
    setSelectedNhraPresetMonths(months);
  };

  const openQuickComplianceModal = (emp: Employee) => {
    setQuickComplianceEmp(emp);
    const pp = emp.passport_number || emp.salary_matrix?.expatPp || '';
    const ppExp = emp.passport_expiry_date || emp.salary_matrix?.expatPpExpiryDate || emp.salary_matrix?.ppExpiryDate || '';
    const wpExp = emp.wp_expiry_date || emp.salary_matrix?.wpExpiryDate || emp.salary_matrix?.visaExpiryDate || '';
    const nhraLic = emp.salary_matrix?.nhraLicenseNo || (emp.category === 'Pharmacist' ? `NHRA-PH-${emp.code}` : '');
    const nhraExp = emp.salary_matrix?.nhraExpiryDate || (emp.category === 'Pharmacist' ? '2026-12-31' : '');

    setQuickPassport(pp);
    setQuickPpExpiry(ppExp);
    setOriginalPpExpiry(ppExp);
    setQuickWpExpiry(wpExp);
    setOriginalWpExpiry(wpExp);
    setQuickNhraLicense(nhraLic);
    setQuickNhraExpiry(nhraExp);
    setOriginalNhraExpiry(nhraExp);
    setSelectedWpPresetMonths(null);
    setSelectedPpPresetMonths(null);
    setSelectedNhraPresetMonths(null);
  };

  const handleSaveQuickCompliance = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickComplianceEmp) return;
    setQuickComplianceLoading(true);
    try {
      const updatedSalaryMatrix = {
        ...(quickComplianceEmp.salary_matrix || {}),
        expatPp: quickPassport.trim(),
        expatPpExpiryDate: quickPpExpiry.trim(),
        ppExpiryDate: quickPpExpiry.trim(),
        wpExpiryDate: quickWpExpiry.trim(),
        visaExpiryDate: quickWpExpiry.trim(),
        ...(quickComplianceEmp.category === 'Pharmacist' ? {
          nhraLicenseNo: quickNhraLicense.trim(),
          nhraExpiryDate: quickNhraExpiry.trim()
        } : {})
      };

      const updatedEmp: Employee = {
        ...quickComplianceEmp,
        passport_number: quickPassport.trim(),
        passport_expiry_date: quickPpExpiry.trim(),
        wp_expiry_date: quickWpExpiry.trim(),
        salary_matrix: updatedSalaryMatrix,
        updated_at: new Date().toISOString()
      };

      await workforceService.saveEmployee(updatedEmp);

      setEmployees(prev => prev.map(emp => emp.id === updatedEmp.id ? updatedEmp : emp));

      // Direct live synchronization with Expiries & Compliance Control (operationalRenewalService)
      try {
        await operationalRenewalService.syncEmployeeCompliance(updatedEmp, {
          wpDurationMonths: selectedWpPresetMonths || undefined,
          user: { id: 'hr-admin', name: 'HR Compliance Management' }
        });
      } catch (syncErr) {
        console.warn('Operational renewals direct sync warning:', syncErr);
      }

      showToast(
        isRtl
          ? `تم تحديث وتمديد بيانات الامتثال للموظف (${quickComplianceEmp.full_name}) بنجاح ومزامنتها لحظياً مع موديول الصلاحيات والامتثال`
          : `Compliance and work permit extended for (${quickComplianceEmp.full_name}) and synchronized live with Expiries & Compliance Control`,
        'success'
      );
      setQuickComplianceEmp(null);
    } catch (err: any) {
      showToast(err.message || (isRtl ? 'فشل حفظ بيانات الامتثال' : 'Failed to save compliance dates'), 'error');
    } finally {
      setQuickComplianceLoading(false);
    }
  };

  const openHrLetterModal = (emp: Employee) => {
    setSelectedLetterEmp(emp);
    setWithoutSealAndSignature(false);
    const allCrs = getAdminRegisteredCrs();
    const matchedCr = allCrs.find((c: any) => 
      c.cr_number === emp.salary_matrix?.cr || 
      c.cr_name === emp.salary_matrix?.company ||
      c.id === emp.salary_matrix?.cr
    ) || allCrs.find((c: any) => c.is_master) || allCrs[0];

    setSelectedCrForLetter(matchedCr || null);
    setIsHrLetterModalOpen(true);
  };

  const handleFastPrintPdf = () => {
    const letterElement = document.getElementById('printable-hr-letter');
    if (!letterElement) {
      window.print();
      return;
    }

    const printWin = window.open('', '_blank', 'width=900,height=1100');
    if (!printWin) {
      window.print();
      return;
    }

    const content = letterElement.innerHTML;
    const docTitle = `Official_HR_Letter_${selectedLetterEmp?.code || 'Doc'}_${selectedLetterType}${withoutSealAndSignature ? '_NoSealNoSign' : ''}`;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${docTitle}</title>
        <meta charset="utf-8">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: Arial, sans-serif !important;
            margin: 0;
            padding: 20px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .letter-wrapper {
            max-width: 780px;
            margin: 0 auto;
          }
        </style>
      </head>
      <body>
        <div class="letter-wrapper font-sans text-slate-900">
          ${content}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  const handleDownloadWord = async () => {
    if (!selectedLetterEmp) return;
    try {
      const reqPayload: any = {
        id: selectedLetterEmp.id || '1',
        employeeName: selectedLetterEmp.full_name,
        passportName: selectedLetterEmp.full_name,
        cpr: selectedLetterEmp.salary_matrix?.expatCpr || selectedLetterEmp.cpr_number || selectedLetterEmp.code,
        passport: selectedLetterEmp.salary_matrix?.expatPp || '',
        license: selectedLetterEmp.salary_matrix?.nhraLicenseNo || '',
        sponsor: selectedCrForLetter?.cr_name || selectedLetterEmp.salary_matrix?.company || 'Tabarak Pharmacy CO W.L.L',
        docTypes: [selectedLetterType === 'salary_certificate' ? 'Salary Certificate' : selectedLetterType === 'employment_certificate' ? 'Employment Certificate' : 'Bank NOC Letter'],
        status: 'Approved',
        requestDate: new Date().toISOString().split('T')[0],
        reason: 'Official Request'
      };

      const blob = await generateDocumentBlob(reqPayload, selectedLetterType);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Official_HR_Letter_${selectedLetterEmp.code}_${selectedLetterType}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(isRtl ? 'تم تنزيل ملف الـ Word (.docx) بنجاح' : 'Word document (.docx) downloaded successfully');
    } catch (e) {
      console.error(e);
      showToast(isRtl ? 'حدث خطأ أثناء تنزيل الملف' : 'Error generating Word file', 'error');
    }
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEmp, setEditingEmp] = useState<Partial<Employee> | null>(null);

  // Form State
  const [formCategory, setFormCategory] = useState<StaffCategory>('Driver');
  const [formCode, setFormCode] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formCpr, setFormCpr] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formStatus, setFormStatus] = useState<StaffStatus>('Active');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formAssignments, setFormAssignments] = useState<EmployeeBranchAssignment[]>([]);
  const [formVehicles, setFormVehicles] = useState<string[]>([]);
  const [fleetSearchTerm, setFleetSearchTerm] = useState<string>('');
  const [isFleetDropdownOpen, setIsFleetDropdownOpen] = useState<boolean>(false);

  // Salary Matrix & Financial Data Form State
  const registeredCrsList = useMemo(() => {
    return getAdminRegisteredCrs();
  }, [isModalOpen, isHrLetterModalOpen]);

  const [formCompany, setFormCompany] = useState<string>('');
  const [formCr, setFormCr] = useState<string>('');

  // Main Parent LMRA Registered Sponsors
  const parentSponsors = useMemo(() => {
    return registeredCrsList.filter((c: any) => {
      if (c.is_master) return true;
      if (!c.parent_cr_number) return true;
      const num = (c.cr_number || '').trim();
      return num.endsWith('-01') || num.endsWith('-1');
    });
  }, [registeredCrsList]);

  // Currently selected parent CR object
  const selectedParentCrObj = useMemo(() => {
    if (!formCompany) return null;
    return registeredCrsList.find(
      (c: any) => c.cr_name === formCompany || c.cr_name_ar === formCompany || c.cr_number === formCompany
    ) || null;
  }, [formCompany, registeredCrsList]);

  // Sub-CRs + Parent CR belonging ONLY to the selected Parent Sponsor
  const availableSubCrs = useMemo(() => {
    if (!selectedParentCrObj) return registeredCrsList;

    const parentNum = (selectedParentCrObj.cr_number || '').trim();
    const basePrefix = parentNum.split('-')[0];

    return registeredCrsList.filter((c: any) => {
      const cNum = (c.cr_number || '').trim();
      if (c.id === selectedParentCrObj.id || cNum === parentNum) return true;
      if (c.parent_cr_number === parentNum) return true;
      if (basePrefix && cNum.startsWith(basePrefix)) return true;
      return false;
    });
  }, [selectedParentCrObj, registeredCrsList]);
  const [formGender, setFormGender] = useState<'Male' | 'Female'>('Male');
  const [formVisaType, setFormVisaType] = useState<'Internal' | 'Flexi'>('Internal');
  const [formNationality, setFormNationality] = useState<string>('Egyptian / مصري');
  const [formExpatCpr, setFormExpatCpr] = useState<string>('');
  const [formExpatPp, setFormExpatPp] = useState<string>('');
  const [formExpatPpExpiry, setFormExpatPpExpiry] = useState<string>('');
  const [formWpExpiry, setFormWpExpiry] = useState<string>('');
  const [formIban, setFormIban] = useState<string>('');

  const handleVisaTypeChange = (newVisa: 'Internal' | 'Flexi') => {
    setFormVisaType(newVisa);
    if (newVisa === 'Flexi') {
      setFormCompany('N/A (Flexi Visa)');
      setFormCr('');
    } else {
      if (!formCompany || formCompany.includes('Flexi')) {
        const availableCrs = getAdminRegisteredCrs();
        const defaultCr = availableCrs.find((c: any) => c.is_master) || availableCrs[0];
        setFormCompany(defaultCr ? defaultCr.cr_name : '');
        setFormCr(defaultCr ? defaultCr.cr_number : '');
      }
    }
  };

  // Pharmacist License Data
  const [formNhraLicenseNo, setFormNhraLicenseNo] = useState<string>('');
  const [formNhraExpiryDate, setFormNhraExpiryDate] = useState<string>('');

  const [formBasicSalary, setFormBasicSalary] = useState<string>('0');
  const [formHousing, setFormHousing] = useState<string>('0');
  const [formTransportation, setFormTransportation] = useState<string>('0');
  const [formJobResponsibilityBonus, setFormJobResponsibilityBonus] = useState<string>('0');
  const [formLongShiftIncentive, setFormLongShiftIncentive] = useState<string>('0');
  const [formGosi1Pct, setFormGosi1Pct] = useState<string>('0');
  const [formEwaFees, setFormEwaFees] = useState<string>('0');
  const [formOthersDeduction, setFormOthersDeduction] = useState<string>('0');
  const [formPayrollDedLoan, setFormPayrollDedLoan] = useState<string>('0');

  // Automatic 1% GOSI calculation from basic salary
  const updateBasicSalary = (val: string) => {
    setFormBasicSalary(val);
    const basicNum = parseFloat(val) || 0;
    const autoGosi = (basicNum * 0.01).toFixed(3);
    setFormGosi1Pct(autoGosi);
  };

  // Computed Salary Matrix Totals
  const computedTotalFixed = useMemo(() => {
    const b = parseFloat(formBasicSalary) || 0;
    const h = parseFloat(formHousing) || 0;
    const t = parseFloat(formTransportation) || 0;
    return b + h + t;
  }, [formBasicSalary, formHousing, formTransportation]);

  const computedTotalVariable = useMemo(() => {
    const resp = parseFloat(formJobResponsibilityBonus) || 0;
    const shift = parseFloat(formLongShiftIncentive) || 0;
    return resp + shift;
  }, [formJobResponsibilityBonus, formLongShiftIncentive]);

  const computedTotalDeductions = useMemo(() => {
    const gosi = parseFloat(formGosi1Pct) || 0;
    const ewa = parseFloat(formEwaFees) || 0;
    const oth = parseFloat(formOthersDeduction) || 0;
    const loan = parseFloat(formPayrollDedLoan) || 0;
    return gosi + ewa + oth + loan;
  }, [formGosi1Pct, formEwaFees, formOthersDeduction, formPayrollDedLoan]);

  const computedTotalSalary = useMemo(() => {
    return computedTotalFixed + computedTotalVariable;
  }, [computedTotalFixed, computedTotalVariable]);

  const computedNetSalary = useMemo(() => {
    return computedTotalSalary - computedTotalDeductions;
  }, [computedTotalSalary, computedTotalDeductions]);

  // Modal Drag state
  const [modalPos, setModalPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragRef = React.useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0
  });

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: modalPos.x,
      initialY: modalPos.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setModalPos({
        x: dragRef.current.initialX + dx,
        y: dragRef.current.initialY + dy
      });
    };

    const onMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  // Toast / Feedback State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Salary Privacy Mask State (by default salaries can be toggled per card)
  const [unmaskedSalaries, setUnmaskedSalaries] = useState<Record<string, boolean>>({});
  const toggleSalaryVisibility = (empId: string) => {
    setUnmaskedSalaries(prev => ({ ...prev, [empId]: !prev[empId] }));
  };

  // CPR Copied State
  const [copiedCprId, setCopiedCprId] = useState<string | null>(null);
  const handleCopyCpr = (e: React.MouseEvent, cpr: string, empId: string) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(cpr);
      setCopiedCprId(empId);
      showToast(isRtl ? `تم نسخ الرقم الشخصي: ${cpr}` : `CPR copied: ${cpr}`, 'success');
      setTimeout(() => setCopiedCprId(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  // Pharmacist NHRA Expiry Status Helper
  const getNhraExpiryStatus = (expiryDateStr?: string) => {
    if (!expiryDateStr) return null;
    const now = new Date();
    const expiry = new Date(expiryDateStr);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { status: 'expired', days: Math.abs(diffDays), labelAr: 'منتهي الصلاحية', labelEn: 'Expired', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    } else if (diffDays <= 30) {
      return { status: 'warning', days: diffDays, labelAr: `ينتهي خلال ${diffDays} يوم`, labelEn: `Expires in ${diffDays}d`, color: 'bg-amber-50 text-amber-700 border-amber-200' };
    } else {
      return { status: 'valid', days: diffDays, labelAr: `ساري (${diffDays} يوم)`, labelEn: `Valid (${diffDays}d)`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
  };

  // General Document Expiry Status Helper (PP Expiry Date & WP Expiry Date)
  const getExpiryStatus = (expiryDateStr?: string, warningDays: number = 60) => {
    if (!expiryDateStr) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDateStr);
    if (isNaN(expiry.getTime())) return null;
    expiry.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        status: 'expired' as const,
        days: Math.abs(diffDays),
        indicator: '🔴',
        badgeText: '🔴 Expired',
        badgeTextAr: '🔴 منتهي (Expired)',
        labelAr: `🔴 منتهي (${Math.abs(diffDays)} يوم)`,
        labelEn: `🔴 Expired (${Math.abs(diffDays)}d ago)`,
        cardBg: 'bg-gradient-to-b from-rose-50/80 to-rose-100/40 border-rose-200/90 hover:border-rose-400',
        color: 'bg-rose-100/90 text-rose-800 border-rose-300 shadow-2xs'
      };
    } else if (diffDays <= warningDays) {
      return {
        status: 'warning' as const,
        days: diffDays,
        indicator: '🟡',
        badgeText: '🟡 Expiring Soon < 60 days',
        badgeTextAr: '🟡 ينتهي قريباً (< 60 يوم)',
        labelAr: `🟡 ينتهي قريباً (${diffDays} يوم)`,
        labelEn: `🟡 Expiring Soon (${diffDays}d)`,
        cardBg: 'bg-gradient-to-b from-amber-50/80 to-amber-100/40 border-amber-200/90 hover:border-amber-400',
        color: 'bg-amber-100/90 text-amber-900 border-amber-300 shadow-2xs'
      };
    } else {
      return {
        status: 'valid' as const,
        days: diffDays,
        indicator: '🟢',
        badgeText: '🟢 Valid',
        badgeTextAr: '🟢 ساري (Valid)',
        labelAr: `🟢 ساري (${diffDays} يوم)`,
        labelEn: `🟢 Valid (${diffDays}d)`,
        cardBg: 'bg-gradient-to-b from-emerald-50/70 to-emerald-100/30 border-emerald-200/80 hover:border-emerald-400',
        color: 'bg-emerald-100/90 text-emerald-800 border-emerald-300 shadow-2xs'
      };
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [empList, branchList, vehicleList] = await Promise.all([
        workforceService.getAllEmployees(),
        branchService.list(),
        expenseService.vehicles.list(true).catch(() => [])
      ]);
      setEmployees(empList);
      setSelectedEmpIds(prev => {
        const currentIds = new Set(empList.map(e => e.id));
        return prev.filter(id => currentIds.has(id));
      });
      if (branchList && branchList.length > 0) {
        setBranches(branchList);
      }
      if (vehicleList && vehicleList.length > 0) {
        setSystemVehicles(vehicleList);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleWorkforceUpdate = () => {
      loadData();
    };
    window.addEventListener('tabarak_workforce_updated', handleWorkforceUpdate);
    return () => {
      window.removeEventListener('tabarak_workforce_updated', handleWorkforceUpdate);
    };
  }, []);

  // Compute available fleet list combining live system vehicles and default registered plates
  const availableFleetList = useMemo(() => {
    if (systemVehicles && systemVehicles.length > 0) {
      return systemVehicles.map(v => {
        const plate = (v.plateNumber || '').trim();
        const code = (v.vehicleCode || '').trim();
        const tagValue = plate || code;
        return {
          id: v.id,
          code,
          plateNumber: plate || code,
          type: v.vehicleType || 'Motorcycle',
          ownership: v.ownershipType || 'Internal',
          status: v.status || 'Active',
          tagValue,
          shortTag: plate || code
        };
      });
    }
    return DEFAULT_FLEET_VEHICLES.map(v => ({
      id: v.code,
      code: v.code,
      plateNumber: v.plateNumber,
      type: v.type,
      ownership: v.ownership,
      status: 'Active',
      tagValue: v.plateNumber,
      shortTag: v.plateNumber
    }));
  }, [systemVehicles]);

  // Filtered fleet vehicles for multi-select search dropdown
  const filteredFleetList = useMemo(() => {
    if (!fleetSearchTerm.trim()) return availableFleetList;
    const term = fleetSearchTerm.trim().toLowerCase();
    return availableFleetList.filter(
      v =>
        v.plateNumber.toLowerCase().includes(term) ||
        v.code.toLowerCase().includes(term) ||
        v.tagValue.toLowerCase().includes(term) ||
        v.ownership.toLowerCase().includes(term)
    );
  }, [availableFleetList, fleetSearchTerm]);

  // Category Auto Code Generator on Category Change (for new entries)
  const handleCategoryChange = (newCat: StaffCategory) => {
    setFormCategory(newCat);
    if (!editingEmp?.id) {
      const autoCode = workforceService.generateNextCode(newCat, employees);
      setFormCode(autoCode);
    }
  };

  const openAddModal = () => {
    const defaultCat: StaffCategory = 'Driver';
    const autoCode = workforceService.generateNextCode(defaultCat, employees);
    setEditingEmp(null);
    setFormCategory(defaultCat);
    setFormCode(autoCode);
    setFormName('');
    setFormCpr('');
    setFormPhone('');
    setFormEmail('');
    setFormStatus('Active');
    setFormNotes('');
    setFormAssignments([]);
    setFormVehicles([]);
    setFleetSearchTerm('');
    setIsFleetDropdownOpen(false);

    // Salary Matrix Resets (Default to Master Registered CR if available)
    const availableCrs = getAdminRegisteredCrs();
    const defaultCr = availableCrs.find((c: any) => c.is_master) || availableCrs[0];
    setFormGender('Male');
    setFormVisaType('Internal');
    setFormNationality('Egyptian / مصري');
    setFormCompany(defaultCr ? defaultCr.cr_name : '');
    setFormCr(defaultCr ? defaultCr.cr_number : '');
    setFormExpatCpr('');
    setFormExpatPp('');
    setFormExpatPpExpiry('');
    setFormWpExpiry('');
    setFormIban('');
    setFormNhraLicenseNo('');
    setFormNhraExpiryDate('');
    setFormBasicSalary('0');
    setFormHousing('0');
    setFormTransportation('0');
    setFormJobResponsibilityBonus('0');
    setFormLongShiftIncentive('0');
    setFormGosi1Pct('0');
    setFormEwaFees('0');
    setFormOthersDeduction('0');
    setFormPayrollDedLoan('0');

    setModalPos({ x: 0, y: 0 });
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmp(emp);
    const cat = emp.category || 'Driver';

    setFormCategory(cat);
    setFormCode(emp.code);
    setFormName(emp.full_name);
    setFormCpr(emp.cpr_number || '');
    setFormPhone(emp.phone || '');
    setFormEmail(emp.email || '');
    setFormStatus(emp.status || 'Active');
    setFormNotes(emp.notes || '');
    setFormAssignments(emp.assignments ? [...emp.assignments] : []);
    setFormVehicles(emp.assigned_vehicles ? [...emp.assigned_vehicles] : []);
    setFleetSearchTerm('');
    setIsFleetDropdownOpen(false);

    // Salary Matrix Population
    const sm = emp.salary_matrix || {};
    setFormGender((sm.gender || emp.gender || 'Male') as 'Male' | 'Female');
    setFormVisaType((sm.visaType || emp.visa_type || 'Internal') as 'Internal' | 'Flexi');
    setFormNationality(emp.nationality || sm.nationality || 'Egyptian / مصري');
    setFormCompany(sm.company || '');
    setFormCr(sm.cr || '');
    setFormExpatCpr(sm.expatCpr || emp.cpr_number || '');
    setFormExpatPp(sm.expatPp || emp.passport_number || '');
    setFormExpatPpExpiry(sm.expatPpExpiryDate || sm.ppExpiryDate || emp.passport_expiry_date || '');
    setFormWpExpiry(sm.wpExpiryDate || sm.visaExpiryDate || emp.wp_expiry_date || '');
    setFormIban(sm.iban || '');
    setFormNhraLicenseNo(sm.nhraLicenseNo || (cat === 'Pharmacist' ? `NHRA-PH-${emp.code}` : ''));
    setFormNhraExpiryDate(sm.nhraExpiryDate || (cat === 'Pharmacist' ? '2026-12-31' : ''));
    setFormBasicSalary(sm.basicSalary !== undefined ? String(sm.basicSalary) : '0');
    setFormHousing(sm.housing !== undefined ? String(sm.housing) : '0');
    setFormTransportation(sm.transportation !== undefined ? String(sm.transportation) : '0');
    setFormJobResponsibilityBonus(sm.jobResponsibilityBonus !== undefined ? String(sm.jobResponsibilityBonus) : '0');
    setFormLongShiftIncentive(sm.longShiftIncentive !== undefined ? String(sm.longShiftIncentive) : '0');

    const defaultGosi = sm.basicSalary ? (sm.basicSalary * 0.01).toFixed(3) : '0';
    setFormGosi1Pct(sm.gosi1Pct !== undefined ? String(sm.gosi1Pct) : defaultGosi);

    setFormEwaFees(sm.ewaFees !== undefined ? String(sm.ewaFees) : '0');
    setFormOthersDeduction(sm.othersDeduction !== undefined ? String(sm.othersDeduction) : '0');
    setFormPayrollDedLoan(sm.payrollDedLoan !== undefined ? String(sm.payrollDedLoan) : '0');

    setModalPos({ x: 0, y: 0 });
    setIsModalOpen(true);
  };

  const toggleFleetVehicle = (tagValue: string) => {
    const valTrim = tagValue.trim().toUpperCase();
    if (!valTrim) return;

    setFormVehicles(prev => {
      const existingIdx = prev.findIndex(
        v => v.toUpperCase() === valTrim ||
             valTrim.includes(v.toUpperCase()) ||
             v.toUpperCase().includes(valTrim)
      );

      if (existingIdx !== -1) {
        return prev.filter((_, idx) => idx !== existingIdx);
      } else {
        return [...prev, valTrim];
      }
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast(isRtl ? 'يرجى إدخال اسم الموظف' : 'Please enter employee name', 'error');
      return;
    }
    if (!formCode.trim()) {
      showToast(isRtl ? 'يرجى إدخال كود الموظف' : 'Please enter employee code', 'error');
      return;
    }

    try {
      await workforceService.saveEmployee(
        {
          id: editingEmp?.id,
          code: formCode.trim().toUpperCase(),
          full_name: formName.trim(),
          category: formCategory,
          cpr_number: formExpatCpr.trim() || formCpr.trim() || undefined,
          passport_number: formExpatPp.trim() || undefined,
          passport_expiry_date: formExpatPpExpiry.trim() || undefined,
          wp_expiry_date: formWpExpiry.trim() || undefined,
          phone: formPhone.trim() || undefined,
          email: formEmail.trim() || undefined,
          gender: formGender,
          visa_type: formVisaType,
          nationality: formNationality.trim() || undefined,
          status: formStatus,
          notes: formNotes.trim() || undefined,
          driver_id: editingEmp?.driver_id,
          pharmacist_id: editingEmp?.pharmacist_id,
          assigned_vehicles: formVehicles,
          salary_matrix: {
            company: formCompany.trim() || undefined,
            cr: formCr.trim() || undefined,
            expatCpr: formExpatCpr.trim() || formCpr.trim() || undefined,
            expatPp: formExpatPp.trim() || undefined,
            expatPpExpiryDate: formExpatPpExpiry.trim() || undefined,
            ppExpiryDate: formExpatPpExpiry.trim() || undefined,
            wpExpiryDate: formWpExpiry.trim() || undefined,
            visaExpiryDate: formWpExpiry.trim() || undefined,
            gender: formGender,
            visaType: formVisaType,
            nationality: formNationality.trim() || undefined,
            iban: formIban.trim() || undefined,
            nhraLicenseNo: formNhraLicenseNo.trim() || undefined,
            nhraExpiryDate: formNhraExpiryDate.trim() || undefined,
            totalSalary: computedTotalSalary,
            basicSalary: parseFloat(formBasicSalary) || 0,
            housing: parseFloat(formHousing) || 0,
            transportation: parseFloat(formTransportation) || 0,
            totalFixed: computedTotalFixed,
            jobResponsibilityBonus: parseFloat(formJobResponsibilityBonus) || 0,
            longShiftIncentive: parseFloat(formLongShiftIncentive) || 0,
            totalVariable: computedTotalVariable,
            gosi1Pct: parseFloat(formGosi1Pct) || 0,
            ewaFees: parseFloat(formEwaFees) || 0,
            othersDeduction: parseFloat(formOthersDeduction) || 0,
            payrollDedLoan: parseFloat(formPayrollDedLoan) || 0,
            totalDeductions: computedTotalDeductions,
            netSalary: computedNetSalary
          }
        },
        formAssignments
      );

      showToast(
        isRtl
          ? `تم حفظ بيانات الموظف [${formCode}] بنجاح`
          : `Employee [${formCode}] saved successfully`,
        'success'
      );
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || (isRtl ? 'فشل الحفظ' : 'Save failed'), 'error');
    }
  };

  const handleDelete = (emp: Employee) => {
    setDeletingEmpTarget(emp);
  };

  const handleSoftDelete = async (emp: Employee) => {
    try {
      await workforceService.saveEmployee(
        {
          id: emp.id,
          code: emp.code,
          full_name: emp.full_name,
          category: emp.category,
          cpr_number: emp.cpr_number,
          phone: emp.phone,
          email: emp.email,
          status: 'Inactive',
          notes: (emp.notes ? emp.notes + ' | ' : '') + (isRtl ? 'تم تعطيل الحساب لحفظ السجلات التاريخية' : 'Account deactivated to preserve audit log history'),
          driver_id: emp.driver_id,
          pharmacist_id: emp.pharmacist_id
        },
        emp.assignments || []
      );

      showToast(
        isRtl
          ? `تم تعطيل حساب الموظف [${emp.code}] بنجاح (Inactive) والحفاظ على سجلاته القديمة`
          : `Employee [${emp.code}] deactivated (Inactive) to preserve audit history`,
        'success'
      );
      setDeletingEmpTarget(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || (isRtl ? 'فشل تعطيل الحساب' : 'Deactivation failed'), 'error');
    }
  };

  const handleHardDelete = async (emp: Employee) => {
    try {
      await workforceService.deleteEmployee(emp.id, emp);
      showToast(
        isRtl ? `تم حذف الموظف [${emp.code}] نهائياً من النظام` : `Employee [${emp.code}] permanently deleted`,
        'success'
      );
      setDeletingEmpTarget(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || (isRtl ? 'فشل الحذف النهائي' : 'Delete failed'), 'error');
    }
  };

  // Generate 20 branch slots (T001 to T020) overlaying system branches
  const grid20Branches = useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => {
      const defaultCode = `T${String(i + 1).padStart(3, '0')}`;
      const real = branches[i];
      return {
        id: real?.id || defaultCode,
        code: real?.code || defaultCode,
        name: real?.name || `${isRtl ? 'فرع' : 'Branch'} ${defaultCode}`,
        lat: real?.lat ? Number(real.lat) : 26.2285,
        lng: real?.lng ? Number(real.lng) : 50.5860
      };
    });
  }, [branches, isRtl]);

  const toggleBranchAssignment = (branch: Partial<Branch>) => {
    const targetCode = branch.code || branch.id || '';
    const targetName = branch.name || targetCode;
    const targetId = branch.id || targetCode;

    const existingIndex = formAssignments.findIndex(
      a => a.branch_id === targetId || a.branch_id === targetCode || a.branch_name === targetName
    );

    if (existingIndex !== -1) {
      setFormAssignments(formAssignments.filter((_, idx) => idx !== existingIndex));
    } else {
      const isFirst = formAssignments.length === 0;
      setFormAssignments([
        ...formAssignments,
        {
          branch_id: targetId,
          branch_name: targetName,
          lat: branch.lat ? Number(branch.lat) : 26.2285,
          lng: branch.lng ? Number(branch.lng) : 50.5860,
          geofence_radius_meters: 50,
          is_primary: isFirst
        }
      ]);
    }
  };

  const updateAssignmentRadius = (branchId: string, radius: number) => {
    setFormAssignments(
      formAssignments.map(a =>
        a.branch_id === branchId ? { ...a, geofence_radius_meters: radius } : a
      )
    );
  };

  const setPrimaryBranch = (branchId: string) => {
    setFormAssignments(
      formAssignments.map(a => ({
        ...a,
        is_primary: a.branch_id === branchId
      }))
    );
  };

  const handleSelectAllBranches = () => {
    if (formAssignments.length === grid20Branches.length) {
      setFormAssignments([]);
    } else {
      const all: EmployeeBranchAssignment[] = grid20Branches.map((b, idx) => ({
        branch_id: b.id,
        branch_name: b.name,
        lat: b.lat,
        lng: b.lng,
        geofence_radius_meters: 50,
        is_primary: idx === 0
      }));
      setFormAssignments(all);
    }
  };

  // EXPORT AS EXCEL / CSV
  const handleExportExcel = () => {
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

  // DOWNLOAD STANDARD EXCEL TEMPLATE
  const handleDownloadTemplate = async () => {
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

  // IMPORT FROM EXCEL / CSV
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      loadData();
    } catch (err: any) {
      console.error('Import error:', err);
      showToast(
        isRtl ? `حدث خطأ أثناء قراءة ملف الإكسيل: ${err.message || ''}` : `Error importing Excel file: ${err.message || ''}`,
        'error'
      );
    } finally {
      e.target.value = '';
    }
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesCat = selectedCategory === 'ALL' || emp.category === selectedCategory;
      const matchesStatus = selectedStatus === 'ALL' || emp.status === selectedStatus;

      const empGender = emp.salary_matrix?.gender || emp.gender || 'Male';
      const matchesGender = selectedGender === 'ALL' || empGender === selectedGender;

      const empVisa = emp.salary_matrix?.visaType || emp.visa_type || 'Internal';
      const matchesVisa = selectedVisaType === 'ALL' || empVisa === selectedVisaType;

      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        emp.full_name.toLowerCase().includes(q) ||
        emp.code.toLowerCase().includes(q) ||
        (emp.cpr_number && emp.cpr_number.toLowerCase().includes(q)) ||
        (emp.phone && emp.phone.includes(q)) ||
        (emp.nationality && emp.nationality.toLowerCase().includes(q)) ||
        (emp.salary_matrix?.nationality && emp.salary_matrix.nationality.toLowerCase().includes(q)) ||
        (emp.salary_matrix?.company && emp.salary_matrix.company.toLowerCase().includes(q)) ||
        (emp.assignments && emp.assignments.some(a => a.branch_name?.toLowerCase().includes(q)));

      return matchesCat && matchesStatus && matchesGender && matchesVisa && matchesSearch;
    });
  }, [employees, selectedCategory, selectedStatus, selectedGender, selectedVisaType, searchTerm]);

  // Category Badge Colors & Icons (Flat 2D Vector)
  const getCategoryMeta = (cat: StaffCategory) => {
    switch (cat) {
      case 'Pharmacist':
        return {
          labelAr: 'صيدلي',
          labelEn: 'Pharmacist',
          prefix: 'E',
          color: 'bg-blue-50 text-blue-700 border-blue-200',
          badgeColor: 'bg-blue-600 text-white',
          icon: VectorPharmacist
        };
      case 'Driver':
        return {
          labelAr: 'سائق توصيل',
          labelEn: 'Delivery Driver',
          prefix: 'D',
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          badgeColor: 'bg-emerald-600 text-white',
          icon: VectorDriver
        };
      case 'Worker':
        return {
          labelAr: 'عامل صيدلية',
          labelEn: 'Pharmacy Worker',
          prefix: 'W',
          color: 'bg-amber-50 text-amber-700 border-amber-200',
          badgeColor: 'bg-amber-600 text-white',
          icon: VectorWorker
        };
      case 'Management':
        return {
          labelAr: 'إدارة / إنشائي',
          labelEn: 'Management',
          prefix: 'M',
          color: 'bg-purple-50 text-purple-700 border-purple-200',
          badgeColor: 'bg-purple-600 text-white',
          icon: VectorManagement
        };
    }
  };

  // Stats Counters (Total + Active & Inactive Breakdown per category)
  const stats = useMemo(() => {
    const getCounts = (cat?: StaffCategory) => {
      const list = cat ? employees.filter(e => e.category === cat) : employees;
      const active = list.filter(e => e.status === 'Active').length;
      const inactive = list.filter(e => e.status === 'Inactive').length;
      return { total: list.length, active, inactive };
    };

    return {
      all: getCounts(),
      pharmacists: getCounts('Pharmacist'),
      drivers: getCounts('Driver'),
      workers: getCounts('Worker'),
      management: getCounts('Management')
    };
  }, [employees]);

  // Bulk Selection Derived State & Handlers
  const selectedEmps = useMemo(() => {
    const idSet = new Set(selectedEmpIds);
    return employees.filter(e => idSet.has(e.id));
  }, [employees, selectedEmpIds]);

  const isAllFilteredSelected = useMemo(() => {
    if (filteredEmployees.length === 0) return false;
    const idSet = new Set(selectedEmpIds);
    return filteredEmployees.every(e => idSet.has(e.id));
  }, [filteredEmployees, selectedEmpIds]);

  const isSomeFilteredSelected = useMemo(() => {
    if (filteredEmployees.length === 0) return false;
    const idSet = new Set(selectedEmpIds);
    return filteredEmployees.some(e => idSet.has(e.id)) && !isAllFilteredSelected;
  }, [filteredEmployees, selectedEmpIds, isAllFilteredSelected]);

  const toggleSelectEmp = (empId: string) => {
    setSelectedEmpIds(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  const handleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredEmployees.map(e => e.id));
      setSelectedEmpIds(prev => prev.filter(id => !filteredIdSet.has(id)));
    } else {
      const newIds = Array.from(new Set([...selectedEmpIds, ...filteredEmployees.map(e => e.id)]));
      setSelectedEmpIds(newIds);
    }
  };

  const handleSelectAllTotal = () => {
    setSelectedEmpIds(employees.map(e => e.id));
  };

  const handleClearSelection = () => {
    setSelectedEmpIds([]);
  };

  const handleBulkSoftDelete = async () => {
    if (selectedEmps.length === 0) return;
    setBulkDeleteLoading(true);
    try {
      await workforceService.batchSoftDelete(selectedEmps, isRtl);
      showToast(
        isRtl
          ? `تم تعطيل حساب (${selectedEmps.length}) موظف بنجاح (Inactive)`
          : `(${selectedEmps.length}) staff accounts deactivated successfully`,
        'success'
      );
      setSelectedEmpIds([]);
      setIsBulkDeleteModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || (isRtl ? 'فشل تعطيل الحسابات' : 'Deactivation failed'), 'error');
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleBulkHardDelete = async () => {
    if (selectedEmps.length === 0) return;
    setBulkDeleteLoading(true);
    try {
      await workforceService.deleteEmployees(selectedEmps);
      showToast(
        isRtl
          ? `تم حذف (${selectedEmps.length}) موظف نهائياً من النظام`
          : `(${selectedEmps.length}) staff permanently deleted`,
        'success'
      );
      setSelectedEmpIds([]);
      setIsBulkDeleteModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || (isRtl ? 'فشل الحذف النهائي' : 'Bulk delete failed'), 'error');
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  return (
    <div className={`space-y-6 page-enter ${isRtl ? 'dir-rtl' : ''}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-[3500] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl backdrop-blur-md border animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-red-600 text-white border-red-500'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-white" /> : <AlertCircle className="w-5 h-5 text-white" />}
          <span className="font-bold text-sm">{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner - Executive Dark Theme Card with Professional Actions Alignment */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl border border-slate-800/80">
        {/* Ambient Glow Background Effects */}
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Main Title Block */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-300">
              <Users className="h-3.5 w-3.5 text-emerald-400" />
              <span>{isRtl ? 'سجل الموارد البشرية والعمالة الموحد' : 'HR & Workforce Module'}</span>
            </div>
            <h2 className="mt-2.5 text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              {isRtl ? 'دليل كادر العمل والتتمرك الجغرافي' : 'Workforce & Geofenced Location Directory'}
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-300 max-w-2xl leading-relaxed">
              {isRtl
                ? 'مصدر البيانات الرئيسي للكادر بالأكواد الموحدة (E, D, W, M) ونطاق بصمة الحضور الجغرافية'
                : 'Single Source of Truth for staff with prefixed codes (E, D, W, M) and multi-branch GPS geofencing'}
            </p>
          </div>

          {/* Action Toolbar Cluster - Professional Alignment & Styling */}
          <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-700/80 bg-slate-800/80 p-2.5 backdrop-blur-md shadow-inner self-start lg:self-auto">
            {/* Back Button */}
            {onBack && <BackToModulesButton onClick={onBack} />}

            {/* Add Employee Button (Hero Action) */}
            <button
              onClick={openAddModal}
              className="group relative inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-xs font-black text-white shadow-md transition-all duration-200 hover:from-emerald-400 hover:to-teal-500 hover:shadow-emerald-500/25 active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
              <span>{isRtl ? 'إضافة موظف جديد' : 'Add New Employee'}</span>
            </button>

            <div className="hidden h-5 w-px bg-slate-700 sm:block mx-0.5" />

            {/* Download Template Button */}
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 rounded-lg border border-purple-500/50 bg-purple-950/40 px-3.5 py-2.5 text-xs font-bold text-purple-200 transition-all hover:border-purple-400 hover:bg-purple-900/60 hover:text-white active:scale-95 cursor-pointer shadow-xs"
              title={isRtl ? 'تحميل نموذج إكسيل رسمي جاهز بالصيغة الصحيحة والأمثلة (XLSX)' : 'Download official Excel template with sample records (XLSX)'}
            >
              <FileSpreadsheet className="h-4 w-4 text-purple-400" />
              <span>{isRtl ? 'نموذج إكسيل' : 'Excel Template'}</span>
            </button>

            {/* Import Excel Button */}
            <label
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600/80 bg-slate-700/80 px-3.5 py-2.5 text-xs font-bold text-slate-200 transition-all hover:border-blue-500/50 hover:bg-slate-700 hover:text-white active:scale-95 cursor-pointer shadow-xs"
              title={isRtl ? 'استيراد موظفين من ملف Excel/CSV (تعديل أو إضافة)' : 'Import staff from Excel/CSV (Rewrite/Add)'}
            >
              <Upload className="h-4 w-4 text-blue-400" />
              <span>{isRtl ? 'استيراد إكسيل' : 'Import Excel'}</span>
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleImportExcel}
                className="hidden"
              />
            </label>

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600/80 bg-slate-700/80 px-3.5 py-2.5 text-xs font-bold text-slate-200 transition-all hover:border-emerald-500/50 hover:bg-slate-700 hover:text-white active:scale-95 cursor-pointer shadow-xs"
              title={isRtl ? 'تصدير جميع الموظفين إلى ملف Excel/CSV' : 'Export all staff to Excel/CSV'}
            >
              <Download className="h-4 w-4 text-emerald-400" />
              <span>{isRtl ? 'تصدير إكسيل' : 'Export Excel'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category KPI Stats Grid - Premium Flat 2D Vector UI */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-5">
        {/* 1. Total Staff Card (ALL) */}
        <div
          onClick={() => setSelectedCategory('ALL')}
          className={`group relative cursor-pointer rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            selectedCategory === 'ALL'
              ? 'border-slate-800 bg-gradient-to-b from-slate-900/[0.04] to-slate-900/[0.08] ring-2 ring-slate-800/20 shadow-md'
              : 'border-slate-200/80 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-slate-800 text-white text-[10px] font-black tracking-wider shadow-2xs">
                ALL
              </span>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                {isRtl ? 'الكل' : 'All'}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200/70 group-hover:scale-105 transition-transform">
              <VectorAllStaff className="w-4 h-4 text-slate-800" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 tabular-nums">{stats.all.total}</p>
          
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-slate-100 text-[10px] font-bold">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{stats.all.active} {isRtl ? 'نشط' : 'Active'}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>{stats.all.inactive} {isRtl ? 'موقوف' : 'Inactive'}</span>
            </span>
          </div>
          {selectedCategory === 'ALL' && (
            <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-slate-800 rounded-full" />
          )}
        </div>

        {/* 2. Pharmacists Card (E) */}
        <div
          onClick={() => setSelectedCategory('Pharmacist')}
          className={`group relative cursor-pointer rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            selectedCategory === 'Pharmacist'
              ? 'border-blue-500 bg-gradient-to-b from-blue-50/70 to-blue-100/40 ring-2 ring-blue-500/20 shadow-md'
              : 'border-slate-200/80 bg-white hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-black tracking-wider shadow-2xs">
                E
              </span>
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                {isRtl ? 'صيدلي' : 'Pharmacist'}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200/70 group-hover:scale-105 transition-transform">
              <VectorPharmacist className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 tabular-nums">{stats.pharmacists.total}</p>

          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-blue-100/70 text-[10px] font-bold">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{stats.pharmacists.active} {isRtl ? 'نشط' : 'Active'}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>{stats.pharmacists.inactive} {isRtl ? 'موقوف' : 'Inactive'}</span>
            </span>
          </div>
          {selectedCategory === 'Pharmacist' && (
            <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 rounded-full" />
          )}
        </div>

        {/* 3. Drivers Card (D) - Flat 2D Vector Helmet Kept */}
        <div
          onClick={() => setSelectedCategory('Driver')}
          className={`group relative cursor-pointer rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            selectedCategory === 'Driver'
              ? 'border-emerald-500 bg-gradient-to-b from-emerald-50/70 to-emerald-100/40 ring-2 ring-emerald-500/20 shadow-md'
              : 'border-slate-200/80 bg-white hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black tracking-wider shadow-2xs">
                D
              </span>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                {isRtl ? 'سائق' : 'Driver'}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/70 group-hover:scale-105 transition-transform">
              <VectorDriver className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 tabular-nums">{stats.drivers.total}</p>

          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-emerald-100/70 text-[10px] font-bold">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{stats.drivers.active} {isRtl ? 'نشط' : 'Active'}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>{stats.drivers.inactive} {isRtl ? 'موقوف' : 'Inactive'}</span>
            </span>
          </div>
          {selectedCategory === 'Driver' && (
            <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-emerald-600 rounded-full" />
          )}
        </div>

        {/* 4. Workers Card (W) */}
        <div
          onClick={() => setSelectedCategory('Worker')}
          className={`group relative cursor-pointer rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            selectedCategory === 'Worker'
              ? 'border-amber-500 bg-gradient-to-b from-amber-50/70 to-amber-100/40 ring-2 ring-amber-500/20 shadow-md'
              : 'border-slate-200/80 bg-white hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-amber-600 text-white text-[10px] font-black tracking-wider shadow-2xs">
                W
              </span>
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                {isRtl ? 'عامل' : 'Worker'}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/70 group-hover:scale-105 transition-transform">
              <VectorWorker className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 tabular-nums">{stats.workers.total}</p>

          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-amber-100/70 text-[10px] font-bold">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{stats.workers.active} {isRtl ? 'نشط' : 'Active'}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>{stats.workers.inactive} {isRtl ? 'موقوف' : 'Inactive'}</span>
            </span>
          </div>
          {selectedCategory === 'Worker' && (
            <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-amber-600 rounded-full" />
          )}
        </div>

        {/* 5. Management Card (M) */}
        <div
          onClick={() => setSelectedCategory('Management')}
          className={`group relative cursor-pointer rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            selectedCategory === 'Management'
              ? 'border-purple-500 bg-gradient-to-b from-purple-50/70 to-purple-100/40 ring-2 ring-purple-500/20 shadow-md'
              : 'border-slate-200/80 bg-white hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-purple-600 text-white text-[10px] font-black tracking-wider shadow-2xs">
                M
              </span>
              <p className="text-[10px] font-black uppercase tracking-wider text-purple-700">
                {isRtl ? 'إدارة' : 'Management'}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-200/70 group-hover:scale-105 transition-transform">
              <VectorManagement className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 tabular-nums">{stats.management.total}</p>

          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-purple-100/70 text-[10px] font-bold">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{stats.management.active} {isRtl ? 'نشط' : 'Active'}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>{stats.management.inactive} {isRtl ? 'موقوف' : 'Inactive'}</span>
            </span>
          </div>
          {selectedCategory === 'Management' && (
            <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-purple-600 rounded-full" />
          )}
        </div>
      </div>

      {/* Premium Search & Multi-Filter Control Console */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
        {/* Row 1: Search Input & Primary Category Filter Tabs */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3.5">
          {/* Main Search Box with Flat Vector Badge */}
          <div className="relative flex-1 min-w-[280px]">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={isRtl ? 'بحث بالاسم، الكود، الرقم الشخصي، أو الفرع...' : 'Search name, code, CPR, or branch...'}
                className={`w-full rounded-xl border border-slate-200/90 bg-slate-50/70 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-brand focus:bg-white focus:ring-3 focus:ring-brand/10 transition-all py-3 ${
                  isRtl ? 'pr-4 pl-20' : 'pl-4 pr-20'
                }`}
              />
              <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1.5 ${isRtl ? 'left-2.5' : 'right-2.5'}`}>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="px-1.5 py-0.5 rounded-md bg-slate-200/80 hover:bg-slate-300 text-[10px] font-black text-slate-600 transition-all cursor-pointer"
                    title={isRtl ? 'مسح البحث' : 'Clear search'}
                  >
                    ✕
                  </button>
                )}
                <span className="hidden sm:inline-block px-2 py-1 rounded-lg bg-slate-200/60 text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-300/40">
                  FIND
                </span>
              </div>
            </div>
          </div>

          {/* Primary Category Segmented Control (Flat 2D Vector Badges) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80 self-start xl:self-auto w-full xl:w-auto">
            {[
              { id: 'ALL', labelAr: 'الكل', labelEn: 'All', badge: 'ALL', badgeBg: 'bg-slate-800 text-white', vector: VectorAllStaff },
              { id: 'Pharmacist', labelAr: 'صيدلي', labelEn: 'Pharmacist', badge: 'E', badgeBg: 'bg-blue-600 text-white', vector: VectorPharmacist },
              { id: 'Driver', labelAr: 'سائق', labelEn: 'Driver', badge: 'D', badgeBg: 'bg-emerald-600 text-white', vector: VectorDriver },
              { id: 'Worker', labelAr: 'عامل', labelEn: 'Worker', badge: 'W', badgeBg: 'bg-amber-600 text-white', vector: VectorWorker },
              { id: 'Management', labelAr: 'إدارة', labelEn: 'Management', badge: 'M', badgeBg: 'bg-purple-600 text-white', vector: VectorManagement }
            ].map(tab => {
              const VectorComp = tab.vector;
              const isSelected = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`flex items-center gap-2 whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/90 ring-1 ring-slate-900/5 scale-[1.02]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider ${tab.badgeBg} shadow-2xs`}>
                    <VectorComp className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>{tab.badge}</span>
                  </span>
                  <span>{isRtl ? tab.labelAr : tab.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Thin Separator */}
        <div className="h-px bg-slate-100" />

        {/* Row 2: Secondary Precision Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter Segmented Control */}
            <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-xl border border-slate-200/70">
              <span className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                {isRtl ? 'الحالة' : 'Status'}
              </span>
              {[
                { id: 'ALL', labelAr: 'الكل', labelEn: 'All Status', dot: null },
                { id: 'Active', labelAr: 'نشط', labelEn: 'Active', dot: 'bg-emerald-500' },
                { id: 'Inactive', labelAr: 'موقوف', labelEn: 'Inactive', dot: 'bg-slate-400' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedStatus(tab.id as any)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    selectedStatus === tab.id
                      ? tab.id === 'Inactive'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-white text-emerald-800 shadow-xs border border-emerald-200/60 font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.dot && <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />}
                  <span>{isRtl ? tab.labelAr : tab.labelEn}</span>
                </button>
              ))}
            </div>

            {/* Gender Filter Select */}
            <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-xl border border-slate-200/70">
              <span className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                {isRtl ? 'الجنس' : 'Gender'}
              </span>
              <select
                value={selectedGender}
                onChange={e => setSelectedGender(e.target.value as any)}
                className={`bg-white border border-slate-200/80 rounded-lg text-[11px] font-black outline-none cursor-pointer px-2.5 py-1.5 transition-all shadow-2xs ${
                  selectedGender !== 'ALL' ? 'text-blue-700 bg-blue-50/80 border-blue-200' : 'text-slate-700'
                }`}
              >
                <option value="ALL">{isRtl ? 'جميع الأنواع' : 'All Gender'}</option>
                <option value="Male">{isRtl ? 'ذكر (Male)' : 'Male'}</option>
                <option value="Female">{isRtl ? 'أنثى (Female)' : 'Female'}</option>
              </select>
            </div>

            {/* Visa Type Filter Select */}
            <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-xl border border-slate-200/70">
              <span className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                {isRtl ? 'الإقامة' : 'Visa'}
              </span>
              <select
                value={selectedVisaType}
                onChange={e => setSelectedVisaType(e.target.value as any)}
                className={`bg-white border border-slate-200/80 rounded-lg text-[11px] font-black outline-none cursor-pointer px-2.5 py-1.5 transition-all shadow-2xs ${
                  selectedVisaType !== 'ALL' ? 'text-indigo-700 bg-indigo-50/80 border-indigo-200' : 'text-slate-700'
                }`}
              >
                <option value="ALL">{isRtl ? 'جميع أنواع التأشيرات' : 'All Visa Types'}</option>
                <option value="Internal">{isRtl ? 'كفالة داخلية (Internal)' : 'Internal Sponsor'}</option>
                <option value="Flexi">{isRtl ? 'تأشيرة فلِكسي (Flexi)' : 'Flexi Visa'}</option>
              </select>
            </div>
          </div>

          {/* Right Action Cluster: Refresh, Reset Filters & Counter */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {(searchTerm || selectedCategory !== 'ALL' || selectedStatus !== 'ALL' || selectedGender !== 'ALL' || selectedVisaType !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('ALL');
                  setSelectedStatus('ALL');
                  setSelectedGender('ALL');
                  setSelectedVisaType('ALL');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80 text-xs font-bold transition-all cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span>{isRtl ? 'تصفير الفلاتر' : 'Reset Filters'}</span>
              </button>
            )}

            {/* Matching Counter Badge */}
            <div className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-black tracking-tight shadow-2xs">
              <span>{filteredEmployees.length}</span>
              <span className="text-slate-400 font-normal mx-1">/</span>
              <span className="text-slate-300 font-bold">{employees.length}</span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadData}
              title={isRtl ? 'تحديث البيانات' : 'Refresh'}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-black transition-all cursor-pointer active:scale-95"
            >
              {loading ? (isRtl ? 'جاري...' : 'Loading...') : (isRtl ? 'تحديث' : 'Refresh')}
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Selection & Batch Actions Bar */}
      {!loading && filteredEmployees.length > 0 && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 transition-all">
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            {/* Master Select All Checkbox Button */}
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border select-none ${
                isAllFilteredSelected
                  ? 'bg-brand text-white border-brand shadow-xs'
                  : isSomeFilteredSelected
                  ? 'bg-brand/10 text-brand border-brand/30'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
              }`}
              title={
                isAllFilteredSelected
                  ? (isRtl ? 'إلغاء تحديد الموظفين المعروضين' : 'Deselect visible staff')
                  : (isRtl ? 'تحديد جميع الموظفين المعروضين' : 'Select all visible staff')
              }
            >
              <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                isAllFilteredSelected
                  ? 'bg-white text-brand border-white'
                  : isSomeFilteredSelected
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white border-slate-300'
              }`}>
                {isAllFilteredSelected && <Check className="w-3 h-3 stroke-[3]" />}
                {isSomeFilteredSelected && <div className="w-2 h-0.5 bg-white rounded-full" />}
              </div>
              <span>
                {isAllFilteredSelected
                  ? (isRtl ? 'إلغاء تحديد المعروض' : 'Deselect Visible')
                  : (isRtl ? `تحديد الكل (${filteredEmployees.length})` : `Select All (${filteredEmployees.length})`)}
              </span>
            </button>

            {/* Selected Count Tag */}
            {selectedEmpIds.length > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-black shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {isRtl
                    ? `تم تحديد ${selectedEmpIds.length} من أصل ${filteredEmployees.length} موظف`
                    : `${selectedEmpIds.length} of ${filteredEmployees.length} selected`}
                </span>
              </div>
            )}

            {/* Option to select ALL in directory if filtered < total */}
            {filteredEmployees.length < employees.length && selectedEmpIds.length === filteredEmployees.length && (
              <button
                type="button"
                onClick={handleSelectAllTotal}
                className="text-xs font-bold text-brand hover:underline cursor-pointer py-1"
              >
                {isRtl
                  ? `تحديد جميع موظفي الدليل (${employees.length})`
                  : `Select all ${employees.length} in directory`}
              </button>
            )}

            {selectedEmpIds.length > 0 && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              >
                {isRtl ? 'إلغاء التحديد' : 'Clear'}
              </button>
            )}
          </div>

          {/* Action Buttons Cluster */}
          {selectedEmpIds.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:from-rose-500 hover:to-red-500 hover:shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span>
                  {selectedEmpIds.length === employees.length
                    ? (isRtl ? `حذف الكل (${selectedEmpIds.length})` : `Delete All (${selectedEmpIds.length})`)
                    : (isRtl ? `حذف المحدد (${selectedEmpIds.length})` : `Delete Selected (${selectedEmpIds.length})`)}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Directory Grid View */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-brand animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-xs font-bold">{isRtl ? 'جاري تحميل سجل الموظفين...' : 'Loading workforce directory...'}</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-sm">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-black text-slate-900">{isRtl ? 'لا توجد نتائج' : 'No records found'}</h3>
          <p className="text-slate-500 text-xs mt-1 font-medium">
            {isRtl ? 'لم نجد أي موظف يطابق خيارات البحث الحالية' : 'Try adjusting your search query or category filter'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map(emp => {
            const catMeta = getCategoryMeta(emp.category);
            const CatIcon = catMeta.icon;
            const isSelected = selectedEmpIds.includes(emp.id);

            return (
              <div
                key={emp.id}
                className={`group relative bg-white rounded-2xl border p-5 transition-all duration-200 flex flex-col justify-between ${
                  isSelected
                    ? 'border-brand ring-2 ring-brand/30 bg-brand/[0.015] shadow-md'
                    : 'border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-lg'
                }`}
              >
                {/* Selection Checkbox */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelectEmp(emp.id);
                  }}
                  className={`absolute top-3.5 ${isRtl ? 'left-3.5' : 'right-3.5'} z-10 w-6 h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-brand border-brand text-white shadow-xs scale-105'
                      : 'bg-white/95 border-slate-300 hover:border-brand/60 text-transparent opacity-60 group-hover:opacity-100 hover:scale-105'
                  }`}
                  title={isSelected ? (isRtl ? 'إلغاء التحديد' : 'Deselect') : (isRtl ? 'تحديد الموظف' : 'Select Employee')}
                  aria-label={isSelected ? 'Deselect employee' : 'Select employee'}
                >
                  <Check className={`w-3.5 h-3.5 stroke-[3] transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                </button>

                <div>
                  {/* Top Bar: Employee Avatar + Category + Live Status Pulse + Name */}
                  <div className={`flex items-start gap-3 mb-3.5 ${isRtl ? 'pl-7' : 'pr-7'}`}>
                    {/* Employee Avatar Box: logo.jpg for Pharmacist, Worker, Management; red VectorDriver helmet for Driver */}
                    <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-2xs overflow-hidden ${
                      emp.category === 'Driver'
                        ? 'bg-red-500/10 border-red-300/80 text-red-600 ring-2 ring-red-500/10'
                        : 'bg-white border-slate-200 shadow-xs ring-1 ring-slate-900/5'
                    }`}>
                      {emp.category === 'Driver' ? (
                        <VectorDriver className="w-7 h-7 text-red-600" />
                      ) : (
                        <img
                          src="/logo.jpg"
                          alt={emp.category}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-black ${catMeta.badgeColor}`}>
                            {emp.code}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${catMeta.color}`}>
                            {isRtl ? catMeta.labelAr : catMeta.labelEn}
                          </span>
                        </div>

                        {/* Live Status Pulse Badge (Flat 2D Vector & SVG) */}
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black border ${
                          emp.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : emp.status === 'OnLeave'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          {emp.status === 'Active' ? (
                            <span className="relative flex h-1.5 w-1.5 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </span>
                          ) : (
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              emp.status === 'OnLeave' ? 'bg-amber-500' : 'bg-slate-400'
                            }`}></span>
                          )}
                          <span>
                            {emp.status === 'Active'
                              ? (isRtl ? 'نشط' : 'Active')
                              : emp.status === 'OnLeave'
                              ? (isRtl ? 'في إجازة' : 'On Leave')
                              : (isRtl ? 'غير نشط' : 'Inactive')}
                          </span>
                        </div>
                      </div>

                      {/* Employee Name */}
                      <h3 className="text-sm font-black text-slate-900 group-hover:text-brand transition-colors truncate">
                        {emp.full_name}
                      </h3>
                    </div>
                  </div>

                  {/* Contact & Quick Connect Card (CPR Copy + Phone + WhatsApp) */}
                  <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/70 space-y-1.5 text-xs text-slate-600">
                    {emp.cpr_number && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-bold text-[11px]">{isRtl ? 'الرقم الشخصي:' : 'CPR:'}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-800 tracking-tight">{emp.cpr_number}</span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyCpr(e, emp.cpr_number, emp.id)}
                            title={isRtl ? 'نسخ الرقم الشخصي' : 'Copy CPR'}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
                          >
                            {copiedCprId === emp.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {emp.phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-bold text-[11px]">{isRtl ? 'الهاتف:' : 'Phone:'}</span>
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${emp.phone}`}
                            className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 hover:text-brand transition-colors"
                            title={isRtl ? 'اتصال مباشر' : 'Call'}
                          >
                            <Phone className="w-3 h-3 text-slate-400 hover:text-brand shrink-0" />
                            <span>{emp.phone}</span>
                          </a>

                          <a
                            href={`https://wa.me/${emp.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    )}

                    {emp.category === 'Driver' && (
                      <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-bold pt-1 border-t border-slate-200/50">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{isRtl ? 'مربوط بنظام التوصيل والسائقين' : 'Linked with Delivery System'}</span>
                      </div>
                    )}
                  </div>

                  {/* Company & Visa Badges (Flat 2D Vector) */}
                  <div className="mt-3 space-y-1.5 text-xs border-t border-slate-100 pt-2.5">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{isRtl ? 'الشركة / CR:' : 'Company / CR:'}</span>
                      </span>
                      <span className="font-mono text-slate-800 font-bold">
                        {emp.salary_matrix?.company || 'Tabarak Hub'} {emp.salary_matrix?.cr ? `(${emp.salary_matrix.cr})` : ''}
                      </span>
                    </div>

                    {/* Nationality Row */}
                    <div className="flex items-center justify-between text-[10px] font-bold pt-0.5">
                      <span className="text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Globe2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{isRtl ? 'الجنسية:' : 'Nationality:'}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50/80 text-blue-800 font-bold border border-blue-200/80 shadow-2xs">
                        {emp.nationality || emp.salary_matrix?.nationality || (isRtl ? 'غير محدد' : 'Not Specified')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-bold pt-0.5">
                      <span className="text-slate-400 uppercase tracking-wider">{isRtl ? 'النوع والإقامة:' : 'Gender & Visa:'}</span>
                      <div className="flex items-center gap-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200 shadow-2xs">
                          {emp.salary_matrix?.gender === 'Female' || emp.gender === 'Female' ? (
                            <>
                              <VectorFemale className="w-3 h-3 text-pink-600 shrink-0" />
                              <span>{isRtl ? 'أنثى' : 'Female'}</span>
                            </>
                          ) : (
                            <>
                              <VectorMale className="w-3 h-3 text-blue-600 shrink-0" />
                              <span>{isRtl ? 'ذكر' : 'Male'}</span>
                            </>
                          )}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-black border shadow-2xs ${
                          emp.salary_matrix?.visaType === 'Flexi' || emp.visa_type === 'Flexi'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {emp.salary_matrix?.visaType === 'Flexi' || emp.visa_type === 'Flexi' ? (
                            <>
                              <VectorVisaFlexi className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>Flexi</span>
                            </>
                          ) : (
                            <>
                              <VectorVisaInternal className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>Internal</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Compliance Badges: Passport No, PP Expiry, WP Expiry, NHRA (🔴 Expired, 🟡 Expiring Soon < 60 days, 🟢 Valid) */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{isRtl ? 'بيانات الامتثال والإقامة:' : 'Compliance & Expiry:'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openQuickComplianceModal(emp);
                          }}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 transition-all cursor-pointer shadow-2xs"
                          title={isRtl ? 'تعديل تواريخ الجواز والإقامة وترخيص NHRA مباشرة' : 'Quick edit passport, visa, and NHRA expiry dates'}
                        >
                          <Edit className="w-2.5 h-2.5" />
                          <span>{isRtl ? 'تعديل سريع' : 'Quick Edit'}</span>
                        </button>
                      </div>

                      <div className={`grid ${emp.category === 'Pharmacist' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'} gap-2 text-[10px]`}>
                        {/* 1. Passport Number Badge */}
                        {(() => {
                          const ppNo = emp.passport_number || emp.salary_matrix?.expatPp;
                          return (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                openQuickComplianceModal(emp);
                              }}
                              className="p-2 rounded-xl bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/90 hover:border-indigo-400/80 hover:bg-indigo-50/20 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between min-h-[64px] group"
                              title={isRtl ? 'انقر لتعديل بيانات الجواز' : 'Click to edit passport info'}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1 truncate group-hover:text-indigo-600 transition-colors">
                                  <FileText className="w-3 h-3 text-slate-400 group-hover:text-indigo-500 shrink-0" />
                                  <span>{isRtl ? 'رقم الجواز' : 'Passport No'}</span>
                                </span>
                                <span className="font-mono text-[7.5px] font-black text-slate-500 bg-slate-200/80 px-1 py-0.5 rounded">
                                  PP
                                </span>
                              </div>
                              <div className="mt-1">
                                {ppNo ? (
                                  <span className="font-mono font-black text-slate-900 text-xs tracking-wider block truncate group-hover:text-indigo-700 transition-colors">
                                    {ppNo}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/90 font-black text-[8.5px]">
                                    <span>⚠️</span>
                                    <span>{isRtl ? 'غير محدد (Not Set)' : 'Not Set'}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* 2. PP Expiry Badge */}
                        {(() => {
                          const ppExp = emp.passport_expiry_date || emp.salary_matrix?.expatPpExpiryDate || emp.salary_matrix?.ppExpiryDate;
                          const st = getExpiryStatus(ppExp, 60);
                          return (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                openQuickComplianceModal(emp);
                              }}
                              className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between min-h-[64px] group ${
                                st ? st.cardBg : 'bg-gradient-to-b from-slate-50 to-slate-100/70 border-slate-200/90 hover:border-indigo-400'
                              }`}
                              title={isRtl ? 'انقر لتعديل تاريخ انتهاء الجواز' : 'Click to edit PP expiry'}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[8.5px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1 truncate">
                                  <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{isRtl ? 'انتهاء الجواز' : 'PP Expiry'}</span>
                                </span>
                                {st ? (
                                  <span className="text-[9px] shrink-0" title={isRtl ? st.badgeTextAr : st.badgeText}>
                                    {st.indicator}
                                  </span>
                                ) : (
                                  <span className="text-[8px] text-amber-500 shrink-0">⚠️</span>
                                )}
                              </div>
                              <div className="mt-1">
                                {ppExp ? (
                                  <div className="space-y-0.5">
                                    <span className="font-mono font-black text-slate-900 text-[10.5px] block truncate">
                                      {ppExp}
                                    </span>
                                    {st && (
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black border leading-tight ${st.color}`}>
                                        <span>{isRtl ? st.badgeTextAr : st.badgeText}</span>
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/90 font-black text-[8.5px]">
                                    <span>⚠️</span>
                                    <span>{isRtl ? 'غير محدد (Not Set)' : 'Not Set'}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* 3. WP Expiry Badge */}
                        {(() => {
                          const wpExp = emp.wp_expiry_date || emp.salary_matrix?.wpExpiryDate || emp.salary_matrix?.visaExpiryDate;
                          const st = getExpiryStatus(wpExp, 60);
                          return (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                openQuickComplianceModal(emp);
                              }}
                              className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between min-h-[64px] group ${
                                st ? st.cardBg : 'bg-gradient-to-b from-slate-50 to-slate-100/70 border-slate-200/90 hover:border-indigo-400'
                              }`}
                              title={isRtl ? 'انقر لتعديل تاريخ انتهاء الإقامة' : 'Click to edit WP expiry'}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[8.5px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1 truncate">
                                  <ShieldCheck className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{isRtl ? 'انتهاء الإقامة' : 'WP Expiry'}</span>
                                </span>
                                {st ? (
                                  <span className="text-[9px] shrink-0" title={isRtl ? st.badgeTextAr : st.badgeText}>
                                    {st.indicator}
                                  </span>
                                ) : (
                                  <span className="text-[8px] text-amber-500 shrink-0">⚠️</span>
                                )}
                              </div>
                              <div className="mt-1">
                                {wpExp ? (
                                  <div className="space-y-0.5">
                                    <span className="font-mono font-black text-slate-900 text-[10.5px] block truncate">
                                      {wpExp}
                                    </span>
                                    {st && (
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black border leading-tight ${st.color}`}>
                                        <span>{isRtl ? st.badgeTextAr : st.badgeText}</span>
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/90 font-black text-[8.5px]">
                                    <span>⚠️</span>
                                    <span>{isRtl ? 'غير محدد (Not Set)' : 'Not Set'}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* 4. NHRA License & Expiry Badge (Pharmacist only) */}
                        {emp.category === 'Pharmacist' && (() => {
                          const nhraLicense = emp.salary_matrix?.nhraLicenseNo || `NHRA-PH-${emp.code}`;
                          const nhraExp = emp.salary_matrix?.nhraExpiryDate || '2026-12-31';
                          const st = getExpiryStatus(nhraExp, 60);
                          return (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                openQuickComplianceModal(emp);
                              }}
                              className="p-2 rounded-xl bg-gradient-to-b from-purple-50/90 to-indigo-50/60 border border-purple-200/90 hover:border-purple-400 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between min-h-[64px] group"
                              title={isRtl ? 'انقر لتعديل ترخيص وتاريخ انتهاء NHRA' : 'Click to edit NHRA license & expiry'}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[8.5px] font-black text-purple-800 uppercase tracking-wider truncate flex items-center gap-1">
                                  <Award className="w-3 h-3 text-purple-600 shrink-0" />
                                  <span>{isRtl ? 'ترخيص NHRA' : 'NHRA'}</span>
                                </span>
                                {st && (
                                  <span className="text-[9px] shrink-0" title={isRtl ? st.badgeTextAr : st.badgeText}>
                                    {st.indicator}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 space-y-0.5">
                                <span className="font-mono font-black text-purple-950 text-[11px] block truncate" title={nhraLicense}>
                                  {nhraLicense}
                                </span>
                                <div className="flex items-center justify-between gap-1 flex-wrap">
                                  <span className="font-mono font-bold text-purple-900 text-[9.5px] block truncate">{nhraExp}</span>
                                  {st && (
                                    <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[7.5px] font-black border leading-tight ${st.color}`}>
                                      {isRtl ? st.badgeTextAr : st.badgeText}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Salary Matrix & Financial Summary (With Privacy Mask) */}
                  {emp.salary_matrix && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{isRtl ? 'الراتب والتعويضات:' : 'Payroll & Salary:'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSalaryVisibility(emp.id)}
                          title={unmaskedSalaries[emp.id] ? (isRtl ? 'إخفاء الرواتب' : 'Hide Salaries') : (isRtl ? 'إظهار الرواتب' : 'Reveal Salaries')}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          {unmaskedSalaries[emp.id] ? (
                            <>
                              <EyeOff className="w-3 h-3 shrink-0" />
                              <span className="text-[9px] font-bold">{isRtl ? 'إخفاء' : 'Hide'}</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3 shrink-0" />
                              <span className="text-[9px] font-bold">{isRtl ? 'كشف' : 'Show'}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {emp.salary_matrix.iban && (
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="text-slate-400 uppercase tracking-wider">IBAN:</span>
                          <span className="font-mono text-slate-700 tracking-tight font-black">{emp.salary_matrix.iban}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {/* 1. Total Fixed (Calm Neutral Grey) */}
                        <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/70">
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">{isRtl ? 'الراتب الثابت' : 'Total Fixed'}</span>
                          <span className="text-xs font-black font-mono text-slate-800 tabular-nums">
                            {unmaskedSalaries[emp.id]
                              ? `${(emp.salary_matrix.totalFixed || 0).toFixed(3)} BHD`
                              : '••••• BHD'}
                          </span>
                        </div>

                        {/* 2. Total Variable (Calm Neutral Grey) */}
                        <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/70">
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">{isRtl ? 'إجمالي المتغير' : 'Total Variable'}</span>
                          <span className="text-xs font-black font-mono text-slate-800 tabular-nums">
                            {unmaskedSalaries[emp.id]
                              ? `${(emp.salary_matrix.totalVariable || 0) > 0 ? '+' : ''}${(emp.salary_matrix.totalVariable || 0).toFixed(3)} BHD`
                              : '••••• BHD'}
                          </span>
                        </div>

                        {/* 3. Total Deductions (Calm Neutral Grey) */}
                        <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/70">
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">{isRtl ? 'الاستقطاعات' : 'Total Deductions'}</span>
                          <span className="text-xs font-black font-mono text-slate-800 tabular-nums">
                            {unmaskedSalaries[emp.id]
                              ? `${(emp.salary_matrix.totalDeductions || 0) > 0 ? '-' : ''}${(emp.salary_matrix.totalDeductions || 0).toFixed(3)} BHD`
                              : '••••• BHD'}
                          </span>
                        </div>

                        {/* 4. Net Salary (Prominent Emerald Green - Final Result) */}
                        <div className="p-1.5 rounded-lg bg-emerald-50/80 border border-emerald-300/90 shadow-2xs">
                          <span className="text-[9px] font-black text-emerald-700 block uppercase">{isRtl ? 'صافي الراتب' : 'Net Salary'}</span>
                          <span className="text-xs font-black font-mono text-emerald-800 tabular-nums">
                            {unmaskedSalaries[emp.id]
                              ? `${(emp.salary_matrix.netSalary || 0).toFixed(3)} BHD`
                              : '••••• BHD'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fleet Vehicles Linkage (Driver & Worker) - Bahrain License Plate */}
                  {(emp.category === 'Driver' || emp.category === 'Worker') && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 font-bold shrink-0">
                        <VectorDriver className="w-4 h-4 text-red-600 shrink-0" />
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">
                          {isRtl ? 'مركبات الأسطول (Fleet Vehicles):' : 'Fleet Vehicles:'}
                        </span>
                      </div>

                      {!emp.assigned_vehicles || emp.assigned_vehicles.length === 0 ? (
                        <span className="text-[10px] text-slate-400 italic">
                          {isRtl ? 'لم يتم ربط مركبة' : 'No vehicle linked'}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 justify-end items-center">
                          {emp.assigned_vehicles.map((vCode, vIdx) => {
                            const cleanPlate = vCode.replace(/\s*\([^)]*\)/g, '').trim();
                            return (
                              <BahrainLicensePlate
                                key={vIdx}
                                plateNumber={cleanPlate}
                                size="xs"
                                className="shadow-2xs hover:scale-105 transition-transform"
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Geofenced Branch Assignments (5x4 Grid Matrix) */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{isRtl ? 'الفروع المسندة والنطاق الجغرافي (Grid 5x4):' : 'Assigned Branches & Geofence (Grid 5x4):'}</span>
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 font-mono flex items-center gap-1">
                        <Navigation className="w-2.5 h-2.5 shrink-0" />
                        <span>{emp.assignments?.length || 0} / 20 {isRtl ? 'فرع' : 'Branches'}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1 p-2 bg-slate-50/80 rounded-xl border border-slate-200/70">
                      {grid20Branches.map((b, i) => {
                        const bCode = b.code;
                        const bName = b.name;
                        const bId = b.id;

                        const assignment = emp.assignments?.find(
                          a =>
                            a.branch_id === bId ||
                            a.branch_id === bCode ||
                            a.branch_name === bName ||
                            (bName && a.branch_name?.includes(bCode))
                        );

                        const isAssigned = Boolean(assignment);
                        const isPrimary = assignment?.is_primary;

                        return (
                          <div
                            key={i}
                            title={`${bCode}: ${bName} ${isAssigned ? (isPrimary ? (isRtl ? '(الفرع الرئيسي)' : '(Primary Hub)') : `(${assignment?.geofence_radius_meters || 50}m)`) : (isRtl ? '(غير مسند)' : '(Unassigned)')}`}
                            className={`flex flex-col items-center justify-center p-1 rounded-md text-center transition-all select-none min-h-[30px] ${
                              isAssigned
                                ? isPrimary
                                  ? 'bg-gradient-to-b from-blue-600 to-indigo-700 text-white font-black border border-blue-800 shadow-xs ring-1 ring-blue-400/40'
                                  : 'bg-emerald-600 text-white font-black border border-emerald-700 shadow-xs'
                                : 'bg-white text-slate-400 border border-slate-200/50 opacity-50 hover:opacity-100'
                            }`}
                          >
                            <span className="font-mono text-[9px] font-black tracking-tight leading-none">
                              {bCode}
                            </span>
                            <span className="flex items-center justify-center mt-0.5 leading-none">
                              {isAssigned ? (
                                isPrimary ? (
                                  <Star className="w-2.5 h-2.5 fill-current text-amber-300 shrink-0" />
                                ) : (
                                  <Check className="w-2.5 h-2.5 stroke-[3] text-white shrink-0" />
                                )
                              ) : (
                                <span className="text-[7px] text-slate-300 leading-none">·</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Actions Footer - Equal Size Buttons with Increased Height */}
                <div className="mt-5 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => openHrLetterModal(emp)}
                    title={isRtl ? 'طباعة واستخراج خطاب HR رسمي' : 'Print & Generate Official HR Letter'}
                    className="h-10 px-2 bg-brand/10 hover:bg-brand text-brand hover:text-white border border-brand/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98]"
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate">{isRtl ? 'خطاب HR' : 'HR Letter'}</span>
                  </button>

                  <button
                    onClick={() => openEditModal(emp)}
                    title={isRtl ? 'تعديل بيانات الموظف' : 'Edit Employee'}
                    className="h-10 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98]"
                  >
                    <Edit className="w-4 h-4 shrink-0" />
                    <span className="truncate">{isRtl ? 'تعديل' : 'Edit'}</span>
                  </button>

                  <button
                    onClick={() => handleDelete(emp)}
                    title={isRtl ? 'حذف الموظف' : 'Delete Employee'}
                    className="h-10 px-2 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98]"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">{isRtl ? 'حذف' : 'Delete'}</span>
                  </button>
                </div>
                </div>
              );
          })}
        </div>
      )}

      {/* Add / Edit Employee Modal */}
      {isModalOpen && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 pointer-events-none bg-slate-950/30 backdrop-blur-xs">
          <div
            style={{ transform: `translate(${modalPos.x}px, ${modalPos.y}px)` }}
            className="relative w-full max-w-5xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 sm:p-7 text-slate-900 pointer-events-auto max-h-[92vh] overflow-y-auto space-y-4 custom-scrollbar"
          >
            {/* Modal Header (Draggable) */}
            <div
              onMouseDown={handleHeaderMouseDown}
              className="flex items-center justify-between pb-3 border-b border-slate-100 cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand/10 text-brand rounded-lg">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                    <span>
                      {editingEmp?.id
                        ? isRtl ? `تعديل بيانات الموظف [${formCode}]` : `Edit Employee [${formCode}]`
                        : isRtl ? 'إضافة موظف جديد للسجل الموحد' : 'Add New Employee to Directory'}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-500 font-normal px-1.5 py-0.5 rounded border border-slate-200">
                      {isRtl ? 'اسحب من هنا للتحريك' : 'Drag here to move'}
                    </span>
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500">
                    {isRtl ? 'تحديد الفئة، الكود التلقائي، والتمركز الجغرافي بالفروع' : 'Set Category, Prefix Code, and Geofenced Branch Locations'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="space-y-4 mt-3">
              {/* Category Selector Buttons */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  {isRtl ? 'فئة الكادر والكود الموحد' : 'Staff Category & Prefix Code'}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Driver', 'Worker', 'Management', 'Pharmacist'] as StaffCategory[]).map(cat => {
                    const meta = getCategoryMeta(cat);
                    const isSelected = formCategory === cat;
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => handleCategoryChange(cat)}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-brand/5 border-brand text-brand shadow-sm font-bold ring-2 ring-brand/20'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-medium'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center shadow-2xs border ${
                          cat === 'Driver' ? 'bg-red-500/10 border-red-200' : 'bg-white border-slate-200'
                        }`}>
                          {cat === 'Driver' ? (
                            <VectorDriver className="w-5 h-5 text-red-600" />
                          ) : (
                            <img src="/logo.jpg" alt={cat} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <span className="font-mono text-[10px] font-black">{meta.prefix}</span>
                        <span className="text-[10px] font-bold">{isRtl ? meta.labelAr : meta.labelEn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form Grid for all inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">
                    {isRtl ? 'كود الموظف' : 'Code'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    placeholder="e.g. D001"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono font-bold uppercase outline-none focus:border-brand/50 focus:bg-white focus:ring-2 focus:ring-brand/10"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">
                    {isRtl ? 'الاسم الكامل' : 'Full Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder={isRtl ? 'اسم الموظف الثلاثي...' : 'Full Name...'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold outline-none focus:border-brand/50 focus:bg-white focus:ring-2 focus:ring-brand/10"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">
                    {isRtl ? 'الحالة الحالية' : 'Status'}
                  </label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as StaffStatus)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold outline-none focus:border-brand/50 focus:bg-white focus:ring-2 focus:ring-brand/10"
                  >
                    <option value="Active">{isRtl ? 'نشط' : 'Active'}</option>
                    <option value="OnLeave">{isRtl ? 'في إجازة' : 'On Leave'}</option>
                    <option value="Inactive">{isRtl ? 'غير نشط' : 'Inactive'}</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">
                    {isRtl ? 'البريد الإلكتروني (Email ID)' : 'Email Address (Email ID)'}
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    placeholder="employee@tabarak.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono font-bold outline-none focus:border-brand/50 focus:bg-white focus:ring-2 focus:ring-brand/10"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">
                    {isRtl ? 'رقم الهاتف' : 'Phone Number'}
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="+973 3XXXXXXX"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono font-bold outline-none focus:border-brand/50 focus:bg-white focus:ring-2 focus:ring-brand/10"
                  />
                </div>
              </div>

              {/* EMPLOYEE DATA & CR / FINANCIAL DATA */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-brand" />
                    <span>{isRtl ? 'بيانات الموظف والسجل الرئيسي بـ LMRA EMS والبنك' : 'LMRA EMS Sponsor & Financial Data'}</span>
                  </h4>
                  {/* Activation Status Badge */}
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    formVisaType === 'Internal'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {formVisaType === 'Internal'
                      ? (isRtl ? '✓ كفالة الشركة مفعلة (Internal Sponsor Activated)' : '✓ Internal Sponsor Activated')
                      : (isRtl ? 'إقامة مرنة (Flexi Visa - No Sponsor Needed)' : 'Flexi Visa - No Sponsor Needed')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  {/* Cell 1: Gender */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      {isRtl ? 'الجنس / النوع (Gender)' : 'Gender'}
                    </label>
                    <select
                      value={formGender}
                      onChange={e => setFormGender(e.target.value as 'Male' | 'Female')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-bold outline-none focus:border-brand/50 focus:bg-white cursor-pointer"
                    >
                      <option value="Male">{isRtl ? 'ذكر (Male)' : 'Male'}</option>
                      <option value="Female">{isRtl ? 'أنثى (Female)' : 'Female'}</option>
                    </select>
                  </div>

                  {/* Cell 2: Visa Type */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      {isRtl ? 'نوع الإقامة والتأشيرة (Visa Type)' : 'Visa Type'}
                    </label>
                    <select
                      value={formVisaType}
                      onChange={e => handleVisaTypeChange(e.target.value as 'Internal' | 'Flexi')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-bold outline-none focus:border-brand/50 focus:bg-white cursor-pointer"
                    >
                      <option value="Internal">{isRtl ? 'داخلي (كفالة الشركة)' : 'Internal (Company Sponsor)'}</option>
                      <option value="Flexi">{isRtl ? 'فلِكسي (إقامة مرنة)' : 'Flexi (Flexible Visa)'}</option>
                    </select>
                  </div>

                  {/* LMRA EMS Registered Sponsor */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>{isRtl ? 'السجل الرئيسي (Sponsor)' : 'LMRA EMS Registered Sponsor'}</span>
                      {formVisaType !== 'Internal' && <span className="text-[9px] text-amber-600 font-bold">(إقامة مرنة)</span>}
                    </label>
                    <select
                      value={formCompany}
                      disabled={formVisaType !== 'Internal'}
                      onChange={e => {
                        const val = e.target.value;
                        setFormCompany(val);
                        const matched = parentSponsors.find(
                          (c: any) => c.cr_name === val || c.cr_name_ar === val
                        );
                        if (matched) {
                          setFormCr(matched.cr_number);
                        } else {
                          setFormCr('');
                        }
                      }}
                      className={`w-full border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-bold outline-none focus:border-brand/50 focus:bg-white cursor-pointer ${
                        formVisaType !== 'Internal' ? 'bg-slate-100 opacity-60 cursor-not-allowed' : 'bg-slate-50'
                      }`}
                    >
                      {formVisaType === 'Flexi' ? (
                        <option value="N/A (Flexi Visa)">{isRtl ? 'N/A (إقامة مرنة - بدون كفيل شركة)' : 'N/A (Flexi Visa)'}</option>
                      ) : (
                        <>
                          <option value="">{isRtl ? '-- اختر السجل الرئيسي (Parent Sponsor) --' : '-- Select Parent Sponsor --'}</option>
                          {parentSponsors.map((cr: any) => (
                            <option key={cr.id || cr.cr_number} value={cr.cr_name}>
                              {isRtl ? `${cr.cr_name_ar || cr.cr_name} (${cr.cr_number})` : `${cr.cr_name} (${cr.cr_number})`}
                            </option>
                          ))}
                          {formCompany && !parentSponsors.some((c: any) => c.cr_name === formCompany || c.cr_name_ar === formCompany) && (
                            <option value={formCompany}>{formCompany} (مخصص)</option>
                          )}
                        </>
                      )}
                    </select>
                  </div>

                  {/* LMRA Registered CR Number */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>{isRtl ? 'رقم السجل (Registered CR)' : 'LMRA Registered CR Number'}</span>
                      {formVisaType !== 'Internal' && <span className="text-[9px] text-amber-600 font-bold">(إقامة مرنة)</span>}
                    </label>
                    <select
                      value={formCr}
                      onChange={e => setFormCr(e.target.value)}
                      disabled={formVisaType !== 'Internal' || !formCompany}
                      className={`w-full border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-mono font-bold outline-none focus:border-brand/50 focus:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        formVisaType !== 'Internal' ? 'bg-slate-100' : 'bg-slate-50'
                      }`}
                    >
                      {formVisaType === 'Flexi' ? (
                        <option value="">{isRtl ? 'N/A (إقامة مرنة)' : 'N/A (Flexi Visa)'}</option>
                      ) : (
                        <>
                          <option value="">{isRtl ? '-- اختر رقم السجل (Parent / Sub CR) --' : '-- Select Parent / Sub CR --'}</option>
                          {availableSubCrs.map((cr: any) => (
                            <option key={cr.id || cr.cr_number} value={cr.cr_number}>
                              {cr.cr_number} - {isRtl ? (cr.cr_name_ar || cr.cr_name) : cr.cr_name} {cr.is_master || cr.cr_number?.endsWith('-01') || cr.cr_number?.endsWith('-1') ? (isRtl ? '(الرئيسي)' : '(Parent)') : (isRtl ? '(فرعي)' : '(Sub)')}
                            </option>
                          ))}
                          {formCr && !availableSubCrs.some((c: any) => c.cr_number === formCr) && (
                            <option value={formCr}>{formCr} (مخصص)</option>
                          )}
                        </>
                      )}
                    </select>
                  </div>

                  {/* Cell: Expat CPR */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      {isRtl ? 'الوافق CPR (Expat CPR)' : 'Expat CPR'}
                    </label>
                    <input
                      type="text"
                      value={formExpatCpr}
                      onChange={e => setFormExpatCpr(e.target.value)}
                      placeholder="900112233"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-mono font-bold outline-none focus:border-brand/50 focus:bg-white"
                    />
                  </div>

                  {/* Cell: Passport Number (Expat PP) */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      {isRtl ? 'رقم جواز السفر (Passport No / PP)' : 'Passport Number (PP)'}
                    </label>
                    <input
                      type="text"
                      value={formExpatPp}
                      onChange={e => setFormExpatPp(e.target.value)}
                      placeholder="A0912384"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-mono font-bold outline-none focus:border-brand/50 focus:bg-white uppercase"
                    />
                  </div>

                  {/* Cell: PP Expiry Date (Placed BESIDES passport number) */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>{isRtl ? 'انتهاء الجواز (PP Expiry Date)' : 'PP Expiry Date'}</span>
                      {formExpatPpExpiry && (() => {
                        const st = getExpiryStatus(formExpatPpExpiry, 60);
                        return st ? (
                          <span className={`px-1 py-0.2 rounded text-[8.5px] font-black border ${st.color}`}>
                            {isRtl ? st.labelAr : st.labelEn}
                          </span>
                        ) : null;
                      })()}
                    </label>
                    <input
                      type="date"
                      value={formExpatPpExpiry}
                      onChange={e => setFormExpatPpExpiry(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-mono font-bold outline-none focus:border-brand/50 focus:bg-white cursor-pointer"
                    />
                  </div>

                  {/* Cell: WP Expiry Date ("visa expiry" in LMRA EMS Sponsor & Financial Data) */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>{isRtl ? 'انتهاء الإقامة / العمل (WP Expiry Date)' : 'WP Expiry Date (Visa)'}</span>
                      {formWpExpiry && (() => {
                        const st = getExpiryStatus(formWpExpiry, 60);
                        return st ? (
                          <span className={`px-1 py-0.2 rounded text-[8.5px] font-black border ${st.color}`}>
                            {isRtl ? st.labelAr : st.labelEn}
                          </span>
                        ) : null;
                      })()}
                    </label>
                    <input
                      type="date"
                      value={formWpExpiry}
                      onChange={e => setFormWpExpiry(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-mono font-bold outline-none focus:border-brand/50 focus:bg-white cursor-pointer"
                    />
                  </div>

                  {/* Cell: Nationality */}
                  <div className="sm:col-span-2">
                    <label className="flex items-center justify-between text-[10px] font-bold text-slate-700 mb-1">
                      <span className="flex items-center gap-1">
                        <Globe2 className="w-3 h-3 text-brand shrink-0" />
                        <span>{isRtl ? 'الجنسية (Nationality)' : 'Nationality'}</span>
                      </span>
                      <span className="text-[9px] text-slate-400 font-normal">
                        {isRtl ? 'تتقرأ تلقائياً في مولد الخطابات الرسمية' : 'Autofilled in HR Letter Generator'}
                      </span>
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        value={[
                          'Egyptian / مصري',
                          'Bahraini / بحريني',
                          'Indian / هندي',
                          'Pakistani / باكستاني',
                          'Filipino / فلبيني',
                          'Syrian / سوري',
                          'Jordanian / أردني',
                          'Lebanese / لبناني',
                          'Yemeni / يمني',
                          'Bangladeshi / بنغلاديشي',
                          'Sudanese / سوداني'
                        ].includes(formNationality) ? formNationality : '__CUSTOM__'}
                        onChange={e => {
                          if (e.target.value !== '__CUSTOM__') {
                            setFormNationality(e.target.value);
                          }
                        }}
                        className="w-1/2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-bold outline-none focus:border-brand/50 cursor-pointer"
                      >
                        <option value="Egyptian / مصري">Egyptian / مصري</option>
                        <option value="Bahraini / بحريني">Bahraini / بحريني</option>
                        <option value="Indian / هندي">Indian / هندي</option>
                        <option value="Pakistani / باكستاني">Pakistani / باكستاني</option>
                        <option value="Filipino / فلبيني">Filipino / فلبيني</option>
                        <option value="Syrian / سوري">Syrian / سوري</option>
                        <option value="Jordanian / أردني">Jordanian / أردني</option>
                        <option value="Lebanese / لبناني">Lebanese / لبناني</option>
                        <option value="Yemeni / يمني">Yemeni / يمني</option>
                        <option value="Bangladeshi / بنغلاديشي">Bangladeshi / بنغلاديشي</option>
                        <option value="Sudanese / سوداني">Sudanese / سوداني</option>
                        <option value="__CUSTOM__">{isRtl ? 'أخرى (كتابة يدوية)' : 'Other (Custom)'}</option>
                      </select>
                      <input
                        type="text"
                        value={formNationality}
                        onChange={e => setFormNationality(e.target.value)}
                        placeholder={isRtl ? 'مثال: Egyptian / مصري' : 'e.g. Egyptian / مصري'}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-bold outline-none focus:border-brand/50 focus:bg-white"
                      />
                    </div>
                  </div>

                  {/* Pharmacist NHRA License Data (shown for Pharmacist category) */}
                  {formCategory === 'Pharmacist' && (
                    <div className="sm:col-span-4 p-2.5 bg-purple-50/70 border border-purple-200/80 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-black text-purple-900">
                        <Award className="w-3.5 h-3.5 text-purple-600" />
                        <span>{isRtl ? 'بيانات ترخيص الهيئة الوطنية لترخيص المهن والخدمات الصحية (NHRA)' : 'NHRA Pharmacist License Info'}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-purple-800 mb-1">
                            {isRtl ? 'رقم ترخيص NHRA (Nhra license No.)' : 'NHRA License No.'}
                          </label>
                          <input
                            type="text"
                            value={formNhraLicenseNo}
                            onChange={e => setFormNhraLicenseNo(e.target.value)}
                            placeholder="NHRA-PH-00123"
                            className="w-full bg-white border border-purple-200 rounded-lg px-2.5 py-1 text-xs text-purple-950 font-mono font-bold outline-none focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-purple-800 mb-1">
                            {isRtl ? 'تاريخ انتهاء الترخيص (Expiry Date)' : 'NHRA Expiry Date'}
                          </label>
                          <input
                            type="date"
                            value={formNhraExpiryDate}
                            onChange={e => setFormNhraExpiryDate(e.target.value)}
                            className="w-full bg-white border border-purple-200 rounded-lg px-2.5 py-1 text-xs text-purple-950 font-mono font-bold outline-none focus:border-purple-500"
                          />
                          <div className="flex items-center gap-1 mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                const d = new Date();
                                d.setFullYear(d.getFullYear() + 2);
                                setFormNhraExpiryDate(d.toISOString().split('T')[0]);
                              }}
                              className="px-2 py-0.5 rounded bg-purple-100 hover:bg-purple-200 text-[9px] font-black text-purple-800 transition-colors cursor-pointer border border-purple-200 flex items-center gap-1"
                            >
                              <span>★</span>
                              <span>+2 {isRtl ? 'سنتين (ترخيص NHRA)' : 'Years (NHRA Standard)'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      {isRtl ? 'رقم الحساب البنكي (IBAN)' : 'Financial Data: IBAN'}
                    </label>
                    <input
                      type="text"
                      value={formIban}
                      onChange={e => setFormIban(e.target.value)}
                      placeholder="BH29 NBB0 0000 0000 1234 56"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 font-mono font-bold tracking-wider outline-none focus:border-brand/50 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* SALARY MATRIX PANEL */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isRtl ? 'هيكلية وحسبة الراتب (Salary Matrix)' : 'Salary Matrix Breakdown'}</span>
                  </h4>

                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">NET SALARY:</span>
                    <span className="text-sm font-black text-emerald-800 font-mono tabular-nums">{computedNetSalary.toFixed(3)} BHD</span>
                  </div>
                </div>

                {/* Dynamic Admin Contract Template Selector (Synced with Contract Types & Hours in Admin Control) */}
                {(() => {
                  const adminContracts = getAdminContractTypes();
                  const matchingContracts = adminContracts.filter(
                    (c: any) => c.category === formCategory || c.category === 'All' || !c.category
                  );

                  return (
                    <div className="p-3 bg-brand/5 border border-brand/20 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-900 flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-brand" />
                          <span>
                            {isRtl
                              ? `قوالب العقود وسلالم الرواتب المعتمدة في التحكم الإداري (${formCategory})`
                              : `Admin Contract Templates & Salary Matrix (${formCategory})`}
                          </span>
                        </span>
                        <span className="text-[9px] font-bold text-brand bg-white px-2.5 py-0.5 rounded-lg border border-brand/20 shadow-2xs">
                          Synced with Admin Control ⚡
                        </span>
                      </div>

                      {matchingContracts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {matchingContracts.map((cnt: any) => {
                            const basic = cnt.default_basic_bhd || 0;
                            const housing = cnt.housing_bhd || 0;
                            const trans = cnt.transportation_bhd || 0;
                            const resp = cnt.responsibility_bonus_bhd || 0;
                            const shiftInc = cnt.long_shift_incentive_bhd || 0;
                            const total = cnt.total_salary_bhd || (basic + housing + trans + resp + shiftInc);

                            return (
                              <button
                                type="button"
                                key={cnt.id || cnt.contract_title}
                                onClick={() => {
                                  setFormBasicSalary(String(basic));
                                  setFormHousing(String(housing));
                                  setFormTransportation(String(trans));
                                  setFormJobResponsibilityBonus(String(resp));
                                  setFormLongShiftIncentive(String(shiftInc));
                                  setFormGosi1Pct((basic * 0.01).toFixed(3));
                                }}
                                className="p-2.5 bg-white hover:bg-brand/10 border border-slate-200 hover:border-brand rounded-xl text-right transition-all shadow-2xs cursor-pointer flex flex-col justify-between gap-1.5 group"
                                title={`Basic ${basic} + Housing ${housing} + Transport ${trans} + Resp ${resp} + Shift Inc ${shiftInc} = Total ${total} BHD`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-black text-slate-900 group-hover:text-brand truncate text-xs">
                                    {cnt.contract_title}
                                  </span>
                                  <span className="text-[9px] font-mono font-black bg-brand/10 text-brand px-1.5 py-0.5 rounded-md shrink-0">
                                    {cnt.shift_hours}h
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                  <span>Basic: {basic} BHD</span>
                                  <span className="font-black text-emerald-600">Total: {total} BHD</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-2.5 text-center text-xs text-slate-500 font-bold bg-white rounded-xl border border-dashed border-slate-200">
                          {isRtl ? 'لا توجد عقود معرفة لهذه الفئة في التحكم الإداري - يمكنك إدخال الرواتب يدوياً' : 'No contract templates found for this category in Admin Control'}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Fixed Salary Block */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-[11px] font-black uppercase text-slate-800">FIXED SALARY</span>
                      <span className="text-[10px] font-mono font-bold text-slate-600">Sum: {computedTotalFixed.toFixed(3)}</span>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">BASIC SALARY (BHD)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={formBasicSalary}
                        onChange={e => updateBasicSalary(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold font-mono outline-none focus:border-brand"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">HOUSING (BHD)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={formHousing}
                        onChange={e => setFormHousing(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold font-mono outline-none focus:border-brand"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">TRANSPORTATION (BHD)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={formTransportation}
                        onChange={e => setFormTransportation(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold font-mono outline-none focus:border-brand"
                      />
                    </div>

                    <div className="pt-1.5 border-t border-slate-200 flex justify-between text-xs font-black text-slate-900">
                      <span>TOTAL FIXED:</span>
                      <span className="font-mono">{computedTotalFixed.toFixed(3)}</span>
                    </div>
                  </div>

                  {/* Variable Salary Block */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-[11px] font-black uppercase text-blue-700">VARIABLE SALARY</span>
                      <span className="text-[10px] font-mono font-bold text-blue-600">Sum: {computedTotalVariable.toFixed(3)}</span>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">RETENTION / RESPONSIBILITY BONUS</label>
                      <input
                        type="number"
                        step="0.001"
                        value={formJobResponsibilityBonus}
                        onChange={e => setFormJobResponsibilityBonus(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold font-mono outline-none focus:border-brand"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">LONG SHIFT INCENTIVE</label>
                      <input
                        type="number"
                        step="0.001"
                        value={formLongShiftIncentive}
                        onChange={e => setFormLongShiftIncentive(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold font-mono outline-none focus:border-brand"
                      />
                    </div>

                    <div className="pt-8 border-t border-slate-200 flex justify-between text-xs font-black text-blue-900">
                      <span>TOTAL VARIABLE:</span>
                      <span className="font-mono">{computedTotalVariable.toFixed(3)}</span>
                    </div>
                  </div>

                  {/* Deductions Block */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-[11px] font-black uppercase text-red-700">DEDUCTIONS</span>
                      <span className="text-[10px] font-mono font-bold text-red-600">Sum: {computedTotalDeductions.toFixed(3)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="block text-[9px] font-bold text-slate-500 uppercase">1% GOSI</label>
                          <span className="text-[8px] font-black text-brand uppercase">AUTO 1%</span>
                        </div>
                        <input
                          type="number"
                          step="0.001"
                          value={formGosi1Pct}
                          onChange={e => setFormGosi1Pct(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-xs font-bold font-mono outline-none focus:border-brand"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">EWA FEES</label>
                        <input
                          type="number"
                          step="0.001"
                          value={formEwaFees}
                          onChange={e => setFormEwaFees(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-xs font-bold font-mono outline-none focus:border-brand"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">PAYROLL DED (LOAN)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={formPayrollDedLoan}
                        onChange={e => setFormPayrollDedLoan(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold font-mono outline-none focus:border-brand"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">OTHERS DEDUCTION</label>
                      <input
                        type="number"
                        step="0.001"
                        value={formOthersDeduction}
                        onChange={e => setFormOthersDeduction(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold font-mono outline-none focus:border-brand"
                      />
                    </div>

                    <div className="pt-1.5 border-t border-slate-200 flex justify-between text-xs font-black text-red-900">
                      <span>TOTAL DED:</span>
                      <span className="font-mono">-{computedTotalDeductions.toFixed(3)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Branch Assignment & Geofencing */}
              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    {isRtl ? 'الفروع والنطاق الجغرافي (Geofence)' : 'Assign Branches & Geofence'}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllBranches}
                      className="text-[10px] font-bold text-brand hover:underline bg-brand/5 hover:bg-brand/10 px-2 py-0.5 rounded border border-brand/20 transition-all cursor-pointer"
                    >
                      {formAssignments.length === grid20Branches.length
                        ? isRtl ? 'إلغاء تحديد الكل' : 'Deselect All'
                        : isRtl ? 'تحديد جميع الفروع (Select All)' : 'Select All Branches'}
                    </button>
                    <span className="text-[10px] text-emerald-600 font-black font-mono">
                      {formAssignments.length} / 20 {isRtl ? 'محددة' : 'selected'}
                    </span>
                  </div>
                </div>

                {/* 5x4 Grid Branch Selector Matrix */}
                <div className="grid grid-cols-5 gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200/80 mb-3">
                  {grid20Branches.map((b, i) => {
                    const bCode = b.code;
                    const bName = b.name;
                    const bId = b.id;

                    const isAssigned = formAssignments.some(
                      a => a.branch_id === bId || a.branch_id === bCode || a.branch_name === bName
                    );

                    return (
                      <button
                        type="button"
                        key={i}
                        onClick={() => toggleBranchAssignment(b)}
                        title={`${bCode}: ${bName}`}
                        className={`flex flex-col items-center justify-center p-1.5 rounded-lg border text-center transition-all cursor-pointer select-none ${
                          isAssigned
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs font-black ring-2 ring-emerald-500/20 scale-[1.02]'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300 font-bold'
                        }`}
                      >
                        <span className="font-mono text-[11px] font-black tracking-tight">{bCode}</span>
                        {isAssigned && <CheckCircle2 className="w-3 h-3 text-white mt-0.5" />}
                      </button>
                    );
                  })}
                </div>

                {/* Fleet Vehicles Linkage (Driver & Worker only) - Multi-Select Search */}
                {(formCategory === 'Driver' || formCategory === 'Worker') && (
                  <div className="border-t border-slate-100 pt-3 mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                        <VectorDriver className="w-4 h-4 text-red-600" />
                        <span>{isRtl ? 'ربط الموظف بمركبات الأسطول (Fleet Vehicles)' : 'Link with Delivery Fleet Vehicles'}</span>
                      </label>
                      <span className="text-[10px] text-red-600 font-black font-mono">
                        {formVehicles.length} {isRtl ? 'مركبة مسندة' : 'assigned'}
                      </span>
                    </div>

                    {/* Search Bar & Multi-Select Dropdown Container */}
                    <div className="relative mb-2.5">
                      <div className="relative flex items-center">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 pointer-events-none" />
                        <input
                          type="text"
                          value={fleetSearchTerm}
                          onFocus={() => setIsFleetDropdownOpen(true)}
                          onChange={e => {
                            setFleetSearchTerm(e.target.value);
                            setIsFleetDropdownOpen(true);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (fleetSearchTerm.trim()) {
                                const termUpper = fleetSearchTerm.trim().toUpperCase();
                                const match = availableFleetList.find(
                                  v => v.plateNumber.toUpperCase() === termUpper || v.code.toUpperCase() === termUpper
                                );
                                if (match) {
                                  toggleFleetVehicle(match.tagValue);
                                } else {
                                  toggleFleetVehicle(termUpper);
                                }
                                setFleetSearchTerm('');
                              }
                            }
                          }}
                          placeholder={isRtl ? 'ابحث برقم اللوحة أو الكود (مثال: 654321)...' : 'Search by plate number or code (e.g. 654321)...'}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-8 py-2 text-xs font-mono font-bold outline-none focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-all"
                        />
                        {fleetSearchTerm && (
                          <button
                            type="button"
                            onClick={() => setFleetSearchTerm('')}
                            className="absolute left-2 text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Multi-Selection Search Dropdown List */}
                      {isFleetDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsFleetDropdownOpen(false)}
                          />

                          <div className="absolute top-full right-0 left-0 mt-1.5 bg-white rounded-xl border border-slate-200 shadow-2xl z-20 max-h-56 overflow-y-auto p-1.5 space-y-1">
                            <div className="px-2 py-1 flex items-center justify-between text-[10px] font-black text-slate-400 border-b border-slate-100 mb-1">
                              <span>{isRtl ? 'نتائج أسطول الموتسيكلات (قائمة متعددة)' : 'Fleet Results (Multi-Select)'} ({filteredFleetList.length})</span>
                              <button
                                type="button"
                                onClick={() => setIsFleetDropdownOpen(false)}
                                className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
                              >
                                {isRtl ? 'إغلاق ✕' : 'Close ✕'}
                              </button>
                            </div>

                            {filteredFleetList.length === 0 ? (
                              <div className="p-3 text-center text-xs text-slate-500 font-bold">
                                {isRtl ? 'لم يتم العثور على موتسكل مطابق' : 'No matching vehicle found'}
                              </div>
                            ) : (
                              filteredFleetList.map(v => {
                                const isAssigned = formVehicles.some(
                                  fv => fv.toUpperCase() === v.tagValue.toUpperCase() ||
                                        fv.toUpperCase() === v.plateNumber.toUpperCase() ||
                                        fv.toUpperCase() === v.code.toUpperCase() ||
                                        fv.toUpperCase().includes(v.plateNumber.toUpperCase()) ||
                                        v.tagValue.toUpperCase().includes(fv.toUpperCase())
                                );

                                return (
                                  <button
                                    type="button"
                                    key={v.id || v.code}
                                    onClick={() => toggleFleetVehicle(v.tagValue)}
                                    className={`w-full flex items-center justify-between p-2 rounded-lg text-right text-xs transition-all cursor-pointer select-none ${
                                      isAssigned
                                        ? 'bg-amber-500 text-white font-black shadow-xs'
                                        : 'bg-slate-50 hover:bg-amber-50 text-slate-800 hover:text-amber-900 border border-slate-100 hover:border-amber-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <BahrainLicensePlate plateNumber={v.plateNumber} size="xs" enableCopy={false} />
                                      <div className="text-right">
                                        <div className={`font-mono font-bold text-xs ${isAssigned ? 'text-white' : 'text-slate-700'}`}>
                                          {v.code}
                                        </div>
                                        <div className={`text-[9px] ${isAssigned ? 'text-amber-100' : 'text-slate-400'}`}>
                                          {v.ownership === 'External' ? '⚡ Flexi' : 'Internal'}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                        isAssigned
                                          ? 'bg-white/20 text-white border-white/30'
                                          : 'bg-slate-200 text-slate-700 border-slate-300'
                                      }`}>
                                        {isAssigned ? (isRtl ? 'مسند ✓' : 'Assigned ✓') : (isRtl ? 'إسناد +' : 'Assign +')}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })
                            )}

                            {/* Direct Custom Add Button if typed query not in preset list */}
                            {fleetSearchTerm.trim() && !filteredFleetList.some(v => v.plateNumber.toUpperCase() === fleetSearchTerm.trim().toUpperCase()) && (
                              <button
                                type="button"
                                onClick={() => {
                                  toggleFleetVehicle(fleetSearchTerm.trim().toUpperCase());
                                  setFleetSearchTerm('');
                                }}
                                className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs cursor-pointer mt-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{isRtl ? `إضافة رقم اللوحة يدوياً: "${fleetSearchTerm.trim().toUpperCase()}"` : `Add custom plate: "${fleetSearchTerm.trim().toUpperCase()}"`}</span>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Selected Multi-Assigned Fleet Vehicles Chips */}
                    {formVehicles.length > 0 ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-wrap gap-2 max-h-36 overflow-y-auto items-center">
                        {formVehicles.map((vTag, idx) => {
                          const matchedVeh = availableFleetList.find(
                            af => af.tagValue.toUpperCase() === vTag.toUpperCase() ||
                                  af.plateNumber.toUpperCase() === vTag.toUpperCase() ||
                                  af.code.toUpperCase() === vTag.toUpperCase() ||
                                  vTag.toUpperCase().includes(af.plateNumber.toUpperCase())
                          );

                          const cleanPlate = (matchedVeh ? matchedVeh.plateNumber : vTag).replace(/\s*\([^)]*\)/g, '').trim();

                          return (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-lg shadow-2xs animate-in fade-in"
                            >
                              <BahrainLicensePlate plateNumber={cleanPlate} size="xs" enableCopy={false} />
                              {matchedVeh?.code && (
                                <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {matchedVeh.code}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleFleetVehicle(vTag)}
                                title={isRtl ? 'إزالة' : 'Remove'}
                                className="hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded p-1 transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-[11px] text-slate-400 font-bold">
                        {isRtl ? 'لا توجد مركبات مسندة - ابحث بالخيار أعلاه لتحديد مركبات الأسطول' : 'No vehicles assigned - Search above for multi-selection'}
                      </div>
                    )}
                  </div>
                )}

                {/* Selected Branches Configuration */}
                {formAssignments.length > 0 && (
                  <div className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200 max-h-[14vh] overflow-y-auto">
                    {formAssignments.map(asg => (
                      <div
                        key={asg.branch_id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-1.5 bg-white rounded-md border border-slate-200 text-[10px]"
                      >
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-black text-slate-900">{asg.branch_name || asg.branch_id}</span>
                          {asg.is_primary && (
                            <span className="bg-brand/10 text-brand text-[9px] px-1.5 py-0.5 rounded font-black border border-brand/20">
                              {isRtl ? 'رئيسي' : 'Primary'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500 font-bold">{isRtl ? 'نطاق (متر):' : 'Radius:'}</span>
                            <select
                              value={asg.geofence_radius_meters}
                              onChange={e => updateAssignmentRadius(asg.branch_id, parseInt(e.target.value, 10))}
                              className="bg-slate-50 text-slate-900 font-mono text-[10px] font-bold border border-slate-200 rounded px-1 py-0.5 focus:border-brand"
                            >
                              <option value="30">30m</option>
                              <option value="50">50m</option>
                              <option value="100">100m</option>
                              <option value="200">200m</option>
                              <option value="500">500m</option>
                            </select>
                          </div>

                          {!asg.is_primary && (
                            <button
                              type="button"
                              onClick={() => setPrimaryBranch(asg.branch_id)}
                              className="text-brand font-bold hover:underline"
                            >
                              {isRtl ? 'تعيين كرئيسي' : 'Set Primary'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1">
                  {isRtl ? 'ملاحظات إضافية' : 'Notes'}
                </label>
                <textarea
                  rows={1}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder={isRtl ? 'أدخل ملاحظات...' : 'Notes...'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-medium outline-none focus:border-brand/50 focus:bg-white focus:ring-2 focus:ring-brand/10"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary px-3 py-1.5 text-xs"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn-primary px-3 py-1.5 text-xs"
                >
                  {isRtl ? 'حفظ الموظف' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Smart Delete / Deactivate Choice Modal */}
      {deletingEmpTarget && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 text-slate-900 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-950">
                  {isRtl ? `التعامل مع الموظف [${deletingEmpTarget.code}]` : `Manage Staff [${deletingEmpTarget.code}]`}
                </h3>
                <p className="text-xs font-bold text-slate-500">{deletingEmpTarget.full_name}</p>
              </div>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <p className="text-slate-600 font-medium">
                {isRtl
                  ? 'اختر طريقة التعامل المناسبة للحفاظ على سلامة التقارير والسجلات التاريخية:'
                  : 'Choose the appropriate option to maintain audit log data integrity:'}
              </p>

              {/* Option 1: Soft Delete (Recommended) */}
              <button
                type="button"
                onClick={() => handleSoftDelete(deletingEmpTarget)}
                className="w-full text-right p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-950 font-bold transition-all flex flex-col gap-1 group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-emerald-700">
                    {isRtl ? '1️⃣ تعطيل الحساب (Soft Delete - موصى به)' : '1️⃣ Deactivate Account (Recommended)'}
                  </span>
                  <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-black">
                    {isRtl ? 'الأفضل للـ HR' : 'Best Practice'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                  {isRtl
                    ? 'يغير الحالة إلى (غير نشط Inactive). يخفي الموظف من القوائم التشغيلية، مع الحفاظ الكامل على البصمات ومبيعات التوصيل والسجلات.'
                    : 'Marks status as Inactive. Hides staff from daily duty while preserving past attendance and delivery audit logs.'}
                </p>
              </button>

              {/* Option 2: Hard Delete */}
              <button
                type="button"
                onClick={() => handleHardDelete(deletingEmpTarget)}
                className="w-full text-right p-3.5 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-100/70 text-red-950 font-bold transition-all flex flex-col gap-1 group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-red-700">
                    {isRtl ? '2️⃣ حذف نهائي من النظام (Hard Delete)' : '2️⃣ Permanent Delete'}
                  </span>
                  <span className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded font-black">
                    {isRtl ? 'حذف كلي' : 'Purge'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                  {isRtl
                    ? 'يمسح الموظف تماماً من جميع الجداول والنظام. يُفضل استخدامه فقط إذا كانت الإضافة تمت عن طريق الخطأ.'
                    : 'Completely purges employee record. Use only for accidental entries.'}
                </p>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setDeletingEmpTarget(null)}
                className="btn-secondary text-xs px-4 py-2 cursor-pointer"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Bulk Action Bar (Sticky Bottom) */}
      {selectedEmpIds.length > 0 && typeof window !== 'undefined' && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[3000] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-white animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span className="text-xs font-black text-slate-100 whitespace-nowrap">
              {isRtl
                ? `تم تحديد (${selectedEmpIds.length}) موظف`
                : `(${selectedEmpIds.length}) staff selected`}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={() => setIsBulkDeleteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>
              {selectedEmpIds.length === employees.length
                ? (isRtl ? `حذف الكل (${selectedEmpIds.length})` : `Delete All (${selectedEmpIds.length})`)
                : (isRtl ? `حذف المحدد (${selectedEmpIds.length})` : `Delete Selected (${selectedEmpIds.length})`)}
            </span>
          </button>

          <button
            type="button"
            onClick={handleClearSelection}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer whitespace-nowrap"
          >
            {isRtl ? 'إلغاء التحديد' : 'Deselect'}
          </button>
        </div>,
        document.body
      )}

      {/* Smart Bulk Delete / Deactivate Choice Modal */}
      {isBulkDeleteModalOpen && selectedEmps.length > 0 && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 text-slate-900 animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 shrink-0">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-200">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-slate-950 truncate">
                  {isRtl
                    ? `إجراء جماعي على (${selectedEmps.length}) موظف`
                    : `Bulk Action on (${selectedEmps.length}) Employees`}
                </h3>
                <p className="text-xs font-bold text-slate-500">
                  {isRtl
                    ? 'اختر نوع الحذف أو التعطيل للموظفين المحددين'
                    : 'Choose delete or deactivation method for selected staff'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !bulkDeleteLoading && setIsBulkDeleteModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                disabled={bulkDeleteLoading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Employees Preview Badges List */}
            <div className="py-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
                <span>{isRtl ? 'الموظفون المشمولون بالإجراء:' : 'Included Employees:'}</span>
                <span className="text-slate-400 font-mono text-[11px]">{selectedEmps.length} {isRtl ? 'موظف' : 'staff'}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200/80 custom-scrollbar">
                {selectedEmps.slice(0, 15).map(e => (
                  <span
                    key={e.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-bold text-slate-800 shadow-2xs"
                  >
                    <span className="font-mono text-brand font-black">{e.code}</span>
                    <span className="text-slate-600 truncate max-w-[120px]">{e.full_name}</span>
                  </span>
                ))}
                {selectedEmps.length > 15 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-200 text-[11px] font-bold text-slate-600">
                    +{selectedEmps.length - 15} {isRtl ? 'آخرين' : 'more'}
                  </span>
                )}
              </div>
            </div>

            {/* Options List */}
            <div className="py-4 space-y-3 text-xs overflow-y-auto custom-scrollbar flex-1">
              <p className="text-slate-600 font-medium">
                {isRtl
                  ? 'اختر طريقة التعامل المناسبة للحفاظ على سلامة التقارير والسجلات التاريخية:'
                  : 'Choose the appropriate option to maintain audit log data integrity:'}
              </p>

              {/* Option 1: Bulk Soft Delete (Recommended) */}
              <button
                type="button"
                disabled={bulkDeleteLoading}
                onClick={handleBulkSoftDelete}
                className="w-full text-right p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-950 font-bold transition-all flex flex-col gap-1 group cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-emerald-700 flex items-center gap-1.5">
                    <span>1️⃣</span>
                    <span>{isRtl ? `تعطيل الحسابات (${selectedEmps.length}) (Soft Delete - موصى به)` : `Deactivate Accounts (${selectedEmps.length}) (Recommended)`}</span>
                  </span>
                  <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-black">
                    {isRtl ? 'الأفضل للـ HR' : 'Best Practice'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                  {isRtl
                    ? 'يغير الحالة إلى (غير نشط Inactive). يخفي الموظفين من القوائم التشغيلية، مع الحفاظ الكامل على البصمات ومبيعات التوصيل والسجلات التاريخية.'
                    : 'Marks status as Inactive for all selected staff. Preserves historical attendance and delivery audit logs.'}
                </p>
              </button>

              {/* Option 2: Bulk Hard Delete */}
              <button
                type="button"
                disabled={bulkDeleteLoading}
                onClick={handleBulkHardDelete}
                className="w-full text-right p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/70 text-rose-950 font-bold transition-all flex flex-col gap-1 group cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-rose-700 flex items-center gap-1.5">
                    <span>2️⃣</span>
                    <span>{isRtl ? `حذف نهائي كلي (${selectedEmps.length}) من النظام (Hard Delete)` : `Permanently Delete All (${selectedEmps.length})`}</span>
                  </span>
                  <span className="text-[10px] bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded font-black">
                    {isRtl ? 'حذف دائم' : 'Purge'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                  {isRtl
                    ? 'يمسح جميع الموظفين المحددين نهائياً من قاعدة البيانات وجداول التخصيص والمحليات. تحذير: لا يمكن التراجع عن هذا الإجراء!'
                    : 'Completely purges all selected employees from the database and assignments. Warning: this cannot be undone!'}
                </p>
              </button>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <div className="text-[11px] text-slate-500 font-medium">
                {bulkDeleteLoading && (
                  <span className="inline-flex items-center gap-1.5 text-brand font-bold">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isRtl ? 'جاري تنفيذ العملية...' : 'Processing bulk action...'}</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={bulkDeleteLoading}
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="btn-secondary text-xs px-4 py-2 cursor-pointer disabled:opacity-50"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Quick Compliance Modal (Direct Edit for Passport, PP Expiry, and WP Expiry) */}
      {quickComplianceEmp && (
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              {/* Modal Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-tight">
                      {isRtl ? 'تعديل وثائق الامتثال والإقامة' : 'Quick Compliance & Expiry Editor'}
                    </h3>
                    <p className="text-[10px] text-slate-300 font-medium">
                      {isRtl ? 'تعديل تواريخ الجواز والإقامة مباشرة' : 'Directly edit passport & work permit expiry'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickComplianceEmp(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Employee Summary Chip */}
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs overflow-hidden ${
                    quickComplianceEmp.category === 'Driver'
                      ? 'bg-red-500/10 border-red-300/80 text-red-600 ring-1 ring-red-500/20'
                      : 'bg-white border-slate-200'
                  }`}>
                    {quickComplianceEmp.category === 'Driver' ? (
                      <VectorDriver className="w-6 h-6 text-red-600" />
                    ) : (
                      <img src="/logo.jpg" alt={quickComplianceEmp.category} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div>
                    <span className="font-black text-xs text-slate-900 block">{quickComplianceEmp.full_name}</span>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                      <span className="font-mono font-bold">{quickComplianceEmp.code}</span>
                      <span>•</span>
                      <span>CPR: {quickComplianceEmp.cpr_no || '-'}</span>
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                  quickComplianceEmp.category === 'Pharmacist'
                    ? 'bg-blue-600 text-white'
                    : quickComplianceEmp.category === 'Driver'
                    ? 'bg-emerald-600 text-white'
                    : quickComplianceEmp.category === 'Worker'
                    ? 'bg-amber-600 text-white'
                    : 'bg-purple-600 text-white'
                }`}>
                  {quickComplianceEmp.category}
                </span>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveQuickCompliance} className="p-5 space-y-4 text-xs">
                {/* 1. Passport Number */}
                <div>
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1">
                    {isRtl ? 'رقم جواز السفر (Passport No):' : 'Passport Number (PP):'}
                  </label>
                  <input
                    type="text"
                    value={quickPassport}
                    onChange={e => setQuickPassport(e.target.value)}
                    placeholder={isRtl ? 'أدخل رقم الجواز...' : 'e.g. A12345678'}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all"
                  />
                </div>

                {/* 2. PP Expiry Date */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                      {isRtl ? 'تاريخ انتهاء الجواز (PP Expiry Date):' : 'Passport Expiry Date (PP Expiry):'}
                    </label>
                    {(() => {
                      const st = getExpiryStatus(quickPpExpiry, 60);
                      if (!st) return null;
                      return (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${st.color}`}>
                          {isRtl ? st.badgeTextAr : st.badgeText}
                        </span>
                      );
                    })()}
                  </div>
                  <input
                    type="date"
                    value={quickPpExpiry}
                    onChange={e => {
                      setQuickPpExpiry(e.target.value);
                      setSelectedPpPresetMonths(null);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all cursor-pointer"
                  />

                  {/* Previous vs New Comparison Pill */}
                  {originalPpExpiry && quickPpExpiry !== originalPpExpiry && (
                    <div className="flex items-center justify-between text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2.5 py-1 rounded-lg mt-1.5 font-bold">
                      <span className="truncate">
                        {isRtl
                          ? `السابق: ${originalPpExpiry} ← الجديد: ${quickPpExpiry}`
                          : `Previous: ${originalPpExpiry} → New: ${quickPpExpiry}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickPpExpiry(originalPpExpiry);
                          setSelectedPpPresetMonths(null);
                        }}
                        className="underline font-black hover:text-emerald-950 cursor-pointer ml-2 shrink-0"
                      >
                        {isRtl ? 'استعادة الأصلي' : 'Reset'}
                      </button>
                    </div>
                  )}

                  {/* Preset Shortcuts */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[9px] text-slate-400 font-bold">{isRtl ? 'اختصارات:' : 'Presets:'}</span>
                    <button
                      type="button"
                      onClick={() => applyPpPreset(6)}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all cursor-pointer border flex items-center gap-1 ${
                        selectedPpPresetMonths === 6
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60'
                      }`}
                    >
                      {selectedPpPresetMonths === 6 && <Check className="w-2.5 h-2.5" />}
                      <span>+6 {isRtl ? 'أشهر' : 'Months'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPpPreset(12)}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all cursor-pointer border flex items-center gap-1 ${
                        selectedPpPresetMonths === 12
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60'
                      }`}
                    >
                      {selectedPpPresetMonths === 12 && <Check className="w-2.5 h-2.5" />}
                      <span>+1 {isRtl ? 'سنة' : 'Year'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPpPreset(24)}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all cursor-pointer border flex items-center gap-1 ${
                        selectedPpPresetMonths === 24
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60'
                      }`}
                    >
                      {selectedPpPresetMonths === 24 && <Check className="w-2.5 h-2.5" />}
                      <span>+2 {isRtl ? 'سنوات' : 'Years'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPpPreset(60)}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all cursor-pointer border flex items-center gap-1 ${
                        selectedPpPresetMonths === 60
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60'
                      }`}
                    >
                      {selectedPpPresetMonths === 60 && <Check className="w-2.5 h-2.5" />}
                      <span>+5 {isRtl ? 'سنوات' : 'Years'}</span>
                    </button>
                  </div>
                </div>

                {/* 3. WP Expiry Date */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                      {isRtl ? 'تاريخ انتهاء الإقامة والتصريح (WP / Visa Expiry):' : 'Work Permit / Visa Expiry (WP Expiry):'}
                    </label>
                    {(() => {
                      const st = getExpiryStatus(quickWpExpiry, 60);
                      if (!st) return null;
                      return (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${st.color}`}>
                          {isRtl ? st.badgeTextAr : st.badgeText}
                        </span>
                      );
                    })()}
                  </div>
                  <input
                    type="date"
                    value={quickWpExpiry}
                    onChange={e => {
                      setQuickWpExpiry(e.target.value);
                      setSelectedWpPresetMonths(null);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all cursor-pointer"
                  />

                  {/* Previous vs New Comparison Pill */}
                  {originalWpExpiry && quickWpExpiry !== originalWpExpiry && (
                    <div className="flex items-center justify-between text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2.5 py-1 rounded-lg mt-1.5 font-bold">
                      <span className="truncate">
                        {isRtl
                          ? `السابق: ${originalWpExpiry} ← الجديد: ${quickWpExpiry}${selectedWpPresetMonths ? ` (+${selectedWpPresetMonths === 6 ? '6 أشهر' : selectedWpPresetMonths === 12 ? 'سنة' : 'سنتين'})` : ''}`
                          : `Previous: ${originalWpExpiry} → New: ${quickWpExpiry}${selectedWpPresetMonths ? ` (+${selectedWpPresetMonths}M)` : ''}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickWpExpiry(originalWpExpiry);
                          setSelectedWpPresetMonths(null);
                        }}
                        className="underline font-black hover:text-emerald-950 cursor-pointer ml-2 shrink-0"
                      >
                        {isRtl ? 'استعادة الأصلي' : 'Reset'}
                      </button>
                    </div>
                  )}

                  {/* Preset Shortcuts */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[9px] text-slate-400 font-bold">{isRtl ? 'اختصارات:' : 'Presets:'}</span>
                    <button
                      type="button"
                      onClick={() => applyWpPreset(6)}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all cursor-pointer border flex items-center gap-1 ${
                        selectedWpPresetMonths === 6
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-1 ring-emerald-500/30'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60'
                      }`}
                    >
                      {selectedWpPresetMonths === 6 && <Check className="w-2.5 h-2.5" />}
                      <span>+6 {isRtl ? 'أشهر' : 'Months'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyWpPreset(12)}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all cursor-pointer border flex items-center gap-1 ${
                        selectedWpPresetMonths === 12
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-1 ring-emerald-500/30'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60'
                      }`}
                    >
                      {selectedWpPresetMonths === 12 && <Check className="w-2.5 h-2.5" />}
                      <span>+1 {isRtl ? 'سنة' : 'Year'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyWpPreset(24)}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all cursor-pointer border flex items-center gap-1 ${
                        selectedWpPresetMonths === 24
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-1 ring-emerald-500/30'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60'
                      }`}
                    >
                      {selectedWpPresetMonths === 24 && <Check className="w-2.5 h-2.5" />}
                      <span>+2 {isRtl ? 'سنوات' : 'Years'}</span>
                    </button>
                  </div>
                </div>

                {/* 4. Pharmacist NHRA License & Expiry */}
                {quickComplianceEmp.category === 'Pharmacist' && (
                  <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/80 space-y-3">
                    <div className="flex items-center gap-1.5 text-purple-900 font-black text-xs border-b border-purple-200/60 pb-1.5">
                      <Award className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>{isRtl ? 'ترخيص مزاولة المهنة (NHRA License):' : 'NHRA License & Expiry (Pharmacist):'}</span>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1">
                        {isRtl ? 'رقم ترخيص NHRA:' : 'NHRA License Number:'}
                      </label>
                      <input
                        type="text"
                        value={quickNhraLicense}
                        onChange={e => setQuickNhraLicense(e.target.value)}
                        placeholder="NHRA-PH-XXXX"
                        className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs font-mono font-bold text-purple-950 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition-all"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                          {isRtl ? 'تاريخ انتهاء ترخيص NHRA:' : 'NHRA Expiry Date:'}
                        </label>
                        {(() => {
                          const st = getExpiryStatus(quickNhraExpiry, 60);
                          if (!st) return null;
                          return (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${st.color}`}>
                              {isRtl ? st.badgeTextAr : st.badgeText}
                            </span>
                          );
                        })()}
                      </div>
                      <input
                        type="date"
                        value={quickNhraExpiry}
                        onChange={e => {
                          setQuickNhraExpiry(e.target.value);
                          setSelectedNhraPresetMonths(null);
                        }}
                        className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs font-mono font-bold text-purple-950 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition-all cursor-pointer"
                      />

                      {/* Previous vs New Comparison Pill */}
                      {originalNhraExpiry && quickNhraExpiry !== originalNhraExpiry && (
                        <div className="flex items-center justify-between text-[10px] bg-purple-100 text-purple-900 border border-purple-200 px-2.5 py-1 rounded-lg mt-1.5 font-bold">
                          <span className="truncate">
                            {isRtl
                              ? `السابق: ${originalNhraExpiry} ← الجديد: ${quickNhraExpiry}`
                              : `Previous: ${originalNhraExpiry} → New: ${quickNhraExpiry}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickNhraExpiry(originalNhraExpiry);
                              setSelectedNhraPresetMonths(null);
                            }}
                            className="underline font-black hover:text-purple-950 cursor-pointer ml-2 shrink-0"
                          >
                            {isRtl ? 'استعادة الأصلي' : 'Reset'}
                          </button>
                        </div>
                      )}

                      {/* Presets: only +2 Years (NHRA standard strictly 2 years) */}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[9px] text-purple-700 font-bold">{isRtl ? 'اختصارات:' : 'Presets:'}</span>
                        <button
                          type="button"
                          onClick={() => applyNhraPreset(24)}
                          className={`px-2.5 py-1 rounded-md text-[9px] font-black shadow-xs transition-all cursor-pointer flex items-center gap-1 ${
                            selectedNhraPresetMonths === 24
                              ? 'bg-purple-800 text-white ring-2 ring-purple-400'
                              : 'bg-purple-600 hover:bg-purple-700 text-white'
                          }`}
                        >
                          <span>★</span>
                          <span>+2 {isRtl ? 'سنتين (ترخيص NHRA)' : 'Years (NHRA Standard)'}</span>
                          {selectedNhraPresetMonths === 24 && <Check className="w-2.5 h-2.5 ml-1" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal Footer Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={quickComplianceLoading}
                    onClick={() => setQuickComplianceEmp(null)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={quickComplianceLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {quickComplianceLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{isRtl ? 'جاري الحفظ...' : 'Saving...'}</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'حفظ التحديثات' : 'Save Changes'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )
      )}

      {/* Official HR Letter & Corporate Identity Generator */}
      {isHrLetterModalOpen && selectedLetterEmp && (
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md overflow-y-auto animate-fadeIn">
            <OfficialHrLetterGenerator
              initialEmployee={selectedLetterEmp}
              onBack={() => setIsHrLetterModalOpen(false)}
            />
          </div>,
          document.body
        )
      )}
    </div>
  );
};

export default WorkforceDirectory;
