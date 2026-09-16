import React, { useEffect, useState, useMemo } from 'react';
import { 
  DutySchedule, 
  DutyScheduleAssignment, 
  DutyScheduleConflict, 
  DutyScheduleChange,
  PharmacistSchedulingProfile,
  DutySchedulerLeaveRecord,
  BranchZone,
  BranchShiftType,
  DutySchedulerSettings,
  SchedulingPeriodAdjustments
} from '../../types';
import { ScheduleGenerationWizard } from './ScheduleGenerationWizard';
import { dutySchedulerService } from '../../services/dutySchedulerService';
import { workforceService } from '../../services/workforceService';
import { branchService } from '../../services/branchService';
import { schedulingEngine, getCalendarDatesInRange, getSafeDateDetails } from '../../services/schedulingEngine';
import { dutyScheduleExportService } from '../../services/dutyScheduleExportService';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Loader2, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Users, 
  Building2, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  X, 
  Share2, 
  FileCheck, 
  Download, 
  Filter, 
  History, 
  LayoutGrid, 
  BarChart3, 
  ShieldCheck, 
  RefreshCw, 
  Clock, 
  Sparkles,
  MapPin,
  FileSpreadsheet
} from 'lucide-react';

type MatrixViewTab = 'matrix' | 'workload' | 'coverage' | 'audit';

