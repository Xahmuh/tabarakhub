import React, { useState, useEffect, useRef } from 'react';
import {
  Clock, Plus, Edit2, Trash2, CheckCircle2, ShieldCheck, Briefcase, Search,
  UserCheck, LayoutGrid, List, Sparkles, Award, Layers, Download, Upload, FileText,
  Save, Check
} from 'lucide-react';
import Swal from 'sweetalert2';
import { StaffCategory } from '../../services/workforceService';

export interface EmploymentContractType {
  id: string;
  contract_title: string;
  shift_hours: number; // e.g. 8, 10, 12
  category: StaffCategory | 'All';
  seniority_level?: 'Junior' | 'Experienced' | 'Senior' | 'General';
  grace_period_minutes: number;
  overtime_multiplier: number;
  default_basic_bhd: number;
  housing_bhd?: number;
  transportation_bhd?: number;
  responsibility_bonus_bhd?: number;
  long_shift_incentive_bhd?: number;
  total_salary_bhd?: number;
  notes?: string;
}

const INITIAL_CONTRACTS: EmploymentContractType[] = [
  // --- 8 HOURS PHARMACIST MATRIX CONTRACTS ---
  {
    id: 'cnt-ph-8h-jr',
    contract_title: '8 Hrs Pharmacist Contract - Junior (عقد صيدلي 8 ساعات - مبتدئ)',
    shift_hours: 8,
    category: 'Pharmacist',
    seniority_level: 'Junior',
    grace_period_minutes: 5,
    overtime_multiplier: 1.25,
    default_basic_bhd: 400,
    housing_bhd: 100,
    transportation_bhd: 50,
    responsibility_bonus_bhd: 0,
    long_shift_incentive_bhd: 0,
    total_salary_bhd: 550,
    notes: 'Standard 8-hour shift contract for Junior Pharmacists (Total: 550 BHD).'
  },
  {
    id: 'cnt-ph-8h-exp',
    contract_title: '8 Hrs Pharmacist Contract - Experienced (عقد صيدلي 8 ساعات - ذو خبرة)',
    shift_hours: 8,
    category: 'Pharmacist',
    seniority_level: 'Experienced',
    grace_period_minutes: 5,
    overtime_multiplier: 1.25,
    default_basic_bhd: 400,
    housing_bhd: 100,
    transportation_bhd: 50,
    responsibility_bonus_bhd: 50,
    long_shift_incentive_bhd: 0,
    total_salary_bhd: 600,
    notes: 'Standard 8-hour shift contract for Experienced Pharmacists (50 BHD bonus, Total: 600 BHD).'
  },
  {
    id: 'cnt-ph-8h-sr',
    contract_title: '8 Hrs Pharmacist Contract - Senior (عقد صيدلي 8 ساعات - صيدلي أول)',
    shift_hours: 8,
    category: 'Pharmacist',
    seniority_level: 'Senior',
    grace_period_minutes: 5,
    overtime_multiplier: 1.25,
    default_basic_bhd: 400,
    housing_bhd: 100,
    transportation_bhd: 50,
    responsibility_bonus_bhd: 100,
    long_shift_incentive_bhd: 0,
    total_salary_bhd: 650,
    notes: 'Standard 8-hour shift contract for Senior Pharmacists (100 BHD bonus, Total: 650 BHD).'
  },

  // --- 10 HOURS PHARMACIST MATRIX CONTRACTS ---
  {
    id: 'cnt-ph-10h-jr',
    contract_title: '10 Hrs Pharmacist Contract - Junior (عقد صيدلي 10 ساعات - مبتدئ)',
    shift_hours: 10,
    category: 'Pharmacist',
    seniority_level: 'Junior',
    grace_period_minutes: 5,
    overtime_multiplier: 1.25,
    default_basic_bhd: 400,
    housing_bhd: 100,
    transportation_bhd: 50,
    responsibility_bonus_bhd: 0,
    long_shift_incentive_bhd: 100,
    total_salary_bhd: 650,
    notes: '10-hour long shift contract for Junior Pharmacists (100 BHD shift inc, Total: 650 BHD).'
  },
  {
    id: 'cnt-ph-10h-exp',
    contract_title: '10 Hrs Pharmacist Contract - Experienced (عقد صيدلي 10 ساعات - ذو خبرة)',
    shift_hours: 10,
    category: 'Pharmacist',
    seniority_level: 'Experienced',
    grace_period_minutes: 5,
    overtime_multiplier: 1.25,
    default_basic_bhd: 400,
    housing_bhd: 100,
    transportation_bhd: 50,
    responsibility_bonus_bhd: 50,
    long_shift_incentive_bhd: 100,
    total_salary_bhd: 700,
    notes: '10-hour long shift contract for Experienced Pharmacists (50 BHD bonus + 100 BHD shift inc, Total: 700 BHD).'
  },
  {
    id: 'cnt-ph-10h-sr',
    contract_title: '10 Hrs Pharmacist Contract - Senior (عقد صيدلي 10 ساعات - صيدلي أول)',
    shift_hours: 10,
    category: 'Pharmacist',
    seniority_level: 'Senior',
    grace_period_minutes: 5,
    overtime_multiplier: 1.25,
    default_basic_bhd: 400,
    housing_bhd: 100,
    transportation_bhd: 50,
    responsibility_bonus_bhd: 100,
    long_shift_incentive_bhd: 100,
    total_salary_bhd: 750,
    notes: '10-hour long shift contract for Senior Pharmacists (100 BHD bonus + 100 BHD shift inc, Total: 750 BHD).'
  },

  // --- OTHER OPERATIONAL CONTRACTS ---
  {
    id: 'cnt-worker-12h',
    contract_title: '12 Hrs Worker Duty Contract (عقد عامل صيدلية 12 ساعة)',
    shift_hours: 12,
    category: 'Worker',
    seniority_level: 'General',
    grace_period_minutes: 10,
    overtime_multiplier: 1.5,
    default_basic_bhd: 350,
    housing_bhd: 0,
    transportation_bhd: 0,
    responsibility_bonus_bhd: 0,
    long_shift_incentive_bhd: 0,
    total_salary_bhd: 350,
    notes: 'Full day duty contract for pharmacy workers & emergency response staff.'
  },
  {
    id: 'cnt-driver-8h',
    contract_title: '8 Hrs Fleet Driver Contract (عقد سائق توصيل 8 ساعات)',
    shift_hours: 8,
    category: 'Driver',
    seniority_level: 'General',
    grace_period_minutes: 5,
    overtime_multiplier: 1.25,
    default_basic_bhd: 300,
    housing_bhd: 0,
    transportation_bhd: 0,
    responsibility_bonus_bhd: 0,
    long_shift_incentive_bhd: 0,
    total_salary_bhd: 300,
    notes: 'Operational shift contract for delivery drivers.'
  }
];

