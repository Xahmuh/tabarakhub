import React, { useEffect, useState, useMemo } from 'react';
import { ArrowRightLeft, BarChart3, Building2, Car, Download, FileSpreadsheet, FileText, Fuel, Gauge, Package, TrendingDown, TrendingUp, Truck, UserCheck, Wrench } from 'lucide-react';
import { Branch, ExpenseCategory, ExpenseFilters, ExpenseTransaction } from '../../types';
import { expenseService } from '../../services/expenseService';
import { branchService } from '../../services/branchService';
import { formatBhdAmount, formatBhdWithCurrency } from '../../utils/money';
import { exportExpensesToPDF, exportExpensesToExcel } from './utils/exportExpenses';
import { PaginationControls } from '../shared';

const REPORT_PAGE_SIZE = 10;

interface ExpenseReportsProps {
  user: Branch;
  isManager: boolean;
}

export const ExpenseReports: React.FC<ExpenseReportsProps> = ({ user, isManager }) => {
  const [expenses, setExpenses] = useState<ExpenseTransaction[]>([]);
  const [previousExpenses, setPreviousExpenses] = useState<ExpenseTransaction[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string>(isManager ? 'all' : user.id);
  
  // Pagination states (10 items per page)
  const [categoryPage, setCategoryPage] = useState(1);
  const [vehiclePage, setVehiclePage] = useState(1);
  const [branchPage, setBranchPage] = useState(1);
  const [fuelPage, setFuelPage] = useState(1);
  const [vehicleServicesPage, setVehicleServicesPage] = useState(1);
  const [pharmacistPage, setPharmacistPage] = useState(1);

  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState<string>(new Date().toISOString().split('T')[0]);

  // Calculate previous date range for comparison (handles full calendar months or exact calendar day shifts)
  const prevPeriod = useMemo(() => {
    if (!dateFrom || !dateTo) return null;
    const start = new Date(dateFrom + 'T00:00:00');
    const end = new Date(dateTo + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

    const formatYmd = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    // Check if start is 1st of month and end is last day of the same month
    const isFirstDay = start.getDate() === 1;
    const lastDayOfStartMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const isFullMonth = isFirstDay && end.getDate() === lastDayOfStartMonth && start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

    if (isFullMonth) {
      // Exactly previous calendar month
      const prevMonthLastDay = new Date(start.getFullYear(), start.getMonth(), 0);
      const prevMonthFirstDay = new Date(prevMonthLastDay.getFullYear(), prevMonthLastDay.getMonth(), 1);
      
      return {
        dateFrom: formatYmd(prevMonthFirstDay),
        dateTo: formatYmd(prevMonthLastDay),
        label: `${formatYmd(prevMonthFirstDay)} to ${formatYmd(prevMonthLastDay)}`
      };
    }

    // Custom range: shift back by exact number of calendar days
    const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
    const prevEnd = new Date(start.getTime() - (24 * 60 * 60 * 1000));
    const prevStart = new Date(prevEnd.getTime() - ((diffDays - 1) * 24 * 60 * 60 * 1000));

    return {
      dateFrom: formatYmd(prevStart),
      dateTo: formatYmd(prevEnd),
      label: `${formatYmd(prevStart)} to ${formatYmd(prevEnd)}`
    };
  }, [dateFrom, dateTo]);

  const filters: ExpenseFilters = useMemo(() => ({
    branchId: isManager ? selectedBranch : user.id,
    dateFrom,
    dateTo
  }), [isManager, selectedBranch, user.id, dateFrom, dateTo]);

  const selectedBranchName = useMemo(() => {
    if (selectedBranch === 'all') return 'All Branches';
    const found = branches.find(b => b.id === selectedBranch);
    if (found) return `${found.name} (${found.code})`;
    if (user.id === selectedBranch) return `${user.name} (${user.code})`;
    return selectedBranch;
  }, [selectedBranch, branches, user]);

  useEffect(() => {
    expenseService.categories.list().then(setCategories).catch(console.error);
    if (isManager) branchService.list().then(setBranches).catch(console.error);
  }, [isManager]);

  useEffect(() => {
    setLoading(true);
    setCategoryPage(1);
    setVehiclePage(1);
    setBranchPage(1);
    setFuelPage(1);
    setVehicleServicesPage(1);
    setPharmacistPage(1);
    expenseService.expenses.list(filters)
      .then(setExpenses)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  // Compute summary by Vehicle (Primary KPI - Vehicles Only)
  const summaryByVehicle = useMemo(() => {
    const map: Record<string, { key: string; plateNumber?: string; vehicleCode?: string; driver: string; total: number; count: number; distance: number; liters: number }> = {};
    expenses.forEach(exp => {
      const plate = exp.plateNumber?.trim();
      const vCode = exp.vehicleCode?.trim();
      // Strictly include vehicle expenses only
      if (!plate && !vCode && !exp.vehicleId) return;

      const key = plate ? `Plate: ${plate}` : `Vehicle Code: ${vCode}`;
      
      if (!map[key]) {
        map[key] = {
          key,
          plateNumber: plate,
          vehicleCode: vCode,
          driver: exp.driverName || '—',
          total: 0,
          count: 0,
          distance: 0,
          liters: 0
        };
      }
      map[key].total += exp.amount;
      map[key].count++;
      if (exp.fuelDetails) {
        map[key].distance += exp.fuelDetails.distanceSincePrevious || 0;
        map[key].liters += exp.fuelDetails.liters || 0;
      }
      if (exp.driverName && map[key].driver === '—') {
        map[key].driver = exp.driverName;
      }
      if (exp.plateNumber && !map[key].plateNumber) {
        map[key].plateNumber = exp.plateNumber;
      }
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [expenses]);

  const paginatedVehicles = useMemo(() => {
    const start = (vehiclePage - 1) * REPORT_PAGE_SIZE;
    return summaryByVehicle.slice(start, start + REPORT_PAGE_SIZE);
  }, [summaryByVehicle, vehiclePage]);

  // Compute summary by Pharmacist / Recorded By (Secondary)
  const summaryByPharmacist = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    expenses.forEach(exp => {
      const key = exp.createdBy?.trim() || 'Not Specified';
      if (!map[key]) map[key] = { name: key, total: 0, count: 0 };
      map[key].total += exp.amount;
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [expenses]);

  // Compute summary by category
  const summaryByCategory = useMemo(() => {
    const map: Record<string, { name: string; slug: string; total: number; count: number }> = {};
    expenses.forEach(exp => {
      const key = exp.categoryId;
      if (!map[key]) map[key] = { name: exp.categoryName || 'Unknown', slug: exp.categorySlug || 'other', total: 0, count: 0 };
      map[key].total += exp.amount;
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [expenses]);

  // Compute summary by branch (for managers)
  const summaryByBranch = useMemo(() => {
    if (!isManager || selectedBranch !== 'all') return [];
    const map: Record<string, { code: string; name: string; total: number; count: number }> = {};
    expenses.forEach(exp => {
      const key = exp.branchId;
      if (!map[key]) map[key] = { code: exp.branchCode || '?', name: exp.branchName || 'Unknown', total: 0, count: 0 };
      map[key].total += exp.amount;
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [expenses, isManager, selectedBranch]);

  // Fuel report
  const fuelExpenses = useMemo(() =>
    expenses.filter(e => e.categorySlug === 'fuel' && e.fuelDetails),
    [expenses]
  );

  const fuelSummary = useMemo(() => {
    let totalDistance = 0, totalLiters = 0, totalCost = 0;
    fuelExpenses.forEach(e => {
      totalDistance += e.fuelDetails?.distanceSincePrevious || 0;
      totalLiters += e.fuelDetails?.liters || 0;
      totalCost += e.amount;
    });
    const avgCostPerKm = totalDistance > 0 ? totalCost / totalDistance : 0;
    const avgConsumption = totalDistance > 0 && totalLiters > 0 ? totalDistance / totalLiters : 0;
    return { totalDistance, totalLiters, totalCost, avgCostPerKm, avgConsumption, count: fuelExpenses.length };
  }, [fuelExpenses]);

  // Vehicle Services report
  const vehicleServicesExpenses = useMemo(() =>
    expenses.filter(e => e.categorySlug === 'vehicle_services'),
    [expenses]
  );

  const vehicleServicesSummary = useMemo(() => {
    let totalCost = 0;
    vehicleServicesExpenses.forEach(e => {
      totalCost += e.amount;
    });
    const avgCostPerService = vehicleServicesExpenses.length > 0 ? totalCost / vehicleServicesExpenses.length : 0;
    const uniqueVehiclesServiced = new Set(vehicleServicesExpenses.map(e => e.vehicleId || e.plateNumber).filter(Boolean)).size;
    return {
      count: vehicleServicesExpenses.length,
      totalCost,
      avgCostPerService,
      uniqueVehiclesServiced
    };
  }, [vehicleServicesExpenses]);

  // Paginated arrays (10 per page)
  const paginatedCategories = useMemo(() => {
    const start = (categoryPage - 1) * REPORT_PAGE_SIZE;
    return summaryByCategory.slice(start, start + REPORT_PAGE_SIZE);
  }, [summaryByCategory, categoryPage]);

  const paginatedBranches = useMemo(() => {
    const start = (branchPage - 1) * REPORT_PAGE_SIZE;
    return summaryByBranch.slice(start, start + REPORT_PAGE_SIZE);
  }, [summaryByBranch, branchPage]);

  const paginatedFuelExpenses = useMemo(() => {
    const start = (fuelPage - 1) * REPORT_PAGE_SIZE;
    return fuelExpenses.slice(start, start + REPORT_PAGE_SIZE);
  }, [fuelExpenses, fuelPage]);

  const paginatedVehicleServicesExpenses = useMemo(() => {
    const start = (vehicleServicesPage - 1) * REPORT_PAGE_SIZE;
    return vehicleServicesExpenses.slice(start, start + REPORT_PAGE_SIZE);
  }, [vehicleServicesExpenses, vehicleServicesPage]);

  const paginatedPharmacists = useMemo(() => {
    const start = (pharmacistPage - 1) * REPORT_PAGE_SIZE;
    return summaryByPharmacist.slice(start, start + REPORT_PAGE_SIZE);
  }, [summaryByPharmacist, pharmacistPage]);

  useEffect(() => {
    if (!showComparison || !prevPeriod) {
      setPreviousExpenses([]);
      return;
    }
    expenseService.expenses.list({
      branchId: isManager ? selectedBranch : user.id,
      dateFrom: prevPeriod.dateFrom,
      dateTo: prevPeriod.dateTo
    }).then(setPreviousExpenses).catch(console.error);
  }, [showComparison, prevPeriod, selectedBranch, isManager, user.id]);

  const grandTotal = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const prevGrandTotal = useMemo(() => previousExpenses.reduce((s, e) => s + e.amount, 0), [previousExpenses]);

  const totalPercentageChange = useMemo(() => {
    if (!showComparison || prevGrandTotal === 0) return null;
    return ((grandTotal - prevGrandTotal) / prevGrandTotal) * 100;
  }, [showComparison, grandTotal, prevGrandTotal]);

  const prevFuelCost = useMemo(() => 
    previousExpenses.filter(e => e.categorySlug === 'fuel').reduce((s, e) => s + e.amount, 0),
    [previousExpenses]
  );

  const prevVehicleServicesCost = useMemo(() => 
    previousExpenses.filter(e => e.categorySlug === 'vehicle_services').reduce((s, e) => s + e.amount, 0),
    [previousExpenses]
  );

  const vehicleExpensesTotal = useMemo(() => 
    expenses.filter(e => e.vehicleCode || e.categorySlug === 'fuel').reduce((s, e) => s + e.amount, 0),
    [expenses]
  );

  const uniqueVehiclesCount = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach(e => { if (e.vehicleCode) set.add(e.vehicleCode); });
    return set.size;
  }, [expenses]);

  const categoryIcon = (slug: string) => {
    switch (slug) {
      case 'fuel': return <Fuel className="h-5 w-5 text-slate-600" />;
      case 'vehicle_services': return <Wrench className="h-5 w-5 text-slate-600" />;
      case 'maintenance': return <Building2 className="h-5 w-5 text-slate-600" />;
      case 'supplies': return <Package className="h-5 w-5 text-slate-600" />;
      default: return <FileText className="h-5 w-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Filters & Export Actions Panel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-4 items-center">
          {isManager && branches.length > 0 && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Branch</label>
              <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none transition-all">
                <option value="all">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none transition-all" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none transition-all" />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Period Comparison</label>
            <button
              type="button"
              onClick={() => setShowComparison(!showComparison)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                showComparison
                  ? 'bg-brand/10 border-brand/40 text-brand shadow-2xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              {showComparison ? 'Comparison: ON / مفعل' : 'Compare vs Prev Period'}
            </button>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportExpensesToExcel(expenses, `Operational_Expenses_${selectedBranch}`)}
            disabled={expenses.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all disabled:opacity-50"
            title="Export full expense report including Pharmacist breakdown to Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </button>
          <button
            onClick={() => exportExpensesToPDF(expenses, `Operational Expenses Report`, selectedBranchName)}
            disabled={expenses.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all disabled:opacity-50"
            title="Download printable PDF report"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : (
        <>
          {/* High Impact KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* KPI 1: Total Expenses */}
            <div className="bg-gradient-to-br from-brand to-brand-hover rounded-2xl p-6 text-white shadow-lg shadow-brand/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Total Expenses</p>
                  <p className="text-2xl font-black tracking-tight mt-1">{formatBhdWithCurrency(grandTotal)}</p>
                  <p className="text-xs font-bold text-white/70 mt-1">{expenses.length} transactions</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
              </div>

              {showComparison && prevPeriod && (
                <div className="mt-3 pt-2.5 border-t border-white/20 flex items-center justify-between text-xs font-extrabold">
                  <span className="text-white/80 text-[10px]">Prev Period ({prevPeriod.dateFrom} to {prevPeriod.dateTo}):</span>
                  <span className="flex items-center gap-1">
                    {formatBhdAmount(prevGrandTotal)}
                    {totalPercentageChange !== null && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-black flex items-center gap-0.5 ${
                          totalPercentageChange > 0
                            ? 'bg-rose-500 text-white'
                            : totalPercentageChange < 0
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/20 text-white'
                        }`}
                      >
                        {totalPercentageChange > 0 ? (
                          <TrendingUp className="h-3 w-3 inline" />
                        ) : (
                          <TrendingDown className="h-3 w-3 inline" />
                        )}
                        {totalPercentageChange > 0 ? '+' : ''}{totalPercentageChange.toFixed(1)}%
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* KPI 2: Fleet & Vehicle Expenses */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Fleet & Vehicle Costs</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tight mt-1">{formatBhdWithCurrency(vehicleExpensesTotal)}</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">
                    {grandTotal > 0 ? ((vehicleExpensesTotal / grandTotal) * 100).toFixed(0) : 0}% of overall total
                  </p>
                </div>
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100 shrink-0">
                  <Truck className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </div>

            {/* KPI 3: Total Fleet Distance */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Distance</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                    {fuelSummary.totalDistance.toLocaleString()} <span className="text-xs font-bold text-slate-400">KM</span>
                  </p>
                  <p className="text-xs font-bold text-slate-500 mt-1">From fuel log odometers</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100 shrink-0">
                  <Gauge className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            {/* KPI 4: Active Vehicles */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Active Vehicles</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tight mt-1">{uniqueVehiclesCount}</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">Vehicles with logged expenses</p>
                </div>
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100 shrink-0">
                  <Car className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Category Breakdown (Grid Layout - Side-by-Side Cards) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                By Category
              </h3>
              <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">{summaryByCategory.length} Categories</span>
            </div>

            <div className="p-6">
              {summaryByCategory.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No expenses in this period.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {paginatedCategories.map(cat => (
                    <div key={cat.slug} className="bg-slate-50/70 hover:bg-white border border-slate-200/80 hover:border-brand/40 rounded-xl p-4 transition-all shadow-sm flex flex-col justify-between">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-sm shrink-0">
                          {categoryIcon(cat.slug)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-slate-900 truncate">{cat.name}</p>
                          <p className="text-xs font-semibold text-slate-400 mt-0.5">{cat.count} transactions</p>
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Spent</span>
                          <p className="text-sm font-black text-brand">{formatBhdWithCurrency(cat.total)}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Share</span>
                          <p className="text-xs font-extrabold text-slate-700">
                            {grandTotal > 0 ? ((cat.total / grandTotal) * 100).toFixed(1) : 0}%
                          </p>
                        </div>
                      </div>

                      <div className="w-full h-1.5 bg-slate-200/70 rounded-full mt-3 overflow-hidden">
                        <div
                          className="h-full bg-brand rounded-full transition-all"
                          style={{ width: `${grandTotal > 0 ? (cat.total / grandTotal * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {summaryByCategory.length > REPORT_PAGE_SIZE && (
              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50">
                <PaginationControls
                  currentPage={categoryPage}
                  totalItems={summaryByCategory.length}
                  pageSize={REPORT_PAGE_SIZE}
                  onPageChange={setCategoryPage}
                  itemLabel="categories"
                />
              </div>
            )}
          </div>

          {/* PRIMARY KPI: Breakdown by Vehicle Plate Number (Dedicated Section) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-900 flex items-center gap-2">
                <Truck className="h-4 w-4 text-brand" />
                By Vehicle Plate Number
              </h3>
              <span className="text-xs font-bold px-2.5 py-1 bg-brand/10 text-brand rounded-full">
                Primary KPI
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {paginatedVehicles.map(v => (
                <div key={v.key} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 bg-amber-100 text-amber-900 border border-amber-200">
                    <Truck className="h-5 w-5 text-amber-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-slate-900 truncate">{v.key}</p>
                      {v.vehicleCode && v.plateNumber && (
                        <span className="text-[10px] font-bold text-brand bg-brand/5 px-2 py-0.5 rounded-md border border-brand/20">
                          Code: {v.vehicleCode}
                        </span>
                      )}
                      {v.driver !== '—' && (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          Driver: {v.driver}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {v.count} transactions {v.distance > 0 ? `• ${v.distance.toLocaleString()} km driven` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-brand">{formatBhdWithCurrency(v.total)}</p>
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-2">
                      <div
                        className="h-full bg-brand rounded-full transition-all"
                        style={{ width: `${grandTotal > 0 ? (v.total / grandTotal * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {summaryByVehicle.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">No vehicle expenses recorded.</p>
              )}
            </div>
            {summaryByVehicle.length > REPORT_PAGE_SIZE && (
              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50">
                <PaginationControls
                  currentPage={vehiclePage}
                  totalItems={summaryByVehicle.length}
                  pageSize={REPORT_PAGE_SIZE}
                  onPageChange={setVehiclePage}
                  itemLabel="vehicles"
                />
              </div>
            )}
          </div>

          {/* Branch Breakdown (managers only) */}
          {summaryByBranch.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-700">By Branch</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {paginatedBranches.map(b => (
                  <div key={b.code} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                    <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
                      <span className="text-[10px] font-black text-white">{b.code}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black text-slate-900">{b.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{b.count} transactions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-brand">{formatBhdWithCurrency(b.total)}</p>
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-2">
                        <div
                          className="h-full bg-brand rounded-full transition-all"
                          style={{ width: `${grandTotal > 0 ? (b.total / grandTotal * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {summaryByBranch.length > REPORT_PAGE_SIZE && (
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50">
                  <PaginationControls
                    currentPage={branchPage}
                    totalItems={summaryByBranch.length}
                    pageSize={REPORT_PAGE_SIZE}
                    onPageChange={setBranchPage}
                    itemLabel="branches"
                  />
                </div>
              )}
            </div>
          )}

          {/* Fuel Report */}
          {fuelSummary.count > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-700">
                  <Fuel className="h-4 w-4 inline-block mr-2 text-amber-600" />
                  Fuel Report
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Fuel Entries</p>
                  <p className="text-2xl font-black text-slate-900">{fuelSummary.count}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total Cost</p>
                  <p className="text-2xl font-black text-brand">{formatBhdAmount(fuelSummary.totalCost)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Distance</p>
                  <p className="text-2xl font-black text-slate-900">{fuelSummary.totalDistance.toLocaleString()} <span className="text-sm">km</span></p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total Liters</p>
                  <p className="text-2xl font-black text-slate-900">{fuelSummary.totalLiters.toFixed(1)} <span className="text-sm">L</span></p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Avg Cost/km</p>
                  <p className="text-2xl font-black text-brand">{formatBhdAmount(fuelSummary.avgCostPerKm)}</p>
                </div>
              </div>

              {/* Fuel detail table */}
              <div className="px-6 pb-6 overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-100">
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Ref</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Date</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Recorded By</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Vehicle Plate</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Driver</th>
                      <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Distance</th>
                      <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Liters</th>
                      <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedFuelExpenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-bold text-slate-900">{exp.referenceNo}</td>
                        <td className="px-3 py-2 text-slate-600">{new Date(exp.expenseDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                        <td className="px-3 py-2 text-slate-600 font-medium">{exp.createdBy || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{exp.plateNumber ? `Plate: ${exp.plateNumber}` : (exp.vehicleCode || '—')}</td>
                        <td className="px-3 py-2 text-slate-600">{exp.driverName || '—'}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">{exp.fuelDetails?.distanceSincePrevious?.toLocaleString()} km</td>
                        <td className="px-3 py-2 text-right text-slate-600">{exp.fuelDetails?.liters?.toFixed(1) || '—'}</td>
                        <td className="px-3 py-2 text-right font-black text-brand">{formatBhdWithCurrency(exp.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {fuelExpenses.length > REPORT_PAGE_SIZE && (
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50">
                  <PaginationControls
                    currentPage={fuelPage}
                    totalItems={fuelExpenses.length}
                    pageSize={REPORT_PAGE_SIZE}
                    onPageChange={setFuelPage}
                    itemLabel="fuel entries"
                  />
                </div>
              )}
            </div>
          )}

          {/* Vehicle Services Report */}
          {vehicleServicesSummary.count > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-800 flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-brand" />
                  Vehicle Services Report
                </h3>
                <span className="text-xs font-bold px-2.5 py-1 bg-brand/10 text-brand rounded-full">
                  {vehicleServicesSummary.count} Services
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Service Entries</p>
                  <p className="text-2xl font-black text-slate-900">{vehicleServicesSummary.count}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total Cost</p>
                  <p className="text-2xl font-black text-brand">{formatBhdAmount(vehicleServicesSummary.totalCost)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Avg Cost / Service</p>
                  <p className="text-2xl font-black text-slate-900">{formatBhdAmount(vehicleServicesSummary.avgCostPerService)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Vehicles Serviced</p>
                  <p className="text-2xl font-black text-slate-900">{vehicleServicesSummary.uniqueVehiclesServiced}</p>
                </div>
              </div>

              {/* Vehicle Services detail table */}
              <div className="px-6 pb-6 overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-100">
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Ref</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Date</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Recorded By</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Vehicle Plate</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Driver</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Description / Service Details</th>
                      <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedVehicleServicesExpenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 font-bold text-slate-900">{exp.referenceNo}</td>
                        <td className="px-3 py-2.5 text-slate-600 font-medium">
                          {new Date(exp.expenseDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 font-medium">{exp.createdBy || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-700 font-bold">
                          {exp.plateNumber ? `Plate: ${exp.plateNumber}` : (exp.vehicleCode || '—')}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{exp.driverName || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 max-w-xs truncate" title={exp.description || ''}>
                          {exp.description || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-black text-brand">{formatBhdWithCurrency(exp.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {vehicleServicesExpenses.length > REPORT_PAGE_SIZE && (
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50">
                  <PaginationControls
                    currentPage={vehicleServicesPage}
                    totalItems={vehicleServicesExpenses.length}
                    pageSize={REPORT_PAGE_SIZE}
                    onPageChange={setVehicleServicesPage}
                    itemLabel="services"
                  />
                </div>
              )}
            </div>
          )}

          {/* Secondary Audit: Pharmacist Breakdown (Very End of Page) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-[0.15em] text-slate-500 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-slate-400" />
                Audit Log: By Pharmacist / Recorded By
              </h3>
              <span className="text-xs font-bold text-slate-400">{summaryByPharmacist.length} Pharmacists</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-slate-50/30">
              {paginatedPharmacists.map(p => (
                <div key={p.name} className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="w-9 h-9 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center font-black text-xs shrink-0">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-900 truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-500">{p.count} transactions</p>
                  </div>
                  <p className="text-xs font-black text-slate-700 shrink-0">{formatBhdWithCurrency(p.total)}</p>
                </div>
              ))}
              {summaryByPharmacist.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4 col-span-full">No expenses found.</p>
              )}
            </div>
            {summaryByPharmacist.length > REPORT_PAGE_SIZE && (
              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50">
                <PaginationControls
                  currentPage={pharmacistPage}
                  totalItems={summaryByPharmacist.length}
                  pageSize={REPORT_PAGE_SIZE}
                  onPageChange={setPharmacistPage}
                  itemLabel="pharmacists"
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