export const ScheduleMatrixView: React.FC = () => {
  const [schedules, setSchedules] = useState<DutySchedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<DutySchedule | null>(null);
  const [assignments, setAssignments] = useState<DutyScheduleAssignment[]>([]);
  const [conflicts, setConflicts] = useState<DutyScheduleConflict[]>([]);
  const [auditChanges, setAuditChanges] = useState<DutyScheduleChange[]>([]);
  const [profiles, setProfiles] = useState<PharmacistSchedulingProfile[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [zones, setZones] = useState<BranchZone[]>([]);
  const [leaves, setLeaves] = useState<DutySchedulerLeaveRecord[]>([]);
  const [branchShiftTypes, setBranchShiftTypes] = useState<BranchShiftType[]>([]);
  
  const [activeTab, setActiveTab] = useState<MatrixViewTab>('matrix');
  const [matrixSubView, setMatrixSubView] = useState<'excel_master' | 'compact_grid'>('excel_master');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [newAssigneeEmpId, setNewAssigneeEmpId] = useState<string>('');

  // Filters (Spec §28.4)
  const [filterRegion, setFilterRegion] = useState<string>('ALL');
  const [filterBranch, setFilterBranch] = useState<string>('ALL');
  const [filterPharmacist, setFilterPharmacist] = useState<string>('ALL');
  const [filterScheduleZone, setFilterScheduleZone] = useState<string>('ALL');

  // Generate Schedule Wizard Modal (Spec §28.2 & Zero-Gap Capacity Wizard)
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [schedulerSettings, setSchedulerSettings] = useState<DutySchedulerSettings | null>(null);

  // Post-Generation Summary Modal (Spec §28.3)
  const [summaryData, setSummaryData] = useState<{
    period: string;
    region: string;
    branchCount: number;
    pharmacistCount: number;
    requiredShifts: number;
    coveredShifts: number;
    coveragePct: string;
    hardConflicts: number;
    softWarnings: number;
    fairness: string;
  } | null>(null);

  // Edit Assignment Modal
  const [editingAssignment, setEditingAssignment] = useState<DutyScheduleAssignment | null>(null);
  const [overrideShiftCode, setOverrideShiftCode] = useState('');
  const [overrideBranchId, setOverrideBranchId] = useState('');
  const [overrideIsLocked, setOverrideIsLocked] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [isAutoFilling, setIsAutoFilling] = useState(false);

  const filteredSchedules = useMemo(() => {
    if (filterScheduleZone === 'ALL') return schedules;
    return schedules.filter(s => s.zoneId === filterScheduleZone);
  }, [schedules, filterScheduleZone]);

  useEffect(() => {
    if (filteredSchedules.length > 0) {
      if (!selectedScheduleId || !filteredSchedules.some(s => s.id === selectedScheduleId)) {
        setSelectedScheduleId(filteredSchedules[0].id);
      }
    } else {
      setSelectedScheduleId(null);
    }
  }, [filterScheduleZone, filteredSchedules]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedScheduleId) {
      loadScheduleDetails(selectedScheduleId);
    }
  }, [selectedScheduleId]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [fetchedSchedules, fetchedProfiles, fetchedEmployees, fetchedBranches, fetchedZones, fetchedLeaves, fetchedShiftTypes, fetchedSettings] = await Promise.all([
        dutySchedulerService.getSchedules(),
        dutySchedulerService.getProfiles(),
        workforceService.getAllEmployees(),
        branchService.getBranches(),
        dutySchedulerService.getSchedulingZones(),
        dutySchedulerService.getAllLeaveRecords({ status: 'APPROVED' }),
        dutySchedulerService.getBranchShiftTypes(),
        dutySchedulerService.getDutySchedulerSettings()
      ]);

      setSchedules(fetchedSchedules);
      setProfiles(fetchedProfiles);
      setEmployees(fetchedEmployees.filter(e => e.category === 'Pharmacist' || fetchedProfiles.some(p => p.employeeId === e.id)));
      setBranches(fetchedBranches);
      setZones(fetchedZones);
      setLeaves(fetchedLeaves);
      setBranchShiftTypes(fetchedShiftTypes);
      setSchedulerSettings(fetchedSettings);

      if (fetchedSchedules.length > 0) {
        setSelectedScheduleId(fetchedSchedules[0].id);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadScheduleDetails = async (scheduleId: string) => {
    try {
      const [details, changes] = await Promise.all([
        dutySchedulerService.getScheduleDetails(scheduleId),
        dutySchedulerService.getScheduleChanges(scheduleId)
      ]);
      setSelectedSchedule(details.schedule);
      setAssignments(details.assignments);
      setConflicts(details.conflicts);
      setAuditChanges(changes);
    } catch (err) {
      console.error('Error loading schedule details:', err);
    }
  };

  const openGenerateModal = () => {
    setIsGenerateModalOpen(true);
  };

  const handleRunGenerationWizard = async (params: {
    name: string;
    zoneId: string;
    periodStart: string;
    periodEnd: string;
    useContinuity: boolean;
    periodAdjustments: SchedulingPeriodAdjustments;
  }) => {
    const { 
      name: finalScheduleName, 
      zoneId: targetZoneId, 
      periodStart: pStart, 
      periodEnd: pEnd, 
      useContinuity: withContinuity, 
      periodAdjustments 
    } = params;

    setIsGenerating(true);
    try {
      const selectedZone = zones.find(z => z.id === targetZoneId);
      const zoneTitle = selectedZone ? selectedZone.name : 'All Zones';

      // 1. Filter branches for this zone
      const targetBranches = (targetZoneId === 'ALL' || !selectedZone)
        ? branches.filter(b => b.isActive !== false)
        : branches.filter(b => b.isActive !== false && selectedZone.branchIds && selectedZone.branchIds.includes(b.id));

      // Filter profiles stationed in this zone (Primary or Secondary with active quota)
      const targetProfiles = (targetZoneId === 'ALL' || !selectedZone)
        ? profiles.filter(p => p.isActive !== false)
        : profiles.filter(p => {
            if (p.isActive === false) return false;
            if (p.zoneId === targetZoneId) return true;
            if (p.secondaryZoneId === targetZoneId && (p.secondaryZoneMaxDays || 0) > 0) return true;
            if (p.primaryBranchId && selectedZone.branchIds?.includes(p.primaryBranchId)) return true;
            return false;
          });

      // 2. Create or get Draft schedule with zone_id and name
      const draft = await dutySchedulerService.createDraftSchedule({
        name: finalScheduleName,
        zoneId: targetZoneId !== 'ALL' ? targetZoneId : undefined,
        periodStart: pStart,
        periodEnd: pEnd,
        status: 'DRAFT'
      });

      // 3. Fetch approved leaves in this period (includes Step 2 fresh entries)
      let allLeaves = await dutySchedulerService.getAllLeaveRecords({ status: 'APPROVED' });
      if (periodAdjustments?.leaveRecords && periodAdjustments.leaveRecords.length > 0) {
        const merged = [...allLeaves];
        for (const lr of periodAdjustments.leaveRecords) {
          const lrId = String(lr.employeeId || (lr as any).employee_id || '').trim().toLowerCase();
          const lrStart = String(lr.startDate || (lr as any).start_date || '').split('T')[0];
          if (!merged.some(m => {
            const mId = String(m.employeeId || (m as any).employee_id || '').trim().toLowerCase();
            const mStart = String(m.startDate || (m as any).start_date || '').split('T')[0];
            return mId === lrId && mStart === lrStart;
          })) {
            merged.push(lr);
          }
        }
        allLeaves = merged;
      }

      // 4. Fetch real branch shift requirements
      const shiftReqs = await dutySchedulerService.getBranchShiftTypes();

      // 5. Fetch real previous rolling state for continuity (Spec §16.3)
      let rollingState: any[] = [];
      const effectiveProfiles = targetProfiles.length > 0 ? targetProfiles : profiles;
      if (withContinuity) {
        const activeEmpIds = effectiveProfiles.map(p => p.employeeId);
        rollingState = await dutySchedulerService.getLatestRollingState(activeEmpIds);
      }

      // 6. Run solver engine with period-scoped adjustments
      const output = schedulingEngine.generateSchedule({
        scheduleId: draft.id,
        targetZoneId: targetZoneId !== 'ALL' ? targetZoneId : undefined,
        startDate: pStart,
        endDate: pEnd,
        profiles: effectiveProfiles,
        leaves: allLeaves,
        previousRollingState: rollingState,
        branches: targetBranches.length > 0 ? targetBranches : branches,
        shiftRequirements: shiftReqs,
        lockedAssignments: [],
        periodAdjustments,
        employees
      });

      // 7. Save results atomically to DB (assignments + conflicts + rolling states)
      await dutySchedulerService.saveScheduleAssignments(
        draft.id,
        output.assignments,
        output.conflicts,
        output.newRollingState
      );


      // 8. Log generation audit trail (Spec §25)
      await dutySchedulerService.logScheduleChange({
        scheduleId: draft.id,
        eventType: 'GENERATE_SCHEDULE',
        targetId: draft.id,
        newValue: {
          name: finalScheduleName,
          periodStart: pStart,
          periodEnd: pEnd,
          zoneId: targetZoneId,
          zoneName: zoneTitle,
          assignmentsCount: output.assignments.length,
          conflictsCount: output.conflicts.length,
          periodAdjustments
        },
        reason: `Wizard generation: ${zoneTitle} (Zero-Gap solver)`
      });

      setIsGenerateModalOpen(false);
      const updatedSchedules = await dutySchedulerService.getSchedules();
      setSchedules(updatedSchedules);
      setSelectedScheduleId(draft.id);

      // 9. Show Post-Generation Summary Modal (Spec §28.3)
      const hardConflicts = output.conflicts.filter(c => c.severity === 'HARD').length;
      const softWarnings = output.conflicts.filter(c => c.severity === 'SOFT').length;
      const totalRequired = output.assignments.length + hardConflicts;
      const coveragePct = totalRequired > 0 ? ((output.assignments.length / totalRequired) * 100).toFixed(1) : '100.0';

      // Count active pharmacists excluding full-period leave
      const activePharmacistsCount = effectiveProfiles.filter(p => !allLeaves.some(l => {
        const lId = String(l.employeeId || (l as any).employee_id || '').trim().toLowerCase();
        const pId = String(p.employeeId).trim().toLowerCase();
        if (lId !== pId) return false;
        const status = String(l.status || 'APPROVED').trim().toUpperCase();
        if (status === 'REJECTED' || status === 'CANCELLED') return false;
        const sDate = String(l.startDate || (l as any).start_date || '').split('T')[0];
        const eDate = String(l.endDate || (l as any).end_date || '').split('T')[0];
        return sDate <= pEnd && eDate >= pStart;
      })).length;

      setSummaryData({
        period: `${pStart} to ${pEnd}`,
        region: zoneTitle,
        branchCount: targetBranches.length,
        pharmacistCount: activePharmacistsCount,
        requiredShifts: totalRequired,
        coveredShifts: output.assignments.length,
        coveragePct: `${coveragePct}%`,
        hardConflicts,
        softWarnings,
        fairness: hardConflicts === 0 ? 'Optimized (Zero Critical Conflicts)' : 'Needs Review'
      });

    } catch (err: any) {
      console.error('Error generating schedule:', err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReGenerateCurrent = async () => {
    if (!selectedSchedule) return;
    if (!confirm('Re-generating will re-calculate all unlocked shifts. Locked shifts will be preserved. Proceed?')) return;

    setIsGenerating(true);
    try {
      const allLeaves = await dutySchedulerService.getAllLeaveRecords({ status: 'APPROVED' });
      const shiftReqs = await dutySchedulerService.getBranchShiftTypes();
      const rollingState = await dutySchedulerService.getLatestRollingState(profiles.map(p => p.employeeId));

      // Separate locked assignments so solver respects them
      const lockedAssignments = assignments.filter(a => a.isLocked);

      const output = schedulingEngine.generateSchedule({
        scheduleId: selectedSchedule.id,
        startDate: selectedSchedule.periodStart,
        endDate: selectedSchedule.periodEnd,
        profiles,
        leaves: allLeaves,
        previousRollingState: rollingState,
        branches,
        shiftRequirements: shiftReqs,
        lockedAssignments,
        employees
      });

      // Save assignments and increment schedule version
      await dutySchedulerService.saveScheduleAssignments(
        selectedSchedule.id,
        output.assignments,
        output.conflicts,
        output.newRollingState
      );

      await dutySchedulerService.createScheduleVersion(selectedSchedule.id, 'Schedule regenerated with preserved locked shifts');
      await loadScheduleDetails(selectedSchedule.id);

      const hardConflicts = output.conflicts.filter(c => c.severity === 'HARD').length;
      const softWarnings = output.conflicts.filter(c => c.severity === 'SOFT').length;
      const totalRequired = output.assignments.length + hardConflicts;
      const coveragePct = totalRequired > 0 ? ((output.assignments.length / totalRequired) * 100).toFixed(1) : '100.0';

      setSummaryData({
        period: `${selectedSchedule.periodStart} to ${selectedSchedule.periodEnd}`,
        region: 'All Regions',
        branchCount: branches.length,
        pharmacistCount: profiles.length,
        requiredShifts: totalRequired,
        coveredShifts: output.assignments.length,
        coveragePct: `${coveragePct}%`,
        hardConflicts,
        softWarnings,
        fairness: hardConflicts === 0 ? 'Good' : 'Needs Review'
      });
    } catch (err) {
      console.error('Error re-generating schedule:', err);
      alert('Failed to re-generate schedule');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublishSchedule = async () => {
    if (!selectedSchedule) return;
    try {
      await dutySchedulerService.updateScheduleStatus(selectedSchedule.id, 'PUBLISHED');
      await dutySchedulerService.logScheduleChange({
        scheduleId: selectedSchedule.id,
        eventType: 'PUBLISH_SCHEDULE',
        targetId: selectedSchedule.id,
        newValue: { status: 'PUBLISHED' },
        reason: 'Official schedule published'
      });
      await loadScheduleDetails(selectedSchedule.id);
      const updatedSchedules = await dutySchedulerService.getSchedules();
      setSchedules(updatedSchedules);
    } catch (err) {
      console.error('Error publishing schedule:', err);
      alert('Failed to publish schedule');
    }
  };

  const handleDeleteSchedule = async () => {
    if (!selectedSchedule) return;
    if (!confirm('Are you sure you want to delete this duty schedule? All assignments will be removed.')) return;

    try {
      await dutySchedulerService.deleteSchedule(selectedSchedule.id);
      const updatedSchedules = await dutySchedulerService.getSchedules();
      setSchedules(updatedSchedules);
      setSelectedScheduleId(updatedSchedules[0]?.id || null);
    } catch (err) {
      console.error('Error deleting schedule:', err);
      alert('Failed to delete schedule');
    }
  };

  const handleToggleLock = async (assignment: DutyScheduleAssignment) => {
    try {
      await dutySchedulerService.toggleAssignmentLock(assignment.id, !assignment.isLocked);
      setAssignments(prev => prev.map(a => a.id === assignment.id ? { ...a, isLocked: !a.isLocked } : a));
    } catch (err) {
      console.error('Error toggling lock:', err);
    }
  };

  const handleBatchLock = async (lockAll: boolean) => {
    if (!selectedSchedule || !assignments.length) return;
    try {
      const ids = assignments.map(a => a.id);
      await dutySchedulerService.batchUpdateLocks(ids, lockAll, selectedSchedule.id);
      setAssignments(prev => prev.map(a => ({ ...a, isLocked: lockAll })));
    } catch (err) {
      console.error('Error in batch lock:', err);
    }
  };

  const handleExportExcel = async () => {
    if (!selectedSchedule) return;
    setIsExporting(true);
    try {
      await dutyScheduleExportService.exportScheduleToExcel({
        schedule: selectedSchedule,
        assignments,
        profiles,
        employees,
        branches,
        leaves,
        branchShiftTypes,
        regionName: filterRegion === 'ALL' ? 'All Regions' : filterRegion
      });
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      alert('Failed to export schedule to Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  const openCreateAssignmentForSlot = (branchId: string, date: string, shiftCode: string) => {
    if (!selectedSchedule) return;
    setEditingAssignment({
      id: '',
      scheduleId: selectedSchedule.id,
      employeeId: '',
      branchId,
      date,
      shiftCode,
      isLocked: true,
      isRelief: false,
      createdAt: '',
      updatedAt: ''
    });
    setOverrideShiftCode(shiftCode);
    setOverrideBranchId(branchId);
    setOverrideIsLocked(true);
    setOverrideReason('Manual cover for unfilled shift slot');
    setNewAssigneeEmpId('');
  };

  const openEditAssignment = (assignment: DutyScheduleAssignment) => {
    setEditingAssignment(assignment);
    setOverrideShiftCode(assignment.shiftCode);
    setOverrideBranchId(assignment.branchId);
    setOverrideIsLocked(assignment.isLocked);
    setOverrideReason('');
    setNewAssigneeEmpId(assignment.employeeId);
  };

  const handleSaveAssignmentOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssignment || !selectedSchedule) return;

    try {
      if (!editingAssignment.id) {
        // Creating a new assignment for an unfilled slot
        if (!newAssigneeEmpId) {
          alert('Please select a pharmacist to assign.');
          return;
        }
        const created = await dutySchedulerService.createAssignment({
          scheduleId: selectedSchedule.id,
          employeeId: newAssigneeEmpId,
          branchId: overrideBranchId || editingAssignment.branchId,
          date: editingAssignment.date,
          shiftCode: overrideShiftCode || editingAssignment.shiftCode,
          isLocked: overrideIsLocked,
          isRelief: true
        });
        setAssignments(prev => [...prev.filter(a => !(a.employeeId === created.employeeId && a.date === created.date)), created]);
        await dutySchedulerService.logScheduleChange({
          scheduleId: selectedSchedule.id,
          eventType: 'MANUAL_EDIT',
          targetId: created.id,
          newValue: { ...created },
          reason: overrideReason || 'Manual fill of unfilled slot'
        });
      } else {
        // Updating existing assignment
        const updated = await dutySchedulerService.updateAssignmentWithAudit(
          editingAssignment.id,
          {
            shiftCode: overrideShiftCode,
            branchId: overrideBranchId,
            isLocked: overrideIsLocked
          },
          undefined,
          overrideReason || 'Manual assignment edit'
        );
        setAssignments(prev => prev.map(a => a.id === updated.id ? updated : a));
      }

      setEditingAssignment(null);
      const changes = await dutySchedulerService.getScheduleChanges(selectedSchedule.id);
      setAuditChanges(changes);
    } catch (err: any) {
      console.error('Error saving assignment override:', err);
      alert(err.message || 'Failed to save assignment');
    }
  };

  const handleAutoFillUnfilledShifts = async () => {
    if (!selectedSchedule) return;
    setIsAutoFilling(true);
    try {
      const res = await dutySchedulerService.autoFillPendingShifts(selectedSchedule.id);
      if (res.filledCount === 0) {
        alert('All shifts in this schedule are already 100% covered! No unfilled shifts found.');
      } else {
        alert(`Successfully filled ${res.filledCount} unfilled shift(s) with zero-gap emergency coverage.`);
      }
      await loadScheduleDetails(selectedSchedule.id);
    } catch (err: any) {
      console.error('Error auto-filling unfilled shifts:', err);
      alert('Failed to auto-fill shifts: ' + (err.message || 'Unknown error'));
    } finally {
      setIsAutoFilling(false);
    }
  };

  const getEmployeeName = (empId: string) => {
    return employees.find(e => e.id === empId)?.full_name || 'Unknown';
  };

  const getFormattedDoctorName = (empId: string) => {
    const name = getEmployeeName(empId);
    if (!name || name === 'Unknown') return 'Unknown';
    const clean = name.replace(/^dr[\.\s]+/i, '').trim().toUpperCase();
    return `DR. ${clean}`;
  };

  const getFormattedDoctorWithCode = (empId: string) => {
    const emp = employees.find(e => String(e.id).toLowerCase() === String(empId).toLowerCase());
    if (!emp) return empId;
    const clean = (emp.full_name || emp.name || 'Unknown').replace(/^dr[\.\s]+/i, '').trim().toUpperCase();
    const codePart = emp.code ? ` (${emp.code})` : '';
    return `DR. ${clean}${codePart}`;
  };

  const renderConflictDescription = (conflict: DutyScheduleConflict) => {
    const desc = conflict.description || '';
    if (!desc) return null;

    // Helper map of all employee IDs (lower-cased) to formatted doctor name with code
    const empMap = new Map<string, string>();
    employees.forEach(emp => {
      if (!emp?.id) return;
      const clean = (emp.full_name || emp.name || 'Pharmacist').replace(/^dr[\.\s]+/i, '').trim().toUpperCase();
      const codePart = emp.code ? ` (${emp.code})` : '';
      empMap.set(String(emp.id).toLowerCase(), `DR. ${clean}${codePart}`);
    });

    // Also map conflict.employeeId if not already present
    if (conflict.employeeId && !empMap.has(conflict.employeeId.toLowerCase())) {
      const found = employees.find(e => String(e.id).toLowerCase() === conflict.employeeId?.toLowerCase());
      if (found) {
        const clean = (found.full_name || found.name || 'Pharmacist').replace(/^dr[\.\s]+/i, '').trim().toUpperCase();
        const codePart = found.code ? ` (${found.code})` : '';
        empMap.set(conflict.employeeId.toLowerCase(), `DR. ${clean}${codePart}`);
      }
    }

    // Patterns to match:
    // 1. Markdown bold: **...**
    // 2. Standard UUID: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
    // 3. conflict.employeeId (e.g. emp-101)
    const patterns: string[] = [
      '\\*\\*(.*?)\\*\\*',
      '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
    ];
    if (conflict.employeeId && !patterns.some(p => p.includes(conflict.employeeId!))) {
      patterns.push(conflict.employeeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }

    const combinedRegex = new RegExp(patterns.join('|'), 'gi');
    let lastIndex = 0;
    const elements: React.ReactNode[] = [];
    let match: RegExpExecArray | null;

    while ((match = combinedRegex.exec(desc)) !== null) {
      const matchStart = match.index;
      const matchEnd = combinedRegex.lastIndex;
      const fullMatch = match[0];

      if (matchStart > lastIndex) {
        elements.push(desc.substring(lastIndex, matchStart));
      }

      if (fullMatch.startsWith('**') && fullMatch.endsWith('**')) {
        const innerText = fullMatch.slice(2, -2);
        elements.push(
          <strong key={`bold-${matchStart}`} className="font-extrabold text-slate-950 bg-amber-200/80 px-1.5 py-0.5 rounded border border-amber-300/80 text-[11px] inline-block mx-0.5 shadow-2xs">
            {innerText}
          </strong>
        );
      } else {
        const matchedId = fullMatch.toLowerCase();
        const formatted = empMap.get(matchedId) || (conflict.employeeId && conflict.employeeId.toLowerCase() === matchedId ? empMap.get(conflict.employeeId.toLowerCase()) : null);

        if (formatted) {
          elements.push(
            <strong key={`emp-${matchStart}`} className="font-extrabold text-slate-950 bg-amber-200/80 px-1.5 py-0.5 rounded border border-amber-300/80 text-[11px] inline-block mx-0.5 shadow-2xs">
              {formatted}
            </strong>
          );
        } else {
          const fallbackName = conflict.employeeId ? empMap.get(conflict.employeeId.toLowerCase()) : null;
          if (fallbackName) {
            elements.push(
              <strong key={`fb-${matchStart}`} className="font-extrabold text-slate-950 bg-amber-200/80 px-1.5 py-0.5 rounded border border-amber-300/80 text-[11px] inline-block mx-0.5 shadow-2xs">
                {fallbackName}
              </strong>
            );
          } else {
            elements.push(
              <strong key={`raw-${matchStart}`} className="font-bold text-slate-800">
                {fullMatch}
              </strong>
            );
          }
        }
      }

      lastIndex = matchEnd;
    }

    if (lastIndex < desc.length) {
      elements.push(desc.substring(lastIndex));
    }

    return <span>{elements}</span>;
  };

  const getBranchCode = (bId?: string) => {
    if (!bId) return '';
    return branches.find(b => b.id === bId)?.code || bId.slice(0, 4);
  };

  const getBranchName = (bId?: string) => {
    if (!bId) return '';
    return branches.find(b => b.id === bId)?.name || 'Unknown Branch';
  };

  // Generate matrix dates array
  const dateColumns: string[] = useMemo(() => {
    if (!selectedSchedule?.periodStart || !selectedSchedule?.periodEnd) return [];
    return getCalendarDatesInRange(selectedSchedule.periodStart, selectedSchedule.periodEnd);
  }, [selectedSchedule]);

  // Filtered Profiles based on filters
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      if (filterPharmacist !== 'ALL' && p.employeeId !== filterPharmacist) return false;
      if (filterBranch !== 'ALL' && p.primaryBranchId !== filterBranch) return false;
      return true;
    });
  }, [profiles, filterPharmacist, filterBranch]);

  // Map assignments: [employeeId][date] -> assignment
  const assignmentMap = useMemo(() => {
    const map = new Map<string, Map<string, DutyScheduleAssignment>>();
    for (const a of assignments) {
      if (!map.has(a.employeeId)) {
        map.set(a.employeeId, new Map());
      }
      map.get(a.employeeId)!.set(a.date, a);
    }
    return map;
  }, [assignments]);

  // Map leaves: [employeeId][date] -> leave (UTC safe)
  const leaveMap = useMemo(() => {
    const map = new Map<string, Map<string, DutySchedulerLeaveRecord>>();
    for (const l of leaves) {
      if (!map.has(l.employeeId)) {
        map.set(l.employeeId, new Map());
      }
      const sDate = String(l.startDate || '').split('T')[0].trim();
      const eDate = String(l.endDate || '').split('T')[0].trim();
      if (!sDate || !eDate) continue;
      for (const dStr of getCalendarDatesInRange(sDate, eDate)) {
        map.get(l.employeeId)!.set(dStr, l);
      }
    }
    return map;
  }, [leaves]);

  // Real system pharmacists for Excel Master layout (Spec §28 / schedule demo.xlsx matching)
  const excelPharmacists = useMemo(() => {
    let pharms = employees.filter(emp => {
      const hasAssignment = assignments.some(a => a.employeeId === emp.id);
      const hasProfile = profiles.some(p => p.employeeId === emp.id && (!selectedSchedule?.zoneId || p.zoneId === selectedSchedule.zoneId || p.secondaryZoneId === selectedSchedule.zoneId));
      return hasAssignment || hasProfile;
    });
    if (pharms.length === 0) {
      pharms = employees;
    }
    if (filterPharmacist !== 'ALL') {
      pharms = pharms.filter(p => p.id === filterPharmacist);
    }
    return [...pharms].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [employees, profiles, assignments, selectedSchedule, filterPharmacist]);

  // Real system branches for Excel Master layout
  const excelBranches = useMemo(() => {
    let bList = branches.filter(b => assignments.some(a => a.branchId === b.id));
    if (bList.length === 0) {
      bList = branches.slice(0, 10);
    }
    if (filterBranch !== 'ALL') {
      bList = bList.filter(b => b.id === filterBranch);
    }
    return [...bList].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [branches, assignments, filterBranch]);

  // Branch shift columns (AM, PM, NIGHT, VACATION) matching schedule demo.xlsx
  const excelBranchColumns = useMemo(() => {
    const cols: { branchId: string; branchName: string; shiftCode: string; headerLabel: string; isVacationCol?: boolean }[] = [];
    for (const branch of excelBranches) {
      const bShifts = branchShiftTypes.filter(s => s.branchId === branch.id && s.isActive !== false);
      let shiftCodes = bShifts.map(s => s.code);
      if (shiftCodes.length === 0) {
        const usedShifts = Array.from(new Set(
          assignments.filter(a => a.branchId === branch.id).map(a => a.shiftCode).filter(Boolean)
        ));
        shiftCodes = usedShifts.length > 0 ? usedShifts : ['AM', 'PM'];
      }
      shiftCodes.sort((a, b) => {
        if (a === 'AM') return -1;
        if (b === 'AM') return 1;
        return a.localeCompare(b);
      });

      for (const sc of shiftCodes) {
        const shiftCfg = bShifts.find(s => s.code === sc);
        let timingLabel = sc;
        if (shiftCfg?.startTime && shiftCfg?.endTime) {
          const sFormatted = shiftCfg.startTime.slice(0, 5).replace(/^0/, '');
          const eFormatted = shiftCfg.endTime.slice(0, 5).replace(/^0/, '');
          timingLabel = `${sc} ( ${sFormatted} - ${eFormatted} )`;
        }
        cols.push({
          branchId: branch.id,
          branchName: branch.name,
          shiftCode: sc,
          headerLabel: timingLabel
        });
      }

      // Add VACATION column for each branch
      cols.push({
        branchId: branch.id,
        branchName: branch.name,
        shiftCode: 'VACATION',
        headerLabel: 'VACATION',
        isVacationCol: true
      });
    }
    return cols;
  }, [excelBranches, branchShiftTypes, assignments]);

  // Branch + Date + Shift lookup map for rapid cell rendering
  const branchDateShiftMap = useMemo(() => {
    const map = new Map<string, Map<string, Map<string, DutyScheduleAssignment[]>>>();
    for (const a of assignments) {
      if (!map.has(a.branchId)) {
        map.set(a.branchId, new Map());
      }
      const bMap = map.get(a.branchId)!;
      if (!bMap.has(a.date)) {
        bMap.set(a.date, new Map());
      }
      const dMap = bMap.get(a.date)!;
      const sCode = a.shiftCode || 'AM';
      if (!dMap.has(sCode)) {
        dMap.set(sCode, []);
      }
      dMap.get(sCode)!.push(a);
    }
    return map;
  }, [assignments]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 text-brand animate-spin" />
      </div>
    );
  }

  // Dashboard KPIs (Spec §28.4)
  const reliefAssignmentsCount = assignments.filter(a => a.isRelief).length;
  const lockedCount = assignments.filter(a => a.isLocked).length;
  const hardConflictsCount = conflicts.filter(c => c.severity === 'HARD').length;
  const softConflictsCount = conflicts.filter(c => c.severity === 'SOFT').length;
  const totalRequiredEst = assignments.length + hardConflictsCount;
  const coveragePercentage = totalRequiredEst > 0 ? ((assignments.length / totalRequiredEst) * 100).toFixed(1) : '100.0';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Duty Schedule Matrix & Operations</h2>
          <p className="text-sm text-slate-500 mt-1">Dense desktop operational view, workload balance, branch coverage, and Excel export.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={openGenerateModal}
            className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-all shadow-sm font-medium hover:shadow-md text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Generate Schedule</span>
          </button>
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
          <CalendarIcon className="h-16 w-16 text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">No Duty Schedules Yet</h3>
          <p className="text-slate-500 mt-2 max-w-md text-sm">
            Click "Generate Schedule" to run the automated scheduling solver across all active pharmacists and branch slots.
          </p>
          <button 
            onClick={openGenerateModal}
            className="mt-6 flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-lg hover:bg-brand-dark transition-all shadow-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>Generate Schedule</span>
          </button>
        </div>
      ) : (
        <>
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                <Layers className="h-3.5 w-3.5 text-brand" />
                <span className="text-xs font-bold text-slate-500 uppercase">Zone:</span>
                <select
                  value={filterScheduleZone}
                  onChange={e => setFilterScheduleZone(e.target.value)}
                  className="px-2 py-0.5 border-0 bg-transparent text-xs font-semibold text-slate-800 focus:ring-0 cursor-pointer"
                >
                  <option value="ALL">All Schedules ({schedules.length})</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({schedules.filter(s => s.zoneId === z.id).length})
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-xs font-bold text-slate-400">|</span>

              <label className="text-xs font-bold text-slate-500 uppercase">Schedule:</label>
              <select
                value={selectedScheduleId || ''}
                onChange={e => setSelectedScheduleId(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-brand"
              >
                {filteredSchedules.length === 0 ? (
                  <option value="">No schedules for this zone</option>
                ) : (
                  filteredSchedules.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name ? `${s.name} • ` : ''}{s.periodStart} → {s.periodEnd} (v{s.version || 1} - {s.status})
                    </option>
                  ))
                )}
              </select>

              {selectedSchedule && (
                <div className="flex items-center gap-1.5">
                  {selectedSchedule.zoneName && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {selectedSchedule.zoneName}
                    </span>
                  )}
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    selectedSchedule.status === 'PUBLISHED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : selectedSchedule.status === 'UNDER_REVIEW'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {selectedSchedule.status} (v{selectedSchedule.version || 1})
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
              <button
                onClick={handleExportExcel}
                disabled={isExporting}
                className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                <span>Export Excel</span>
              </button>

              {selectedSchedule?.status !== 'PUBLISHED' && (
                <button
                  onClick={handleReGenerateCurrent}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-medium transition-colors"
                >
                  {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  <span>Re-solve Unlocked</span>
                </button>
              )}

              {selectedSchedule && (
                <button
                  onClick={handleAutoFillUnfilledShifts}
                  disabled={isAutoFilling}
                  title="Auto-Fill any unfilled shifts using Zero-Gap Emergency coverage"
                  className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                  {isAutoFilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  <span>Auto-Fill Shifts</span>
                </button>
              )}

              {selectedSchedule?.status !== 'PUBLISHED' && (
                <button
                  onClick={handlePublishSchedule}
                  className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                  <FileCheck className="h-3.5 w-3.5" />
                  <span>Publish</span>
                </button>
              )}

              <button
                onClick={handleDeleteSchedule}
                title="Delete Schedule"
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Dashboard KPI Cards (Spec §28.4) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-400 font-medium">Branches</div>
              <div className="text-lg font-bold text-slate-800 mt-0.5">{branches.length}</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-400 font-medium">Pharmacists</div>
              <div className="text-lg font-bold text-slate-800 mt-0.5">{profiles.length}</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-400 font-medium">Shifts Covered</div>
              <div className="text-lg font-bold text-teal-700 mt-0.5">{assignments.length}</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-400 font-medium">Coverage Rate</div>
              <div className="text-lg font-bold text-emerald-600 mt-0.5">{coveragePercentage}%</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-400 font-medium">Hard Conflicts</div>
              <div className={`text-lg font-bold mt-0.5 ${hardConflictsCount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                {hardConflictsCount}
              </div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-400 font-medium">Soft Warnings</div>
              <div className="text-lg font-bold text-amber-600 mt-0.5">{softConflictsCount}</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-400 font-medium">Relief Shifts</div>
              <div className="text-lg font-bold text-purple-700 mt-0.5">{reliefAssignmentsCount}</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] text-slate-400 font-medium">Locked Shifts</div>
              <div className="text-lg font-bold text-blue-700 mt-0.5">{lockedCount}</div>
            </div>
          </div>

          {/* Navigation Tabs (Spec §28) */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-2">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('matrix')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'matrix' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Duty Matrix</span>
              </button>
              <button
                onClick={() => setActiveTab('workload')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'workload' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Pharmacist Workload</span>
              </button>
              <button
                onClick={() => setActiveTab('coverage')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'coverage' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Branch Coverage</span>
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'audit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="h-3.5 w-3.5" />
                <span>Audit History ({auditChanges.length})</span>
              </button>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
              >
                <option value="ALL">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                ))}
              </select>

              <select
                value={filterPharmacist}
                onChange={e => setFilterPharmacist(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
              >
                <option value="ALL">All Pharmacists</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>

              {activeTab === 'matrix' && (
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => handleBatchLock(true)}
                    title="Lock all assignments"
                    className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded"
                  >
                    Lock All
                  </button>
                  <button
                    onClick={() => handleBatchLock(false)}
                    title="Unlock all assignments"
                    className="text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded"
                  >
                    Unlock All
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* TAB 1: Main Dense Matrix */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              {/* Conflict Alerts Bar */}
              {conflicts.length > 0 && (
                <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 shadow-xs">
                  <div className="flex items-center gap-2 mb-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <h4 className="font-bold text-amber-900 text-xs tracking-wide">
                      {conflicts.length} Constraint Conflict{conflicts.length > 1 ? 's' : ''} / Warnings Recorded
                    </h4>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                    {conflicts.map(c => (
                      <div key={c.id} className="text-[11px] text-amber-900 flex items-start gap-2 bg-amber-100/70 p-2 rounded-lg border border-amber-200/60 leading-relaxed">
                        <span className={`font-extrabold uppercase tracking-wider text-[9px] px-1.5 py-0.5 rounded shadow-2xs shrink-0 mt-0.5 ${
                          c.severity === 'HARD' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {c.severity}
                        </span>
                        <span className="font-bold text-amber-950 shrink-0 mt-0.5">{c.date}:</span>
                        <div className="flex-1 text-slate-800">
                          {renderConflictDescription(c)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-view switcher: Excel Master View vs Compact Pharmacist Grid */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Display Layout:</span>
                  <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setMatrixSubView('excel_master')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                        matrixSubView === 'excel_master'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span>Excel Master View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatrixSubView('compact_grid')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                        matrixSubView === 'compact_grid'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span>Compact Pharmacist Grid</span>
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  {matrixSubView === 'excel_master' ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                      Calendar rows with Pharmacist Time/Location & Branch Shift Doctors (100% Zero-Gap Coverage)
                    </span>
                  ) : (
                    <span>Pharmacists as rows across calendar columns</span>
                  )}
                </div>
              </div>

              {/* VIEW 1: Excel Master Dual-Operational View (Exact format of schedule demo.xlsx) */}
              {matrixSubView === 'excel_master' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-[680px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 z-30 shadow-xs">
                        {/* Row 1: Primary Group Headers */}
                        <tr className="border-b border-slate-300">
                          <th 
                            rowSpan={2} 
                            className="sticky left-0 z-40 bg-slate-100 text-slate-900 font-extrabold text-xs text-center p-2.5 border-r border-b border-slate-300 min-w-[85px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]"
                          >
                            DATE
                          </th>
                          <th 
                            rowSpan={2} 
                            className="sticky left-[85px] z-40 bg-slate-100 text-slate-900 font-extrabold text-xs text-center p-2.5 border-r border-b border-slate-300 min-w-[85px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]"
                          >
                            DAY
                          </th>

                          {/* Pharmacist Headers (Merged 2 columns each) */}
                          {excelPharmacists.map(pharm => (
                            <th 
                              key={pharm.id} 
                              colSpan={2} 
                              className="bg-slate-100 text-slate-900 text-center font-bold text-xs py-2 px-3 border-r border-slate-300 min-w-[170px]"
                            >
                              <div className="truncate font-extrabold tracking-tight">
                                {getFormattedDoctorName(pharm.id)}
                              </div>
                            </th>
                          ))}

                          {/* Branch Headers (Merged across shift cols + vacation col, #44546A) */}
                          {excelBranches.map(branch => {
                            const branchCols = excelBranchColumns.filter(c => c.branchId === branch.id);
                            const colsCount = branchCols.length;
                            if (colsCount === 0) return null;
                            return (
                              <th 
                                key={branch.id} 
                                colSpan={colsCount} 
                                className="bg-[#44546A] text-white text-center font-extrabold text-xs py-2 px-3 border-r border-slate-500 uppercase tracking-wide min-w-[200px]"
                              >
                                <div className="truncate">{branch.name}</div>
                              </th>
                            );
                          })}
                        </tr>

                        {/* Row 2: Subheaders */}
                        <tr className="border-b border-slate-300">
                          {/* Pharmacists Subheaders: LOCATION & TIME */}
                          {excelPharmacists.map(pharm => (
                            <React.Fragment key={`sub-${pharm.id}`}>
                              <th className="bg-slate-200 text-slate-700 text-center font-bold text-[10px] py-1.5 px-2 border-r border-slate-300 min-w-[90px]">
                                LOCATION
                              </th>
                              <th className="bg-slate-200 text-slate-700 text-center font-bold text-[10px] py-1.5 px-2 border-r border-slate-300 min-w-[80px]">
                                TIME
                              </th>
                            </React.Fragment>
                          ))}

                          {/* Branch Shifts Subheaders (AM, PM, VACATION, #E7E6E6) */}
                          {excelBranchColumns.map((col, idx) => (
                            <th 
                              key={`col-${col.branchId}-${col.shiftCode}-${idx}`} 
                              className="bg-[#E7E6E6] text-slate-800 text-center font-bold text-[11px] py-1.5 px-2 border-r border-slate-300 min-w-[105px]"
                            >
                              <div className="truncate">{col.headerLabel}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {dateColumns.map(dateStr => {
                          const { isWeekend, dayNameLong: dayName, formattedDate } = getSafeDateDetails(dateStr);

                          return (
                            <tr key={dateStr} className={`hover:bg-slate-50/80 transition-colors ${isWeekend ? 'bg-amber-50/40' : ''}`}>
                              {/* DATE Cell */}
                              <td className="sticky left-0 z-20 bg-white font-bold text-center text-xs p-2 border-r border-slate-200 min-w-[85px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                                {formattedDate}
                              </td>

                              {/* DAY Cell (Yellow highlight on Friday/Saturday) */}
                              <td className={`sticky left-[85px] z-20 text-center text-xs font-black p-2 border-r border-slate-200 min-w-[85px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)] ${
                                isWeekend ? 'bg-[#FFFF00] text-slate-950 font-black' : 'bg-white text-slate-800'
                              }`}>
                                {dayName}
                              </td>

                              {/* Pharmacist Columns: LOCATION and TIME */}
                              {excelPharmacists.map(pharm => {
                                const ass = assignmentMap.get(pharm.id)?.get(dateStr);
                                const leave = leaveMap.get(pharm.id)?.get(dateStr);

                                // 1. If pharmacist is assigned to work today, display their shift location and time!
                                if (ass) {
                                  const locText = ass.branchId ? getBranchCode(ass.branchId) || getBranchName(ass.branchId) : 'OFF';
                                  const timeText = ass.shiftCode || 'AM';

                                  return (
                                    <React.Fragment key={`cell-${pharm.id}-${dateStr}`}>
                                      <td 
                                        onClick={() => openEditAssignment(ass)}
                                        className="p-1.5 text-center text-[11px] font-semibold border-r border-slate-200 text-slate-900 cursor-pointer hover:bg-blue-50"
                                        title="Click to edit assignment"
                                      >
                                        <div className="truncate max-w-[90px]">{locText}</div>
                                      </td>
                                      <td 
                                        onClick={() => openEditAssignment(ass)}
                                        className="p-1.5 text-center text-[11px] font-semibold border-r border-slate-200 text-slate-900 cursor-pointer hover:bg-blue-50"
                                        title="Click to edit assignment"
                                      >
                                        <div className="truncate max-w-[80px]">{timeText}</div>
                                      </td>
                                    </React.Fragment>
                                  );
                                }

                                // 2. Not assigned to work today: check leave or off-day
                                const hasLeave = Boolean(leave);
                                if (hasLeave && leave) {
                                  return (
                                    <td 
                                      key={`cell-${pharm.id}-${dateStr}`}
                                      colSpan={2}
                                      className="bg-rose-100 text-rose-900 font-bold text-center text-xs p-1.5 border-r border-slate-300 select-none"
                                      title={`${leave.leaveType || 'Leave'}: ${getFormattedDoctorName(pharm.id)}`}
                                    >
                                      <span className="tracking-wide">
                                        {leave.leaveType === 'ANNUAL' ? 'Annual Leave' : (leave.leaveType || 'Leave')}
                                      </span>
                                    </td>
                                  );
                                }

                                // Regular off-day / rest day
                                return (
                                  <td 
                                    key={`cell-${pharm.id}-${dateStr}`}
                                    colSpan={2}
                                    className="bg-black text-white font-black text-center text-xs p-1.5 border-r border-slate-800 select-none"
                                    title={`Weekly Rest: ${getFormattedDoctorName(pharm.id)}`}
                                  >
                                    <span className="tracking-wider">Off Day</span>
                                  </td>
                                );
                              })}

                              {/* Branch Shift Columns (Assigned Doctor Name OR + Assign button) */}
                              {excelBranchColumns.map((col, cIdx) => {
                                if (col.isVacationCol) {
                                  // Vacation / leave / off-day pharmacists whose primary branch is this branch
                                  const vacPharms = excelPharmacists.filter(p => {
                                    const pProfile = profiles.find(prof => prof.employeeId === p.id);
                                    if (pProfile?.primaryBranchId !== col.branchId) return false;
                                    const ass = assignmentMap.get(p.id)?.get(dateStr);
                                    // If pharmacist is working today (anywhere in company), they are NOT on vacation!
                                    if (ass) return false;
                                    const l = leaveMap.get(p.id)?.get(dateStr);
                                    return Boolean(l || !ass);
                                  });

                                  return (
                                    <td key={`vac-${col.branchId}-${dateStr}-${cIdx}`} className="p-1.5 text-center text-[11px] font-bold border-r border-slate-200 text-amber-900 bg-amber-50/20">
                                      {vacPharms.length > 0 ? (
                                        <div className="truncate max-w-[110px]" title={vacPharms.map(p => getFormattedDoctorName(p.id)).join(', ')}>
                                          {vacPharms.map(p => getFormattedDoctorName(p.id)).join(' & ')}
                                        </div>
                                      ) : '-'}
                                    </td>
                                  );
                                }

                                // Operational Shift Column
                                const assignedList = branchDateShiftMap.get(col.branchId)?.get(dateStr)?.get(col.shiftCode) || [];
                                
                                return (
                                  <td key={`bshift-${col.branchId}-${col.shiftCode}-${dateStr}-${cIdx}`} className="p-1 text-center border-r border-slate-200">
                                    {assignedList.length > 0 ? (
                                      <div className="space-y-1">
                                        {assignedList.map(a => (
                                          <div 
                                            key={a.id} 
                                            onClick={() => openEditAssignment(a)}
                                            className="cursor-pointer hover:bg-blue-100/70 p-1 rounded font-bold text-slate-900 text-[11px] transition-colors flex items-center justify-center gap-1 group"
                                            title={`Click to edit assignment for ${getFormattedDoctorName(a.employeeId)}`}
                                          >
                                            <span className="truncate max-w-[110px]">{getFormattedDoctorName(a.employeeId)}</span>
                                            {a.isLocked && <Lock className="h-2.5 w-2.5 text-slate-400 group-hover:text-blue-600 shrink-0" />}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => openCreateAssignmentForSlot(col.branchId, dateStr, col.shiftCode)}
                                        title="Unfilled shift! Click to assign a pharmacist"
                                        className="w-full bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-700 border border-dashed border-slate-300 hover:border-blue-400 font-semibold text-center text-[10px] py-1 px-1.5 rounded transition-all flex items-center justify-center gap-1"
                                      >
                                        <Plus className="h-3 w-3" />
                                        <span>Assign</span>
                                      </button>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* VIEW 2: Compact Pharmacist Grid Container */}
              {matrixSubView === 'compact_grid' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-[650px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-900 text-white font-bold sticky top-0 z-20">
                        <tr>
                          <th className="p-3 sticky left-0 bg-slate-900 z-30 min-w-[190px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.2)]">
                            Pharmacist
                          </th>
                          {dateColumns.map(dateStr => {
                            const { dayNum, isFriday, dayNameNarrow: dayName } = getSafeDateDetails(dateStr);

                            return (
                              <th 
                                key={dateStr} 
                                className={`p-1.5 text-center min-w-[62px] border-l border-slate-800 ${
                                  isFriday ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-white'
                                }`}
                              >
                                <div className="text-[10px] opacity-80">{dayName}</div>
                                <div className="font-extrabold text-xs">{dayNum}</div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProfiles.map(profile => {
                          const empAssMap = assignmentMap.get(profile.employeeId);
                          const empLeaveMap = leaveMap.get(profile.employeeId);

                          return (
                            <tr key={profile.id} className="hover:bg-slate-50/70">
                              {/* Pharmacist Sticky Column */}
                              <td className="p-2.5 sticky left-0 bg-white z-10 font-medium shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-slate-200">
                                <div className="font-bold text-slate-900 line-clamp-1 text-xs">
                                  {getEmployeeName(profile.employeeId)}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                    profile.roleType === 'FIXED' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                                  }`}>
                                    {profile.roleType}
                                  </span>
                                  <span className="text-[10px] text-slate-500 truncate">
                                    {getBranchCode(profile.primaryBranchId)}
                                  </span>
                                </div>
                              </td>

                              {/* Schedule Day Cells */}
                              {dateColumns.map(dateStr => {
                                const assignment = empAssMap?.get(dateStr);
                                const leave = empLeaveMap?.get(dateStr);
                                const isFriday = getSafeDateDetails(dateStr).isFriday;

                                return (
                                  <td 
                                    key={dateStr} 
                                    className={`p-1 text-center border-l border-slate-100 ${
                                      isFriday ? 'bg-amber-50/20' : ''
                                    }`}
                                  >
                                    {leave ? (
                                      <div className="p-1 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-bold">
                                        {leave.leaveType || 'LEAVE'}
                                      </div>
                                    ) : assignment ? (
                                      <div 
                                        onClick={() => openEditAssignment(assignment)}
                                        className={`group relative p-1 rounded border text-center cursor-pointer transition-all hover:scale-105 shadow-xs ${
                                          assignment.isRelief
                                            ? 'bg-purple-50 border-purple-200 text-purple-900'
                                            : 'bg-blue-50 border-blue-200 text-blue-900'
                                        }`}
                                      >
                                        <div className="font-bold text-[11px] leading-tight">{assignment.shiftCode}</div>
                                        <div className="text-[9px] opacity-75 truncate">{getBranchCode(assignment.branchId)}</div>

                                        <div className="absolute top-0.5 right-0.5">
                                          {assignment.isLocked && (
                                            <Lock className="h-2 w-2 text-slate-500" />
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-[10px] text-slate-300 font-semibold py-1.5">
                                        OFF
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Pharmacist Workload View (Spec §28.5) */}
          {activeTab === 'workload' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Pharmacist</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Primary Branch</th>
                      <th className="p-3 text-center">Work Days</th>
                      <th className="p-3 text-center">Total Shifts</th>
                      <th className="p-3 text-center">AM</th>
                      <th className="p-3 text-center">PM</th>
                      <th className="p-3 text-center">Night</th>
                      <th className="p-3 text-center">Fri</th>
                      <th className="p-3 text-center">Sat</th>
                      <th className="p-3 text-center">Rest</th>
                      <th className="p-3 text-center">Leave</th>
                      <th className="p-3 text-center">Workload Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProfiles.map(profile => {
                      const empAssignments = assignments.filter(a => a.employeeId === profile.employeeId);
                      const workDays = new Set(empAssignments.map(a => a.date)).size;
                      const totalShifts = empAssignments.length;
                      const am = empAssignments.filter(a => a.shiftCode === 'AM' || a.shiftCode === 'M').length;
                      const pm = empAssignments.filter(a => a.shiftCode === 'PM' || a.shiftCode === 'E').length;
                      const night = empAssignments.filter(a => a.shiftCode === 'NIGHT').length;
                      const fri = empAssignments.filter(a => new Date(a.date + 'T00:00:00').getDay() === 5).length;
                      const sat = empAssignments.filter(a => new Date(a.date + 'T00:00:00').getDay() === 6).length;
                      const leaveCount = leaves.filter(l => l.employeeId === profile.employeeId).length;
                      const restCount = Math.max(0, dateColumns.length - workDays - leaveCount);
                      const wlScore = (am * 1.0) + (pm * 1.0) + (night * 1.25) + (fri * 0.25);

                      return (
                        <tr key={profile.id} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-800">{getEmployeeName(profile.employeeId)}</td>
                          <td className="p-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${profile.roleType === 'FIXED' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                              {profile.roleType}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">{getBranchCode(profile.primaryBranchId)}</td>
                          <td className="p-3 text-center font-bold">{workDays}</td>
                          <td className="p-3 text-center font-bold text-brand">{totalShifts}</td>
                          <td className="p-3 text-center text-slate-600">{am}</td>
                          <td className="p-3 text-center text-slate-600">{pm}</td>
                          <td className="p-3 text-center text-slate-600">{night}</td>
                          <td className="p-3 text-center text-amber-700 font-medium">{fri}</td>
                          <td className="p-3 text-center text-slate-600">{sat}</td>
                          <td className="p-3 text-center text-slate-400">{restCount}</td>
                          <td className="p-3 text-center text-rose-600">{leaveCount}</td>
                          <td className="p-3 text-center font-extrabold text-teal-700">{wlScore.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Branch Coverage View (Spec §28.6) */}
          {activeTab === 'coverage' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-3">Branch</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Day</th>
                      <th className="p-3 text-center">AM Staff</th>
                      <th className="p-3 text-center">PM Staff</th>
                      <th className="p-3 text-center">Night Staff</th>
                      <th className="p-3 text-center">Total Staff</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dateColumns.slice(0, 14).flatMap(dateStr => {
                      const d = new Date(dateStr + 'T00:00:00');
                      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

                      return branches.map(b => {
                        const bAssigns = assignments.filter(a => a.date === dateStr && a.branchId === b.id);
                        const am = bAssigns.filter(a => a.shiftCode === 'AM' || a.shiftCode === 'M').length;
                        const pm = bAssigns.filter(a => a.shiftCode === 'PM' || a.shiftCode === 'E').length;
                        const night = bAssigns.filter(a => a.shiftCode === 'NIGHT').length;
                        const is24h = b.is24Hour;
                        const isCovered = is24h ? (am > 0 && pm > 0 && night > 0) : (am > 0 && pm > 0);

                        return (
                          <tr key={`${b.id}-${dateStr}`} className="hover:bg-slate-50">
                            <td className="p-3 font-semibold text-slate-800">{b.name} ({b.code})</td>
                            <td className="p-3 text-slate-600">{dateStr}</td>
                            <td className="p-3 text-slate-500">{dayName}</td>
                            <td className="p-3 text-center font-medium">{am}</td>
                            <td className="p-3 text-center font-medium">{pm}</td>
                            <td className="p-3 text-center font-medium">{night}</td>
                            <td className="p-3 text-center font-bold text-slate-800">{bAssigns.length}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isCovered ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {isCovered ? 'Covered' : 'Gap'}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Audit History View (Spec §25) */}
          {activeTab === 'audit' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <History className="h-4 w-4 text-slate-500" />
                <span>Schedule Change Audit Trail</span>
              </h3>
              {auditChanges.length === 0 ? (
                <div className="text-xs text-slate-400 py-8 text-center">No change events recorded yet.</div>
              ) : (
                <div className="space-y-2">
                  {auditChanges.map(change => (
                    <div key={change.id} className="p-3 border border-slate-100 rounded-lg bg-slate-50/50 flex justify-between items-start text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] bg-slate-200 px-1.5 py-0.5 rounded">
                            {change.eventType}
                          </span>
                          <span className="text-slate-500 font-medium">
                            {new Date(change.createdAt).toLocaleString('en-GB')}
                          </span>
                        </div>
                        {change.reason && (
                          <p className="text-slate-700 mt-1"><span className="font-semibold">Reason:</span> {change.reason}</p>
                        )}
                        {change.newValue && (
                          <pre className="text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-200 mt-1 overflow-x-auto max-w-xl">
                            {JSON.stringify(change.newValue, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 5-Step Schedule Generation Wizard Modal */}
      <ScheduleGenerationWizard
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        zones={zones}
        branches={branches}
        profiles={profiles}
        allEmployees={employees}
        shiftRequirements={branchShiftTypes}
        settings={schedulerSettings}
        onGenerate={handleRunGenerationWizard}
        isGenerating={isGenerating}
      />


      {/* Post-Generation Summary Panel Modal (Spec §28.3) */}
      {summaryData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="bg-teal-700 p-6 text-white text-center relative">
              <Sparkles className="h-10 w-10 mx-auto mb-2 text-teal-200" />
              <h3 className="text-xl font-bold">Schedule Generated!</h3>
              <p className="text-xs text-teal-100 mt-1">{summaryData.period}</p>
              <button 
                onClick={() => setSummaryData(null)}
                className="absolute top-4 right-4 text-teal-200 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Zone / Scope:</span>
                <span className="font-bold text-slate-800">{summaryData.region}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Branches / Staff:</span>
                <span className="font-bold text-slate-800">{summaryData.branchCount} branches • {summaryData.pharmacistCount} pharmacists</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Required Shifts:</span>
                <span className="font-bold text-slate-800">{summaryData.requiredShifts}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Covered Shifts:</span>
                <span className="font-bold text-emerald-700">{summaryData.coveredShifts}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Coverage Rate:</span>
                <span className="font-extrabold text-emerald-700 text-sm">{summaryData.coveragePct}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Hard Conflicts:</span>
                <span className={`font-bold ${summaryData.hardConflicts > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {summaryData.hardConflicts}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Soft Warnings:</span>
                <span className="font-bold text-amber-600">{summaryData.softWarnings}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Fairness Rating:</span>
                <span className="font-bold text-teal-700">{summaryData.fairness}</span>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => setSummaryData(null)}
                  className="w-full bg-brand text-white py-2.5 rounded-xl font-bold hover:bg-brand-dark transition-colors shadow-sm"
                >
                  Review Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Override Assignment Modal */}
      {editingAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-sm text-slate-800">
                {editingAssignment.id ? 'Edit Assignment' : 'Assign Pharmacist to Unfilled Shift'}
              </h3>
              <button onClick={() => setEditingAssignment(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignmentOverride} className="p-5 space-y-4">
              {!editingAssignment.id ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Pharmacist <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newAssigneeEmpId}
                    onChange={e => setNewAssigneeEmpId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white font-medium"
                    required
                  >
                    <option value="">-- Choose System Pharmacist --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{getFormattedDoctorName(emp.id)}</option>
                    ))}
                  </select>
                  <div className="text-[11px] text-slate-500 mt-1">Date: <span className="font-semibold text-slate-700">{editingAssignment.date}</span></div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Pharmacist</label>
                  <div className="font-bold text-slate-800 text-sm">{getFormattedDoctorName(editingAssignment.employeeId)}</div>
                  <div className="text-xs text-slate-400">{editingAssignment.date}</div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Shift Type</label>
                <select
                  value={overrideShiftCode}
                  onChange={e => setOverrideShiftCode(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="AM">AM Shift</option>
                  <option value="PM">PM Shift</option>
                  <option value="NIGHT">NIGHT Shift</option>
                  <option value="FULL">FULL Shift</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Branch</label>
                <select
                  value={overrideBranchId}
                  onChange={e => setOverrideBranchId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Manual Override (Audit Compliance)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Relief cover for urgent personal reason"
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chk-lock-assign"
                  checked={overrideIsLocked}
                  onChange={e => setOverrideIsLocked(e.target.checked)}
                  className="rounded text-brand focus:ring-brand"
                />
                <label htmlFor="chk-lock-assign" className="text-xs font-medium text-slate-700">
                  Lock assignment against re-generation
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAssignment(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-brand text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-dark"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
