import React, { useEffect, useState, useRef } from 'react';
import { PharmacistSchedulingProfile, PharmacistRoleType, WorkRestMode, PatternStrictness, BranchZone } from '../../types';
import { dutySchedulerService } from '../../services/dutySchedulerService';
import { workforceService } from '../../services/workforceService';
import { branchService } from '../../services/branchService';
import { Loader2, Plus, Edit2, Trash2, UserCircle2, BriefcaseMedical, Check, X, AlertCircle, ShieldAlert, Clock, Calendar, Building2, User, Search, Sparkles, Layers, ChevronDown, Info } from 'lucide-react';

export const PharmacistProfilesView: React.FC = () => {
  const [profiles, setProfiles] = useState<PharmacistSchedulingProfile[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [zones, setZones] = useState<BranchZone[]>([]);
  const [selectedZoneTab, setSelectedZoneTab] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  // Form State
  const [employeeId, setEmployeeId] = useState('');
  const [roleType, setRoleType] = useState<PharmacistRoleType>('FIXED');
  const [zoneId, setZoneId] = useState<string>('');
  const [secondaryZoneId, setSecondaryZoneId] = useState<string>('');
  const [enableSecondaryZone, setEnableSecondaryZone] = useState<boolean>(false);
  const [secondaryZoneMaxDays, setSecondaryZoneMaxDays] = useState<number>(6);
  const [primaryBranchId, setPrimaryBranchId] = useState<string>('');
  const [allowedBranchIds, setAllowedBranchIds] = useState<string[]>([]);
  const [branchSearchTerm, setBranchSearchTerm] = useState<string>('');
  const [workRestMode, setWorkRestMode] = useState<WorkRestMode>('DAYS_PER_WEEK');
  
  // Pharmacist search dropdown state
  const [pharmacistSearchTerm, setPharmacistSearchTerm] = useState<string>('');
  const [isPharmacistDropdownOpen, setIsPharmacistDropdownOpen] = useState<boolean>(false);
  const pharmacistDropdownRef = useRef<HTMLDivElement>(null);
  const pharmacistSearchInputRef = useRef<HTMLInputElement>(null);

  // Work/Rest Mode Specific Configs
  const [targetDaysPerWeek, setTargetDaysPerWeek] = useState<number>(6);
  const [fixedRestDay, setFixedRestDay] = useState<number>(5); // Default Friday (5), -1 for None
  const [fixedCycleWorkDays, setFixedCycleWorkDays] = useState<number>(6);
  const [fixedCycleRestDays, setFixedCycleRestDays] = useState<number>(1);
  const [variableCycleStreaks, setVariableCycleStreaks] = useState<string>('6, 7, 3, 8');
  const [variableCycleResetMode, setVariableCycleResetMode] = useState<string>('RESET_ON_MONTH');
  const [customCalendarSequence, setCustomCalendarSequence] = useState<string>('W, W, W, R, W, W, R');
  const [customCalendarAnchor, setCustomCalendarAnchor] = useState<string>('');

  // Dynamic Variable Cycle states
  const [targetStreakMin, setTargetStreakMin] = useState<number>(4);
  const [targetStreakMax, setTargetStreakMax] = useState<number>(6);
  const [minRestDaysAfterStreak, setMinRestDaysAfterStreak] = useState<number>(1);
  const [maxConsecutiveDaysOverride, setMaxConsecutiveDaysOverride] = useState<string>('');

  // Constraints & Strictness (Spec §5)
  const [maxConsecutiveDays, setMaxConsecutiveDays] = useState<number>(6);
  const [minimumRestHours, setMinimumRestHours] = useState<number>(11.0);
  const [patternStrictness, setPatternStrictness] = useState<PatternStrictness>('HARD');
  const [effectiveFrom, setEffectiveFrom] = useState<string>('');
  const [effectiveTo, setEffectiveTo] = useState<string>('');
  
  const [allowedShiftTypes, setAllowedShiftTypes] = useState<string[]>(['AM', 'PM', 'NIGHT', 'FULL']);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Close modal or dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPharmacistDropdownOpen) {
          setIsPharmacistDropdownOpen(false);
        } else if (isModalOpen) {
          setIsModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isPharmacistDropdownOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isPharmacistDropdownOpen && pharmacistSearchInputRef.current) {
      pharmacistSearchInputRef.current.focus();
    }
  }, [isPharmacistDropdownOpen]);

  // Click outside to close pharmacist dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pharmacistDropdownRef.current && !pharmacistDropdownRef.current.contains(event.target as Node)) {
        setIsPharmacistDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedProfiles, fetchedEmployees, fetchedBranches, fetchedZones] = await Promise.all([
        dutySchedulerService.getProfiles(),
        workforceService.getAllEmployees(),
        branchService.getBranches(),
        dutySchedulerService.getSchedulingZones()
      ]);
      setProfiles(fetchedProfiles);
      // Read ALL pharmacists in the system (by category 'Pharmacist' or code starting with 'E' or pharmacist_id)
      const allPharmacists = fetchedEmployees
        .filter(e => e.category === 'Pharmacist' || e.code?.toUpperCase().startsWith('E') || e.pharmacist_id != null)
        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
      setEmployees(allPharmacists);
      setBranches(fetchedBranches);
      setZones(fetchedZones);
    } catch (err) {
      console.error('Failed to load profiles data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getEmployeeName = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return 'Unknown Pharmacist';
    return emp.code ? `${emp.full_name} (${emp.code})` : emp.full_name;
  };

  const getBranchName = (branchId?: string) => {
    if (!branchId) return 'N/A';
    return branches.find(b => b.id === branchId)?.name || 'Unknown Branch';
  };

  const getZoneForBranch = (branchId?: string) => {
    if (!branchId) return null;
    return zones.find(z => z.branchIds?.includes(branchId)) || null;
  };

  const getProfileZone = (profile: PharmacistSchedulingProfile) => {
    if (profile.zoneId) {
      const z = zones.find(z => z.id === profile.zoneId);
      if (z) return z;
    }
    if (profile.primaryBranchId) {
      const z = getZoneForBranch(profile.primaryBranchId);
      if (z) return z;
    }
    return null;
  };

  const getProfileZoneName = (profile: PharmacistSchedulingProfile) => {
    const z = getProfileZone(profile);
    return z ? z.name : 'Unassigned Zone';
  };

  const openCreateModal = (preselectedEmpId?: string) => {
    setEditingProfileId(null);
    setEmployeeId(preselectedEmpId || (unconfiguredPharmacists[0]?.id || employees[0]?.id || ''));
    setPharmacistSearchTerm('');
    setIsPharmacistDropdownOpen(false);
    setRoleType('FIXED');
    setZoneId(zones[0]?.id || '');
    setSecondaryZoneId('');
    setEnableSecondaryZone(false);
    setSecondaryZoneMaxDays(6);
    setPrimaryBranchId(branches[0]?.id || '');
    setAllowedBranchIds(branches.map(b => b.id));
    setWorkRestMode('DAYS_PER_WEEK');
    setTargetDaysPerWeek(6);
    setFixedRestDay(5);
    setFixedCycleWorkDays(6);
    setFixedCycleRestDays(1);
    setVariableCycleStreaks('6, 7, 3, 8');
    setVariableCycleResetMode('RESET_ON_MONTH');
    setCustomCalendarSequence('W, W, W, R, W, W, R');
    setCustomCalendarAnchor('');
    setTargetStreakMin(4);
    setTargetStreakMax(6);
    setMinRestDaysAfterStreak(1);
    setMaxConsecutiveDaysOverride('');
    setMaxConsecutiveDays(6);
    setMinimumRestHours(11.0);
    setPatternStrictness('HARD');
    setEffectiveFrom('');
    setEffectiveTo('');
    setAllowedShiftTypes(['AM', 'PM', 'NIGHT', 'FULL']);
    setIsActive(true);
    setBranchSearchTerm('');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (profile: PharmacistSchedulingProfile) => {
    setEditingProfileId(profile.id);
    setEmployeeId(profile.employeeId);
    setPharmacistSearchTerm('');
    setIsPharmacistDropdownOpen(false);
    setRoleType(profile.roleType);
    setZoneId(profile.zoneId || getProfileZone(profile)?.id || '');
    if (profile.secondaryZoneId) {
      setSecondaryZoneId(profile.secondaryZoneId);
      setEnableSecondaryZone(true);
      setSecondaryZoneMaxDays(profile.secondaryZoneMaxDays ?? 6);
    } else {
      setSecondaryZoneId('');
      setEnableSecondaryZone(false);
      setSecondaryZoneMaxDays(6);
    }
    setPrimaryBranchId(profile.primaryBranchId || '');
    setAllowedBranchIds(profile.allowedBranchIds || []);
    setWorkRestMode(profile.workRestMode);
    setMaxConsecutiveDays(profile.maximumConsecutiveWorkingDays || 6);
    setMinimumRestHours(profile.minimumRestHours !== undefined ? Number(profile.minimumRestHours) : 11.0);
    setPatternStrictness(profile.patternStrictness || 'HARD');
    setEffectiveFrom(profile.effectiveFrom || '');
    setEffectiveTo(profile.effectiveTo || '');
    setAllowedShiftTypes(profile.allowedShiftTypes?.length ? profile.allowedShiftTypes : ['AM', 'PM', 'NIGHT', 'FULL']);
    setIsActive(profile.isActive);

    const cfg = profile.workRestConfig || {};
    setTargetDaysPerWeek(cfg.targetDaysPerWeek || cfg.target_days_per_week || 6);
    setFixedRestDay(cfg.fixedRestDay !== undefined ? Number(cfg.fixedRestDay) : 5);
    setFixedCycleWorkDays(cfg.workDays || 6);
    setFixedCycleRestDays(cfg.restDays || 1);
    setVariableCycleStreaks(Array.isArray(cfg.streakLengths) ? cfg.streakLengths.join(', ') : '6, 7, 3, 8');
    setVariableCycleResetMode(cfg.resetMode || 'RESET_ON_MONTH');
    setCustomCalendarSequence(Array.isArray(cfg.sequence) ? cfg.sequence.join(', ') : 'W, W, W, R, W, W, R');
    setCustomCalendarAnchor(cfg.anchorDate || '');

    setTargetStreakMin(cfg.targetStreakMin !== undefined ? Number(cfg.targetStreakMin) : 4);
    setTargetStreakMax(cfg.targetStreakMax !== undefined ? Number(cfg.targetStreakMax) : 6);
    setMinRestDaysAfterStreak(cfg.minRestDaysAfterStreak !== undefined ? Number(cfg.minRestDaysAfterStreak) : 1);
    setMaxConsecutiveDaysOverride(
      profile.maxConsecutiveWorkingDaysOverride !== undefined && profile.maxConsecutiveWorkingDaysOverride !== null
        ? String(profile.maxConsecutiveWorkingDaysOverride)
        : ''
    );

    setBranchSearchTerm('');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!employeeId) {
      setErrorMessage('Please select a pharmacist.');
      return;
    }

    if (roleType === 'FIXED' && !primaryBranchId) {
      setErrorMessage('Fixed pharmacists require a primary branch.');
      return;
    }

    // Build configuration based on mode
    let workRestConfig: any = {};
    if (workRestMode === 'DAYS_PER_WEEK') {
      workRestConfig = { 
        targetDaysPerWeek: Number(targetDaysPerWeek), 
        fixedRestDay: fixedRestDay >= 0 ? Number(fixedRestDay) : null 
      };
    } else if (workRestMode === 'FIXED_CYCLE') {
      workRestConfig = { 
        workDays: Number(fixedCycleWorkDays), 
        restDays: Number(fixedCycleRestDays) 
      };
    } else if (workRestMode === 'VARIABLE_CYCLE') {
      const streakLengths = variableCycleStreaks
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n) && n > 0);
      if (streakLengths.length === 0) {
        setErrorMessage('Please enter at least one valid streak number for Variable Cycle.');
        return;
      }
      workRestConfig = { streakLengths, resetMode: variableCycleResetMode };
    } else if (workRestMode === 'CUSTOM_CALENDAR') {
      const sequence = customCalendarSequence
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);
      if (sequence.length === 0) {
        setErrorMessage('Please enter a valid sequence of W (Work) and R (Rest).');
        return;
      }
      workRestConfig = { sequence, anchorDate: customCalendarAnchor || undefined };
    } else if (workRestMode === 'DYNAMIC_VARIABLE_CYCLE') {
      if (targetStreakMin < 1 || targetStreakMax < 1 || targetStreakMin > targetStreakMax) {
        setErrorMessage('Invalid dynamic streak targets: min must be >= 1 and min <= max.');
        return;
      }
      workRestConfig = {
        targetStreakMin: Number(targetStreakMin),
        targetStreakMax: Number(targetStreakMax),
        minRestDaysAfterStreak: Number(minRestDaysAfterStreak || 1)
      };
    }

    setIsSaving(true);
    try {
      await dutySchedulerService.upsertProfile(
        {
          id: editingProfileId || undefined,
          employeeId,
          roleType,
          primaryBranchId: roleType === 'FIXED' ? primaryBranchId : undefined,
          zoneId: zoneId || undefined,
          secondaryZoneId: enableSecondaryZone && secondaryZoneId ? secondaryZoneId : undefined,
          secondaryZoneMaxDays: enableSecondaryZone ? Number(secondaryZoneMaxDays || 0) : 0,
          workRestMode,
          workRestConfig,
          patternStrictness,
          maximumConsecutiveWorkingDays: Number(maxConsecutiveDays),
          maxConsecutiveWorkingDaysOverride: maxConsecutiveDaysOverride.trim() !== '' ? Number(maxConsecutiveDaysOverride) : null,
          minimumRestHours: Number(minimumRestHours),
          isActive,
          effectiveFrom: effectiveFrom || undefined,
          effectiveTo: effectiveTo || undefined
        },
        allowedBranchIds,
        allowedShiftTypes
      );

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setErrorMessage(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this scheduling profile?')) return;

    try {
      await dutySchedulerService.deleteProfile(profileId);
      await loadData();
    } catch (err) {
      console.error('Error deleting profile:', err);
      alert('Failed to delete profile');
    }
  };

  const toggleBranchSelection = (bId: string) => {
    setAllowedBranchIds(prev =>
      prev.includes(bId) ? prev.filter(id => id !== bId) : [...prev, bId]
    );
  };

  const toggleShiftSelection = (shift: string) => {
    setAllowedShiftTypes(prev =>
      prev.includes(shift) ? prev.filter(s => s !== shift) : [...prev, shift]
    );
  };

  const getModeSummary = (profile: PharmacistSchedulingProfile) => {
    const cfg = profile.workRestConfig || {};
    switch (profile.workRestMode) {
      case 'DAYS_PER_WEEK': {
        const days = cfg.targetDaysPerWeek || cfg.target_days_per_week || 6;
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const rest = cfg.fixedRestDay !== undefined && cfg.fixedRestDay >= 0 ? `${dayNames[cfg.fixedRestDay]} off` : 'Rotating off';
        return `${days} days/week (${rest})`;
      }
      case 'FIXED_CYCLE':
        return `Cycle: ${cfg.workDays || 6} on / ${cfg.restDays || 1} off`;
      case 'VARIABLE_CYCLE':
        return `Variable: [${Array.isArray(cfg.streakLengths) ? cfg.streakLengths.join(', ') : '6, 7, 3, 8'}]`;
      case 'CUSTOM_CALENDAR':
        return `Custom Calendar (${Array.isArray(cfg.sequence) ? cfg.sequence.length : 7} steps)`;
      case 'DYNAMIC_VARIABLE_CYCLE':
        return `Dynamic Cycle: target ${cfg.targetStreakMin ?? 4}-${cfg.targetStreakMax ?? 6} on / ${cfg.minRestDaysAfterStreak ?? 1} off`;
      default:
        return profile.workRestMode;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 text-brand animate-spin" />
      </div>
    );
  }

  // Active pharmacists lacking profiles
  const configuredEmployeeIds = new Set(profiles.map(p => p.employeeId));
  const unconfiguredPharmacists = employees.filter(e => !configuredEmployeeIds.has(e.id));

  // Filtered pharmacists for modal searchable dropdown
  const filteredPharmacists = employees.filter(emp => {
    const term = pharmacistSearchTerm.trim().toLowerCase();
    if (!term) return true;
    const nameMatch = (emp.full_name || '').toLowerCase().includes(term);
    const codeMatch = (emp.code || '').toLowerCase().includes(term);
    const cprMatch = (emp.cpr_number || '').includes(term);
    return nameMatch || codeMatch || cprMatch;
  });

  const selectedPharmacist = employees.find(e => e.id === employeeId);

  // Filtered branches for modal branch picker
  const filteredBranches = branches.filter(b => 
    (b.name || '').toLowerCase().includes(branchSearchTerm.toLowerCase()) ||
    (b.code || '').toLowerCase().includes(branchSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Pharmacist Scheduling Profiles</h2>
          <p className="text-sm text-slate-500 mt-1">Configure work/rest patterns, minimum rest, allowed shifts, and strictness rules.</p>
        </div>
        <button 
          onClick={() => openCreateModal()}
          className="flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-lg hover:bg-brand-dark transition-all shadow-sm font-medium hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          <span>New Profile</span>
        </button>
      </div>

      {unconfiguredPharmacists.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-800">Action Required: Unconfigured Pharmacists</h4>
              <p className="text-sm text-amber-700 mt-1">
                There are {unconfiguredPharmacists.length} active pharmacists without a scheduling profile: {unconfiguredPharmacists.slice(0, 3).map(e => e.full_name).join(', ')}{unconfiguredPharmacists.length > 3 ? '...' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => openCreateModal(unconfiguredPharmacists[0]?.id)}
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Configure First
          </button>
        </div>
      )}

      {/* Zone Filter Tab Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          type="button"
          onClick={() => setSelectedZoneTab('ALL')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
            selectedZoneTab === 'ALL'
              ? 'bg-brand text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All Zones ({profiles.length})
        </button>
        {zones.map(z => {
          const primaryCount = profiles.filter(p => getProfileZone(p)?.id === z.id).length;
          const secondaryCount = profiles.filter(p => p.secondaryZoneId === z.id && (p.secondaryZoneMaxDays || 0) > 0).length;
          const totalCount = primaryCount + secondaryCount;
          return (
            <button
              type="button"
              key={z.id}
              onClick={() => setSelectedZoneTab(z.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                selectedZoneTab === z.id
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{z.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedZoneTab === z.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {secondaryCount > 0 ? `${primaryCount} + ${secondaryCount} sec` : totalCount}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setSelectedZoneTab('UNASSIGNED')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
            selectedZoneTab === 'UNASSIGNED'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-amber-50/70 border border-amber-200 text-amber-800 hover:bg-amber-100'
          }`}
        >
          Unassigned ({profiles.filter(p => !getProfileZone(p)).length})
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.filter(p => {
          if (selectedZoneTab === 'ALL') return true;
          const pz = getProfileZone(p);
          if (selectedZoneTab === 'UNASSIGNED') return !pz;
          return pz?.id === selectedZoneTab || (p.secondaryZoneId === selectedZoneTab && (p.secondaryZoneMaxDays || 0) > 0);
        }).length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
            <BriefcaseMedical className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No profiles found in this zone view.</p>
            <p className="text-sm mt-1">Create or reassign profiles to start generating automated schedules.</p>
          </div>
        ) : (
          profiles.filter(p => {
            if (selectedZoneTab === 'ALL') return true;
            const pz = getProfileZone(p);
            if (selectedZoneTab === 'UNASSIGNED') return !pz;
            return pz?.id === selectedZoneTab || (p.secondaryZoneId === selectedZoneTab && (p.secondaryZoneMaxDays || 0) > 0);
          }).map(profile => {
            const isSecondaryInView = selectedZoneTab !== 'ALL' && profile.secondaryZoneId === selectedZoneTab;

            return (
              <div key={profile.id} className={`bg-white border rounded-xl p-5 hover:shadow-md transition-all group flex flex-col justify-between ${
                isSecondaryInView ? 'border-purple-300 bg-purple-50/15 ring-1 ring-purple-200' : 'border-slate-200 hover:border-brand/40'
              }`}>
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        isSecondaryInView ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500 group-hover:bg-brand/10 group-hover:text-brand'
                      }`}>
                        <UserCircle2 className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 line-clamp-1" title={getEmployeeName(profile.employeeId)}>
                          {getEmployeeName(profile.employeeId)}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${profile.roleType === 'FIXED' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'}`}>
                            {profile.roleType}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${profile.patternStrictness === 'HARD' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                            {profile.patternStrictness}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand/10 text-brand flex items-center gap-1 border border-brand/20">
                            <Layers className="h-2.5 w-2.5" />
                            {getProfileZoneName(profile)}
                          </span>
                          {profile.secondaryZoneId && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 flex items-center gap-1 border border-purple-200" title={`Secondary: max ${profile.secondaryZoneMaxDays || 0} days`}>
                              <Layers className="h-2.5 w-2.5 text-purple-500" />
                              + {profile.secondaryZoneName || zones.find(z => z.id === profile.secondaryZoneId)?.name || 'Sec Zone'} ({profile.secondaryZoneMaxDays || 0}d)
                            </span>
                          )}
                        </div>
                        {/* Regulatory & Compliance Badges */}
                        {(() => {
                          const emp = employees.find(e => e.id === profile.employeeId);
                          const nhraExp = emp?.salary_matrix?.nhraExpiryDate || emp?.nhra_expiry_date;
                          const nhraNo = emp?.salary_matrix?.nhraLicenseNo || emp?.nhra_license_no || emp?.license;
                          const wpExp = emp?.wp_expiry_date || emp?.salary_matrix?.wpExpiryDate || emp?.salary_matrix?.visaExpiryDate;
                          const todayStr = new Date().toISOString().split('T')[0];
                          const isNhraExpired = Boolean(nhraExp && nhraExp < todayStr);
                          const isWpExpired = Boolean(wpExp && wpExp < todayStr);

                          if (!nhraExp && !nhraNo && !wpExp) return null;

                          return (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-100">
                              {nhraExp && (
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                                  isNhraExpired
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                  <BriefcaseMedical className="h-2.5 w-2.5" />
                                  <span>{isNhraExpired ? 'NHRA Expired:' : 'NHRA:'} {nhraExp}</span>
                                </span>
                              )}
                              {wpExp && isWpExpired && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                  <AlertCircle className="h-2.5 w-2.5 text-amber-600" />
                                  <span>WP Expired: {wpExp}</span>
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openEditModal(profile)}
                        title="Edit Profile"
                        className="text-slate-400 hover:text-brand transition-colors p-1.5 rounded-md hover:bg-brand/5"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteProfile(profile.id)}
                        title="Delete Profile"
                        className="text-slate-400 hover:text-red-600 transition-colors p-1.5 rounded-md hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Secondary support callout badge if viewed inside secondary zone */}
                  {isSecondaryInView && (
                    <div className="mb-3 p-2 rounded-lg bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-center justify-between">
                      <span className="flex items-center gap-1 font-bold text-[11px]">
                        <Layers className="h-3.5 w-3.5 text-purple-600" />
                        Secondary Support Pharmacist for this Zone
                      </span>
                      <span className="px-2 py-0.5 rounded-full font-bold bg-purple-200 text-purple-900 text-[10px]">
                        Available up to {profile.secondaryZoneMaxDays || 0} days max
                      </span>
                    </div>
                  )}

                {profile.primaryBranchId && (
                  <div className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                    <span className="font-medium text-slate-600">Primary:</span>
                    <span className="truncate">{getBranchName(profile.primaryBranchId)}</span>
                  </div>
                )}
                
                <div className="space-y-1.5 text-xs border-t border-slate-100 pt-3 text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pattern:</span>
                    <span className="font-semibold text-slate-700 truncate">{getModeSummary(profile)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Min Rest / Max Work:</span>
                    <span className="font-medium text-slate-700">
                      {profile.minimumRestHours || 11}h rest / {profile.maximumConsecutiveWorkingDays || 6}d work
                      {profile.maxConsecutiveWorkingDaysOverride != null && (
                        <span className="ml-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          Override: {profile.maxConsecutiveWorkingDaysOverride}d
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Allowed Shifts:</span>
                    <span className="font-medium text-slate-700">
                      {profile.allowedShiftTypes?.length ? profile.allowedShiftTypes.join(', ') : 'All Shifts'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Branches:</span>
                    <span className="font-medium text-slate-700">
                      {profile.allowedBranchIds?.length ? `${profile.allowedBranchIds.length} branches` : 'All branches'}
                    </span>
                  </div>
                  {(profile.effectiveFrom || profile.effectiveTo) && (
                    <div className="flex justify-between text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded mt-1">
                      <span>Effective:</span>
                      <span>{profile.effectiveFrom || 'Start'} → {profile.effectiveTo || 'End'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }))}
      </div>

      {/* Create / Edit Profile Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* 1. Header (Sticky) */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold shadow-xs">
                  <BriefcaseMedical className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800 leading-tight">
                    {editingProfileId ? 'Edit Pharmacist Profile' : 'New Pharmacist Profile'}
                  </h3>
                  <p className="text-xs text-slate-500">Configure scheduling rotation, constraints, and branch coverage</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 2. Form wrapping Scrollable Body + Sticky Footer */}
            <form onSubmit={handleSaveProfile} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              
              {/* Scrollable Body: scrolls naturally with custom-scrollbar if content exceeds height */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar">
                {errorMessage && (
                  <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                    <span className="font-medium">{errorMessage}</span>
                  </div>
                )}

                {/* Section 1: Pharmacist & Role Assignment */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Pharmacist & Core Assignment</h4>
                      <p className="text-[11px] text-slate-500">Select employee and primary branch commitment</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Searchable Pharmacist Dropdown Menu */}
                    <div className="relative col-span-1 sm:col-span-2 md:col-span-2" ref={pharmacistDropdownRef}>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          Pharmacist <span className="text-red-500">*</span>
                        </span>
                        <span className="text-[11px] font-medium text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                          {employees.length} Pharmacists Registered
                        </span>
                      </label>

                      {/* Trigger button displaying selected pharmacist or placeholder */}
                      <button
                        type="button"
                        disabled={!!editingProfileId}
                        onClick={() => {
                          if (!editingProfileId) {
                            setIsPharmacistDropdownOpen(prev => !prev);
                            setPharmacistSearchTerm('');
                          }
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-xl text-sm transition-all text-left ${
                          editingProfileId
                            ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                            : isPharmacistDropdownOpen
                              ? 'bg-white border-brand ring-2 ring-brand/20 shadow-sm'
                              : 'bg-white border-slate-300 hover:border-slate-400 text-slate-800 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            selectedPharmacist ? 'bg-brand/10 text-brand' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <User className="h-4 w-4" />
                          </div>
                          {selectedPharmacist ? (
                            <div className="truncate flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 truncate">
                                {selectedPharmacist.full_name}
                              </span>
                              {selectedPharmacist.code && (
                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                                  {selectedPharmacist.code}
                                </span>
                              )}
                              {selectedPharmacist.status !== 'Active' && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                  {selectedPharmacist.status}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-normal">
                              Select Pharmacist ({employees.length} available)...
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 text-slate-400 ml-2">
                          {selectedPharmacist && !editingProfileId && (
                            <span
                              role="button"
                              tabIndex={0}
                              title="Clear selection"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEmployeeId('');
                                setPharmacistSearchTerm('');
                              }}
                              className="p-1 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${
                            isPharmacistDropdownOpen ? 'rotate-180 text-brand' : ''
                          }`} />
                        </div>
                      </button>

                      {/* Searchable Dropdown Menu Popover */}
                      {isPharmacistDropdownOpen && !editingProfileId && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                          {/* Search Input Bar */}
                          <div className="p-2.5 border-b border-slate-100 bg-slate-50/80">
                            <div className="relative">
                              <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <input
                                ref={pharmacistSearchInputRef}
                                type="text"
                                placeholder="Search by name, code (e.g. E078, Ahmed)..."
                                value={pharmacistSearchTerm}
                                onChange={(e) => setPharmacistSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                                onClick={(e) => e.stopPropagation()}
                              />
                              {pharmacistSearchTerm && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPharmacistSearchTerm('');
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-400 px-1 mt-1.5 font-medium">
                              <span>Showing {filteredPharmacists.length} of {employees.length} pharmacists</span>
                              <span>Instant search by name or code</span>
                            </div>
                          </div>

                          {/* Pharmacists List */}
                          <div className="max-h-60 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                            {filteredPharmacists.length === 0 ? (
                              <div className="p-6 text-center text-slate-400 text-xs">
                                <AlertCircle className="h-5 w-5 mx-auto mb-1.5 text-slate-300" />
                                No pharmacist matches "{pharmacistSearchTerm}"
                              </div>
                            ) : (
                              filteredPharmacists.map(emp => {
                                const isSelected = emp.id === employeeId;
                                const isConfigured = configuredEmployeeIds.has(emp.id);
                                return (
                                  <div
                                    key={emp.id}
                                    onClick={() => {
                                      setEmployeeId(emp.id);
                                      setIsPharmacistDropdownOpen(false);
                                      setPharmacistSearchTerm('');
                                    }}
                                    className={`px-3 py-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                                      isSelected
                                        ? 'bg-brand/10 font-bold text-brand'
                                        : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 truncate min-w-0">
                                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                        isSelected ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500'
                                      }`}>
                                        <User className="h-3.5 w-3.5" />
                                      </div>
                                      <div className="truncate">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-slate-900 truncate">
                                            {emp.full_name}
                                          </span>
                                          {emp.code && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                              {emp.code}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                          <span className={`inline-flex items-center gap-1 ${
                                            emp.status === 'Active' ? 'text-emerald-600' : 'text-slate-400'
                                          }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                              emp.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'
                                            }`} />
                                            {emp.status === 'Active' ? 'Active' : 'Inactive'}
                                          </span>
                                          {isConfigured && (
                                            <span className="text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded font-medium border border-purple-200">
                                              Profile Configured
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {isSelected && (
                                      <div className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center shrink-0 ml-2">
                                        <Check className="h-3 w-3 stroke-[3]" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        Stationed Zone
                      </label>
                      <select
                        value={zoneId}
                        onChange={e => {
                          const newZId = e.target.value;
                          setZoneId(newZId);
                          const zObj = zones.find(z => z.id === newZId);
                          if (zObj && zObj.branchIds?.length) {
                            if (!primaryBranchId || !zObj.branchIds.includes(primaryBranchId)) {
                              setPrimaryBranchId(zObj.branchIds[0]);
                            }
                            setAllowedBranchIds(Array.from(new Set([...allowedBranchIds, ...zObj.branchIds])));
                          }
                        }}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand font-bold text-slate-800 shadow-2xs"
                      >
                        <option value="">Auto-detect from Branch</option>
                        {zones.map(z => (
                          <option key={z.id} value={z.id}>
                            {z.name} ({z.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        Role Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={roleType}
                        onChange={e => setRoleType(e.target.value as PharmacistRoleType)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand font-medium shadow-2xs"
                      >
                        <option value="FIXED">FIXED (Branch-Dedicated)</option>
                        <option value="RELIEF">RELIEF (Floating Coverage)</option>
                      </select>
                    </div>

                    <div className="col-span-1 sm:col-span-2 md:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        Primary Branch {roleType === 'FIXED' && <span className="text-red-500">*</span>}
                      </label>
                      <select
                        value={primaryBranchId}
                        onChange={e => {
                          const bId = e.target.value;
                          setPrimaryBranchId(bId);
                          if (!zoneId) {
                            const matchedZone = getZoneForBranch(bId);
                            if (matchedZone) setZoneId(matchedZone.id);
                          }
                        }}
                        required={roleType === 'FIXED'}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand font-medium shadow-2xs"
                      >
                        <option value="">Select Primary Branch</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Multi-Zone: Secondary Zone Support with Quota */}
                    <div className="col-span-1 md:col-span-2 p-3.5 rounded-xl border border-purple-200 bg-purple-50/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={enableSecondaryZone}
                            onChange={e => {
                              setEnableSecondaryZone(e.target.checked);
                              if (e.target.checked && !secondaryZoneId) {
                                const otherZone = zones.find(z => z.id !== zoneId);
                                if (otherZone) setSecondaryZoneId(otherZone.id);
                              }
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                          />
                          <span className="text-xs font-bold text-purple-950">
                            Enable Secondary Zone Support
                          </span>
                        </label>
                        {enableSecondaryZone && (
                          <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                            Cross-Zone Active
                          </span>
                        )}
                      </div>

                      {enableSecondaryZone && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-purple-200/60">
                          <div>
                            <label className="block text-xs font-bold text-purple-900 mb-1">
                              Secondary Zone
                            </label>
                            <select
                              value={secondaryZoneId}
                              onChange={e => setSecondaryZoneId(e.target.value)}
                              className="w-full px-3 py-1.5 border border-purple-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500 font-bold text-slate-800"
                            >
                              <option value="">Select Secondary Zone</option>
                              {zones.filter(z => z.id !== zoneId).map(z => (
                                <option key={z.id} value={z.id}>
                                  {z.name} ({z.code})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-purple-900 mb-1">
                              Max Days in Secondary Zone (Quota Cap)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                max="31"
                                value={secondaryZoneMaxDays}
                                onChange={e => setSecondaryZoneMaxDays(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full px-3 py-1.5 border border-purple-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500 font-bold text-slate-800"
                                placeholder="e.g. 6"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-purple-600">
                                days / period
                              </span>
                            </div>
                          </div>

                          <div className="col-span-full">
                            <p className="text-[11px] text-purple-800 bg-purple-100/60 p-2 rounded-lg leading-relaxed flex items-start gap-1.5">
                              <Info className="h-3.5 w-3.5 text-purple-700 shrink-0 mt-0.5" />
                              <span><span className="font-bold">Operational Notice:</span> The secondary zone scheduler will automatically see this pharmacist as available up to <span className="font-bold">{secondaryZoneMaxDays} days max</span> during the scheduling period, and the engine will never exceed this quota.</span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 2: Work & Rest Rotation Pattern */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Work & Rest Rotation Engine</h4>
                      <p className="text-[11px] text-slate-500">Define the weekly rhythm or cyclic rotation schedule</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Rotation Model
                    </label>
                    <select
                      value={workRestMode}
                      onChange={e => setWorkRestMode(e.target.value as WorkRestMode)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand font-semibold text-slate-800"
                    >
                      <option value="DAYS_PER_WEEK">1. Days Per Week (Target weekly working days with designated rest)</option>
                      <option value="FIXED_CYCLE">2. Fixed Rotation Cycle (Repeating streak of work and rest days e.g. 6 on / 1 off)</option>
                      <option value="CUSTOM_CALENDAR">3. Custom Calendar Pattern (Explicit sequence of daily shifts & rests)</option>
                      <option value="DYNAMIC_VARIABLE_CYCLE">4. Dynamic Variable Cycle (Intelligent CSP-Based Rotation Solver)</option>
                    </select>
                  </div>

                  {/* Mode-Specific Parameter Card */}
                  <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-4">
                    {workRestMode === 'DAYS_PER_WEEK' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Target Working Days / Week</label>
                          <input 
                            type="number" 
                            min={1} 
                            max={7} 
                            value={targetDaysPerWeek} 
                            onChange={e => setTargetDaysPerWeek(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                          />
                          <span className="text-[11px] text-slate-400 mt-1 block">Default standard is 6 working days</span>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Fixed Weekly Rest Day</label>
                          <select
                            value={fixedRestDay}
                            onChange={e => setFixedRestDay(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                          >
                            <option value={-1}>Rotating (No fixed day)</option>
                            <option value={5}>Friday (Default)</option>
                            <option value={6}>Saturday</option>
                            <option value={0}>Sunday</option>
                            <option value={1}>Monday</option>
                            <option value={2}>Tuesday</option>
                            <option value={3}>Wednesday</option>
                            <option value={4}>Thursday</option>
                          </select>
                          <span className="text-[11px] text-slate-400 mt-1 block">Assigned regular weekly day off</span>
                        </div>
                      </div>
                    )}

                    {workRestMode === 'FIXED_CYCLE' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Consecutive Working Days</label>
                          <input 
                            type="number" 
                            min={1} 
                            max={14} 
                            value={fixedCycleWorkDays} 
                            onChange={e => setFixedCycleWorkDays(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                          />
                          <span className="text-[11px] text-slate-400 mt-1 block">Number of days worked before rest</span>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Consecutive Rest Days</label>
                          <input 
                            type="number" 
                            min={1} 
                            max={7} 
                            value={fixedCycleRestDays} 
                            onChange={e => setFixedCycleRestDays(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                          />
                          <span className="text-[11px] text-slate-400 mt-1 block">Number of continuous rest days</span>
                        </div>
                      </div>
                    )}

                    {workRestMode === 'CUSTOM_CALENDAR' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Sequence (W for Work, R for Rest)
                          </label>
                          <input 
                            type="text" 
                            placeholder="e.g. W, W, W, R, W, W, R" 
                            value={customCalendarSequence} 
                            onChange={e => setCustomCalendarSequence(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand font-mono uppercase"
                          />
                          <span className="text-[11px] text-slate-400 mt-1 block">Repeating letter-coded daily sequence</span>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Anchor Date (Optional)</label>
                          <input 
                            type="date" 
                            value={customCalendarAnchor} 
                            onChange={e => setCustomCalendarAnchor(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                          />
                          <span className="text-[11px] text-slate-400 mt-1 block">Reference date aligning sequence index 0</span>
                        </div>
                      </div>
                    )}

                    {workRestMode === 'DYNAMIC_VARIABLE_CYCLE' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Target Min Streak (Days)</label>
                          <input 
                            type="number" 
                            min={1} 
                            max={14} 
                            value={targetStreakMin} 
                            onChange={e => setTargetStreakMin(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                          />
                          <span className="text-[11px] text-slate-400 mt-1 block">Soft lower bound (e.g. 4)</span>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Target Max Streak (Days)</label>
                          <input 
                            type="number" 
                            min={1} 
                            max={14} 
                            value={targetStreakMax} 
                            onChange={e => setTargetStreakMax(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                          />
                          <span className="text-[11px] text-slate-400 mt-1 block">Soft upper bound (e.g. 6)</span>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Min Rest After Streak (Days)</label>
                          <input 
                            type="number" 
                            min={1} 
                            max={7} 
                            value={minRestDaysAfterStreak} 
                            onChange={e => setMinRestDaysAfterStreak(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                          />
                          <span className="text-[11px] text-slate-400 mt-1 block">Mandatory rest days after streak (e.g. 1)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3: Safety Limits & Effective Period */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Safety Limits & Validity Period</h4>
                      <p className="text-[11px] text-slate-500">Labor law rest constraints, maximum streak ceilings, and profile validity</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        Min Rest (Hours)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min={8}
                        max={24}
                        value={minimumRestHours}
                        onChange={e => setMinimumRestHours(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand font-medium"
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">Standard legal: 11.0h between shifts</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        Safety Max Streak
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={14}
                        value={maxConsecutiveDays}
                        onChange={e => setMaxConsecutiveDays(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand font-medium"
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">Hard maximum continuous working days</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        Max Consecutive Ceiling Override (Optional)
                      </label>
                      <input
                        type="number"
                        min={1}
                        placeholder="Inherit Control Center"
                        value={maxConsecutiveDaysOverride}
                        onChange={e => setMaxConsecutiveDaysOverride(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand font-medium placeholder:font-normal placeholder:text-slate-400"
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">Overrides global ceiling (higher or lower)</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        Pattern Strictness
                      </label>
                      <select
                        value={patternStrictness}
                        onChange={e => setPatternStrictness(e.target.value as PatternStrictness)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand font-medium"
                      >
                        <option value="HARD">HARD (Mandatory - Never deviate)</option>
                        <option value="SOFT">SOFT (Preferred - Allow coverage flex)</option>
                      </select>
                      <span className="text-[11px] text-slate-400 mt-1 block">Engine adherence rigidity</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Effective From</label>
                      <input 
                        type="date"
                        value={effectiveFrom}
                        onChange={e => setEffectiveFrom(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">Leave empty for start of time</span>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Effective To</label>
                      <input 
                        type="date"
                        value={effectiveTo}
                        onChange={e => setEffectiveTo(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">Leave empty for open-ended active</span>
                    </div>
                  </div>
                </div>

                {/* Section 4: Eligibility & Coverage */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                    <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Branch & Shift Coverage Eligibility</h4>
                      <p className="text-[11px] text-slate-500">Specify branches and daily shifts this pharmacist is certified to work</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Allowed Branches (2 cols on lg) */}
                    <div className="lg:col-span-2 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                          Allowed Branches ({allowedBranchIds.length} of {branches.length} selected)
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Filter branches..."
                              value={branchSearchTerm}
                              onChange={e => setBranchSearchTerm(e.target.value)}
                              className="pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand w-36 sm:w-44"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setAllowedBranchIds(branches.map(b => b.id))}
                            className="text-xs text-brand font-semibold hover:underline"
                          >
                            All
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => setAllowedBranchIds([])}
                            className="text-xs text-slate-500 font-semibold hover:underline"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 border border-slate-200/80 rounded-xl p-3 max-h-52 overflow-y-auto overscroll-contain bg-slate-50/50 custom-scrollbar">
                        {filteredBranches.map(b => {
                          const isSelected = allowedBranchIds.includes(b.id);
                          const isPrimary = b.id === primaryBranchId;
                          return (
                            <div
                              key={b.id}
                              onClick={() => toggleBranchSelection(b.id)}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-brand/5 border-brand/50 text-brand font-semibold shadow-2xs'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 text-white text-[10px] ${isSelected ? 'bg-brand' : 'border border-slate-300 bg-white'}`}>
                                {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                              </div>
                              <span className="truncate flex-1">{b.name}</span>
                              {isPrimary && (
                                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold shrink-0">
                                  Primary
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {filteredBranches.length === 0 && (
                          <div className="col-span-full py-4 text-center text-xs text-slate-400">
                            No branches matching "{branchSearchTerm}"
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Allowed Shifts (1 col on lg) */}
                    <div className="space-y-2.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                        Allowed Shift Types
                      </label>
                      <div className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/50 space-y-2">
                        {[
                          { code: 'AM', label: 'Morning Shift', time: '08:00 - 16:00', color: 'text-amber-700 bg-amber-50 border-amber-200' },
                          { code: 'PM', label: 'Evening Shift', time: '16:00 - 00:00', color: 'text-blue-700 bg-blue-50 border-blue-200' },
                          { code: 'NIGHT', label: 'Night Shift', time: '00:00 - 08:00', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                          { code: 'FULL', label: 'Full Duty', time: 'Coverage Shift', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
                        ].map(shift => {
                          const isSelected = allowedShiftTypes.includes(shift.code);
                          return (
                            <div
                              key={shift.code}
                              onClick={() => toggleShiftSelection(shift.code)}
                              className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-white border-brand/50 shadow-xs ring-1 ring-brand/20'
                                  : 'bg-white/60 border-slate-200 text-slate-500 hover:bg-white'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 text-white text-[10px] ${isSelected ? 'bg-brand' : 'border border-slate-300 bg-white'}`}>
                                  {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                                </div>
                                <div>
                                  <span className={`font-bold ${isSelected ? 'text-slate-800' : 'text-slate-600'}`}>
                                    {shift.code}
                                  </span>
                                  <span className="text-[11px] text-slate-400 ml-1.5">({shift.label})</span>
                                </div>
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${shift.color}`}>
                                {shift.time}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Sticky Bottom Footer Bar: Always visible without scrolling */}
              <div className="px-6 py-3.5 border-t border-slate-200/80 bg-slate-50/95 backdrop-blur-sm flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0 rounded-b-2xl">
                {/* Active Toggle Switch */}
                <div 
                  onClick={() => setIsActive(!isActive)}
                  className="flex items-center gap-2.5 cursor-pointer select-none py-1"
                >
                  <div
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      isActive ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        isActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">
                    Profile Active for Duty Scheduling
                  </span>
                </div>

                {/* Cancel and Submit Actions */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-brand text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>{editingProfileId ? 'Update Profile' : 'Save Profile'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
