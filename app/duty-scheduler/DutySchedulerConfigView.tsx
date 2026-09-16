import React, { useEffect, useState } from 'react';
import { DutySchedulerSettings, WorkRestMode, AppUser, BranchZone, BranchShiftType, BranchArea } from '../../types';
import { dutySchedulerService } from '../../services/dutySchedulerService';
import { branchService } from '../../services/branchService';
import { 
  Loader2, 
  Save, 
  Settings2, 
  Sliders, 
  Shield, 
  Scale, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  Building2, 
  Layers, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  X, 
  AlertCircle,
  Sun,
  Moon,
  Sunset,
  CalendarCheck,
  Store,
  Compass,
  MapPin
} from 'lucide-react';

interface DutySchedulerConfigViewProps {
  user?: AppUser;
  canEdit?: boolean;
}

type ConfigTab = 'zones' | 'pharmacies' | 'policies';

export const DutySchedulerConfigView: React.FC<DutySchedulerConfigViewProps> = ({ user, canEdit = true }) => {
  const [activeTab, setActiveTab] = useState<ConfigTab>('zones');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Settings State
  const [settings, setSettings] = useState<DutySchedulerSettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [minRestHours, setMinRestHours] = useState<number>(11.0);
  const [maxConsecutiveDays, setMaxConsecutiveDays] = useState<number>(6);
  const [defaultWorkRestMode, setDefaultWorkRestMode] = useState<WorkRestMode>('DAYS_PER_WEEK');
  const [defaultRestDaysPerPeriod, setDefaultRestDaysPerPeriod] = useState<number>(4);
  const [globalMaxConsecutiveDays, setGlobalMaxConsecutiveDays] = useState<number>(8);
  const [amWeight, setAmWeight] = useState<number>(1.0);
  const [pmWeight, setPmWeight] = useState<number>(1.0);
  const [nightWeight, setNightWeight] = useState<number>(1.25);
  const [fullWeight, setFullWeight] = useState<number>(1.0);
  const [weekendBonus, setWeekendBonus] = useState<number>(0.25);
  const [weekendDays, setWeekendDays] = useState<number[]>([5]); // 5 = Friday
  const [fairnessWeight, setFairnessWeight] = useState<number>(1.0);
  const [continuityWeight, setContinuityWeight] = useState<number>(1.0);

  // Zones State
  const [zones, setZones] = useState<BranchZone[]>([]);
  const [areas, setAreas] = useState<BranchArea[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchShiftTypes, setBranchShiftTypes] = useState<BranchShiftType[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  // Zone Modal State
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [zoneCode, setZoneCode] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [zoneNotes, setZoneNotes] = useState('');
  const [isSavingZone, setIsSavingZone] = useState(false);

  // Pharmacies Filter State
  const [branchSearch, setBranchSearch] = useState('');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('ALL');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('ALL');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('ALL');
  const [actionLoadingBranchId, setActionLoadingBranchId] = useState<string | null>(null);

  // Custom Shift Modal
  const [customShiftBranch, setCustomShiftBranch] = useState<any | null>(null);
  const [customShifts, setCustomShifts] = useState<Partial<BranchShiftType>[]>([]);
  const [isSavingCustomShifts, setIsSavingCustomShifts] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [fetchedSettings, fetchedZones, fetchedBranches, fetchedShifts, fetchedProfiles, fetchedAreas] = await Promise.all([
        dutySchedulerService.getDutySchedulerSettings(),
        dutySchedulerService.getSchedulingZones(),
        branchService.getBranches(),
        dutySchedulerService.getBranchShiftTypes(),
        dutySchedulerService.getProfiles(),
        dutySchedulerService.getAreas()
      ]);

      // Populate Settings
      setSettings(fetchedSettings);
      setMinRestHours(fetchedSettings.defaultMinimumRestHours);
      setMaxConsecutiveDays(fetchedSettings.defaultMaximumConsecutiveWorkingDays);
      setDefaultWorkRestMode(fetchedSettings.defaultWorkRestMode);
      setDefaultRestDaysPerPeriod(fetchedSettings.defaultRestDaysPerPeriod ?? 4);
      setGlobalMaxConsecutiveDays(fetchedSettings.globalMaxConsecutiveDays ?? 8);
      setAmWeight(fetchedSettings.shiftWeights?.AM ?? 1.0);
      setPmWeight(fetchedSettings.shiftWeights?.PM ?? 1.0);
      setNightWeight(fetchedSettings.shiftWeights?.NIGHT ?? 1.25);
      setFullWeight(fetchedSettings.shiftWeights?.FULL ?? 1.0);
      setWeekendBonus(fetchedSettings.shiftWeights?.weekend_bonus ?? 0.25);
      setWeekendDays(fetchedSettings.weekendDays || [5]);
      setFairnessWeight(fetchedSettings.fairnessWeight);
      setContinuityWeight(fetchedSettings.continuityWeight);

      // Populate Zones, Branches, Shifts, Profiles, Areas
      setZones(fetchedZones);
      setBranches(fetchedBranches);
      setBranchShiftTypes(fetchedShifts);
      setProfiles(fetchedProfiles);
      setAreas(fetchedAreas);
    } catch (err: any) {
      console.error('Failed to load scheduling configuration:', err);
      setErrorMessage(err.message || 'Failed to load scheduling configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeBranchArea = async (branchId: string, newAreaId: string) => {
    setActionLoadingBranchId(branchId);
    try {
      await dutySchedulerService.assignBranchToArea(branchId, newAreaId || null);
      setBranches(prev => prev.map(b => b.id === branchId ? { ...b, regionId: newAreaId || null } : b));
      showNotification('Updated pharmacy Area successfully.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update pharmacy area.');
    } finally {
      setActionLoadingBranchId(null);
    }
  };

  const showNotification = (msg: string) => {
    setSaveSuccess(msg);
    setTimeout(() => setSaveSuccess(null), 3500);
  };

  // --- 1. Settings Save Handler ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    setIsSavingSettings(true);
    setErrorMessage(null);

    try {
      const payload: Partial<DutySchedulerSettings> = {
        defaultMinimumRestHours: Number(minRestHours),
        defaultMaximumConsecutiveWorkingDays: Number(maxConsecutiveDays),
        defaultWorkRestMode,
        defaultRestDaysPerPeriod: Number(defaultRestDaysPerPeriod),
        globalMaxConsecutiveDays: Number(globalMaxConsecutiveDays),
        shiftWeights: {
          AM: Number(amWeight),
          PM: Number(pmWeight),
          NIGHT: Number(nightWeight),
          FULL: Number(fullWeight),
          weekend_bonus: Number(weekendBonus)
        },
        weekendDays,
        fairnessWeight: Number(fairnessWeight),
        continuityWeight: Number(continuityWeight)
      };

      const updated = await dutySchedulerService.updateDutySchedulerSettings(payload, user?.userId);
      setSettings(updated);
      showNotification('Global scheduling policy & safety rules saved successfully.');
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setErrorMessage(err.message || 'Failed to save configuration.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const toggleWeekendDay = (day: number) => {
    setWeekendDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  // --- 2. Zone Handlers ---
  const openNewZoneModal = () => {
    setEditingZoneId(null);
    setZoneCode(`ZONE-${zones.length + 1}`);
    setZoneName(`Zone ${zones.length + 1} Schedule`);
    setZoneNotes('');
    setIsZoneModalOpen(true);
  };

  const openEditZoneModal = (zone: BranchZone) => {
    setEditingZoneId(zone.id);
    setZoneCode(zone.code);
    setZoneName(zone.name);
    setZoneNotes(zone.notes || '');
    setIsZoneModalOpen(true);
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneCode.trim() || !zoneName.trim()) return;

    setIsSavingZone(true);
    try {
      await dutySchedulerService.upsertSchedulingZone({
        id: editingZoneId || undefined,
        code: zoneCode.trim().toUpperCase(),
        name: zoneName.trim(),
        notes: zoneNotes.trim() || undefined,
        isActive: true
      });
      setIsZoneModalOpen(false);
      showNotification(editingZoneId ? 'Zone updated successfully.' : 'New Zone created successfully.');
      const updatedZones = await dutySchedulerService.getSchedulingZones();
      setZones(updatedZones);
    } catch (err: any) {
      console.error('Error saving zone:', err);
      alert(err.message || 'Failed to save zone.');
    } finally {
      setIsSavingZone(false);
    }
  };

  const handleDeleteZone = async (zoneId: string, zoneName: string) => {
    if (!confirm(`Are you sure you want to delete "${zoneName}"? Any pharmacies assigned to this zone will become unassigned.`)) return;

    try {
      await dutySchedulerService.deleteSchedulingZone(zoneId);
      showNotification(`Zone "${zoneName}" deleted.`);
      const updatedZones = await dutySchedulerService.getSchedulingZones();
      setZones(updatedZones);
    } catch (err: any) {
      console.error('Error deleting zone:', err);
      alert(err.message || 'Failed to delete zone.');
    }
  };

  // --- 3. Pharmacy Config Handlers ---
  const handleAssignBranchZone = async (branchId: string, targetZoneId: string) => {
    setActionLoadingBranchId(branchId);
    try {
      const zoneIdToSet = targetZoneId === 'NONE' ? null : targetZoneId;
      await dutySchedulerService.assignBranchToZone(branchId, zoneIdToSet);
      showNotification('Pharmacy Zone assignment updated.');
      const updatedZones = await dutySchedulerService.getSchedulingZones();
      setZones(updatedZones);
    } catch (err: any) {
      console.error('Error assigning branch zone:', err);
      alert(err.message || 'Failed to assign zone.');
    } finally {
      setActionLoadingBranchId(null);
    }
  };

  const handleApplyShiftPreset = async (branchId: string, preset: '3_SHIFTS' | '2_SHIFTS' | '1_LONG_SHIFT') => {
    setActionLoadingBranchId(branchId);
    try {
      await dutySchedulerService.setBranchShiftPreset(branchId, preset);
      showNotification(`Applied ${preset === '3_SHIFTS' ? '3 Shifts (24/7)' : preset === '2_SHIFTS' ? '2 Shifts' : '1 Long Shift'} to pharmacy.`);
      const updatedShifts = await dutySchedulerService.getBranchShiftTypes();
      setBranchShiftTypes(updatedShifts);
    } catch (err: any) {
      console.error('Error applying shift preset:', err);
      alert(err.message || 'Failed to apply shift preset.');
    } finally {
      setActionLoadingBranchId(null);
    }
  };

  const openCustomShiftModal = (branch: any) => {
    const existing = branchShiftTypes.filter(s => s.branchId === branch.id);
    if (existing.length > 0) {
      setCustomShifts(existing.map(s => ({ ...s })));
    } else {
      // Default standard 2 shifts template
      setCustomShifts([
        { code: 'AM', name: 'Morning Shift', startTime: '08:00:00', endTime: '16:00:00', staffRequired: 1, durationHours: 8 },
        { code: 'PM', name: 'Evening Shift', startTime: '16:00:00', endTime: '00:00:00', staffRequired: 1, durationHours: 8 }
      ]);
    }
    setCustomShiftBranch(branch);
  };

  const handleAddShiftRow = () => {
    setCustomShifts(prev => [
      ...prev,
      { code: `S${prev.length + 1}`, name: `Shift ${prev.length + 1}`, startTime: '08:00:00', endTime: '16:00:00', staffRequired: 1, durationHours: 8 }
    ]);
  };

  const handleRemoveShiftRow = (index: number) => {
    setCustomShifts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveCustomShifts = async () => {
    if (!customShiftBranch) return;
    setIsSavingCustomShifts(true);
    try {
      await dutySchedulerService.saveBranchShiftTypes(customShiftBranch.id, customShifts);
      showNotification(`Custom shifts saved for ${customShiftBranch.name}.`);
      setCustomShiftBranch(null);
      const updatedShifts = await dutySchedulerService.getBranchShiftTypes();
      setBranchShiftTypes(updatedShifts);
    } catch (err: any) {
      console.error('Error saving custom shifts:', err);
      alert(err.message || 'Failed to save shifts.');
    } finally {
      setIsSavingCustomShifts(false);
    }
  };

  // --- Helper Lookups ---
  const getBranchZone = (branchId: string): BranchZone | undefined => {
    return zones.find(z => z.branchIds?.includes(branchId));
  };

  const getBranchShifts = (branchId: string): BranchShiftType[] => {
    return branchShiftTypes.filter(s => s.branchId === branchId);
  };

  const getPharmacistsCountInZone = (zoneId: string): number => {
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return 0;
    return profiles.filter(p => {
      if (p.zoneId === zoneId) return true;
      if (p.primaryBranchId && zone.branchIds?.includes(p.primaryBranchId)) return true;
      return false;
    }).length;
  };

  // Filtered branches list
  const filteredBranches = branches.filter(b => {
    const matchesSearch = 
      (b.name || '').toLowerCase().includes(branchSearch.toLowerCase()) ||
      (b.code || '').toLowerCase().includes(branchSearch.toLowerCase());
    
    if (!matchesSearch) return false;

    if (selectedAreaFilter !== 'ALL') {
      if (b.regionId !== selectedAreaFilter) return false;
    }

    const bZone = getBranchZone(b.id);
    if (selectedZoneFilter === 'UNASSIGNED') {
      if (bZone) return false;
    } else if (selectedZoneFilter !== 'ALL') {
      if (bZone?.id !== selectedZoneFilter) return false;
    }

    const bShifts = getBranchShifts(b.id);
    if (selectedShiftFilter === '3_SHIFTS') {
      if (bShifts.length !== 3) return false;
    } else if (selectedShiftFilter === '2_SHIFTS') {
      if (bShifts.length !== 2) return false;
    } else if (selectedShiftFilter === '1_LONG_SHIFT') {
      if (bShifts.length !== 1) return false;
    } else if (selectedShiftFilter === 'UNCONFIGURED') {
      if (bShifts.length > 0) return false;
    }

    return true;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 text-brand animate-spin" />
      </div>
    );
  }

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      
      {/* Header & Subtitle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
            <Settings2 className="h-6 w-6 text-brand" />
            <span>Control Center — Duty Scheduler Policy & Rules</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Configure scheduling zones, pharmacy operating shifts, safety limits, and optimization rules.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2.5 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{saveSuccess}</span>
        </div>
      )}

      {/* Control Center Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('zones')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'zones'
              ? 'bg-brand text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>1. Zones Config ({zones.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pharmacies')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'pharmacies'
              ? 'bg-brand text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Store className="h-4 w-4" />
          <span>2. Pharmacies Config ({branches.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('policies')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'policies'
              ? 'bg-brand text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>3. Policies & Safety Rules</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ZONES CONFIG */}
      {/* ========================================================================= */}
      {activeTab === 'zones' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div>
              <h3 className="font-bold text-base text-slate-900">Duty Scheduling Zones</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Define the independent zones for duty scheduling (e.g. Zone 1, Zone 2, Zone 3). Each zone generates its own distinct duty schedule.
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={openNewZoneModal}
                className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-brand-dark transition-all shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>New Zone</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {zones.map(zone => {
              const assignedBranches = branches.filter(b => zone.branchIds?.includes(b.id));
              const stationedPharmacists = getPharmacistsCountInZone(zone.id);

              return (
                <div 
                  key={zone.id} 
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-brand/10 text-brand text-xs font-black uppercase tracking-wider">
                          {zone.code}
                        </span>
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">{zone.name}</h4>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditZoneModal(zone)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                            title="Edit Zone"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteZone(zone.id, zone.name)}
                            className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                            title="Delete Zone"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {zone.notes && (
                      <p className="text-xs text-slate-500 line-clamp-2">{zone.notes}</p>
                    )}

                    {/* Metrics Badges */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <span className="text-[11px] text-slate-400 block">Assigned Pharmacies</span>
                        <span className="font-bold text-slate-800 text-sm">{assignedBranches.length} branches</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <span className="text-[11px] text-slate-400 block">Stationed Staff</span>
                        <span className="font-bold text-slate-800 text-sm">{stationedPharmacists} pharmacists</span>
                      </div>
                    </div>

                    {/* Branches Chips */}
                    <div className="pt-2">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Covered Pharmacies:
                      </span>
                      {assignedBranches.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">No pharmacies linked yet. Link them in Pharmacies Config.</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                          {assignedBranches.map(b => (
                            <span key={b.id} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200">
                              {b.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 mt-4 flex justify-between items-center text-xs">
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                      Active for Scheduling
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedZoneFilter(zone.id);
                        setActiveTab('pharmacies');
                      }}
                      className="text-brand font-bold hover:underline"
                    >
                      Manage Pharmacies →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PHARMACIES CONFIG */}
      {/* ========================================================================= */}
      {activeTab === 'pharmacies' && (
        <div className="space-y-5">
          {/* Explanatory Area vs Scheduler Zone Banner */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200/80 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
            <Compass className="h-5 w-5 text-indigo-700 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-indigo-950 flex items-center gap-2">
                <span>Important: Schedule generation is scoped by Scheduler Zones, not Geographic Areas</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-200/60 text-indigo-900 font-extrabold">System Architecture</span>
              </div>
              <p className="text-indigo-800 leading-relaxed">
                The <span className="font-bold text-indigo-950">Geographic Area (Governorate)</span> reflects the branch's physical location, whereas the <span className="font-bold text-indigo-950">Scheduler Zone</span> is the operational domain used by the automated scheduler. <span className="underline decoration-indigo-400 font-semibold">Multiple Scheduler Zones can exist within the same Geographic Area</span>, and schedule generation runs per selected zone.
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Pharmacies & Shifts Setup</h3>
                <p className="text-xs text-slate-500">
                  Assign each branch to its Geographic Area and Scheduler Zone, and configure its shift pattern (e.g. 24/7 3 shifts, 2 shifts, or single long shift).
                </p>
              </div>

              {/* Live Search */}
              <div className="relative w-full md:w-64">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search pharmacy..."
                  value={branchSearch}
                  onChange={e => setBranchSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>

            {/* Filter by Geographic Area */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="font-bold text-slate-600 flex items-center gap-1">
                <Compass className="h-3.5 w-3.5 text-indigo-600" />
                Filter Area:
              </span>
              <button
                type="button"
                onClick={() => setSelectedAreaFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  selectedAreaFilter === 'ALL' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Areas ({branches.length})
              </button>
              {areas.map(a => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setSelectedAreaFilter(a.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    selectedAreaFilter === a.id ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {a.name} ({branches.filter(b => b.regionId === a.id).length})
                </button>
              ))}
            </div>

            {/* Filter by Scheduler Zone */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="font-bold text-slate-600 flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-brand" />
                Filter Zone:
              </span>
              <button
                type="button"
                onClick={() => setSelectedZoneFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  selectedZoneFilter === 'ALL' ? 'bg-brand text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Zones ({branches.length})
              </button>
              {zones.map(z => (
                <button
                  type="button"
                  key={z.id}
                  onClick={() => setSelectedZoneFilter(z.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    selectedZoneFilter === z.id ? 'bg-brand text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {z.name} ({branches.filter(b => z.branchIds?.includes(b.id)).length})
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedZoneFilter('UNASSIGNED')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  selectedZoneFilter === 'UNASSIGNED' ? 'bg-amber-600 text-white font-bold' : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                Unassigned ({branches.filter(b => !getBranchZone(b.id)).length})
              </button>
            </div>

            {/* Filter by Shift Preset */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="font-bold text-slate-600">Filter Shifts:</span>
              <button
                type="button"
                onClick={() => setSelectedShiftFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  selectedShiftFilter === 'ALL' ? 'bg-slate-800 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Shifts
              </button>
              <button
                type="button"
                onClick={() => setSelectedShiftFilter('3_SHIFTS')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  selectedShiftFilter === '3_SHIFTS' ? 'bg-purple-600 text-white font-bold' : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                }`}
              >
                3 Shifts (24/7)
              </button>
              <button
                type="button"
                onClick={() => setSelectedShiftFilter('2_SHIFTS')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  selectedShiftFilter === '2_SHIFTS' ? 'bg-blue-600 text-white font-bold' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                }`}
              >
                2 Shifts (AM & PM)
              </button>
              <button
                type="button"
                onClick={() => setSelectedShiftFilter('1_LONG_SHIFT')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  selectedShiftFilter === '1_LONG_SHIFT' ? 'bg-emerald-600 text-white font-bold' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                1 Long Shift
              </button>
              <button
                type="button"
                onClick={() => setSelectedShiftFilter('UNCONFIGURED')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  selectedShiftFilter === 'UNCONFIGURED' ? 'bg-amber-600 text-white font-bold' : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                Unconfigured
              </button>
            </div>
          </div>

          {/* Aligned Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 select-none">
                    <th className="py-3.5 px-4 w-[240px] min-w-[210px]">Pharmacy</th>
                    <th className="py-3.5 px-3 w-[180px] min-w-[160px]">Geographic Area</th>
                    <th className="py-3.5 px-3 w-[190px] min-w-[170px]">Scheduler Zone</th>
                    <th className="py-3.5 px-3 w-[270px] min-w-[250px]">Shift System (Presets)</th>
                    <th className="py-3.5 px-3 min-w-[240px]">Active Shift Hours & Staff</th>
                    <th className="py-3.5 px-3 text-right w-[95px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBranches.map(branch => {
                    const assignedZone = getBranchZone(branch.id);
                    const shifts = getBranchShifts(branch.id);
                    const isActionLoading = actionLoadingBranchId === branch.id;

                    return (
                      <tr 
                        key={branch.id} 
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* 1. Pharmacy Identity */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold shrink-0 border border-teal-100/70">
                              <Store className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 text-sm leading-snug" title={branch.name}>
                                  {branch.name}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-600 font-semibold border border-slate-200">
                                  {branch.code}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                Standard Retail Pharmacy
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 2. Geographic Area (Governorate) */}
                        <td className="py-3.5 px-3 align-middle">
                          <div className="w-full max-w-[175px]">
                            <select
                              disabled={isActionLoading || !canEdit}
                              value={branch.regionId || 'NONE'}
                              onChange={e => handleChangeBranchArea(branch.id, e.target.value === 'NONE' ? '' : e.target.value)}
                              className="w-full px-2 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-800 transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="NONE">Unassigned Area</option>
                              {areas.map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* 3. Zone Assignment */}
                        <td className="py-3.5 px-3 align-middle">
                          <div className="w-full max-w-[185px]">
                            <select
                              disabled={isActionLoading || !canEdit}
                              value={assignedZone?.id || 'NONE'}
                              onChange={e => handleAssignBranchZone(branch.id, e.target.value)}
                              className={`w-full px-2 py-1.5 text-xs rounded-xl border font-bold transition-all focus:outline-none focus:ring-1 focus:ring-brand ${
                                assignedZone 
                                  ? 'bg-brand/5 border-brand/40 text-brand' 
                                  : 'bg-amber-50/60 border-amber-300 text-amber-800'
                              }`}
                            >
                              <option value="NONE">Unassigned (No Zone)</option>
                              {zones.map(z => (
                                <option key={z.id} value={z.id}>
                                  {z.name} ({z.code})
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* 3. Shift System Presets */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              disabled={isActionLoading || !canEdit}
                              onClick={() => handleApplyShiftPreset(branch.id, '3_SHIFTS')}
                              className={`px-2.5 py-1 text-xs rounded-lg border font-semibold transition-all whitespace-nowrap ${
                                shifts.length === 3
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                              title="Preset: 3 Shifts (24/7) — AM, PM, NIGHT"
                            >
                              3 Shifts (24/7)
                            </button>

                            <button
                              type="button"
                              disabled={isActionLoading || !canEdit}
                              onClick={() => handleApplyShiftPreset(branch.id, '2_SHIFTS')}
                              className={`px-2.5 py-1 text-xs rounded-lg border font-semibold transition-all whitespace-nowrap ${
                                shifts.length === 2
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                              title="Preset: 2 Shifts — AM, PM"
                            >
                              2 Shifts (AM & PM)
                            </button>

                            <button
                              type="button"
                              disabled={isActionLoading || !canEdit}
                              onClick={() => handleApplyShiftPreset(branch.id, '1_LONG_SHIFT')}
                              className={`px-2.5 py-1 text-xs rounded-lg border font-semibold transition-all whitespace-nowrap ${
                                shifts.length === 1 && shifts[0]?.code === 'FULL'
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                              title="Preset: 1 Long Shift — FULL (09:00 - 21:00)"
                            >
                              1 Long Shift
                            </button>

                            {isActionLoading && <Loader2 className="h-3.5 w-3.5 text-brand animate-spin ml-1" />}
                          </div>
                        </td>

                        {/* 4. Active Shift Details */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {shifts.length === 0 ? (
                              <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 font-medium inline-flex items-center gap-1.5">
                                <AlertCircle className="h-3 w-3 text-amber-600 shrink-0" />
                                <span>Not configured</span>
                                <span className="text-[10px] text-amber-600/80">(Defaults to 2 shifts)</span>
                              </span>
                            ) : (
                              shifts.map(s => (
                                <span 
                                  key={s.id} 
                                  className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-medium flex items-center gap-1.5 whitespace-nowrap"
                                >
                                  <span className="font-bold text-slate-900">{s.code}</span>
                                  <span className="text-slate-500 font-mono text-[10px]">
                                    ({s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)})
                                  </span>
                                  <span className="text-[10px] px-1 bg-white rounded font-bold text-slate-600 border border-slate-200">
                                    {s.staffRequired} staff
                                  </span>
                                </span>
                              ))
                            )}
                          </div>
                        </td>

                        {/* 5. Actions */}
                        <td className="py-3.5 px-4 align-middle text-right">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openCustomShiftModal(branch)}
                              className="inline-flex items-center gap-1.5 text-xs text-brand font-bold hover:text-brand-dark hover:bg-brand/5 px-2.5 py-1.5 rounded-lg transition-colors border border-brand/20 whitespace-nowrap"
                              title={`Customize shifts for ${branch.name}`}
                            >
                              <Sliders className="h-3.5 w-3.5" />
                              <span>Customize</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredBranches.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Store className="h-10 w-10 mx-auto mb-2 opacity-25" />
                        <p className="font-medium text-sm">No pharmacies matching filters.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span>Showing <strong>{filteredBranches.length}</strong> of <strong>{branches.length}</strong> pharmacies</span>
                <span>•</span>
                <span className="text-emerald-700 font-medium">Assigned: {branches.filter(b => getBranchZone(b.id)).length}</span>
                <span>•</span>
                <span className="text-amber-700 font-medium">Unassigned: {branches.filter(b => !getBranchZone(b.id)).length}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Zone and Shift preset updates take effect immediately in schedule generation.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: POLICIES & SAFETY RULES */}
      {/* ========================================================================= */}
      {activeTab === 'policies' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Section 1: Default Constraints */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <Shield className="h-5 w-5 text-teal-600" />
              <h3 className="font-bold text-base text-slate-900">Mandatory Safety & Recovery Rules</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Default Minimum Rest (Hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={8}
                  max={24}
                  value={minRestHours}
                  onChange={e => setMinRestHours(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-brand font-medium"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Standard: 11.0 hours between shifts</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Default Max Consecutive Days
                </label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={maxConsecutiveDays}
                  onChange={e => setMaxConsecutiveDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-brand font-medium"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Labor law safety ceiling: max 6 days</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Default Work/Rest Mode
                </label>
                <select
                  value={defaultWorkRestMode}
                  onChange={e => setDefaultWorkRestMode(e.target.value as WorkRestMode)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-brand font-medium"
                >
                  <option value="DAYS_PER_WEEK">Days Per Week</option>
                  <option value="FIXED_CYCLE">Fixed Rotation Cycle</option>
                  <option value="CUSTOM_CALENDAR">Custom Calendar</option>
                  <option value="DYNAMIC_VARIABLE_CYCLE">Dynamic Variable Cycle (Intelligent CSP)</option>
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">Fallback for unconfigured profiles</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Dynamic Cycle Global Max Consecutive Days (Ceiling)
                </label>
                <input
                  type="number"
                  min={1}
                  value={globalMaxConsecutiveDays}
                  onChange={e => setGlobalMaxConsecutiveDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-brand font-medium"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Admin-configured hard ceiling for pharmacists on Dynamic Variable Cycle (default: 8, editable)
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Default Rest Days (Per Period)
                </label>
                <input
                  type="number"
                  min={0}
                  max={31}
                  value={defaultRestDaysPerPeriod}
                  onChange={e => setDefaultRestDaysPerPeriod(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-brand font-medium"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Pre-generation capacity assumption for profiles without work/rest pattern</span>
              </div>
            </div>
          </div>

          {/* Section 2: Shift Weights & Workload Scoring */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <Scale className="h-5 w-5 text-indigo-600" />
              <h3 className="font-bold text-base text-slate-900">Workload Fairness & Shift Weights</h3>
            </div>

            <p className="text-xs text-slate-500">
              Weighted scores assigned per shift type. Night shifts and weekend duties carry higher weights to guarantee fair distribution across all pharmacists.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">AM Shift</label>
                <input
                  type="number"
                  step="0.05"
                  value={amWeight}
                  onChange={e => setAmWeight(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-brand font-semibold text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">PM Shift</label>
                <input
                  type="number"
                  step="0.05"
                  value={pmWeight}
                  onChange={e => setPmWeight(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-brand font-semibold text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Night Shift</label>
                <input
                  type="number"
                  step="0.05"
                  value={nightWeight}
                  onChange={e => setNightWeight(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-brand font-semibold text-center text-purple-700"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Full Day</label>
                <input
                  type="number"
                  step="0.05"
                  value={fullWeight}
                  onChange={e => setFullWeight(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-brand font-semibold text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Weekend Bonus</label>
                <input
                  type="number"
                  step="0.05"
                  value={weekendBonus}
                  onChange={e => setWeekendBonus(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-brand font-semibold text-center text-amber-700"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Weekend Definition & Objective Function */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <Sliders className="h-5 w-5 text-purple-600" />
              <h3 className="font-bold text-base text-slate-900">Weekend Rules & Solver Tuning</h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Weekend Days Definition (Region-Specific)
              </label>
              <div className="flex flex-wrap gap-2">
                {DAY_NAMES.map((name, dayIndex) => {
                  const isSelected = weekendDays.includes(dayIndex);
                  return (
                    <button
                      type="button"
                      key={dayIndex}
                      onClick={() => toggleWeekendDay(dayIndex)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        isSelected
                          ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                In Bahrain, Friday (day 5) is standard. Select Saturday (day 6) if 2-day weekend rules apply.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Fairness Weight (Optimizer)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={0.1}
                  max={5.0}
                  value={fairnessWeight}
                  onChange={e => setFairnessWeight(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-brand font-medium"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Penalizes deviation in cumulative workload</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Continuity Weight (Cross-Period)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={0.1}
                  max={5.0}
                  value={continuityWeight}
                  onChange={e => setContinuityWeight(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-brand font-medium"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Penalizes breaking rolling rest cadences</span>
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="flex items-center gap-2 bg-brand text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-brand-dark transition-all shadow-sm hover:shadow-md disabled:opacity-50"
              >
                {isSavingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>Save Rules Configuration</span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT ZONE */}
      {/* ========================================================================= */}
      {isZoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold">
                  <Layers className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  {editingZoneId ? 'Edit Scheduling Zone' : 'New Scheduling Zone'}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsZoneModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveZone} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Zone Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. ZONE-1"
                  required
                  value={zoneCode}
                  onChange={e => setZoneCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold uppercase focus:ring-brand font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Letters, numbers, dash only (e.g. ZONE-1, ZONE-NORTH)</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Zone Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Zone 1 Schedule"
                  required
                  value={zoneName}
                  onChange={e => setZoneName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Notes / Description
                </label>
                <textarea
                  placeholder="Description of pharmacies or region covered by this zone..."
                  rows={3}
                  value={zoneNotes}
                  onChange={e => setZoneNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-brand"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsZoneModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingZone}
                  className="flex items-center gap-2 bg-brand text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-brand-dark disabled:opacity-50"
                >
                  {isSavingZone && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingZoneId ? 'Update Zone' : 'Create Zone'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CUSTOMIZE BRANCH SHIFTS */}
      {/* ========================================================================= */}
      {customShiftBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <div>
                <h3 className="font-bold text-base text-slate-900">Customize Pharmacy Shifts</h3>
                <p className="text-xs text-slate-500">{customShiftBranch.name} ({customShiftBranch.code})</p>
              </div>
              <button 
                type="button"
                onClick={() => setCustomShiftBranch(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Daily Shifts Setup</span>
                  <span className="text-xs text-slate-400 ml-2">({customShifts.length} configured)</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddShiftRow}
                  className="flex items-center gap-1.5 text-xs text-brand font-bold hover:underline bg-brand/5 hover:bg-brand/10 px-2.5 py-1.5 rounded-lg border border-brand/20 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Shift</span>
                </button>
              </div>

              {customShifts.length === 0 ? (
                <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-xs">No shifts defined yet. Click "Add Shift" to create one.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 select-none">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[90px]">Code</th>
                        <th className="py-2.5 px-3 min-w-[110px]">Start Time</th>
                        <th className="py-2.5 px-3 min-w-[110px]">End Time</th>
                        <th className="py-2.5 px-3 min-w-[90px] text-center">Staff Req.</th>
                        <th className="py-2.5 px-3 text-right w-16">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {customShifts.map((shift, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={shift.code || ''}
                              onChange={e => {
                                const val = e.target.value.toUpperCase();
                                setCustomShifts(prev => prev.map((s, i) => i === idx ? { ...s, code: val } : s));
                              }}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold uppercase focus:ring-1 focus:ring-brand text-xs"
                              placeholder="e.g. AM"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="time"
                              value={shift.startTime || '08:00'}
                              onChange={e => {
                                const val = e.target.value;
                                setCustomShifts(prev => prev.map((s, i) => i === idx ? { ...s, startTime: val } : s));
                              }}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-brand text-xs font-mono"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="time"
                              value={shift.endTime || '16:00'}
                              onChange={e => {
                                const val = e.target.value;
                                setCustomShifts(prev => prev.map((s, i) => i === idx ? { ...s, endTime: val } : s));
                              }}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-brand text-xs font-mono"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min={1}
                              max={5}
                              value={shift.staffRequired ?? 1}
                              onChange={e => {
                                const val = Number(e.target.value);
                                setCustomShifts(prev => prev.map((s, i) => i === idx ? { ...s, staffRequired: val } : s));
                              }}
                              className="w-full max-w-[70px] mx-auto px-2 py-1.5 border border-slate-300 rounded-lg text-center font-bold focus:ring-1 focus:ring-brand text-xs block"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveShiftRow(idx)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              title="Delete Shift"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCustomShiftBranch(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingCustomShifts}
                onClick={handleSaveCustomShifts}
                className="flex items-center gap-2 bg-brand text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-brand-dark disabled:opacity-50"
              >
                {isSavingCustomShifts && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Save Shifts</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
