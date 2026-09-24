import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Building2,
  MapPin,
  Truck,
  Calendar,
  ShieldCheck,
  Award,
  CreditCard,
  Globe2,
  AlertCircle,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  ChevronDown,
  Check,
  Search,
  Plus,
  Briefcase
} from 'lucide-react';
import {
  workforceService,
  Employee,
  EmployeeBranchAssignment,
  StaffCategory,
  StaffStatus,
  CATEGORY_PREFIXES
} from '../../../services/workforceService';
import { Branch } from '../../../types';
import { getAdminRegisteredCrs } from '../../../lib/crEntities';
import { BahrainLicensePlate } from '../../operational-expenses/components/BahrainLicensePlate';
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
} from './WorkforceVectors';
import {
  getAdminContractTypes,
  getCategoryMeta,
  getExpiryStatus
} from './workforceHelpers';

export interface EmployeeEditModalProps {
  isOpen: boolean;
  editingEmp: Partial<Employee> | null;
  isRtl: boolean;
  existingEmployees: Employee[];
  branches: Partial<Branch>[];
  grid20Branches: {
    id: string;
    code: string;
    name: string;
    lat: number;
    lng: number;
  }[];
  availableFleetList: {
    id: string;
    code: string;
    plateNumber: string;
    type: string;
    ownership: string;
    status: string;
    tagValue: string;
    shortTag: string;
  }[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const EmployeeEditModal: React.FC<EmployeeEditModalProps> = ({
  isOpen,
  editingEmp,
  isRtl,
  existingEmployees,
  branches,
  grid20Branches,
  availableFleetList,
  onClose,
  onSaved,
  showToast
}) => {
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
  }, [isOpen]);

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



  useEffect(() => {
    if (!isOpen) return;

    if (editingEmp) {
      const emp = editingEmp;
      const cat = emp.category || 'Driver';

      setFormCategory(cat);
      setFormCode(emp.code || '');
      setFormName(emp.full_name || '');
      setFormCpr(emp.cpr_number || '');
      setFormPhone(emp.phone || '');
      setFormEmail(emp.email || '');
      setFormStatus(emp.status || 'Active');
      setFormNotes(emp.notes || '');
      setFormAssignments(emp.assignments ? [...emp.assignments] : []);
      setFormVehicles(emp.assigned_vehicles ? [...emp.assigned_vehicles] : []);
      setFleetSearchTerm('');
      setIsFleetDropdownOpen(false);

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
    } else {
      const defaultCat: StaffCategory = 'Driver';
      const autoCode = workforceService.generateNextCode(defaultCat, existingEmployees);
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
    }
  }, [isOpen, editingEmp, existingEmployees]);


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
      const autoCode = workforceService.generateNextCode(newCat, existingEmployees);
      setFormCode(autoCode);
    }
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
      onClose();
      await onSaved();
    } catch (err: any) {
      showToast(err.message || (isRtl ? 'فشل الحفظ' : 'Save failed'), 'error');
    }
  };

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

  if (!isOpen || typeof window === 'undefined') return null;

  return createPortal(
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
                onClick={onClose}
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
                  onClick={onClose}
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
  );
};
