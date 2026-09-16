import React, { useEffect, useState, useMemo } from 'react';
import {
  Banknote, CalendarDays, ChevronLeft, ChevronRight, ChevronDown,
  FileText, Fuel, Package, Wrench, X, Calendar as CalendarIcon, Receipt, Building2,
  MapPin, Search, MonitorCheck, ShieldCheck, Gauge, TrendingUp, Trophy, Truck
} from 'lucide-react';
import { Branch, ExpenseCalendarDay, ExpenseDashboardKpis, ExpenseFilters, ExpenseTransaction, BranchExpenseRanking } from '../../types';
import { expenseService } from '../../services/expenseService';
import { branchService } from '../../services/branchService';
import { formatBhdAmount, formatBhdWithCurrency } from '../../utils/money';
import { KPI } from '../shared/KPI';

interface ExpenseDashboardProps {
  user: Branch;
  isManager: boolean;
  onViewExpense: (id: string) => void;
}

const ExpenseKPI: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  isCurrency?: boolean;
  unit?: string;
  subtext?: string;
  critical?: boolean;
  changePct?: number;
}> = ({ label, value, icon, isCurrency = true, unit = 'BHD', subtext, critical, changePct }) => {
  return (
    <div className={`p-4 md:p-5 rounded-2xl border transition-all duration-300 relative flex flex-col justify-between group ${
      critical
        ? 'bg-red-50/30 border-red-200 hover:border-red-400 hover:shadow-md hover:shadow-red-500/5'
        : 'bg-white border-slate-200/80 hover:border-brand/40 hover:shadow-md hover:shadow-brand/5'
    }`}>
      {critical && (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 bg-red-100/80 border border-red-200 rounded-full z-10">
          <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
          <span className="text-[7px] font-black text-red-700 uppercase tracking-widest">Alert</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-brand transition-colors">
          {label}
        </h3>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 transition-all duration-300 ${
          critical
            ? 'bg-red-100/60 border-red-200 text-red-600 group-hover:bg-red-600 group-hover:text-white'
            : 'bg-slate-50 border-slate-100 text-slate-500 group-hover:bg-brand group-hover:border-brand group-hover:text-white'
        }`}>
          {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: "w-4.5 h-4.5" }) : icon}
        </div>
      </div>

      <div className="mt-2.5 flex flex-col">
        <div className="flex items-baseline justify-between gap-1">
          <div className="flex items-baseline gap-1">
            {(isCurrency || unit) && (
              <span className={`text-[10px] font-bold tracking-tight ${critical ? 'text-red-500' : 'text-slate-400'}`}>
                {isCurrency ? 'BHD' : unit}
              </span>
            )}
            <span className={`text-xl md:text-2xl font-black tracking-tight tabular-nums ${
              critical
                ? 'text-red-700'
                : 'text-slate-900 group-hover:text-brand transition-colors'
            }`}>
              {value}
            </span>
          </div>

          {changePct !== undefined && (
            <div
              title="Compared to previous matching period"
              className={`px-1.5 py-0.5 rounded border text-[9px] font-black tracking-tight flex items-center gap-0.5 shrink-0 ${
                changePct < 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : changePct > 0
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}
            >
              <span>{changePct < 0 ? '↓' : changePct > 0 ? '↑' : ''}</span>
              <span>{changePct > 0 ? `+${changePct}%` : `${changePct}%`}</span>
            </div>
          )}
        </div>

        {subtext ? (
          <div className={`mt-2 w-fit px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wide transition-colors ${
            critical
              ? 'bg-red-100 text-red-700'
              : 'bg-slate-100 text-slate-500 group-hover:bg-brand/10 group-hover:text-brand'
          }`}>
            {subtext}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export type DashboardDateType = 'all' | 'today' | 'yesterday' | '7d' | 'month' | 'custom';

export const ExpenseDashboard: React.FC<ExpenseDashboardProps> = ({ user, isManager, onViewExpense }) => {
  const [kpis, setKpis] = useState<ExpenseDashboardKpis | null>(null);
  const [calendarData, setCalendarData] = useState<ExpenseCalendarDay[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayExpenses, setDayExpenses] = useState<ExpenseTransaction[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>(isManager ? 'all' : user.id);
  const [branchRankings, setBranchRankings] = useState<BranchExpenseRanking[]>([]);
  const [loading, setLoading] = useState(true);

  // Lost Sales Tracker style filters state
  const [dateType, setDateType] = useState<DashboardDateType>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [branchSearchTerm, setBranchSearchTerm] = useState('');

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.expense-dropdown-container')) {
        setIsBranchDropdownOpen(false);
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getLocalYmd = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const computedDateRange = useMemo(() => {
    const today = new Date();
    const todayStr = getLocalYmd(today);

    if (dateType === 'today') {
      return { dateFrom: todayStr, dateTo: todayStr };
    }
    if (dateType === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const yStr = getLocalYmd(y);
      return { dateFrom: yStr, dateTo: yStr };
    }
    if (dateType === '7d') {
      const d7 = new Date(today);
      d7.setDate(today.getDate() - 6);
      return { dateFrom: getLocalYmd(d7), dateTo: todayStr };
    }
    if (dateType === 'month') {
      const first = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const last = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { dateFrom: first, dateTo: last };
    }
    if (dateType === 'custom') {
      let from = startDate;
      let to = endDate;
      if (manualStart && manualStart.length === 10) {
        const parts = manualStart.split('-');
        if (parts.length === 3) from = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      if (manualEnd && manualEnd.length === 10) {
        const parts = manualEnd.split('-');
        if (parts.length === 3) to = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return { dateFrom: from || undefined, dateTo: to || undefined };
    }
    // 'all'
    return { dateFrom: undefined, dateTo: undefined };
  }, [dateType, startDate, endDate, manualStart, manualEnd]);

  const filters: ExpenseFilters = useMemo(() => ({
    branchId: isManager ? selectedBranch : user.id,
    dateFrom: computedDateRange.dateFrom,
    dateTo: computedDateRange.dateTo
  }), [isManager, selectedBranch, user.id, computedDateRange]);

  const activeBranchLabel = selectedBranch === 'all'
    ? 'CENTRAL CONSOLE'
    : (branches.find(b => b.id === selectedBranch)?.name || 'Selected Branch');

  const activeDateLabel: Record<DashboardDateType, string> = {
    all: 'All Time',
    today: 'Today',
    yesterday: 'Yesterday',
    '7d': 'Last 7 Days',
    month: 'This Month',
    custom: 'Custom Period'
  };

  const dateRangeOptions: Array<{ id: DashboardDateType; label: string; sub: string }> = [
    { id: 'today', label: 'Today', sub: 'Active day expenses' },
    { id: 'yesterday', label: 'Yesterday', sub: 'Previous day records' },
    { id: '7d', label: 'Last 7 Days', sub: 'Weekly operating window' },
    { id: 'month', label: 'This Month', sub: 'Current month cycle' },
    { id: 'all', label: 'All Time', sub: 'Total historical archive' },
    { id: 'custom', label: 'Choose Period', sub: 'Manual calendar range' }
  ];

  const branchSearchQuery = branchSearchTerm.trim().toLowerCase();
  const filteredBranches = branches.filter((branch) =>
    `${branch.name} ${branch.code}`.toLowerCase().includes(branchSearchQuery)
  );

  useEffect(() => {
    if (isManager) {
      branchService.list().then(setBranches).catch(console.error);
    }
  }, [isManager]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      expenseService.expenses.getDashboardKpis(filters),
      expenseService.expenses.getCalendarTotals(currentDate.getFullYear(), currentDate.getMonth(), filters),
      expenseService.expenses.getBranchExpenseRankings(currentDate.getFullYear(), currentDate.getMonth(), filters, branches)
    ]).then(([kpiData, calData, rankingsData]) => {
      setKpis(kpiData);
      setCalendarData(calData);
      setBranchRankings(rankingsData);
    }).catch(console.error).finally(() => setLoading(false));
  }, [filters, currentDate, branches]);

  const handleDayClick = async (dateStr: string) => {
    setSelectedDay(dateStr);
    setDayLoading(true);
    try {
      const expenses = await expenseService.expenses.getDayExpenses(dateStr, filters);
      setDayExpenses(expenses);
    } catch (e) { console.error(e); }
    finally { setDayLoading(false); }
  };

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    setSelectedDay(null);
  };

  // Calendar grid
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
    const firstDayIndex = date.getDay();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({ day: prevMonthLastDay - i, month: month - 1, year, isCurrentMonth: false });
    }
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= lastDay; i++) {
      days.push({ day: i, month, year, isCurrentMonth: true });
    }
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: i, month: month + 1, year, isCurrentMonth: false });
    }
    return days;
  }, [currentDate]);

  const calendarTotals = useMemo(() => {
    const map: Record<string, number> = {};
    calendarData.forEach(d => { map[d.date] = d.total; });
    return map;
  }, [calendarData]);

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const categoryIcon = (slug?: string) => {
    switch (slug) {
      case 'fuel': return <Fuel className="h-3.5 w-3.5 text-slate-600" />;
      case 'vehicle_services': return <Wrench className="h-3.5 w-3.5 text-slate-600" />;
      case 'maintenance': return <Building2 className="h-3.5 w-3.5 text-slate-600" />;
      case 'supplies': return <Package className="h-3.5 w-3.5 text-slate-600" />;
      default: return <FileText className="h-3.5 w-3.5 text-slate-500" />;
    }
  };

  if (loading && !kpis) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Controls: Branch Scope & Date Range (Lost Sales Tracker Style) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-black border border-brand/20">
            <Banknote size={20} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">Operational Cash Expenses</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Dashboard & Financial Overview</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Scope Dropdown */}
          {isManager && (
            <div className="relative expense-dropdown-container">
              <button
                type="button"
                onClick={() => {
                  setIsDatePickerOpen(false);
                  setIsBranchDropdownOpen(!isBranchDropdownOpen);
                }}
                className={`group flex h-11 w-full sm:w-auto sm:min-w-[210px] items-center justify-between gap-2.5 rounded-xl border px-3.5 text-left transition-all duration-200 ${
                  isBranchDropdownOpen
                    ? 'border-brand/30 bg-white shadow-md shadow-brand/5 ring-2 ring-brand/10'
                    : 'border-slate-200 bg-white shadow-xs hover:border-brand/30 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isBranchDropdownOpen ? 'bg-brand/10 text-brand ring-1 ring-brand/20' : 'bg-slate-50 text-brand group-hover:bg-brand/10'
                  }`}>
                    <MapPin size={15} strokeWidth={2.7} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">Branch Scope</span>
                    <span className="block truncate text-[10px] font-black uppercase tracking-[0.08em] text-slate-800">{activeBranchLabel}</span>
                  </span>
                </div>
                <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform duration-300 ${isBranchDropdownOpen ? 'rotate-180 text-brand' : ''}`} />
              </button>

              {isBranchDropdownOpen && (
                <div className="absolute top-full right-0 z-[100] mt-2 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 animate-in zoom-in-95 duration-200">
                  <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-brand">Branch Scope</p>
                        <p className="mt-1 truncate text-sm font-black tracking-tight text-slate-900">{activeBranchLabel}</p>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-slate-500">
                        {branches.length} nodes
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="relative mb-2.5">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        type="text"
                        placeholder="Search branches..."
                        value={branchSearchTerm}
                        onChange={(e) => setBranchSearchTerm(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-brand focus:ring-2 focus:ring-brand/10"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBranch('all');
                          setIsBranchDropdownOpen(false);
                          setBranchSearchTerm('');
                        }}
                        className={`group flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                          selectedBranch === 'all'
                            ? 'border-brand/20 bg-brand/5 text-brand'
                            : 'border-transparent bg-white text-slate-900 hover:border-brand/10 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                            selectedBranch === 'all' ? 'border-brand/20 bg-white text-brand' : 'border-slate-100 bg-slate-50 text-brand'
                          }`}>
                            <MonitorCheck size={16} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-black">CENTRAL CONSOLE</span>
                            <span className={`mt-0.5 block text-[10px] font-bold ${
                              selectedBranch === 'all' ? 'text-brand/80' : 'text-slate-400'
                            }`}>All branches combined</span>
                          </span>
                        </span>
                        {selectedBranch === 'all' ? (
                          <ShieldCheck size={17} className="shrink-0 text-brand" />
                        ) : (
                          <ChevronRight size={16} className="shrink-0 text-slate-300 transition-colors group-hover:text-brand" />
                        )}
                      </button>

                      <div className="mx-1 my-2 h-px bg-slate-100"></div>

                      {filteredBranches.map(b => {
                        const isSelected = selectedBranch === b.id;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setSelectedBranch(b.id);
                              setIsBranchDropdownOpen(false);
                              setBranchSearchTerm('');
                            }}
                            className={`group flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                              isSelected
                                ? 'border-brand/20 bg-brand/5 text-brand'
                                : 'border-transparent text-slate-900 hover:border-brand/10 hover:bg-slate-50'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[10px] font-black uppercase ${
                                isSelected ? 'border-brand/20 bg-white text-brand' : 'border-slate-100 bg-slate-50 text-slate-500'
                              }`}>
                                {b.code?.slice(0, 3) || 'BR'}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-black">{b.name}</span>
                                <span className={`mt-0.5 block text-[10px] font-bold ${
                                  isSelected ? 'text-brand/80' : 'text-slate-400'
                                }`}>Branch node</span>
                              </span>
                            </span>
                            {isSelected ? (
                              <ShieldCheck size={17} className="shrink-0 text-brand" />
                            ) : (
                              <ChevronRight size={16} className="shrink-0 text-slate-300 transition-colors group-hover:text-brand" />
                            )}
                          </button>
                        );
                      })}

                      {filteredBranches.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-7 text-center">
                          <p className="text-xs font-black text-slate-500">No branches found</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Date Range Dropdown */}
          <div className="relative expense-dropdown-container">
            <button
              type="button"
              onClick={() => {
                setIsBranchDropdownOpen(false);
                setIsDatePickerOpen(!isDatePickerOpen);
              }}
              className={`group flex h-11 w-full sm:w-auto sm:min-w-[210px] items-center justify-between gap-2.5 rounded-xl border px-3.5 text-left transition-all duration-200 ${
                isDatePickerOpen
                  ? 'border-brand/30 bg-white shadow-md shadow-brand/5 ring-2 ring-brand/10'
                  : 'border-slate-200 bg-white shadow-xs hover:border-brand/30 hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  isDatePickerOpen ? 'bg-brand/10 text-brand ring-1 ring-brand/20' : 'bg-slate-50 text-brand group-hover:bg-brand/10'
                }`}>
                  <CalendarDays size={15} strokeWidth={2.7} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">Date Range</span>
                  <span className="block truncate text-[10px] font-black uppercase tracking-[0.08em] text-slate-800">{activeDateLabel[dateType]}</span>
                </span>
              </div>
              <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform duration-300 ${isDatePickerOpen ? 'rotate-180 text-brand' : ''}`} />
            </button>

            {isDatePickerOpen && (
              <div className="absolute top-full right-0 z-[100] mt-2 w-[330px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 animate-in slide-in-from-top-5 duration-200">
                <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-brand">Date Range</p>
                  <p className="mt-1 text-sm font-black tracking-tight text-slate-900">{activeDateLabel[dateType]}</p>
                </div>
                <div className="p-3">
                  {dateType !== 'custom' ? (
                    <div className="grid grid-cols-1 gap-1">
                      {dateRangeOptions.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            if (dateType === 'custom' && t.id !== 'custom') {
                              setStartDate('');
                              setEndDate('');
                              setManualStart('');
                              setManualEnd('');
                            }
                            setDateType(t.id);
                            if (t.id !== 'custom') setIsDatePickerOpen(false);
                          }}
                          className={`group flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                            dateType === t.id
                              ? 'border-brand/20 bg-brand/5 text-brand'
                              : 'border-transparent bg-white text-slate-900 hover:border-brand/10 hover:bg-slate-50'
                          }`}
                        >
                          <span>
                            <span className="block text-xs font-black">{t.label}</span>
                            <span className={`mt-0.5 block text-[10px] font-bold ${dateType === t.id ? 'text-brand/80' : 'text-slate-400'}`}>{t.sub}</span>
                          </span>
                          {dateType === t.id ? (
                            <ShieldCheck size={17} className="shrink-0 text-brand" />
                          ) : (
                            <ChevronRight size={16} className="shrink-0 text-slate-300 transition-colors group-hover:text-brand" />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1.5 ml-1 block text-[10px] font-black text-slate-500">From (DD-MM-YYYY)</label>
                          <input
                            type="text"
                            placeholder="01-01-2026"
                            value={manualStart}
                            onChange={(e) => setManualStart(e.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-brand focus:ring-2 focus:ring-brand/10"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 ml-1 block text-[10px] font-black text-slate-500">To (DD-MM-YYYY)</label>
                          <input
                            type="text"
                            placeholder="31-01-2026"
                            value={manualEnd}
                            onChange={(e) => setManualEnd(e.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-brand focus:ring-2 focus:ring-brand/10"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDateType('today')}
                          className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsDatePickerOpen(false)}
                          className="flex-1 py-2 rounded-xl bg-brand text-white text-xs font-black shadow-sm hover:bg-brand-dark"
                        >
                          Apply Range
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-3.5">
          <ExpenseKPI
            label="Total Expenses"
            value={formatBhdAmount(kpis.totalExpenses)}
            icon={<Banknote />}
            subtext={activeDateLabel[dateType]}
            changePct={kpis.totalExpensesChangePct}
          />
          <ExpenseKPI
            label="Total Entries"
            value={kpis.transactionCount}
            isCurrency={false}
            unit="Entries"
            icon={<FileText />}
            subtext={activeDateLabel[dateType]}
          />
          <ExpenseKPI
            label="Fuel Expenses"
            value={formatBhdAmount(kpis.fuelTotal)}
            icon={<Fuel />}
            subtext="Vehicles Fuel"
            changePct={kpis.fuelTotalChangePct}
          />
          <ExpenseKPI
            label="Vehicle Services"
            value={formatBhdAmount(kpis.vehicleServicesTotal)}
            icon={<Wrench />}
            subtext="Oil & Repairs"
          />
          <ExpenseKPI
            label="Branch Maint."
            value={formatBhdAmount(kpis.maintenanceTotal)}
            icon={<Building2 />}
            subtext="Facilities & Repairs"
          />
          <ExpenseKPI
            label="Supplies"
            value={formatBhdAmount(kpis.suppliesTotal)}
            icon={<Package />}
            subtext="Office & Ops"
          />
          <ExpenseKPI
            label="Receipts Pending"
            value={kpis.receiptsPending}
            isCurrency={false}
            unit="Receipts"
            icon={<Receipt />}
            critical={kpis.receiptsPending > 0}
            subtext={kpis.receiptsPending > 0 ? "Audit Required" : "All Clear"}
          />
        </div>
      )}

      {/* Fleet Analytics & Fuel Efficiency Cards */}
      {kpis && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-brand" />
              Fleet & Fuel Analytics / تحليلات كفاءة الأسطول والوقود
            </h4>
            <div className="flex items-center gap-2">
              {kpis.prevPeriodLabel && (
                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title="Compared against matching previous period">
                  Prev Period: {kpis.prevPeriodLabel}
                </span>
              )}
              <span className="text-[10px] font-bold text-slate-400">
                {kpis.totalDistanceKm > 0 ? `${kpis.totalDistanceKm.toLocaleString()} total km driven` : 'No odometer records in period'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-3.5">
            <ExpenseKPI
              label="Avg. Consumption / متوسط الاستهلاك"
              value={kpis.avgConsumptionPer100Km > 0 ? kpis.avgConsumptionPer100Km.toFixed(1) : '0.0'}
              isCurrency={false}
              unit="L / 100km"
              icon={<Gauge />}
              subtext={kpis.totalFuelLiters > 0 ? `${kpis.totalFuelLiters} Total Litres` : 'Fuel efficiency metric'}
              changePct={kpis.avgConsumptionChangePct}
            />
            <ExpenseKPI
              label="Avg. Cost / KM / تكلفة الكيلو"
              value={kpis.avgCostPerKm > 0 ? kpis.avgCostPerKm.toFixed(3) : '0.000'}
              isCurrency={false}
              unit="BHD / km"
              icon={<TrendingUp />}
              subtext={kpis.avgCostPerKm > 0 ? `${(kpis.avgCostPerKm * 1000).toFixed(1)} Fils / km` : 'Cost per kilometer'}
              changePct={kpis.avgCostPerKmChangePct}
            />
            <ExpenseKPI
              label="Top Consuming Vehicle / أعلى مركبة مصاريفاً"
              value={kpis.highestExpenseVehicle ? (kpis.highestExpenseVehicle.plateNumber || kpis.highestExpenseVehicle.vehicleCode) : '—'}
              isCurrency={false}
              unit={kpis.highestExpenseVehicle ? `${kpis.highestExpenseVehicle.totalExpense.toFixed(3)} BHD` : 'No data'}
              icon={<Trophy />}
              subtext={kpis.highestExpenseVehicle ? `Code: ${kpis.highestExpenseVehicle.vehicleCode}` : 'Highest total expense'}
            />
            <ExpenseKPI
              label="Total Fleet Distance / إجمالي المسافة"
              value={kpis.totalDistanceKm > 0 ? kpis.totalDistanceKm.toLocaleString() : '0'}
              isCurrency={false}
              unit="KM"
              icon={<Truck />}
              subtext="Recorded odometer distance"
            />
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="bg-white rounded-[3rem] p-8 md:p-12 border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand/[0.015] rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none" />

        <div className="flex flex-col gap-8 mb-8 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="w-14 h-14 bg-slate-50 rounded-[1.25rem] flex items-center justify-center text-brand border border-slate-100">
                <CalendarIcon className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter leading-none">{monthName}</h3>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mt-2">Expense Calendar: {year}</p>
              </div>
            </div>
            <div className="flex items-center bg-slate-50 p-1.5 rounded-xl border border-slate-100">
              <button onClick={() => changeMonth(-1)} className="p-2.5 hover:bg-white hover:text-brand hover:shadow-xl rounded-lg transition-all text-slate-400" title="Previous Month">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="w-px h-5 bg-slate-200 mx-2" />
              <button onClick={() => changeMonth(1)} className="p-2.5 hover:bg-white hover:text-brand hover:shadow-xl rounded-lg transition-all text-slate-400" title="Next Month">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <div className="grid grid-cols-7 mb-4">
            {weekDays.map(day => (
              <div key={day} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] py-2">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-[1.5rem] overflow-hidden shadow-inner">
            {daysInMonth.map((dateObj, idx) => {
              const dateStr = `${dateObj.year}-${String(dateObj.month + 1).padStart(2, '0')}-${String(dateObj.day).padStart(2, '0')}`;
              const total = dateObj.isCurrentMonth ? (calendarTotals[dateStr] || 0) : 0;
              const isToday = new Date().toDateString() === new Date(dateObj.year, dateObj.month, dateObj.day).toDateString();
              const isSelected = selectedDay === dateStr;
              const intensity = total > 20 ? 'bg-brand/[0.04]' : total > 0 ? 'bg-brand/[0.015]' : 'bg-white';

              return (
                <button
                  key={idx}
                  onClick={() => dateObj.isCurrentMonth && handleDayClick(dateStr)}
                  disabled={!dateObj.isCurrentMonth}
                  className={`p-3 md:p-4 transition-all duration-300 group flex flex-col justify-between text-left min-h-[80px] md:min-h-[100px] ${
                    !dateObj.isCurrentMonth ? 'opacity-10 pointer-events-none bg-white' : intensity
                  } ${isSelected ? 'ring-2 ring-brand ring-inset z-10' : 'hover:z-10 hover:shadow-lg'}`}
                >
                  <span className={`text-sm font-black transition-all ${
                    isToday ? 'bg-brand text-white w-8 h-8 flex items-center justify-center rounded-lg shadow-lg shadow-brand/20' : 'text-slate-400 group-hover:text-slate-900'
                  }`}>
                    {dateObj.day}
                  </span>
                  <div className="mt-auto pt-2">
                    {total > 0 ? (
                      <div>
                        <p className="text-xs md:text-sm font-black text-brand tracking-tight leading-none mb-0.5">
                          {formatBhdAmount(total)}
                        </p>
                        <p className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">BHD</p>
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-center gap-8">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-brand rounded-md shadow-sm shadow-brand/20" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-40">Expenses</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-slate-50 rounded-md border border-slate-200" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-40">No Activity</span>
            </div>
          </div>
        </div>
      </div>

      {/* Branch Expense Ranking (Below Calendar) */}
      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-100 shadow-sm relative overflow-hidden space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-brand border border-slate-100">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Branch Expense Ranking
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">
                Highest to Lowest Expenses — {monthName} {year}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Network Total:</span>
            <span className="text-sm font-black text-slate-900 tabular-nums">
              {formatBhdWithCurrency(branchRankings.reduce((sum, b) => sum + b.total, 0))}
            </span>
          </div>
        </div>

        {branchRankings.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-2xl">
            <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-400">No expense records found for branches in {monthName} {year}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {branchRankings.map((b, idx) => {
              const maxTotal = branchRankings[0]?.total || 1;
              const barWidth = maxTotal > 0 ? Math.max((b.total / maxTotal) * 100, 2) : 0;
              const isTop1 = idx === 0 && b.total > 0;
              const isTop2 = idx === 1 && b.total > 0;
              const isTop3 = idx === 2 && b.total > 0;

              return (
                <div
                  key={b.branchId}
                  className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${
                    isTop1
                      ? 'bg-brand/[0.02] border-brand/20 hover:border-brand/40 shadow-xs'
                      : 'bg-white border-slate-100 hover:border-brand/30 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 sm:w-1/3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                      isTop1
                        ? 'bg-brand text-white shadow-sm shadow-brand/20'
                        : isTop2
                          ? 'bg-slate-800 text-white'
                          : isTop3
                            ? 'bg-slate-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                    }`}>
                      #{idx + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/60 text-[10px] font-black text-slate-700">
                          {b.branchCode}
                        </span>
                        <h4 className="text-sm font-black text-slate-900 truncate group-hover:text-brand transition-colors">
                          {b.branchName}
                        </h4>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                        {b.count} transaction{b.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Expense Share Bar */}
                  <div className="flex-1 max-w-xs space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-400 uppercase tracking-wider">Share</span>
                      <span className="text-slate-700 font-black">{b.percentage}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isTop1 ? 'bg-brand' : 'bg-slate-400 group-hover:bg-brand'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>

                  {/* Total Expense Amount */}
                  <div className="text-right sm:min-w-[120px]">
                    <p className={`text-base font-black tracking-tight tabular-nums ${
                      isTop1 ? 'text-brand' : 'text-slate-900 group-hover:text-brand'
                    }`}>
                      {formatBhdAmount(b.total)}
                    </p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">BHD</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Day Details Modal/Drawer */}
      {selectedDay && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
              <p className="text-sm font-medium text-slate-500">
                {dayExpenses.length} expense{dayExpenses.length !== 1 ? 's' : ''}
                {dayExpenses.length > 0 && ` — Total: ${formatBhdWithCurrency(dayExpenses.reduce((s, e) => s + e.amount, 0))}`}
              </p>
            </div>
            <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          {dayLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            </div>
          ) : dayExpenses.length === 0 ? (
            <p className="text-sm font-medium text-slate-400 text-center py-8">No expenses recorded for this day.</p>
          ) : (
            <div className="space-y-2">
              {dayExpenses.map(exp => (
                <button
                  key={exp.id}
                  onClick={() => onViewExpense(exp.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-brand/30 hover:shadow-sm transition-all text-left group"
                >
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 group-hover:bg-brand/10">
                    {categoryIcon(exp.categorySlug)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900">{exp.referenceNo}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{exp.categoryName}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {exp.categorySlug === 'fuel'
                        ? `${exp.vehicleCode || 'Vehicle'} / ${exp.driverName || 'Driver'}`
                        : exp.description || '—'}
                    </p>
                  </div>
                  <span className="text-sm font-black text-brand whitespace-nowrap">{formatBhdWithCurrency(exp.amount)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
