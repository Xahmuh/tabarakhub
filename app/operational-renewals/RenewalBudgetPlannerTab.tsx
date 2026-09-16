import React, { useState, useMemo } from 'react';
import {
  Banknote, CreditCard, Calendar, CheckCircle2, Clock,
  AlertTriangle, Filter, Search, Download, ArrowUpDown,
  Building2, Tag, ChevronRight, Layers, PieChart, TrendingUp,
  FileSpreadsheet, ExternalLink, RefreshCw, X, Sliders
} from 'lucide-react';
import {
  OperationalRenewalRecord,
  RenewalBudgetSummary,
  RenewalMonthlyBudget,
  RenewalCostCenterBudget
} from '../../types';
import { operationalRenewalService, getOperationalEntityDisplayName } from '../../services/operationalRenewalService';
import { exportRenewalsToExcel, exportRenewalsToCsv } from './utils/exportRenewals';

interface RenewalBudgetPlannerTabProps {
  records: OperationalRenewalRecord[];
  canEdit?: boolean;
  canManage?: boolean;
  onViewDetails: (record: OperationalRenewalRecord) => void;
  onRefresh: () => void;
  onOpenTariffs?: () => void;
}

export const RenewalBudgetPlannerTab: React.FC<RenewalBudgetPlannerTabProps> = ({
  records,
  canEdit = true,
  canManage = true,
  onViewDetails,
  onRefresh,
  onOpenTariffs
}) => {
  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCostCenterFilter, setSelectedCostCenterFilter] = useState<string>('ALL');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('ALL');

  // Sorting State
  const [sortField, setSortField] = useState<'plannedDate' | 'estimatedCost' | 'entityName' | 'costCenter'>('plannedDate');
  const [sortAsc, setSortAsc] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Active view: 'table' or 'cost_centers'
  const [subView, setSubView] = useState<'table' | 'cost_centers'>('table');

  // Calculate Budget Summary Metrics
  const budgetSummary = useMemo<RenewalBudgetSummary>(() => {
    return operationalRenewalService.getBudgetSummary(records);
  }, [records]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (!r.isActive) return false;

      // Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const entityName = (r.entityName || '').toLowerCase();
        const docNum = (r.documentNumber || '').toLowerCase();
        const docType = (r.documentType || '').toLowerCase();
        const ccCode = (r.costCenterCode || '').toLowerCase();
        const ccName = (r.costCenterName || '').toLowerCase();
        if (
          !entityName.includes(query) &&
          !docNum.includes(query) &&
          !docType.includes(query) &&
          !ccCode.includes(query) &&
          !ccName.includes(query)
        ) {
          return false;
        }
      }

      // Cost Center
      if (selectedCostCenterFilter !== 'ALL' && r.costCenterCode !== selectedCostCenterFilter) {
        return false;
      }

      // Month Filter
      if (selectedMonthFilter !== 'ALL') {
        const date = r.plannedPaymentDate || r.expiryDate;
        if (!date || !date.startsWith(selectedMonthFilter)) return false;
      }

      return true;
    });
  }, [records, searchTerm, selectedCostCenterFilter, selectedMonthFilter]);

  // Sorted Records
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'plannedDate') {
        const dateA = a.plannedPaymentDate || a.expiryDate || '';
        const dateB = b.plannedPaymentDate || b.expiryDate || '';
        comparison = dateA.localeCompare(dateB);
      } else if (sortField === 'estimatedCost') {
        comparison = (a.estimatedCost || 0) - (b.estimatedCost || 0);
      } else if (sortField === 'entityName') {
        comparison = a.entityName.localeCompare(b.entityName);
      } else if (sortField === 'costCenter') {
        const ccA = a.costCenterCode || '';
        const ccB = b.costCenterCode || '';
        comparison = ccA.localeCompare(ccB);
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [filteredRecords, sortField, sortAsc]);

  // Pagination Slice
  const totalPages = Math.ceil(sortedRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, page, pageSize]);

  const handleSort = (field: 'plannedDate' | 'estimatedCost' | 'entityName' | 'costCenter') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedCostCenterFilter('ALL');
    setSelectedMonthFilter('ALL');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* 1. FINANCIAL KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projected Budget */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Total Projected Budget
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {budgetSummary.totalEstimatedCost.toFixed(3)}
            </span>
            <span className="text-xs font-black text-slate-500 font-mono">BHD</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 font-semibold flex items-center justify-between border-t border-slate-100 pt-2">
            <span>Active Renewals:</span>
            <span className="font-mono font-bold text-slate-800">{budgetSummary.totalRenewals} Records</span>
          </div>
        </div>

        {/* Paid Amount */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-200/80 shadow-xs relative overflow-hidden bg-gradient-to-b from-white to-emerald-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
              Paid to Date
            </span>
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono tracking-tight">
              {budgetSummary.totalPaidAmount.toFixed(3)}
            </span>
            <span className="text-xs font-black text-emerald-600 font-mono">BHD</span>
          </div>
          <div className="mt-2 text-[10px] text-emerald-600/90 font-semibold flex items-center justify-between border-t border-emerald-100/60 pt-2">
            <span>Financial Progress:</span>
            <span className="font-mono font-black text-emerald-800">
              {budgetSummary.totalEstimatedCost > 0
                ? `${Math.round((budgetSummary.totalPaidAmount / budgetSummary.totalEstimatedCost) * 100)}%`
                : '0%'}
            </span>
          </div>
        </div>

        {/* Remaining Outstanding Balance */}
        <div className="bg-white rounded-2xl p-5 border border-amber-200/80 shadow-xs relative overflow-hidden bg-gradient-to-b from-white to-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">
              Outstanding Due
            </span>
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700 font-mono tracking-tight">
              {budgetSummary.totalPendingAmount.toFixed(3)}
            </span>
            <span className="text-xs font-black text-amber-600 font-mono">BHD</span>
          </div>
          <div className="mt-2 text-[10px] text-amber-600/90 font-semibold flex items-center justify-between border-t border-amber-100/60 pt-2">
            <span>Status:</span>
            <span className="font-bold text-amber-800">Pending Scheduling & Due</span>
          </div>
        </div>

        {/* Immediate Cash Due in 30 Days */}
        <div className="bg-white rounded-2xl p-5 border border-rose-200/80 shadow-xs relative overflow-hidden bg-gradient-to-b from-white to-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-rose-700">
              Due in 30 Days
            </span>
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-700 font-mono tracking-tight">
              {budgetSummary.dueIn30Days.toFixed(3)}
            </span>
            <span className="text-xs font-black text-rose-600 font-mono">BHD</span>
          </div>
          <div className="mt-2 text-[10px] text-rose-600/90 font-semibold flex items-center justify-between border-t border-rose-100/60 pt-2">
            <span>Due in 60 Days:</span>
            <span className="font-mono font-bold text-rose-900">{budgetSummary.dueIn60Days.toFixed(3)} BHD</span>
          </div>
        </div>
      </div>

      {/* 2. MONTHLY CASH FLOW & PAYMENT SCHEDULE TIMELINE */}
      {budgetSummary.monthlyBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Monthly Cash Flow & Payment Forecast
              </h3>
            </div>

            {selectedMonthFilter !== 'ALL' && (
              <button
                onClick={() => setSelectedMonthFilter('ALL')}
                className="text-xs text-brand hover:underline font-bold flex items-center gap-1"
              >
                <span>Clear Month Filter ({selectedMonthFilter})</span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Month Cards Scroll */}
          <div className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-1">
            {budgetSummary.monthlyBreakdown.map(month => {
              const isSelected = selectedMonthFilter === month.monthKey;
              return (
                <button
                  key={month.monthKey}
                  type="button"
                  onClick={() => {
                    setSelectedMonthFilter(isSelected ? 'ALL' : month.monthKey);
                    setPage(1);
                  }}
                  className={`shrink-0 min-w-[140px] p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-brand text-white border-brand shadow-sm scale-102'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span>{month.monthLabel}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {month.renewalCount}
                    </span>
                  </div>

                  <div className="mt-2 text-sm font-black font-mono">
                    {month.estimatedTotal.toFixed(3)} <span className="text-[10px] font-medium">BHD</span>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[10px] opacity-90">
                    <span className="text-emerald-500 font-bold">
                      {month.paidTotal > 0 ? `✓ ${month.paidTotal.toFixed(0)}` : '0'}
                    </span>
                    <span className="text-amber-500 font-bold">
                      {month.pendingTotal > 0 ? `⏳ ${month.pendingTotal.toFixed(0)}` : '0'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. SUB-VIEW TABS (Payment Table vs Cost Center Breakdown Matrix) */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubView('table')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              subView === 'table'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Payment Plan Table</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {filteredRecords.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubView('cost_centers')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              subView === 'cost_centers'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Cost Centers Allocation</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {budgetSummary.costCenterBreakdown.length}
            </span>
          </button>
        </div>

        {/* Action Controls (Export & Tariffs) */}
        <div className="flex items-center gap-2">
          {onOpenTariffs && (
            <button
              type="button"
              onClick={onOpenTariffs}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tariff Rules Engine</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => exportRenewalsToExcel(filteredRecords)}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Plan (Excel)</span>
          </button>
        </div>
      </div>

      {/* VIEW A: COST CENTER ALLOCATION MATRIX */}
      {subView === 'cost_centers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Cost Centers & Budgets Allocation
            </h4>
            <span className="text-xs text-slate-500 font-semibold">
              Total Registered Cost Centers: {budgetSummary.costCenterBreakdown.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Cost Center Code & Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">Renewals</th>
                  <th className="py-3 px-4 text-right">Estimated Budget</th>
                  <th className="py-3 px-4 text-right">Paid Amount</th>
                  <th className="py-3 px-4 text-right">Pending Due</th>
                  <th className="py-3 px-4 text-center">Completion (%)</th>
                  <th className="py-3 px-4 text-right">Filter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {budgetSummary.costCenterBreakdown.map(cc => {
                  return (
                    <tr key={cc.costCenterCode} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                            {cc.costCenterCode}
                          </span>
                          <span className="font-bold text-slate-800">{cc.costCenterName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          cc.type === 'BRANCH' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          cc.type === 'REGULATORY' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          cc.type === 'HOLDING' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {cc.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                        {cc.renewalCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                        {cc.estimatedTotal.toFixed(3)} <span className="text-[10px] text-slate-400">BHD</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        {cc.paidTotal.toFixed(3)} <span className="text-[10px] text-slate-400">BHD</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-600">
                        {cc.pendingTotal.toFixed(3)} <span className="text-[10px] text-slate-400">BHD</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-24 mx-auto space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span>{cc.paymentCompletionPercentage}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${Math.min(cc.paymentCompletionPercentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCostCenterFilter(cc.costCenterCode);
                            setSubView('table');
                            setPage(1);
                          }}
                          className="text-xs font-bold text-brand hover:underline"
                        >
                          View Documents ➔
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW B: PAYMENT PLAN DETAIL TABLE */}
      {subView === 'table' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by entity, document number, cost center, receipt..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              {/* Cost Center Filter */}
              <select
                value={selectedCostCenterFilter}
                onChange={(e) => {
                  setSelectedCostCenterFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold bg-white"
              >
                <option value="ALL">All Cost Centers</option>
                {budgetSummary.costCenterBreakdown.map(cc => (
                  <option key={cc.costCenterCode} value={cc.costCenterCode}>
                    {cc.costCenterCode} — {cc.costCenterName}
                  </option>
                ))}
              </select>

              {(searchTerm || selectedCostCenterFilter !== 'ALL' || selectedMonthFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                  title="Clear Filters"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleSort('entityName')}>
                      <div className="flex items-center gap-1">
                        <span>Entity / Branch</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4">Document Type</th>
                    <th className="py-3 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleSort('costCenter')}>
                      <div className="flex items-center gap-1">
                        <span>Cost Center</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleSort('plannedDate')}>
                      <div className="flex items-center gap-1">
                        <span>Target Payment Date</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right cursor-pointer hover:text-slate-800" onClick={() => handleSort('estimatedCost')}>
                      <div className="flex items-center justify-end gap-1">
                        <span>Estimated Fee</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>

                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {paginatedRecords.length > 0 ? (
                    paginatedRecords.map(r => {
                      return (
                        <tr
                          key={r.id}
                          onClick={() => onViewDetails(r)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                          title="Click to view details"
                        >
                          <td className="py-3 px-4">
                            <div className="font-black text-slate-900">{getOperationalEntityDisplayName(r)}</div>
                            <div className="text-[10px] text-slate-400 font-mono">Doc #: {r.documentNumber}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-700">{r.documentType}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[10px]">
                                {r.costCenterCode || 'CC-GEN-OPS'}
                              </span>
                              <span className="text-[10px] text-slate-500 truncate max-w-[140px]" title={r.costCenterName}>
                                {r.costCenterName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-slate-800">
                              {r.plannedPaymentDate || r.expiryDate}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Expires: {r.expiryDate}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="font-mono font-black text-slate-900">
                              {(r.estimatedCost ?? 0).toFixed(3)} <span className="text-[10px] text-slate-400">BHD</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No records matching the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500">
                  Page {page} of {totalPages} (Total Records: {sortedRecords.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
