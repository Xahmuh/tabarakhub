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
import { RevenueChart, OperationalTrendChart, ShortageTrendChart, DailyPerformanceCalendar, RangeDatePicker } from '../shared';
import { PharmacistActivitySection } from './PharmacistActivitySection';
import { ProductManagementSection } from '../shared';
import { supabase } from '../../lib/supabase';
import { LostSale, Branch, Product, Shortage } from '../../types';
import { mapBranchName } from '../../utils/excelUtils';
import { isModuleEnabled } from '../../config/clientConfig';
import styles from './dashboard.module.css';

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

  const cleanName = (name: string) => name?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const isCanSelectBranch = user.role === 'manager' || user.role === 'owner' || user.role === 'warehouse' || user.role === 'supervisor';
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

  // وظيفة عرض الإشعارات بدلاً من alert
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    window.dispatchEvent(new CustomEvent('tabarak_toast', { detail: { message, type } }));
  };

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
      let rawData: LostSale[] = await supabase.sales.list(activeBranchId, user.role);
      let rawShortages: Shortage[] = await supabase.shortages.list(activeBranchId, user.role);

      // Store raw data for historical calculations
      setAllSales(rawData);
      setAllShortages(rawShortages);

      // استخدام وظائف التصفية المستخرجة
      const { start, end } = getDateRange(dateType, startDate, endDate);
      rawData = filterByDateRange(rawData, start, end);
      rawShortages = filterByDateRange(rawShortages, start, end);

      setSales(rawData);
      setShortages(rawShortages);
      setPerformanceLogPage(1);
      setBranchPage(1);
    } catch (error) {
      console.error("Critical Failure in Data Sync:", error);
      // معالجة الأخطاء مع إمكانية إعادة المحاولة
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync data';
      setError({
        message: errorMessage,
        retry: syncDashboardData
      });
      showToast(`Data sync failed: ${errorMessage}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [selectedBranch, dateType, startDate, endDate, isAdmin, user.id, user.role, getDateRange, filterByDateRange]);

  useEffect(() => {
    const initializeSystem = async () => {
      const [branchList, productList] = await Promise.all([
        supabase.branches.list(),
        supabase.products.list(user.id)
      ]);
      setBranches(branchList.filter(b => b.role === 'branch'));
      setProducts(productList);
      await syncDashboardData();
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
      if (!target.closest('.export-dropdown-container')) {
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
    const totalRevenue = sales.reduce((acc, sale) => acc + (Number(sale.totalValue) || 0), 0);
    const totalUnits = sales.reduce((acc, sale) => acc + (Number(sale.quantity) || 0), 0);
    const skuCount = new Set(sales.map(s => s.productName)).size;
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
      transferPercentage
    };
  }, [sales]);

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
    const delta = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

    return {
      totalImpact,
      totalSessions,
      averageImpact: totalSessions > 0 ? totalImpact / totalSessions : 0,
      peakDay,
      delta,
      dayCount: performanceTrend.length
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

    // Top Products in Shortage
    const productFrequency: Record<string, number> = {};
    shortages.forEach(s => {
      productFrequency[s.productName] = (productFrequency[s.productName] || 0) + 1;
    });
    const topProducts = Object.entries(productFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([name, count]) => ({ name, count }));

    // Shortage by Branch
    const branchDistribution: Record<string, number> = {};
    shortages.forEach(s => {
      const bName = branches.find(b => b.id === s.branchId)?.name || 'Unknown';
      branchDistribution[bName] = (branchDistribution[bName] || 0) + 1;
    });

    // Shortage by Pharmacist
    const pharmacistActivity: Record<string, number> = {};
    shortages.forEach(s => {
      pharmacistActivity[s.pharmacistName] = (pharmacistActivity[s.pharmacistName] || 0) + 1;
    });

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
      lowCount,
      criticalCount,
      outOfStockCount,
      topProducts,
      branchDistribution,
      pharmacistActivity,
      avgCriticalHours,
      trendTimeline
    };
  }, [shortages, branches, sales, allSales]);


  // --- Operational Handlers ---

  const fetchAllPages = async (baseQuery: any): Promise<any[]> => {
    const PAGE_SIZE = 1000;
    let from = 0;
    let all: any[] = [];
    while (true) {
      const { data, error } = await baseQuery.range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all = [...all, ...data];
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return all;
  };

  const sanitizeExportFilePart = (value: string) =>
    value
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'Branch';

  const resolveExportScope = () => {
    if (user.role === 'manager') {
      if (selectedBranch === 'all') {
        return {
          branchId: null,
          label: 'All Branches',
          filePart: 'All_Branches',
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

    throw new Error('Only manager accounts can export all branches. Select one branch before exporting.');
  };

  const applyExportFilters = (query: any, scope: ReturnType<typeof resolveExportScope>) => {
    const { start, end } = getDateRange(dateType, startDate, endDate);
    if (start) query = query.gte('timestamp', start.toISOString());
    if (end) query = query.lte('timestamp', end.toISOString());
    if (scope.branchId) query = query.eq('branch_id', scope.branchId);
    return query.order('timestamp', { ascending: false });
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
      const exportScope = resolveExportScope();

      // Fetch data directly from the Standardized View
      let query = supabase.client
        .from('lost_sales_excel_export')
        .select('*');

      query = applyExportFilters(query, exportScope);
      const viewData = await fetchAllPages(query);

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
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
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
      const exportScope = resolveExportScope();

      // Fetch data directly from the Standardized View
      let query = supabase.client
        .from('shortages_excel_export')
        .select('*');

      query = applyExportFilters(query, exportScope);
      const viewData = await fetchAllPages(query);
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
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
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
      const exportScope = resolveExportScope();

      // --- 1. FETCH SALES & SHORTAGES IN PARALLEL ---
      let salesQuery = supabase.client.from('lost_sales_excel_export').select('*');
      let shortagesQuery = supabase.client.from('shortages_excel_export').select('*');

      salesQuery = applyExportFilters(salesQuery, exportScope);
      shortagesQuery = applyExportFilters(shortagesQuery, exportScope);

      const [salesData, shortagesData] = await Promise.all([
        fetchAllPages(salesQuery),
        fetchAllPages(shortagesQuery),
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
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
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
                <div className="relative">
                  <button onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                    className="flex items-center gap-3 px-5 py-3.5 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-red-200 transition-all">
                    <MapPin size={15} className="text-red-600" />
                    <span className="max-w-[120px] truncate">{activeBranchLabel}</span>
                    <ChevronDown size={13} className={`transition-transform duration-500 ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                {isBranchDropdownOpen && (
                  <div className="absolute top-full right-0 mt-3 w-80 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-4 z-[100] animate-in zoom-in-95 duration-300">
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="Search branches..."
                          value={branchSearchTerm}
                          onChange={(e) => setBranchSearchTerm(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 pl-9 pr-4 py-2.5 rounded-xl text-[10px] font-black uppercase outline-none focus:border-red-200 transition-all"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                      <button
                        onClick={() => {
                          setSelectedBranch('all');
                          setIsBranchDropdownOpen(false);
                          setBranchSearchTerm('');
                        }}
                        className={`w-full text-left p-4 rounded-xl transition-all group ${selectedBranch === 'all' ? 'bg-red-900 text-white shadow-lg' : 'hover:bg-slate-50'}`}
                      >
                        <p className="text-[10px] font-black uppercase tracking-widest">Global Central Console</p>
                        <p className={`text-[8px] font-bold uppercase mt-1 tracking-tighter ${selectedBranch === 'all' ? 'text-white/60' : 'text-slate-400'}`}>All Branches Combined</p>
                      </button>

                      <div className="h-px bg-slate-100 my-2 mx-2"></div>

                      {branches
                        .filter(b => b.name.toLowerCase().includes(branchSearchTerm.toLowerCase()))
                        .map(b => (
                          <button
                            key={b.id}
                            onClick={() => {
                              setSelectedBranch(b.id);
                              setIsBranchDropdownOpen(false);
                              setBranchSearchTerm('');
                            }}
                            className={`w-full text-left p-4 rounded-xl transition-all ${selectedBranch === b.id ? 'bg-red-900 text-white shadow-lg' : 'hover:bg-slate-50'}`}
                          >
                            <p className="text-[10px] font-black uppercase tracking-widest">{b.name}</p>
                            <p className={`text-[8px] font-bold uppercase mt-1 tracking-tighter ${selectedBranch === b.id ? 'text-white/60' : 'text-slate-400'}`}>Pharmacy Branch Node</p>
                          </button>
                        ))
                      }

                      {branches.filter(b => b.name.toLowerCase().includes(branchSearchTerm.toLowerCase())).length === 0 && (
                        <div className="py-8 text-center">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No branches found</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

              <div className="relative">
                <button onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  className="flex items-center gap-3 px-5 py-3.5 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-red-200 transition-all">
                  <CalendarDays size={15} className="text-red-600" />
                <span>{dateType === 'today' ? 'Today' : dateType === 'yesterday' ? 'Yesterday' : dateType === '7d' ? 'Last 7 Days' : dateType === 'month' ? 'Last Month' : dateType === 'custom' ? 'Custom Period' : 'Archive View'}</span>
                <ChevronDown size={14} />
              </button>
              {isDatePickerOpen && (
                <div className={`absolute top-full right-0 mt-3 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-4 z-[100] animate-in slide-in-from-top-5 duration-300 ${dateType === 'custom' ? 'w-auto' : 'w-72'}`}>
                  {dateType !== 'custom' ? (
                    <div className="grid grid-cols-1 gap-1.5">
                      {[
                        { id: 'all', label: 'All Time', sub: 'Total Historical Archive' },
                        { id: 'today', label: 'Today', sub: 'Active Duty Records' },
                        { id: 'yesterday', label: 'Yesterday', sub: 'Previous Day Performance' },
                        { id: '7d', label: 'Last 7 Days', sub: 'Weekly Performance' },
                        { id: 'month', label: 'Last Month', sub: '30-Day Fiscal Cycle' },
                        { id: 'custom', label: 'Choose Period', sub: 'Manual Calendar Protocol' }
                      ].map(t => (
                        <button key={t.id} onClick={() => {
                          // إعادة تعيين التواريخ عند التغيير من custom
                          if (dateType === 'custom' && t.id !== 'custom') {
                            setStartDate('');
                            setEndDate('');
                            setManualStart('');
                            setManualEnd('');
                          }
                          setDateType(t.id as any);
                          if (t.id !== 'custom') setIsDatePickerOpen(false);
                        }}
                          className={`w-full text-left p-4 rounded-xl transition-all ${dateType === t.id ? 'bg-red-900 text-white shadow-lg' : 'hover:bg-slate-50'}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest">{t.label}</p>
                          <p className={`text-[8px] font-bold ${dateType === t.id ? 'text-white/60' : 'text-slate-400'} uppercase mt-1 tracking-tighter`}>{t.sub}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="w-[280px] p-2 space-y-4">
                      <div className="space-y-3">
                        <div>
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">From (DD-MM-YYYY)</label>
                          <input
                            type="text"
                            placeholder="01-01-2026"
                            value={manualStart}
                            onChange={(e) => setManualStart(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl text-[10px] font-black outline-none focus:border-red-600 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">To (DD-MM-YYYY)</label>
                          <input
                            type="text"
                            placeholder="31-01-2026"
                            value={manualEnd}
                            onChange={(e) => setManualEnd(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl text-[10px] font-black outline-none focus:border-red-600 transition-all"
                          />
                        </div>
                      </div>
                      <button
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
                        className="w-full bg-slate-900 text-white p-3.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg hover:bg-red-800 transition-all"
                      >
                        Confirm Period
                      </button>
                      <button
                        onClick={() => {
                          setManualStart('');
                          setManualEnd('');
                          setStartDate('');
                          setEndDate('');
                          setDateType('all');
                          setIsDatePickerOpen(false);
                        }}
                        className="w-full text-slate-400 text-[8px] font-black uppercase tracking-widest hover:text-red-600 transition-colors"
                      >
                        Reset Filter
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

              {isModuleEnabled('excelExport') && (
              <div className="relative export-dropdown-container">
                <button
                  onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                  className="flex items-center gap-2.5 px-6 py-3.5 bg-red-700 hover:bg-red-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-700/20 hover:-translate-y-0.5"
                >
                <Download size={18} />
                <span>Export</span>
                <ChevronDown size={14} className={`transition-transform duration-300 ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isExportDropdownOpen && (
                <div className="absolute top-full right-0 mt-3 w-80 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-3 z-[100] animate-in zoom-in-95 duration-300">
                  <div className="space-y-1.5">
                    <button
                      onClick={exportLostSales}
                      className="w-full text-left p-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all group flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-red-600">
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
                      onClick={exportShortage}
                      className="w-full text-left p-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all group flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
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
                      onClick={exportCombined}
                      className="w-full text-left p-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-red-900 transition-all group flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white">
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
                <button
                  onClick={onBack}
                  className="px-5 py-3.5 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-slate-200 hover:text-slate-900 transition-all whitespace-nowrap"
                >
                Back to Operational Suite
              </button>
            )}
          </div>
        </header>



          {/* Tabs Navigation */}
          <div className="flex justify-center mb-10">
            <div className="tab-nav p-1.5 rounded-2xl">
              {salesPerm !== 'none' && (
                <button
                  onClick={() => changeViewMode('standard')}
                  className={`tab-item px-7 py-3 rounded-xl ${viewMode === 'standard' ? 'bg-slate-900 text-white shadow-lg' : ''}`}
                >
                  Revenue Lost Analysis
                </button>
              )}
              {shortagesPerm !== 'none' && (
                <button
                  onClick={() => changeViewMode('expanded')}
                  className={`tab-item px-7 py-3 rounded-xl ${viewMode === 'expanded' ? 'bg-slate-900 text-white shadow-lg' : ''}`}
                >
                  Inventory Shortages
                </button>
              )}
              {(user.role === 'manager') && (
                <button
                  onClick={() => changeViewMode('products')}
                  className={`tab-item px-7 py-3 rounded-xl flex items-center gap-2 ${viewMode === 'products' ? 'bg-slate-900 text-white shadow-lg' : ''}`}
                >
                  <Package size={16} />
                  Product Catalogue
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
                  <div className="mt-16">
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="h-px bg-slate-100 flex-1"></div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] whitespace-nowrap">Recovery & Transfer Performance</h3>
                      <div className="h-px bg-slate-100 flex-1"></div>
                    </div>

                    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
                      {/* % Alt Given */}
                      <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col items-center text-center group hover:-translate-y-1 transition-all duration-500">
                        <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <Sparkles size={24} />
                        </div>
                        <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1">% Alt Given</p>
                        <p className="text-2xl font-black text-white tracking-tighter">{aggregateMetrics.altPercentage.toFixed(1)}%</p>
                        <div className="mt-4 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={styles.progressBarAlt}
                            style={{ '--progress-width': `${aggregateMetrics.altPercentage}%` } as React.CSSProperties}
                          ></div>
                        </div>
                      </div>

                      {/* Alt Recovery Revenue */}
                      <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col items-center text-center group hover:-translate-y-1 transition-all duration-500">
                        <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                          <Banknote size={24} />
                        </div>
                        <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1">Alt Recovery Revenue</p>
                        <div className="flex items-end gap-1">
                          <p className="text-[10px] font-black text-emerald-500 mb-1.5">BHD</p>
                          <p className="text-2xl font-black text-white tracking-tighter">{aggregateMetrics.altRevenue.toFixed(3)}</p>
                        </div>
                        <p className="text-[8px] text-white/30 font-bold uppercase mt-2">{aggregateMetrics.altCount} Success Cases</p>
                      </div>

                      {/* % Transfer Used */}
                      <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col items-center text-center group hover:-translate-y-1 transition-all duration-500">
                        <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <RefreshCcw size={24} />
                        </div>
                        <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1">% Transfer Used</p>
                        <p className="text-2xl font-black text-white tracking-tighter">{aggregateMetrics.transferPercentage.toFixed(1)}%</p>
                        <div className="mt-4 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={styles.progressBarTransfer}
                            style={{ '--progress-width': `${aggregateMetrics.transferPercentage}%` } as React.CSSProperties}
                          ></div>
                        </div>
                      </div>

                      {/* Transfer Revenue */}
                      <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col items-center text-center group hover:-translate-y-1 transition-transform duration-500 transform-gpu">
                        <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                          <Truck size={24} />
                        </div>
                        <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1">Transfer Revenue</p>
                        <div className="flex items-end gap-1">
                          <p className="text-[10px] font-black text-emerald-500 mb-1.5">BHD</p>
                          <p className="text-2xl font-black text-white tracking-tighter">{aggregateMetrics.transferRevenue.toFixed(3)}</p>
                        </div>
                        <p className="text-[8px] text-white/30 font-bold uppercase mt-2">{aggregateMetrics.transferCount} Stock Requests</p>
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
                              {(user.role === 'branch' || user.role === 'manager') && (
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
              {/* --- Section 2.4: Shortage analytical Intelligence Engine --- */}
              {user.isKPIDashboardEnabled !== false && (
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                  <StrategicKPI label="Low Stock Items" value={shortageMetrics.lowCount} icon={<Box size={20} />} critical={true} description="stock below Minimum level" unit="SKU" />
                  <StrategicKPI label="Critical Escalations" value={shortageMetrics.criticalCount} icon={<AlertTriangle size={20} />} critical={true} description="last Piece on shelf" unit="SKU" />
                  <StrategicKPI label="Absolute Stockouts" value={shortageMetrics.outOfStockCount} icon={<PackageX size={20} />} critical={true} description="Zero Stock" unit="SKU" />
                </section>
              )}

              {/* --- Section 2.5: Branch Shortages Module (UPPER PRIMARY POSITION) --- */}
              <section className="bg-white rounded-[2.8rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col mb-8">
                <div className="px-8 py-6 border-b border-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-50/30">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white mr-4 shrink-0">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Branch Shortages</h2>
                      <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest">Live Inventory Gap Reports</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setShortageStatusFilter(shortageStatusFilter === 'Low' ? null : 'Low');
                          setBranchPage(1);
                        }}
                        className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${shortageStatusFilter === 'Low'
                          ? 'bg-yellow-400 text-white shadow-lg'
                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          }`}
                      >
                        Low
                      </button>
                      <button
                        onClick={() => {
                          setShortageStatusFilter(shortageStatusFilter === 'Critical' ? null : 'Critical');
                          setBranchPage(1);
                        }}
                        className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${shortageStatusFilter === 'Critical'
                          ? 'bg-red-500 text-white shadow-lg'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                      >
                        Critical
                      </button>
                      <button
                        onClick={() => {
                          setShortageStatusFilter(shortageStatusFilter === 'Out of Stock' ? null : 'Out of Stock');
                          setBranchPage(1);
                        }}
                        className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${shortageStatusFilter === 'Out of Stock'
                          ? 'bg-slate-900 text-white shadow-lg'
                          : 'bg-slate-800 text-white/50 hover:bg-slate-900 hover:text-white'
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
                          className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          <RefreshCcw size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6 md:p-8 overflow-x-auto min-h-[820px] flex flex-col">
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
                                        {(user.role === 'branch' || user.role === 'manager') && (
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Hot Shortage SKUs (Paginated - Left Side) */}
                <div className="lg:col-span-2 bg-white rounded-[2.8rem] p-10 border border-slate-100 shadow-sm flex flex-col min-h-[600px]">
                  <div className="flex items-center justify-between mb-10">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase flex items-center">
                        <Zap className="mr-3 text-brand" size={24} /> Hot Shortage SKUs
                      </h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase mt-1 tracking-widest">Recurring inventory gaps across global nodes</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setHotShortagePage(p => Math.max(1, p - 1))} // منع الصفحة 0
                        disabled={hotShortagePage === 1}
                        className="p-3 bg-slate-50 rounded-xl hover:bg-slate-900 hover:text-white transition-all disabled:opacity-20 shadow-sm"
                        aria-label="Previous batch"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <div className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black tabular-nums shadow-lg">
                        BATCH {hotShortagePage} / {Math.max(1, Math.ceil(shortageMetrics.topProducts.length / 5))}
                      </div>
                      <button
                        onClick={() => setHotShortagePage(p => Math.min(Math.max(1, Math.ceil(shortageMetrics.topProducts.length / 5)), p + 1))}
                        disabled={hotShortagePage === Math.ceil(shortageMetrics.topProducts.length / 5)}
                        className="p-3 bg-slate-50 rounded-xl hover:bg-slate-900 hover:text-white transition-all disabled:opacity-20 shadow-sm"
                        aria-label="Next batch"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    {shortageMetrics.topProducts.slice((hotShortagePage - 1) * 5, hotShortagePage * 5).map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 hover:border-brand hover:bg-white transition-all group cursor-default">
                        <div className="flex items-center space-x-4 overflow-hidden">
                          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center font-black text-[10px] md:text-xs shadow-sm transition-colors ${p.isPriority ? 'bg-brand text-white' : 'bg-white text-slate-300'}`}>
                            {(hotShortagePage - 1) * 5 + i + 1}
                          </div>
                          <div>
                            <span className="font-black text-slate-900 text-sm md:text-base tracking-tight block">{p.name}</span>
                            <div className="flex items-center mt-1 space-x-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"></span>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">High Volatility SKU</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Reporting Frequency</p>
                          <span className="px-5 py-2 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-wider group-hover:bg-brand transition-colors shadow-sm">{p.count} Reports</span>
                        </div>
                      </div>
                    ))}
                    {shortageMetrics.topProducts.length === 0 && (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-200 py-10">
                        <Package size={64} className="mb-4 opacity-10" />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] opacity-30">Zero recurring gaps identified</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side Column (Stacked Logs) */}
                <div className="flex flex-col gap-8">
                  {/* Node Reporting Log */}
                  <div className="flex-1 bg-white rounded-[2.8rem] p-10 border border-slate-100 shadow-sm flex flex-col min-h-[350px]">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Branch Sales Log</h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest"></p>
                      </div>
                      <MonitorCheck className="text-brand shrink-0" size={24} />
                    </div>
                    <div className="space-y-6 flex-1 pr-2 overflow-y-auto custom-scrollbar">
                      {Object.entries(shortageMetrics.branchDistribution).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 5).map(([name, count], i) => (
                        <div key={i} className="group cursor-default">
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight truncate max-w-[140px]">{name}</span>
                            <span className="text-[10px] font-black text-slate-900 tabular-nums">{count} reports</span>
                          </div>
                          <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100 relative">
                            <div
                              className={styles.progressBarBranch}
                              style={{ '--progress-width': `${(Number(count) / Math.max(1, shortages.length)) * 100}%` } as React.CSSProperties}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>


                  {/* Pharmacist Accountability (Bottom of Right Stack) */}
                  <div className="flex-1 bg-white rounded-[2.8rem] p-10 border border-slate-100 shadow-sm flex flex-col min-h-[350px]">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Responsibility Tracking</h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest">Team Sales Accountability</p>
                      </div>
                      <UserCheck className="text-brand shrink-0" size={24} />
                    </div>
                    <div className="space-y-4 flex-1 pr-2 overflow-y-auto custom-scrollbar">
                      {Object.entries(shortageMetrics.pharmacistActivity).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 5).map(([name, count], i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-[1.2rem] border border-slate-50 hover:border-brand transition-all group">
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight truncate max-w-[120px]">{name}</span>
                          <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-black tabular-nums">{count} Logged</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* --- Section 2.7: Shortage Trend Dynamic Matrix --- */}
              <section className="w-full bg-white rounded-[2.8rem] border border-slate-100 shadow-sm overflow-hidden group mb-20 p-8 md:p-12 relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none"></div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 relative z-10">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white mr-4 group-hover:bg-brand transition-colors">
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Shortage Trend Matrix</h2>
                      <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest">Inventory Gap Volatility analysis</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="underline decoration-red-500/30 decoration-2 underline-offset-4">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Out of Stock Count</span>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                      </div>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Zero Inventory Incidents</p>
                    </div>
                    <div className="w-px h-8 bg-slate-100 italic"></div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="underline decoration-amber-500/30 decoration-2 underline-offset-4">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Critical Escalations</span>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></div>
                      </div>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Last Piece Thresholds</p>
                    </div>
                    <div className="w-px h-8 bg-slate-100 italic"></div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="underline decoration-yellow-500/30 decoration-2 underline-offset-4">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Low Stock Items</span>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-yellow-500 shrink-0"></div>
                      </div>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Below Min. Level</p>
                    </div>
                  </div>
                </div>

                <div className="relative h-[350px] w-full">
                  <ShortageTrendChart data={shortageMetrics.trendTimeline} />
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

                {/* TOP LOSS DRIVERS (Filtered Product Impact) */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[640px]">
                  <div className="p-6 md:p-8 bg-slate-50/80 border-b border-slate-100">
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                          <Target size={20} />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase">Top Loss Drivers</h2>
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
              <section className="w-full bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden group mb-20">
                <div className="px-6 py-6 md:px-8 md:py-7 bg-slate-50/70 border-b border-slate-100">
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                    <div className="flex items-center min-w-0">
                      <div className="w-11 h-11 bg-slate-900 rounded-xl flex items-center justify-center text-white mr-4 group-hover:bg-brand transition-colors shrink-0">
                        <TrendingUp size={20} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight uppercase">Operational Trend Matrix</h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-[0.16em]">Daily revenue impact and affected-customer trend</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm w-full xl:max-w-3xl divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                      <div className="px-5 py-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">Total Impact</p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[10px] font-black text-emerald-600 uppercase">BHD</span>
                          <span className="text-xl font-black text-slate-900 tracking-tight tabular-nums">{operationalTrendSummary.totalImpact.toFixed(3)}</span>
                        </div>
                      </div>
                      <div className="px-5 py-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">Affected Sessions</p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xl font-black text-slate-900 tracking-tight tabular-nums">{operationalTrendSummary.totalSessions}</span>
                          <span className="text-[10px] font-black text-amber-600 uppercase">Customers</span>
                        </div>
                      </div>
                      <div className="px-5 py-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">Average Loss</p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[10px] font-black text-emerald-600 uppercase">BHD</span>
                          <span className="text-xl font-black text-slate-900 tracking-tight tabular-nums">{operationalTrendSummary.averageImpact.toFixed(3)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 md:p-8">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.14em]">BHD Revenue Impact</span>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-[0.14em]">Lost Customers</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                        Peak: <span className="text-slate-900">{operationalTrendSummary.peakDay?.name || 'No data'}</span>
                      </span>
                      <span className={`rounded-full border px-3 py-1.5 ${operationalTrendSummary.delta > 0 ? 'border-red-200 bg-red-50 text-red-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                        {operationalTrendSummary.delta >= 0 ? '+' : ''}{operationalTrendSummary.delta.toFixed(1)}%
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                        {operationalTrendSummary.dayCount} Days
                      </span>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-100 bg-white p-2 md:p-4 shadow-inner shadow-slate-100/60">
                    <OperationalTrendChart data={performanceTrend} />
                  </div>
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
