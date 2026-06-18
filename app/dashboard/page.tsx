import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  Banknote,
  Package,
  Users,
  Activity,
  BarChart3,
  TrendingUp,
  Layers,
  ChevronDown,
  CalendarDays,
  Landmark,
  Globe,
  MonitorCheck,
  ChevronRight,
  AlertTriangle,
  Download,
  MapPin,
  ChevronLeft,
  Search,
  PieChart as PieChartIcon,
  ShieldCheck,
  Zap,
  Lock,
  Database,
  FileSpreadsheet,
  ArrowUpRight,
  RefreshCcw,
  Info,
  Filter,
  Maximize2,
  UserX,
  LayoutGrid,
  UserCheck,
  History,
  Box,
  ShoppingCart,
  UserCircle,
  Sparkles,
  Truck,
  Wallet,
  Target,
  PackageX,
  TrendingDown,
  AlertCircle,
  UserMinus,
  Trash2,
  FileText
} from 'lucide-react';
import { BackToModulesButton, RevenueChart, OperationalTrendChart, ShortageTrendChart, DailyPerformanceCalendar, RangeDatePicker } from '../shared';
import { PharmacistActivitySection } from './PharmacistActivitySection';
import { ProductManagementSection } from '../shared';
import { supabase } from '../../lib/supabase';
import { LostSale, Branch, Product, Shortage } from '../../types';
import { mapBranchName } from '../../utils/excelUtils';
import { isModuleEnabled } from '../../config/clientConfig';
import { isManagerRole } from '../../lib/access';

const createExcelWorkbook = async () => {
  if (!isModuleEnabled('excelExport')) {
    throw new Error('Excel export is disabled for this client deployment');
  }

  const ExcelJS = await import('exceljs');
  return new ExcelJS.Workbook();
};

