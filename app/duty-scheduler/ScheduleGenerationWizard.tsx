import React, { useState, useEffect, useMemo } from 'react';
import { 
  BranchZone, 
  Branch, 
  PharmacistSchedulingProfile, 
  DutySchedulerLeaveRecord,
  BranchShiftType,
  DutySchedulerSettings,
  SchedulingPeriodAdjustments
} from '../../types';
import { 
  computeRequiredCoverage, 
  computePharmacistCapacity, 
  CapacityCoverageSummary,
  RequiredCoverageSummary,
  getCalendarDatesInRange,
  getSafeDateDetails
} from '../../services/schedulingEngine';
import { dutySchedulerService } from '../../services/dutySchedulerService';
import { 
  Calendar, 
  CalendarOff,
  Users, 
  AlertTriangle, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Layers, 
  MapPin, 
  Sun, 
  Sunset, 
  Moon, 
  X, 
  Loader2, 
  CheckCircle2,
  Info,
  Sliders,
  Sparkles,
  Coffee,
  ShieldAlert,
  ShieldCheck,
  BriefcaseMedical
} from 'lucide-react';

export interface ScheduleGenerationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  zones: BranchZone[];
  branches: Branch[];
  profiles: PharmacistSchedulingProfile[];
  allEmployees: any[];
  shiftRequirements: BranchShiftType[];
  settings: DutySchedulerSettings | null;
  onGenerate: (params: {
    name: string;
    zoneId: string;
    periodStart: string;
    periodEnd: string;
    useContinuity: boolean;
    periodAdjustments: SchedulingPeriodAdjustments;
  }) => Promise<void>;
  isGenerating: boolean;
}

interface StagedLeaveEntry {
  tempId: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  notes?: string;
}

interface StagedSpecialRestRequest {
  tempId: string;
  employeeId: string;
  employeeName: string;
  dates: string[];
  notes?: string;
}

