import { StaffCategory } from '../../../services/workforceService';
import {
  VectorPharmacist,
  VectorDriver,
  VectorWorker,
  VectorManagement
} from './WorkforceVectors';

// Load contract types from localStorage (synced with Admin Control Center)
export const getAdminContractTypes = () => {
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
      id: 'cont-1',
      title_ar: 'عقد صيدلي قانوني كامل',
      title_en: 'Licensed Pharmacist Full Contract',
      category: 'Pharmacist',
      salary_currency: 'BHD',
      basic_salary_default: 450,
      housing_allowance_default: 100,
      transport_allowance_default: 50,
      terms_ar: 'يلتزم الصيدلي بالحفاظ على تراخيص الهيئة والالتزام بمواعيد الشفتات الرسمية المحددة.',
      terms_en: 'The pharmacist undertakes to maintain NHRA licensing and adhere to scheduled duty shifts.'
    },
    {
      id: 'cont-2',
      title_ar: 'عقد سائق توصيل وتعيين مركبة',
      title_en: 'Delivery Driver & Fleet Contract',
      category: 'Driver',
      salary_currency: 'BHD',
      basic_salary_default: 180,
      housing_allowance_default: 40,
      transport_allowance_default: 20,
      terms_ar: 'يلتزم السائق بالحفاظ على المركبة وتسليم الطلبات في الأوقات القياسية دون تأخير.',
      terms_en: 'The driver undertakes to safeguard company vehicles and fulfill deliveries without delay.'
    },
    {
      id: 'cont-3',
      title_ar: 'عقد عامل صيدلية ومساعد',
      title_en: 'Pharmacy Assistant / Worker Contract',
      category: 'Worker',
      salary_currency: 'BHD',
      basic_salary_default: 150,
      housing_allowance_default: 30,
      transport_allowance_default: 20,
      terms_ar: 'يلتزم العامل بأعمال النظافة والترتيب ومساعدة فريق الصيدلية في الاستلام والتخزين.',
      terms_en: 'The worker undertakes cleaning, organizing, and supporting inventory receiving.'
    },
    {
      id: 'cont-4',
      title_ar: 'عقد إدارة وتشغيل فروع',
      title_en: 'Branch Management & Operations Contract',
      category: 'Management',
      salary_currency: 'BHD',
      basic_salary_default: 600,
      housing_allowance_default: 150,
      transport_allowance_default: 50,
      terms_ar: 'يتولى الإشراف الإداري على الفروع ومتابعة الأداء وساعات العمل ونسب الإنجاز.',
      terms_en: 'Responsible for operational management, duty supervision, and branch KPIs.'
    },
    {
      id: 'cont-5',
      title_ar: 'عقد شفت مسائي إضافي',
      title_en: 'Night Shift Dedicated Contract',
      category: 'Pharmacist',
      salary_currency: 'BHD',
      basic_salary_default: 500,
      housing_allowance_default: 120,
      transport_allowance_default: 50,
      terms_ar: 'تغطية ساعات العمل المسائية والليلية مع حوافز الشفتات الطويلة.',
      terms_en: 'Covers evening/night operational hours with long shift incentives.'
    },
    {
      id: 'cont-6',
      title_ar: 'عقد دوام جزئي / فليكسي مرن',
      title_en: 'Flexi / Part-time Hourly Contract',
      category: 'Worker',
      salary_currency: 'BHD',
      basic_salary_default: 120,
      housing_allowance_default: 0,
      transport_allowance_default: 0,
      terms_ar: 'عقد ساعات مرنة لغير المسجلين بنظام الكفالة المباشرة.',
      terms_en: 'Flexible hours contract for self-sponsored or flexible permits.'
    },
    {
      id: 'cont-7',
      title_ar: 'عقد تدريب امتياز صيدلي',
      title_en: 'Pharmacy Internship & Trainee Contract',
      category: 'Pharmacist',
      salary_currency: 'BHD',
      basic_salary_default: 200,
      housing_allowance_default: 50,
      transport_allowance_default: 30,
      terms_ar: 'تدريب إكلينيكي وتشغيلي تحت إشراف الصيدلي المسؤول.',
      terms_en: 'Clinical & operational internship supervised by Pharmacist in Charge.'
    },
    {
      id: 'cont-8',
      title_ar: 'عقد سائق فانات لوجستي',
      title_en: 'Van Logistics & Inter-Branch Driver',
      category: 'Driver',
      salary_currency: 'BHD',
      basic_salary_default: 220,
      housing_allowance_default: 50,
      transport_allowance_default: 30,
      terms_ar: 'نقل وتوزيع الأدوية والمستلزمات بين الفروع والمستودع المركزي.',
      terms_en: 'Inter-branch and central warehouse medicine distribution duties.'
    }
  ];
};

// Expiry Status Helper
export const getExpiryStatus = (expiryDateStr?: string, warningDays: number = 60) => {
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
      badgeTextAr: '🟢 ساري الصلاحية',
      labelAr: `🟢 ساري (${diffDays} يوم)`,
      labelEn: `🟢 Valid (${diffDays}d)`,
      cardBg: 'bg-white border-slate-200 hover:border-slate-300',
      color: 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-2xs'
    };
  }
};

// Category Badge Colors & Icons (Flat 2D Vector)
export const getCategoryMeta = (cat: StaffCategory) => {
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
