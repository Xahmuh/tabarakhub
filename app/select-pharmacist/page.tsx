
import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight,
  Building2,
  Clock3,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCircle,
  UsersRound,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Pharmacist, Branch } from '../../types';
import { BackToModulesButton, BACK_TO_MODULES_LABEL } from '../shared';

interface SelectPharmacistPageProps {
  branch: Branch;
  onSelect: (pharmacist: Pharmacist, branch?: Branch) => void;
  onLogout: () => void;
  backLabel?: string;
}

const getInitials = (name: string) => name
  .split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0]?.toUpperCase())
  .join('') || 'PH';

const getTodayLabel = () => new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: '2-digit',
  month: 'short'
}).format(new Date());

export const SelectPharmacistPage: React.FC<SelectPharmacistPageProps> = ({ branch, onSelect, onLogout, backLabel = 'Change Location' }) => {
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
  const [branchOptions, setBranchOptions] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState(branch.role === 'branch' ? branch.id : '');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllResults, setShowAllResults] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  const isBranchTerminal = branch.role === 'branch';
  const activeBranch = isBranchTerminal
    ? branch
    : branchOptions.find(option => option.id === selectedBranchId) || null;

  useEffect(() => {
    let isMounted = true;

    const fetchBranches = async () => {
      if (isBranchTerminal) {
        setBranchOptions([]);
        setSelectedBranchId(branch.id);
        return;
      }

      setIsLoadingBranches(true);
      const data = await supabase.branches.list();
      if (!isMounted) return;
      setBranchOptions(data);
      setSelectedBranchId(current => data.some(option => option.id === current) ? current : data[0]?.id || '');
      setIsLoadingBranches(false);
    };

    fetchBranches();

    return () => {
      isMounted = false;
    };
  }, [branch.id, isBranchTerminal]);

  useEffect(() => {
    let isMounted = true;

    const fetchPharmacists = async () => {
      if (!activeBranch?.id) {
        setPharmacists([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const data = await supabase.pharmacists.listByBranch(activeBranch.id);
      if (!isMounted) return;
      setPharmacists(data);
      setIsLoading(false);
    };

    fetchPharmacists();

    return () => {
      isMounted = false;
    };
  }, [activeBranch?.id]);

  const searchMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return pharmacists.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.code || '').toLowerCase().includes(query)
    );
  }, [pharmacists, searchQuery]);

  const filteredPharmacists = showAllResults ? pharmacists : searchMatches;

  const todayLabel = useMemo(getTodayLabel, []);
  const isSearching = searchQuery.trim().length > 0;
  const hasResultMode = showAllResults || isSearching || pharmacists.length === 0 || !activeBranch;

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowAllResults(false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setShowAllResults(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black text-slate-950 sm:text-3xl">Live Shift Coverage</h1>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
              <p className="text-xs font-bold text-slate-500">Active terminal</p>
              <p className="max-w-[280px] truncate text-sm font-black text-slate-900">
                {activeBranch?.name || (isLoadingBranches ? 'Loading branches...' : 'Select branch')}
              </p>
            </div>
            {backLabel === BACK_TO_MODULES_LABEL ? (
              <BackToModulesButton onClick={onLogout} />
            ) : (
              <button
                onClick={onLogout}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 shadow-sm transition hover:border-brand/40 hover:text-brand"
              >
                <LogOut className="h-4 w-4" />
                <span>{backLabel}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <section className="flex flex-col items-center justify-center">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-black text-brand">Who's on shift?</span>
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm">{todayLabel}</span>
          </div>

          {!isBranchTerminal && (
            <div className="mb-4 flex w-full max-w-2xl items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Operating branch</label>
                <select
                  value={selectedBranchId}
                  disabled={isLoadingBranches || branchOptions.length === 0}
                  onChange={event => {
                    setSelectedBranchId(event.target.value);
                    setSearchQuery('');
                    setShowAllResults(false);
                  }}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-800 outline-none transition focus:border-brand focus:ring-4 focus:ring-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {branchOptions.length === 0 ? (
                    <option value="">{isLoadingBranches ? 'Loading branches...' : 'No branches available'}</option>
                  ) : branchOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.code} - {option.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="relative w-full max-w-2xl">
            <div className="pointer-events-none absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-white shadow-sm">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="text"
              className="h-14 w-full rounded-lg border border-slate-200 bg-white pl-16 pr-12 text-base font-bold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-red-50"
              placeholder="Search pharmacist name or code"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setShowAllResults(current => !current);
            }}
            className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:border-brand/40 hover:text-brand"
          >
            <UsersRound className="h-4 w-4" />
            <span>{showAllResults ? 'Hide all' : 'Search all'}</span>
          </button>
        </section>

        <section className="mt-5">
          {isLoading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-brand" />
              <p className="mt-3 text-sm font-black text-slate-700">Loading shift roster</p>
            </div>
          ) : !hasResultMode ? null : filteredPharmacists.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredPharmacists.map((pharmacist) => (
                <button
                  key={pharmacist.id}
                  onClick={() => activeBranch && onSelect(pharmacist, activeBranch)}
                  className="group rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand/40 hover:shadow-lg hover:shadow-red-950/5 active:scale-[0.99]"
                >
                  <div className="flex items-start gap-4">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-700 transition group-hover:bg-brand group-hover:text-white">
                      {getInitials(pharmacist.name)}
                      <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-black text-slate-950 transition group-hover:text-brand">{pharmacist.name}</p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                            <UserCircle className="h-3.5 w-3.5" />
                            Pharmacist
                          </p>
                          {pharmacist.code && (
                            <p className="mt-2 inline-flex rounded-lg bg-red-50 px-2.5 py-1 text-[11px] font-black uppercase text-brand">
                              {pharmacist.code}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand" />
                      </div>

                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Clock3 className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-black text-slate-900">
                {!activeBranch
                  ? 'Select a branch'
                  : pharmacists.length === 0
                    ? 'No pharmacists assigned'
                    : 'No active shift data yet'}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm font-medium text-slate-500">
                {!activeBranch
                  ? 'Choose an operating branch first so the shift roster can load branch-specific pharmacist assignments.'
                  : pharmacists.length === 0
                    ? `No pharmacists are assigned to ${activeBranch.name} yet. Please ask a manager to update pharmacist assignments.`
                  : isSearching
                    ? `No personnel matches "${searchQuery}".`
                    : 'No active personnel is currently assigned to this terminal.'}
              </p>
              {isSearching && (
                <button
                  onClick={handleClearSearch}
                  className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black text-white transition hover:bg-red-800"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