export const ScheduleGenerationWizard: React.FC<ScheduleGenerationWizardProps> = ({
  isOpen,
  onClose,
  zones,
  branches,
  profiles,
  allEmployees,
  shiftRequirements,
  settings,
  onGenerate,
  isGenerating
}) => {
  // Current Wizard Step: 1, 2, 3, 4, 5, 6
  const [step, setStep] = useState<number>(1);
  const [modalError, setModalError] = useState<string | null>(null);

  // Step 1: Period & Scope
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [generateZoneId, setGenerateZoneId] = useState<string>('ALL');
  const [scheduleName, setScheduleName] = useState<string>('');
  const [useContinuity, setUseContinuity] = useState<boolean>(true);

  // Step 2: Annual Leave Fast-Entry
  const [stagedLeaves, setStagedLeaves] = useState<StagedLeaveEntry[]>([]);
  const [existingLeaves, setExistingLeaves] = useState<DutySchedulerLeaveRecord[]>([]);
  const [isSavingLeaves, setIsSavingLeaves] = useState<boolean>(false);
  const [selectedPharmacistId, setSelectedPharmacistId] = useState<string>('');
  const [leaveStartInput, setLeaveStartInput] = useState<string>('');
  const [leaveEndInput, setLeaveEndInput] = useState<string>('');
  const [leaveNotesInput, setLeaveNotesInput] = useState<string>('Annual Leave');
  const [leaveFormError, setLeaveFormError] = useState<string | null>(null);
  const [leaveSuccessMessage, setLeaveSuccessMessage] = useState<string | null>(null);

  // Step 3: Special Request for Employee (Weekly Rest / Off-Days)
  const [stagedSpecialRequests, setStagedSpecialRequests] = useState<StagedSpecialRestRequest[]>([]);
  const [specialReqPharmacistId, setSpecialReqPharmacistId] = useState<string>('');
  const [specialReqDateInput, setSpecialReqDateInput] = useState<string>('');
  const [specialReqSelectedDates, setSpecialReqSelectedDates] = useState<string[]>([]);
  const [specialReqNotesInput, setSpecialReqNotesInput] = useState<string>('Weekly Rest Request');
  const [specialReqError, setSpecialReqError] = useState<string | null>(null);
  const [specialReqSuccess, setSpecialReqSuccess] = useState<string | null>(null);

  // Step 4: Capacity Adjustments (Surplus Absorption)
  const [extraRestDays, setExtraRestDays] = useState<Record<string, number>>({});

  // Step 5: Weekend (Friday/Saturday) Distribution (3-5 pharmacists)
  const [selectedWeekendPharmacistIds, setSelectedWeekendPharmacistIds] = useState<string[]>([]);

  // Compliance Guardrails (NHRA & Work Permit Overrides)
  const [complianceOverride, setComplianceOverride] = useState<boolean>(false);

  // Initialize dates and defaults on modal open
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const firstDay = `${y}-${m}-01`;
      const daysInMonth = new Date(y, now.getMonth() + 1, 0).getDate();
      const lastDay = `${y}-${m}-${String(daysInMonth).padStart(2, '0')}`;
      const monthName = now.toLocaleString('default', { month: 'short', year: 'numeric' });

      const defaultZone = zones.length > 0 ? zones[0] : null;
      const defaultZoneId = defaultZone ? defaultZone.id : 'ALL';
      const defaultName = defaultZone ? `${defaultZone.name} Schedule - ${monthName}` : `Duty Schedule - ${monthName}`;

      setPeriodStart(firstDay);
      setPeriodEnd(lastDay);
      setGenerateZoneId(defaultZoneId);
      setScheduleName(defaultName);
      setUseContinuity(true);
      setStep(1);
      setStagedLeaves([]);
      setStagedSpecialRequests([]);
      setSpecialReqSelectedDates([]);
      setSpecialReqDateInput(firstDay);
      setSpecialReqNotesInput('Weekly Rest Request');
      setSpecialReqError(null);
      setSpecialReqSuccess(null);
      setExtraRestDays({});
      setSelectedWeekendPharmacistIds([]);
      setComplianceOverride(false);
      setLeaveStartInput(firstDay);
      setLeaveEndInput(lastDay);

      // Load existing leaves
      loadExistingLeaves();
    }
  }, [isOpen]);

  // Keep default leave & special request dates aligned with period
  useEffect(() => {
    if (periodStart) {
      setLeaveStartInput(periodStart);
      setSpecialReqDateInput(periodStart);
    }
    if (periodEnd) setLeaveEndInput(periodEnd);
  }, [periodStart, periodEnd]);

  const loadExistingLeaves = async () => {
    try {
      const leaves = await dutySchedulerService.getAllLeaveRecords();
      setExistingLeaves(leaves);
    } catch (err) {
      console.error('Failed to load existing leaves:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // In-Scope Calculations (Branches & Pharmacists)
  // ---------------------------------------------------------------------------
  const selectedZone = useMemo(() => {
    return zones.find(z => z.id === generateZoneId);
  }, [zones, generateZoneId]);

  const targetBranches = useMemo(() => {
    if (generateZoneId === 'ALL' || !selectedZone) {
      return branches.filter(b => b.isActive !== false);
    }
    return branches.filter(b => b.isActive !== false && selectedZone.branchIds?.includes(b.id));
  }, [branches, generateZoneId, selectedZone]);

  const targetProfiles = useMemo(() => {
    if (generateZoneId === 'ALL' || !selectedZone) {
      return profiles.filter(p => p.isActive !== false);
    }
    return profiles.filter(p => {
      if (p.isActive === false) return false;
      if (p.zoneId === generateZoneId) return true;
      if (p.secondaryZoneId === generateZoneId && (p.secondaryZoneMaxDays || 0) > 0) return true;
      if (p.primaryBranchId && selectedZone.branchIds?.includes(p.primaryBranchId)) return true;
      return false;
    });
  }, [profiles, generateZoneId, selectedZone]);

  // Active in-scope pharmacist staff list (combining employee records + profiles)
  const inScopeStaff = useMemo(() => {
    const profileEmpIds = new Set(targetProfiles.map(p => p.employeeId));
    // Filter pharmacists from allEmployees who either have matching profiles or match branch
    const staff = allEmployees.filter(e => {
      const isPharmacist = !e.category || e.category.toLowerCase() === 'pharmacist' || profileEmpIds.has(e.id);
      if (!isPharmacist) return false;
      if (generateZoneId === 'ALL' || !selectedZone) return true;
      if (profileEmpIds.has(e.id)) return true;
      if (e.branch_id && selectedZone.branchIds?.includes(e.branch_id)) return true;
      return false;
    });
    return staff;
  }, [allEmployees, targetProfiles, generateZoneId, selectedZone]);

  // Pre-Flight Compliance Audit (NHRA Pharmacist License & Work Permit)
  const complianceAudit = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const targetEnd = periodEnd || todayStr;

    let expiredCount = 0;
    let expiringSoonCount = 0;
    let validCount = 0;

    const auditedStaff = inScopeStaff.map(emp => {
      const nhraNo = emp.salary_matrix?.nhraLicenseNo || emp.nhra_license_no || emp.license;
      const nhraExp = emp.salary_matrix?.nhraExpiryDate || emp.nhra_expiry_date;
      const wpExp = emp.wp_expiry_date || emp.salary_matrix?.wpExpiryDate || emp.salary_matrix?.visaExpiryDate;

      let nhraStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'MISSING' = 'VALID';
      let nhraDetails = '';

      if (!nhraExp && !nhraNo) {
        nhraStatus = 'MISSING';
        nhraDetails = 'No license record';
      } else if (nhraExp && nhraExp < todayStr) {
        nhraStatus = 'EXPIRED';
        nhraDetails = `Expired on ${nhraExp}`;
        expiredCount++;
      } else if (nhraExp && nhraExp <= targetEnd) {
        nhraStatus = 'EXPIRING_SOON';
        nhraDetails = `Expires ${nhraExp}`;
        expiringSoonCount++;
      } else {
        validCount++;
        nhraDetails = nhraExp ? `Valid until ${nhraExp}` : 'Active';
      }

      let wpStatus: 'VALID' | 'EXPIRED' = 'VALID';
      if (wpExp && wpExp < todayStr) {
        wpStatus = 'EXPIRED';
      }

      return {
        id: emp.id,
        name: emp.full_name || emp.name,
        code: emp.code,
        nhraNo,
        nhraExp,
        nhraStatus,
        nhraDetails,
        wpExp,
        wpStatus
      };
    });

    return {
      auditedStaff,
      expiredCount,
      expiringSoonCount,
      validCount,
      hasViolations: expiredCount > 0
    };
  }, [inScopeStaff, periodEnd]);

  // Generate calendar dates array in YYYY-MM-DD
  const periodDates = useMemo(() => {
    if (!periodStart || !periodEnd || periodStart > periodEnd) return [];
    return getCalendarDatesInRange(periodStart, periodEnd);
  }, [periodStart, periodEnd]);

  // Count Fridays, Saturdays, and Weekend Days in period
  const weekendDayCounts = useMemo(() => {
    let fridays = 0;
    let saturdays = 0;
    for (const d of periodDates) {
      const details = getSafeDateDetails(d);
      if (details.dayOfWeek === 5) fridays++;
      if (details.dayOfWeek === 6) saturdays++;
    }
    return {
      fridays,
      saturdays,
      total: fridays + saturdays
    };
  }, [periodDates]);

  // Combined approved leaves (existing + staged)
  const combinedLeaves = useMemo(() => {
    const stagedMapped: DutySchedulerLeaveRecord[] = stagedLeaves.map(sl => ({
      id: sl.tempId,
      employeeId: sl.employeeId,
      leaveType: 'ANNUAL',
      startDate: sl.startDate,
      endDate: sl.endDate,
      status: 'APPROVED',
      notes: sl.notes
    }));
    const merged = [...existingLeaves];
    for (const sm of stagedMapped) {
      const smId = String(sm.employeeId).trim().toLowerCase();
      const smStart = (sm.startDate || '').split('T')[0];
      if (!merged.some(m => {
        const mId = String(m.employeeId || (m as any).employee_id || '').trim().toLowerCase();
        const mStart = (m.startDate || (m as any).start_date || '').split('T')[0];
        return mId === smId && mStart === smStart;
      })) {
        merged.push(sm);
      }
    }
    return merged;
  }, [existingLeaves, stagedLeaves]);

  // Step 3 Capacity and Coverage Summary
  const capacitySummary: CapacityCoverageSummary | null = useMemo(() => {
    if (periodDates.length === 0 || targetBranches.length === 0) return null;
    const reqCoverage = computeRequiredCoverage(periodDates, targetBranches, shiftRequirements);
    const defaultRest = settings?.defaultRestDaysPerPeriod ?? 4;
    return computePharmacistCapacity(
      periodDates,
      inScopeStaff,
      targetProfiles,
      combinedLeaves,
      reqCoverage,
      generateZoneId !== 'ALL' ? generateZoneId : undefined,
      defaultRest,
      extraRestDays
    );
  }, [periodDates, targetBranches, shiftRequirements, inScopeStaff, targetProfiles, combinedLeaves, generateZoneId, settings, extraRestDays]);

  // Set default pharmacist for Step 2 fast-entry & Step 3 special requests
  useEffect(() => {
    if (inScopeStaff.length > 0) {
      if (!selectedPharmacistId) setSelectedPharmacistId(inScopeStaff[0].id);
      if (!specialReqPharmacistId) setSpecialReqPharmacistId(inScopeStaff[0].id);
    }
  }, [inScopeStaff, selectedPharmacistId, specialReqPharmacistId]);

  const getFormattedDoctorName = (empId: string) => {
    const s = inScopeStaff.find(staff => staff.id === empId);
    const raw = s ? (s.full_name || s.name || 'Pharmacist') : 'Pharmacist';
    const clean = raw.replace(/^dr[\.\s]+/i, '').trim().toUpperCase();
    return `DR. ${clean}`;
  };

  // Pharmacists eligible for weekend distribution (excluding anyone with approved leave in this period)
  const availableStaffForWeekend = useMemo(() => {
    if (!capacitySummary) return inScopeStaff;
    const excludedIds = new Set(capacitySummary.excludedLeavePharmacists.map(e => e.employeeId));
    return inScopeStaff.filter(s => !excludedIds.has(s.id));
  }, [inScopeStaff, capacitySummary]);

  // Clean up weekend team selection if any selected pharmacist is placed on leave
  useEffect(() => {
    if (capacitySummary?.excludedLeavePharmacists.length) {
      const excludedIds = new Set(capacitySummary.excludedLeavePharmacists.map(e => e.employeeId));
      setSelectedWeekendPharmacistIds(prev => prev.filter(id => !excludedIds.has(id)));
    }
  }, [capacitySummary?.excludedLeavePharmacists]);

  // Step 5: Alternating Weekend Schedule Preview (Rule 3)
  const weekendAlternationSchedule = useMemo(() => {
    if (selectedWeekendPharmacistIds.length < 2 || periodDates.length === 0) return [];

    let currentWIdx = 0;
    let lastSeenDow: number | null = null;
    const weekendMap = new Map<number, { fridayDate?: string; saturdayDate?: string }>();

    for (const dStr of periodDates) {
      const details = getSafeDateDetails(dStr);
      if (details.dayOfWeek === 5) { // Friday
        if (lastSeenDow !== null) {
          currentWIdx++;
        }
        if (!weekendMap.has(currentWIdx)) {
          weekendMap.set(currentWIdx, {});
        }
        weekendMap.get(currentWIdx)!.fridayDate = dStr;
        lastSeenDow = 5;
      } else if (details.dayOfWeek === 6) { // Saturday
        if (!weekendMap.has(currentWIdx)) {
          weekendMap.set(currentWIdx, {});
        }
        weekendMap.get(currentWIdx)!.saturdayDate = dStr;
        lastSeenDow = 6;
      }
    }

    const pairs: Array<{
      weekendIndex: number;
      fridayDate?: string;
      saturdayDate?: string;
      fridayOffStaff: string[];
      saturdayOffStaff: string[];
    }> = [];

    for (const [wIdx, wDates] of weekendMap.entries()) {
      const fridayOffStaff: string[] = [];
      const saturdayOffStaff: string[] = [];

      selectedWeekendPharmacistIds.forEach((empId, idx) => {
        const isFridayOff = (idx + wIdx) % 2 === 0;
        const name = getFormattedDoctorName(empId);
        if (isFridayOff) {
          fridayOffStaff.push(name);
        } else {
          saturdayOffStaff.push(name);
        }
      });

      pairs.push({
        weekendIndex: wIdx,
        fridayDate: wDates.fridayDate,
        saturdayDate: wDates.saturdayDate,
        fridayOffStaff,
        saturdayOffStaff
      });
    }

    return pairs;
  }, [selectedWeekendPharmacistIds, periodDates, inScopeStaff]);

  if (!isOpen) return null;

  // ---------------------------------------------------------------------------
  // Step Handlers
  // ---------------------------------------------------------------------------

  // Handle Step 1 -> Step 2
  const handleProceedToLeave = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setLeaveFormError(null);
    setLeaveSuccessMessage(null);
    if (!periodStart || !periodEnd) {
      setModalError('Please define a valid start and end date.');
      return;
    }
    if (periodStart > periodEnd) {
      setModalError('Start date must be before or equal to end date.');
      return;
    }
    setLeaveStartInput(periodStart);
    setLeaveEndInput(periodEnd);
    if (inScopeStaff.length > 0 && (!selectedPharmacistId || !inScopeStaff.some(s => s.id === selectedPharmacistId))) {
      setSelectedPharmacistId(inScopeStaff[0].id);
    }
    setStep(2);
  };

  // Step 2: Add Staged Leave Entry
  const handleAddStagedLeave = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setLeaveFormError(null);
    setLeaveSuccessMessage(null);

    const effPharmacistId = selectedPharmacistId || (inScopeStaff.length > 0 ? inScopeStaff[0].id : '');

    if (!effPharmacistId) {
      setLeaveFormError('Please select a pharmacist.');
      return;
    }
    if (!leaveStartInput || !leaveEndInput) {
      setLeaveFormError('Please specify start and end dates for the leave.');
      return;
    }
    if (leaveStartInput > leaveEndInput) {
      setLeaveFormError('Leave start date must be before or equal to leave end date.');
      return;
    }

    const pharmacist = inScopeStaff.find(s => s.id === effPharmacistId);
    const pharmacistName = pharmacist ? (pharmacist.full_name || pharmacist.name) : 'Pharmacist';

    const newEntry: StagedLeaveEntry = {
      tempId: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      employeeId: effPharmacistId,
      employeeName: pharmacistName,
      startDate: leaveStartInput,
      endDate: leaveEndInput,
      notes: leaveNotesInput || 'Annual Leave'
    };

    setStagedLeaves(prev => [...prev, newEntry]);
    setLeaveSuccessMessage(`Added leave for ${pharmacistName} (${leaveStartInput} → ${leaveEndInput})`);
    setTimeout(() => {
      setLeaveSuccessMessage(null);
    }, 4000);
  };

  const handleRemoveStagedLeave = (tempId: string) => {
    setStagedLeaves(prev => prev.filter(l => l.tempId !== tempId));
  };

  // Helper to inspect leave status for any staff member in the current period
  const getStaffLeaveInfo = (staffId: string) => {
    const staffMember = inScopeStaff.find(s => s.id === staffId);
    const candidateIds = [
      staffId,
      staffMember?.employeeId,
      (staffMember as any)?.employee_id,
      staffMember?.pharmacist_id,
      staffMember?.code
    ].filter(Boolean).map(x => String(x).trim().toLowerCase());

    const staged = stagedLeaves.find(sl => {
      const sEmpId = String(sl.employeeId).trim().toLowerCase();
      return candidateIds.includes(sEmpId);
    });

    if (staged) {
      const sDate = (staged.startDate || '').split('T')[0];
      const eDate = (staged.endDate || '').split('T')[0];
      const isFull = sDate <= periodStart && eDate >= periodEnd;
      return {
        isOnLeave: true,
        isFullPeriod: isFull,
        startDate: sDate,
        endDate: eDate,
        notes: staged.notes,
        isStaged: true,
        leaveId: staged.tempId
      };
    }

    const existing = existingLeaves.find(l => {
      const leaveEmpId = String(l.employeeId || (l as any).employee_id || '').trim().toLowerCase();
      if (!candidateIds.includes(leaveEmpId)) return false;
      const statusUpper = String(l.status || 'APPROVED').trim().toUpperCase();
      if (statusUpper === 'REJECTED' || statusUpper === 'CANCELLED') return false;
      const sDate = String(l.startDate || (l as any).start_date || '').split('T')[0];
      const eDate = String(l.endDate || (l as any).end_date || '').split('T')[0];
      return sDate <= periodEnd && eDate >= periodStart;
    });

    if (existing) {
      const sDate = String(existing.startDate || (existing as any).start_date || '').split('T')[0];
      const eDate = String(existing.endDate || (existing as any).end_date || '').split('T')[0];
      const isFull = sDate <= periodStart && eDate >= periodEnd;
      return {
        isOnLeave: true,
        isFullPeriod: isFull,
        startDate: sDate,
        endDate: eDate,
        notes: existing.notes || existing.leaveType,
        isStaged: false,
        leaveId: existing.id
      };
    }

    return { isOnLeave: false };
  };

  // 1-Click Toggle: Mark/Unmark Pharmacist as Full-Period Monthly Leave
  const handleToggleMonthlyLeave = (staffMember: any) => {
    const info = getStaffLeaveInfo(staffMember.id);
    const candidateIds = [
      staffMember.id,
      staffMember.employeeId,
      staffMember.employee_id,
      staffMember.pharmacist_id,
      staffMember.code
    ].filter(Boolean).map(x => String(x).trim().toLowerCase());

    if (info.isOnLeave) {
      // Unmark / Reactivate in pool
      if (info.isStaged) {
        setStagedLeaves(prev => prev.filter(sl => {
          const sEmpId = String(sl.employeeId).trim().toLowerCase();
          return sl.tempId !== info.leaveId && !candidateIds.includes(sEmpId);
        }));
      } else {
        setExistingLeaves(prev => prev.filter(l => {
          const lEmpId = String(l.employeeId || (l as any).employee_id || '').trim().toLowerCase();
          return l.id !== info.leaveId && !candidateIds.includes(lEmpId);
        }));
        if (info.leaveId) {
          dutySchedulerService.deleteLeaveRecord(info.leaveId).catch(err => console.error('Failed to delete leave record:', err));
        }
      }
    } else {
      // Mark as on Full Monthly Leave for the scheduling period!
      const pharmacistName = staffMember.full_name || staffMember.name || 'Pharmacist';
      const newEntry: StagedLeaveEntry = {
        tempId: `staged-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        employeeId: staffMember.id,
        employeeName: pharmacistName,
        startDate: periodStart,
        endDate: periodEnd,
        notes: 'Full Month Leave'
      };
      setStagedLeaves(prev => [...prev, newEntry]);
    }
  };

  // Step 2 -> Step 3: Save staged leaves to duty_scheduler_leave_records & advance
  const handleSaveAndProceedToCapacity = async () => {
    setModalError(null);
    if (stagedLeaves.length > 0) {
      setIsSavingLeaves(true);
      const recordsToInsert = stagedLeaves.map(sl => ({
        employeeId: sl.employeeId,
        leaveType: 'ANNUAL' as const,
        startDate: sl.startDate,
        endDate: sl.endDate,
        status: 'APPROVED' as const,
        notes: sl.notes || 'Captured via Schedule Generation Wizard'
      }));

      // Immediately merge into existingLeaves in-memory so capacity calculation ALWAYS has them!
      setExistingLeaves(prev => {
        const next = [...prev];
        for (const r of recordsToInsert) {
          const rId = String(r.employeeId).trim().toLowerCase();
          const rStart = r.startDate.split('T')[0];
          const exists = next.some(n => {
            const nId = String(n.employeeId || (n as any).employee_id || '').trim().toLowerCase();
            const nStart = (n.startDate || (n as any).start_date || '').split('T')[0];
            return nId === rId && nStart === rStart;
          });
          if (!exists) {
            next.push({
              id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              ...r
            } as DutySchedulerLeaveRecord);
          }
        }
        return next;
      });

      // Then attempt Supabase persistence in the background/gracefully
      try {
        const saved = await dutySchedulerService.createLeaveRecords(recordsToInsert);
        if (saved && saved.length > 0) {
          try {
            const refreshed = await dutySchedulerService.getAllLeaveRecords();
            if (refreshed && refreshed.length > 0) {
              setExistingLeaves(refreshed);
            }
          } catch {
            // Keep local merge
          }
        }
      } catch (err: any) {
        console.warn('Could not persist leave records to Supabase, continuing with in-memory session:', err);
      } finally {
        setIsSavingLeaves(false);
      }
      setStagedLeaves([]);
    }
    setStep(3);
  };

  // Step 3: Special Request Handlers
  const handleToggleSpecialDate = (dateStr: string) => {
    setSpecialReqError(null);
    setSpecialReqSelectedDates(prev => {
      if (prev.includes(dateStr)) {
        return prev.filter(d => d !== dateStr);
      } else {
        return [...prev, dateStr].sort();
      }
    });
  };

  const handleAddSingleDateToSelection = () => {
    if (!specialReqDateInput) return;
    if (specialReqDateInput < periodStart || specialReqDateInput > periodEnd) {
      setSpecialReqError(`Date must fall within the selected period (${periodStart} → ${periodEnd}).`);
      return;
    }
    setSpecialReqError(null);
    if (!specialReqSelectedDates.includes(specialReqDateInput)) {
      setSpecialReqSelectedDates(prev => [...prev, specialReqDateInput].sort());
    }
  };

  const handleAddSpecialRequest = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSpecialReqError(null);
    setSpecialReqSuccess(null);

    const effPharmacistId = specialReqPharmacistId || (inScopeStaff.length > 0 ? inScopeStaff[0].id : '');
    if (!effPharmacistId) {
      setSpecialReqError('Please select a pharmacist.');
      return;
    }

    let finalDates = [...specialReqSelectedDates];
    if (finalDates.length === 0 && specialReqDateInput) {
      if (specialReqDateInput >= periodStart && specialReqDateInput <= periodEnd) {
        finalDates.push(specialReqDateInput);
      }
    }

    if (finalDates.length === 0) {
      setSpecialReqError('Please select at least one requested off-day date.');
      return;
    }

    finalDates = Array.from(new Set(finalDates)).sort();
    const docName = getFormattedDoctorName(effPharmacistId);

    const existingIdx = stagedSpecialRequests.findIndex(r => r.employeeId === effPharmacistId);
    if (existingIdx >= 0) {
      setStagedSpecialRequests(prev => prev.map((item, idx) => {
        if (idx !== existingIdx) return item;
        const mergedDates = Array.from(new Set([...item.dates, ...finalDates])).sort();
        return {
          ...item,
          dates: mergedDates,
          notes: specialReqNotesInput || item.notes
        };
      }));
      setSpecialReqSuccess(`Updated off-days for ${docName} (${finalDates.length} date(s) added)`);
    } else {
      const newEntry: StagedSpecialRestRequest = {
        tempId: `sreq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        employeeId: effPharmacistId,
        employeeName: docName,
        dates: finalDates,
        notes: specialReqNotesInput || 'Weekly Rest Request'
      };
      setStagedSpecialRequests(prev => [...prev, newEntry]);
      setSpecialReqSuccess(`Added special request for ${docName} (${finalDates.length} off-day(s) specified)`);
    }

    setSpecialReqSelectedDates([]);
    setTimeout(() => setSpecialReqSuccess(null), 4000);
  };

  const handleRemoveSpecialRequest = (tempId: string) => {
    setStagedSpecialRequests(prev => prev.filter(r => r.tempId !== tempId));
  };

  const handleRemoveSingleDateFromRequest = (tempId: string, dateToRemove: string) => {
    setStagedSpecialRequests(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      return {
        ...item,
        dates: item.dates.filter(d => d !== dateToRemove)
      };
    }).filter(item => item.dates.length > 0));
  };

  // Step 4: Adjust Extra Rest Days per pharmacist
  const handleAdjustExtraRest = (employeeId: string, delta: number) => {
    setExtraRestDays(prev => {
      const current = prev[employeeId] || 0;
      const next = Math.max(0, current + delta);
      const updated = { ...prev };
      if (next === 0) {
        delete updated[employeeId];
      } else {
        updated[employeeId] = next;
      }
      return updated;
    });
  };

  // Step 4: Auto-distribute surplus shifts evenly across active pharmacists
  const handleAutoDistributeSurplus = () => {
    if (!capacitySummary || capacitySummary.surplusCount <= 0 || capacitySummary.pharmacistDetails.length === 0) return;
    let remaining = capacitySummary.surplusCount;
    const eligiblePharmacists = capacitySummary.pharmacistDetails;
    
    setExtraRestDays(prev => {
      const updated = { ...prev };
      while (remaining > 0) {
        for (const p of eligiblePharmacists) {
          if (remaining <= 0) break;
          updated[p.employeeId] = (updated[p.employeeId] || 0) + 1;
          remaining--;
        }
      }
      return updated;
    });
  };

  // Step 4: Reset all assigned extra rest days
  const handleResetExtraRest = () => {
    setExtraRestDays({});
  };

  // Step 5: Toggle Weekend Pharmacist Selection (3-5 required)
  const handleToggleWeekendPharmacist = (empId: string) => {
    setSelectedWeekendPharmacistIds(prev => {
      if (prev.includes(empId)) {
        return prev.filter(id => id !== empId);
      } else {
        if (prev.length >= 5) {
          return prev; // Maximum 5 names
        }
        return [...prev, empId];
      }
    });
  };

  // Step 6: Final Submission to Solver
  const handleFinalGenerate = async () => {
    setModalError(null);
    const selectedZoneObj = zones.find(z => z.id === generateZoneId);
    const zoneTitle = selectedZoneObj ? selectedZoneObj.name : 'All Zones';
    const finalScheduleName = scheduleName.trim() || `${zoneTitle} Schedule (${periodStart} → ${periodEnd})`;

    const periodAdjustments: SchedulingPeriodAdjustments = {
      extraRestDays: Object.keys(extraRestDays).length > 0 ? extraRestDays : undefined,
      weekendPharmacistIds: selectedWeekendPharmacistIds.length > 0 ? selectedWeekendPharmacistIds : undefined,
      leaveRecords: combinedLeaves.length > 0 ? combinedLeaves : undefined,
      specialRestRequests: stagedSpecialRequests.length > 0 ? stagedSpecialRequests.map(sr => ({
        employeeId: sr.employeeId,
        employeeName: sr.employeeName,
        dates: sr.dates,
        notes: sr.notes
      })) : undefined
    };

    try {
      await onGenerate({
        name: finalScheduleName,
        zoneId: generateZoneId,
        periodStart,
        periodEnd,
        useContinuity,
        periodAdjustments
      });
    } catch (err: any) {
      console.error('Error in generation wizard:', err);
      setModalError(err.message || 'Failed to generate schedule.');
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl md:max-w-6xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-100">
        
        {/* Header with Title and Close Button */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/75">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand/10 text-brand">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800 leading-tight">Schedule Generation Wizard</h3>
              <p className="text-xs text-slate-500 font-medium">Zero-Gap Coverage & Capacity Planning</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            disabled={isGenerating || isSavingLeaves}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Period' },
              { num: 2, label: 'Annual Leave' },
              { num: 3, label: 'Special Requests' },
              { num: 4, label: 'Capacity' },
              { num: 5, label: 'Weekend' },
              { num: 6, label: 'Generate' }
            ].map((s, idx, arr) => (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === s.num 
                      ? 'bg-brand text-white ring-4 ring-brand/15 shadow-sm' 
                      : step > s.num 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-slate-100 text-slate-400 font-medium'
                  }`}>
                    {step > s.num ? <CheckCircle2 className="h-4 w-4" /> : s.num}
                  </div>
                  <span className={`text-xs hidden sm:inline font-semibold ${
                    step === s.num ? 'text-slate-800' : step > s.num ? 'text-emerald-700' : 'text-slate-400'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {idx < arr.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 transition-colors ${
                    step > s.num ? 'bg-emerald-400' : 'bg-slate-100'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Error Banner */}
        {modalError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2 animate-shake">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{modalError}</div>
          </div>
        )}

        {/* Body Content by Step */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* ================================================================= */}
          {/* STEP 1: Period Selection & Zone Scope                             */}
          {/* ================================================================= */}
          {step === 1 && (
            <form id="step-1-form" onSubmit={handleProceedToLeave} className="space-y-4">
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  Select the target period and zone. The wizard will evaluate branch shift requirements and verify pharmacist staffing capacity to ensure <strong className="text-blue-950 font-bold">zero coverage gaps</strong> before generation runs.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Period Start <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={e => setPeriodStart(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Period End <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={e => setPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  <Layers className="h-3.5 w-3.5 text-brand" />
                  <span>Target Scheduling Zone</span>
                  <span className="text-red-500">*</span>
                </label>
                <select
                  value={generateZoneId}
                  onChange={e => {
                    const zid = e.target.value;
                    setGenerateZoneId(zid);
                    const z = zones.find(item => item.id === zid);
                    const now = new Date();
                    const monthName = now.toLocaleString('default', { month: 'short', year: 'numeric' });
                    if (z) {
                      setScheduleName(`${z.name} Schedule - ${monthName}`);
                    } else {
                      setScheduleName(`All Zones Schedule - ${monthName}`);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium focus:ring-2 focus:ring-brand"
                >
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.code || 'Zone'}) — {z.branchIds?.length || 0} Pharmacies
                    </option>
                  ))}
                  <option value="ALL">All Zones (Global Schedule)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Schedule Title / Label
                </label>
                <input
                  type="text"
                  value={scheduleName}
                  onChange={e => setScheduleName(e.target.value)}
                  placeholder="e.g. Zone 1 Schedule - Oct 2026"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand font-medium"
                />
              </div>

              {/* Live Scope Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 space-y-2">
                <div className="flex items-center justify-between font-semibold text-slate-800">
                  <span className="flex items-center gap-1.5 text-brand">
                    <MapPin className="h-3.5 w-3.5" />
                    {selectedZone ? selectedZone.name : 'All Zones'} Scope
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand/10 text-brand">
                    {targetBranches.length} Branches • {inScopeStaff.length} Pharmacists
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-semibold text-[11px] border border-blue-200">
                    {targetProfiles.filter(p => p.roleType === 'FIXED').length} Fixed Staff
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-semibold text-[11px] border border-emerald-200">
                    {targetProfiles.filter(p => p.roleType === 'RELIEF').length} Relief Staff
                  </span>
                  {selectedZone && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 font-semibold text-[11px] border border-purple-200">
                      {targetProfiles.filter(p => p.secondaryZoneId === selectedZone.id).length} Secondary Support
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-continuity-wiz"
                  checked={useContinuity}
                  onChange={e => setUseContinuity(e.target.checked)}
                  className="rounded text-brand focus:ring-brand"
                />
                <label htmlFor="chk-continuity-wiz" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Maintain rolling workload & streak continuity from previous schedule
                </label>
              </div>
            </form>
          )}

          {/* ================================================================= */}
          {/* STEP 2: Annual Leave Capture for This Period                      */}
          {/* ================================================================= */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-sm text-amber-950">
                    Step 2 — Designate Annual & Monthly Leaves
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Pharmacists designated as on <strong className="font-bold underline decoration-amber-500">Monthly Leave</strong> are immediately and completely excluded from the active <code className="font-bold font-mono">Pharmacist Pool</code> and from aggregate capacity planning and hour requirements.
                  </p>
                </div>
              </div>

              {/* Dynamic Live Pool Status Header */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-brand" />
                    <span>Current Pharmacist Pool Count:</span>
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                    Live update — Designating any pharmacist as on leave immediately removes them from the active pool and shift requirements
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs flex items-center gap-1.5 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                    <span>{capacitySummary?.availablePharmacistsCount ?? inScopeStaff.length} Active in Pool</span>
                  </span>
                  {(capacitySummary?.onLeavePharmacistsCount ?? 0) > 0 && (
                    <span className="px-3 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs flex items-center gap-1.5 shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                      <span>{capacitySummary?.onLeavePharmacistsCount} On Leave (Excluded)</span>
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-lg bg-slate-200/80 text-slate-700 font-medium text-xs">
                    Total: {inScopeStaff.length}
                  </span>
                </div>
              </div>

              {/* Pharmacists Roster & 1-Click Monthly Leave Selection */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-brand" />
                    <span className="font-bold text-xs text-slate-800">
                      In-Scope Pharmacists Roster ({inScopeStaff.length} Staff)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Click "Monthly Leave" to immediately exclude a pharmacist from the pool
                  </span>
                </div>

                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {inScopeStaff.map(s => {
                    const leaveInfo = getStaffLeaveInfo(s.id);
                    const profile = targetProfiles.find(p => p.employeeId === s.id);
                    return (
                      <div 
                        key={s.id} 
                        className={`p-3 flex items-center justify-between transition-colors ${
                          leaveInfo.isOnLeave ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            leaveInfo.isOnLeave ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-brand/10 text-brand'
                          }`}>
                            {leaveInfo.isOnLeave ? (
                              <CalendarOff className="h-4 w-4 text-amber-700" />
                            ) : (
                              (s.code || (s.full_name || s.name || 'P')[0])
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-800">{s.full_name || s.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({s.code || s.id.substring(0, 6)})</span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                profile?.roleType === 'RELIEF' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {profile?.roleType || 'Pharmacist'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                              {leaveInfo.isOnLeave ? (
                                <span className="text-amber-800 font-bold flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse"></span>
                                  {leaveInfo.isFullPeriod ? 'Monthly Leave' : 'Custom Leave'} ({leaveInfo.startDate} → {leaveInfo.endDate})
                                  <span className="text-amber-600 font-normal">({leaveInfo.notes || 'Excluded from Staff Pool'})</span>
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-medium flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                                  Active in Staff Pool
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div>
                          {leaveInfo.isOnLeave ? (
                            <button
                              type="button"
                              onClick={() => handleToggleMonthlyLeave(s)}
                              className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                              title="Cancel leave and return pharmacist to active pool"
                            >
                              <X className="h-3.5 w-3.5 text-amber-700" />
                              <span>Cancel Leave (Reactivate)</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleMonthlyLeave(s)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
                              title="Mark pharmacist as on monthly leave and exclude completely from capacity"
                            >
                              <CalendarOff className="h-3.5 w-3.5 shrink-0" />
                              <span>Monthly Leave (Exclude)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Optional Custom Date Range Fast-Entry Form */}
              <form onSubmit={handleAddStagedLeave} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="font-semibold text-xs text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5 text-brand" />
                    Record Custom Leave for Specific Date Range
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">For partial leaves rather than full month</span>
                </div>

                {leaveFormError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>{leaveFormError}</span>
                  </div>
                )}

                {leaveSuccessMessage && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{leaveSuccessMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Pharmacist</label>
                    <select
                      value={selectedPharmacistId || (inScopeStaff[0]?.id || '')}
                      onChange={e => setSelectedPharmacistId(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium focus:ring-brand"
                    >
                      {inScopeStaff.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.full_name || s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={leaveStartInput}
                      onChange={e => setLeaveStartInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium focus:ring-brand"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">End Date</label>
                    <input
                      type="date"
                      value={leaveEndInput}
                      onChange={e => setLeaveEndInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium focus:ring-brand"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  <input
                    type="text"
                    value={leaveNotesInput}
                    onChange={e => setLeaveNotesInput(e.target.value)}
                    placeholder="Notes (e.g., Annual Leave, Family Leave)"
                    className="flex-1 min-w-[180px] px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-brand"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const effId = selectedPharmacistId || (inScopeStaff.length > 0 ? inScopeStaff[0].id : '');
                        if (!effId) return;
                        const s = inScopeStaff.find(st => st.id === effId);
                        if (s) handleToggleMonthlyLeave(s);
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                      title="Immediately exclude selected pharmacist for full month"
                    >
                      <CalendarOff className="h-3.5 w-3.5 shrink-0" />
                      <span>Exclude for Full Month</span>
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-brand text-white rounded-lg text-xs font-semibold hover:bg-brand-dark transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Custom Dates</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Staged & Custom Leaves List for this Generation Run */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarOff className="h-4 w-4 text-amber-600" />
                    <span className="font-bold text-xs text-slate-800">
                      Staged Leaves to Apply in this Run ({stagedLeaves.length})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {stagedLeaves.length === 0 
                      ? 'No leaves staged yet for this run' 
                      : 'These pharmacists will be excluded from capacity calculation'}
                  </span>
                </div>

                {stagedLeaves.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No custom or monthly leaves staged yet. Use 1-click "Monthly Leave" above or the date-range form to add leaves.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                    {stagedLeaves.map(leave => {
                      const days = Math.round(
                        (new Date(leave.endDate + 'T00:00:00Z').getTime() - new Date(leave.startDate + 'T00:00:00Z').getTime()) / 86400000
                      ) + 1;
                      const isFull = leave.startDate <= periodStart && leave.endDate >= periodEnd;
                      return (
                        <div key={leave.tempId} className="p-3 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                              <CalendarOff className="h-3.5 w-3.5 text-amber-700" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-800">{leave.employeeName}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                  isFull ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {isFull ? 'Full Month' : `${days} Days`}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 font-mono">
                                <span>{leave.startDate} → {leave.endDate}</span>
                                {leave.notes && <span className="text-slate-400 font-sans">({leave.notes})</span>}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveStagedLeave(leave.tempId)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Remove this staged leave"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 3: Special Request for Employee (Weekly Rest / Off-Days)      */}
          {/* ================================================================= */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Header Info Banner */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 text-xs text-indigo-950 flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-indigo-900 uppercase tracking-wider">
                    Special Request for Employee — Guaranteed Off-Days
                  </h4>
                  <p className="text-[11px] text-indigo-800 leading-relaxed mt-0.5">
                    Capture employee-specific weekly rest days or requested off-days for this period. The scheduling engine strictly guarantees that chosen employees will NOT be assigned to shifts on these selected dates. You can add special requests for multiple employees.
                  </p>
                </div>
              </div>

              {/* Add Special Request Form */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-brand" />
                    <span className="font-bold text-xs text-slate-800">
                      Configure Special Request for Employee
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Step 3 of 6
                  </span>
                </div>

                {/* Error Banner */}
                {specialReqError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>{specialReqError}</span>
                  </div>
                )}

                {/* Success Banner */}
                {specialReqSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{specialReqSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select Employee */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Select Pharmacist / Employee <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={specialReqPharmacistId || (inScopeStaff.length > 0 ? inScopeStaff[0].id : '')}
                      onChange={e => {
                        setSpecialReqPharmacistId(e.target.value);
                        setSpecialReqError(null);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium focus:ring-2 focus:ring-brand"
                    >
                      {inScopeStaff.map(s => {
                        const existingReq = stagedSpecialRequests.find(r => r.employeeId === s.id);
                        return (
                          <option key={s.id} value={s.id}>
                            {getFormattedDoctorName ? getFormattedDoctorName(s.id) : (s.full_name || s.name)} {existingReq ? `(${existingReq.dates.length} requested days already added)` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Choose the employee who submitted a special day-off request.
                    </p>
                  </div>

                  {/* Date Input with Add Date Button */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Select Date (Within Period) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={specialReqDateInput}
                        min={periodStart}
                        max={periodEnd}
                        onChange={e => setSpecialReqDateInput(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium focus:ring-2 focus:ring-brand"
                      />
                      <button
                        type="button"
                        onClick={handleAddSingleDateToSelection}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-colors shrink-0 flex items-center gap-1"
                        title="Add this date to the selected dates buffer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Date</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Pick a date above or click dates in the interactive period bar below.
                    </p>
                  </div>
                </div>

                {/* Interactive Period Calendar Chips for 1-Click Date Selection */}
                {periodDates.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-brand" />
                        <span>Quick-Select Period Days (Click to toggle requested off-day)</span>
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Fridays & Saturdays highlighted in amber
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                      {periodDates.map(dateStr => {
                        const details = getSafeDateDetails(dateStr);
                        const isWeekend = details.isWeekend;
                        const dayName = details.dayNameShort;
                        const dayOfMonth = details.dayNum;
                        const isSelected = specialReqSelectedDates.includes(dateStr);

                        return (
                          <button
                            key={dateStr}
                            type="button"
                            onClick={() => handleToggleSpecialDate(dateStr)}
                            className={`px-2 py-1.5 rounded-lg border text-center shrink-0 transition-all text-xs font-semibold ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs scale-105 ring-2 ring-indigo-300'
                                : isWeekend
                                  ? 'bg-amber-50/80 text-amber-900 border-amber-200 hover:border-amber-300 hover:bg-amber-100'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                            title={`Toggle ${dateStr} (${dayName})`}
                          >
                            <div className="text-[10px] uppercase font-bold leading-none">{dayName}</div>
                            <div className="text-xs font-extrabold mt-0.5">{dayOfMonth}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selected Dates Buffer */}
                {specialReqSelectedDates.length > 0 && (
                  <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Dates Selected for this Employee ({specialReqSelectedDates.length} Days)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setSpecialReqSelectedDates([])}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold underline"
                      >
                        Clear Selection
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {specialReqSelectedDates.map(d => {
                        const details = getSafeDateDetails(d);
                        const label = `${details.dayNameShort}, ${details.formattedDate}`;
                        return (
                          <span
                            key={d}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-900 font-bold text-xs border border-indigo-200"
                          >
                            <span>{label}</span>
                            <button
                              type="button"
                              onClick={() => handleToggleSpecialDate(d)}
                              className="text-indigo-500 hover:text-indigo-800 ml-0.5"
                              title="Remove date"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Optional Notes & Add Request Button */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-1">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Reason / Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={specialReqNotesInput}
                      onChange={e => setSpecialReqNotesInput(e.target.value)}
                      placeholder="e.g. Weekly Rest Request, Family Event, Exam"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium focus:ring-2 focus:ring-brand"
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={handleAddSpecialRequest}
                      className="w-full py-2 px-4 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Special Request</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Configured Special Requests Roster */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-brand" />
                    <span className="font-bold text-xs text-slate-800">
                      Confirmed Special Requests ({stagedSpecialRequests.length} Employees)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {stagedSpecialRequests.reduce((acc, r) => acc + r.dates.length, 0)} Total Off-Days Reserved
                  </span>
                </div>

                {stagedSpecialRequests.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 space-y-1">
                    <Coffee className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                    <div className="font-bold text-xs text-slate-600">No Special Requests Configured</div>
                    <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                      If any employee requested a specific off-day or weekly rest date, add them using the form above. Otherwise, you can proceed to the next step.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {stagedSpecialRequests.map(item => {
                      return (
                        <div
                          key={item.tempId}
                          className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-slate-800">
                                {item.employeeName}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                {item.dates.length} Off-Day(s) Reserved
                              </span>
                              {item.notes && (
                                <span className="text-[11px] text-slate-400">
                                  ({item.notes})
                                </span>
                              )}
                            </div>

                            {/* Clickable Date Pills with removal */}
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {item.dates.map(dateStr => {
                                const dt = new Date(dateStr + 'T00:00:00Z');
                                const label = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
                                return (
                                  <span
                                    key={dateStr}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-semibold text-[11px] border border-slate-200 group"
                                  >
                                    <span>{label}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSingleDateFromRequest(item.tempId, dateStr)}
                                      className="text-slate-400 hover:text-rose-600 transition-colors"
                                      title={`Remove ${label}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveSpecialRequest(item.tempId)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
                              title="Delete all special requests for this employee"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sm:hidden">Remove</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 4: Pre-Generation Capacity & Coverage Summary                */}
          {/* ================================================================= */}
          {step === 4 && capacitySummary && (
            <div className="space-y-4">
              {/* NHRA & Regulatory Compliance Pre-Flight Check */}
              <div className={`rounded-xl border p-4 transition-all shadow-xs ${
                complianceAudit.hasViolations
                  ? 'border-rose-300 bg-rose-50/70 text-rose-950'
                  : complianceAudit.expiringSoonCount > 0
                  ? 'border-amber-300 bg-amber-50/70 text-amber-950'
                  : 'border-emerald-200 bg-emerald-50/60 text-emerald-950'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {complianceAudit.hasViolations ? (
                      <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-xs uppercase tracking-wider">
                          NHRA Regulatory &amp; License Pre-Flight Audit
                        </h4>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                          complianceAudit.hasViolations
                            ? 'bg-rose-600 text-white'
                            : complianceAudit.expiringSoonCount > 0
                            ? 'bg-amber-600 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}>
                          {complianceAudit.hasViolations ? 'Violations Detected' : complianceAudit.expiringSoonCount > 0 ? 'Expiring Soon' : 'Fully Compliant'}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-80 mt-0.5">
                        {complianceAudit.hasViolations
                          ? `CRITICAL REGULATORY ALERT: ${complianceAudit.expiredCount} pharmacist(s) have EXPIRED NHRA licenses. Under NHRA law, scheduling unlicensed personnel incurs severe financial and operational sanctions.`
                          : complianceAudit.expiringSoonCount > 0
                          ? `Notice: ${complianceAudit.expiringSoonCount} pharmacist(s) hold licenses that will expire during or near the target schedule period.`
                          : `All ${complianceAudit.validCount} in-scope pharmacists hold verified active NHRA licenses and valid legal permits.`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Listing of Expired or Expiring Staff */}
                {(complianceAudit.expiredCount > 0 || complianceAudit.expiringSoonCount > 0) && (
                  <div className="mt-3 pt-3 border-t border-rose-200/60 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                      Flagged Personnel License Status:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {complianceAudit.auditedStaff.filter(s => s.nhraStatus === 'EXPIRED' || s.nhraStatus === 'EXPIRING_SOON').map(s => (
                        <div key={s.id} className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                          s.nhraStatus === 'EXPIRED' ? 'bg-white border-rose-300 text-rose-900' : 'bg-white border-amber-300 text-amber-900'
                        }`}>
                          <div className="min-w-0 pr-2">
                            <span className="font-bold block truncate">{s.name}</span>
                            <span className="text-[10px] opacity-75">{s.nhraDetails}</span>
                          </div>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                            s.nhraStatus === 'EXPIRED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {s.nhraStatus}
                          </span>
                        </div>
                      ))}
                    </div>

                    {complianceAudit.hasViolations && (
                      <label className="flex items-center gap-2 pt-2 cursor-pointer text-xs font-bold text-rose-950">
                        <input
                          type="checkbox"
                          checked={complianceOverride}
                          onChange={e => setComplianceOverride(e.target.checked)}
                          className="h-4 w-4 rounded border-rose-300 text-brand focus:ring-brand"
                        />
                        <span>I acknowledge the NHRA regulatory non-compliance and request a Manager Override to proceed with generation.</span>
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Aggregate Planning Disclaimer Notice */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 flex items-start gap-2">
                <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="text-slate-800">Aggregate Planning Check:</strong> This calculation evaluates total staffing capacity against shift demand. A net surplus does not guarantee every individual branch or shift will be covered due to eligibility restrictions. Authoritative validation occurs during solver execution and will be detailed in the Conflict Report.
                </p>
              </div>

              {/* Coverage & Pharmacist Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Required Coverage Side */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Required Coverage</span>
                    <span className="text-base font-extrabold text-slate-900">
                      {capacitySummary.requiredCoverage.totalRequired} Shifts
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-semibold text-[11px] border border-amber-200">
                      <Sun className="h-3 w-3" />
                      AM: {capacitySummary.requiredCoverage.byShiftType.AM || 0}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-semibold text-[11px] border border-blue-200">
                      <Sunset className="h-3 w-3" />
                      PM: {capacitySummary.requiredCoverage.byShiftType.PM || 0}
                    </span>
                    {capacitySummary.requiredCoverage.hasNightShifts && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 font-semibold text-[11px] border border-indigo-200">
                        <Moon className="h-3 w-3" />
                        Night: {capacitySummary.requiredCoverage.byShiftType.NIGHT || 0}
                      </span>
                    )}
                  </div>
                </div>

                {/* Pharmacist Staffing Side */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Pharmacist Pool</span>
                    <span className="text-base font-extrabold text-slate-900">
                      {capacitySummary.availablePharmacistsCount} Active Staff
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-semibold text-[11px] border border-emerald-200">
                      {capacitySummary.availablePharmacistsCount} Active Available
                    </span>
                    {capacitySummary.onLeavePharmacistsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-semibold text-[11px] border border-amber-200">
                        {capacitySummary.onLeavePharmacistsCount} on Annual Leave (Excluded)
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px] border border-slate-200">
                      {capacitySummary.totalAdjustedCapacity} Capacity Shifts
                    </span>
                  </div>
                </div>
              </div>

              {/* Plain Language Summary & Surplus/Deficit Banner */}
              {capacitySummary.isDeficit ? (
                <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 text-red-950 space-y-2.5 animate-pulse-subtle">
                  <div className="flex items-center gap-2 font-bold text-sm text-red-700">
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                    <span>Critical Deficit of {capacitySummary.deficitCount} Shifts</span>
                  </div>
                  <p className="text-xs text-red-800 leading-relaxed font-medium">
                    Required shifts: <strong className="font-extrabold text-red-950">{capacitySummary.requiredCoverage.totalRequired} shifts</strong>. Available capacity of {capacitySummary.availablePharmacistsCount} active staff{capacitySummary.onLeavePharmacistsCount > 0 ? ` (after excluding ${capacitySummary.onLeavePharmacistsCount} on leave)` : ''} is <strong className="font-extrabold text-red-950">{capacitySummary.totalAdjustedCapacity} shifts</strong>. There is a <strong className="underline decoration-red-500 font-bold">deficit of {capacitySummary.deficitCount} shifts</strong>.
                  </p>
                  <div className="bg-white/80 border border-red-200 rounded-xl p-3 text-xs space-y-1.5 text-slate-800">
                    <span className="font-bold text-red-900 block">Suggested Actions to Prevent Gaps:</span>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700">
                      <li>Add relief pharmacists to this zone or branches</li>
                      <li>Expand allowed branches for available relief pharmacists</li>
                      <li>Review work/rest patterns or temporarily reduce rest days</li>
                    </ul>
                  </div>
                </div>
              ) : capacitySummary.isSurplus ? (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-amber-950 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
                      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                      <span>Surplus Capacity Available: {capacitySummary.surplusCount} Shifts</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAutoDistributeSurplus}
                        className="px-3 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        title="Distribute remaining surplus evenly across pharmacists with 1 click"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Auto-Distribute Surplus Evenly</span>
                      </button>
                      {Object.keys(extraRestDays).length > 0 && (
                        <button
                          type="button"
                          onClick={handleResetExtraRest}
                          className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all"
                          title="Reset assigned extra rest days"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed font-medium">
                    You have an extra capacity of <strong className="font-extrabold text-amber-950">{capacitySummary.surplusCount} shifts</strong>. The Proceed button is <strong className="underline decoration-amber-500 font-bold">disabled</strong> until these surplus shifts are absorbed as extra rest days among pharmacists until net surplus is <strong>0</strong>.
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 text-emerald-950 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span>Perfect Balance — Surplus Fully Absorbed (0 Net Balance)</span>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ✓ Ready to Proceed
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 font-medium">
                    Adjusted staff capacity ({capacitySummary.totalAdjustedCapacity} shifts) exactly matches total required coverage ({capacitySummary.requiredCoverage.totalRequired} shifts). You can proceed to the next step.
                  </p>
                </div>
              )}

              {/* Per-Pharmacist Active Capacity Breakdown Table */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Active Pharmacist Capacity & Surplus Balancing</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    {capacitySummary.pharmacistDetails.length} Active Staff
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
                  {capacitySummary.pharmacistDetails.map(p => (
                    <div key={p.employeeId} className="p-3 rounded-xl border border-slate-200 bg-white hover:border-brand/40 transition-all flex items-center justify-between text-xs gap-2 shadow-2xs">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 truncate">{p.name}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                            {p.roleType}
                          </span>
                          {p.isUsingDefaultAssumption ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              default rest
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[10px] text-slate-500 bg-slate-50 border border-slate-200">
                              {p.workRestDescription}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span>Work: <strong className="text-slate-800 font-bold">{p.netCapacity}d</strong></span>
                          <span>•</span>
                          <span>Base Rest: <strong className="text-slate-700 font-semibold">{Math.max(0, p.availableDays - p.expectedWorkingDays)}d</strong></span>
                          {p.extraRestDays > 0 ? (
                            <>
                              <span>•</span>
                              <span className="text-brand font-semibold">Extra Rest: +{p.extraRestDays}d</span>
                              <span>•</span>
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                Total Off: {Math.max(0, p.availableDays - p.expectedWorkingDays) + p.extraRestDays}d
                              </span>
                            </>
                          ) : (
                            <>
                              <span>•</span>
                              <span>Total Off: {Math.max(0, p.availableDays - p.expectedWorkingDays)}d</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Extra Rest Days Counter (+ / -) */}
                      <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                        <span className="text-[10px] font-semibold text-slate-500 mr-0.5">Extra Rest:</span>
                        <button
                          type="button"
                          onClick={() => handleAdjustExtraRest(p.employeeId, -1)}
                          disabled={p.extraRestDays <= 0}
                          className="w-5 h-5 rounded bg-white border border-slate-300 flex items-center justify-center text-xs font-bold hover:bg-slate-100 disabled:opacity-30"
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-bold text-xs text-brand">
                          {p.extraRestDays}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAdjustExtraRest(p.employeeId, 1)}
                          className="w-5 h-5 rounded bg-white border border-slate-300 flex items-center justify-center text-xs font-bold hover:bg-slate-100"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Excluded Pharmacists on Annual Leave (0 Capacity Shifts) */}
              {capacitySummary.excludedLeavePharmacists.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Excluded from Pool & Capacity — On Annual Leave ({capacitySummary.excludedLeavePharmacists.length})
                    </span>
                    <span className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md font-semibold border border-amber-200">
                      0 Capacity Shifts Contributed
                    </span>
                  </div>

                  <div className="border border-amber-200 rounded-xl overflow-hidden divide-y divide-amber-100 bg-amber-50/20 shadow-xs">
                    {capacitySummary.excludedLeavePharmacists.map(p => (
                      <div key={p.employeeId} className="p-2.5 flex items-center justify-between text-xs hover:bg-amber-50/40 transition-colors gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-800">{p.name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {p.roleType}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Annual Leave ({p.leaveDays} days)
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Fully removed from active pool, aggregate capacity check, and solver assignment.
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 font-bold text-[11px] border border-slate-200">
                            0 Net Capacity
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 5: Weekend (Friday/Saturday) Distribution                    */}
          {/* ================================================================= */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 text-xs text-indigo-950 space-y-1">
                <div className="font-bold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  <span>Step 5 — Weekend Rest Distribution Team (Friday & Saturday)</span>
                </div>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  During this period, there are <strong className="font-bold text-indigo-900">{weekendDayCounts.fridays} Fridays</strong> and <strong className="font-bold text-indigo-900">{weekendDayCounts.saturdays} Saturdays</strong> ({weekendDayCounts.total} total weekend days). Designate a team of <strong className="font-bold text-indigo-900">3, 4, or 5 pharmacists</strong> to receive priority Friday and Saturday off-days on rotation, while remaining staff cover weekend branch shifts.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Select Weekend Rest Team (3–5 Pharmacists)
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  selectedWeekendPharmacistIds.length >= 3 && selectedWeekendPharmacistIds.length <= 5
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedWeekendPharmacistIds.length > 5
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                }`}>
                  Selected: {selectedWeekendPharmacistIds.length} of 3–5
                </span>
              </div>

              {/* Multi-Select Pharmacists List (Only Active Available Staff) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1">
                {availableStaffForWeekend.map(s => {
                  const isSelected = selectedWeekendPharmacistIds.includes(s.id);
                  const isMaxReached = selectedWeekendPharmacistIds.length >= 5 && !isSelected;
                  const profile = targetProfiles.find(p => p.employeeId === s.id);

                  return (
                    <label 
                      key={s.id} 
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-200' 
                          : isMaxReached 
                            ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200' 
                            : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isMaxReached}
                          onChange={() => handleToggleWeekendPharmacist(s.id)}
                          className="rounded text-brand focus:ring-brand"
                        />
                        <div>
                          <div className="font-bold text-slate-800">{s.full_name || s.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {profile?.roleType || 'Pharmacist'} • {profile?.workRestMode || 'Standard'}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand/10 text-brand flex items-center gap-1">
                          <Coffee className="h-3 w-3 shrink-0" />
                          <span>Weekend Rest</span>
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              {/* Alternating Weekend Rest Rotation Preview (Weekly Friday ⇄ Saturday) */}
              {weekendAlternationSchedule.length > 0 && (
                <div className="bg-white border border-indigo-200 rounded-xl p-3 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
                      <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span>Alternating Weekend Rest Rotation Preview (Weekly Friday ⇄ Saturday)</span>
                    </div>
                    <span className="text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-semibold border border-indigo-200">
                      {selectedWeekendPharmacistIds.length} Pharmacists Rotating
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {weekendAlternationSchedule.map(w => (
                      <div key={w.weekendIndex} className="p-2 rounded-lg bg-indigo-50/50 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5">
                        <div className="font-bold text-slate-800 shrink-0 sm:w-36">
                          Weekend {w.weekendIndex + 1}
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {[w.fridayDate, w.saturdayDate].filter(Boolean).map(d => getSafeDateDetails(d!).formattedDate).join(' & ')}
                          </span>
                        </div>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                          <div className="bg-white/90 rounded px-2.5 py-1 border border-indigo-100/80 shadow-2xs">
                            <span className="text-emerald-700 font-bold mr-1">Friday Off:</span>
                            <span className="text-slate-700 font-medium">{w.fridayOffStaff.join(', ')}</span>
                          </div>
                          <div className="bg-white/90 rounded px-2.5 py-1 border border-indigo-100/80 shadow-2xs">
                            <span className="text-indigo-700 font-bold mr-1">Saturday Off:</span>
                            <span className="text-slate-700 font-medium">{w.saturdayOffStaff.join(', ')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notice when pharmacists are excluded due to annual leave */}
              {capacitySummary && capacitySummary.excludedLeavePharmacists.length > 0 && (
                <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg p-2.5 flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>
                    <strong>{capacitySummary.excludedLeavePharmacists.length} pharmacist(s)</strong> on leave are excluded from weekend distribution.
                  </span>
                </div>
              )}

              {/* Soft Constraint Zero-Gap Clarification Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 flex items-start gap-2">
                <Sliders className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="text-slate-800">Fair Weekend Rotation with Zero-Gap Protection:</strong> The solver gives highest soft priority to grant Friday and Saturday off-days to the pharmacists designated in this team on rotation. If coverage constraints strictly require one of them to work, zero-gap protection ensures required shifts remain staffed while maintaining overall rotation fairness.
                </p>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 6: Final Review & Generate                                  */}
          {/* ================================================================= */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950 flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-emerald-900">Ready to Run Automated Solver</h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Pre-generation planning complete. Review your configuration below before running the solver.
                  </p>
                </div>
              </div>

              {/* Review Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs space-y-3 shadow-xs">
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Period</span>
                    <span className="font-bold text-slate-800">{periodStart} → {periodEnd} ({periodDates.length} Days)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Target Zone</span>
                    <span className="font-bold text-slate-800">{selectedZone ? selectedZone.name : 'All Zones'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Pharmacist Pool</span>
                    <span className="font-bold text-slate-800">
                      {capacitySummary?.availablePharmacistsCount} Active Staff
                      {capacitySummary && capacitySummary.onLeavePharmacistsCount > 0 ? (
                        <span className="text-[11px] font-normal text-amber-700 block mt-0.5">
                          ({capacitySummary.onLeavePharmacistsCount} on annual leave excluded)
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Net Capacity</span>
                    <span className={`font-bold ${capacitySummary?.isDeficit ? 'text-red-600' : 'text-emerald-700'}`}>
                      {capacitySummary?.totalAdjustedCapacity} Shifts ({capacitySummary?.balance! >= 0 ? `+${capacitySummary?.balance} Surplus` : `${capacitySummary?.balance} Deficit`})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Coverage Demand</span>
                    <span className="font-bold text-slate-800">
                      {capacitySummary?.requiredCoverage.totalRequired} Shifts ({targetBranches.length} Branches)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Weekend Pool</span>
                    <span className="font-bold text-slate-800">
                      {selectedWeekendPharmacistIds.length > 0 ? `${selectedWeekendPharmacistIds.length} Pharmacists` : 'Standard Solver Rotation'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Special Employee Requests</span>
                    <span className="font-bold text-slate-800">
                      {stagedSpecialRequests.length > 0
                        ? `${stagedSpecialRequests.length} Staff (${stagedSpecialRequests.reduce((acc, r) => acc + r.dates.length, 0)} Off-Days Reserved)`
                        : 'None (Standard Solver Rest)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Extra Rest Days Assigned</span>
                    <span className="font-bold text-slate-800">
                      {Object.values(extraRestDays).reduce((a: number, b: number) => a + Number(b), 0)} days across {Object.keys(extraRestDays).length} staff
                    </span>
                  </div>
                </div>

                {stagedSpecialRequests.length > 0 && (
                  <div className="pt-1">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase mb-1.5">Reserved Special Off-Days Summary</span>
                    <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      {stagedSpecialRequests.map(sr => (
                        <div key={sr.tempId} className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-700">{sr.employeeName}:</span>
                          <span className="text-indigo-700 font-semibold font-mono">
                            {sr.dates.join(', ')} ({sr.dates.length} days)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer with Stepper Navigation Controls */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(prev => prev - 1)}
                disabled={isGenerating || isSavingLeaves}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                disabled={isGenerating || isSavingLeaves}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 1 && (
              <button
                type="submit"
                form="step-1-form"
                className="px-5 py-2 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-dark transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>Next: Annual Leave</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleSaveAndProceedToCapacity}
                disabled={isSavingLeaves}
                className="px-5 py-2 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-dark transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isSavingLeaves ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving Leave Records...</span>
                  </>
                ) : (
                  <>
                    <span>Next: Special Requests</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-5 py-2 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-dark transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>Next: Capacity Summary</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                onClick={() => setStep(5)}
                disabled={Boolean(capacitySummary && capacitySummary.surplusCount > 0) || (complianceAudit.hasViolations && !complianceOverride)}
                className="px-5 py-2 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-dark transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand"
                title={
                  complianceAudit.hasViolations && !complianceOverride
                    ? 'Acknowledge NHRA compliance violation override to proceed'
                    : capacitySummary && capacitySummary.surplusCount > 0
                    ? `All surplus capacity (${capacitySummary.surplusCount} shifts remaining) must be distributed as extra rest days before proceeding`
                    : undefined
                }
              >
                <span>
                  {complianceAudit.hasViolations && !complianceOverride
                    ? 'Acknowledge NHRA Compliance'
                    : capacitySummary && capacitySummary.surplusCount > 0
                    ? `Distribute Surplus (${capacitySummary.surplusCount} remaining)`
                    : 'Next: Weekend Distribution'}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            {step === 5 && (
              <button
                type="button"
                onClick={() => {
                  if (selectedWeekendPharmacistIds.length > 0 && selectedWeekendPharmacistIds.length < 3) {
                    setModalError('Please select at least 3 pharmacists for weekend distribution, or deselect all to use standard solver distribution.');
                    return;
                  }
                  setStep(6);
                }}
                className="px-5 py-2 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-dark transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>Next: Review & Run</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            {step === 6 && (
              <button
                type="button"
                onClick={handleFinalGenerate}
                disabled={isGenerating}
                className="px-6 py-2 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-dark transition-colors flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Solving Zero-Gap Schedule...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Run Solver & Generate Schedule</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
