import React, { useState, useEffect, useMemo } from 'react';
import {
  Sliders, Plus, Edit3, Trash2, CheckCircle2,
  AlertTriangle, Banknote, Building2, UserCheck, ShieldCheck,
  Truck, Tag, Search, Filter, Clock, X, Info, ChevronRight,
  Layers, ArrowUpDown, ArrowUp, ArrowDown, HelpCircle, Calendar
} from 'lucide-react';
import Swal from 'sweetalert2';
import {
  OperationalRenewalType,
  RenewalTariffRule,
  WPDurationMonths,
  Branch
} from '../../types';
import {
  operationalRenewalService,
  DEFAULT_TARIFF_RULES
} from '../../services/operationalRenewalService';
import { branchService } from '../../services/branchService';
import { crService } from '../../services/crService';

interface RenewalTariffControlCenterProps {
  canManage?: boolean;
  onRefreshHub?: () => void;
}

type TariffSortField = 'renewalType' | 'label' | 'scope' | 'baseCostBHD' | 'isActive';

export const RenewalTariffControlCenter: React.FC<RenewalTariffControlCenterProps> = ({
  canManage = true,
  onRefreshHub
}) => {
  const [tariffs, setTariffs] = useState<RenewalTariffRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [crs, setCrs] = useState<any[]>([]);

  // Filter & Search
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sorting
  const [sortField, setSortField] = useState<TariffSortField>('renewalType');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingTariff, setEditingTariff] = useState<RenewalTariffRule | null>(null);

  // Form State
  const [formType, setFormType] = useState<OperationalRenewalType>('CR');
  const [formLabel, setFormLabel] = useState<string>('');
  const [formLabelAr, setFormLabelAr] = useState<string>('');
  const [formCost, setFormCost] = useState<number>(50.000);
  const [formDuration, setFormDuration] = useState<WPDurationMonths | undefined>(undefined);
  const [formEntityPattern, setFormEntityPattern] = useState<string>('');
  const [formBranchCode, setFormBranchCode] = useState<string>('');
  const [formIsDefault, setFormIsDefault] = useState<boolean>(false);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formNotes, setFormNotes] = useState<string>('');
  const [formPaymentScheduleType, setFormPaymentScheduleType] = useState<'LEAD_DAYS' | 'FIXED_DATE'>('LEAD_DAYS');
  const [formPaymentLeadDays, setFormPaymentLeadDays] = useState<number>(15);
  const [formTargetPaymentDate, setFormTargetPaymentDate] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Load tariffs and master data
  const loadData = async () => {
    setLoading(true);
    try {
      const [tariffList, branchList, crList] = await Promise.all([
        operationalRenewalService.listTariffs(),
        branchService.list().catch(() => []),
        crService.list().catch(() => [])
      ]);
      setTariffs(tariffList);
      setBranches(branchList);
      setCrs(crList);
    } catch (err) {
      console.error('Failed to load tariffs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle column sort toggle
  const handleSort = (field: TariffSortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Render sort direction icon
  const renderSortIcon = (field: TariffSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-60 group-hover:opacity-100 transition-opacity" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-3.5 h-3.5 text-emerald-600 font-black animate-in fade-in zoom-in-75 duration-150" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-emerald-600 font-black animate-in fade-in zoom-in-75 duration-150" />
    );
  };

  // Filtered and Sorted tariffs
  const filteredTariffs = useMemo(() => {
    const filtered = tariffs.filter(t => {
      if (selectedTypeFilter !== 'ALL' && t.renewalType !== selectedTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchLabel = (t.label || '').toLowerCase().includes(q);
        const matchLabelAr = (t.labelAr || '').toLowerCase().includes(q);
        const matchEntity = (t.entityPattern || '').toLowerCase().includes(q);
        const matchBranch = (t.branchCode || '').toLowerCase().includes(q);
        const matchNotes = (t.notes || '').toLowerCase().includes(q);
        if (!matchLabel && !matchLabelAr && !matchEntity && !matchBranch && !matchNotes) {
          return false;
        }
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'renewalType':
          comparison = (a.renewalType || '').localeCompare(b.renewalType || '');
          break;
        case 'label':
          comparison = (a.label || '').localeCompare(b.label || '');
          break;
        case 'scope': {
          const scopeA = a.entityPattern || a.branchCode || (a.durationMonths ? `${a.durationMonths}M` : '') || (a.isDefault ? 'Default' : '');
          const scopeB = b.entityPattern || b.branchCode || (b.durationMonths ? `${b.durationMonths}M` : '') || (b.isDefault ? 'Default' : '');
          comparison = scopeA.localeCompare(scopeB);
          break;
        }
        case 'baseCostBHD':
          comparison = (a.baseCostBHD || 0) - (b.baseCostBHD || 0);
          break;
        case 'isActive': {
          const activeA = a.isActive !== false ? 1 : 0;
          const activeB = b.isActive !== false ? 1 : 0;
          comparison = activeA - activeB;
          break;
        }
        default:
          comparison = 0;
      }

      // Tie breaker by label
      if (comparison === 0) {
        comparison = (a.label || '').localeCompare(b.label || '');
      }

      return sortAsc ? comparison : -comparison;
    });
  }, [tariffs, selectedTypeFilter, searchQuery, sortField, sortAsc]);

  // Grouped stats
  const stats = useMemo(() => {
    const total = tariffs.length;
    const active = tariffs.filter(t => t.isActive !== false).length;
    const wpCount = tariffs.filter(t => t.renewalType === 'WORK_PERMIT').length;
    const crCount = tariffs.filter(t => t.renewalType === 'CR' || t.renewalType === 'CHAMBER_OF_COMMERCE').length;
    const nhraCount = tariffs.filter(t => t.renewalType === 'NHRA_PHARMACY' || t.renewalType === 'NHRA_PHARMACIST').length;
    const customOverrides = tariffs.filter(t => !t.isDefault).length;
    return { total, active, wpCount, crCount, nhraCount, customOverrides };
  }, [tariffs]);

  // Work Permit duration rules (6, 12, 24 months)
  const wpTiers = useMemo(() => {
    const wpRules = tariffs.filter(t => t.renewalType === 'WORK_PERMIT');
    return {
      m6: wpRules.find(r => r.durationMonths === 6),
      m12: wpRules.find(r => r.durationMonths === 12),
      m24: wpRules.find(r => r.durationMonths === 24)
    };
  }, [tariffs]);

  // Open modal for Create
  const handleOpenCreate = (presetType?: OperationalRenewalType, presetDuration?: WPDurationMonths) => {
    const type = presetType || 'CR';
    const initialLookup = operationalRenewalService.lookupTariff({
      renewalType: type,
      durationMonths: presetDuration || (type === 'WORK_PERMIT' ? 12 : undefined)
    });
    setEditingTariff(null);
    setFormType(type);
    setFormCost(initialLookup.cost);
    setFormDuration(presetDuration || (type === 'WORK_PERMIT' ? 12 : undefined));
    setFormLabel('');
    setFormLabelAr('');
    setFormEntityPattern('');
    setFormBranchCode('');
    setFormIsDefault(false);
    setFormIsActive(true);
    setFormNotes('');
    setFormPaymentScheduleType('LEAD_DAYS');
    setFormPaymentLeadDays(15);
    setFormTargetPaymentDate('');
    setShowModal(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (rule: RenewalTariffRule) => {
    setEditingTariff(rule);
    setFormType(rule.renewalType);
    setFormCost(rule.baseCostBHD);
    setFormDuration(rule.durationMonths as WPDurationMonths | undefined);
    setFormLabel(rule.label);
    setFormLabelAr(rule.labelAr || '');
    setFormEntityPattern(rule.entityPattern || '');
    setFormBranchCode(rule.branchCode || '');
    setFormIsDefault(Boolean(rule.isDefault));
    setFormIsActive(rule.isActive !== false);
    setFormNotes(rule.notes || '');
    if (rule.targetPaymentDate) {
      setFormPaymentScheduleType('FIXED_DATE');
      setFormTargetPaymentDate(rule.targetPaymentDate);
      setFormPaymentLeadDays(rule.paymentLeadDays ?? 15);
    } else {
      setFormPaymentScheduleType('LEAD_DAYS');
      setFormPaymentLeadDays(rule.paymentLeadDays ?? 15);
      setFormTargetPaymentDate('');
    }
    setShowModal(true);
  };

  // Quick edit cost prompt for WP tier
  const handleQuickEditCost = async (rule?: RenewalTariffRule, fallbackDuration?: WPDurationMonths) => {
    const currentCost = rule
      ? rule.baseCostBHD
      : operationalRenewalService.lookupTariff({
          renewalType: 'WORK_PERMIT',
          durationMonths: fallbackDuration || 12
        }).cost;
    const { value: newCostStr } = await Swal.fire({
      title: `Update Fee`,
      html: `
        <div class="text-left text-xs mb-3 text-slate-600">
          Set renewal fee in <b>Bahrain Dinar (BHD)</b>:
        </div>
      `,
      input: 'number',
      inputValue: currentCost.toFixed(3),
      inputAttributes: {
        step: '0.001',
        min: '0'
      },
      showCancelButton: true,
      confirmButtonText: 'Save Fee',
      confirmButtonColor: '#10b981',
      cancelButtonText: 'Cancel'
    });

    if (newCostStr !== undefined) {
      const parsed = parseFloat(newCostStr);
      if (isNaN(parsed) || parsed < 0) {
        Swal.fire({ icon: 'error', title: 'Invalid Amount', text: 'Please enter a valid positive number.' });
        return;
      }

      if (rule) {
        const updated: RenewalTariffRule = { ...rule, baseCostBHD: parsed };
        await operationalRenewalService.saveTariff(updated);
      } else {
        const newRule: RenewalTariffRule = {
          id: `tariff-wp-${fallbackDuration}m`,
          renewalType: 'WORK_PERMIT',
          durationMonths: fallbackDuration,
          label: `Work Permit – ${fallbackDuration} Months (LMRA)`,
          labelAr: '',
          baseCostBHD: parsed,
          isDefault: false,
          isActive: true
        };
        await operationalRenewalService.saveTariff(newRule);
      }

      await loadData();
      if (onRefreshHub) onRefreshHub();
      Swal.fire({
        icon: 'success',
        title: 'Tariff Updated',
        text: `Fee set to ${parsed.toFixed(3)} BHD.`,
        timer: 1500,
        showConfirmButton: false
      });
    }
  };

  // Save Modal Form
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formCost < 0) {
      Swal.fire({ icon: 'error', title: 'Invalid Cost', text: 'Cost must be 0 or greater.' });
      return;
    }

    const label = formLabel.trim() || `${formType} ${formDuration ? `${formDuration}M` : ''} Tariff Rule`;
    setSaving(true);
    try {
      const payload: RenewalTariffRule = {
        id: editingTariff ? editingTariff.id : `tariff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        renewalType: formType,
        label,
        labelAr: formLabelAr.trim() || undefined,
        baseCostBHD: Number(formCost),
        durationMonths: formType === 'WORK_PERMIT' ? formDuration : undefined,
        entityPattern: formEntityPattern.trim() || undefined,
        branchCode: formBranchCode.trim().toUpperCase() || undefined,
        paymentLeadDays: formPaymentScheduleType === 'LEAD_DAYS' ? Number(formPaymentLeadDays || 15) : undefined,
        targetPaymentDate: formPaymentScheduleType === 'FIXED_DATE' ? (formTargetPaymentDate.trim() || undefined) : undefined,
        isDefault: formIsDefault,
        isActive: formIsActive,
        notes: formNotes.trim() || undefined
      };

      await operationalRenewalService.saveTariff(payload);
      await loadData();
      if (onRefreshHub) onRefreshHub();
      setShowModal(false);

      Swal.fire({
        icon: 'success',
        title: 'Tariff Rule Saved',
        text: 'The renewal cost rule is now active and applied across budgeting and records.',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Save Failed', text: err?.message || 'Could not save tariff.' });
    } finally {
      setSaving(false);
    }
  };

  // Delete Tariff
  const handleDelete = async (rule: RenewalTariffRule) => {
    const res = await Swal.fire({
      title: 'Delete Tariff Rule?',
      html: `Are you sure you want to delete <b>"${rule.label}"</b>?<br/><span class="text-xs text-slate-500">Records using this rule will fall back to default category tariffs.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, Delete Rule',
      cancelButtonText: 'Cancel'
    });

    if (res.isConfirmed) {
      try {
        await operationalRenewalService.deleteTariff(rule.id);
        await loadData();
        if (onRefreshHub) onRefreshHub();
        Swal.fire({
          icon: 'success',
          title: 'Deleted',
          text: 'Tariff rule removed.',
          timer: 1200,
          showConfirmButton: false
        });
      } catch (err: any) {
        Swal.fire({ icon: 'error', title: 'Delete Failed', text: err?.message });
      }
    }
  };



  // Helper for Category badge
  const renderCategoryBadge = (type: OperationalRenewalType) => {
    switch (type) {
      case 'CR':
        return <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200"><Building2 className="w-3 h-3" /> Commercial Reg (CR)</span>;
      case 'CHAMBER_OF_COMMERCE':
        return <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200"><Building2 className="w-3 h-3" /> Chamber (BCCI)</span>;
      case 'WORK_PERMIT':
        return <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200"><UserCheck className="w-3 h-3" /> Work Permit (LMRA)</span>;
      case 'NHRA_PHARMACY':
        return <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200"><ShieldCheck className="w-3 h-3" /> NHRA Pharmacy</span>;
      case 'NHRA_PHARMACIST':
        return <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200"><UserCheck className="w-3 h-3" /> NHRA Pharmacist</span>;
      case 'FLEET_VEHICLE':
        return <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200"><Truck className="w-3 h-3" /> Fleet Vehicles</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200"><Tag className="w-3 h-3" /> Other</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Center Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30 flex items-center gap-1">
                <Sliders className="w-3 h-3" />
                Financial Control Center
              </span>
              <span className="text-xs text-slate-400 font-mono">ERP Tariff Engine v2.0</span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              Renewal Tariffs & Custom Fee Rules
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
              Configure baseline statutory tariffs, duration tiers, and custom fee rules across commercial entities.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {canManage && (
              <button
                onClick={() => handleOpenCreate()}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition-all shadow-md shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Tariff Rule</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick KPI Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Rules</span>
            <span className="text-xl font-black text-white">{stats.total}</span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">LMRA WP Tiers</span>
            <span className="text-xl font-black text-indigo-400">{stats.wpCount}</span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">CR & Chamber</span>
            <span className="text-xl font-black text-blue-400">{stats.crCount}</span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">NHRA Rules</span>
            <span className="text-xl font-black text-emerald-400">{stats.nhraCount}</span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Custom Overrides</span>
            <span className="text-xl font-black text-amber-400">{stats.customOverrides}</span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Currency</span>
            <span className="text-xl font-black text-emerald-300 font-mono">BHD</span>
          </div>
        </div>
      </div>

      {/* SPECIAL HIGHLIGHT SECTION 1: Work Permit (LMRA) Duration Tiers */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              Employee Work Permit (LMRA) Duration Pricing Tiers
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Employee work permit pricing tiers based on renewal duration (6, 12, or 24 months). No default tier is enforced; the user determines the duration tier or custom fee per employee.
            </p>
          </div>
          <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
            Multi-Tier Duration Engine
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* 6 Months Card */}
          <div className="p-5 rounded-2xl border-2 border-slate-200 hover:border-indigo-400 bg-gradient-to-b from-white to-slate-50/50 transition-all shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-600">Tier 1 · 6 Months</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-black">6M</span>
              </div>
              <h4 className="text-sm font-black text-slate-900">6 Months Renewal (Semi-Annual)</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                {wpTiers.m6?.notes || '6-month temporary work permit and healthcare fee'}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-indigo-700 font-mono">
                  {(wpTiers.m6?.baseCostBHD ?? operationalRenewalService.lookupTariff({ renewalType: 'WORK_PERMIT', durationMonths: 6 }).cost).toFixed(3)}
                </span>
                <span className="text-xs font-black text-slate-400 ml-1">BHD</span>
              </div>
              {canManage && (
                <button
                  onClick={() => handleQuickEditCost(wpTiers.m6, 6)}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all border border-indigo-200 flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  Edit Fee
                </button>
              )}
            </div>
          </div>

          {/* 12 Months Card */}
          <div className="p-5 rounded-2xl border-2 border-slate-200 hover:border-indigo-400 bg-gradient-to-b from-white to-slate-50/50 transition-all shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-600">Tier 2 · 12 Months</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-black">12M / 1 Year</span>
              </div>
              <h4 className="text-sm font-black text-slate-900">12 Months Renewal (1 Year)</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                {wpTiers.m12?.notes || 'Annual LMRA work permit and healthcare fee'}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-indigo-700 font-mono">
                  {(wpTiers.m12?.baseCostBHD ?? operationalRenewalService.lookupTariff({ renewalType: 'WORK_PERMIT', durationMonths: 12 }).cost).toFixed(3)}
                </span>
                <span className="text-xs font-black text-slate-400 ml-1">BHD</span>
              </div>
              {canManage && (
                <button
                  onClick={() => handleQuickEditCost(wpTiers.m12, 12)}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all border border-indigo-200 flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  Edit Fee
                </button>
              )}
            </div>
          </div>

          {/* 24 Months Card */}
          <div className="p-5 rounded-2xl border-2 border-slate-200 hover:border-indigo-400 bg-gradient-to-b from-white to-slate-50/50 transition-all shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-600">Tier 3 · 24 Months</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-black">24M / 2 Years</span>
              </div>
              <h4 className="text-sm font-black text-slate-900">24 Months Renewal (2 Years)</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                {wpTiers.m24?.notes || 'Full 2-year LMRA work permit with healthcare fee'}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-indigo-700 font-mono">
                  {(wpTiers.m24?.baseCostBHD ?? operationalRenewalService.lookupTariff({ renewalType: 'WORK_PERMIT', durationMonths: 24 }).cost).toFixed(3)}
                </span>
                <span className="text-xs font-black text-slate-400 ml-1">BHD</span>
              </div>
              {canManage && (
                <button
                  onClick={() => handleQuickEditCost(wpTiers.m24, 24)}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all border border-indigo-200 flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  Edit Fee
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SPECIAL HIGHLIGHT SECTION 2: Standard Baseline Tariffs & Overrides */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CR & Chamber of Commerce */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">Commercial Registrations & Chamber</h4>
                <p className="text-[10px] text-slate-500">Ministry of Industry & Commerce (MOIC) and Bahrain Chamber</p>
              </div>
            </div>
            {canManage && (
              <button
                onClick={() => handleOpenCreate('CR')}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-all"
              >
                <Plus className="w-3 h-3" /> Add CR Override
              </button>
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <span className="font-bold text-slate-800 block">Commercial Registration (Standard CR)</span>
                <span className="text-[10px] text-slate-400">Default annual MOIC renewal fee</span>
              </div>
              <span className="font-mono font-black text-slate-900 text-sm">
                {(tariffs.find(t => t.renewalType === 'CR' && t.isDefault)?.baseCostBHD ?? 50.000).toFixed(3)} BHD
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <span className="font-bold text-slate-800 block">Chamber of Commerce (BCCI)</span>
                <span className="text-[10px] text-slate-400">Annual BCCI membership fee</span>
              </div>
              <span className="font-mono font-black text-slate-900 text-sm">
                {(tariffs.find(t => t.renewalType === 'CHAMBER_OF_COMMERCE' && t.isDefault)?.baseCostBHD ?? 25.000).toFixed(3)} BHD
              </span>
            </div>

            {/* List any custom CR overrides */}
            {tariffs.filter(t => t.renewalType === 'CR' && !t.isDefault).map(ov => (
              <div key={ov.id} className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/50 border border-blue-100">
                <div>
                  <span className="font-bold text-blue-900 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    {ov.label}
                  </span>
                  <span className="text-[10px] text-blue-600">Match: {ov.entityPattern || ov.branchCode || 'Specific'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-blue-900 text-sm">
                    {ov.baseCostBHD.toFixed(3)} BHD
                  </span>
                  {canManage && (
                    <button onClick={() => handleOpenEdit(ov)} className="text-slate-400 hover:text-blue-600">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NHRA Pharmacy Facility & Pharmacists */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">NHRA Licenses</h4>
                <p className="text-[10px] text-slate-500">Pharmacy facility licenses and pharmacist practice permits</p>
              </div>
            </div>
            {canManage && (
              <button
                onClick={() => handleOpenCreate('NHRA_PHARMACY')}
                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-all"
              >
                <Plus className="w-3 h-3" /> Add NHRA Override
              </button>
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <span className="font-bold text-slate-800 block">NHRA Pharmacy Facility (3-Year)</span>
                <span className="text-[10px] text-slate-400">Default facility license renewal fee</span>
              </div>
              <span className="font-mono font-black text-emerald-800 text-sm">
                {(tariffs.find(t => t.renewalType === 'NHRA_PHARMACY' && t.isDefault)?.baseCostBHD ?? 500.000).toFixed(3)} BHD
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <span className="font-bold text-slate-800 block">NHRA Pharmacist License (Professional)</span>
                <span className="text-[10px] text-slate-400">Staff pharmacist practice license</span>
              </div>
              <span className="font-mono font-black text-teal-800 text-sm">
                {(tariffs.find(t => t.renewalType === 'NHRA_PHARMACIST' && t.isDefault)?.baseCostBHD ?? 100.000).toFixed(3)} BHD
              </span>
            </div>

            {/* List any custom NHRA overrides */}
            {tariffs.filter(t => (t.renewalType === 'NHRA_PHARMACY' || t.renewalType === 'NHRA_PHARMACIST') && !t.isDefault).map(ov => (
              <div key={ov.id} className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <div>
                  <span className="font-bold text-emerald-900 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    {ov.label}
                  </span>
                  <span className="text-[10px] text-emerald-600">Match: {ov.entityPattern || ov.branchCode || 'Specific'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-emerald-900 text-sm">
                    {ov.baseCostBHD.toFixed(3)} BHD
                  </span>
                  {canManage && (
                    <button onClick={() => handleOpenEdit(ov)} className="text-slate-400 hover:text-emerald-600">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ALL TARIFF RULES TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-600" />
              All Tariff Rules Directory ({filteredTariffs.length})
            </h4>
            {sortField && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                <span>Sorted by:</span>
                <span className="font-black">
                  {sortField === 'baseCostBHD' ? 'Fee' :
                   sortField === 'renewalType' ? 'Category' :
                   sortField === 'label' ? 'Rule Label' :
                   sortField === 'scope' ? 'Scope' : 'Status'}
                </span>
                <span>({sortAsc ? 'Ascending ↑' : 'Descending ↓'})</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search rule, entity, CR, code..."
                className="w-full text-xs font-medium pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Type Filter */}
            <select
              value={selectedTypeFilter}
              onChange={e => setSelectedTypeFilter(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            >
              <option value="ALL">All Categories</option>
              <option value="CR">Commercial Reg (CR)</option>
              <option value="CHAMBER_OF_COMMERCE">Chamber of Commerce (BCCI)</option>
              <option value="WORK_PERMIT">Work Permit (LMRA)</option>
              <option value="NHRA_PHARMACY">NHRA Pharmacy Facility</option>
              <option value="NHRA_PHACIST" style={{ display: 'none' }}>Hidden</option>
              <option value="NHRA_PHARMACIST">NHRA Pharmacist</option>
              <option value="FLEET_VEHICLE">Fleet Vehicles</option>
              <option value="OTHER">Other Documents</option>
            </select>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-[11px] font-black uppercase tracking-wider border-b border-slate-200 select-none">
                <th
                  onClick={() => handleSort('renewalType')}
                  className={`py-3 px-4 cursor-pointer hover:bg-slate-100 hover:text-slate-900 transition-colors group ${
                    sortField === 'renewalType' ? 'text-emerald-800 bg-emerald-50/50' : ''
                  }`}
                  title="Click to sort by Category (Ascending / Descending)"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Category</span>
                    {renderSortIcon('renewalType')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('label')}
                  className={`py-3 px-4 cursor-pointer hover:bg-slate-100 hover:text-slate-900 transition-colors group ${
                    sortField === 'label' ? 'text-emerald-800 bg-emerald-50/50' : ''
                  }`}
                  title="Click to sort by Rule Label & Description (Ascending / Descending)"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Rule Label & Description</span>
                    {renderSortIcon('label')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('scope')}
                  className={`py-3 px-4 cursor-pointer hover:bg-slate-100 hover:text-slate-900 transition-colors group ${
                    sortField === 'scope' ? 'text-emerald-800 bg-emerald-50/50' : ''
                  }`}
                  title="Click to sort by Scope & Conditions (Ascending / Descending)"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Scope & Conditions</span>
                    {renderSortIcon('scope')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('baseCostBHD')}
                  className={`py-3 px-4 text-right cursor-pointer hover:bg-slate-100 hover:text-slate-900 transition-colors group ${
                    sortField === 'baseCostBHD' ? 'text-emerald-800 bg-emerald-50/50' : ''
                  }`}
                  title="Click to sort by Fee (Ascending / Descending)"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Fee (BHD)</span>
                    {renderSortIcon('baseCostBHD')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('isActive')}
                  className={`py-3 px-4 text-center cursor-pointer hover:bg-slate-100 hover:text-slate-900 transition-colors group ${
                    sortField === 'isActive' ? 'text-emerald-800 bg-emerald-50/50' : ''
                  }`}
                  title="Click to sort by Status (Ascending / Descending)"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Status</span>
                    {renderSortIcon('isActive')}
                  </div>
                </th>

                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTariffs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    <Info className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-bold">No tariff rules found matching the filters.</p>
                  </td>
                </tr>
              ) : (
                filteredTariffs.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold">
                      {renderCategoryBadge(t.renewalType)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        {t.label}
                        {t.isDefault && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {t.targetPaymentDate ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200" title="Fixed target payment date">
                            <Calendar className="w-2.5 h-2.5" />
                            Target: {t.targetPaymentDate}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200" title="Auto-scheduled before expiry">
                            <Clock className="w-2.5 h-2.5" />
                            Target: {t.paymentLeadDays ?? 15}d before expiry
                          </span>
                        )}
                      </div>
                      {t.notes && (
                        <div className="text-[10px] text-slate-400 mt-0.5 max-w-xs truncate">
                          {t.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {t.renewalType === 'WORK_PERMIT' && t.durationMonths ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          <Clock className="w-3 h-3" /> {t.durationMonths} Months Duration
                        </span>
                      ) : t.entityPattern ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200" title={`Matches: ${t.entityPattern}`}>
                          Match: {t.entityPattern}
                        </span>
                      ) : t.branchCode ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Branch: {t.branchCode}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">All entities (Default standard)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-sm font-black font-mono text-slate-900">
                        {t.baseCostBHD.toFixed(3)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold ml-1">BHD</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {t.isActive !== false ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                      {canManage && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(t)}
                            className="p-1.5 text-slate-400 hover:text-brand hover:bg-slate-100 rounded-lg transition-all"
                            title="Edit Tariff"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {!t.isDefault && (
                            <button
                              onClick={() => handleDelete(t)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Delete Rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT TARIFF MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Banknote className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-black text-slate-900">
                    {editingTariff ? 'Edit Renewal Tariff Rule' : 'Add Custom Renewal Tariff Rule'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configure fee amount, payment timing schedule, and matching scope for operational renewals
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModal} className="p-6 space-y-4 overflow-y-auto">
              {/* Category & Fee Side-by-Side in Wide Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category / Type */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Renewal Category *
                  </label>
                  <select
                    value={formType}
                    onChange={e => {
                      const newType = e.target.value as OperationalRenewalType;
                      setFormType(newType);
                      if (newType === 'WORK_PERMIT' && !formDuration) {
                        setFormDuration(12);
                      }
                    }}
                    className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="CR">Commercial Registration (CR)</option>
                    <option value="CHAMBER_OF_COMMERCE">Chamber of Commerce (BCCI)</option>
                    <option value="WORK_PERMIT">Work Permit (LMRA)</option>
                    <option value="NHRA_PHARMACY">NHRA Pharmacy Facility</option>
                    <option value="NHRA_PHARMACIST">NHRA Pharmacist</option>
                    <option value="FLEET_VEHICLE">Fleet Vehicle</option>
                    <option value="OTHER">Other Operational</option>
                  </select>
                </div>

                {/* Fee in BHD */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Renewal Fee in BHD *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      required
                      value={formCost}
                      onChange={e => setFormCost(parseFloat(e.target.value) || 0)}
                      placeholder="0.000"
                      className="w-full text-sm font-black text-emerald-950 font-mono bg-white border border-slate-200 rounded-xl pl-3 pr-12 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <span className="absolute right-3 top-3 text-[10px] font-black text-slate-400">
                      BHD
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    e.g. 50.000 for standard CR, 205.000 for 1-year WP, 500.000 for NHRA Pharmacy
                  </span>
                </div>
              </div>

              {/* Special WORK_PERMIT duration selector */}
              {formType === 'WORK_PERMIT' && (
                <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-indigo-900">
                    Work Permit Duration Tier *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[6, 12, 24].map(dur => (
                      <button
                        type="button"
                        key={dur}
                        onClick={() => {
                          setFormDuration(dur as WPDurationMonths);
                          if (!editingTariff) {
                            const tierLookup = operationalRenewalService.lookupTariff({
                              renewalType: 'WORK_PERMIT',
                              durationMonths: dur
                            });
                            setFormCost(tierLookup.cost);
                          }
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-black transition-all text-center border ${
                          formDuration === dur
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {dur} Months ({dur === 12 ? '1 Year' : dur === 24 ? '2 Years' : 'Half Year'})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Target Payment Timing & Schedule Control */}
              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    Target Payment Timing
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    Payment Plan Link
                  </span>
                </div>

                {/* Schedule Type Switcher */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-white rounded-xl border border-emerald-200">
                  <button
                    type="button"
                    onClick={() => setFormPaymentScheduleType('LEAD_DAYS')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      formPaymentScheduleType === 'LEAD_DAYS'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Lead Days Before Expiry</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormPaymentScheduleType('FIXED_DATE')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      formPaymentScheduleType === 'FIXED_DATE'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Fixed Calendar Date</span>
                  </button>
                </div>

                {formPaymentScheduleType === 'LEAD_DAYS' ? (
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Lead Days Before Expiry:
                      </label>
                      <span className="font-mono font-black text-xs text-emerald-900">
                        {formPaymentLeadDays} Days Before
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5">
                      {[7, 15, 30, 45, 60].map(days => (
                        <button
                          type="button"
                          key={days}
                          onClick={() => setFormPaymentLeadDays(days)}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all ${
                            formPaymentLeadDays === days
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {days === 15 ? '15d (Default)' : `${days}d`}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] text-slate-500 font-medium">Custom lead days:</span>
                      <input
                        type="number"
                        min="0"
                        max="365"
                        value={formPaymentLeadDays}
                        onChange={e => setFormPaymentLeadDays(parseInt(e.target.value, 10) || 0)}
                        className="w-24 text-xs font-black font-mono text-slate-900 bg-white border border-slate-200 rounded-lg px-2 py-1 text-center"
                      />
                      <span className="text-[11px] text-slate-400 font-bold">days before expiry</span>
                    </div>
                    <p className="text-[10px] text-emerald-800 font-medium">
                      ✓ Applied automatically to payment schedule: <b>Expiry Date - {formPaymentLeadDays} days</b>.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Specific Target Payment Date:
                    </label>
                    <input
                      type="date"
                      value={formTargetPaymentDate}
                      onChange={e => setFormTargetPaymentDate(e.target.value)}
                      required={formPaymentScheduleType === 'FIXED_DATE'}
                      className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                    />
                    <p className="text-[10px] text-purple-900 font-medium">
                      ✓ Sets the planned payment date for all matching renewals to ({formTargetPaymentDate || 'YYYY-MM-DD'}).
                    </p>
                  </div>
                )}
              </div>

              {/* Rule Labels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Rule Name / Label *
                  </label>
                  <input
                    type="text"
                    required
                    value={formLabel}
                    onChange={e => setFormLabel(e.target.value)}
                    placeholder="e.g. CR 32000185 Custom Renewal"
                    className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Secondary Reference / Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={formLabelAr}
                    onChange={e => setFormLabelAr(e.target.value)}
                    placeholder="e.g. MOIC-CR-JERDAB-01"
                    className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Matching Scope / Overrides (for specific CR / Entity) */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-500" />
                    Custom Override Criteria
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Match Entity Name or CR No.
                    </label>
                    <input
                      type="text"
                      value={formEntityPattern}
                      onChange={e => setFormEntityPattern(e.target.value)}
                      placeholder="e.g. 32000185 or Jerdab"
                      className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Match Branch Code
                    </label>
                    <select
                      value={formBranchCode}
                      onChange={e => setFormBranchCode(e.target.value)}
                      className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="">None / Any Branch</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.code}>
                          {b.code} — {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quick Helper to select from existing CRs */}
                {formType === 'CR' && crs.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-500 block mb-1.5">
                      Quick Select Registered Commercial Registration:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-0.5">
                      {crs.map(c => (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => {
                            setFormEntityPattern(c.cr_number);
                            setFormLabel(`CR ${c.cr_number} (${c.linked_branch_name || c.cr_name || 'Branch'}) Renewal`);
                          }}
                          className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 transition-colors shadow-2xs"
                        >
                          {c.cr_number} {c.linked_branch_name ? `· ${c.linked_branch_name}` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Toggles: isDefault & isActive */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isDefaultCheckbox"
                    checked={formIsDefault}
                    onChange={e => setFormIsDefault(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <label htmlFor="isDefaultCheckbox" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Set as Category Default
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActiveCheckbox"
                    checked={formIsActive}
                    onChange={e => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <label htmlFor="isActiveCheckbox" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Active (Enabled)
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Notes & Authority Details
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="e.g. Applicable regulatory authority fees, inspection notes, Sadad service codes..."
                  className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Tariff Rule'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
