import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Sliders,
  AlertTriangle,
  Clock,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Plus,
  Trash2,
  Edit3,
  Save,
  RotateCcw,
  Sparkles,
  Calculator,
  User,
  Info,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Award,
  Calendar,
  X,
  Check
} from 'lucide-react';
import Swal from 'sweetalert2';
import {
  AttendanceModuleConfig,
  AttendancePenaltyRule,
  PenaltyRuleType,
  PenaltyActionType,
  PenaltyEscalationTier,
  StaffCategory
} from '../../types';
import { attendancePenaltyEngine } from '../../services/attendancePenaltyEngine';
import { attendanceService } from '../../services/attendanceService';
import { workforceService, Employee } from '../../services/workforceService';

interface Props {
  onClose?: () => void;
}

export const AttendancePenaltyConfigPanel: React.FC<Props> = ({ onClose }) => {
  const [config, setConfig] = useState<AttendanceModuleConfig>(attendanceService.getConfig());
  const [rules, setRules] = useState<AttendancePenaltyRule[]>(attendancePenaltyEngine.getAllRules());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'rules' | 'simulation'>('general');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [draftRule, setDraftRule] = useState<AttendancePenaltyRule | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Simulation state
  const [simEmployeeId, setSimEmployeeId] = useState<string>('');
  const [simRuleType, setSimRuleType] = useState<PenaltyRuleType>('LATE_ARRIVAL');
  const [simMinutes, setSimMinutes] = useState<number>(20);
  const [simOccurrence, setSimOccurrence] = useState<number>(2);
  const [simResult, setSimResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setConfig(attendanceService.getConfig());
    setRules(attendancePenaltyEngine.getAllRules());
    try {
      const emps = await workforceService.getAllEmployees();
      setEmployees(emps.filter(e => e.status === 'Active'));
      if (emps.length > 0 && !simEmployeeId) {
        setSimEmployeeId(emps[0].id);
      }
    } catch (e) {
      console.error('Failed to load employees for simulation:', e);
    }
  };

  const handleSaveConfig = () => {
    setIsSaving(true);
    try {
      attendanceService.saveConfig(config);
      Swal.fire({
        icon: 'success',
        title: 'Settings Saved',
        text: 'Attendance and geofencing configuration updated successfully.',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (e) {
      Swal.fire('Error', 'Failed to save configuration', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaultRules = () => {
    Swal.fire({
      title: 'Reset to Bahrain Labor Law Defaults?',
      text: 'This will overwrite customized rules with official labor law escalation tiers.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0284c7',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Reset Rules',
      cancelButtonText: 'Cancel'
    }).then(result => {
      if (result.isConfirmed) {
        attendancePenaltyEngine.resetToDefaults();
        setRules(attendancePenaltyEngine.getAllRules());
        Swal.fire('Reset!', 'Default penalty rules restored.', 'success');
      }
    });
  };

  const handleToggleRule = (id: string, current: boolean) => {
    attendancePenaltyEngine.saveRule({ id, isActive: !current });
    setRules(attendancePenaltyEngine.getAllRules());
  };

  const handleStartEdit = (rule: AttendancePenaltyRule) => {
    setIsCreatingNew(false);
    setEditingRuleId(rule.id);
    setDraftRule(JSON.parse(JSON.stringify(rule)));
  };

  const handleCancelEdit = () => {
    setEditingRuleId(null);
    setDraftRule(null);
    setIsCreatingNew(false);
  };

  const handleAddNewRule = () => {
    const newId = `rule-custom-${Date.now()}`;
    const newRule: AttendancePenaltyRule = {
      id: newId,
      ruleType: 'CUSTOM',
      name: 'Custom Disciplinary Rule',
      nameAr: 'قاعدة تأديبية مخصصة',
      description: 'Custom escalation rule based on company policy',
      descriptionAr: 'قاعدة تصاعد تأديبي مخصصة وفق سياسات العمل',
      triggerCondition: {
        minLateMinutes: 1,
        maxLateMinutes: 30
      },
      escalationTiers: [
        { tier: 1, occurrenceRange: [1, 1], action: 'VERBAL_WARNING', description: 'Verbal Warning', descriptionAr: 'إنذار شفهي' },
        { tier: 2, occurrenceRange: [2, 2], action: 'WRITTEN_WARNING', description: 'Written Warning', descriptionAr: 'إنذار كتابي' },
        { tier: 3, occurrenceRange: [3, 3], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 0.5, description: '½ Day Salary Deduction', descriptionAr: 'خصم نصف يوم' },
        { tier: 4, occurrenceRange: [4, 4], action: 'SALARY_DEDUCTION_DAYS', deductionValue: 1, description: '1 Day Salary Deduction', descriptionAr: 'خصم يوم كامل' },
        { tier: 5, occurrenceRange: [5, 99], action: 'TERMINATION_FLAG', description: 'Flagged for HR Review (Inert Flag)', descriptionAr: 'رُفع للموارد البشرية (إنهاء خدمة)' }
      ],
      isActive: true,
      appliesTo: ['Pharmacist', 'Driver', 'Worker', 'Management'],
      resetPeriod: 'MONTHLY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setIsCreatingNew(true);
    setEditingRuleId(newId);
    setDraftRule(newRule);
  };

  const handleSaveRule = () => {
    if (!draftRule) return;
    if (!draftRule.name.trim()) {
      Swal.fire('Validation Error', 'Rule name is required.', 'warning');
      return;
    }

    const sortedTiers = [...draftRule.escalationTiers].map((t, idx) => ({
      ...t,
      tier: (idx + 1) as PenaltyEscalationTier
    }));

    const finalRule: AttendancePenaltyRule = {
      ...draftRule,
      escalationTiers: sortedTiers,
      updatedAt: new Date().toISOString()
    };

    attendancePenaltyEngine.upsertRule(finalRule);
    setRules(attendancePenaltyEngine.getAllRules());
    setEditingRuleId(null);
    setDraftRule(null);
    setIsCreatingNew(false);

    Swal.fire({
      icon: 'success',
      title: 'Rule Saved',
      text: `Disciplinary rule "${finalRule.name}" and escalation tiers updated.`,
      timer: 2000,
      showConfirmButton: false
    });
  };

  const handleDeleteRule = (ruleId: string, ruleName: string) => {
    Swal.fire({
      title: 'Delete Disciplinary Rule?',
      text: `Are you sure you want to delete "${ruleName}"? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete Rule',
      cancelButtonText: 'Cancel'
    }).then(result => {
      if (result.isConfirmed) {
        attendancePenaltyEngine.deleteRule(ruleId);
        setRules(attendancePenaltyEngine.getAllRules());
        if (editingRuleId === ruleId) {
          handleCancelEdit();
        }
        Swal.fire('Deleted', `Rule "${ruleName}" has been removed.`, 'success');
      }
    });
  };

  const handleUpdateDraftTier = (
    tierIndex: number,
    field: string,
    value: any
  ) => {
    if (!draftRule) return;
    const updatedTiers = [...draftRule.escalationTiers];
    const currentTier = { ...updatedTiers[tierIndex] };

    if (field === 'minOcc') {
      const minVal = Math.max(1, parseInt(value) || 1);
      currentTier.occurrenceRange = [minVal, Math.max(minVal, currentTier.occurrenceRange[1])];
    } else if (field === 'maxOcc') {
      const maxVal = Math.max(currentTier.occurrenceRange[0], parseInt(value) || 1);
      currentTier.occurrenceRange = [currentTier.occurrenceRange[0], maxVal];
    } else if (field === 'action') {
      currentTier.action = value as PenaltyActionType;
      if (value === 'VERBAL_WARNING' || value === 'WRITTEN_WARNING' || value === 'TERMINATION_FLAG') {
        currentTier.deductionValue = undefined;
      } else if (currentTier.deductionValue === undefined) {
        currentTier.deductionValue = value.includes('HOURS') ? 2 : value.includes('DAYS') ? 1 : 10;
      }
    } else if (field === 'deductionValue') {
      currentTier.deductionValue = parseFloat(value) || 0;
    } else if (field === 'description') {
      currentTier.description = value;
    } else if (field === 'descriptionAr') {
      currentTier.descriptionAr = value;
    }

    updatedTiers[tierIndex] = currentTier;
    setDraftRule({ ...draftRule, escalationTiers: updatedTiers });
  };

  const handleAddTierToDraft = () => {
    if (!draftRule || draftRule.escalationTiers.length >= 5) return;
    const lastTier = draftRule.escalationTiers[draftRule.escalationTiers.length - 1];
    const nextTierNum = (draftRule.escalationTiers.length + 1) as PenaltyEscalationTier;
    const nextStartOcc = lastTier ? lastTier.occurrenceRange[1] + 1 : 1;

    const newTier: AttendancePenaltyRule['escalationTiers'][0] = {
      tier: nextTierNum,
      occurrenceRange: [nextStartOcc, nextStartOcc],
      action: 'SALARY_DEDUCTION_DAYS',
      deductionValue: 1,
      description: `${nextTierNum} Day Salary Deduction`,
      descriptionAr: `خصم راتب المستوى ${nextTierNum}`
    };

    setDraftRule({
      ...draftRule,
      escalationTiers: [...draftRule.escalationTiers, newTier]
    });
  };

  const handleRemoveTierFromDraft = (idx: number) => {
    if (!draftRule || draftRule.escalationTiers.length <= 1) return;
    const updated = draftRule.escalationTiers
      .filter((_, i) => i !== idx)
      .map((t, newIdx) => ({
        ...t,
        tier: (newIdx + 1) as PenaltyEscalationTier
      }));
    setDraftRule({ ...draftRule, escalationTiers: updated });
  };

  const handleToggleAppliesToCategory = (category: StaffCategory) => {
    if (!draftRule) return;
    const exists = draftRule.appliesTo.includes(category);
    let next: StaffCategory[];
    if (exists) {
      if (draftRule.appliesTo.length === 1) return;
      next = draftRule.appliesTo.filter(c => c !== category);
    } else {
      next = [...draftRule.appliesTo, category];
    }
    setDraftRule({ ...draftRule, appliesTo: next });
  };

  const handleRunSimulation = () => {
    const selectedEmp = employees.find(e => e.id === simEmployeeId) || employees[0];
    if (!selectedEmp) return;
    const basicSalary = selectedEmp.salary_matrix?.basicSalary || 250;

    const result = attendancePenaltyEngine.simulatePenalty(
      selectedEmp,
      simRuleType,
      simMinutes,
      config,
      simOccurrence - 1
    );

    setSimResult({
      ...result,
      employeeName: selectedEmp.full_name,
      employeeCode: selectedEmp.code,
      basicSalary,
      deductionBhd: result.calculatedBhd,
      ruleName: result.matchingRule?.name || 'Standard Rule',
      tier: result.matchingTier?.tier || 1,
      action: result.matchingTier?.action || 'VERBAL_WARNING'
    });
  };

  return (
    <div className="w-full h-[88vh] min-h-[620px] max-h-[88vh] flex flex-col bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-red-950/40 to-slate-900 px-6 py-5 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/20 border border-brand/30 flex items-center justify-center text-red-300">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Attendance &amp; Penalty Engine Config</h2>
            <p className="text-xs text-slate-400">
              Bahrain Labor Law Tiered Penalties • GPS Geofence Constraints • Overtime Rules
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 gap-2 pt-2 shrink-0">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition flex items-center gap-2 ${
            activeTab === 'general'
              ? 'bg-slate-900 text-brand border-t-2 border-brand font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" /> General Settings
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition flex items-center gap-2 ${
            activeTab === 'rules'
              ? 'bg-slate-900 text-brand border-t-2 border-brand font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" /> Penalty Rules Matrix ({rules.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('simulation');
            if (!simResult) handleRunSimulation();
          }}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition flex items-center gap-2 ${
            activeTab === 'simulation'
              ? 'bg-slate-900 text-brand border-t-2 border-brand font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calculator className="w-4 h-4" /> "What-If" Simulation
        </button>
      </div>

      <div className="p-6 overflow-y-auto flex-1">
        {/* TAB 1: GENERAL SETTINGS */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Grace Period & Timing */}
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/60 space-y-4">
                <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
                  <Clock className="w-4 h-4" /> Timing & Grace Periods
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Grace Period (Minutes) <span className="text-amber-400 font-medium">— Evaluated First</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={config.gracePeriodMinutes}
                    onChange={e => setConfig({ ...config, gracePeriodMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Lateness is measured starting AFTER grace period expires (§5.1).
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Early Clock-in Window (Minutes)</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={config.earlyClockInWindowMinutes}
                    onChange={e => setConfig({ ...config, earlyClockInWindowMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Auto Clock-Out Cutoff (Hours)</label>
                  <input
                    type="number"
                    min={4}
                    max={24}
                    value={config.autoClockOutAfterHours}
                    onChange={e => setConfig({ ...config, autoClockOutAfterHours: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Geofencing & Anti-Fraud */}
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/60 space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <MapPin className="w-4 h-4" /> Geofence & Anti-Spoofing
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-200">Require Geofence for Clock-In</div>
                    <div className="text-[11px] text-slate-500">Flags OUTSIDE punches if outside branch radius</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.requireGeofenceForClockIn}
                    onChange={e => setConfig({ ...config, requireGeofenceForClockIn: e.target.checked })}
                    className="w-5 h-5 accent-sky-500 rounded cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-200">Require Geofence for Clock-Out</div>
                    <div className="text-[11px] text-slate-500">Enforces perimeter validation on departure</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.requireGeofenceForClockOut}
                    onChange={e => setConfig({ ...config, requireGeofenceForClockOut: e.target.checked })}
                    className="w-5 h-5 accent-sky-500 rounded cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-200">Require Photo / Selfie on Clock-In</div>
                    <div className="text-[11px] text-slate-500">Anti-proxy punch validation</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.requirePhotoOnClockIn}
                    onChange={e => setConfig({ ...config, requirePhotoOnClockIn: e.target.checked })}
                    className="w-5 h-5 accent-sky-500 rounded cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-200">Allow Manual Entry by Employee</div>
                    <div className="text-[11px] text-slate-500">If disabled, only Managers can override</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.allowManualEntryByEmployee}
                    onChange={e => setConfig({ ...config, allowManualEntryByEmployee: e.target.checked })}
                    className="w-5 h-5 accent-sky-500 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Working Hours & Overtime */}
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/60 space-y-4">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                  <DollarSign className="w-4 h-4" /> Working Hours & Rates
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Standard Work Hours / Day</label>
                  <input
                    type="number"
                    min={4}
                    max={12}
                    value={config.workingHoursPerDay}
                    onChange={e => setConfig({ ...config, workingHoursPerDay: parseInt(e.target.value) || 8 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Used for hourly rate: (BasicSalary ÷ 30 ÷ hours).
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Break Deduction (Minutes)</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={config.breakDeductionMinutes}
                    onChange={e => setConfig({ ...config, breakDeductionMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Overtime Trigger Threshold (Minutes)</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={config.overtimeThresholdMinutes}
                    onChange={e => setConfig({ ...config, overtimeThresholdMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Overtime Multipliers (§2.2) */}
            <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/60">
              <h3 className="text-sm font-semibold text-sky-400 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Context-Aware Overtime Multipliers (§2.2)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Standard Workday Multiplier</label>
                  <input
                    type="number"
                    step="0.05"
                    value={config.overtimeRateConfig?.normalDayMultiplier || 1.25}
                    onChange={e =>
                      setConfig({
                        ...config,
                        overtimeRateConfig: {
                          ...config.overtimeRateConfig,
                          normalDayMultiplier: parseFloat(e.target.value) || 1.25
                        }
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Default 1.25× (Bahrain Labor Law)</p>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Weekend Day Multiplier</label>
                  <input
                    type="number"
                    step="0.05"
                    value={config.overtimeRateConfig?.weekendMultiplier || 1.5}
                    onChange={e =>
                      setConfig({
                        ...config,
                        overtimeRateConfig: {
                          ...config.overtimeRateConfig,
                          weekendMultiplier: parseFloat(e.target.value) || 1.5
                        }
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Default 1.50× for Fridays / Rest days</p>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Public Holiday Multiplier</label>
                  <input
                    type="number"
                    step="0.05"
                    value={config.overtimeRateConfig?.publicHolidayMultiplier || 2.0}
                    onChange={e =>
                      setConfig({
                        ...config,
                        overtimeRateConfig: {
                          ...config.overtimeRateConfig,
                          publicHolidayMultiplier: parseFloat(e.target.value) || 2.0
                        }
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Default 2.00× (Double pay)</p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-sky-500/20 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: RULES MATRIX */}
        {activeTab === 'rules' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-700/80">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-sky-400" /> Tiered Escalation Matrix
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complies with Bahrain Labor Law Decree No. 36 of 2012. Fully customize disciplinary rules, occurrence thresholds, and 5-tier penalties.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddNewRule}
                  className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-md shadow-emerald-950 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> + Add New Disciplinary Rule
                </button>
                <button
                  onClick={handleResetDefaultRules}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-700 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Restore Defaults
                </button>
              </div>
            </div>

            {/* If creating a brand new rule, show the editor card at the top */}
            {isCreatingNew && draftRule && (
              <div className="border-2 border-emerald-500/70 bg-slate-800/95 rounded-xl p-5 shadow-2xl space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Create New Disciplinary Rule</div>
                      <div className="text-sm font-bold text-white">{draftRule.name || 'Untitled Rule'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveRule}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md shadow-emerald-900 transition"
                    >
                      <Check className="w-3.5 h-3.5" /> Save Rule
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {/* Metadata Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Rule Name (English)</label>
                    <input
                      type="text"
                      value={draftRule.name}
                      onChange={e => setDraftRule({ ...draftRule, name: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                      placeholder="e.g. Late Arrival (1-15 min)"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Rule Name (Arabic)</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={draftRule.nameAr || ''}
                      onChange={e => setDraftRule({ ...draftRule, nameAr: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 text-right"
                      placeholder="مثال: تأخر (1-15 دقيقة)"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Violation Category Type</label>
                    <select
                      value={draftRule.ruleType}
                      onChange={e => setDraftRule({ ...draftRule, ruleType: e.target.value as PenaltyRuleType })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="LATE_ARRIVAL">Late Arrival</option>
                      <option value="EARLY_DEPARTURE">Early Departure</option>
                      <option value="ABSENT_NO_EXCUSE">Absent (No Excuse)</option>
                      <option value="ABSENT_NO_NOTICE">Absent (No Prior Notice)</option>
                      <option value="MISSING_PUNCH">Missing Punch</option>
                      <option value="OUTSIDE_GEOFENCE">Outside Geofence</option>
                      <option value="CONSECUTIVE_LATE">Consecutive Late</option>
                      <option value="MONTHLY_LATE_THRESHOLD">Monthly Late Threshold</option>
                      <option value="CUSTOM">Custom Disciplinary Policy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Occurrence Reset Period</label>
                    <select
                      value={draftRule.resetPeriod}
                      onChange={e => setDraftRule({ ...draftRule, resetPeriod: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="MONTHLY">Monthly (Resets at 1st of month)</option>
                      <option value="QUARTERLY">Quarterly (Resets every 3 months)</option>
                      <option value="YEARLY">Yearly (Resets annually)</option>
                      <option value="NEVER">Never (Lifetime cumulative escalation)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Min Late / Early Minutes</label>
                    <input
                      type="number"
                      min={0}
                      value={draftRule.triggerCondition.minLateMinutes ?? draftRule.triggerCondition.minEarlyLeaveMinutes ?? 0}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        setDraftRule({
                          ...draftRule,
                          triggerCondition: {
                            ...draftRule.triggerCondition,
                            minLateMinutes: val,
                            minEarlyLeaveMinutes: val
                          }
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Max Late Minutes</label>
                    <input
                      type="number"
                      min={0}
                      value={draftRule.triggerCondition.maxLateMinutes ?? 999}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 999;
                        setDraftRule({
                          ...draftRule,
                          triggerCondition: {
                            ...draftRule.triggerCondition,
                            maxLateMinutes: val
                          }
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                      placeholder="999"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Description / Legal Reference</label>
                    <input
                      type="text"
                      value={draftRule.description || ''}
                      onChange={e => setDraftRule({ ...draftRule, description: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                      placeholder="Description or policy reference"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Applies To Staff Categories</label>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(['Pharmacist', 'Driver', 'Worker', 'Management'] as StaffCategory[]).map(cat => {
                        const selected = draftRule.appliesTo.includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => handleToggleAppliesToCategory(cat)}
                            className={`text-[11px] px-2.5 py-1 rounded border transition font-medium ${
                              selected
                                ? 'bg-sky-600 text-white border-sky-400 font-semibold shadow-sm'
                                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            {selected ? '✓ ' : '+ '}{cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Escalation Tiers */}
                <div className="pt-2 border-t border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Escalation Tiers ({draftRule.escalationTiers.length} of 5)</span>
                      <span className="text-[11px] text-slate-400 font-normal">— Set occurrence thresholds and penalties</span>
                    </div>
                    {draftRule.escalationTiers.length < 5 && (
                      <button
                        type="button"
                        onClick={handleAddTierToDraft}
                        className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 px-2 py-1 bg-sky-950/60 border border-sky-800/60 rounded-md transition"
                      >
                        <Plus className="w-3 h-3" /> Add Tier
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
                    {draftRule.escalationTiers.map((tier, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border flex flex-col justify-between space-y-2.5 ${
                          tier.action === 'TERMINATION_FLAG'
                            ? 'bg-rose-950/30 border-rose-700/60'
                            : tier.action.includes('DEDUCTION')
                            ? 'bg-amber-950/20 border-amber-700/60'
                            : 'bg-slate-900/80 border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                            Tier {tier.tier}
                          </span>
                          {draftRule.escalationTiers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTierFromDraft(idx)}
                              className="text-rose-400 hover:text-rose-200 p-0.5"
                              title="Remove tier"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Occurrence (From - To)</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              value={tier.occurrenceRange[0]}
                              onChange={e => handleUpdateDraftTier(idx, 'minOcc', e.target.value)}
                              className="w-1/2 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs text-white text-center"
                            />
                            <span className="text-slate-500 text-xs">-</span>
                            <input
                              type="number"
                              min={tier.occurrenceRange[0]}
                              value={tier.occurrenceRange[1]}
                              onChange={e => handleUpdateDraftTier(idx, 'maxOcc', e.target.value)}
                              className="w-1/2 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs text-white text-center"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Prescribed Action</label>
                          <select
                            value={tier.action}
                            onChange={e => handleUpdateDraftTier(idx, 'action', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-white focus:outline-none"
                          >
                            <option value="VERBAL_WARNING">Verbal Warning</option>
                            <option value="WRITTEN_WARNING">Written Warning</option>
                            <option value="SALARY_DEDUCTION_HOURS">Deduct Hours</option>
                            <option value="SALARY_DEDUCTION_DAYS">Deduct Days</option>
                            <option value="SALARY_DEDUCTION_FIXED">Fixed BHD Amount</option>
                            <option value="SUSPENSION_DAYS">Suspension Days</option>
                            <option value="TERMINATION_FLAG">Termination Flag (HR Review)</option>
                          </select>
                        </div>

                        {(tier.action.includes('DEDUCTION') || tier.action.includes('SUSPENSION')) && (
                          <div>
                            <label className="block text-[10px] text-sky-400 font-semibold mb-0.5">
                              Value ({tier.action.includes('HOURS') ? 'Hours' : tier.action.includes('DAYS') ? 'Days' : 'BHD'})
                            </label>
                            <input
                              type="number"
                              step={tier.action.includes('DAYS') ? '0.25' : '1'}
                              min={0}
                              value={tier.deductionValue ?? 1}
                              onChange={e => handleUpdateDraftTier(idx, 'deductionValue', e.target.value)}
                              className="w-full bg-slate-950 border border-sky-600/50 rounded px-2 py-1 text-xs text-amber-300 font-bold"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Summary Note</label>
                          <input
                            type="text"
                            value={tier.description}
                            onChange={e => handleUpdateDraftTier(idx, 'description', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200"
                            placeholder="Description"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* List of Rules */}
            <div className="space-y-4">
              {rules.map(rule => {
                const isEditingThisRule = editingRuleId === rule.id && draftRule;

                if (isEditingThisRule && draftRule) {
                  return (
                    <div
                      key={rule.id}
                      className="border-2 border-sky-500/70 bg-slate-800/95 rounded-xl p-5 shadow-2xl space-y-5"
                    >
                      {/* Editor Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">
                            <Edit3 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-sky-400 uppercase tracking-wider">Editing Disciplinary Rule</div>
                            <div className="text-sm font-bold text-white">{draftRule.name || 'Untitled Rule'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveRule}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md shadow-emerald-900 transition"
                          >
                            <Check className="w-3.5 h-3.5" /> Save Changes
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id, rule.name)}
                            className="px-3 py-1.5 bg-rose-900/30 hover:bg-rose-800/50 text-rose-300 text-xs font-medium rounded-lg border border-rose-800/40 transition flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </div>

                      {/* Metadata Inputs */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Rule Name (English)</label>
                          <input
                            type="text"
                            value={draftRule.name}
                            onChange={e => setDraftRule({ ...draftRule, name: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                            placeholder="e.g. Late Arrival (1-15 min)"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Rule Name (Arabic)</label>
                          <input
                            type="text"
                            dir="rtl"
                            value={draftRule.nameAr || ''}
                            onChange={e => setDraftRule({ ...draftRule, nameAr: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 text-right"
                            placeholder="مثال: تأخر (1-15 دقيقة)"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Violation Category Type</label>
                          <select
                            value={draftRule.ruleType}
                            onChange={e => setDraftRule({ ...draftRule, ruleType: e.target.value as PenaltyRuleType })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                          >
                            <option value="LATE_ARRIVAL">Late Arrival</option>
                            <option value="EARLY_DEPARTURE">Early Departure</option>
                            <option value="ABSENT_NO_EXCUSE">Absent (No Excuse)</option>
                            <option value="ABSENT_NO_NOTICE">Absent (No Prior Notice)</option>
                            <option value="MISSING_PUNCH">Missing Punch</option>
                            <option value="OUTSIDE_GEOFENCE">Outside Geofence</option>
                            <option value="CONSECUTIVE_LATE">Consecutive Late</option>
                            <option value="MONTHLY_LATE_THRESHOLD">Monthly Late Threshold</option>
                            <option value="CUSTOM">Custom Disciplinary Policy</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Occurrence Reset Period</label>
                          <select
                            value={draftRule.resetPeriod}
                            onChange={e => setDraftRule({ ...draftRule, resetPeriod: e.target.value as any })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                          >
                            <option value="MONTHLY">Monthly (Resets at 1st of month)</option>
                            <option value="QUARTERLY">Quarterly (Resets every 3 months)</option>
                            <option value="YEARLY">Yearly (Resets annually)</option>
                            <option value="NEVER">Never (Lifetime cumulative escalation)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Min Late / Early Minutes</label>
                          <input
                            type="number"
                            min={0}
                            value={draftRule.triggerCondition.minLateMinutes ?? draftRule.triggerCondition.minEarlyLeaveMinutes ?? 0}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              setDraftRule({
                                ...draftRule,
                                triggerCondition: {
                                  ...draftRule.triggerCondition,
                                  minLateMinutes: val,
                                  minEarlyLeaveMinutes: val
                                }
                              });
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                            placeholder="0"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Max Late Minutes</label>
                          <input
                            type="number"
                            min={0}
                            value={draftRule.triggerCondition.maxLateMinutes ?? 999}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 999;
                              setDraftRule({
                                ...draftRule,
                                triggerCondition: {
                                  ...draftRule.triggerCondition,
                                  maxLateMinutes: val
                                }
                              });
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                            placeholder="999"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Description / Legal Reference</label>
                          <input
                            type="text"
                            value={draftRule.description || ''}
                            onChange={e => setDraftRule({ ...draftRule, description: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                            placeholder="Description or policy reference"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Applies To Staff Categories</label>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {(['Pharmacist', 'Driver', 'Worker', 'Management'] as StaffCategory[]).map(cat => {
                              const selected = draftRule.appliesTo.includes(cat);
                              return (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => handleToggleAppliesToCategory(cat)}
                                  className={`text-[11px] px-2.5 py-1 rounded border transition font-medium ${
                                    selected
                                      ? 'bg-sky-600 text-white border-sky-400 font-semibold shadow-sm'
                                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                                  }`}
                                >
                                  {selected ? '✓ ' : '+ '}{cat}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Escalation Tiers Editor */}
                      <div className="pt-2 border-t border-slate-700 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>Escalation Tiers ({draftRule.escalationTiers.length} of 5)</span>
                            <span className="text-[11px] text-slate-400 font-normal">— Set occurrence thresholds and penalties</span>
                          </div>
                          {draftRule.escalationTiers.length < 5 && (
                            <button
                              type="button"
                              onClick={handleAddTierToDraft}
                              className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 px-2 py-1 bg-sky-950/60 border border-sky-800/60 rounded-md transition"
                            >
                              <Plus className="w-3 h-3" /> Add Tier
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
                          {draftRule.escalationTiers.map((tier, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border flex flex-col justify-between space-y-2.5 ${
                                tier.action === 'TERMINATION_FLAG'
                                  ? 'bg-rose-950/30 border-rose-700/60'
                                  : tier.action.includes('DEDUCTION')
                                  ? 'bg-amber-950/20 border-amber-700/60'
                                  : 'bg-slate-900/80 border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                  Tier {tier.tier}
                                </span>
                                {draftRule.escalationTiers.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTierFromDraft(idx)}
                                    className="text-rose-400 hover:text-rose-200 p-0.5"
                                    title="Remove tier"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Occurrence (From - To)</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    value={tier.occurrenceRange[0]}
                                    onChange={e => handleUpdateDraftTier(idx, 'minOcc', e.target.value)}
                                    className="w-1/2 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs text-white text-center"
                                  />
                                  <span className="text-slate-500 text-xs">-</span>
                                  <input
                                    type="number"
                                    min={tier.occurrenceRange[0]}
                                    value={tier.occurrenceRange[1]}
                                    onChange={e => handleUpdateDraftTier(idx, 'maxOcc', e.target.value)}
                                    className="w-1/2 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs text-white text-center"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Prescribed Action</label>
                                <select
                                  value={tier.action}
                                  onChange={e => handleUpdateDraftTier(idx, 'action', e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-white focus:outline-none"
                                >
                                  <option value="VERBAL_WARNING">Verbal Warning</option>
                                  <option value="WRITTEN_WARNING">Written Warning</option>
                                  <option value="SALARY_DEDUCTION_HOURS">Deduct Hours</option>
                                  <option value="SALARY_DEDUCTION_DAYS">Deduct Days</option>
                                  <option value="SALARY_DEDUCTION_FIXED">Fixed BHD Amount</option>
                                  <option value="SUSPENSION_DAYS">Suspension Days</option>
                                  <option value="TERMINATION_FLAG">Termination Flag (HR Review)</option>
                                </select>
                              </div>

                              {(tier.action.includes('DEDUCTION') || tier.action.includes('SUSPENSION')) && (
                                <div>
                                  <label className="block text-[10px] text-sky-400 font-semibold mb-0.5">
                                    Value ({tier.action.includes('HOURS') ? 'Hours' : tier.action.includes('DAYS') ? 'Days' : 'BHD'})
                                  </label>
                                  <input
                                    type="number"
                                    step={tier.action.includes('DAYS') ? '0.25' : '1'}
                                    min={0}
                                    value={tier.deductionValue ?? 1}
                                    onChange={e => handleUpdateDraftTier(idx, 'deductionValue', e.target.value)}
                                    className="w-full bg-slate-950 border border-sky-600/50 rounded px-2 py-1 text-xs text-amber-300 font-bold"
                                  />
                                </div>
                              )}

                              <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Summary Note</label>
                                <input
                                  type="text"
                                  value={tier.description}
                                  onChange={e => handleUpdateDraftTier(idx, 'description', e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200"
                                  placeholder="Description"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Normal Read-Only View with Edit & Delete & Toggle buttons
                return (
                  <div
                    key={rule.id}
                    className={`border rounded-xl p-5 transition ${
                      rule.isActive
                        ? 'bg-slate-800/40 border-slate-700/80 hover:border-slate-600'
                        : 'bg-slate-900/40 border-slate-800/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-bold text-slate-100 text-base">{rule.name}</span>
                          {rule.nameAr && <span className="text-xs text-slate-400">({rule.nameAr})</span>}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              rule.isActive
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {rule.isActive ? 'Active' : 'Disabled'}
                          </span>
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-medium">
                            Reset: {rule.resetPeriod}
                          </span>
                          <span className="text-[10px] bg-sky-950/60 text-sky-300 px-2 py-0.5 rounded border border-sky-800/40 font-mono">
                            {rule.ruleType}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{rule.description}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleStartEdit(rule)}
                          className="text-xs px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded-lg font-medium transition flex items-center gap-1.5 border border-sky-500/30"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit Rule
                        </button>
                        <button
                          onClick={() => handleToggleRule(rule.id, rule.isActive)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                            rule.isActive
                              ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                          }`}
                        >
                          {rule.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id, rule.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Escalation Tiers Display */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                      {rule.escalationTiers.map((tier, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border text-xs space-y-1 ${
                            tier.action === 'TERMINATION_FLAG'
                              ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                              : tier.action.includes('DEDUCTION')
                              ? 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span>Tier {tier.tier}</span>
                            <span className="text-[10px] opacity-75">
                              Occ: {tier.occurrenceRange[0]}
                              {tier.occurrenceRange[1] !== tier.occurrenceRange[0] ? `-${tier.occurrenceRange[1]}` : ''}
                            </span>
                          </div>
                          <div className="font-semibold text-white truncate">{tier.action.replace(/_/g, ' ')}</div>
                          <div className="text-[11px] opacity-80 line-clamp-2">{tier.description}</div>
                          {tier.deductionValue !== undefined && tier.deductionValue > 0 && (
                            <div className="text-[10px] font-bold text-sky-400">
                              Deduction: {tier.deductionValue} {tier.action.includes('HOURS') ? 'Hours' : tier.action.includes('DAYS') ? 'Days' : 'BHD'}
                            </div>
                          )}
                          {tier.action === 'TERMINATION_FLAG' && (
                            <div className="text-[9px] bg-rose-900/40 text-rose-300 px-1.5 py-0.5 rounded font-mono">
                              INERT FLAG (HR Review Only)
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Applies to badges */}
                    <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-800/80">
                      <span className="text-[11px] text-slate-500 font-medium">Applies to:</span>
                      {rule.appliesTo.map(cat => (
                        <span
                          key={cat}
                          className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700/60 font-medium"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: WHAT-IF SIMULATION */}
        {activeTab === 'simulation' && (
          <div className="space-y-6">
            <div className="bg-sky-950/20 border border-sky-800/40 p-4 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-sky-200">Interactive Penalty Sandbox</h4>
                <p className="text-xs text-sky-300/80 mt-0.5">
                  Test how rules, grace periods, occurrence history, and employee basic salaries interact to produce
                  disciplinary actions and exact BHD deduction figures.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-800/40 p-5 rounded-xl border border-slate-700/60">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Employee</label>
                <select
                  value={simEmployeeId}
                  onChange={e => setSimEmployeeId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.code} - {emp.full_name} ({emp.category}) - Basic: {emp.salary_matrix?.basicSalary || 250} BHD
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Violation Type</label>
                <select
                  value={simRuleType}
                  onChange={e => setSimRuleType(e.target.value as PenaltyRuleType)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="LATE_ARRIVAL">Late Arrival</option>
                  <option value="EARLY_DEPARTURE">Early Departure</option>
                  <option value="ABSENT_NO_EXCUSE">Absent (No Excuse)</option>
                  <option value="ABSENT_NO_NOTICE">Absent (No Notice)</option>
                  <option value="MISSING_PUNCH">Missing Punch</option>
                  <option value="OUTSIDE_GEOFENCE">Outside Geofence</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Minutes (if late/early)</label>
                <input
                  type="number"
                  value={simMinutes}
                  onChange={e => setSimMinutes(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Violation Occurrence #</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={simOccurrence}
                  onChange={e => setSimOccurrence(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="md:col-span-4 flex justify-end pt-2">
                <button
                  onClick={handleRunSimulation}
                  className="px-6 py-2 bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-sky-500/20"
                >
                  <Calculator className="w-4 h-4" /> Calculate Disciplinary Result
                </button>
              </div>
            </div>

            {/* Simulation Result Card */}
            {simResult && (
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <Award className="w-6 h-6 text-amber-400" />
                    <div>
                      <h4 className="font-bold text-white text-base">Simulation Outcome</h4>
                      <p className="text-xs text-slate-400">
                        Evaluated for {simResult.employeeName} ({simResult.employeeCode}) • Basic Salary: {simResult.basicSalary} BHD
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-amber-400">
                      {simResult.deductionBhd?.toFixed(3) || '0.000'} BHD
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest">Calculated Net Deduction</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800">
                    <div className="text-xs text-slate-400 font-medium">Triggered Rule</div>
                    <div className="text-sm font-bold text-white mt-1">{simResult.ruleName}</div>
                  </div>
                  <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800">
                    <div className="text-xs text-slate-400 font-medium">Escalation Tier</div>
                    <div className="text-sm font-bold text-sky-400 mt-1">Tier {simResult.tier} (Occurrence #{simOccurrence})</div>
                  </div>
                  <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800">
                    <div className="text-xs text-slate-400 font-medium">Prescribed Action</div>
                    <div className="text-sm font-bold text-amber-300 mt-1">{simResult.action}</div>
                  </div>
                </div>

                <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800/80 font-mono text-xs text-slate-300 space-y-1">
                  <div className="text-slate-500 font-sans font-semibold text-[11px] mb-1">Mathematical Formula:</div>
                  <div>• Daily Rate = Basic Salary ({simResult.basicSalary} BHD) ÷ 30 days = {(simResult.basicSalary / 30).toFixed(3)} BHD/day</div>
                  <div>• Hourly Rate = Daily Rate ÷ {config.workingHoursPerDay || 8} hrs = {(simResult.basicSalary / 30 / (config.workingHoursPerDay || 8)).toFixed(3)} BHD/hr</div>
                  <div className="text-sky-300 font-bold">• Final Deduction = {simResult.deductionBhd?.toFixed(3)} BHD</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
