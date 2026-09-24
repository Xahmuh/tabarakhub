import React, { useMemo, useState } from 'react';
import { DropdownSearch } from '../ui/DropdownSearch';
import { MOCK_AREAS, MOCK_BRANCHES, MOCK_USERS } from '../../data';
import { Branch, User } from '../../types';
import { Building2, CheckCircle2, Filter, KeyRound, ShieldCheck, UserCheck } from 'lucide-react';

/**
 * DropdownSearch Standalone Demo View (Phase 1 Definition of Done)
 * Demonstrates DropdownSearch operating with:
 * - 20 Mock Branches grouped by Area
 * - Mock Pharmacists filtered by branch
 * - Typo-tolerant fuzzy searching
 * - Full keyboard navigation & ARIA
 * - Section 3 Flat 2.0 theme styling
 */
export function DropdownSearchDemo() {
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(MOCK_BRANCHES[0]?.id || null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedPharmacistId, setSelectedPharmacistId] = useState<string | null>(
    MOCK_USERS.find(u => u.role === 'pharmacist')?.id || null
  );
  const [isDisabled, setIsDisabled] = useState(false);
  const [isClearable, setIsClearable] = useState(true);

  // Filter branches by selected area if chosen
  const filteredBranches = useMemo(() => {
    if (!selectedAreaId) return MOCK_BRANCHES;
    return MOCK_BRANCHES.filter(b => b.area_id === selectedAreaId);
  }, [selectedAreaId]);

  // Pharmacists list
  const pharmacists = useMemo(() => {
    return MOCK_USERS.filter(u => u.role === 'pharmacist');
  }, []);

  // Pharmacists filtered by branch if branch is selected
  const branchPharmacists = useMemo(() => {
    if (!selectedBranchId) return pharmacists;
    const branchSpecific = pharmacists.filter(p => p.branch_id === selectedBranchId);
    return branchSpecific.length > 0 ? branchSpecific : pharmacists;
  }, [selectedBranchId, pharmacists]);

  // Selected Branch object
  const activeBranch = useMemo(() => {
    return MOCK_BRANCHES.find(b => b.id === selectedBranchId) || null;
  }, [selectedBranchId]);

  // Selected Pharmacist object
  const activePharmacist = useMemo(() => {
    return MOCK_USERS.find(u => u.id === selectedPharmacistId) || null;
  }, [selectedPharmacistId]);

  // Map area id to area name for grouping
  const areaNameMap = useMemo(() => {
    return new Map(MOCK_AREAS.map(a => [a.id, a.name]));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 p-6 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Ribbon */}
        <div className="border-b border-slate-200 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
                <ShieldCheck className="w-4 h-4" />
                <span>TQPH Phase 1 — Foundation Verification</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-950 mt-1">
                DropdownSearch Component Demo
              </h1>
              <p className="text-sm text-slate-500 mt-1 font-medium">
                Zero native &lt;select&gt; elements. Typo-tolerant fuzzy filtering, keyboard navigation, grouping, and executive light design tokens.
              </p>
            </div>

            {/* Toggle Controls */}
            <div className="flex items-center gap-3 bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-xs shadow-sm">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isClearable}
                  onChange={e => setIsClearable(e.target.checked)}
                  className="rounded border-slate-300 text-red-700 focus:ring-red-600"
                />
                <span className="text-slate-700 font-bold">Clearable (✕)</span>
              </label>

              <div className="w-px h-4 bg-slate-200" />

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isDisabled}
                  onChange={e => setIsDisabled(e.target.checked)}
                  className="rounded border-slate-300 text-red-700 focus:ring-red-600"
                />
                <span className="text-slate-700 font-bold">Disabled State</span>
              </label>
            </div>
          </div>
        </div>

        {/* Dropdowns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Branch Selection with Grouping */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <Building2 className="w-4 h-4 text-red-700" />
                <span>1. Branch Selector (20 Branches)</span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Grouped by Area
              </span>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Type <code className="text-red-700 font-bold font-mono">&quot;mnama&quot;</code>, <code className="text-red-700 font-bold font-mono">&quot;riffa&quot;</code>, or <code className="text-red-700 font-bold font-mono">&quot;saar&quot;</code> to test typo-tolerant fuzzy matching across both areas.
            </p>

            <DropdownSearch<Branch>
              items={filteredBranches}
              getLabel={b => b.name}
              getValue={b => b.id}
              value={selectedBranchId}
              onChange={setSelectedBranchId}
              placeholder="Search and select a pharmacy branch..."
              groupBy={b => areaNameMap.get(b.area_id) || 'General'}
              disabled={isDisabled}
              clearable={isClearable}
              emptyStateLabel="No branches found matching search query"
            />

            {/* Selected Branch Inspection */}
            {activeBranch ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>License No:</span>
                  <span className="font-mono font-bold text-slate-900">{activeBranch.license_no}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Manager:</span>
                  <span className="text-slate-900 font-bold">{activeBranch.manager_name}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Area:</span>
                  <span className="text-slate-800 font-bold">{areaNameMap.get(activeBranch.area_id)}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 font-medium">
                No branch currently selected.
              </div>
            )}
          </div>

          {/* Card 2: Pharmacist Selection */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <UserCheck className="w-4 h-4 text-red-700" />
                <span>2. Pharmacist Selector</span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Sample Staff
              </span>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Filterable list of on-duty pharmacists. Automatically prioritized for the selected branch.
            </p>

            <DropdownSearch<User>
              items={branchPharmacists}
              getLabel={u => `${u.name}${u.cpr ? ` (CPR: ***${u.cpr.slice(-4)})` : ''}`}
              getValue={u => u.id}
              value={selectedPharmacistId}
              onChange={setSelectedPharmacistId}
              placeholder="Search pharmacist by name or CPR..."
              disabled={isDisabled}
              clearable={isClearable}
              emptyStateLabel="No pharmacists found"
            />

            {/* Selected Pharmacist Inspection */}
            {activePharmacist ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Full Name:</span>
                  <span className="text-slate-900 font-bold">{activePharmacist.name}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Masked CPR:</span>
                  <span className="font-mono font-bold text-slate-900">******{activePharmacist.cpr.slice(-3)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Role:</span>
                  <span className="capitalize text-slate-800 font-semibold">{activePharmacist.role}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium">
                No pharmacist selected.
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Area Filter Dropdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-black text-slate-950">
            <Filter className="w-4 h-4 text-red-700" />
            <span>3. Area Filter (Cascading Demonstration)</span>
          </div>

          <div className="max-w-md">
            <DropdownSearch
              items={MOCK_AREAS}
              getLabel={a => a.name}
              getValue={a => a.id}
              value={selectedAreaId}
              onChange={setSelectedAreaId}
              placeholder="Filter by Area (All Areas)..."
              disabled={isDisabled}
              clearable={true}
              emptyStateLabel="No areas found"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              Showing {filteredBranches.length} of 20 branches based on active area filter.
            </span>
          </div>
        </div>

        {/* Keyboard Navigation Quick Reference */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-xs space-y-3 shadow-sm">
          <div className="flex items-center gap-2 font-black text-slate-900">
            <KeyRound className="w-4 h-4 text-red-700" />
            <span>Keyboard &amp; Accessibility Standards Verified:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-slate-600">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-medium">
              <span className="text-red-700 font-mono font-bold">↓ / ↑</span> : Navigate listbox options
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-medium">
              <span className="text-red-700 font-mono font-bold">Enter</span> : Commit selected option
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-medium">
              <span className="text-red-700 font-mono font-bold">Escape</span> : Close popover menu
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-medium">
              <span className="text-red-700 font-mono font-bold">Click Outside</span> : Safe auto-dismiss
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