const LOCAL_STORAGE_CONTRACT_KEY = 'tabarak_contract_types';

export const ContractTypesSection: React.FC = () => {
  const [contracts, setContracts] = useState<EmploymentContractType[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_CONTRACT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some(c => c.id.startsWith('cnt-ph-8h'))) {
          return parsed;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_CONTRACTS;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [shiftHoursFilter, setShiftHoursFilter] = useState<number | 'All'>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isEditingMatrix, setIsEditingMatrix] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<EmploymentContractType | null>(null);

  const [contractTitle, setContractTitle] = useState('');
  const [shiftHours, setShiftHours] = useState<number>(8);
  const [category, setCategory] = useState<StaffCategory | 'All'>('Pharmacist');
  const [seniorityLevel, setSeniorityLevel] = useState<'Junior' | 'Experienced' | 'Senior' | 'General'>('Junior');
  const [graceMinutes, setGraceMinutes] = useState<number>(5);
  const [overtimeMultiplier, setOvertimeMultiplier] = useState<number>(1.25);
  const [defaultBasicBhd, setDefaultBasicBhd] = useState<string>('400');
  const [housingBhd, setHousingBhd] = useState<string>('100');
  const [transportationBhd, setTransportationBhd] = useState<string>('50');
  const [responsibilityBonusBhd, setResponsibilityBonusBhd] = useState<string>('0');
  const [longShiftIncentiveBhd, setLongShiftIncentiveBhd] = useState<string>('0');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_CONTRACT_KEY, JSON.stringify(contracts));
  }, [contracts]);

  const openAddModal = () => {
    setEditingContract(null);
    setContractTitle('');
    setShiftHours(8);
    setCategory('Pharmacist');
    setSeniorityLevel('Junior');
    setGraceMinutes(5);
    setOvertimeMultiplier(1.25);
    setDefaultBasicBhd('400');
    setHousingBhd('100');
    setTransportationBhd('50');
    setResponsibilityBonusBhd('0');
    setLongShiftIncentiveBhd('0');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (cnt: EmploymentContractType) => {
    setEditingContract(cnt);
    setContractTitle(cnt.contract_title);
    setShiftHours(cnt.shift_hours);
    setCategory(cnt.category);
    setSeniorityLevel(cnt.seniority_level || 'General');
    setGraceMinutes(cnt.grace_period_minutes);
    setOvertimeMultiplier(cnt.overtime_multiplier);
    setDefaultBasicBhd(String(cnt.default_basic_bhd || 400));
    setHousingBhd(String(cnt.housing_bhd || 0));
    setTransportationBhd(String(cnt.transportation_bhd || 0));
    setResponsibilityBonusBhd(String(cnt.responsibility_bonus_bhd || 0));
    setLongShiftIncentiveBhd(String(cnt.long_shift_incentive_bhd || 0));
    setNotes(cnt.notes || '');
    setIsModalOpen(true);
  };

  const applyPresetTemplate = (type: 'ph8hJr' | 'ph8hExp' | 'ph8hSr' | 'ph10hJr' | 'ph10hExp' | 'ph10hSr' | 'worker12h' | 'driver8h') => {
    if (type === 'ph8hJr') {
      setContractTitle('8 Hrs Pharmacist Contract - Junior (عقد صيدلي 8 ساعات - مبتدئ)');
      setShiftHours(8);
      setCategory('Pharmacist');
      setSeniorityLevel('Junior');
      setGraceMinutes(5);
      setOvertimeMultiplier(1.25);
      setDefaultBasicBhd('400');
      setHousingBhd('100');
      setTransportationBhd('50');
      setResponsibilityBonusBhd('0');
      setLongShiftIncentiveBhd('0');
      setNotes('Standard 8-hour shift contract for Junior Pharmacists (Total: 550 BHD).');
    } else if (type === 'ph8hExp') {
      setContractTitle('8 Hrs Pharmacist Contract - Experienced (عقد صيدلي 8 ساعات - خبرة)');
      setShiftHours(8);
      setCategory('Pharmacist');
      setSeniorityLevel('Experienced');
      setGraceMinutes(5);
      setOvertimeMultiplier(1.25);
      setDefaultBasicBhd('400');
      setHousingBhd('100');
      setTransportationBhd('50');
      setResponsibilityBonusBhd('50');
      setLongShiftIncentiveBhd('0');
      setNotes('Standard 8-hour shift contract for Experienced Pharmacists (Total: 600 BHD).');
    } else if (type === 'ph8hSr') {
      setContractTitle('8 Hrs Pharmacist Contract - Senior (عقد صيدلي 8 ساعات - صيدلي أول)');
      setShiftHours(8);
      setCategory('Pharmacist');
      setSeniorityLevel('Senior');
      setGraceMinutes(5);
      setOvertimeMultiplier(1.25);
      setDefaultBasicBhd('400');
      setHousingBhd('100');
      setTransportationBhd('50');
      setResponsibilityBonusBhd('100');
      setLongShiftIncentiveBhd('0');
      setNotes('Standard 8-hour shift contract for Senior Pharmacists (Total: 650 BHD).');
    } else if (type === 'ph10hJr') {
      setContractTitle('10 Hrs Pharmacist Contract - Junior (عقد صيدلي 10 ساعات - مبتدئ)');
      setShiftHours(10);
      setCategory('Pharmacist');
      setSeniorityLevel('Junior');
      setGraceMinutes(5);
      setOvertimeMultiplier(1.25);
      setDefaultBasicBhd('400');
      setHousingBhd('100');
      setTransportationBhd('50');
      setResponsibilityBonusBhd('0');
      setLongShiftIncentiveBhd('100');
      setNotes('10-hour long shift contract for Junior Pharmacists (Total: 650 BHD).');
    } else if (type === 'ph10hExp') {
      setContractTitle('10 Hrs Pharmacist Contract - Experienced (عقد صيدلي 10 ساعات - خبرة)');
      setShiftHours(10);
      setCategory('Pharmacist');
      setSeniorityLevel('Experienced');
      setGraceMinutes(5);
      setOvertimeMultiplier(1.25);
      setDefaultBasicBhd('400');
      setHousingBhd('100');
      setTransportationBhd('50');
      setResponsibilityBonusBhd('50');
      setLongShiftIncentiveBhd('100');
      setNotes('10-hour long shift contract for Experienced Pharmacists (Total: 700 BHD).');
    } else if (type === 'ph10hSr') {
      setContractTitle('10 Hrs Pharmacist Contract - Senior (عقد صيدلي 10 ساعات - صيدلي أول)');
      setShiftHours(10);
      setCategory('Pharmacist');
      setSeniorityLevel('Senior');
      setGraceMinutes(5);
      setOvertimeMultiplier(1.25);
      setDefaultBasicBhd('400');
      setHousingBhd('100');
      setTransportationBhd('50');
      setResponsibilityBonusBhd('100');
      setLongShiftIncentiveBhd('100');
      setNotes('10-hour long shift contract for Senior Pharmacists (Total: 750 BHD).');
    } else if (type === 'worker12h') {
      setContractTitle('12 Hrs Worker Duty Contract (عقد عامل صيدلية 12 ساعة)');
      setShiftHours(12);
      setCategory('Worker');
      setSeniorityLevel('General');
      setGraceMinutes(10);
      setOvertimeMultiplier(1.5);
      setDefaultBasicBhd('350');
      setHousingBhd('0');
      setTransportationBhd('0');
      setResponsibilityBonusBhd('0');
      setLongShiftIncentiveBhd('0');
      setNotes('Full day duty contract for pharmacy workers.');
    } else if (type === 'driver8h') {
      setContractTitle('8 Hrs Fleet Driver Contract (عقد سائق توصيل 8 ساعات)');
      setShiftHours(8);
      setCategory('Driver');
      setSeniorityLevel('General');
      setGraceMinutes(5);
      setOvertimeMultiplier(1.25);
      setDefaultBasicBhd('300');
      setHousingBhd('0');
      setTransportationBhd('0');
      setResponsibilityBonusBhd('0');
      setLongShiftIncentiveBhd('0');
      setNotes('Operational shift contract for delivery drivers.');
    }
  };

  const handleDelete = (id: string) => {
    Swal.fire({
      title: 'Remove Contract Type?',
      text: 'This will remove the contract configuration.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel'
    }).then(result => {
      if (result.isConfirmed) {
        setContracts(prev => prev.filter(c => c.id !== id));
        Swal.fire('Deleted!', 'Contract type removed.', 'success');
      }
    });
  };

  // --- DYNAMIC MATRIX INLINE CELL EDITING ---
  const getPharmacistContract = (shiftHours: number, seniority: 'Junior' | 'Experienced' | 'Senior') => {
    return contracts.find(c =>
      c.category === 'Pharmacist' &&
      c.shift_hours === shiftHours &&
      (c.seniority_level === seniority || (seniority === 'Junior' && !c.seniority_level))
    );
  };

  const handleMatrixCellChange = (contractId: string, field: keyof EmploymentContractType, rawVal: string) => {
    const val = parseFloat(rawVal) || 0;
    setContracts(prev => prev.map(c => {
      if (c.id === contractId) {
        const updated = { ...c, [field]: val };
        const basic = updated.default_basic_bhd || 0;
        const housing = updated.housing_bhd || 0;
        const transport = updated.transportation_bhd || 0;
        const bonus = updated.responsibility_bonus_bhd || 0;
        const incentive = updated.long_shift_incentive_bhd || 0;
        updated.total_salary_bhd = basic + housing + transport + bonus + incentive;
        return updated;
      }
      return c;
    }));
  };

  // --- EXCEL EXPORT & BULK IMPORT (WITH OVERWRITE & DEDUPLICATION) ---
  const handleExportExcel = () => {
    const headers = [
      'Contract ID',
      'Contract Title (عنوان العقد)',
      'Shift Hours (ساعات الشفت)',
      'Role Category (الدور)',
      'Seniority Tier (المستوى)',
      'Basic Salary (الأساسي BHD)',
      'Housing Allowance (بدل السكن BHD)',
      'Transportation (المواصلات BHD)',
      'Responsibility Bonus (بدل المسئولية BHD)',
      '10h Shift Incentive (حافز الشفت BHD)',
      'Total Salary (إجمالي المرتب BHD)',
      'Grace Period Mins (دقائق السماح)',
      'Overtime Multiplier (معامل الإضافي)',
      'Notes (ملاحظات العقد)'
    ];

    const rows = contracts.map(c => [
      c.id,
      c.contract_title,
      c.shift_hours,
      c.category,
      c.seniority_level || 'General',
      c.default_basic_bhd || 400,
      c.housing_bhd || 0,
      c.transportation_bhd || 0,
      c.responsibility_bonus_bhd || 0,
      c.long_shift_incentive_bhd || 0,
      c.total_salary_bhd || (c.default_basic_bhd + (c.housing_bhd || 0) + (c.transportation_bhd || 0) + (c.responsibility_bonus_bhd || 0) + (c.long_shift_incentive_bhd || 0)),
      c.grace_period_minutes,
      c.overtime_multiplier,
      c.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Tabarak_Contract_Types_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        if (!text) {
          Swal.fire('Error', 'No content found in uploaded file', 'error');
          return;
        }

        const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
          Swal.fire('Error', 'No data rows found in uploaded file', 'error');
          return;
        }

        const parseCsvLine = (line: string): string[] => {
          const result: string[] = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              result.push(cur.trim());
              cur = '';
            } else {
              cur += char;
            }
          }
          result.push(cur.trim());
          return result;
        };

        const headers = parseCsvLine(lines[0]).map(h => h.replace(/^"|"$/g, '').toLowerCase());

        const getColIdx = (names: string[]): number => {
          return headers.findIndex(h => names.some(n => h.includes(n.toLowerCase())));
        };

        const idxId = getColIdx(['id', 'contract id', 'كود']);
        const idxTitle = getColIdx(['title', 'عنوان العقد', 'contract title', 'اسم العقد']);
        const idxShift = getColIdx(['shift', 'hours', 'ساعات']);
        const idxCategory = getColIdx(['category', 'role', 'الدور', 'الفئة']);
        const idxSeniority = getColIdx(['seniority', 'tier', 'المستوى']);
        const idxBasic = getColIdx(['basic', 'الأساسي']);
        const idxHousing = getColIdx(['housing', 'السكن']);
        const idxTransport = getColIdx(['transport', 'المواصلات']);
        const idxBonus = getColIdx(['responsibility', 'bonus', 'بدل']);
        const idxIncentive = getColIdx(['incentive', 'حافز']);
        const idxGrace = getColIdx(['grace', 'سماح']);
        const idxOvertime = getColIdx(['overtime', 'multiplier', 'إضافي']);
        const idxNotes = getColIdx(['notes', 'ملاحظات']);

        const importedContracts: EmploymentContractType[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]).map(c => c.replace(/^"|"$/g, ''));
          const titleVal = idxTitle !== -1 ? cols[idxTitle] : cols[1];

          if (!titleVal) continue;

          const idVal = idxId !== -1 && cols[idxId] ? cols[idxId] : `cnt-imp-${Date.now()}-${i}`;
          const shiftVal = idxShift !== -1 && cols[idxShift] ? parseInt(cols[idxShift], 10) : 8;
          const categoryVal = idxCategory !== -1 && cols[idxCategory] ? cols[idxCategory] : 'Pharmacist';
          const seniorityVal = idxSeniority !== -1 && cols[idxSeniority] ? cols[idxSeniority] : 'General';
          const basicVal = idxBasic !== -1 && cols[idxBasic] ? parseFloat(cols[idxBasic]) : 400;
          const housingVal = idxHousing !== -1 && cols[idxHousing] ? parseFloat(cols[idxHousing]) : 0;
          const transportVal = idxTransport !== -1 && cols[idxTransport] ? parseFloat(cols[idxTransport]) : 0;
          const bonusVal = idxBonus !== -1 && cols[idxBonus] ? parseFloat(cols[idxBonus]) : 0;
          const incentiveVal = idxIncentive !== -1 && cols[idxIncentive] ? parseFloat(cols[idxIncentive]) : 0;
          const graceVal = idxGrace !== -1 && cols[idxGrace] ? parseInt(cols[idxGrace], 10) : 5;
          const overtimeVal = idxOvertime !== -1 && cols[idxOvertime] ? parseFloat(cols[idxOvertime]) : 1.25;
          const notesVal = idxNotes !== -1 ? cols[idxNotes] : undefined;

          const totalVal = basicVal + housingVal + transportVal + bonusVal + incentiveVal;

          importedContracts.push({
            id: idVal,
            contract_title: titleVal,
            shift_hours: isNaN(shiftVal) ? 8 : shiftVal,
            category: (categoryVal as any) || 'Pharmacist',
            seniority_level: (seniorityVal as any) || 'General',
            default_basic_bhd: isNaN(basicVal) ? 400 : basicVal,
            housing_bhd: isNaN(housingVal) ? 0 : housingVal,
            transportation_bhd: isNaN(transportVal) ? 0 : transportVal,
            responsibility_bonus_bhd: isNaN(bonusVal) ? 0 : bonusVal,
            long_shift_incentive_bhd: isNaN(incentiveVal) ? 0 : incentiveVal,
            total_salary_bhd: totalVal,
            grace_period_minutes: isNaN(graceVal) ? 5 : graceVal,
            overtime_multiplier: isNaN(overtimeVal) ? 1.25 : overtimeVal,
            notes: notesVal
          });
        }

        if (importedContracts.length === 0) {
          Swal.fire('Error', 'No valid contract type records parsed from file', 'error');
          return;
        }

        // Merge & Overwrite existing entries based on ID or lowercased title (No Duplicates)
        setContracts(prev => {
          const contractMap = new Map<string, EmploymentContractType>();

          prev.forEach(item => {
            contractMap.set(item.id.toLowerCase(), item);
            contractMap.set(item.contract_title.trim().toLowerCase(), item);
          });

          importedContracts.forEach(imp => {
            const keyId = imp.id.toLowerCase();
            const keyTitle = imp.contract_title.trim().toLowerCase();

            const existing = contractMap.get(keyId) || contractMap.get(keyTitle);

            if (existing) {
              const merged: EmploymentContractType = {
                ...existing,
                ...imp,
                id: existing.id // Preserve consistent internal ID
              };
              contractMap.set(existing.id.toLowerCase(), merged);
              contractMap.set(existing.contract_title.trim().toLowerCase(), merged);
            } else {
              contractMap.set(imp.id.toLowerCase(), imp);
              contractMap.set(imp.contract_title.trim().toLowerCase(), imp);
            }
          });

          const finalValues = Array.from(new Set(contractMap.values()));
          return finalValues;
        });

        Swal.fire({
          icon: 'success',
          title: 'Bulk Import Successful!',
          html: `<p class="text-xs">Processed uploaded contracts with <b>Strict Overwrite & Anti-Duplication</b>.</p>
                 <div class="mt-2 text-xs font-mono font-bold text-slate-700 bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                   Total Processed: <b>${importedContracts.length}</b> records.
                 </div>`,
          timer: 3000
        });
      } catch (err: any) {
        console.error(err);
        Swal.fire('Error', 'Failed to parse file: ' + err.message, 'error');
      }
    };

    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const computedTotalSalary =
    (parseFloat(defaultBasicBhd) || 0) +
    (parseFloat(housingBhd) || 0) +
    (parseFloat(transportationBhd) || 0) +
    (parseFloat(responsibilityBonusBhd) || 0) +
    (parseFloat(longShiftIncentiveBhd) || 0);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractTitle.trim()) {
      Swal.fire('Error', 'Contract Title is required', 'error');
      return;
    }

    const payload: EmploymentContractType = {
      id: editingContract?.id || `cnt-${Date.now()}`,
      contract_title: contractTitle.trim(),
      shift_hours: shiftHours,
      category,
      seniority_level: seniorityLevel,
      grace_period_minutes: graceMinutes,
      overtime_multiplier: overtimeMultiplier,
      default_basic_bhd: parseFloat(defaultBasicBhd) || 0,
      housing_bhd: parseFloat(housingBhd) || 0,
      transportation_bhd: parseFloat(transportationBhd) || 0,
      responsibility_bonus_bhd: parseFloat(responsibilityBonusBhd) || 0,
      long_shift_incentive_bhd: parseFloat(longShiftIncentiveBhd) || 0,
      total_salary_bhd: computedTotalSalary,
      notes: notes.trim() || undefined
    };

    if (editingContract) {
      setContracts(prev => prev.map(c => c.id === editingContract.id ? payload : c));
      Swal.fire('Success', 'Contract type updated successfully', 'success');
    } else {
      setContracts(prev => [...prev, payload]);
      Swal.fire('Success', 'New Contract type added successfully', 'success');
    }
    setIsModalOpen(false);
  };

  const filteredContracts = contracts.filter(c => {
    const matchesSearch = c.contract_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'All' || c.category === categoryFilter;
    const matchesShift = shiftHoursFilter === 'All' || c.shift_hours === shiftHoursFilter;

    return matchesSearch && matchesCategory && matchesShift;
  });

  // KPI Calculations
  const totalContracts = contracts.length;
  const pharmacistContractsCount = contracts.filter(c => c.category === 'Pharmacist').length;
  const workerDriverCount = contracts.filter(c => c.category === 'Worker' || c.category === 'Driver').length;
  const avgGraceMinutes = Math.round(contracts.reduce((acc, c) => acc + c.grace_period_minutes, 0) / (totalContracts || 1));

  // Pharmacist Matrix Specific Template References
  const ph8hJr = getPharmacistContract(8, 'Junior');
  const ph8hExp = getPharmacistContract(8, 'Experienced');
  const ph8hSr = getPharmacistContract(8, 'Senior');
  const ph10hJr = getPharmacistContract(10, 'Junior');
  const ph10hExp = getPharmacistContract(10, 'Experienced');
  const ph10hSr = getPharmacistContract(10, 'Senior');

  const pharmacistMatrixCols = [ph8hJr, ph8hExp, ph8hSr, ph10hJr, ph10hExp, ph10hSr];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hidden File Input for Bulk Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportExcel}
        accept=".csv, .xlsx, .xls"
        className="hidden"
      />

      {/* Executive Summary KPI Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Shift Contracts</p>
            <p className="text-2xl font-black text-slate-950 mt-1">{totalContracts}</p>
            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 mt-1">
              <CheckCircle2 size={12} /> Active Templates
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pharmacist Contracts</p>
            <p className="text-2xl font-black text-purple-950 mt-1">{pharmacistContractsCount}</p>
            <span className="text-[10px] font-bold text-purple-600 flex items-center gap-1 mt-1">
              <Award size={12} /> 8h & 10h Matrix Tiers
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Briefcase size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drivers & Workers</p>
            <p className="text-2xl font-black text-cyan-950 mt-1">{workerDriverCount}</p>
            <span className="text-[10px] font-bold text-cyan-600 flex items-center gap-1 mt-1">
              <Layers size={12} /> Operational Duty
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
            <UserCheck size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Standard Grace Period</p>
            <p className="text-2xl font-black text-amber-950 mt-1">{avgGraceMinutes} mins</p>
            <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1 mt-1">
              <ShieldCheck size={12} /> GCC Compliance
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Sparkles size={22} />
          </div>
        </div>
      </div>

      {/* Control Bar: Filters, Search, Excel Export/Import & Add Button */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        {/* Left: Role & Shift Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {['All', 'Pharmacist', 'Driver', 'Worker', 'Management'].map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  categoryFilter === cat
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat === 'All' ? 'All Roles' : cat}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {['All', 8, 10, 12].map(hrs => (
              <button
                key={String(hrs)}
                onClick={() => setShiftHoursFilter(hrs as any)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                  shiftHoursFilter === hrs
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {hrs === 'All' ? 'All Hours' : `${hrs}h`}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Search, Bulk Excel Utilities, View Mode & Add Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search contract title or notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full sm:w-56 pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand/40 focus:bg-white"
            />
          </div>

          {/* Excel Export & Import Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all border border-slate-200"
              title="Export Contract Types to Excel / CSV"
            >
              <Download size={14} className="text-emerald-600" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all border border-slate-200"
              title="Bulk Import / Overwrite Contract Types from Excel"
            >
              <Upload size={14} className="text-blue-600" />
              <span className="hidden sm:inline">Bulk Upload</span>
            </button>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-white text-brand shadow-sm font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Grid View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-white text-brand shadow-sm font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Table View"
            >
              <List size={16} />
            </button>
          </div>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-brand-dark transition-all shadow-md shadow-brand/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Contract Type</span>
          </button>
        </div>
      </div>

      {/* Official Pharmacists Salary Matrix Banner (EDITABLE BY ADMIN & SHOWN WHEN PHARMACIST ROLE IS SELECTED) */}
      {categoryFilter === 'Pharmacist' && (
        <div className="bg-slate-950 text-white rounded-2xl p-6 shadow-xl border border-slate-800 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-0.5">
                Official Corporate Standards (سلم المرتبات الرسمي)
              </span>
              <h4 className="text-lg font-black text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-400" />
                <span>Pharmacists Salary Matrix Structure (جدول رواتب ومزايا الصيادلة حسب نوع العقد)</span>
              </h4>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <span className="px-3 py-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-xl text-xs font-black font-mono">
                BHD Bahraini Dinar Standard
              </span>

              {/* Admin Direct Matrix Edit Toggle */}
              <button
                onClick={() => {
                  if (isEditingMatrix) {
                    Swal.fire({
                      icon: 'success',
                      title: 'Matrix Updated!',
                      text: 'Pharmacists Salary Matrix saved successfully.',
                      timer: 1500,
                      showConfirmButton: false
                    });
                  }
                  setIsEditingMatrix(!isEditingMatrix);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
                  isEditingMatrix
                    ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                    : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                }`}
              >
                {isEditingMatrix ? (
                  <>
                    <Check size={15} />
                    <span>Done Editing Matrix</span>
                  </>
                ) : (
                  <>
                    <Edit2 size={14} />
                    <span>Edit Salary Matrix</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase font-black tracking-wider text-slate-400">
                  <th className="py-3 px-4 bg-slate-900/80">Category & Allowance Breakdown</th>
                  <th colSpan={3} className="py-3 px-4 text-center bg-slate-900 text-amber-300 border-x border-slate-800">
                    8 Hrs - Contract (عقد 8 ساعات)
                  </th>
                  <th colSpan={3} className="py-3 px-4 text-center bg-slate-900 text-cyan-300">
                    10 Hrs - Contract (عقد 10 ساعات)
                  </th>
                </tr>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-300 bg-slate-900/40">
                  <th className="py-2.5 px-4 text-slate-400">Level / Seniority Tier</th>
                  <th className="py-2.5 px-4 text-center">Junior</th>
                  <th className="py-2.5 px-4 text-center">Experienced</th>
                  <th className="py-2.5 px-4 text-center border-r border-slate-800">Senior</th>
                  <th className="py-2.5 px-4 text-center">Junior</th>
                  <th className="py-2.5 px-4 text-center">Experienced</th>
                  <th className="py-2.5 px-4 text-center">Senior</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs font-medium text-slate-200">
                {/* Basic Salary Row */}
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-300 bg-slate-900/30">Basic Salary (الأساسي)</td>
                  {pharmacistMatrixCols.map((c, idx) => (
                    <td key={`basic-${idx}`} className={`py-3 px-4 text-center font-mono ${idx === 2 ? 'border-r border-slate-800' : ''}`}>
                      {isEditingMatrix && c ? (
                        <input
                          type="number"
                          value={c.default_basic_bhd ?? 400}
                          onChange={e => handleMatrixCellChange(c.id, 'default_basic_bhd', e.target.value)}
                          className="w-16 bg-slate-900 border border-slate-700 focus:border-amber-400 text-amber-300 text-center font-mono py-1 rounded outline-none font-bold text-xs"
                        />
                      ) : (
                        <span>{c?.default_basic_bhd ?? 400}</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Housing Row */}
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-300 bg-slate-900/30">Housing (بدل السكن)</td>
                  {pharmacistMatrixCols.map((c, idx) => (
                    <td key={`housing-${idx}`} className={`py-3 px-4 text-center font-mono ${idx === 2 ? 'border-r border-slate-800' : ''}`}>
                      {isEditingMatrix && c ? (
                        <input
                          type="number"
                          value={c.housing_bhd ?? 100}
                          onChange={e => handleMatrixCellChange(c.id, 'housing_bhd', e.target.value)}
                          className="w-16 bg-slate-900 border border-slate-700 focus:border-amber-400 text-amber-300 text-center font-mono py-1 rounded outline-none font-bold text-xs"
                        />
                      ) : (
                        <span>{c?.housing_bhd ?? 100}</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Transportation Row */}
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-300 bg-slate-900/30">Transportation (المواصلات)</td>
                  {pharmacistMatrixCols.map((c, idx) => (
                    <td key={`trans-${idx}`} className={`py-3 px-4 text-center font-mono ${idx === 2 ? 'border-r border-slate-800' : ''}`}>
                      {isEditingMatrix && c ? (
                        <input
                          type="number"
                          value={c.transportation_bhd ?? 50}
                          onChange={e => handleMatrixCellChange(c.id, 'transportation_bhd', e.target.value)}
                          className="w-16 bg-slate-900 border border-slate-700 focus:border-amber-400 text-amber-300 text-center font-mono py-1 rounded outline-none font-bold text-xs"
                        />
                      ) : (
                        <span>{c?.transportation_bhd ?? 50}</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Responsibility Bonus Row */}
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-300 bg-slate-900/30">Retention / Responsibility Bonus</td>
                  {pharmacistMatrixCols.map((c, idx) => (
                    <td key={`bonus-${idx}`} className={`py-3 px-4 text-center font-mono ${idx === 2 ? 'border-r border-slate-800' : ''}`}>
                      {isEditingMatrix && c ? (
                        <input
                          type="number"
                          value={c.responsibility_bonus_bhd ?? 0}
                          onChange={e => handleMatrixCellChange(c.id, 'responsibility_bonus_bhd', e.target.value)}
                          className="w-16 bg-slate-900 border border-slate-700 focus:border-amber-400 text-amber-300 text-center font-mono py-1 rounded outline-none font-bold text-xs"
                        />
                      ) : (
                        <span className={c?.responsibility_bonus_bhd ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                          {c?.responsibility_bonus_bhd ? c.responsibility_bonus_bhd : '-'}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Long Shift Incentive Row */}
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-300 bg-slate-900/30">Long Shift Incentive (حافز الـ 10 ساعات)</td>
                  {pharmacistMatrixCols.map((c, idx) => (
                    <td key={`inc-${idx}`} className={`py-3 px-4 text-center font-mono ${idx === 2 ? 'border-r border-slate-800' : ''}`}>
                      {isEditingMatrix && c ? (
                        <input
                          type="number"
                          value={c.long_shift_incentive_bhd ?? 0}
                          onChange={e => handleMatrixCellChange(c.id, 'long_shift_incentive_bhd', e.target.value)}
                          className="w-16 bg-slate-900 border border-slate-700 focus:border-emerald-400 text-emerald-300 text-center font-mono py-1 rounded outline-none font-bold text-xs"
                        />
                      ) : (
                        <span className={c?.long_shift_incentive_bhd ? 'text-emerald-400 font-black' : 'text-slate-500'}>
                          {c?.long_shift_incentive_bhd ? c.long_shift_incentive_bhd : '-'}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Total Salary Row */}
                <tr className="bg-amber-500/10 font-black text-amber-300 border-t-2 border-slate-700 text-sm">
                  <td className="py-3.5 px-4 uppercase tracking-wider">TOTAL SALARY (إجمالي المرتب)</td>
                  {pharmacistMatrixCols.map((c, idx) => {
                    const total = c?.total_salary_bhd || ((c?.default_basic_bhd || 0) + (c?.housing_bhd || 0) + (c?.transportation_bhd || 0) + (c?.responsibility_bonus_bhd || 0) + (c?.long_shift_incentive_bhd || 0));
                    return (
                      <td key={`total-${idx}`} className={`py-3.5 px-4 text-center font-mono text-amber-300 ${idx === 2 ? 'border-r border-slate-800' : ''}`}>
                        {total} BHD
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contract Cards Grid or Table View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredContracts.map(cnt => {
            const is8h = cnt.shift_hours === 8;
            const is10h = cnt.shift_hours === 10;
            const is12h = cnt.shift_hours === 12;

            // Matching Corporate Pharmacist Matrix Themes
            const cardHeaderClass = is8h && cnt.category === 'Pharmacist'
              ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white'
              : is10h && cnt.category === 'Pharmacist'
              ? 'bg-gradient-to-r from-cyan-600 via-teal-600 to-sky-700 text-white'
              : is12h
              ? 'bg-gradient-to-r from-emerald-600 to-teal-800 text-white'
              : 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white';

            const cardBorderClass = is8h && cnt.category === 'Pharmacist'
              ? 'hover:border-amber-400/80 hover:shadow-amber-500/10'
              : is10h && cnt.category === 'Pharmacist'
              ? 'hover:border-cyan-400/80 hover:shadow-cyan-500/10'
              : is12h
              ? 'hover:border-emerald-400/80 hover:shadow-emerald-500/10'
              : 'hover:border-purple-400/80 hover:shadow-purple-500/10';

            const totalSalaryPillClass = is8h && cnt.category === 'Pharmacist'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : is10h && cnt.category === 'Pharmacist'
              ? 'bg-cyan-50 border-cyan-300 text-cyan-950'
              : is12h
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-purple-50 border-purple-300 text-purple-950';

            const totalSalary = cnt.total_salary_bhd || (cnt.default_basic_bhd + (cnt.housing_bhd || 0) + (cnt.transportation_bhd || 0) + (cnt.responsibility_bonus_bhd || 0) + (cnt.long_shift_incentive_bhd || 0));

            return (
              <div
                key={cnt.id}
                className={`group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-xl flex flex-col justify-between ${cardBorderClass}`}
              >
                <div>
                  {/* Card Header Badge */}
                  <div className={`p-4 ${cardHeaderClass} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 opacity-90" />
                      <span className="font-mono text-sm font-black tracking-wider uppercase">
                        {cnt.shift_hours} Hours Shift
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-lg p-1">
                      <button
                        onClick={() => openEditModal(cnt)}
                        className="p-1.5 text-white/80 hover:text-white rounded-md hover:bg-white/20 transition-colors"
                        title="Edit contract"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(cnt.id)}
                        className="p-1.5 text-red-200 hover:text-white rounded-md hover:bg-red-500/30 transition-colors"
                        title="Delete contract"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Card Main Info */}
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wider">
                            {cnt.category} Role
                          </span>
                          {cnt.seniority_level && cnt.seniority_level !== 'General' && (
                            <span className="inline-block px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">
                              Tier: {cnt.seniority_level}
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-black text-slate-950 leading-snug">{cnt.contract_title}</h4>
                      </div>

                      <div className={`text-right shrink-0 border px-3 py-1.5 rounded-xl ${totalSalaryPillClass}`}>
                        <span className="text-[9px] font-black uppercase tracking-wider block opacity-75">TOTAL SALARY</span>
                        <span className="text-sm font-black font-mono">{totalSalary} BHD</span>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-slate-500">{cnt.notes || 'Standard operational shift contract template.'}</p>

                    {/* Financial & Operational Breakdown Grid */}
                    <div className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Basic Salary:</span>
                        <span className="font-mono font-bold text-slate-900">{cnt.default_basic_bhd} BHD</span>
                      </div>
                      {cnt.housing_bhd ? (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Housing Allowance:</span>
                          <span className="font-mono font-bold text-slate-900">{cnt.housing_bhd} BHD</span>
                        </div>
                      ) : null}
                      {cnt.transportation_bhd ? (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Transportation:</span>
                          <span className="font-mono font-bold text-slate-900">{cnt.transportation_bhd} BHD</span>
                        </div>
                      ) : null}
                      {cnt.responsibility_bonus_bhd ? (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-amber-700 font-bold">Responsibility Bonus:</span>
                          <span className="font-mono font-bold text-amber-700">+{cnt.responsibility_bonus_bhd} BHD</span>
                        </div>
                      ) : null}
                      {cnt.long_shift_incentive_bhd ? (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-emerald-700 font-bold">10h Shift Incentive:</span>
                          <span className="font-mono font-bold text-emerald-700">+{cnt.long_shift_incentive_bhd} BHD</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Operational Details */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Grace Period</span>
                        <span className="font-mono font-bold text-emerald-600">{cnt.grace_period_minutes} mins</span>
                      </div>

                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Overtime Rate</span>
                        <span className="font-mono font-bold text-blue-600">{cnt.overtime_multiplier}x</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 text-[10px] font-bold text-slate-400 flex items-center justify-between">
                  <span>ID: {cnt.id}</span>
                  <span className="text-emerald-600 flex items-center gap-1 font-black">
                    <CheckCircle2 size={11} /> Matrix Synchronized
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Detailed Table View */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Shift Hours</th>
                <th className="py-3.5 px-4">Contract Title</th>
                <th className="py-3.5 px-4">Role & Tier</th>
                <th className="py-3.5 px-4">Basic</th>
                <th className="py-3.5 px-4">Housing</th>
                <th className="py-3.5 px-4">Transport</th>
                <th className="py-3.5 px-4">Bonus / Incentive</th>
                <th className="py-3.5 px-4">TOTAL SALARY</th>
                <th className="py-3.5 px-4">Grace / OT</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {filteredContracts.map(cnt => {
                const totalSalary = cnt.total_salary_bhd || (cnt.default_basic_bhd + (cnt.housing_bhd || 0) + (cnt.transportation_bhd || 0) + (cnt.responsibility_bonus_bhd || 0) + (cnt.long_shift_incentive_bhd || 0));
                return (
                  <tr key={cnt.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-black">
                      <span className="px-2.5 py-1 rounded-lg bg-brand/10 text-brand text-xs font-black">
                        {cnt.shift_hours} Hours
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-950">{cnt.contract_title}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-bold mr-1">
                        {cnt.category}
                      </span>
                      {cnt.seniority_level && (
                        <span className="text-[10px] text-amber-700 font-bold">({cnt.seniority_level})</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{cnt.default_basic_bhd}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{cnt.housing_bhd || 0}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{cnt.transportation_bhd || 0}</td>
                    <td className="py-3 px-4 font-mono text-amber-700 font-bold">
                      +{ (cnt.responsibility_bonus_bhd || 0) + (cnt.long_shift_incentive_bhd || 0) } BHD
                    </td>
                    <td className="py-3 px-4 font-mono font-black text-emerald-700 bg-emerald-50/50">{totalSalary} BHD</td>
                    <td className="py-3 px-4 text-[11px]">
                      <span className="text-emerald-600 font-mono font-bold">{cnt.grace_period_minutes}m</span> /{' '}
                      <span className="text-blue-600 font-mono font-bold">{cnt.overtime_multiplier}x</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(cnt)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(cnt.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modern Add / Edit Contract Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950">
                    {editingContract ? 'Edit Contract Template' : 'Add New Employment Contract'}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">Configure salary matrix and operational parameters</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Quick Preset Buttons for Pharmacist Matrix */}
            {!editingContract && (
              <div className="mb-5 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  ⚡ Pharmacist Salary Matrix Presets (قوالب أجور الصيادلة):
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => applyPresetTemplate('ph8hJr')}
                    className="p-2 bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50 text-left rounded-xl transition-all"
                  >
                    <span className="text-[10px] font-black text-purple-900 block">8h Junior</span>
                    <span className="text-[9px] text-slate-500 font-bold">550 BHD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetTemplate('ph8hExp')}
                    className="p-2 bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50 text-left rounded-xl transition-all"
                  >
                    <span className="text-[10px] font-black text-purple-900 block">8h Experienced</span>
                    <span className="text-[9px] text-amber-700 font-bold">600 BHD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetTemplate('ph8hSr')}
                    className="p-2 bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50 text-left rounded-xl transition-all"
                  >
                    <span className="text-[10px] font-black text-purple-900 block">8h Senior</span>
                    <span className="text-[9px] text-emerald-700 font-bold">650 BHD</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPresetTemplate('ph10hJr')}
                    className="p-2 bg-purple-600 text-white hover:bg-purple-700 text-left rounded-xl transition-all shadow-xs"
                  >
                    <span className="text-[10px] font-black block">10h Junior</span>
                    <span className="text-[9px] font-bold opacity-90">650 BHD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetTemplate('ph10hExp')}
                    className="p-2 bg-purple-600 text-white hover:bg-purple-700 text-left rounded-xl transition-all shadow-xs"
                  >
                    <span className="text-[10px] font-black block">10h Experienced</span>
                    <span className="text-[9px] font-bold opacity-90">700 BHD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetTemplate('ph10hSr')}
                    className="p-2 bg-purple-600 text-white hover:bg-purple-700 text-left rounded-xl transition-all shadow-xs"
                  >
                    <span className="text-[10px] font-black block">10h Senior</span>
                    <span className="text-[9px] font-bold text-amber-300">750 BHD</span>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                  Contract Title (عنوان العقد)
                </label>
                <input
                  type="text"
                  required
                  value={contractTitle}
                  onChange={e => setContractTitle(e.target.value)}
                  placeholder="e.g. 10 Hrs Pharmacist Contract - Experienced"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Daily Shift Hours
                  </label>
                  <select
                    value={shiftHours}
                    onChange={e => setShiftHours(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand focus:bg-white"
                  >
                    <option value={8}>8 Hours Shift</option>
                    <option value={10}>10 Hours Shift</option>
                    <option value={12}>12 Hours Shift</option>
                    <option value={6}>6 Hours Part-Time</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Applicable Role
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand focus:bg-white"
                  >
                    <option value="Pharmacist">Pharmacist (صيدلي)</option>
                    <option value="Driver">Driver (سائق توصيل)</option>
                    <option value="Worker">Worker (عامل صيدلية)</option>
                    <option value="Management">Management (إداري)</option>
                    <option value="All">All Categories</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Seniority Level / Tier
                  </label>
                  <select
                    value={seniorityLevel}
                    onChange={e => setSeniorityLevel(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand focus:bg-white"
                  >
                    <option value="Junior">Junior (مبتدئ)</option>
                    <option value="Experienced">Experienced (خبرة)</option>
                    <option value="Senior">Senior (صيدلي أول)</option>
                    <option value="General">General (عام)</option>
                  </select>
                </div>
              </div>

              {/* Financial Matrix Breakdown Box */}
              <div className="p-4 bg-purple-50/80 rounded-2xl border border-purple-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-purple-600" />
                    <span>Financial Matrix Allowances Breakdown (تفاصيل الأجور والبدلات)</span>
                  </span>
                  <span className="text-xs font-black font-mono text-emerald-800 bg-white px-3 py-1 rounded-xl border border-purple-200 shadow-2xs">
                    Total: {computedTotalSalary} BHD
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 uppercase mb-1">Basic Salary</label>
                    <input
                      type="number"
                      value={defaultBasicBhd}
                      onChange={e => setDefaultBasicBhd(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-900 outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 uppercase mb-1">Housing Allowance</label>
                    <input
                      type="number"
                      value={housingBhd}
                      onChange={e => setHousingBhd(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-900 outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 uppercase mb-1">Transportation</label>
                    <input
                      type="number"
                      value={transportationBhd}
                      onChange={e => setTransportationBhd(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-900 outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-amber-800 uppercase mb-1">Responsibility Bonus</label>
                    <input
                      type="number"
                      value={responsibilityBonusBhd}
                      onChange={e => setResponsibilityBonusBhd(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-amber-900 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-emerald-800 uppercase mb-1">10h Shift Incentive</label>
                    <input
                      type="number"
                      value={longShiftIncentiveBhd}
                      onChange={e => setLongShiftIncentiveBhd(e.target.value)}
                      className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-emerald-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Grace Period (سماح الحضور)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      value={graceMinutes}
                      onChange={e => setGraceMinutes(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-brand focus:bg-white"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">min</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Overtime Rate Multiplier
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.05"
                      required
                      value={overtimeMultiplier}
                      onChange={e => setOvertimeMultiplier(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-brand focus:bg-white"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">x</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                  Operational Notes (ملاحظات العقد)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Operational details and shift notes..."
                  className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-brand focus:bg-white transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-brand text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-brand-dark transition-all shadow-md shadow-brand/20"
                >
                  Save Contract Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