const StrategicKPI: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  isCurrency?: boolean;
  trend?: string;
  isPrimary?: boolean;
  subtext?: string;
  critical?: boolean;
  description?: string;
  unit?: string;
}> = ({ label, value, icon, isCurrency, trend, isPrimary, subtext, critical, description, unit }) => {
  return (
    <div className={`p-7 rounded-[2rem] border-2 transition-all duration-500 relative flex flex-col justify-between min-h-[170px] group ${isPrimary
      ? 'bg-red-700 border-red-700 text-white overflow-hidden shadow-xl shadow-red-700/20'
      : critical
        ? 'bg-white border-red-100 text-slate-900 hover:border-red-300/50 hover:shadow-xl hover:shadow-red-500/5'
        : 'bg-white border-slate-100 text-slate-900 hover:border-red-200/50 hover:shadow-xl hover:shadow-red-500/5'
      }`}>
      {isPrimary && (
        <div className="absolute top-0 right-0 w-28 h-28 bg-white/5 rounded-full -mr-14 -mt-14 blur-2xl"></div>
      )}

      {critical && !isPrimary && (
        <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 px-2.5 py-1 bg-red-50 border border-red-100 rounded-full z-20">
          <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></div>
          <span className="text-[7px] font-black text-red-600 uppercase tracking-[0.1em]">Action Required</span>
        </div>
      )}

      <div className={`flex items-start justify-between relative z-10 ${critical ? 'mt-3' : ''}`}>
        <div>
          <h3 className={`text-[10px] font-black uppercase tracking-[0.15em] ${isPrimary ? 'text-white/60' : 'text-slate-400 group-hover:text-red-600 transition-colors'}`}>
            {label}
          </h3>
          {description && (
            <p className="mt-1 text-[11px] font-bold leading-tight text-slate-600">
              "{description}"
            </p>
          )}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center border-2 shrink-0 transition-all duration-500 ${isPrimary
          ? 'bg-white/10 border-white/10 text-white'
          : critical
            ? 'bg-red-50 border-red-100 text-red-600'
            : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:bg-red-700 group-hover:border-red-700 group-hover:text-white'
          }`}>
          {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { size: 18 }) : icon}
        </div>
      </div>

      <div className="mt-3 relative z-10 flex flex-col">
        <div className="flex items-baseline gap-2">
          {(isCurrency || unit) && (
            <span className={`text-xs font-black tracking-tighter ${isPrimary ? 'text-white/40' : 'text-slate-300'}`}>
              {isCurrency ? 'BHD' : unit}
            </span>
          )}
          <span className={`text-4xl font-black tracking-tighter tabular-nums ${critical && !isPrimary ? 'text-red-700' : isPrimary ? '' : 'text-slate-900 group-hover:text-red-700 transition-colors'}`}>
            {value}
          </span>
        </div>

        {subtext ? (
          <div className={`mt-3 w-fit px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${isPrimary
            ? 'bg-white/10 text-white/80'
            : critical ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600'
            }`}>
            {subtext}
          </div>
        ) : null}
      </div>
    </div>
  );
};

interface DashboardPageProps {
  user: Branch;
  permissions: any[];
  onBack?: () => void;
}

type DashboardDateType = 'all' | 'today' | 'yesterday' | '7d' | 'month' | 'custom';

type DashboardKpiSnapshot = {
  total_shortages: number;
  total_lost_sales: number;
  total_products: number;
  shortage_by_day: { date: string; count: number }[];
};

type ExportScope = {
  branchId: string | null;
  branchIds?: string[];
  label: string;
  filePart: string;
  isAllBranches: boolean;
};

const getUnknownErrorMessage = (error: unknown, fallback = 'Failed to sync data') => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const anyError = error as Record<string, unknown>;
    const parts = [
      anyError.message,
      anyError.details,
      anyError.hint,
      anyError.code ? `code: ${anyError.code}` : null
    ].filter(value => typeof value === 'string' && value.trim());
    if (parts.length > 0) return parts.join(' ');
    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

export const DashboardPage: React.FC<DashboardPageProps> = ({ user, permissions, onBack }) => {
  const getPermission = (feature: string) => {
    return permissions.find(p => p.featureName === feature)?.accessLevel || 'read';
  };

  const salesPerm = getPermission('lost_sales');
  const shortagesPerm = getPermission('shortages');
  // --- States Management System ---
  const [sales, setSales] = useState<LostSale[]>([]);
  const [allSales, setAllSales] = useState<LostSale[]>([]); // NEW: Store unfiltered sales for historical calculations
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [allShortages, setAllShortages] = useState<Shortage[]>([]); // NEW: Store unfiltered shortages
  const [dashboardKpis, setDashboardKpis] = useState<DashboardKpiSnapshot | null>(null);

  const cleanName = (name: string) => name?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const isSupervisorRole = user.role === 'supervisor';
  const supervisorUsesAssignedScope = isSupervisorRole && user.supervisorScopeMode !== 'all_zones';
  const isCanSelectBranch = isManagerRole(user.role) || user.role === 'owner' || user.role === 'warehouse' || isSupervisorRole;
  const isAdmin = isCanSelectBranch;
  const [selectedBranch, setSelectedBranch] = useState<string>(isCanSelectBranch ? 'all' : user.id);
  const initialDateType = (() => {
    const saved = sessionStorage.getItem('tabarak_dashboard_date_filter') as DashboardDateType | null;
    const allowed: DashboardDateType[] = ['all', 'today', 'yesterday', '7d', 'month', 'custom'];
    if (saved && allowed.includes(saved)) {
      sessionStorage.removeItem('tabarak_dashboard_date_filter');
      return saved;
    }
    return 'today';
  })();
  const [dateType, setDateType] = useState<DashboardDateType>(initialDateType);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [paretoPage, setParetoPage] = useState(1);
  const [lossDriverFilter, setLossDriverFilter] = useState<'priority' | 'high_value' | 'frequent' | 'all'>('priority');
  const [lossDriverSearch, setLossDriverSearch] = useState('');
  const [branchPage, setBranchPage] = useState(1);
  const [hotShortagePage, setHotShortagePage] = useState(1);
  const [performanceLogPage, setPerformanceLogPage] = useState(1);
  const [performanceLogFilter, setPerformanceLogFilter] = useState<'no_recovery' | 'alt_given' | 'transferred' | null>(null);
  const [performanceLogSearch, setPerformanceLogSearch] = useState('');
  // تقسيم حالة التحميل: مزامنة البيانات وتصدير الملفات
  const [isSyncing, setIsSyncing] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const initialViewMode = (() => {
    const saved = sessionStorage.getItem('tabarak_dashboard_view') as 'standard' | 'expanded' | 'products' | null;
    if (saved) return saved;
    return salesPerm !== 'none' ? 'standard' : 'expanded';
  })();
  const [viewMode, setViewMode] = useState<'standard' | 'expanded' | 'products'>(initialViewMode);

  const changeViewMode = (mode: 'standard' | 'expanded' | 'products') => {
    sessionStorage.setItem('tabarak_dashboard_view', mode);
    setViewMode(mode);
  };
  const [expandedShortageId, setExpandedShortageId] = useState<string | null>(null);
  const [shortageStatusFilter, setShortageStatusFilter] = useState<string | null>(null);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [branchSearchTerm, setBranchSearchTerm] = useState('');
  // إدارة الأخطاء مع إمكانية إعادة المحاولة
  const [error, setError] = useState<{ message: string; retry?: () => void } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dateType === 'all') {
      setLossDriverFilter('all');
      setParetoPage(1);
    }
  }, [dateType]);

  // وظيفة عرض الإشعارات بدلاً من alert
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    window.dispatchEvent(new CustomEvent('tabarak_toast', { detail: { message, type } }));
  };

  const getSupervisorBranchIds = useCallback(async () => {
    if (!supervisorUsesAssignedScope) return undefined;
    let zones;
    try {
      zones = await supabase.permissions.listBranchZones();
    } catch (error) {
      throw new Error(`Could not load supervisor zone assignments: ${getUnknownErrorMessage(error)}`);
    }
    return Array.from(new Set(
      zones
        .filter(zone => zone.isActive)
        .flatMap(zone => zone.branchIds || [])
        .filter(Boolean)
    ));
  }, [supervisorUsesAssignedScope]);

  // التحقق من صحة التاريخ المدخل يدوياً - Helper to convert DD-MM-YYYY to YYYY-MM-DD
  const parseManualDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    if (y.length !== 4 || m.length !== 2 || d.length !== 2) return null;

    // تحويل إلى أرقام والتحقق من صحتها
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    const year = parseInt(y, 10);

    // التحقق من NaN
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

    // التحقق من نطاق الشهر (1-12)
    if (month < 1 || month > 12) return null;

    // التحقق من نطاق اليوم (1-31)
    if (day < 1 || day > 31) return null;

    // التحقق من صحة التاريخ (مثل رفض 31 فبراير)
    const testDate = new Date(year, month - 1, day);
    if (testDate.getDate() !== day || testDate.getMonth() !== month - 1 || testDate.getFullYear() !== year) {
      return null;
    }

    return `${y}-${m}-${d}`;
  };

  const formatToManual = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  };

  const [manualStart, setManualStart] = useState(formatToManual(startDate));
  const [manualEnd, setManualEnd] = useState(formatToManual(endDate));

  // استخراج منطق تصفية التاريخ - Date filtering utilities
  const getDateRange = useCallback((type: typeof dateType, start?: string, end?: string) => {
    const referenceDate = new Date();

    if (type === 'all') {
      return { start: null, end: null };
    } else if (type === 'today') {
      const threshold = new Date();
      threshold.setHours(0, 0, 0, 0);
      return { start: threshold, end: null };
    } else if (type === 'yesterday') {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      return { start: startDate, end: endDate };
    } else if (type === '7d') {
      const threshold = new Date();
      threshold.setDate(referenceDate.getDate() - 7);
      return { start: threshold, end: null };
    } else if (type === 'month') {
      const threshold = new Date();
      threshold.setDate(referenceDate.getDate() - 30);
      return { start: threshold, end: null };
    } else if (type === 'custom' && start && end) {
      const startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      return { start: startDate, end: endDate };
    }

    return { start: null, end: null };
  }, []);

  const filterByDateRange = useCallback(<T extends { timestamp: string }>(data: T[], start: Date | null, end: Date | null): T[] => {
    if (!start) return data;

    return data.filter(item => {
      const itemDate = new Date(item.timestamp);
      if (end) {
        return itemDate >= start && itemDate <= end;
      }
      return itemDate >= start;
    });
  }, []);

  // --- Data Fetching Logic (Supabase Integration) ---
  const syncDashboardData = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const activeBranchId = isCanSelectBranch ? selectedBranch : user.id;
      const { start, end } = getDateRange(dateType, startDate, endDate);
      const supervisorBranchIds = supervisorUsesAssignedScope && activeBranchId === 'all'
        ? await getSupervisorBranchIds()
        : undefined;

      if (supervisorUsesAssignedScope && activeBranchId === 'all' && supervisorBranchIds?.length === 0) {
        setAllSales([]);
        setAllShortages([]);
        setSales([]);
        setShortages([]);
        setDashboardKpis({
          total_shortages: 0,
          total_lost_sales: 0,
          total_products: 0,
          shortage_by_day: []
        });
        setPerformanceLogPage(1);
        setBranchPage(1);
        return;
      }

      const listOptions = {
        timestampFrom: start,
        timestampTo: end,
        branchIds: supervisorBranchIds
      };
      let rawData: LostSale[];
      let rawShortages: Shortage[];
      try {
        const toDateParam = (value: Date | null, fallback: Date) =>
          (value || fallback).toISOString().slice(0, 10);
        const dateFrom = toDateParam(start, new Date('1900-01-01T00:00:00.000Z'));
        const dateTo = toDateParam(end, new Date());
        const kpiBranchIds = activeBranchId === 'all'
          ? (supervisorBranchIds && supervisorBranchIds.length > 0
            ? supervisorBranchIds
            : (await supabase.branches.list()).filter(branch => branch.role === 'branch').map(branch => branch.id))
          : [activeBranchId];

        const kpiResults = await Promise.all(kpiBranchIds.map(async branchId => {
          const { data, error } = await supabase.client.rpc('get_dashboard_kpis', {
            p_branch_id: branchId,
            p_date_from: dateFrom,
            p_date_to: dateTo,
          });
          if (error) throw error;
          return data as DashboardKpiSnapshot;
        }));

        const shortageByDay = new Map<string, number>();
        const mergedKpis = kpiResults.reduce<DashboardKpiSnapshot>((acc, item) => {
          acc.total_shortages += Number(item.total_shortages) || 0;
          acc.total_lost_sales += Number(item.total_lost_sales) || 0;
          acc.total_products += Number(item.total_products) || 0;
          (item.shortage_by_day || []).forEach(day => {
            shortageByDay.set(day.date, (shortageByDay.get(day.date) || 0) + (Number(day.count) || 0));
          });
          return acc;
        }, {
          total_shortages: 0,
          total_lost_sales: 0,
          total_products: 0,
          shortage_by_day: []
        });
        mergedKpis.shortage_by_day = Array.from(shortageByDay.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({ date, count }));
        setDashboardKpis(mergedKpis);
      } catch (error) {
        throw new Error(`Could not load dashboard KPIs: ${getUnknownErrorMessage(error)}`);
      }
      try {
        rawData = await supabase.sales.list(activeBranchId, user.role, listOptions);
      } catch (error) {
        throw new Error(`Could not load lost sales: ${getUnknownErrorMessage(error)}`);
      }
      try {
        rawShortages = await supabase.shortages.list(activeBranchId, user.role, listOptions);
      } catch (error) {
        throw new Error(`Could not load shortages: ${getUnknownErrorMessage(error)}`);
      }

      // Store raw data for calculations within the selected dashboard range.
      setAllSales(rawData);
      setAllShortages(rawShortages);

      // استخدام وظائف التصفية المستخرجة
      rawData = filterByDateRange(rawData, start, end);
      rawShortages = filterByDateRange(rawShortages, start, end);

      setSales(rawData);
      setShortages(rawShortages);
      setPerformanceLogPage(1);
      setBranchPage(1);
    } catch (error) {
      console.error("Critical Failure in Data Sync:", error);
      // معالجة الأخطاء مع إمكانية إعادة المحاولة
      const errorMessage = getUnknownErrorMessage(error);
      setError({
        message: errorMessage,
        retry: syncDashboardData
      });
      showToast(`Data sync failed: ${errorMessage}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [selectedBranch, dateType, startDate, endDate, isAdmin, isSupervisorRole, supervisorUsesAssignedScope, user.id, user.role, getDateRange, filterByDateRange, getSupervisorBranchIds]);

  useEffect(() => {
    const initializeSystem = async () => {
      try {
        const [branchList, productList, zoneList] = await Promise.all([
          supabase.branches.list(),
          supabase.products.list(user.id),
          supervisorUsesAssignedScope ? supabase.permissions.listBranchZones() : Promise.resolve([])
        ]);
        const supervisorBranchIds = supervisorUsesAssignedScope
          ? new Set(zoneList.filter(zone => zone.isActive).flatMap(zone => zone.branchIds || []))
          : null;
        setBranches(branchList.filter(b => b.role === 'branch' && (!supervisorBranchIds || supervisorBranchIds.has(b.id))));
        setProducts(productList);
        if (supervisorBranchIds && selectedBranch !== 'all' && !supervisorBranchIds.has(selectedBranch)) {
          setSelectedBranch('all');
        }
        await syncDashboardData();
      } catch (error) {
        const errorMessage = `Could not initialize performance dashboard: ${getUnknownErrorMessage(error)}`;
        console.error(errorMessage, error);
        setError({
          message: errorMessage,
          retry: initializeSystem
        });
        showToast(`Data sync failed: ${errorMessage}`, 'error');
        setIsSyncing(false);
      }
    };
    initializeSystem();

    // Real-time Update Listener
    const channel = supabase.client
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lost_sales' }, () => {
        syncDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shortages' }, () => {
        syncDashboardData();
      })
      .subscribe();

    // Local Event Listener for Instant Feedback
    const handleLocalUpdate = () => syncDashboardData();
    window.addEventListener('tabarak_sales_updated', handleLocalUpdate);
    window.addEventListener('tabarak_shortages_updated', handleLocalUpdate);

    // Close dropdowns on outside click
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dashboard-dropdown-container')) {
        setIsBranchDropdownOpen(false);
        setIsDatePickerOpen(false);
        setIsExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      supabase.client.removeChannel(channel);
      window.removeEventListener('tabarak_sales_updated', handleLocalUpdate);
      window.removeEventListener('tabarak_shortages_updated', handleLocalUpdate);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [syncDashboardData]);

  // نظام الإشعارات - Toast notification system
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type: 'success' | 'error' | 'info' }>;
      setToastMessage(customEvent.detail);
      setTimeout(() => setToastMessage(null), 5000); // Auto-hide after 5 seconds
    };

    window.addEventListener('tabarak_toast', handleToast);
    return () => window.removeEventListener('tabarak_toast', handleToast);
  }, []);

  // --- Analytics & Mathematical Engines ---
  const logSales = useMemo(() => {
    return sales;
  }, [sales]);

  const filteredPerformanceLogData = useMemo(() => {
    // Sort logSales by timestamp descending FIRST to ensure consistent numbering
    const sortedLogSales = [...logSales].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const normalizedSearch = performanceLogSearch.trim().toLowerCase();

    return sortedLogSales.filter(s => {
      if (normalizedSearch) {
        const branchName = branches.find(b => b.id === s.branchId)?.name || '';
        const searchable = [
          s.productName,
          s.pharmacistName,
          s.internalCode,
          s.agentName,
          s.category,
          branchName
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(normalizedSearch)) return false;
      }

      if (!performanceLogFilter) return true;
      if (performanceLogFilter === 'no_recovery') return !s.alternativeGiven && !s.internalTransfer;
      if (performanceLogFilter === 'alt_given') return !!s.alternativeGiven;
      if (performanceLogFilter === 'transferred') return !!s.internalTransfer;
      return true;
    });
  }, [logSales, performanceLogFilter, performanceLogSearch, branches]);

  const performanceLogFilterLabel = performanceLogFilter === 'no_recovery'
    ? 'No recovery'
    : performanceLogFilter === 'alt_given'
      ? 'Alt given'
      : performanceLogFilter === 'transferred'
        ? 'Transfer'
        : 'All statuses';

  const aggregateMetrics = useMemo(() => {
    const rawTotalRevenue = sales.reduce((acc, sale) => acc + (Number(sale.totalValue) || 0), 0);
    const totalRevenue = dashboardKpis ? Number(dashboardKpis.total_lost_sales) || 0 : rawTotalRevenue;
    const totalUnits = sales.reduce((acc, sale) => acc + (Number(sale.quantity) || 0), 0);
    const rawSkuCount = new Set(sales.map(s => s.productName)).size;
    const skuCount = dashboardKpis ? Number(dashboardKpis.total_products) || 0 : rawSkuCount;
    const averageOrderLoss = sales.length > 0 ? totalRevenue / sales.length : 0;

    const categoryFrequency: Record<string, number> = {};
    sales.forEach(s => {
      const cat = s.category || 'Standard';
      categoryFrequency[cat] = (categoryFrequency[cat] || 0) + 1;
    });
    const mostImpactedCategory = Object.entries(categoryFrequency)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    const lostCustomersNo = new Set(sales.map(s =>
      s.sessionId || `${s.branchId}_${s.lostDate}_${s.lostHour}_${Math.floor(new Date(s.timestamp).getTime() / 1000)}`
    )).size;

    const avgLossPerCustomer = lostCustomersNo > 0 ? totalRevenue / lostCustomersNo : 0;

    const altSales = sales.filter(s => !!s.alternativeGiven);
    const altCount = altSales.length;
    const altRevenue = altSales.reduce((acc, s) => acc + (Number(s.totalValue) || 0), 0);
    const altPercentage = sales.length > 0 ? (altCount / sales.length) * 100 : 0;

    const transferSales = sales.filter(s => !!s.internalTransfer);
    const transferCount = transferSales.length;
    const transferRevenue = transferSales.reduce((acc, s) => acc + (Number(s.totalValue) || 0), 0);
    const transferPercentage = sales.length > 0 ? (transferCount / sales.length) * 100 : 0;

    const recoveredSales = sales.filter(s => !!s.alternativeGiven || !!s.internalTransfer);
    const recoveryCount = recoveredSales.length;
    const recoveryRevenue = recoveredSales.reduce((acc, s) => acc + (Number(s.totalValue) || 0), 0);
    const recoveryPercentage = sales.length > 0 ? (recoveryCount / sales.length) * 100 : 0;
    const recoveryValueShare = totalRevenue > 0 ? (recoveryRevenue / totalRevenue) * 100 : 0;

    const noRecoverySales = sales.filter(s => !s.alternativeGiven && !s.internalTransfer);
    const noRecoveryCount = noRecoverySales.length;
    const noRecoveryRevenue = noRecoverySales.reduce((acc, s) => acc + (Number(s.totalValue) || 0), 0);
    const noRecoveryPercentage = sales.length > 0 ? (noRecoveryCount / sales.length) * 100 : 0;

    return {
      totalRevenue,
      totalUnits,
      incidentCount: sales.length,
      skuCount,
      averageOrderLoss,
      mostImpactedCategory,
      lostCustomersNo,
      avgLossPerCustomer,
      altCount,
      altRevenue,
      altPercentage,
      transferCount,
      transferRevenue,
      transferPercentage,
      recoveryCount,
      recoveryRevenue,
      recoveryPercentage,
      recoveryValueShare,
      noRecoveryCount,
      noRecoveryRevenue,
      noRecoveryPercentage
    };
  }, [sales, dashboardKpis]);

  const paretoAnalysis = useMemo(() => {
    const productMap: Record<string, {
      total: number;
      count: number;
      incidents: number;
      category: string;
      agentName: string;
      branchIds: Set<string>;
    }> = {};

    sales.forEach(s => {
      const productName = s.productName || 'Unnamed Product';
      if (!productMap[productName]) {
        productMap[productName] = {
          total: 0,
          count: 0,
          incidents: 0,
          category: s.category || 'Uncategorized',
          agentName: s.agentName || 'Unassigned Agent',
          branchIds: new Set()
        };
      }

      productMap[productName].total += (Number(s.totalValue) || 0);
      productMap[productName].count += (Number(s.quantity) || 0);
      productMap[productName].incidents += 1;
      productMap[productName].branchIds.add(s.branchId);

      if (s.category && productMap[productName].category === 'Uncategorized') {
        productMap[productName].category = s.category;
      }
      if (s.agentName && productMap[productName].agentName === 'Unassigned Agent') {
        productMap[productName].agentName = s.agentName;
      }
    });

    const sortedImpact = Object.entries(productMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, data]) => ({
        name,
        total: data.total,
        count: data.count,
        incidents: data.incidents,
        category: data.category,
        agentName: data.agentName,
        branchCount: data.branchIds.size
      }));

    const totalLossPool = sortedImpact.reduce((acc, item) => acc + item.total, 0);
    let runningSum = 0;

    return sortedImpact.map(item => {
      runningSum += item.total;
      const cumulativePercentage = (runningSum / (totalLossPool || 1)) * 100;
      const share = totalLossPool > 0 ? (item.total / totalLossPool) * 100 : 0;
      return {
        ...item,
        share,
        averageValue: item.incidents > 0 ? item.total / item.incidents : 0,
        isPriority: cumulativePercentage <= 80
      };
    });
  }, [sales]);

  const lossDriverFilterOptions = useMemo(() => {
    const maxValue = Math.max(...paretoAnalysis.map(item => item.total), 0);
    const averageIncidents = paretoAnalysis.length
      ? paretoAnalysis.reduce((sum, item) => sum + item.incidents, 0) / paretoAnalysis.length
      : 0;
    const isHighValue = (item: typeof paretoAnalysis[number]) => maxValue > 0 && item.total >= maxValue * 0.5;
    const isFrequent = (item: typeof paretoAnalysis[number]) => item.incidents >= Math.max(1, Math.ceil(averageIncidents));

    return [
      { id: 'priority' as const, label: 'Priority', count: paretoAnalysis.filter(item => item.isPriority).length },
      { id: 'high_value' as const, label: 'High Value', count: paretoAnalysis.filter(isHighValue).length },
      { id: 'frequent' as const, label: 'Frequent', count: paretoAnalysis.filter(isFrequent).length },
      { id: 'all' as const, label: 'All', count: paretoAnalysis.length }
    ];
  }, [paretoAnalysis]);

  const filteredLossDrivers = useMemo(() => {
    const maxValue = Math.max(...paretoAnalysis.map(item => item.total), 0);
    const averageIncidents = paretoAnalysis.length
      ? paretoAnalysis.reduce((sum, item) => sum + item.incidents, 0) / paretoAnalysis.length
      : 0;
    const normalizedSearch = lossDriverSearch.trim().toLowerCase();

    return paretoAnalysis.filter(item => {
      const matchesSearch = !normalizedSearch
        || item.name.toLowerCase().includes(normalizedSearch)
        || item.category.toLowerCase().includes(normalizedSearch)
        || item.agentName.toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) return false;
      if (lossDriverFilter === 'priority') return item.isPriority;
      if (lossDriverFilter === 'high_value') return maxValue > 0 && item.total >= maxValue * 0.5;
      if (lossDriverFilter === 'frequent') return item.incidents >= Math.max(1, Math.ceil(averageIncidents));
      return true;
    });
  }, [paretoAnalysis, lossDriverFilter, lossDriverSearch]);

  const lossDriverPageCount = Math.max(1, Math.ceil(filteredLossDrivers.length / 5));
  const visibleLossDrivers = filteredLossDrivers.slice((paretoPage - 1) * 5, paretoPage * 5);

  useEffect(() => {
    setParetoPage(page => Math.min(page, lossDriverPageCount));
  }, [lossDriverPageCount]);

  const geographicDistribution = useMemo(() => {
    const nodeMap: Record<string, number> = {};
    sales.forEach(s => {
      const branchName = branches.find(b => b.id === s.branchId)?.name || 'Ghost Node';
      nodeMap[branchName] = (nodeMap[branchName] || 0) + (Number(s.totalValue) || 0);
    });
    return Object.entries(nodeMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [sales, branches]);

  const performanceTrend = useMemo(() => {
    const trendCounts: Record<string, { value: number, count: number, sessions: Set<string>, _ts: string }> = {};

    sales.forEach(s => {
      const dateStr = new Date(s.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      const sessionId = s.sessionId || `${s.branchId}_${s.lostDate}_${s.lostHour}_${Math.floor(new Date(s.timestamp).getTime() / 1000)}`;

      if (!trendCounts[dateStr]) {
        trendCounts[dateStr] = { value: 0, count: 0, sessions: new Set(), _ts: s.timestamp };
      }
      trendCounts[dateStr].value += Number(s.totalValue);
      trendCounts[dateStr].sessions.add(sessionId);
    });

    return Object.entries(trendCounts)
      .map(([name, data]) => ({
        name,
        value: data.value,
        count: data.sessions.size,
        _ts: data._ts
      }))
      .sort((a, b) => new Date(a._ts).getTime() - new Date(b._ts).getTime())
      .map(({ name, value, count }) => ({ name, value, count }));
  }, [sales]);

  const operationalTrendSummary = useMemo(() => {
    const totalImpact = performanceTrend.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    const totalSessions = performanceTrend.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
    const peakDay = performanceTrend.reduce<{ name: string; value: number; count: number } | null>((peak, item) => {
      const value = Number(item.value) || 0;
      const count = Number(item.count) || 0;
      return !peak || value > peak.value ? { name: item.name, value, count } : peak;
    }, null);
    const firstValue = Number(performanceTrend[0]?.value) || 0;
    const lastValue = Number(performanceTrend[performanceTrend.length - 1]?.value) || 0;
    const deltaAbs = lastValue - firstValue;
    const delta = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
    const lowDay = performanceTrend.reduce<{ name: string; value: number; count: number } | null>((low, item) => {
      const value = Number(item.value) || 0;
      const count = Number(item.count) || 0;
      return !low || value < low.value ? { name: item.name, value, count } : low;
    }, null);

    return {
      totalImpact,
      totalSessions,
      averageImpact: totalSessions > 0 ? totalImpact / totalSessions : 0,
      peakDay,
      lowDay,
      firstValue,
      lastValue,
      deltaAbs,
      delta,
      dayCount: performanceTrend.length,
      trendLabel: delta > 0 ? 'Rising exposure' : delta < 0 ? 'Exposure cooling' : 'Flat exposure'
    };
  }, [performanceTrend]);

  // تصفية النقص بناءً على الحالة المحددة - Memoized filtered shortages
  const filteredShortages = useMemo(() => {
    if (!shortageStatusFilter) return shortages;
    return shortages.filter(s => s.status === shortageStatusFilter);
  }, [shortages, shortageStatusFilter]);

  const shortageMetrics = useMemo(() => {
    const lowCount = shortages.filter(s => s.status === 'Low').length;
    const criticalCount = shortages.filter(s => s.status === 'Critical').length;
    const outOfStockCount = shortages.filter(s => s.status === 'Out of Stock').length;
    const totalCount = dashboardKpis ? Number(dashboardKpis.total_shortages) || 0 : shortages.length;
    const uniqueSkuCount = dashboardKpis ? Number(dashboardKpis.total_products) || 0 : new Set(shortages.map(s => s.productName)).size;
    const salesProductSet = new Set(sales.map(s => s.productName));
    const lostSaleLinkedCount = shortages.filter(s => salesProductSet.has(s.productName)).length;
    const lostSaleLinkedPercentage = totalCount > 0 ? (lostSaleLinkedCount / totalCount) * 100 : 0;
    const activeRiskCount = criticalCount + outOfStockCount;
    const riskScore = totalCount > 0
      ? Math.round(((lowCount * 1) + (criticalCount * 2) + (outOfStockCount * 3)) / (totalCount * 3) * 100)
      : 0;

    // Top Products in Shortage
    const productFrequency: Record<string, number> = {};
    shortages.forEach(s => {
      productFrequency[s.productName] = (productFrequency[s.productName] || 0) + 1;
    });
    const topProducts = Object.entries(productFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([name, count]) => ({
        name,
        count,
        isPriority: salesProductSet.has(name) || count >= 3
      }));

    // Shortage by Branch
    const branchDistribution: Record<string, number> = {};
    shortages.forEach(s => {
      const bName = branches.find(b => b.id === s.branchId)?.name || 'Unknown';
      branchDistribution[bName] = (branchDistribution[bName] || 0) + 1;
    });
    const topBranch = Object.entries(branchDistribution).sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];

    // Shortage by Pharmacist
    const pharmacistActivity: Record<string, number> = {};
    shortages.forEach(s => {
      pharmacistActivity[s.pharmacistName] = (pharmacistActivity[s.pharmacistName] || 0) + 1;
    });
    const topPharmacist = Object.entries(pharmacistActivity).sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];

    // Shortage Trend (Temporal Distribution)
    const trendCounts: Record<string, { total: number, low: number, critical: number, oos: number, _ts: string }> = {};
    shortages.forEach(s => {
      const dateStr = new Date(s.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      if (!trendCounts[dateStr]) trendCounts[dateStr] = { total: 0, low: 0, critical: 0, oos: 0, _ts: s.timestamp };
      trendCounts[dateStr].total += 1;
      if (s.status === 'Low') trendCounts[dateStr].low += 1;
      else if (s.status === 'Critical') trendCounts[dateStr].critical += 1;
      else if (s.status === 'Out of Stock') trendCounts[dateStr].oos += 1;
    });

    const trendTimeline = Object.entries(trendCounts)
      .map(([name, data]) => ({
        name,
        ...data
      }))
      .sort((a, b) => new Date(a._ts).getTime() - new Date(b._ts).getTime())
      .map(({ name, total, low, critical, oos }) => ({ name, total, low, critical, oos }));

    // Avg Time in Critical Status (Simplified Estimate)
    let totalCriticalDurationMs = 0;
    let criticalCaseCount = 0;
    shortages.forEach(s => {
      if (s.history && s.history.length > 0) {
        const sortedHistory = [...s.history].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        sortedHistory.forEach((h, idx) => {
          if (h.status === 'Critical') {
            const next = sortedHistory[idx + 1];
            const start = new Date(h.timestamp).getTime();
            const end = next ? new Date(next.timestamp).getTime() : new Date().getTime();
            totalCriticalDurationMs += (end - start);
            criticalCaseCount++;
          }
        });
        // Check current status too
        if (s.status === 'Critical') {
          const lastH = sortedHistory[sortedHistory.length - 1];
          // If status was updated to critical in last history entry
          if (lastH && lastH.status === 'Critical') {
            // Already handled in loop
          } else if (s.timestamp) { // If it just became critical
            const start = new Date(s.timestamp).getTime();
            const end = new Date().getTime();
            totalCriticalDurationMs += (end - start);
            criticalCaseCount++;
          }
        }
      } else if (s.status === 'Critical') {
        const start = new Date(s.timestamp).getTime();
        const end = new Date().getTime();
        totalCriticalDurationMs += (end - start);
        criticalCaseCount++;
      }
    });
    const avgCriticalHours = criticalCaseCount > 0 ? (totalCriticalDurationMs / (1000 * 60 * 60)) / criticalCaseCount : 0;


    return {
      totalCount,
      uniqueSkuCount,
      lowCount,
      criticalCount,
      outOfStockCount,
      activeRiskCount,
      riskScore,
      lostSaleLinkedCount,
      lostSaleLinkedPercentage,
      topBranch,
      topPharmacist,
      topProducts,
      branchDistribution,
      pharmacistActivity,
      avgCriticalHours,
      trendTimeline
    };
  }, [shortages, branches, sales, allSales, dashboardKpis]);


  // --- Operational Handlers ---

  const applyExportCursor = (query: any, cursor: { timestamp: string; id: string } | null) => {
    if (!cursor?.timestamp || !cursor.id) return query;
    const timestamp = new Date(cursor.timestamp).toISOString();
    return query.or(`timestamp.lt.${timestamp},and(timestamp.eq.${timestamp},id.lt.${cursor.id})`);
  };

  const sanitizeExportFilePart = (value: string) =>
    value
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'Branch';

  const canExportAllVisibleBranches =
    isManagerRole(user.role) || user.role === 'supervisor' || user.role === 'warehouse';

  const resolveExportScope = async (): Promise<ExportScope> => {
    if (canExportAllVisibleBranches) {
      if (selectedBranch === 'all') {
        const visibleBranchIds = branches
          .map(branch => branch.id)
          .filter(Boolean);
        const supervisorBranchIds = user.role === 'supervisor' && supervisorUsesAssignedScope && visibleBranchIds.length === 0
          ? await getSupervisorBranchIds()
          : visibleBranchIds;
        return {
          branchId: null,
          branchIds: supervisorBranchIds,
          label: user.role === 'supervisor' && supervisorUsesAssignedScope ? 'Assigned Branches' : 'All Branches',
          filePart: user.role === 'supervisor' && supervisorUsesAssignedScope ? 'Assigned_Branches' : 'All_Branches',
          isAllBranches: true
        };
      }

      const branchName = mapBranchName(branches.find(b => b.id === selectedBranch)?.name || 'Selected Branch');
      return {
        branchId: selectedBranch,
        label: branchName,
        filePart: sanitizeExportFilePart(branchName),
        isAllBranches: false
      };
    }

    if (user.role === 'branch') {
      const branchName = mapBranchName(user.name || user.code || 'Branch');
      return {
        branchId: user.id,
        label: branchName,
        filePart: sanitizeExportFilePart(branchName),
        isAllBranches: false
      };
    }

    if (selectedBranch && selectedBranch !== 'all') {
      const branchName = mapBranchName(branches.find(b => b.id === selectedBranch)?.name || 'Selected Branch');
      return {
        branchId: selectedBranch,
        label: branchName,
        filePart: sanitizeExportFilePart(branchName),
        isAllBranches: false
      };
    }

    throw new Error('Only admin, supervisor, and warehouse accounts can export all visible branches. Select one branch before exporting.');
  };

  const applyExportFilters = (query: any, scope: ExportScope, branchIdOverride?: string | null) => {
    const { start, end } = getDateRange(dateType, startDate, endDate);
    if (start) query = query.gte('timestamp', start.toISOString());
    if (end) query = query.lte('timestamp', end.toISOString());
    const branchId = branchIdOverride ?? scope.branchId;
    if (branchId) query = query.eq('branch_id', branchId);
    return query;
  };

  const getExportDateBounds = () => {
    const { start, end } = getDateRange(dateType, startDate, endDate);
    const toDateParam = (value: Date) => value.toISOString().slice(0, 10);
    return {
      dateFrom: toDateParam(start || new Date('1900-01-01T00:00:00.000Z')),
      dateTo: toDateParam(end || new Date())
    };
  };

  const isMissingExportRpcError = (error: any) => {
    const message = String(error?.message || '');
    return error?.code === 'PGRST202'
      || error?.code === '42883'
      || /export_shortages_paginated|schema cache|function/i.test(message);
  };

  const fetchShortagesExportRowsViaRpc = async (branchId: string) => {
    const PAGE_SIZE = 1000;
    const { dateFrom, dateTo } = getExportDateBounds();
    const rows: any[] = [];
    let cursor: string | null = null;

    while (true) {
      const { data, error } = await supabase.client.rpc('export_shortages_paginated', {
        p_branch_id: branchId,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_cursor: cursor,
        p_limit: PAGE_SIZE,
      });

      if (error) {
        if (isMissingExportRpcError(error)) return null;
        throw error;
      }
      if (!data || data.length === 0) break;
      rows.push(...data);
      cursor = data[data.length - 1]?.id || null;
      if (data.length < PAGE_SIZE || !cursor) break;
    }

    return rows;
  };

  const fetchExportTableRows = async (
    tableName: 'lost_sales_excel_export' | 'shortages_excel_export',
    scope: ExportScope,
    branchIdOverride?: string | null
  ) => {
    const effectiveBranchId = branchIdOverride ?? scope.branchId;
    if (tableName === 'shortages_excel_export' && effectiveBranchId) {
      const rpcRows = await fetchShortagesExportRowsViaRpc(effectiveBranchId);
      if (rpcRows) return rpcRows;
    }

    const PAGE_SIZE = 1000;
    const rows: any[] = [];
    let cursor: { timestamp: string; id: string } | null = null;

    while (true) {
      let query = applyExportFilters(
        supabase.client.from(tableName).select('*'),
        scope,
        branchIdOverride
      );
      query = applyExportCursor(query, cursor);
      const { data, error } = await query
        .order('timestamp', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows.push(...data);
      const last = data[data.length - 1];
      if (data.length < PAGE_SIZE || !last?.timestamp || !last?.id) break;
      cursor = { timestamp: last.timestamp, id: last.id };
    }

    return rows;
  };

  const fetchExportRows = async (
    tableName: 'lost_sales_excel_export' | 'shortages_excel_export',
    scope: ExportScope
  ) => {
    const scopedBranchIds = scope.branchIds?.filter(Boolean) || [];
    if (scopedBranchIds.length > 0) {
      const rows: any[] = [];
      for (const branchId of scopedBranchIds) {
        rows.push(...await fetchExportTableRows(tableName, scope, branchId));
      }
      return rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    if (scope.isAllBranches && user.role === 'supervisor' && supervisorUsesAssignedScope) {
      return [];
    }

    return fetchExportTableRows(tableName, scope);
  };

  const styleWorksheetHeader = (worksheet: any) => {
    worksheet.getRow(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    worksheet.getRow(1).alignment = { horizontal: 'center' };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: worksheet.columnCount }
    };
  };

  const exportLostSales = async () => {
    // استخدام حالة منفصلة للتصدير
    setIsExporting(true);
    setIsExportDropdownOpen(false);
    try {
      const workbook = await createExcelWorkbook();
      const exportScope = await resolveExportScope();
      const viewData = await fetchExportRows('lost_sales_excel_export', exportScope);

      if (!viewData || viewData.length === 0) {
        showToast("No data passed the filter to export.", 'info');
        return;
      }

      // --- TAB 1: ALL RECORDS (Raw Data) ---
      const worksheet = workbook.addWorksheet('All Records');
      worksheet.columns = [
        { header: 'Internal Code', key: 'internal_code', width: 22 },
        { header: 'Product Name', key: 'product_name', width: 45 },
        { header: 'Date', key: 'lost_date', width: 14 },
        { header: 'Time', key: 'timestamp', width: 14 },
        { header: 'Branch', key: 'branch_name', width: 25 },
        { header: 'Qty', key: 'quantity', width: 10 },
        { header: 'Price (BHD)', key: 'unit_price', width: 18, style: { numFmt: '0.000' } },
        { header: 'Total (BHD)', key: 'total_value', width: 18, style: { numFmt: '0.000' } },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Agent Code / Name', key: 'agent_name', width: 25 },
        { header: 'Alternative Given', key: 'alternative_given', width: 20 },
        { header: 'Internal Transfer', key: 'internal_transfer', width: 20 },
        { header: 'Remarks', key: 'notes', width: 35 },
        { header: 'Pharmacist', key: 'pharmacist_name', width: 25 },
      ];

      viewData.forEach((s: any) => {
        const dateObj = new Date(s.timestamp);
        worksheet.addRow({
          internal_code: s.internal_code || 'N/A',
          product_name: s.product_name,
          lost_date: s.lost_date,
          timestamp: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          branch_name: mapBranchName(s.branch_name || 'Unknown'),
          quantity: s.quantity,
          unit_price: Number(s.unit_price || 0),
          total_value: Number(s.total_value || 0),
          category: s.category || 'General',
          agent_name: s.agent_name || 'N/A',
          alternative_given: s.alternative_given ? 'Yes' : 'No',
          internal_transfer: s.internal_transfer ? 'Yes' : 'No',
          notes: s.notes || '',
          pharmacist_name: s.pharmacist_name || 'N/A'
        });
      });

      const totalLoss = viewData.reduce((acc: number, s: any) => acc + Number(s.total_value || 0), 0);
      const sumRow = worksheet.addRow({ internal_code: 'TOTAL AGGREGATE LOSS', total_value: totalLoss });
      const labelCell = sumRow.getCell(1);
      const valueCell = sumRow.getCell(8);
      [labelCell, valueCell].forEach(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
        c.font = { bold: true, size: 12 };
      });

      // --- TAB 2: LOST SALE LIST PER ITEM (Aggregated) ---
      const aggregatedSheet = workbook.addWorksheet('Lost sale list per item');
      aggregatedSheet.columns = [
        { header: 'Internal Code', key: 'internal_code', width: 22 },
        { header: 'Product Name', key: 'product_name', width: 45 },
        { header: 'Agent Name', key: 'agent_name', width: 30 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Total Qty Lost', key: 'quantity', width: 15 },
        { header: 'Total Value (BHD)', key: 'total_value', width: 20, style: { numFmt: '0.000' } },
      ];

      const productAggregation: Record<string, {
        internal_code: string,
        agent_name: string,
        category: string,
        quantity: number,
        total_value: number
      }> = {};

      viewData.forEach((s: any) => {
        const key = s.product_name.trim(); // Group by Name
        if (!productAggregation[key]) {
          productAggregation[key] = {
            internal_code: s.internal_code || 'N/A',
            agent_name: s.agent_name || 'N/A',
            category: s.category || 'General',
            quantity: 0,
            total_value: 0
          };
        }
        productAggregation[key].quantity += Number(s.quantity || 0);
        productAggregation[key].total_value += Number(s.total_value || 0);
      });

      Object.entries(productAggregation)
        .sort((a, b) => b[1].quantity - a[1].quantity) // Sort by Quantity Descending
        .forEach(([productName, stats]) => {
          aggregatedSheet.addRow({
            internal_code: stats.internal_code,
            product_name: productName,
            agent_name: stats.agent_name,
            category: stats.category,
            quantity: stats.quantity,
            total_value: stats.total_value
          });
        });

      // Style Header for Tab 2
      styleWorksheetHeader(aggregatedSheet);

      // --- TAB 3: LOSS BY AGENT ---
      const agentSheet = workbook.addWorksheet('Loss by Agent');
      agentSheet.columns = [
        { header: 'Agent Name', key: 'agentName', width: 40 },
        { header: 'Units Lost', key: 'itemsCount', width: 15 },
        { header: 'Total Value (BHD)', key: 'totalValue', width: 20, style: { numFmt: '0.000' } },
      ];
      const agentStats: Record<string, { count: number; value: number }> = {};
      viewData.forEach((s: any) => {
        const agent = s.agent_name || 'N/A';
        if (!agentStats[agent]) agentStats[agent] = { count: 0, value: 0 };
        agentStats[agent].count += Number(s.quantity || 0);
        agentStats[agent].value += Number(s.total_value || 0);
      });
      Object.entries(agentStats).sort((a, b) => b[1].value - a[1].value).forEach(([name, stats]) => {
        agentSheet.addRow({ agentName: name, itemsCount: stats.count, totalValue: stats.value });
      });
      styleWorksheetHeader(agentSheet);

      // --- TAB 4: RANKING (Branches & Pharmacists) ---
      const rankingSheet = workbook.addWorksheet('Ranking');

      // Branch Ranking
      rankingSheet.addRow(['BRANCH RANKING (BY REVENUE LOSS)']).font = { bold: true, size: 12 };
      rankingSheet.addRow(['Rank', 'Branch Name', 'Frequency', 'Total Value (BHD)']).font = { bold: true };

      const branchStats: Record<string, { count: number, value: number }> = {};
      viewData.forEach((s: any) => {
        const bName = mapBranchName(s.branch_name || 'Unknown');
        if (!branchStats[bName]) branchStats[bName] = { count: 0, value: 0 };
        branchStats[bName].count++;
        branchStats[bName].value += Number(s.total_value || 0);
      });

      Object.entries(branchStats)
        .sort((a, b) => b[1].value - a[1].value)
        .forEach(([name, stats], idx) => {
          rankingSheet.addRow([idx + 1, name, stats.count, stats.value.toFixed(3)]);
        });

      rankingSheet.addRow([]); // Gap

      // Pharmacist Ranking
      rankingSheet.addRow(['PHARMACIST RANKING (BY ACTIVITY)']).font = { bold: true, size: 12 };
      rankingSheet.addRow(['Rank', 'Pharmacist Name', 'Branch', 'Incidents', 'Total BHD Recorded']).font = { bold: true };

      const pharmaStats: Record<string, { name: string, branch: string, count: number, value: number }> = {};
      viewData.forEach((s: any) => {
        const branchName = mapBranchName(s.branch_name || 'N/A');
        const key = `${s.pharmacist_name}_${branchName}`;
        if (!pharmaStats[key]) pharmaStats[key] = { name: s.pharmacist_name || 'N/A', branch: branchName, count: 0, value: 0 };
        pharmaStats[key].count++;
        pharmaStats[key].value += Number(s.total_value || 0);
      });

      Object.values(pharmaStats)
        .sort((a, b) => b.count - a.count)
        .forEach((p, idx) => {
          rankingSheet.addRow([idx + 1, p.name, p.branch, p.count, p.value.toFixed(3)]);
        });

      rankingSheet.columns.forEach(col => col.width = 25);

      // Finalize Lost Sales Tab
      styleWorksheetHeader(worksheet);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Tabarak_Lost_Sales_${exportScope.filePart}_${new Date().toISOString().split('T')[0]}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export Error:", err);
      const errorMsg = getUnknownErrorMessage(err, 'Unknown error');
      showToast(`Extraction failed: ${errorMsg}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const exportShortage = async () => {
    setIsExporting(true);
    setIsExportDropdownOpen(false);
    try {
      const workbook = await createExcelWorkbook();
      const exportScope = await resolveExportScope();
      const viewData = await fetchExportRows('shortages_excel_export', exportScope);
      if (!viewData || viewData.length === 0) {
        showToast("No shortages found for this period.", 'info');
        return;
      }

      // --- Helper to Create Sheet ---
      const createSheet = (sheetName: string, data: any[]) => {
        const worksheet = workbook.addWorksheet(sheetName);
        worksheet.columns = [
          { header: 'Internal Code', key: 'internal_code', width: 22 },
          { header: 'Product Name', key: 'product_name', width: 45 },
          { header: 'Category', key: 'category', width: 25 },
          { header: 'Agent Name', key: 'agent_name', width: 30 },
          { header: 'Reporting Branch', key: 'branch_name', width: 30 },
          { header: 'Pharmacist', key: 'pharmacist_name', width: 30 },
          { header: 'Current Status', key: 'status', width: 20 },
          { header: 'Logged Date', key: 'date', width: 15 },
          { header: 'Logged Time', key: 'time', width: 15 },
          { header: 'Requested Qty', key: 'requestedQty', width: 18 },
          { header: 'Remarks', key: 'notes', width: 35 },
        ];

        data.forEach((sh: any) => {
          const dateObj = new Date(sh.timestamp);
          worksheet.addRow({
            internal_code: sh.internal_code || 'N/A',
            product_name: sh.product_name,
            category: sh.category || 'General',
            agent_name: sh.agent_name || 'N/A',
            branch_name: mapBranchName(sh.branch_name || 'Unknown'),
            pharmacist_name: sh.pharmacist_name,
            status: sh.status,
            date: dateObj.toLocaleDateString(),
            time: dateObj.toLocaleTimeString(),
            requestedQty: '',
            notes: sh.notes || ''
          });
        });

        styleWorksheetHeader(worksheet);
      };

      // --- Filter Data for Store Tabs ---
      const medicineCategories = ['supplements', 'medicine', 'derma', 'medical device'];
      const generalCategories = ['general items', 'milk', 'services', 'supports', 'unknown'];

      const medicineData = viewData.filter((s: any) => medicineCategories.includes((s.category || '').toLowerCase()));
      const generalData = viewData.filter((s: any) => generalCategories.includes((s.category || '').toLowerCase()));
      const otherData = viewData.filter((s: any) => {
        const category = (s.category || '').toLowerCase();
        return !medicineCategories.includes(category) && !generalCategories.includes(category);
      });

      // TAB 1: ALL SHORTAGES (Master List)
      createSheet('All Shortages', viewData);

      // TAB 2: MEDICINE STORE
      createSheet('Medicine Store', medicineData);

      // TAB 3: GENERAL STORE
      createSheet('General Store', generalData);

      // TAB 4: OTHER CATEGORIES (keeps unmatched categories visible instead of hiding them)
      createSheet('Other Categories', otherData);

      // TAB 5: RANKING (Branches & Pharmacists)
      const rankingSheet = workbook.addWorksheet('Ranking');

      // Branch Ranking
      rankingSheet.addRow(['BRANCH RANKING (BY SHORTAGE REPORTS)']).font = { bold: true, size: 12 };
      rankingSheet.addRow(['Rank', 'Branch Name', 'Report Count']).font = { bold: true };

      const branchStats: Record<string, number> = {};
      viewData.forEach((s: any) => {
        const bName = mapBranchName(s.branch_name || 'Unknown');
        branchStats[bName] = (branchStats[bName] || 0) + 1;
      });

      Object.entries(branchStats)
        .sort((a, b) => b[1] - a[1])
        .forEach(([name, count], idx) => {
          rankingSheet.addRow([idx + 1, name, count]);
        });

      rankingSheet.addRow([]); // Gap

      // Pharmacist Ranking
      rankingSheet.addRow(['PHARMACIST RANKING (BY REVEALING SHORTAGES)']).font = { bold: true, size: 12 };
      rankingSheet.addRow(['Rank', 'Pharmacist Name', 'Branch', 'Report Count']).font = { bold: true };

      const pharmaStats: Record<string, { name: string, branch: string, count: number }> = {};
      viewData.forEach((s: any) => {
        const branchName = mapBranchName(s.branch_name || 'N/A');
        const key = `${s.pharmacist_name}_${branchName}`;
        if (!pharmaStats[key]) pharmaStats[key] = { name: s.pharmacist_name || 'N/A', branch: branchName, count: 0 };
        pharmaStats[key].count++;
      });

      Object.values(pharmaStats)
        .sort((a, b) => b.count - a.count)
        .forEach((p, idx) => {
          rankingSheet.addRow([idx + 1, p.name, p.branch, p.count]);
        });

      rankingSheet.columns.forEach(col => col.width = 25);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Tabarak_Shortage_${exportScope.filePart}_${new Date().toISOString().split('T')[0]}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export Error:", err);
      const errorMsg = getUnknownErrorMessage(err, 'Unknown error');
      showToast(`Extraction failed: ${errorMsg}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const exportCombined = async () => {
    setIsExporting(true);
    setIsExportDropdownOpen(false);
    try {
      const workbook = await createExcelWorkbook();
      const exportScope = await resolveExportScope();

      // --- 1. FETCH SALES & SHORTAGES IN PARALLEL ---
      const [salesData, shortagesData] = await Promise.all([
        fetchExportRows('lost_sales_excel_export', exportScope),
        fetchExportRows('shortages_excel_export', exportScope),
      ]);

      // --- TAB 1: LOST SALES (Powered by View) ---
      const lostSalesSheet = workbook.addWorksheet('Lost Sales');
      lostSalesSheet.columns = [
        { header: 'Internal Code', key: 'internal_code', width: 22 },
        { header: 'Product Name', key: 'product_name', width: 45 },
        { header: 'Date', key: 'lost_date', width: 14 },
        { header: 'Time', key: 'timestamp', width: 14 },
        { header: 'Branch', key: 'branch_name', width: 25 },
        { header: 'Qty', key: 'quantity', width: 10 },
        { header: 'Price (BHD)', key: 'unit_price', width: 18, style: { numFmt: '0.000' } },
        { header: 'Total (BHD)', key: 'total_value', width: 18, style: { numFmt: '0.000' } },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Agent Code / Name', key: 'agent_name', width: 25 },
        { header: 'Alternative Given', key: 'alternative_given', width: 20 },
        { header: 'Internal Transfer', key: 'internal_transfer', width: 20 },
        { header: 'Remarks', key: 'notes', width: 35 },
        { header: 'Pharmacist', key: 'pharmacist_name', width: 25 },
      ];

      if (salesData) {
        salesData.forEach((s: any) => {
          const dateObj = new Date(s.timestamp);
          lostSalesSheet.addRow({
            internal_code: s.internal_code || 'N/A',
            product_name: s.product_name,
            lost_date: s.lost_date,
            timestamp: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            branch_name: mapBranchName(s.branch_name || 'Unknown'),
            quantity: s.quantity,
            unit_price: Number(s.unit_price || 0),
            total_value: Number(s.total_value || 0),
            category: s.category || 'General',
            agent_name: s.agent_name || 'N/A',
            alternative_given: s.alternative_given ? 'Yes' : 'No',
            internal_transfer: s.internal_transfer ? 'Yes' : 'No',
            notes: s.notes || '',
            pharmacist_name: s.pharmacist_name || 'N/A'
          });
        });

        const totalLoss = salesData.reduce((acc: number, s: any) => acc + Number(s.total_value || 0), 0);
        const sumRow = lostSalesSheet.addRow({ internal_code: 'TOTAL AGGREGATE LOSS', total_value: totalLoss });
        const labelCell = sumRow.getCell(1);
        const valueCell = sumRow.getCell(8);
        [labelCell, valueCell].forEach(c => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
          c.font = { bold: true, size: 12 };
        });
      }

      styleWorksheetHeader(lostSalesSheet);

      // --- TAB 2: LOSS BY AGENT (Powered by View) ---
      const agentSheet = workbook.addWorksheet('Loss by Agent');
      agentSheet.columns = [
        { header: 'Agent Name', key: 'agentName', width: 40 },
        { header: 'Units Lost', key: 'itemsCount', width: 15 },
        { header: 'Total Value (BHD)', key: 'totalValue', width: 20, style: { numFmt: '0.000' } },
      ];
      const agentStats: Record<string, { count: number; value: number }> = {};
      if (salesData) {
        salesData.forEach((s: any) => {
          const agent = s.agent_name || 'N/A';
          if (!agentStats[agent]) agentStats[agent] = { count: 0, value: 0 };
          agentStats[agent].count += Number(s.quantity || 0);
          agentStats[agent].value += Number(s.total_value || 0);
        });
      }
      Object.entries(agentStats).sort((a, b) => b[1].value - a[1].value).forEach(([name, stats]) => {
        agentSheet.addRow({ agentName: name, itemsCount: stats.count, totalValue: stats.value });
      });
      styleWorksheetHeader(agentSheet);

      // --- TAB 3: INVENTORY SHORTAGES (Powered by View) ---
      const shortageSheet = workbook.addWorksheet('Inventory Shortages');
      shortageSheet.columns = [
        { header: 'Internal Code', key: 'internal_code', width: 22 },
        { header: 'Product Name', key: 'product_name', width: 45 },
        { header: 'Category', key: 'category', width: 25 },
        { header: 'Agent Name', key: 'agent_name', width: 30 },
        { header: 'Reporting Branch', key: 'branch_name', width: 30 },
        { header: 'Pharmacist', key: 'pharmacist_name', width: 30 },
        { header: 'Current Status', key: 'status', width: 20 },
        { header: 'Logged Date', key: 'date', width: 15 },
        { header: 'Logged Time', key: 'time', width: 15 },
        { header: 'Requested Qty', key: 'requestedQty', width: 18 },
        { header: 'Remarks', key: 'notes', width: 35 },
      ];

      shortagesData.forEach((sh: any) => {
        const dateObj = new Date(sh.timestamp);
        shortageSheet.addRow({
          internal_code: sh.internal_code || 'N/A',
          product_name: sh.product_name,
          category: sh.category || 'General',
          agent_name: sh.agent_name || 'N/A',
          branch_name: mapBranchName(sh.branch_name || 'Unknown'),
          pharmacist_name: sh.pharmacist_name,
          status: sh.status,
          date: dateObj.toLocaleDateString(),
          time: dateObj.toLocaleTimeString(),
          requestedQty: '',
          notes: sh.notes || ''
        });
      });

      styleWorksheetHeader(shortageSheet);

      // --- TAB 4: RANKING (Branches & Pharmacists) ---
      const rankingSheet = workbook.addWorksheet('Ranking');

      // Branch Ranking (Combined focus)
      rankingSheet.addRow(['BRANCH RANKING (COMBINED ACTIVITY)']).font = { bold: true, size: 12 };
      rankingSheet.addRow(['Rank', 'Branch Name', 'Lost Sales Value', 'Shortage Reports']).font = { bold: true };

      const combinedBranchStats: Record<string, { salesVal: number, shortageCount: number }> = {};
      salesData.forEach(s => {
        const b = mapBranchName(s.branch_name || 'Unknown');
        if (!combinedBranchStats[b]) combinedBranchStats[b] = { salesVal: 0, shortageCount: 0 };
        combinedBranchStats[b].salesVal += Number(s.total_value || 0);
      });
      shortagesData.forEach(s => {
        const b = mapBranchName(s.branch_name || 'Unknown');
        if (!combinedBranchStats[b]) combinedBranchStats[b] = { salesVal: 0, shortageCount: 0 };
        combinedBranchStats[b].shortageCount++;
      });

      Object.entries(combinedBranchStats)
        .sort((a, b) => (b[1].salesVal + b[1].shortageCount) - (a[1].salesVal + a[1].shortageCount)) // Sort by combined weight
        .forEach(([name, stats], idx) => {
          rankingSheet.addRow([idx + 1, name, stats.salesVal.toFixed(3), stats.shortageCount]);
        });

      rankingSheet.addRow([]); // Gap

      // Pharmacist Ranking (Combined focus)
      rankingSheet.addRow(['PHARMACIST RANKING (COMBINED ACTIVITY)']).font = { bold: true, size: 12 };
      rankingSheet.addRow(['Rank', 'Pharmacist Name', 'Branch', 'Incidents Reported (Combined)']).font = { bold: true };

      const combinedPharmaStats: Record<string, { name: string, branch: string, count: number }> = {};
      [...salesData, ...shortagesData].forEach(s => {
        const branchName = mapBranchName(s.branch_name || 'N/A');
        const key = `${s.pharmacist_name}_${branchName}`;
        if (!combinedPharmaStats[key]) combinedPharmaStats[key] = { name: s.pharmacist_name || 'N/A', branch: branchName, count: 0 };
        combinedPharmaStats[key].count++;
      });

      Object.values(combinedPharmaStats)
        .sort((a, b) => b.count - a.count)
        .forEach((p, idx) => {
          rankingSheet.addRow([idx + 1, p.name, p.branch, p.count]);
        });

      rankingSheet.columns.forEach(col => col.width = 25);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Tabarak_Combined_Analysis_${exportScope.filePart}_${new Date().toISOString().split('T')[0]}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export Error:", err);
      const errorMsg = getUnknownErrorMessage(err, 'Unknown error');
      showToast(`Extraction failed: ${errorMsg}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };


  const activeBranchLabel = selectedBranch === 'all' ? 'CENTRAL CONSOLE' : branches.find(b => b.id === selectedBranch)?.name;
  const headerTitle = viewMode === 'standard'
    ? 'Lost Sales Tracker'
    : viewMode === 'expanded'
      ? 'Inventory Gaps'
      : 'Product Catalogue';
  const HeaderIcon = viewMode === 'products'
    ? Package
    : viewMode === 'expanded'
      ? PackageX
      : LayoutGrid;
  const branchSearchQuery = branchSearchTerm.trim().toLowerCase();
  const filteredBranches = branches.filter((branch) =>
    `${branch.name} ${branch.code}`.toLowerCase().includes(branchSearchQuery)
  );
  const activeDateLabel: Record<DashboardDateType, string> = {
    all: 'All Time',
    today: 'Today',
    yesterday: 'Yesterday',
    '7d': 'Last 7 Days',
    month: 'Last Month',
    custom: 'Custom Period'
  };
  const dateRangeOptions: Array<{ id: DashboardDateType; label: string; sub: string }> = [
    { id: 'all', label: 'All Time', sub: 'Total historical archive' },
    { id: 'today', label: 'Today', sub: 'Active duty records' },
    { id: 'yesterday', label: 'Yesterday', sub: 'Previous day performance' },
    { id: '7d', label: 'Last 7 Days', sub: 'Weekly operating window' },
    { id: 'month', label: 'Last Month', sub: '30-day fiscal cycle' },
    { id: 'custom', label: 'Choose Period', sub: 'Manual calendar range' }
  ];

    return (
      <div className="min-h-screen bg-white font-sans selection:bg-red-100">
        <div className="max-w-[1600px] mx-auto px-6 md:px-12 py-10">
          {/* --- HEADER --- */}
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm transition-all ${
                viewMode === 'products' ? 'bg-slate-900 border border-slate-800' : 'bg-red-700'
              }`}>
                <HeaderIcon size={26} strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none whitespace-nowrap">
                  {headerTitle}
                </h1>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mt-1.5">Real-time performance analytics</p>
              </div>
            </div>

            <div className="flex flex-wrap lg:flex-nowrap items-center gap-3">
              {isCanSelectBranch && (
                <div className="relative dashboard-dropdown-container">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDatePickerOpen(false);
                      setIsExportDropdownOpen(false);
                      setIsBranchDropdownOpen(!isBranchDropdownOpen);
                    }}
                    className={`group flex h-11 items-center gap-2.5 rounded-lg border px-3.5 text-left transition-all duration-200 ${
                      isBranchDropdownOpen
                        ? 'border-red-200 bg-white shadow-md shadow-red-900/5'
                        : 'border-slate-200 bg-white shadow-sm hover:border-red-200 hover:bg-red-50/30'
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      isBranchDropdownOpen ? 'bg-red-50 text-red-700 ring-1 ring-red-100' : 'bg-slate-50 text-red-700 group-hover:bg-red-50'
                    }`}>
                      <MapPin size={15} strokeWidth={2.7} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">Branch Scope</span>
                      <span className="block max-w-[150px] truncate text-[10px] font-black uppercase tracking-[0.08em] text-slate-800">{activeBranchLabel}</span>
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isBranchDropdownOpen ? 'rotate-180 text-red-700' : ''}`} />
                  </button>
                {isBranchDropdownOpen && (
                  <div className="absolute top-full right-0 z-[100] mt-2 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-900/10 animate-in zoom-in-95 duration-200">
                    <div className="border-b border-slate-100 bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-600">Branch Scope</p>
                          <p className="mt-1 truncate text-sm font-black tracking-tight text-slate-900">{activeBranchLabel}</p>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-slate-500">
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
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-red-300 focus:ring-2 focus:ring-red-50"
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
                        className={`group flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all ${
                          selectedBranch === 'all'
                            ? 'border-red-200 bg-red-50 text-red-900'
                            : 'border-transparent bg-white text-slate-900 hover:border-red-100 hover:bg-red-50/40'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                            selectedBranch === 'all' ? 'border-red-100 bg-white text-red-700' : 'border-slate-100 bg-slate-50 text-red-700'
                          }`}>
                            <MonitorCheck size={16} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-black">Global Central Console</span>
                            <span className={`mt-0.5 block text-[10px] font-bold ${
                              selectedBranch === 'all' ? 'text-red-500' : 'text-slate-400'
                            }`}>All branches combined</span>
                          </span>
                        </span>
                        {selectedBranch === 'all' ? (
                          <ShieldCheck size={17} className="shrink-0" />
                        ) : (
                          <ChevronRight size={16} className="shrink-0 text-slate-300 transition-colors group-hover:text-red-600" />
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
                            className={`group flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all ${
                              isSelected
                                ? 'border-red-200 bg-red-50 text-red-900'
                                : 'border-transparent text-slate-900 hover:border-red-100 hover:bg-red-50/40'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[10px] font-black uppercase ${
                                isSelected ? 'border-red-100 bg-white text-red-700' : 'border-slate-100 bg-slate-50 text-slate-500'
                              }`}>
                                {b.code?.slice(0, 2) || 'BR'}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-black">{b.name}</span>
                                <span className={`mt-0.5 block text-[10px] font-bold ${
                                  isSelected ? 'text-red-500' : 'text-slate-400'
                                }`}>Pharmacy branch node</span>
                              </span>
                            </span>
                            {isSelected ? (
                              <ShieldCheck size={17} className="shrink-0" />
                            ) : (
                              <ChevronRight size={16} className="shrink-0 text-slate-300 transition-colors group-hover:text-red-600" />
                            )}
                          </button>
                        );
                      })}

                      {filteredBranches.length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-7 text-center">
                          <p className="text-xs font-black text-slate-500">No branches found</p>
                          <p className="mt-1 text-[10px] font-bold text-slate-400">Try another branch name or code</p>
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

              <div className="relative dashboard-dropdown-container">
                <button
                  type="button"
                  onClick={() => {
                    setIsBranchDropdownOpen(false);
                    setIsExportDropdownOpen(false);
                    setIsDatePickerOpen(!isDatePickerOpen);
                  }}
                  className={`group flex h-11 items-center gap-2.5 rounded-lg border px-3.5 transition-all duration-200 ${
                    isDatePickerOpen
                      ? 'border-red-200 bg-white shadow-md shadow-red-900/5'
                      : 'border-slate-200 bg-white shadow-sm hover:border-red-200 hover:bg-red-50/30'
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isDatePickerOpen ? 'bg-red-50 text-red-700 ring-1 ring-red-100' : 'bg-slate-50 text-red-700 group-hover:bg-red-50'
                  }`}>
                    <CalendarDays size={15} strokeWidth={2.7} />
                  </span>
                <span className="min-w-0 text-left">
                  <span className="block text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">Date Range</span>
                  <span className="block text-[10px] font-black uppercase tracking-[0.08em] text-slate-800">{activeDateLabel[dateType]}</span>
                </span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isDatePickerOpen ? 'rotate-180 text-red-700' : ''}`} />
              </button>
              {isDatePickerOpen && (
                <div className={`absolute top-full right-0 z-[100] mt-2 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-900/10 animate-in slide-in-from-top-5 duration-200 ${dateType === 'custom' ? 'w-[330px]' : 'w-[310px]'}`}>
                  <div className="border-b border-slate-100 bg-white px-4 py-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-600">Date Range</p>
                    <p className="mt-1 text-sm font-black tracking-tight text-slate-900">{activeDateLabel[dateType]}</p>
                  </div>
                  <div className="p-3">
                  {dateType !== 'custom' ? (
                    <div className="grid grid-cols-1 gap-1">
                      {dateRangeOptions.map(t => (
                        <button key={t.id} type="button" onClick={() => {
                          // إعادة تعيين التواريخ عند التغيير من custom
                          if (dateType === 'custom' && t.id !== 'custom') {
                            setStartDate('');
                            setEndDate('');
                            setManualStart('');
                            setManualEnd('');
                          }
                          setDateType(t.id);
                          if (t.id !== 'custom') setIsDatePickerOpen(false);
                        }}
                          className={`group flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all ${
                            dateType === t.id
                              ? 'border-red-200 bg-red-50 text-red-900'
                              : 'border-transparent bg-white text-slate-900 hover:border-red-100 hover:bg-red-50/40'
                          }`}>
                          <span>
                            <span className="block text-xs font-black">{t.label}</span>
                            <span className={`mt-0.5 block text-[10px] font-bold ${dateType === t.id ? 'text-red-500' : 'text-slate-400'}`}>{t.sub}</span>
                          </span>
                          {dateType === t.id ? (
                            <ShieldCheck size={17} className="shrink-0" />
                          ) : (
                            <ChevronRight size={16} className="shrink-0 text-slate-300 transition-colors group-hover:text-red-600" />
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
                            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-red-300 focus:ring-2 focus:ring-red-50"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 ml-1 block text-[10px] font-black text-slate-500">To (DD-MM-YYYY)</label>
                          <input
                            type="text"
                            placeholder="31-01-2026"
                            value={manualEnd}
                            onChange={(e) => setManualEnd(e.target.value)}
                            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-red-300 focus:ring-2 focus:ring-red-50"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const s = parseManualDate(manualStart);
                          const e = parseManualDate(manualEnd);
                          if (s && e) {
                            setStartDate(s);
                            setEndDate(e);
                            setIsDatePickerOpen(false);
                          } else {
                            showToast("Invalid date format. Please use DD-MM-YYYY (e.g., 09-01-2026). Check month (1-12), day (1-31), and valid date.", 'error');
                          }
                        }}
                        className="w-full rounded-lg bg-red-600 p-3 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-sm shadow-red-600/20 transition-all hover:bg-red-700"
                      >
                        Confirm Period
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setManualStart('');
                          setManualEnd('');
                          setStartDate('');
                          setEndDate('');
                          setDateType('all');
                          setIsDatePickerOpen(false);
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 transition-colors hover:border-red-100 hover:bg-red-50/40 hover:text-red-600"
                      >
                        Reset Filter
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              )}
            </div>

              {isModuleEnabled('excelExport') && (
              <div className="relative dashboard-dropdown-container export-dropdown-container">
                <button
                  type="button"
                  onClick={() => {
                    setIsBranchDropdownOpen(false);
                    setIsDatePickerOpen(false);
                    setIsExportDropdownOpen(!isExportDropdownOpen);
                  }}
                  className="flex h-12 items-center gap-2.5 rounded-2xl bg-red-700 px-5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-red-700/25 transition-all hover:-translate-y-0.5 hover:bg-red-800"
                >
                <Download size={17} />
                <span>Export</span>
                <ChevronDown size={14} className={`transition-transform duration-300 ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isExportDropdownOpen && (
                <div className="absolute top-full right-0 z-[100] mt-3 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 animate-in zoom-in-95 duration-300">
                  <div className="border-b border-slate-100 bg-slate-950 px-5 py-4 text-white">
                    <p className="text-[9px] font-black uppercase tracking-[0.28em] text-red-200">Export Center</p>
                    <p className="mt-1 text-sm font-black uppercase tracking-tight">Download Excel Workbooks</p>
                  </div>
                  <div className="space-y-1.5 p-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsExportDropdownOpen(false);
                        exportLostSales();
                      }}
                      className="group flex w-full items-center justify-between rounded-2xl border border-transparent p-4 text-left text-[10px] font-black uppercase tracking-widest transition-all hover:border-red-100 hover:bg-red-50/60"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-700">
                          <Banknote size={16} />
                        </div>
                        <div>
                          <p className="text-slate-900">Lost Sales Analysis</p>
                          <p className="text-[8px] text-slate-400 font-bold normal-case tracking-normal mt-0.5">4 Tabs: Records, Item, Agent, Ranking</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-red-600 transition-colors" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsExportDropdownOpen(false);
                        exportShortage();
                      }}
                      className="group flex w-full items-center justify-between rounded-2xl border border-transparent p-4 text-left text-[10px] font-black uppercase tracking-widest transition-all hover:border-amber-100 hover:bg-amber-50/70"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                          <PackageX size={16} />
                        </div>
                        <div>
                          <p className="text-slate-900">Shortage Analysis</p>
                          <p className="text-[8px] text-slate-400 font-bold normal-case tracking-normal mt-0.5">5 Tabs: All, Stores, Other, Ranking</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-amber-600 transition-colors" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsExportDropdownOpen(false);
                        exportCombined();
                      }}
                      className="group flex w-full items-center justify-between rounded-2xl bg-slate-900 p-4 text-left text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-slate-900/15 transition-all hover:bg-red-900"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
                          <FileSpreadsheet size={16} />
                        </div>
                        <div>
                          <p>Complete Analysis</p>
                          <p className="text-[8px] text-white/60 font-bold normal-case tracking-normal mt-0.5">4 Tabs: Lost Sales, Shortage, Ranking</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-white/40 group-hover:text-white transition-colors" />
                    </button>
                  </div>
                </div>
              )}
            </div>
              )}

              {onBack && (
                <BackToModulesButton onClick={onBack} />
            )}
          </div>
        </header>



          {/* Tabs Navigation */}
          <div className="mb-10 flex justify-center">
            <div className="relative inline-flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-slate-200/60 bg-white/50 p-1.5 shadow-inner backdrop-blur-md">
              {salesPerm !== 'none' && (
                <button
                  type="button"
                  onClick={() => changeViewMode('standard')}
                  className={`group relative z-10 flex items-center gap-2.5 rounded-xl px-6 py-3 text-[13px] font-bold transition-all duration-300 ${
                    viewMode === 'standard' 
                      ? 'bg-slate-900 text-white shadow-md ring-1 ring-slate-900/5' 
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <TrendingDown className={`h-4 w-4 transition-colors duration-300 ${viewMode === 'standard' ? 'text-white' : 'text-slate-400 group-hover:text-red-600'}`} />
                  <span>Revenue Lost Analysis</span>
                </button>
              )}
              {shortagesPerm !== 'none' && (
                <button
                  type="button"
                  onClick={() => changeViewMode('expanded')}
                  className={`group relative z-10 flex items-center gap-2.5 rounded-xl px-6 py-3 text-[13px] font-bold transition-all duration-300 ${
                    viewMode === 'expanded' 
                      ? 'bg-slate-900 text-white shadow-md ring-1 ring-slate-900/5' 
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <PackageX className={`h-4 w-4 transition-colors duration-300 ${viewMode === 'expanded' ? 'text-white' : 'text-slate-400 group-hover:text-red-600'}`} />
                  <span>Inventory Shortages</span>
                </button>
              )}
              {isManagerRole(user.role) && (
                <button
                  type="button"
                  onClick={() => changeViewMode('products')}
                  className={`group relative z-10 flex items-center gap-2.5 rounded-xl px-6 py-3 text-[13px] font-bold transition-all duration-300 ${
                    viewMode === 'products' 
                      ? 'bg-slate-900 text-white shadow-md ring-1 ring-slate-900/5' 
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Package className={`h-4 w-4 transition-colors duration-300 ${viewMode === 'products' ? 'text-white' : 'text-slate-400 group-hover:text-red-600'}`} />
                  <span>Product Catalogue</span>
                </button>
              )}
            </div>
          </div>

        {
          viewMode === 'standard' ? (
            <>
              {/* --- Section 2: Macro KPI Grid (Currency Fix Applied) --- */}
              {user.isKPIDashboardEnabled !== false && (
                <>
                  <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-24">
                    <StrategicKPI label="TOTAL LOSS VALUE" value={aggregateMetrics.totalRevenue.toFixed(1)} icon={<Banknote size={20} />} isCurrency critical={true} />
                    <StrategicKPI label="LOST CUSTOMERS NO" value={aggregateMetrics.lostCustomersNo} icon={<UserMinus size={20} />} tooltip="Number of customer visits where at least one requested item was unavailable." critical={true} unit="Customer" />
                    <StrategicKPI label="INCIDENT VOLUME" value={aggregateMetrics.incidentCount} icon={<AlertCircle size={20} />} critical={true} unit="TIME" />
                    <StrategicKPI label="OUT-OF-STOCK SKUS" value={aggregateMetrics.skuCount} icon={<PackageX size={20} />} critical={true} unit="SKU" />
                    <StrategicKPI label="AVG LOSS / CUSTOMER" value={aggregateMetrics.avgLossPerCustomer.toFixed(1)} icon={<Wallet size={20} />} isCurrency />
                    <StrategicKPI label="UNIT LOSS VALUE" value={aggregateMetrics.averageOrderLoss.toFixed(1)} icon={<TrendingDown size={20} />} isCurrency />
                    <StrategicKPI label="MISSED OPPORTUNITY" value={aggregateMetrics.totalUnits} icon={<Target size={20} />} />
                    {/* Category Specific Card */}
                    <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm flex flex-col items-center justify-center text-center group hover:border-brand/30 hover:shadow-2xl hover:shadow-brand/10 transition-all duration-700 min-h-[165px] md:min-h-[185px] relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-brand/[0.02] rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
                      <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-4 group-hover:bg-brand group-hover:border-brand group-hover:text-white transition-all duration-500 relative z-10">
                        <Layers size={24} />
                      </div>
                      <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2 leading-none relative z-10 group-hover:text-brand transition-colors">CRITICAL SECTOR</p>
                      <p className="text-xs md:text-sm lg:text-base font-black text-slate-900 uppercase tracking-tighter truncate max-w-full px-4 relative z-10">
                        {aggregateMetrics.mostImpactedCategory}
                      </p>
                    </div>
                  </section>

                  {/* --- Section 2.2: Pharmacist Recovery KPIs --- */}
                  <div className="mt-16 mb-20">
                    <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-red-600">Recovery & Transfer Performance</p>
                        <h3 className="mt-2 text-2xl font-black tracking-tighter text-slate-950">Recovered value, transfer usage, and unresolved exposure</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {[
                          { key: 'no_recovery' as const, label: 'No recovery', tone: 'red' },
                          { key: 'alt_given' as const, label: 'Alt given', tone: 'emerald' },
                          { key: 'transferred' as const, label: 'Transfer', tone: 'blue' },
                        ].map(({ key, label, tone }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setPerformanceLogFilter(performanceLogFilter === key ? null : key);
                              setPerformanceLogPage(1);
                            }}
                            className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-all duration-300 ${
                              performanceLogFilter === key
                                ? tone === 'red'
                                  ? 'border-red-500 bg-red-600 text-white shadow-lg shadow-red-500/20'
                                  : tone === 'emerald'
                                    ? 'border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                    : 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                : tone === 'red'
                                  ? 'border-red-100 bg-red-50 text-red-700 hover:border-red-200 hover:bg-red-100'
                                  : tone === 'emerald'
                                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:border-emerald-200 hover:bg-emerald-100'
                                    : 'border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200 hover:bg-blue-100'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <section className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
                      <div className="grid grid-cols-1 xl:grid-cols-[1.08fr_0.92fr]">
                        <div className="relative overflow-hidden bg-slate-950 p-6 text-white sm:p-8">
                          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl"></div>
                          <div className="absolute bottom-0 left-0 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl"></div>

                          <div className="relative z-10 flex flex-col gap-7">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                              <div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/60">
                                  <ShieldCheck size={13} />
                                  Recovery health
                                </div>
                                <div className="mt-5 flex items-end gap-3">
                                  <p className="text-6xl font-black leading-none tracking-tighter tabular-nums">{aggregateMetrics.recoveryPercentage.toFixed(1)}%</p>
                                  <div className="pb-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Recovered cases</p>
                                    <p className="mt-1 text-xs font-bold text-white/45">{aggregateMetrics.recoveryCount} of {aggregateMetrics.incidentCount} incidents</p>
                                  </div>
                                </div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Recovered value</p>
                                <div className="mt-1 flex items-end justify-end gap-1">
                                  <span className="pb-1 text-[10px] font-black text-emerald-300">BHD</span>
                                  <span className="text-2xl font-black tracking-tighter tabular-nums">{aggregateMetrics.recoveryRevenue.toFixed(3)}</span>
                                </div>
                                <p className="mt-1 text-[10px] font-bold text-white/35">{aggregateMetrics.recoveryValueShare.toFixed(1)}% of exposure value</p>
                              </div>
                            </div>

                            <div>
                              <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
                                <span>Recovered</span>
                                <span>Open exposure</span>
                              </div>
                              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 transition-all duration-1000"
                                  style={{ width: `${Math.min(100, aggregateMetrics.recoveryPercentage)}%` }}
                                ></div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              {[
                                { label: 'Alt given', value: `${aggregateMetrics.altPercentage.toFixed(1)}%`, detail: `${aggregateMetrics.altCount} cases`, icon: <Sparkles size={16} />, tone: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/15' },
                                { label: 'Transfer used', value: `${aggregateMetrics.transferPercentage.toFixed(1)}%`, detail: `${aggregateMetrics.transferCount} requests`, icon: <RefreshCcw size={16} />, tone: 'text-blue-300 bg-blue-400/10 border-blue-400/15' },
                                { label: 'No recovery', value: `${aggregateMetrics.noRecoveryPercentage.toFixed(1)}%`, detail: `${aggregateMetrics.noRecoveryCount} incidents`, icon: <AlertTriangle size={16} />, tone: 'text-red-300 bg-red-400/10 border-red-400/15' },
                              ].map(item => (
                                <div key={item.label} className={`rounded-2xl border p-4 ${item.tone}`}>
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/45">{item.label}</p>
                                    {item.icon}
                                  </div>
                                  <p className="mt-4 text-2xl font-black tracking-tighter text-white tabular-nums">{item.value}</p>
                                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">{item.detail}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="p-6 sm:p-8">
                          <div className="grid grid-cols-1 gap-4">
                            {[
                              {
                                label: 'Alternative Recovery',
                                description: 'Pharmacist saved demand with a substitute item.',
                                percent: aggregateMetrics.altPercentage,
                                revenue: aggregateMetrics.altRevenue,
                                count: aggregateMetrics.altCount,
                                icon: <Sparkles size={19} />,
                                color: 'emerald',
                                filter: 'alt_given' as const,
                              },
                              {
                                label: 'Stock Transfer',
                                description: 'Branch routed demand through internal stock movement.',
                                percent: aggregateMetrics.transferPercentage,
                                revenue: aggregateMetrics.transferRevenue,
                                count: aggregateMetrics.transferCount,
                                icon: <Truck size={19} />,
                                color: 'blue',
                                filter: 'transferred' as const,
                              },
                            ].map(item => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => {
                                  setPerformanceLogFilter(performanceLogFilter === item.filter ? null : item.filter);
                                  setPerformanceLogPage(1);
                                }}
                                className={`group rounded-[1.5rem] border p-5 text-left transition-all duration-300 ${
                                  performanceLogFilter === item.filter
                                    ? item.color === 'emerald'
                                      ? 'border-emerald-300 bg-emerald-50 shadow-lg shadow-emerald-100'
                                      : 'border-blue-300 bg-blue-50 shadow-lg shadow-blue-100'
                                    : 'border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white hover:shadow-lg hover:shadow-slate-100'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex min-w-0 items-start gap-3">
                                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                                      item.color === 'emerald' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                                    }`}>
                                      {item.icon}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-black uppercase tracking-tight text-slate-900">{item.label}</p>
                                      <p className="mt-1 text-xs font-bold leading-5 text-slate-400">{item.description}</p>
                                    </div>
                                  </div>
                                  <ArrowUpRight className={`mt-1 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${
                                    item.color === 'emerald' ? 'text-emerald-500' : 'text-blue-500'
                                  }`} size={17} />
                                </div>
                                <div className="mt-5 grid grid-cols-3 gap-3">
                                  <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Usage</p>
                                    <p className="mt-1 text-xl font-black tracking-tighter text-slate-950 tabular-nums">{item.percent.toFixed(1)}%</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Cases</p>
                                    <p className="mt-1 text-xl font-black tracking-tighter text-slate-950 tabular-nums">{item.count}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">BHD</p>
                                    <p className="mt-1 text-xl font-black tracking-tighter text-slate-950 tabular-nums">{item.revenue.toFixed(1)}</p>
                                  </div>
                                </div>
                                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                                  <div
                                    className={`h-full rounded-full transition-all duration-1000 ${item.color === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                    style={{ width: `${Math.min(100, item.percent)}%` }}
                                  ></div>
                                </div>
                              </button>
                            ))}

                            <button
                              type="button"
                              onClick={() => {
                                setPerformanceLogFilter(performanceLogFilter === 'no_recovery' ? null : 'no_recovery');
                                setPerformanceLogPage(1);
                              }}
                              className={`rounded-[1.5rem] border p-5 text-left transition-all duration-300 ${
                                performanceLogFilter === 'no_recovery'
                                  ? 'border-red-300 bg-red-50 shadow-lg shadow-red-100'
                                  : 'border-red-100 bg-white hover:border-red-200 hover:bg-red-50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
                                    <AlertTriangle size={19} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-black uppercase tracking-tight text-slate-900">Unresolved Recovery Exposure</p>
                                    <p className="mt-1 text-xs font-bold leading-5 text-slate-400">Cases still showing no substitute or transfer path.</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-2xl font-black tracking-tighter text-red-700 tabular-nums">{aggregateMetrics.noRecoveryCount}</p>
                                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-red-400">cases</p>
                                </div>
                              </div>
                              <div className="mt-5 flex items-end justify-between gap-3">
                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Exposure value</p>
                                  <p className="mt-1 text-xl font-black tracking-tighter text-slate-950 tabular-nums">BHD {aggregateMetrics.noRecoveryRevenue.toFixed(3)}</p>
                                </div>
                                <div className="rounded-xl bg-red-100 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-red-700">
                                  {aggregateMetrics.noRecoveryPercentage.toFixed(1)}%
                                </div>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </>
              )}

              {/* --- Section 2.3: Performance Log (New) --- */}
              <section className="bg-white rounded-[2.8rem] border border-slate-100 shadow-sm overflow-hidden mb-20 p-8 md:p-12 relative">
                <div className="flex flex-col gap-6 mb-8">
                  <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
                    <div className="flex items-start">
                      <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white mr-4 shrink-0">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Branch Performance Log</h2>
                        <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest">Recent Lost Sale Activity</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                            <Database size={12} />
                            {filteredPerformanceLogData.length} / {logSales.length} Records
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-red-700">
                            <MapPin size={12} />
                            {activeBranchLabel || 'Selected Branch'}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                            <CalendarDays size={12} />
                            {dateType === 'today' ? 'Today' : dateType === 'yesterday' ? 'Yesterday' : dateType === '7d' ? 'Last 7 Days' : dateType === 'month' ? 'Last Month' : dateType === 'custom' ? 'Custom Period' : 'All Time'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full xl:max-w-md">
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                          type="text"
                          value={performanceLogSearch}
                          onChange={(e) => {
                            setPerformanceLogSearch(e.target.value);
                            setPerformanceLogPage(1);
                          }}
                          placeholder="Search product, branch, pharmacist, code..."
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-red-200 focus:bg-white focus:ring-4 focus:ring-red-50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        setPerformanceLogFilter(performanceLogFilter === 'no_recovery' ? null : 'no_recovery');
                        setPerformanceLogPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${performanceLogFilter === 'no_recovery'
                        ? 'bg-red-500 text-white shadow-lg scale-105'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                    >
                      no recovery
                    </button>
                    <button
                      onClick={() => {
                        setPerformanceLogFilter(performanceLogFilter === 'alt_given' ? null : 'alt_given');
                        setPerformanceLogPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${performanceLogFilter === 'alt_given'
                        ? 'bg-emerald-500 text-white shadow-lg scale-105'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        }`}
                    >
                      Alt given
                    </button>
                    <button
                      onClick={() => {
                        setPerformanceLogFilter(performanceLogFilter === 'transferred' ? null : 'transferred');
                        setPerformanceLogPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${performanceLogFilter === 'transferred'
                        ? 'bg-blue-500 text-white shadow-lg scale-105'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                    >
                      transfer
                    </button>
                    {(performanceLogFilter || performanceLogSearch) && (
                      <button
                        onClick={() => {
                          setPerformanceLogFilter(null);
                          setPerformanceLogSearch('');
                          setPerformanceLogPage(1);
                        }}
                        className="px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Showing {performanceLogFilterLabel}{performanceLogSearch.trim() ? ` matching "${performanceLogSearch.trim()}"` : ''}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto min-h-[620px] flex flex-col">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50">
                        <th className="pb-4 pl-4 w-12">#</th>
                        <th className="pb-4">Product / Branch</th>
                        <th className="pb-4 text-center w-32">Qty / Vol</th>
                        <th className="pb-4 text-right pr-4 w-40">Potential Loss</th>
                        <th className="pb-4 text-center w-40">Recovery Status</th>
                        <th className="pb-4 text-center w-28">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-bold text-slate-700">
                      {filteredPerformanceLogData.slice((performanceLogPage - 1) * 10, performanceLogPage * 10).map((s, idx) => {
                        const globalIdx = ((performanceLogPage - 1) * 10) + (idx + 1);
                        const statusMeta = s.alternativeGiven
                          ? { label: 'Alt Given', className: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' }
                          : s.internalTransfer
                            ? { label: 'Transfer', className: 'bg-blue-50 text-blue-700 border-blue-100', dot: 'bg-blue-500' }
                            : { label: 'No Recovery', className: 'bg-red-50 text-red-700 border-red-100', dot: 'bg-red-500' };
                        return (
                          <tr key={s.id || idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all h-[77px]">
                            <td className="py-4 pl-4 text-[10px] font-black text-slate-400 tabular-nums w-12">
                              {globalIdx}
                            </td>
                            <td className="py-4">
                              <p className="text-slate-900 font-black uppercase text-xs truncate max-w-[180px] sm:max-w-[280px] md:max-w-[420px]" title={s.productName}>
                                {s.productName}
                              </p>
                              <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-1 truncate max-w-[200px] sm:max-w-[300px]">
                                {branches.find(b => b.id === s.branchId)?.name || 'Unknown Node'} • {s.pharmacistName}
                              </p>
                            </td>
                            <td className="py-4 text-center w-32">
                              <span className="px-3 py-1 bg-slate-100 rounded-lg text-slate-600 text-[10px] tabular-nums font-black">{s.quantity} Units</span>
                            </td>
                            <td className="py-4 text-right text-slate-900 pr-4 tabular-nums w-40">
                              {s.totalValue.toFixed(3)} <span className="text-[9px] text-slate-300">BHD</span>
                            </td>
                            <td className="py-4 text-center w-40">
                              <span className={`inline-flex items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] ${statusMeta.className}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`}></span>
                                {statusMeta.label}
                              </span>
                            </td>
                            <td className="py-4 text-center w-28">
                              {(user.role === 'branch' || isManagerRole(user.role)) && (
                                <button
                                  onClick={async () => {
                                    if (confirm(`Remove lost sale record for "${s.productName}"? This cannot be undone.`)) {
                                      try {
                                        await supabase.sales.delete(s.id);
                                        await syncDashboardData();
                                        showToast('Lost sale record removed', 'success');
                                      } catch (error) {
                                        console.error('Failed to delete lost sale record:', error);
                                        showToast(error instanceof Error ? error.message : 'Failed to delete lost sale record', 'error');
                                      }
                                    }
                                  }}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent px-2.5 py-2 text-[9px] font-black uppercase tracking-wider text-slate-300 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                                  aria-label="Delete lost sale record"
                                  title="Delete lost sale record"
                                >
                                  <Trash2 size={14} />
                                  <span className="hidden xl:inline">Delete</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredPerformanceLogData.length > 0 && filteredPerformanceLogData.slice((performanceLogPage - 1) * 10, performanceLogPage * 10).length < 10 && (
                        Array.from({ length: 10 - filteredPerformanceLogData.slice((performanceLogPage - 1) * 10, performanceLogPage * 10).length }).map((_, i) => (
                          <tr key={`placeholder-${i}`} className="border-b border-transparent h-[77px]">
                            <td colSpan={6}></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {filteredPerformanceLogData.length > 10 && (
                    <div className="mt-auto pt-8 border-t border-slate-50 flex items-center justify-between px-2 pb-4">
                      <button
                        onClick={() => setPerformanceLogPage(p => Math.max(1, p - 1))}
                        className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm disabled:opacity-20"
                        disabled={performanceLogPage === 1}
                        aria-label="Previous log page"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-slate-900 uppercase tabular-nums">
                          Log Page {performanceLogPage} OF {Math.ceil(filteredPerformanceLogData.length / 10)}
                        </span>
                      </div>
                      <button
                        onClick={() => setPerformanceLogPage(p => Math.min(Math.ceil(filteredPerformanceLogData.length / 10), p + 1))}
                        className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm disabled:opacity-20"
                        disabled={performanceLogPage === Math.ceil(filteredPerformanceLogData.length / 10)}
                        aria-label="Next log page"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  )}
                  {filteredPerformanceLogData.length === 0 && (
                    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">
                        <Search size={24} />
                      </div>
                      <p className="text-sm font-black text-slate-700 uppercase tracking-[0.14em]">No lost sales records found</p>
                      <p className="mt-2 max-w-md text-xs font-bold leading-relaxed text-slate-400">
                        Try changing the branch/date filter, clearing the recovery filter, or searching with another product, pharmacist, branch, or internal code.
                      </p>
                      {(performanceLogSearch || performanceLogFilter) && (
                        <button
                          onClick={() => {
                            setPerformanceLogSearch('');
                            setPerformanceLogFilter(null);
                            setPerformanceLogPage(1);
                          }}
                          className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-white hover:bg-red-800 transition-colors"
                        >
                          Clear log filters
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : null
        }

        {
          viewMode === 'expanded' ? (
            <>
              {/* --- Section 2.4: Inventory Gap Command Center --- */}
              {user.isKPIDashboardEnabled !== false && (
                <section className="mb-10 overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
                  <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="relative overflow-hidden bg-slate-950 p-6 text-white sm:p-8">
                      <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-red-500/15 blur-3xl"></div>
                      <div className="absolute -bottom-20 left-0 h-52 w-52 rounded-full bg-amber-400/10 blur-3xl"></div>

                      <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/60">
                          <PackageX size={13} />
                          Inventory risk score
                        </div>
                        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <div className="flex items-end gap-2">
                              <p className="text-6xl font-black leading-none tracking-tighter tabular-nums">{shortageMetrics.riskScore}</p>
                              <p className="pb-2 text-sm font-black uppercase tracking-[0.18em] text-white/35">/ 100</p>
                            </div>
                            <p className="mt-3 max-w-md text-sm font-bold leading-6 text-white/55">
                              {shortageMetrics.activeRiskCount} urgent inventory gaps from {shortageMetrics.totalCount} reports across {shortageMetrics.uniqueSkuCount} SKUs.
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Linked to lost sales</p>
                            <p className="mt-1 text-2xl font-black tracking-tighter text-red-200 tabular-nums">{shortageMetrics.lostSaleLinkedPercentage.toFixed(1)}%</p>
                            <p className="mt-1 text-[10px] font-bold text-white/35">{shortageMetrics.lostSaleLinkedCount} correlated reports</p>
                          </div>
                        </div>

                        <div className="mt-8">
                          <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
                            <span>Low</span>
                            <span>Critical</span>
                            <span>Out of stock</span>
                          </div>
                          <div className="flex h-4 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="bg-yellow-400 transition-all duration-1000"
                              style={{ width: `${(shortageMetrics.lowCount / Math.max(1, shortageMetrics.totalCount)) * 100}%` }}
                            ></div>
                            <div
                              className="bg-red-500 transition-all duration-1000"
                              style={{ width: `${(shortageMetrics.criticalCount / Math.max(1, shortageMetrics.totalCount)) * 100}%` }}
                            ></div>
                            <div
                              className="bg-slate-200 transition-all duration-1000"
                              style={{ width: `${(shortageMetrics.outOfStockCount / Math.max(1, shortageMetrics.totalCount)) * 100}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          {[
                            { status: 'Low' as const, label: 'Low stock', value: shortageMetrics.lowCount, color: 'yellow' },
                            { status: 'Critical' as const, label: 'Critical', value: shortageMetrics.criticalCount, color: 'red' },
                            { status: 'Out of Stock' as const, label: 'Stockout', value: shortageMetrics.outOfStockCount, color: 'slate' },
                          ].map(item => (
                            <button
                              key={item.status}
                              type="button"
                              onClick={() => {
                                setShortageStatusFilter(shortageStatusFilter === item.status ? null : item.status);
                                setBranchPage(1);
                              }}
                              className={`rounded-2xl border p-4 text-left transition-all duration-300 ${
                                shortageStatusFilter === item.status
                                  ? item.color === 'yellow'
                                    ? 'border-yellow-300 bg-yellow-400 text-slate-950 shadow-lg shadow-yellow-500/20'
                                    : item.color === 'red'
                                      ? 'border-red-400 bg-red-500 text-white shadow-lg shadow-red-500/20'
                                      : 'border-white bg-white text-slate-950 shadow-lg shadow-white/10'
                                  : item.color === 'yellow'
                                    ? 'border-yellow-300/15 bg-yellow-400/10 text-yellow-200 hover:bg-yellow-400/15'
                                    : item.color === 'red'
                                      ? 'border-red-400/15 bg-red-400/10 text-red-200 hover:bg-red-400/15'
                                      : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                              }`}
                            >
                              <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-70">{item.label}</p>
                              <p className="mt-3 text-3xl font-black tracking-tighter tabular-nums">{item.value}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-6 sm:p-8">
                      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-600">Inventory Gaps</p>
                          <h2 className="mt-2 text-2xl font-black tracking-tighter text-slate-950">Shortage severity and accountability</h2>
                        </div>
                        {shortageStatusFilter && (
                          <button
                            type="button"
                            onClick={() => {
                              setShortageStatusFilter(null);
                              setBranchPage(1);
                            }}
                            className="w-fit rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 hover:bg-white"
                          >
                            Clear filter
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {[
                          { label: 'Unique SKUs', value: shortageMetrics.uniqueSkuCount, detail: 'Products currently affected', icon: <Package size={18} />, tone: 'bg-slate-50 text-slate-700 border-slate-100' },
                          { label: 'Urgent gaps', value: shortageMetrics.activeRiskCount, detail: 'Critical plus stockout cases', icon: <AlertTriangle size={18} />, tone: 'bg-red-50 text-red-700 border-red-100' },
                          { label: 'Top branch', value: shortageMetrics.topBranch[1], detail: String(shortageMetrics.topBranch[0]), icon: <MonitorCheck size={18} />, tone: 'bg-blue-50 text-blue-700 border-blue-100' },
                          { label: 'Top reporter', value: shortageMetrics.topPharmacist[1], detail: String(shortageMetrics.topPharmacist[0]), icon: <UserCheck size={18} />, tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                        ].map(item => (
                          <div key={item.label} className={`rounded-[1.5rem] border p-5 ${item.tone}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-60">{item.label}</p>
                                <p className="mt-3 text-3xl font-black tracking-tighter text-slate-950 tabular-nums">{item.value}</p>
                              </div>
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70">
                                {item.icon}
                              </div>
                            </div>
                            <p className="mt-3 truncate text-xs font-bold text-slate-400" title={item.detail}>{item.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* --- Section 2.5: Branch Shortages Module (UPPER PRIMARY POSITION) --- */}
              <section className="mb-8 flex flex-col overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-6 md:px-8">
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                        <AlertTriangle size={20} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-xl font-black uppercase tracking-tighter text-slate-950">Live Gap Register</h2>
                        <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Branch-level inventory reports with lost-sales correlation</p>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                            <Database size={12} />
                            {filteredShortages.length} / {shortages.length} records
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-red-700">
                            <MapPin size={12} />
                            {activeBranchLabel || 'Selected Branch'}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                            <CalendarDays size={12} />
                            {dateType === 'today' ? 'Today' : dateType === 'yesterday' ? 'Yesterday' : dateType === '7d' ? 'Last 7 Days' : dateType === 'month' ? 'Last Month' : dateType === 'custom' ? 'Custom Period' : 'All Time'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          setShortageStatusFilter(shortageStatusFilter === 'Low' ? null : 'Low');
                          setBranchPage(1);
                        }}
                        className={`rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${shortageStatusFilter === 'Low'
                          ? 'border-yellow-400 bg-yellow-400 text-slate-950 shadow-lg shadow-yellow-500/20'
                          : 'border-yellow-100 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                          }`}
                      >
                        Low
                      </button>
                      <button
                        onClick={() => {
                          setShortageStatusFilter(shortageStatusFilter === 'Critical' ? null : 'Critical');
                          setBranchPage(1);
                        }}
                        className={`rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${shortageStatusFilter === 'Critical'
                          ? 'border-red-500 bg-red-600 text-white shadow-lg shadow-red-500/20'
                          : 'border-red-100 bg-red-50 text-red-700 hover:bg-red-100'
                          }`}
                      >
                        Critical
                      </button>
                      <button
                        onClick={() => {
                          setShortageStatusFilter(shortageStatusFilter === 'Out of Stock' ? null : 'Out of Stock');
                          setBranchPage(1);
                        }}
                        className={`rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${shortageStatusFilter === 'Out of Stock'
                          ? 'border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-900/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        OOS
                      </button>
                      {shortageStatusFilter && (
                        <button
                          onClick={() => {
                            setShortageStatusFilter(null);
                            setBranchPage(1);
                          }}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:bg-slate-100"
                        >
                          <RefreshCcw size={14} />
                        </button>
                      )}
                    </div>
                </div>
                </div>

                <div className="flex min-h-[820px] flex-col overflow-x-auto p-6 md:p-8">
                  {shortages.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-slate-300 font-black uppercase tracking-widest text-sm">No Shortages Reported</p>
                    </div>
                  ) : (
                    <>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <th className="pb-4 pl-4 w-12">#</th>
                            <th className="pb-4">Product Name</th>
                            <th className="pb-4 w-36">Status</th>
                            <th className="pb-4 w-56">Reported By</th>
                            <th className="pb-4 w-48">Time</th>
                            <th className="pb-4 pr-4 text-right w-48">Correlation</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm font-bold text-slate-700">
                          {/* استخدام البيانات المصفاة من useMemo */}
                          {[...filteredShortages]
                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) // Newest First
                            .slice((branchPage - 1) * 10, branchPage * 10)
                            .map((item, idx) => {
                              const hasLostSale = sales.some(s => s.productName === item.productName);
                              const isExpanded = expandedShortageId === item.id;
                              const globalIdx = ((branchPage - 1) * 10) + (idx + 1);
                              return (
                                <React.Fragment key={item.id || idx}>
                                  <tr
                                    onClick={() => setExpandedShortageId(isExpanded ? null : item.id)}
                                    className={`group hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 relative h-[77px] ${hasLostSale ? 'bg-red-50/10' : ''} ${isExpanded ? 'bg-slate-50' : ''}`}
                                  >
                                    <td className="py-4 pl-4 text-[10px] font-black text-slate-400 tabular-nums w-12">
                                      {globalIdx}
                                    </td>
                                    <td className="py-4">
                                      <div className="font-black text-slate-900 truncate max-w-[180px] sm:max-w-[300px] md:max-w-[480px]" title={item.productName}>
                                        {item.productName}
                                      </div>
                                      <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5 truncate max-w-[220px] sm:max-w-[350px]">
                                        {branches.find(b => b.id === item.branchId)?.name || 'Unknown Branch'}
                                      </div>
                                      {isExpanded && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand rounded-r-full"></div>}
                                    </td>
                                    <td className="py-4 w-36">
                                      <span className={`text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2
                             ${item.status === 'Low' ? 'text-orange-500' :
                                          item.status === 'Critical' ? 'text-red-600' :
                                            'text-slate-900'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'Out of Stock' ? 'bg-slate-900 animate-pulse' : 'bg-current'}`}></span>
                                        {item.status}
                                      </span>
                                    </td>
                                    <td className="py-4 w-56">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 text-[10px]"><UserCircle size={12} /></div>
                                        <span className="text-xs truncate max-w-[180px]">{item.pharmacistName}</span>
                                      </div>
                                    </td>
                                    <td className="py-4 text-slate-400 text-xs font-mono w-48">
                                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      <br />
                                      <span className="text-[8px] tracking-widest uppercase">{new Date(item.timestamp).toLocaleDateString()}</span>
                                    </td>
                                    <td className="py-4 pr-4 w-48">
                                      <div className="flex items-center justify-end gap-3">
                                        {hasLostSale ? (
                                          <span
                                            className="text-[9px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2 cursor-help"
                                            title="Active Correlation: This item is currently causing confirmed revenue loss (Lost Sales recorded)."
                                          >
                                            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></span> Active
                                          </span>
                                        ) : (
                                          <span
                                            className="text-[9px] font-black text-emerald-500 uppercase tracking-widest cursor-help opacity-80"
                                            title="Safe Status: No lost sales recorded for this item yet."
                                          >
                                            Safe
                                          </span>
                                        )}
                                        {(user.role === 'branch' || isManagerRole(user.role)) && (
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (confirm('Delete this shortage record?')) {
                                                try {
                                                  await supabase.shortages.delete(item.id);
                                                  await syncDashboardData();
                                                  showToast('Shortage record removed', 'success');
                                                } catch (error) {
                                                  console.error('Failed to delete shortage record:', error);
                                                  showToast(error instanceof Error ? error.message : 'Failed to delete shortage record', 'error');
                                                }
                                              }
                                            }}
                                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                            aria-label="Delete shortage record"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                  {isExpanded && (
                                    <tr className="bg-slate-50/50 animate-in fade-in duration-300">
                                      <td colSpan={6} className="p-0 border-b border-slate-50">
                                        <div className="p-4 pl-8 md:pl-12">
                                          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Layers size={12} /> Note History & Status Updates
                                          </h4>
                                          <div className="space-y-4 pl-2 relative before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-200 before:border-l before:border-dashed before:border-slate-300">
                                            {/* Current Status */}
                                            <div className="relative text-xs font-bold text-slate-700 flex flex-col md:flex-row md:items-center gap-1 md:gap-4 ml-4">
                                              <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-900 ring-4 ring-white"></span>
                                              <div className="bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm inline-flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${item.status === 'Low' ? 'bg-yellow-400' : item.status === 'Critical' ? 'bg-red-500' : 'bg-black'}`}></span>
                                                {item.status}
                                              </div>
                                              <span className="text-slate-400 font-normal text-[10px] uppercase tracking-wider">
                                                {new Date(item.timestamp).toLocaleString()} • by {item.pharmacistName}
                                              </span>
                                            </div>

                                            {(item.history || []).slice().reverse().map((h, hIdx) => (
                                              <div key={hIdx} className="relative text-xs text-slate-500 flex flex-col md:flex-row md:items-center gap-1 md:gap-4 ml-4 opacity-75">
                                                <span className="absolute -left-[19px] top-1.5 w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                <div className="inline-flex items-center gap-2 px-2">
                                                  <span className={`w-1.5 h-1.5 rounded-full ${h.status === 'Low' ? 'bg-yellow-400' : h.status === 'Critical' ? 'bg-red-400' : 'bg-slate-600'}`}></span>
                                                  <span>{h.status}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-300 font-mono">
                                                  {new Date(h.timestamp).toLocaleString()} • {h.pharmacistName}
                                                </span>
                                              </div>
                                            ))}
                                            {(!item.history || item.history.length === 0) && (
                                              <p className="text-[10px] text-slate-400 ml-4 italic">No previous history recorded.</p>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          {/* Placeholder rows to maintain 10-row height */}
                          {filteredShortages.length > 0 && filteredShortages.slice((branchPage - 1) * 10, branchPage * 10).length < 10 && (
                            Array.from({ length: 10 - filteredShortages.slice((branchPage - 1) * 10, branchPage * 10).length }).map((_, i) => (
                              <tr key={`placeholder-shortage-${i}`} className="border-b border-transparent h-[77px]">
                                <td colSpan={6}></td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>

                      <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between px-2 pb-4">
                        {/* منع الصفحة 0 في التصفح */}
                        <button onClick={() => setBranchPage(p => Math.max(1, p - 1))} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm" aria-label="Previous page">
                          <ChevronLeft size={18} />
                        </button>
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-black text-slate-900 uppercase tabular-nums">
                            Page {branchPage} OF {Math.max(1, Math.ceil(filteredShortages.length / 10))}
                          </span>
                        </div>
                        <button onClick={() => setBranchPage(p => Math.min(Math.max(1, Math.ceil(filteredShortages.length / 10)), p + 1))} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm" aria-label="Next page">
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* --- Section 2.6: Shortage Intelligence Split --- */}
              <div className="mb-8 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
                {/* Hot Shortage SKUs */}
                <div className="flex min-h-[560px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 bg-slate-50/80 p-5 md:p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm shadow-red-600/20">
                          <Zap size={20} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-700">Shortage heat list</p>
                          <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Hot Shortage SKUs</h3>
                          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Recurring inventory gaps ranked by report frequency</p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => setHotShortagePage(p => Math.max(1, p - 1))}
                          disabled={hotShortagePage === 1}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-900 hover:bg-slate-900 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                          aria-label="Previous batch"
                        >
                          <ChevronLeft size={17} />
                        </button>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-700 tabular-nums">
                          {hotShortagePage} / {Math.max(1, Math.ceil(shortageMetrics.topProducts.length / 5))}
                        </div>
                        <button
                          onClick={() => setHotShortagePage(p => Math.min(Math.max(1, Math.ceil(shortageMetrics.topProducts.length / 5)), p + 1))}
                          disabled={hotShortagePage === Math.ceil(shortageMetrics.topProducts.length / 5)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-900 hover:bg-slate-900 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                          aria-label="Next batch"
                        >
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 divide-y divide-slate-100">
                    {shortageMetrics.topProducts.slice((hotShortagePage - 1) * 5, hotShortagePage * 5).map((p, i) => {
                      const rank = (hotShortagePage - 1) * 5 + i + 1;
                      const maxCount = Math.max(1, shortageMetrics.topProducts[0]?.count || 1);
                      const width = `${Math.min(100, Math.max(6, (p.count / maxCount) * 100))}%`;

                      return (
                        <div key={p.name} className="group grid gap-4 p-5 transition-colors hover:bg-slate-50/70 md:grid-cols-[56px_minmax(0,1fr)_150px] md:items-center">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-sm font-black tabular-nums ${p.isPriority ? 'bg-red-600 text-white shadow-sm shadow-red-600/20' : 'border border-slate-200 bg-white text-slate-400'}`}>
                            {rank}
                          </div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-black text-slate-950 md:text-base" title={p.name}>{p.name}</p>
                              {p.isPriority && (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-red-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                                  Priority
                                </span>
                              )}
                            </div>
                            <div className="mt-3 h-2 overflow-hidden rounded-full border border-slate-100 bg-white">
                              <div className="h-full rounded-full bg-red-600 transition-all duration-700" style={{ width }}></div>
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left md:text-right">
                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Reports</p>
                            <p className="mt-1 text-2xl font-black tracking-tight text-slate-950 tabular-nums">{p.count}</p>
                          </div>
                        </div>
                      );
                    })}
                    {shortageMetrics.topProducts.length === 0 && (
                      <div className="flex min-h-[360px] flex-col items-center justify-center p-10 text-center text-slate-300">
                        <Package size={54} className="mb-4 opacity-20" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Zero recurring gaps identified</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side Column */}
                <div className="flex flex-col gap-5">
                  {/* Branch Sales Log */}
                  <div className="flex min-h-[275px] flex-1 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-white p-5">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Branch workload</p>
                        <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Branch Sales Log</h3>
                      </div>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
                        <MonitorCheck size={18} />
                      </div>
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto p-4 pr-3 custom-scrollbar">
                      {Object.entries(shortageMetrics.branchDistribution).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 5).map(([name, count], i) => {
                        const percent = (Number(count) / Math.max(1, shortages.length)) * 100;

                        return (
                          <div key={name} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 transition-colors hover:border-red-100 hover:bg-white">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-black uppercase tracking-tight text-slate-700" title={name}>{name}</p>
                                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Rank #{i + 1} / {percent.toFixed(1)}%</p>
                              </div>
                              <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black text-slate-900 tabular-nums">
                                {count}
                              </span>
                            </div>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-100">
                              <div className="h-full rounded-full bg-slate-900 transition-all duration-700" style={{ width: `${Math.min(100, percent)}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                      {Object.keys(shortageMetrics.branchDistribution).length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">No branch records</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Responsibility Tracking */}
                  <div className="flex min-h-[275px] flex-1 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-white p-5">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Team accountability</p>
                        <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Responsibility Tracking</h3>
                      </div>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                        <UserCheck size={18} />
                      </div>
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto p-4 pr-3 custom-scrollbar">
                      {Object.entries(shortageMetrics.pharmacistActivity).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 5).map(([name, count], i) => {
                        const maxCount = Math.max(1, Number(shortageMetrics.topPharmacist[1]) || 1);
                        const percent = (Number(count) / maxCount) * 100;

                        return (
                          <div key={name} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3 transition-colors hover:border-emerald-100 hover:bg-white">
                            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-[10px] font-black text-slate-500 tabular-nums">
                              {i + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-black uppercase tracking-tight text-slate-700" title={name}>{name}</p>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-100">
                                <div className="h-full rounded-full bg-emerald-600 transition-all duration-700" style={{ width: `${Math.min(100, percent)}%` }}></div>
                              </div>
                            </div>
                            <span className="rounded-md bg-slate-950 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-white tabular-nums">
                              {count} Logged
                            </span>
                          </div>
                        );
                      })}
                      {Object.keys(shortageMetrics.pharmacistActivity).length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">No responsibility records</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* --- Section 2.7: Shortage Trend Dynamic Matrix --- */}
              <section className="mb-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50/80 p-5 md:p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
                        <TrendingUp size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Inventory volatility</p>
                        <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Shortage Trend Matrix</h2>
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Daily low, critical, and out-of-stock movement</p>
                      </div>
                    </div>

                    <div className="grid w-full grid-cols-2 gap-2 xl:max-w-2xl xl:grid-cols-4">
                      {[
                        { label: 'Low stock', value: shortageMetrics.lowCount, dot: 'bg-yellow-500', tone: 'text-yellow-700' },
                        { label: 'Critical', value: shortageMetrics.criticalCount, dot: 'bg-amber-500', tone: 'text-amber-700' },
                        { label: 'Out of stock', value: shortageMetrics.outOfStockCount, dot: 'bg-red-600', tone: 'text-red-700' },
                        { label: 'Avg critical hrs', value: shortageMetrics.avgCriticalHours.toFixed(1), dot: 'bg-slate-950', tone: 'text-slate-950' },
                      ].map(item => (
                        <div key={item.label} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${item.dot}`}></span>
                            <p className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                          </div>
                          <p className={`mt-2 text-xl font-black tracking-tight tabular-nums ${item.tone}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="p-4 md:p-6">
                    <div className="relative h-[360px] rounded-lg border border-slate-100 bg-white p-3 shadow-inner shadow-slate-100/70">
                      <ShortageTrendChart data={shortageMetrics.trendTimeline} />
                    </div>
                  </div>

                  <aside className="border-t border-slate-100 bg-white p-5 xl:border-l xl:border-t-0">
                    <div className="mb-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Matrix readout</p>
                      <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Risk concentration</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-700">Risk score</p>
                          <AlertTriangle size={16} className="text-red-700" />
                        </div>
                        <p className="mt-2 text-3xl font-black tracking-tight text-red-700 tabular-nums">{shortageMetrics.riskScore}%</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Linked to lost sales</p>
                          <ArrowUpRight size={16} className="text-slate-500" />
                        </div>
                        <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 tabular-nums">{shortageMetrics.lostSaleLinkedPercentage.toFixed(1)}%</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{shortageMetrics.lostSaleLinkedCount} matched SKUs</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Trend days</p>
                          <p className="mt-2 text-xl font-black text-slate-950 tabular-nums">{shortageMetrics.trendTimeline.length}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Active risk</p>
                          <p className="mt-2 text-xl font-black text-slate-950 tabular-nums">{shortageMetrics.activeRiskCount}</p>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </section>

            </>
          ) : null
        }

        {
          viewMode === 'standard' ? (
            <>
              {/* --- Section 4: Deep Analytics Row --- */}
              <div className="grid grid-cols-1 gap-8 mb-20 items-stretch">

                {/* Top Loss Items (Filtered Product Impact) */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[640px]">
                  <div className="p-6 md:p-8 bg-slate-50/80 border-b border-slate-100">
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                          <Target size={20} />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase">Top Loss Items</h2>
                          <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-[0.16em]">
                            Products creating the highest missed sales impact
                          </p>
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-[0.12em]">
                              <PackageX size={12} />
                              {filteredLossDrivers.length} / {paretoAnalysis.length} Items
                            </span>
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-100 text-[10px] font-black text-red-700 uppercase tracking-[0.12em]">
                              <Zap size={12} />
                              {lossDriverFilterOptions.find(option => option.id === 'priority')?.count || 0} Priority
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="w-full xl:max-w-xl space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                          <input
                            type="text"
                            value={lossDriverSearch}
                            onChange={(e) => {
                              setLossDriverSearch(e.target.value);
                              setParetoPage(1);
                            }}
                            placeholder="Search product, category, or agent"
                            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-brand/40 focus:ring-4 focus:ring-brand/5"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {lossDriverFilterOptions.map(option => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                setLossDriverFilter(option.id);
                                setParetoPage(1);
                              }}
                              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-all ${lossDriverFilter === option.id
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-900'
                                }`}
                            >
                              {option.label}
                              <span className={`rounded-full px-2 py-0.5 text-[9px] ${lossDriverFilter === option.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                {option.count}
                              </span>
                            </button>
                          ))}
                          {(lossDriverSearch || lossDriverFilter !== 'priority') && (
                            <button
                              type="button"
                              onClick={() => {
                                setLossDriverFilter('priority');
                                setLossDriverSearch('');
                                setParetoPage(1);
                              }}
                              className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 hover:text-brand hover:bg-brand/5 transition-all"
                            >
                              <Filter size={12} />
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 md:p-6 space-y-3 flex-1">
                    {visibleLossDrivers.length > 0 ? (
                      visibleLossDrivers.map((item, idx) => {
                        const rank = (paretoPage - 1) * 5 + idx + 1;
                        const impactWidth = `${Math.min(100, Math.max(4, item.share))}%`;

                        return (
                          <div key={item.name} className={`rounded-[1.4rem] border p-4 md:p-5 transition-all hover:border-slate-300 hover:shadow-sm ${item.isPriority ? 'border-red-100 bg-red-50/25' : 'border-slate-100 bg-slate-50/70'}`}>
                            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                              <div className="flex items-start gap-4 min-w-0 flex-1">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${item.isPriority ? 'bg-brand text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
                                  {rank}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-[0.12em]">
                                      {item.category}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-[0.12em]">
                                      {item.agentName}
                                    </span>
                                    {item.isPriority && (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-700 text-white text-[9px] font-black uppercase tracking-[0.12em]">
                                        <Zap size={10} />
                                        Priority Driver
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-base md:text-lg font-black text-slate-900 leading-snug break-words" title={item.name}>
                                    {item.name}
                                  </p>
                                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div className="rounded-xl bg-white border border-slate-100 px-3 py-2">
                                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.12em]">Incidents</p>
                                      <p className="text-sm font-black text-slate-900 tabular-nums">{item.incidents}</p>
                                    </div>
                                    <div className="rounded-xl bg-white border border-slate-100 px-3 py-2">
                                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.12em]">Units</p>
                                      <p className="text-sm font-black text-slate-900 tabular-nums">{item.count}</p>
                                    </div>
                                    <div className="rounded-xl bg-white border border-slate-100 px-3 py-2">
                                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.12em]">Branches</p>
                                      <p className="text-sm font-black text-slate-900 tabular-nums">{item.branchCount}</p>
                                    </div>
                                    <div className="rounded-xl bg-white border border-slate-100 px-3 py-2">
                                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.12em]">Avg Case</p>
                                      <p className="text-sm font-black text-slate-900 tabular-nums">{item.averageValue.toFixed(3)}</p>
                                    </div>
                                  </div>
                                  <div className="mt-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.14em]">Share of selected loss</span>
                                      <span className="text-[10px] font-black text-slate-700 tabular-nums">{item.share.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-white border border-slate-100 overflow-hidden">
                                      <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: impactWidth }}></div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="lg:text-right lg:min-w-[150px]">
                                <p className="text-[9px] font-black text-brand uppercase tracking-[0.16em] mb-1">BHD Impact</p>
                                <p className="text-2xl md:text-3xl font-black text-slate-900 tabular-nums leading-none">{item.total.toFixed(3)}</p>
                                <p className="mt-2 text-[9px] font-bold text-slate-400 uppercase tracking-[0.12em]">
                                  Filter: {lossDriverFilterOptions.find(option => option.id === lossDriverFilter)?.label || 'Priority'}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="min-h-[300px] rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center p-8">
                        <PackageX className="text-slate-300 mb-4" size={32} />
                        <p className="text-sm font-black text-slate-500 uppercase tracking-[0.16em]">No matching loss drivers</p>
                        <p className="text-xs font-bold text-slate-400 mt-2">Adjust the filter or search term to widen the list.</p>
                      </div>
                    )}
                  </div>

                  <div className="px-6 py-5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
                    <button
                      onClick={() => setParetoPage(p => Math.max(1, p - 1))}
                      disabled={paretoPage === 1}
                      className="p-3 bg-white text-slate-400 rounded-xl border border-slate-200 hover:bg-slate-900 hover:text-white transition-all shadow-sm disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-400"
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-black text-slate-900 uppercase tabular-nums">Page {paretoPage} OF {lossDriverPageCount}</span>
                      <div className="flex gap-1 mt-2">
                        {Array.from({ length: Math.min(5, lossDriverPageCount) }).map((_, i) => (
                          <div key={i} className={`h-1 rounded-full transition-all ${paretoPage === i + 1 ? 'w-5 bg-brand' : 'w-1 bg-slate-200'}`}></div>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => setParetoPage(p => Math.min(lossDriverPageCount, p + 1))}
                      disabled={paretoPage === lossDriverPageCount}
                      className="p-3 bg-white text-slate-400 rounded-xl border border-slate-200 hover:bg-slate-900 hover:text-white transition-all shadow-sm disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-400"
                      aria-label="Next page"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>

              </div>

              {/* --- Section 3: Performance Calendar (RESTORED) --- */}
              <section className="w-full bg-white rounded-[2.8rem] border border-slate-100 shadow-sm overflow-hidden group mb-20">
                <div className="px-8 py-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/30">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white mr-4 group-hover:bg-brand transition-colors">
                      <CalendarDays size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Operational Heatmap</h2>
                      <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest">Temporal distribution of fiscal leakage</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center bg-white border border-slate-100 px-4 py-2 rounded-xl text-[9px] font-black text-slate-400 space-x-3">
                      <div className="flex items-center"><div className="w-2 h-2 bg-slate-100 rounded-sm mr-2"></div> Low</div>
                      <div className="flex items-center"><div className="w-2 h-2 bg-brand/40 rounded-sm mr-2"></div> Med</div>
                      <div className="flex items-center"><div className="w-2 h-2 bg-brand rounded-sm mr-2"></div> High</div>
                    </div>
                  </div>
                </div>
                <div className="p-4 md:p-6 overflow-x-auto custom-scrollbar">
                  <DailyPerformanceCalendar sales={sales} />
                </div>
              </section>

              {/* --- Section 3.1: STOCK-STYLE TREND ANALYSIS --- */}
              <section className="mb-20 overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-900/20">
                <div className="border-b border-white/10 px-6 py-6 md:px-8">
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white ${
                        operationalTrendSummary.delta > 0 ? 'bg-red-600' : operationalTrendSummary.delta < 0 ? 'bg-emerald-600' : 'bg-sky-600'
                      }`}>
                        {operationalTrendSummary.delta > 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-black uppercase tracking-tight text-white md:text-2xl">Operational Trend Matrix</h2>
                          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Loss Index</span>
                        </div>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Daily BHD exposure with customer-volume bars</p>
                      </div>
                    </div>

                    <div className="grid w-full grid-cols-2 gap-3 xl:max-w-2xl xl:grid-cols-4">
                      {[
                        { label: 'Last close', value: operationalTrendSummary.lastValue.toFixed(3), prefix: 'BHD', tone: 'text-white' },
                        { label: 'Change', value: `${operationalTrendSummary.delta >= 0 ? '+' : ''}${operationalTrendSummary.deltaAbs.toFixed(3)}`, prefix: 'BHD', tone: operationalTrendSummary.delta > 0 ? 'text-red-300' : operationalTrendSummary.delta < 0 ? 'text-emerald-300' : 'text-sky-300' },
                        { label: 'Volume', value: String(operationalTrendSummary.totalSessions), prefix: 'CX', tone: 'text-amber-200' },
                        { label: 'Days', value: String(operationalTrendSummary.dayCount), prefix: 'D', tone: 'text-slate-200' },
                      ].map(item => (
                        <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                          <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-[9px] font-black uppercase text-slate-500">{item.prefix}</span>
                            <span className={`text-xl font-black tracking-tighter tabular-nums ${item.tone}`}>{item.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="p-4 md:p-6">
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${
                          operationalTrendSummary.delta > 0
                            ? 'border-red-400/20 bg-red-400/10 text-red-200'
                            : operationalTrendSummary.delta < 0
                              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                              : 'border-sky-400/20 bg-sky-400/10 text-sky-200'
                        }`}>
                          <span className={`h-2 w-2 rounded-full ${operationalTrendSummary.delta > 0 ? 'bg-red-400' : operationalTrendSummary.delta < 0 ? 'bg-emerald-400' : 'bg-sky-400'}`}></span>
                          {operationalTrendSummary.trendLabel}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                          <span className="h-2 w-2 rounded-sm bg-slate-500"></span>
                          Volume bars
                        </span>
                      </div>
                      <div className={`w-fit rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${
                        operationalTrendSummary.delta > 0 ? 'border-red-400/20 bg-red-400/10 text-red-200' : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                      }`}>
                        {operationalTrendSummary.delta >= 0 ? '+' : ''}{operationalTrendSummary.delta.toFixed(1)}%
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/60 p-2 shadow-inner shadow-black/30 md:p-4">
                      <OperationalTrendChart data={performanceTrend} />
                    </div>
                  </div>

                  <aside className="border-t border-white/10 p-6 xl:border-l xl:border-t-0">
                    <div className="mb-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Market tape</p>
                      <h3 className="mt-2 text-lg font-black tracking-tight text-white">Operational exposure movement</h3>
                    </div>

                    <div className="space-y-3">
                      {[
                        { label: 'Total exposure', value: `BHD ${operationalTrendSummary.totalImpact.toFixed(3)}`, icon: <BarChart3 size={16} />, color: 'text-white' },
                        { label: 'Average per customer', value: `BHD ${operationalTrendSummary.averageImpact.toFixed(3)}`, icon: <Activity size={16} />, color: 'text-slate-200' },
                        { label: 'Peak session', value: `${operationalTrendSummary.peakDay?.name || 'No data'} · BHD ${(operationalTrendSummary.peakDay?.value || 0).toFixed(3)}`, icon: <ArrowUpRight size={16} />, color: 'text-red-200' },
                        { label: 'Lowest session', value: `${operationalTrendSummary.lowDay?.name || 'No data'} · BHD ${(operationalTrendSummary.lowDay?.value || 0).toFixed(3)}`, icon: <TrendingDown size={16} />, color: 'text-emerald-200' },
                      ].map(item => (
                        <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.17em] text-slate-500">{item.label}</p>
                            <span className="text-slate-500">{item.icon}</span>
                          </div>
                          <p className={`mt-2 text-sm font-black tabular-nums ${item.color}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </aside>
                </div>
              </section>

              <PharmacistActivitySection sales={sales} branches={branches} />
            </>
          ) : null
        }

        {
          viewMode === 'products' ? (
            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm min-h-[600px]">
              <ProductManagementSection />
            </div>
          ) : null
        }
        <div className="h-20"></div>

        {/* عرض حالة الخطأ مع إمكانية إعادة المحاولة - Error State Display */}
        {
          error && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-50 border-2 border-red-200 rounded-2xl p-6 shadow-2xl z-[200] max-w-md animate-in slide-in-from-bottom-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-black text-red-900 uppercase tracking-wide mb-1">System Error</h3>
                  <p className="text-xs text-red-700 mb-3">{error.message}</p>
                  <div className="flex gap-2">
                    {error.retry && (
                      <button
                        onClick={() => {
                          setError(null);
                          error.retry?.();
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-red-700 transition-all"
                      >
                        Retry
                      </button>
                    )}
                    <button
                      onClick={() => setError(null)}
                      className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-red-50 transition-all"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* نظام الإشعارات المنبثقة - Toast Notification UI */}
        {
          toastMessage && (
            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl shadow-2xl z-[200] animate-in slide-in-from-bottom-5 flex items-center gap-3 ${toastMessage.type === 'error' ? 'bg-red-900 text-white' :
              toastMessage.type === 'success' ? 'bg-emerald-600 text-white' :
                'bg-slate-900 text-white'
              }`}>
              <div className={`w-2 h-2 rounded-full ${toastMessage.type === 'error' ? 'bg-red-300 animate-pulse' :
                toastMessage.type === 'success' ? 'bg-emerald-300 animate-pulse' :
                  'bg-slate-300'
                }`}></div>
              <span className="text-sm font-bold">{toastMessage.message}</span>
              <button
                onClick={() => setToastMessage(null)}
                className="ml-4 text-white/60 hover:text-white transition-colors"
                aria-label="Close notification"
              >
                ✕
              </button>
            </div>
          )
        }
      </div>
    </div>
  );
};
