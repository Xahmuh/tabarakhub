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

import {
  VectorPharmacist,
  VectorDriver,
  VectorMotorcycle,
  VectorDeliveryVan,
  VectorAllStaff,
  VectorWorker,
  VectorManagement,
  VectorMale,
  VectorFemale,
  VectorVisaInternal,
  VectorVisaFlexi
} from './workforce-directory/WorkforceVectors';
import {
  SingleDeleteModal,
  FloatingBulkActionBar,
  BulkDeleteModal
} from './workforce-directory/DeleteChoiceModals';
import { QuickComplianceModal } from './workforce-directory/QuickComplianceModal';
import {
  exportWorkforceToCsv,
  downloadWorkforceExcelTemplate,
  importWorkforceFromExcel
} from './workforce-directory/workforceExcelUtils';
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


import { EmployeeEditModal } from './workforce-directory/EmployeeEditModal';
import {
  getAdminContractTypes,
  getCategoryMeta,
  getExpiryStatus
} from './workforce-directory/workforceHelpers';
import { getAdminRegisteredCrs } from '../../lib/crEntities';

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
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

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


  const openAddModal = () => {
    setEditingEmp(null);
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmp(emp);
    setIsModalOpen(true);
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



  // EXPORT AS EXCEL / CSV
  const handleExportExcel = () => {
    exportWorkforceToCsv(employees, isRtl, showToast);
  };

  const handleDownloadTemplate = async () => {
    await downloadWorkforceExcelTemplate(isRtl, showToast);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importWorkforceFromExcel(file, isRtl, branches, grid20Branches, showToast, async () => {
      await loadData();
    });
    if (e.target) {
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
      <EmployeeEditModal
        isOpen={isModalOpen}
        editingEmp={editingEmp}
        isRtl={isRtl}
        existingEmployees={employees}
        branches={branches}
        grid20Branches={grid20Branches}
        availableFleetList={availableFleetList}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEmp(null);
        }}
        onSaved={async () => {
          await loadData();
        }}
        showToast={showToast}
      />

      {/* Smart Delete / Deactivate Choice Modal */}
      <SingleDeleteModal
        deletingEmpTarget={deletingEmpTarget}
        isRtl={isRtl}
        onClose={() => setDeletingEmpTarget(null)}
        onSoftDelete={handleSoftDelete}
        onHardDelete={handleHardDelete}
      />

      {/* Floating Bulk Action Bar (Sticky Bottom) */}
      <FloatingBulkActionBar
        selectedCount={selectedEmpIds.length}
        totalCount={employees.length}
        isRtl={isRtl}
        onOpenBulkDelete={() => setIsBulkDeleteModalOpen(true)}
        onClearSelection={handleClearSelection}
      />

      {/* Smart Bulk Delete / Deactivate Choice Modal */}
      <BulkDeleteModal
        isOpen={isBulkDeleteModalOpen}
        selectedEmps={selectedEmps}
        bulkDeleteLoading={bulkDeleteLoading}
        isRtl={isRtl}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onBulkSoftDelete={handleBulkSoftDelete}
        onBulkHardDelete={handleBulkHardDelete}
      />

      {/* Quick Compliance Modal (Direct Edit for Passport, PP Expiry, and WP Expiry) */}
      <QuickComplianceModal
        quickComplianceEmp={quickComplianceEmp}
        isRtl={isRtl}
        quickPassport={quickPassport}
        setQuickPassport={setQuickPassport}
        quickPpExpiry={quickPpExpiry}
        setQuickPpExpiry={setQuickPpExpiry}
        quickWpExpiry={quickWpExpiry}
        setQuickWpExpiry={setQuickWpExpiry}
        quickNhraLicense={quickNhraLicense}
        setQuickNhraLicense={setQuickNhraLicense}
        quickNhraExpiry={quickNhraExpiry}
        setQuickNhraExpiry={setQuickNhraExpiry}
        originalPpExpiry={originalPpExpiry}
        originalWpExpiry={originalWpExpiry}
        originalNhraExpiry={originalNhraExpiry}
        selectedPpPresetMonths={selectedPpPresetMonths}
        setSelectedPpPresetMonths={setSelectedPpPresetMonths}
        applyPpPreset={applyPpPreset}
        selectedWpPresetMonths={selectedWpPresetMonths}
        setSelectedWpPresetMonths={setSelectedWpPresetMonths}
        applyWpPreset={applyWpPreset}
        selectedNhraPresetMonths={selectedNhraPresetMonths}
        setSelectedNhraPresetMonths={setSelectedNhraPresetMonths}
        applyNhraPreset={applyNhraPreset}
        quickComplianceLoading={quickComplianceLoading}
        getExpiryStatus={getExpiryStatus}
        onClose={() => setQuickComplianceEmp(null)}
        onSave={handleSaveQuickCompliance}
      />

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
