import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  FileDown,
  Gauge,
  Layers,
  Languages,
  MapPinned,
  Package,
  Printer,
  Search,
  ShieldCheck,
  Store,
  Truck,
  UserMinus,
  Wallet,
  X
} from 'lucide-react';
import { Branch, DeliveryOrder, DeliveryPaymentType, Governorate } from '../../types';
import { BackToModulesButton } from '../shared';
import { PeriodFilter } from '../delivery/components/PeriodFilter';
import { SearchableSelect } from '../delivery/components/SearchableSelect';
import { BlockCoverageMap, BlockCoverageMapLoading } from '../delivery/components/BlockCoverageMap';
import { BlockGeometryDataset, loadBahrainBlockGeometry } from '../delivery/bahrainBlockGeometry';
import { exportBreakdownToExcel, exportOrdersToExcel, printReport } from '../delivery/exports';
import { PeriodPreset, formatBhd, getPresetRange, periodLabel, todayKey } from '../delivery/utils';
import { deliveryService } from '../../services/deliveryService';
import { isModuleEnabled } from '../../config/clientConfig';
import {
  OwnerBranchKpi,
  OwnerDashboardBundle,
  OwnerDashboardSection,
  OwnerDriverKpi,
  ownerDashboardService
} from './ownerDashboardService';
import { buildOwnerZoneAnalysis, ownerGeometryStats, ownerMapBlocksWithGeometry } from './ownerZoneAnalysis';

const GOVERNORATES: Governorate[] = ['Capital', 'Muharraq', 'Northern', 'Southern'];
const PAYMENT_TYPES: DeliveryPaymentType[] = ['BP', 'CARD', 'CASH', 'TALABAT'];
const OWNER_DASHBOARD_LANGUAGE_KEY = 'tabarak-owner-dashboard-language';

type OwnerDashboardLanguage = 'en' | 'ar';

interface OwnerDashboardPageProps {
  user: Branch;
  onBack: () => void;
}

const formatPercent = (value: number) => `${Number(value || 0).toFixed(1)}%`;
const compactDateTime = (value?: string, locale?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const classNames = (...items: Array<string | false | null | undefined>) => items.filter(Boolean).join(' ');

const ownerDashboardText = {
  en: {
    direction: 'ltr',
    locale: undefined,
    languageLabel: 'Language',
    english: 'English',
    arabic: 'Arabic',
    backToModules: 'Back to Modules',
    noWriteActions: 'No write actions',
    periodPresets: {
      today: 'Today',
      yesterday: 'Yesterday',
      month: 'This month',
      custom: 'Custom'
    },
    common: {
      empty: '-',
      unknown: 'Unknown',
      unknownBranch: 'Unknown branch',
      unassigned: 'Unassigned',
      noBlock: 'No block',
      active: 'Active',
      inactive: 'Inactive',
      health: 'Health',
      delivery: 'delivery',
      criticalShortages: 'critical shortages',
      orders: 'orders',
      ordersPerDay: 'orders/day',
      avg: 'Avg',
      selectedRange: 'selected range',
      directOrders: 'direct orders',
      dataQuality: 'data quality',
      uniqueBlocks: 'unique blocks',
      topBlock: 'Top block',
      topDriver: 'Top driver',
      knownBlockOrders: 'known-block orders',
      noBlockByDesign: 'no block by design'
    },
    header: {
      eyebrow: 'Read-only owner view',
      title: 'Owner Dashboard',
      subtitle: 'Services performance, delivery traceability, Bahrain map zones, driver KPIs, and pharmacy KPIs in one executive view.'
    },
    today: {
      orders: 'Today orders',
      directTalabat: 'Today direct / Talabat',
      marketplace: 'WhatsApp vs marketplace',
      lostSales: 'Today lost sales',
      lostSalesSub: 'service availability signal',
      lostCustomers: 'Today lost customers',
      lostCustomersSub: 'customer requests not fulfilled',
      shortages: 'Critical shortages',
      shortagesSub: 'Critical + out of stock'
    },
    actions: {
      overviewExcel: 'Overview Excel',
      blockExcel: 'Block Excel',
      traceExcel: 'Trace Excel',
      driverExcel: 'Driver Excel',
      branchExcel: 'Branch Excel',
      pdfPrint: 'PDF / Print',
      exportAll: 'Export all',
      exportDrivers: 'Export drivers',
      exportBranches: 'Export branches',
      clearFilters: 'Clear filters',
      openPharmacies: 'Open pharmacies'
    },
    filters: {
      allBranches: 'All branches',
      allPayments: 'All payments',
      allDrivers: 'All drivers',
      allGovernorates: 'All governorates',
      search: 'Search block, area, branch, driver...',
      selectSearch: 'Search...',
      noMatches: 'No matches',
      mapFilterNote: 'Driver/search filters affect KPIs and traceability; the map uses date, branch, payment, and governorate filters.'
    },
    sections: {
      overview: 'Overview',
      map: 'Delivery Map',
      traceability: 'Traceability',
      drivers: 'Drivers',
      pharmacies: 'Pharmacies'
    },
    overview: {
      deliveryEyebrow: 'Delivery performance',
      deliveryTitle: 'Orders, value, blocks, and routing quality',
      lostEyebrow: 'Lost sales tracking',
      lostTitle: 'Demand leakage, lost customers, and stock risk',
      orders: 'Orders',
      deliveryValue: 'Delivery value',
      direct: 'Direct',
      talabat: 'Talabat',
      knownBlocks: 'Known blocks',
      unknownBlocks: 'Unknown blocks',
      outsideGov: 'Outside gov.',
      totalLostSales: 'Total lost sales',
      lostCustomers: 'Lost customers',
      lostItemRequests: 'lost item requests',
      noRecovery: 'No recovery',
      noRecoverySub: 'no alternative or transfer',
      shortageRisk: 'Shortage risk',
      shortageRiskSub: 'critical + out of stock',
      ownerAttention: 'Owner attention',
      noBranchRisk: 'No critical branch risk in the selected scope.',
      noDriverRisk: 'Driver productivity has no critical alert.',
      lowestPharmacyHealth: 'Lowest pharmacy health',
      lowestPharmacySub: 'Sorted by risk score; owner can drill into pharmacy KPIs.'
    },
    map: {
      title: 'Bahrain delivery map & zones',
      core: 'core',
      standard: 'standard',
      extended: 'extended',
      outsideRange: 'outside range',
      unavailableTitle: 'Map geometry is unavailable.',
      unavailableSub: 'Matrix fallback: top known delivery blocks are still shown from live records.'
    },
    traceability: {
      title: 'Delivery traceability log',
      noOrders: 'No delivery orders match the current filters.',
      selectedOrder: 'Selected order',
      selectOrder: 'Select an order',
      selectOrderSub: 'Order details and read-only audit timeline appear here.',
      date: 'Date',
      branch: 'Branch',
      driver: 'Driver',
      payment: 'Payment',
      block: 'Block',
      area: 'Area',
      value: 'Value',
      pharmacist: 'Pharmacist',
      governorate: 'Governorate',
      created: 'Created'
    },
    audit: {
      title: 'Audit timeline',
      loading: 'Loading audit trail...',
      empty: 'No audit events returned. This can mean the order has not been edited/deleted, or the target Supabase project still needs the owner read-only audit policy migration.',
      by: 'By',
      change: 'change'
    },
    drivers: {
      title: 'Driver KPIs & cost efficiency',
      subtitle: 'Cost/order and estimated net are visible to owner, but no cost settings can be edited.',
      driver: 'Driver',
      orders: 'Orders',
      value: 'Value',
      ordersDay: 'Orders/day',
      costOrder: 'Cost/order',
      estimatedNet: 'Est. net',
      class: 'Class'
    },
    pharmacies: {
      title: 'Pharmacy KPIs',
      subtitle: 'Delivery + lost sales + shortages combined into an owner health view.',
      pharmacy: 'Pharmacy',
      health: 'Health',
      delivery: 'Delivery',
      value: 'Value',
      blocks: 'Blocks',
      unknown: 'Unknown %',
      outsideGov: 'Outside gov.',
      lostSales: 'Lost sales',
      noRecovery: 'No recovery',
      shortageRisk: 'Shortage risk'
    },
    footer: 'Owner view is read-only by design. Export and print are allowed because they do not mutate operational data.',
    governorates: {
      Capital: 'Capital',
      Muharraq: 'Muharraq',
      Northern: 'Northern',
      Southern: 'Southern'
    },
    statusLabels: {
      optimum: 'optimum',
      in_range: 'in range',
      no_cost_data: 'no cost data',
      low_efficiency: 'low efficiency',
      loss_making: 'loss making',
      healthy: 'healthy',
      watch: 'watch',
      risk: 'risk',
      critical: 'critical',
      insufficient_data: 'insufficient data'
    }
  },
  ar: {
    direction: 'rtl',
    locale: 'ar-BH',
    languageLabel: 'اللغة',
    english: 'English',
    arabic: 'العربية',
    backToModules: 'الرجوع للموديولات',
    noWriteActions: 'عرض فقط بدون تعديل',
    periodPresets: {
      today: 'اليوم',
      yesterday: 'أمس',
      month: 'هذا الشهر',
      custom: 'مخصص'
    },
    common: {
      empty: '-',
      unknown: 'غير معروف',
      unknownBranch: 'فرع غير معروف',
      unassigned: 'غير محدد',
      noBlock: 'لا يوجد بلوك',
      active: 'نشط',
      inactive: 'غير نشط',
      health: 'الصحة',
      delivery: 'توصيل',
      criticalShortages: 'نواقص حرجة',
      orders: 'طلبات',
      ordersPerDay: 'طلب/يوم',
      avg: 'متوسط',
      selectedRange: 'الفترة المختارة',
      directOrders: 'طلبات مباشرة',
      dataQuality: 'جودة البيانات',
      uniqueBlocks: 'بلوكات مختلفة',
      topBlock: 'أعلى بلوك',
      topDriver: 'أفضل سائق',
      knownBlockOrders: 'طلبات ببلوك معروف',
      noBlockByDesign: 'بدون بلوك حسب تصميم الطلب'
    },
    header: {
      eyebrow: 'عرض المالك للقراءة فقط',
      title: 'لوحة تحكم المالك',
      subtitle: 'أداء الخدمات، تتبع التوصيل، خريطة بلوكات البحرين، مؤشرات السائقين، ومؤشرات الصيدليات في شاشة تنفيذية واحدة.'
    },
    today: {
      orders: 'طلبات اليوم',
      directTalabat: 'مباشر / طلبات اليوم',
      marketplace: 'واتساب مقابل ماركت بليس',
      lostSales: 'المبيعات المفقودة اليوم',
      lostSalesSub: 'مؤشر توفر الخدمة',
      lostCustomers: 'العملاء المفقودون اليوم',
      lostCustomersSub: 'طلبات عملاء لم يتم تلبيتها',
      shortages: 'النواقص الحرجة',
      shortagesSub: 'حرج + غير متوفر'
    },
    actions: {
      overviewExcel: 'تصدير الملخص',
      blockExcel: 'تصدير البلوكات',
      traceExcel: 'تصدير التتبع',
      driverExcel: 'تصدير السائقين',
      branchExcel: 'تصدير الفروع',
      pdfPrint: 'طباعة / PDF',
      exportAll: 'تصدير الكل',
      exportDrivers: 'تصدير السائقين',
      exportBranches: 'تصدير الفروع',
      clearFilters: 'مسح الفلاتر',
      openPharmacies: 'فتح الصيدليات'
    },
    filters: {
      allBranches: 'كل الفروع',
      allPayments: 'كل طرق الدفع',
      allDrivers: 'كل السائقين',
      allGovernorates: 'كل المحافظات',
      search: 'ابحث عن بلوك، منطقة، فرع، سائق...',
      selectSearch: 'بحث...',
      noMatches: 'لا توجد نتائج',
      mapFilterNote: 'فلاتر السائق والبحث تؤثر على المؤشرات والتتبع؛ الخريطة تستخدم التاريخ والفرع وطريقة الدفع والمحافظة.'
    },
    sections: {
      overview: 'الملخص',
      map: 'خريطة التوصيل',
      traceability: 'التتبع',
      drivers: 'السائقون',
      pharmacies: 'الصيدليات'
    },
    overview: {
      deliveryEyebrow: 'أداء التوصيل',
      deliveryTitle: 'الطلبات، القيمة، البلوكات، وجودة التوزيع',
      lostEyebrow: 'تتبع المبيعات المفقودة',
      lostTitle: 'الطلب غير المحقق، العملاء المفقودون، ومخاطر المخزون',
      orders: 'الطلبات',
      deliveryValue: 'قيمة التوصيل',
      direct: 'مباشر',
      talabat: 'طلبات',
      knownBlocks: 'بلوكات معروفة',
      unknownBlocks: 'بلوكات غير معروفة',
      outsideGov: 'خارج المحافظة',
      totalLostSales: 'إجمالي المبيعات المفقودة',
      lostCustomers: 'العملاء المفقودون',
      lostItemRequests: 'طلبات أصناف مفقودة',
      noRecovery: 'بدون تعويض',
      noRecoverySub: 'لا بديل ولا تحويل داخلي',
      shortageRisk: 'مخاطر النواقص',
      shortageRiskSub: 'حرج + غير متوفر',
      ownerAttention: 'تنبيهات المالك',
      noBranchRisk: 'لا توجد مخاطر حرجة على الفروع ضمن النطاق المختار.',
      noDriverRisk: 'إنتاجية السائقين بدون تنبيه حرج.',
      lowestPharmacyHealth: 'أقل صحة للصيدليات',
      lowestPharmacySub: 'مرتبة حسب درجة المخاطر؛ يمكن للمالك فتح مؤشرات الصيدليات.'
    },
    map: {
      title: 'خريطة التوصيل والزونز في البحرين',
      core: 'أساسي',
      standard: 'قياسي',
      extended: 'ممتد',
      outsideRange: 'خارج النطاق',
      unavailableTitle: 'بيانات الخريطة غير متاحة.',
      unavailableSub: 'البديل الجدولي: أعلى البلوكات المعروفة ما زالت ظاهرة من السجلات الحية.'
    },
    traceability: {
      title: 'سجل تتبع التوصيل',
      noOrders: 'لا توجد طلبات توصيل تطابق الفلاتر الحالية.',
      selectedOrder: 'الطلب المحدد',
      selectOrder: 'اختر طلب',
      selectOrderSub: 'تفاصيل الطلب وسجل التدقيق للقراءة فقط يظهران هنا.',
      date: 'التاريخ',
      branch: 'الفرع',
      driver: 'السائق',
      payment: 'الدفع',
      block: 'البلوك',
      area: 'المنطقة',
      value: 'القيمة',
      pharmacist: 'الصيدلي',
      governorate: 'المحافظة',
      created: 'تاريخ الإنشاء'
    },
    audit: {
      title: 'سجل التدقيق',
      loading: 'جاري تحميل سجل التدقيق...',
      empty: 'لا توجد أحداث تدقيق لهذا الطلب. قد يعني ذلك أن الطلب لم يتم تعديله أو حذفه، أو أن مشروع Supabase يحتاج سياسة قراءة المالك للتدقيق.',
      by: 'بواسطة',
      change: 'تغيير'
    },
    drivers: {
      title: 'مؤشرات السائقين وكفاءة التكلفة',
      subtitle: 'تكلفة الطلب وصافي التقدير ظاهران للمالك، بدون إمكانية تعديل إعدادات التكلفة.',
      driver: 'السائق',
      orders: 'الطلبات',
      value: 'القيمة',
      ordersDay: 'طلبات/يوم',
      costOrder: 'تكلفة/طلب',
      estimatedNet: 'صافي تقديري',
      class: 'التصنيف'
    },
    pharmacies: {
      title: 'مؤشرات الصيدليات',
      subtitle: 'التوصيل + المبيعات المفقودة + النواقص في مؤشر صحة واحد للمالك.',
      pharmacy: 'الصيدلية',
      health: 'الصحة',
      delivery: 'التوصيل',
      value: 'القيمة',
      blocks: 'البلوكات',
      unknown: 'غير معروف %',
      outsideGov: 'خارج المحافظة',
      lostSales: 'مبيعات مفقودة',
      noRecovery: 'بدون تعويض',
      shortageRisk: 'مخاطر النواقص'
    },
    footer: 'عرض المالك للقراءة فقط. التصدير والطباعة مسموحان لأنهما لا يغيران بيانات التشغيل.',
    governorates: {
      Capital: 'العاصمة',
      Muharraq: 'المحرق',
      Northern: 'الشمالية',
      Southern: 'الجنوبية'
    },
    statusLabels: {
      optimum: 'مثالي',
      in_range: 'ضمن النطاق',
      no_cost_data: 'بدون بيانات تكلفة',
      low_efficiency: 'كفاءة منخفضة',
      loss_making: 'يسبب خسارة',
      healthy: 'سليم',
      watch: 'متابعة',
      risk: 'مخاطرة',
      critical: 'حرج',
      insufficient_data: 'بيانات غير كافية'
    }
  }
} as const;

type OwnerDashboardCopy = (typeof ownerDashboardText)[OwnerDashboardLanguage];

const getSavedOwnerDashboardLanguage = (): OwnerDashboardLanguage => {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(OWNER_DASHBOARD_LANGUAGE_KEY) === 'ar' ? 'ar' : 'en';
};

const formatOwnerPeriodLabel = (preset: PeriodPreset, from: string, to: string, language: OwnerDashboardLanguage) => {
  if (language === 'en') return periodLabel(preset, from, to);
  if (preset === 'today') return `اليوم (${from})`;
  if (preset === 'yesterday') return `أمس (${from})`;
  if (preset === 'month') return `هذا الشهر (${from} → ${to})`;
  return from === to ? from : `${from} → ${to}`;
};

const formatStatusLabel = (status: string, copy: OwnerDashboardCopy) =>
  (copy.statusLabels as Record<string, string>)[status] || status.replace(/_/g, ' ');

const formatBhdForLanguage = (value: number, language: OwnerDashboardLanguage) =>
  language === 'ar' ? `${Number(value || 0).toFixed(3)} د.ب` : formatBhd(value);

const KpiCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  tone?: 'brand' | 'emerald' | 'amber' | 'red' | 'slate';
}> = ({ label, value, sub, icon, tone = 'slate' }) => {
  const toneClasses = {
    brand: 'border-brand/15 bg-brand/5 text-brand',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    red: 'border-red-100 bg-red-50 text-red-700',
    slate: 'border-slate-200 bg-white text-slate-500'
  };
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <span className={classNames('inline-flex h-8 w-8 items-center justify-center rounded-lg border', toneClasses[tone])}>
          {icon}
        </span>
      </div>
      <p className="mt-3 break-words text-xl font-black tracking-tight text-slate-950 tabular-nums sm:text-2xl">{value}</p>
      {sub && <p className="mt-1 text-[11px] font-bold leading-4 text-slate-500">{sub}</p>}
    </div>
  );
};

const SectionButton: React.FC<{
  id: OwnerDashboardSection;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: (id: OwnerDashboardSection) => void;
}> = ({ id, label, icon, active, onClick }) => (
  <button
    type="button"
    onClick={() => onClick(id)}
    className={classNames(
      'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold transition-all',
      active ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
    )}
  >
    {icon}
    {label}
  </button>
);

const StatusPill: React.FC<{ status: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' }> = ({ status, tone = 'neutral' }) => {
  const toneClass = tone === 'good'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : tone === 'bad'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-slate-200 bg-slate-50 text-slate-500';
  return <span className={classNames('rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-widest', toneClass)}>{status}</span>;
};

const driverTone = (classification: OwnerDriverKpi['classification']): 'good' | 'warn' | 'bad' | 'neutral' => {
  if (classification === 'optimum') return 'good';
  if (classification === 'in_range' || classification === 'no_cost_data') return 'neutral';
  if (classification === 'low_efficiency') return 'warn';
  return 'bad';
};

const branchTone = (status: OwnerBranchKpi['healthStatus']): 'good' | 'warn' | 'bad' | 'neutral' => {
  if (status === 'healthy') return 'good';
  if (status === 'watch' || status === 'insufficient_data') return 'neutral';
  if (status === 'risk') return 'warn';
  return 'bad';
};

const AuditTimeline: React.FC<{
  order: DeliveryOrder | null;
  copy: OwnerDashboardCopy;
}> = ({ order, copy }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLogs([]);
    if (!order) return undefined;
    setIsLoading(true);
    deliveryService.auditLogs.listForOrder(order.id)
      .then(rows => { if (!cancelled) setLogs(rows); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [order]);

  if (!order) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy.audit.title}</p>
      {isLoading ? (
        <p className="mt-3 text-xs font-bold text-slate-400">{copy.audit.loading}</p>
      ) : logs.length === 0 ? (
        <p className="mt-3 text-xs font-bold leading-5 text-slate-500">
          {copy.audit.empty}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {logs.map((log, index) => (
            <div key={log.id || index} className="rounded-md border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-slate-800">{String(log.action || copy.audit.change).replace('_', ' ')}</p>
                <p className="text-[10px] font-bold text-slate-400">{compactDateTime(log.changed_at, copy.locale)}</p>
              </div>
              {log.changed_by && <p className="mt-1 text-[10px] font-bold text-slate-400">{copy.audit.by} {String(log.changed_by).slice(0, 8)}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const OwnerDashboardPage: React.FC<OwnerDashboardPageProps> = ({ user, onBack }) => {
  const [language, setLanguage] = useState<OwnerDashboardLanguage>(getSavedOwnerDashboardLanguage);
  const [section, setSection] = useState<OwnerDashboardSection>('overview');
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [customFrom, setCustomFrom] = useState(todayKey());
  const [customTo, setCustomTo] = useState(todayKey());
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<string | null>(null);
  const [driverFilter, setDriverFilter] = useState<string | null>(null);
  const [governorateFilter, setGovernorateFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [bundle, setBundle] = useState<OwnerDashboardBundle | null>(null);
  const [geometry, setGeometry] = useState<BlockGeometryDataset | null>(null);
  const [isGeometryLoading, setIsGeometryLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);

  const copy = ownerDashboardText[language];
  const isArabic = language === 'ar';
  const range = getPresetRange(preset, customFrom, customTo);
  const rangeLabel = formatOwnerPeriodLabel(preset, range.from, range.to, language);
  const money = (value: number) => formatBhdForLanguage(value, language);
  const startTextClass = isArabic ? 'text-right' : 'text-left';
  const endTextClass = isArabic ? 'text-left' : 'text-right';

  useEffect(() => {
    window.localStorage.setItem(OWNER_DASHBOARD_LANGUAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    setIsGeometryLoading(true);
    loadBahrainBlockGeometry()
      .then(dataset => { if (!cancelled) setGeometry(dataset); })
      .catch(() => { if (!cancelled) setGeometry(null); })
      .finally(() => { if (!cancelled) setIsGeometryLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setSelectedBlock(null);
    setSelectedOrder(null);

    ownerDashboardService.loadBundle({
      dateFrom: range.from,
      dateTo: range.to,
      branchId: branchFilter,
      paymentType: paymentFilter as DeliveryPaymentType | null,
      driverId: driverFilter,
      governorate: governorateFilter as Governorate | null,
      search
    })
      .then(data => { if (!cancelled) setBundle(data); })
      .catch(loadError => {
        if (!cancelled) {
          setBundle(null);
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [range.from, range.to, branchFilter, paymentFilter, driverFilter, governorateFilter, search]);

  const branchOptions = useMemo(
    () => (bundle?.branches || []).map(branch => ({ value: branch.id, label: branch.name, hint: branch.code })),
    [bundle?.branches]
  );
  const driverOptions = useMemo(
    () => (bundle?.drivers || []).map(driver => ({
      value: driver.id,
      label: driver.driverCode ? `${driver.driverCode} - ${driver.name}` : driver.name,
      hint: driver.isActive ? copy.common.active : copy.common.inactive
    })),
    [bundle?.drivers, copy.common.active, copy.common.inactive]
  );

  const zoneAnalysis = useMemo(
    () => buildOwnerZoneAnalysis(bundle?.coverage.summary || null, bundle?.branchProfiles || [], geometry),
    [bundle?.coverage.summary, bundle?.branchProfiles, geometry]
  );

  const mapBlocks = useMemo(
    () => ownerMapBlocksWithGeometry(bundle?.coverage.summary.blocks || [], geometry),
    [bundle?.coverage.summary.blocks, geometry]
  );

  const geometryStats = useMemo(
    () => ownerGeometryStats(bundle?.coverage.summary.blocks || [], geometry),
    [bundle?.coverage.summary.blocks, geometry]
  );

  const topDriverRisk = bundle?.driverKpis.find(driver => driver.classification === 'loss_making' || driver.classification === 'low_efficiency');
  const topBranchRisk = bundle?.branchKpis.find(branch => branch.healthStatus === 'critical' || branch.healthStatus === 'risk');
  const exportEnabled = isModuleEnabled('excelExport');

  const handlePeriodChange = (nextPreset: PeriodPreset, from?: string, to?: string) => {
    setPreset(nextPreset);
    if (from !== undefined) setCustomFrom(from);
    if (to !== undefined) setCustomTo(to);
  };

  const clearFilters = () => {
    setBranchFilter(null);
    setPaymentFilter(null);
    setDriverFilter(null);
    setGovernorateFilter(null);
    setSearch('');
  };

  const exportTraceability = () => {
    if (!bundle) return;
    exportOrdersToExcel(bundle.orders, `${copy.sections.traceability} - ${rangeLabel}`, `Owner_Delivery_Traceability_${range.from}_${range.to}`)
      .catch(console.error);
  };

  const exportOverview = () => {
    if (!bundle) return;
    exportBreakdownToExcel(
      [
        { metric: copy.overview.orders, value: bundle.overview.totalOrders, note: rangeLabel },
        { metric: copy.overview.deliveryValue, value: Number(bundle.overview.totalValueBhd.toFixed(3)), note: copy.common.selectedRange },
        { metric: copy.overview.direct, value: bundle.overview.directOrders, note: 'WhatsApp / non-Talabat' },
        { metric: copy.overview.talabat, value: bundle.overview.talabatOrders, note: copy.common.noBlockByDesign },
        { metric: copy.overview.knownBlocks, value: Number(bundle.overview.knownBlockRate.toFixed(1)), note: copy.common.directOrders },
        { metric: copy.overview.unknownBlocks, value: Number(bundle.overview.unknownBlockRate.toFixed(1)), note: copy.common.dataQuality },
        { metric: copy.overview.outsideGov, value: Number(bundle.overview.outsideGovernorateRate.toFixed(1)), note: copy.common.directOrders },
        { metric: copy.overview.totalLostSales, value: Number(bundle.overview.lostSalesValueBhd.toFixed(3)), note: copy.common.selectedRange },
        { metric: copy.overview.lostCustomers, value: bundle.overview.lostCustomers, note: copy.overview.lostItemRequests },
        { metric: copy.overview.noRecovery, value: bundle.overview.noRecoveryLostSales, note: copy.overview.noRecoverySub },
        { metric: copy.today.shortages, value: bundle.overview.criticalShortages, note: copy.overview.shortageRiskSub }
      ],
      [
        { key: 'metric', label: isArabic ? 'المؤشر' : 'Metric' },
        { key: 'value', label: copy.traceability.value },
        { key: 'note', label: isArabic ? 'ملاحظة' : 'Note' }
      ],
      `${copy.sections.overview} - ${rangeLabel}`,
      `Owner_Overview_${range.from}_${range.to}`
    ).catch(console.error);
  };

  const exportBlocks = () => {
    if (!bundle) return;
    exportBreakdownToExcel(
      bundle.coverage.summary.blocks.map(block => {
        const zone = zoneAnalysis.byBlock.get(block.blockNumber);
        return {
          block: block.blockNumber,
          area: block.areaName || '',
          governorate: block.governorate ? copy.governorates[block.governorate as Governorate] || block.governorate : copy.common.unknown,
          orders: block.orderCount,
          dominantBranch: block.dominantBranchName || '',
          share: Number((block.shareOfTotal * 100).toFixed(1)),
          trend: block.trend,
          zone: zone?.zone || 'unavailable',
          distanceKm: zone?.distanceKm == null ? '' : Number(zone.distanceKm.toFixed(2)),
          action: zone?.recommendedAction || ''
        };
      }),
      [
        { key: 'block', label: copy.traceability.block },
        { key: 'area', label: copy.traceability.area },
        { key: 'governorate', label: copy.traceability.governorate },
        { key: 'orders', label: copy.drivers.orders },
        { key: 'dominantBranch', label: isArabic ? 'الفرع الأعلى' : 'Dominant Branch' },
        { key: 'share', label: isArabic ? 'النسبة %' : 'Share %', numFmt: '0.0' },
        { key: 'trend', label: isArabic ? 'الاتجاه' : 'Trend' },
        { key: 'zone', label: isArabic ? 'الزون' : 'Zone' },
        { key: 'distanceKm', label: isArabic ? 'المسافة كم' : 'Distance KM', numFmt: '0.00' },
        { key: 'action', label: isArabic ? 'الإجراء المقترح' : 'Recommended Action' }
      ],
      `${copy.sections.map} - ${rangeLabel}`,
      `Owner_Block_KPIs_${range.from}_${range.to}`
    ).catch(console.error);
  };

  const exportDrivers = () => {
    if (!bundle) return;
    exportBreakdownToExcel(
      bundle.driverKpis.map(row => ({
        driver: row.driverName,
        code: row.driverCode || '',
        orders: row.orders,
        value: Number(row.totalValueBhd.toFixed(3)),
        ordersPerDay: Number(row.ordersPerDay.toFixed(2)),
        costPerOrder: row.costPerOrderBhd == null ? '' : Number(row.costPerOrderBhd.toFixed(3)),
        estimatedNet: row.estimatedNetBhd == null ? '' : Number(row.estimatedNetBhd.toFixed(3)),
        classification: row.classification
      })),
      [
        { key: 'driver', label: copy.drivers.driver },
        { key: 'code', label: isArabic ? 'الكود' : 'Code' },
        { key: 'orders', label: copy.drivers.orders },
        { key: 'value', label: `${copy.drivers.value} (BHD)`, numFmt: '0.000' },
        { key: 'ordersPerDay', label: copy.drivers.ordersDay, numFmt: '0.00' },
        { key: 'costPerOrder', label: copy.drivers.costOrder, numFmt: '0.000' },
        { key: 'estimatedNet', label: copy.drivers.estimatedNet, numFmt: '0.000' },
        { key: 'classification', label: copy.drivers.class }
      ],
      `${copy.sections.drivers} - ${rangeLabel}`,
      `Owner_Driver_KPIs_${range.from}_${range.to}`
    ).catch(console.error);
  };

  const exportBranches = () => {
    if (!bundle) return;
    exportBreakdownToExcel(
      bundle.branchKpis.map(row => ({
        branch: `${row.branchCode} - ${row.branchName}`,
        deliveryOrders: row.deliveryOrders,
        deliveryValue: Number(row.deliveryValueBhd.toFixed(3)),
        uniqueBlocks: row.uniqueBlocks,
        unknownBlockRate: Number(row.unknownBlockRate.toFixed(1)),
        outsideGovernorateRate: Number(row.outsideGovernorateRate.toFixed(1)),
        lostSalesValue: Number(row.lostSalesValueBhd.toFixed(3)),
        noRecoveryRate: Number(row.noRecoveryRate.toFixed(1)),
        shortageCount: row.shortageCount,
        criticalShortageCount: row.criticalShortageCount,
        healthScore: row.healthScore,
        status: row.healthStatus
      })),
      [
        { key: 'branch', label: copy.traceability.branch },
        { key: 'deliveryOrders', label: copy.pharmacies.delivery },
        { key: 'deliveryValue', label: copy.pharmacies.value, numFmt: '0.000' },
        { key: 'uniqueBlocks', label: copy.pharmacies.blocks },
        { key: 'unknownBlockRate', label: copy.pharmacies.unknown, numFmt: '0.0' },
        { key: 'outsideGovernorateRate', label: copy.pharmacies.outsideGov, numFmt: '0.0' },
        { key: 'lostSalesValue', label: copy.pharmacies.lostSales, numFmt: '0.000' },
        { key: 'noRecoveryRate', label: copy.pharmacies.noRecovery, numFmt: '0.0' },
        { key: 'shortageCount', label: isArabic ? 'النواقص' : 'Shortages' },
        { key: 'criticalShortageCount', label: copy.today.shortages },
        { key: 'healthScore', label: copy.pharmacies.health },
        { key: 'status', label: isArabic ? 'الحالة' : 'Status' }
      ],
      `${copy.sections.pharmacies} - ${rangeLabel}`,
      `Owner_Pharmacy_KPIs_${range.from}_${range.to}`
    ).catch(console.error);
  };

  return (
    <div className="space-y-5 page-enter" dir={copy.direction} lang={language}>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">{copy.header.eyebrow}</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{copy.header.title}</h2>
                <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-500">
                  {copy.header.subtitle}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <Languages className="h-3.5 w-3.5 text-brand" />
                <span className="hidden sm:inline">{copy.languageLabel}</span>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  aria-pressed={language === 'en'}
                  className={classNames('rounded-md px-2 py-1 transition', language === 'en' ? 'bg-white text-brand shadow-sm' : 'hover:text-slate-700')}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('ar')}
                  aria-pressed={language === 'ar'}
                  className={classNames('rounded-md px-2 py-1 transition', language === 'ar' ? 'bg-white text-brand shadow-sm' : 'hover:text-slate-700')}
                >
                  عربي
                </button>
              </div>
              <span className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                {copy.noWriteActions}
              </span>
              <BackToModulesButton onClick={onBack} label={copy.backToModules} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-5">
          <div className="bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy.today.orders}</p>
            <p className="mt-2 text-2xl font-black text-slate-950 tabular-nums">{bundle?.today.orders ?? copy.common.empty}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{money(bundle?.today.valueBhd || 0)}</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy.today.directTalabat}</p>
            <p className="mt-2 text-2xl font-black text-slate-950 tabular-nums">{bundle ? `${bundle.today.directOrders}/${bundle.today.talabatOrders}` : copy.common.empty}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{copy.today.marketplace}</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy.today.lostSales}</p>
            <p className="mt-2 text-2xl font-black text-red-700 tabular-nums">{money(bundle?.today.lostSalesValueBhd || 0)}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{copy.today.lostSalesSub}</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy.today.lostCustomers}</p>
            <p className="mt-2 text-2xl font-black text-slate-950 tabular-nums">{bundle?.today.lostCustomers ?? copy.common.empty}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{copy.today.lostCustomersSub}</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy.today.shortages}</p>
            <p className="mt-2 text-2xl font-black text-slate-950 tabular-nums">{bundle?.today.criticalShortages ?? copy.common.empty}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{copy.today.shortagesSub}</p>
          </div>
        </div>
      </div>

      <section className="operational-panel p-4 print:hidden">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <PeriodFilter
            preset={preset}
            customFrom={customFrom}
            customTo={customTo}
            onChange={handlePeriodChange}
            labels={copy.periodPresets}
          />
          <div className="flex flex-wrap gap-2">
            {exportEnabled && section === 'overview' && <button onClick={exportOverview} className="btn-secondary text-[10px] uppercase tracking-widest"><FileDown className="h-3.5 w-3.5" /> {copy.actions.overviewExcel}</button>}
            {exportEnabled && section === 'map' && <button onClick={exportBlocks} className="btn-secondary text-[10px] uppercase tracking-widest"><FileDown className="h-3.5 w-3.5" /> {copy.actions.blockExcel}</button>}
            {exportEnabled && section === 'traceability' && <button onClick={exportTraceability} className="btn-secondary text-[10px] uppercase tracking-widest"><FileDown className="h-3.5 w-3.5" /> {copy.actions.traceExcel}</button>}
            {exportEnabled && section === 'drivers' && <button onClick={exportDrivers} className="btn-secondary text-[10px] uppercase tracking-widest"><FileDown className="h-3.5 w-3.5" /> {copy.actions.driverExcel}</button>}
            {exportEnabled && section === 'pharmacies' && <button onClick={exportBranches} className="btn-secondary text-[10px] uppercase tracking-widest"><FileDown className="h-3.5 w-3.5" /> {copy.actions.branchExcel}</button>}
            <button onClick={printReport} className="btn-secondary text-[10px] uppercase tracking-widest"><Printer className="h-3.5 w-3.5" /> {copy.actions.pdfPrint}</button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
          <SearchableSelect options={branchOptions} value={branchFilter} onChange={setBranchFilter} placeholder={copy.filters.allBranches} dir={copy.direction} searchPlaceholder={copy.filters.selectSearch} noMatchesLabel={copy.filters.noMatches} />
          <SearchableSelect options={PAYMENT_TYPES.map(type => ({ value: type, label: type }))} value={paymentFilter} onChange={setPaymentFilter} placeholder={copy.filters.allPayments} dir={copy.direction} searchPlaceholder={copy.filters.selectSearch} noMatchesLabel={copy.filters.noMatches} />
          <SearchableSelect options={driverOptions} value={driverFilter} onChange={setDriverFilter} placeholder={copy.filters.allDrivers} dir={copy.direction} searchPlaceholder={copy.filters.selectSearch} noMatchesLabel={copy.filters.noMatches} />
          <SearchableSelect options={GOVERNORATES.map(gov => ({ value: gov, label: copy.governorates[gov] }))} value={governorateFilter} onChange={setGovernorateFilter} placeholder={copy.filters.allGovernorates} dir={copy.direction} searchPlaceholder={copy.filters.selectSearch} noMatchesLabel={copy.filters.noMatches} />
          <div className="relative xl:col-span-2">
            <Search className={classNames('absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300', isArabic ? 'right-3' : 'left-3')} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={copy.filters.search}
              className={classNames(
                'h-full min-h-[42px] w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10',
                isArabic ? 'pl-9 pr-9 text-right' : 'pl-9 pr-9 text-left'
              )}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className={classNames('absolute top-1/2 -translate-y-1/2 text-slate-300 hover:text-brand', isArabic ? 'left-3' : 'right-3')}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={clearFilters} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-brand/30 hover:text-brand">
            {copy.actions.clearFilters}
          </button>
          {(driverFilter || search) && (
            <span className="text-[11px] font-bold text-amber-700">
              {copy.filters.mapFilterNote}
            </span>
          )}
        </div>
      </section>

      <div className="flex overflow-x-auto rounded-lg border border-slate-200/50 bg-slate-100/60 p-1 print:hidden">
        <SectionButton id="overview" label={copy.sections.overview} icon={<BarChart3 className="h-3.5 w-3.5" />} active={section === 'overview'} onClick={setSection} />
        <SectionButton id="map" label={copy.sections.map} icon={<MapPinned className="h-3.5 w-3.5" />} active={section === 'map'} onClick={setSection} />
        <SectionButton id="traceability" label={copy.sections.traceability} icon={<ClipboardList className="h-3.5 w-3.5" />} active={section === 'traceability'} onClick={setSection} />
        <SectionButton id="drivers" label={copy.sections.drivers} icon={<Truck className="h-3.5 w-3.5" />} active={section === 'drivers'} onClick={setSection} />
        <SectionButton id="pharmacies" label={copy.sections.pharmacies} icon={<Store className="h-3.5 w-3.5" />} active={section === 'pharmacies'} onClick={setSection} />
      </div>

      {isLoading ? (
        <div className="flex h-56 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700">{error}</div>
      ) : bundle && (
        <>
          {section === 'overview' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">{copy.overview.deliveryEyebrow}</p>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">{copy.overview.deliveryTitle}</h3>
                  </div>
                  <StatusPill status={rangeLabel} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <KpiCard label={copy.overview.orders} value={bundle.overview.totalOrders} sub={rangeLabel} icon={<Package className="h-4 w-4" />} tone="brand" />
                  <KpiCard label={copy.overview.deliveryValue} value={money(bundle.overview.totalValueBhd)} sub={`${copy.common.avg} ${money(bundle.overview.averageOrderValueBhd)}`} icon={<Wallet className="h-4 w-4" />} tone="emerald" />
                  <KpiCard label={copy.overview.direct} value={bundle.overview.directOrders} sub={money(bundle.orders.filter(order => order.paymentType !== 'TALABAT').reduce((sum, order) => sum + order.valueBhd, 0))} icon={<Truck className="h-4 w-4" />} tone="brand" />
                  <KpiCard label={copy.overview.talabat} value={bundle.overview.talabatOrders} sub={copy.common.noBlockByDesign} icon={<Package className="h-4 w-4" />} />
                  <KpiCard label={copy.overview.knownBlocks} value={formatPercent(bundle.overview.knownBlockRate)} sub={`${bundle.coverage.summary.uniqueBlocksServed} ${copy.common.uniqueBlocks}`} icon={<MapPinned className="h-4 w-4" />} tone={bundle.overview.knownBlockRate >= 85 ? 'emerald' : 'amber'} />
                  <KpiCard label={copy.overview.unknownBlocks} value={formatPercent(bundle.overview.unknownBlockRate)} sub={copy.common.dataQuality} icon={<AlertTriangle className="h-4 w-4" />} tone={bundle.overview.unknownBlockRate > 10 ? 'red' : 'slate'} />
                  <KpiCard label={copy.overview.outsideGov} value={formatPercent(bundle.overview.outsideGovernorateRate)} sub={copy.common.directOrders} icon={<Layers className="h-4 w-4" />} tone={bundle.overview.outsideGovernorateRate > 25 ? 'amber' : 'slate'} />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-700">{copy.overview.lostEyebrow}</p>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">{copy.overview.lostTitle}</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCard label={copy.overview.totalLostSales} value={money(bundle.overview.lostSalesValueBhd)} sub={copy.common.selectedRange} icon={<Wallet className="h-4 w-4" />} tone={bundle.overview.lostSalesValueBhd > 0 ? 'red' : 'emerald'} />
                  <KpiCard label={copy.overview.lostCustomers} value={bundle.overview.lostCustomers} sub={`${bundle.sales.length} ${copy.overview.lostItemRequests}`} icon={<UserMinus className="h-4 w-4" />} tone={bundle.overview.lostCustomers > 0 ? 'amber' : 'emerald'} />
                  <KpiCard label={copy.overview.noRecovery} value={bundle.overview.noRecoveryLostSales} sub={copy.overview.noRecoverySub} icon={<AlertTriangle className="h-4 w-4" />} tone={bundle.overview.noRecoveryLostSales > 0 ? 'red' : 'emerald'} />
                  <KpiCard label={copy.overview.shortageRisk} value={bundle.overview.criticalShortages} sub={copy.overview.shortageRiskSub} icon={<Gauge className="h-4 w-4" />} tone={bundle.overview.criticalShortages > 0 ? 'red' : 'emerald'} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <section className="operational-panel p-4 md:p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-brand" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">{copy.overview.ownerAttention}</h3>
                  </div>
                  <div className="space-y-2">
                    {topBranchRisk ? (
                      <button onClick={() => setSection('pharmacies')} className={classNames('w-full rounded-lg border border-amber-100 bg-amber-50 p-3', startTextClass)}>
                        <p className="text-xs font-black text-amber-900">{topBranchRisk.branchCode} - {topBranchRisk.branchName}</p>
                        <p className="mt-1 text-[11px] font-bold text-amber-800">{copy.common.health} {topBranchRisk.healthScore}/100 · {formatStatusLabel(topBranchRisk.healthStatus, copy)}</p>
                      </button>
                    ) : (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">{copy.overview.noBranchRisk}</div>
                    )}
                    {topDriverRisk ? (
                      <button onClick={() => setSection('drivers')} className={classNames('w-full rounded-lg border border-red-100 bg-red-50 p-3', startTextClass)}>
                        <p className="text-xs font-black text-red-900">{topDriverRisk.driverName}</p>
                        <p className="mt-1 text-[11px] font-bold text-red-800">{formatStatusLabel(topDriverRisk.classification, copy)} · {topDriverRisk.ordersPerDay.toFixed(1)} {copy.common.ordersPerDay}</p>
                      </button>
                    ) : (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">{copy.overview.noDriverRisk}</div>
                    )}
                  </div>
                </section>

                <section className="operational-panel p-4 md:p-5 xl:col-span-2">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">{copy.overview.lowestPharmacyHealth}</h3>
                      <p className="mt-1 text-xs font-medium text-slate-500">{copy.overview.lowestPharmacySub}</p>
                    </div>
                    <button onClick={() => setSection('pharmacies')} className="btn-secondary text-[10px] uppercase tracking-widest">{copy.actions.openPharmacies}</button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    {bundle.branchKpis.slice(0, 3).map(branch => (
                      <div key={branch.branchId} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-black text-slate-800">{branch.branchCode}</p>
                          <StatusPill status={formatStatusLabel(branch.healthStatus, copy)} tone={branchTone(branch.healthStatus)} />
                        </div>
                        <p className="mt-1 truncate text-xs font-bold text-slate-500">{branch.branchName}</p>
                        <p className="mt-3 text-2xl font-black text-slate-950 tabular-nums">{branch.healthScore}/100</p>
                        <p className="mt-1 text-[11px] font-bold text-slate-500">{branch.deliveryOrders} {copy.common.delivery} · {branch.criticalShortageCount} {copy.common.criticalShortages}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {section === 'map' && (
            <section className="operational-panel p-4 md:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPinned className="h-4 w-4 text-brand" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">{copy.map.title}</h3>
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-500">{rangeLabel} · {bundle.coverage.summary.knownBlockOrders} {copy.common.knownBlockOrders}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill status={`${zoneAnalysis.metrics.servedCoreBlocks} ${copy.map.core}`} tone="good" />
                  <StatusPill status={`${zoneAnalysis.metrics.servedStandardBlocks} ${copy.map.standard}`} />
                  <StatusPill status={`${zoneAnalysis.metrics.servedExtendedBlocks} ${copy.map.extended}`} tone="warn" />
                  <StatusPill status={`${zoneAnalysis.metrics.servedOutsideRangeBlocks} ${copy.map.outsideRange}`} tone={zoneAnalysis.metrics.servedOutsideRangeBlocks > 0 ? 'bad' : 'neutral'} />
                </div>
              </div>

              {isGeometryLoading ? (
                <BlockCoverageMapLoading featureCount={geometry?.featureCount} />
              ) : geometry?.available ? (
                <BlockCoverageMap
                  dataset={geometry}
                  blocks={mapBlocks}
                  branchProfiles={bundle.branchProfiles.filter(profile => profile.isDeliveryEnabled !== false)}
                  blockZoneAnalysis={zoneAnalysis.byBlock}
                  zoneMetrics={zoneAnalysis.metrics}
                  summary={bundle.coverage.summary}
                  selectedBlock={selectedBlock}
                  highlightedGovernorate={governorateFilter as Governorate | null}
                  geometryStats={geometryStats}
                  onSelect={setSelectedBlock}
                />
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-black text-amber-900">{copy.map.unavailableTitle}</p>
                  <p className="mt-1 text-xs font-bold text-amber-800">{copy.map.unavailableSub}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {bundle.coverage.summary.topBlocks.map(block => (
                      <button key={block.blockNumber} onClick={() => setSelectedBlock(block)} className="rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs font-black text-amber-900">
                        #{block.blockNumber} · {block.orderCount}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {section === 'traceability' && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section className="operational-panel overflow-hidden">
                <div className="border-b border-slate-100 p-4 md:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">{copy.traceability.title}</h3>
                      <p className="mt-1 text-xs font-bold text-slate-500">{bundle.orders.length} {copy.common.orders} · {money(bundle.orders.reduce((sum, order) => sum + order.valueBhd, 0))}</p>
                    </div>
                    {exportEnabled && <button onClick={exportTraceability} className="btn-secondary text-[10px] uppercase tracking-widest"><Download className="h-3.5 w-3.5" /> {copy.actions.exportAll}</button>}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead>
                      <tr className={classNames('border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400', startTextClass)}>
                        <th className="px-4 py-3">{copy.traceability.date}</th>
                        <th className="px-4 py-3">{copy.traceability.branch}</th>
                        <th className="px-4 py-3">{copy.traceability.driver}</th>
                        <th className="px-4 py-3">{copy.traceability.payment}</th>
                        <th className="px-4 py-3">{copy.traceability.block}</th>
                        <th className="px-4 py-3">{copy.traceability.area}</th>
                        <th className={classNames('px-4 py-3', endTextClass)}>{copy.traceability.value}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {bundle.orders.slice(0, 500).map(order => (
                        <tr key={order.id} onClick={() => setSelectedOrder(order)} className={classNames('cursor-pointer hover:bg-brand/5', selectedOrder?.id === order.id && 'bg-brand/5')}>
                          <td className="px-4 py-3 font-bold text-slate-700 tabular-nums">{order.orderDate}</td>
                          <td className="px-4 py-3 font-black text-slate-800">{order.branchName || copy.common.unknownBranch}</td>
                          <td className="px-4 py-3 font-bold text-slate-600">{order.driverCode ? `${order.driverCode} - ${order.driverName}` : order.driverName || copy.common.empty}</td>
                          <td className="px-4 py-3"><StatusPill status={order.paymentType} /></td>
                          <td className="px-4 py-3 font-black text-slate-700 tabular-nums">{order.blockNumber || (order.paymentType === 'TALABAT' ? copy.overview.talabat : copy.common.empty)}</td>
                          <td className="px-4 py-3 font-bold text-slate-500">{order.areaName || (order.governorate ? copy.governorates[order.governorate] : copy.common.empty)}</td>
                          <td className={classNames('px-4 py-3 font-black text-slate-900 tabular-nums', endTextClass)}>{money(order.valueBhd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {bundle.orders.length === 0 && <p className="p-8 text-center text-xs font-bold text-slate-400">{copy.traceability.noOrders}</p>}
              </section>

              <aside className="space-y-4">
                {selectedOrder ? (
                  <>
                    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy.traceability.selectedOrder}</p>
                      <h4 className="mt-1 text-xl font-black text-slate-950">{money(selectedOrder.valueBhd)}</h4>
                      <div className="mt-3 space-y-2 text-xs font-bold text-slate-600">
                        <p>{copy.traceability.branch}: <span className="text-slate-900">{selectedOrder.branchName || copy.common.unknown}</span></p>
                        <p>{copy.traceability.driver}: <span className="text-slate-900">{selectedOrder.driverName || copy.common.unassigned}</span></p>
                        <p>{copy.traceability.pharmacist}: <span className="text-slate-900">{selectedOrder.pharmacistName || copy.common.unassigned}</span></p>
                        <p>{copy.traceability.block}: <span className="text-slate-900">{selectedOrder.blockNumber || copy.common.noBlock}</span></p>
                        <p>{copy.traceability.governorate}: <span className="text-slate-900">{selectedOrder.governorate ? copy.governorates[selectedOrder.governorate] : copy.common.unknown}</span></p>
                        <p>{copy.traceability.created}: <span className="text-slate-900">{compactDateTime(selectedOrder.createdAt, copy.locale)}</span></p>
                      </div>
                    </div>
                    <AuditTimeline order={selectedOrder} copy={copy} />
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                    <ClipboardList className="mx-auto h-7 w-7 text-slate-300" />
                    <p className="mt-3 text-sm font-black text-slate-700">{copy.traceability.selectOrder}</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-400">{copy.traceability.selectOrderSub}</p>
                  </div>
                )}
              </aside>
            </div>
          )}

          {section === 'drivers' && (
            <section className="operational-panel overflow-hidden">
              <div className="border-b border-slate-100 p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">{copy.drivers.title}</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">{copy.drivers.subtitle}</p>
                  </div>
                  {exportEnabled && <button onClick={exportDrivers} className="btn-secondary text-[10px] uppercase tracking-widest"><Download className="h-3.5 w-3.5" /> {copy.actions.exportDrivers}</button>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr className={classNames('border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400', startTextClass)}>
                      <th className="px-4 py-3">{copy.drivers.driver}</th>
                      <th className={classNames('px-4 py-3', endTextClass)}>{copy.drivers.orders}</th>
                      <th className={classNames('px-4 py-3', endTextClass)}>{copy.drivers.value}</th>
                      <th className={classNames('px-4 py-3', endTextClass)}>{copy.drivers.ordersDay}</th>
                      <th className={classNames('px-4 py-3', endTextClass)}>{copy.drivers.costOrder}</th>
                      <th className={classNames('px-4 py-3', endTextClass)}>{copy.drivers.estimatedNet}</th>
                      <th className="px-4 py-3">{copy.drivers.class}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {bundle.driverKpis.map(driver => (
                      <tr key={driver.driverId} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <p className="font-black text-slate-800">{driver.driverName}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-brand">{driver.driverCode || (driver.isActive ? copy.common.active : copy.common.inactive)}</p>
                        </td>
                        <td className={classNames('px-4 py-3 font-black tabular-nums', endTextClass)}>{driver.orders}</td>
                        <td className={classNames('px-4 py-3 font-bold tabular-nums', endTextClass)}>{money(driver.totalValueBhd)}</td>
                        <td className={classNames('px-4 py-3 font-bold tabular-nums', endTextClass)}>{driver.ordersPerDay.toFixed(1)}</td>
                        <td className={classNames('px-4 py-3 font-bold tabular-nums', endTextClass)}>{driver.costPerOrderBhd == null ? copy.common.empty : money(driver.costPerOrderBhd)}</td>
                        <td className={classNames('px-4 py-3 font-black tabular-nums', endTextClass, driver.estimatedNetBhd == null ? 'text-slate-300' : driver.estimatedNetBhd < 0 ? 'text-red-600' : 'text-emerald-600')}>
                          {driver.estimatedNetBhd == null ? copy.common.empty : money(driver.estimatedNetBhd)}
                        </td>
                        <td className="px-4 py-3"><StatusPill status={formatStatusLabel(driver.classification, copy)} tone={driverTone(driver.classification)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {section === 'pharmacies' && (
            <section className="operational-panel overflow-hidden">
              <div className="border-b border-slate-100 p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">{copy.pharmacies.title}</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">{copy.pharmacies.subtitle}</p>
                  </div>
                  {exportEnabled && <button onClick={exportBranches} className="btn-secondary text-[10px] uppercase tracking-widest"><Download className="h-3.5 w-3.5" /> {copy.actions.exportBranches}</button>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-sm">
                  <thead>
                    <tr className={classNames('border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400', startTextClass)}>
                      <th className="px-4 py-3">{copy.pharmacies.pharmacy}</th>
                      <th className={classNames('px-4 py-3', endTextClass)}>{copy.pharmacies.health}</th>
                      <th className={classNames('px-4 py-3', endTextClass)}>{copy.pharmacies.delivery}</th>
                      <th className={classNames('px-4 py-3', endTextClass)}>{copy.pharmacies.value}</th>
                      <th className={classNames('px-4 py-3', endTextClass)}>{copy.pharmacies.blocks}</th>
                      <th className={classNames('px-4 py-3', endTextClass)}>{copy.pharmacies.unknown}</th>
                      <th className={classNames('px-4 py-3', endTextClass)}>{copy.pharmacies.outsideGov}</th>
                      <th className={classNames('px-4 py-3', endTextClass)}>{copy.pharmacies.lostSales}</th>
                      <th className={classNames('px-4 py-3', endTextClass)}>{copy.pharmacies.noRecovery}</th>
                      <th className={classNames('px-4 py-3', endTextClass)}>{copy.pharmacies.shortageRisk}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {bundle.branchKpis.map(branch => (
                      <tr key={branch.branchId} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <p className="font-black text-slate-800">{branch.branchCode} - {branch.branchName}</p>
                          <p className="text-[10px] font-bold text-slate-400">
                            {copy.common.topBlock} {branch.topBlockNumber ? `#${branch.topBlockNumber}` : copy.common.empty} · {copy.common.topDriver} {branch.topDriverName || copy.common.empty}
                          </p>
                        </td>
                        <td className={classNames('px-4 py-3', endTextClass)}>
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-black tabular-nums text-slate-950">{branch.healthScore}/100</span>
                            <StatusPill status={formatStatusLabel(branch.healthStatus, copy)} tone={branchTone(branch.healthStatus)} />
                          </div>
                        </td>
                        <td className={classNames('px-4 py-3 font-black tabular-nums', endTextClass)}>{branch.deliveryOrders}</td>
                        <td className={classNames('px-4 py-3 font-bold tabular-nums', endTextClass)}>{money(branch.deliveryValueBhd)}</td>
                        <td className={classNames('px-4 py-3 font-bold tabular-nums', endTextClass)}>{branch.uniqueBlocks}</td>
                        <td className={classNames('px-4 py-3 font-bold tabular-nums', endTextClass)}>{formatPercent(branch.unknownBlockRate)}</td>
                        <td className={classNames('px-4 py-3 font-bold tabular-nums', endTextClass)}>{formatPercent(branch.outsideGovernorateRate)}</td>
                        <td className={classNames('px-4 py-3 font-bold tabular-nums', endTextClass)}>{money(branch.lostSalesValueBhd)}</td>
                        <td className={classNames('px-4 py-3 font-bold tabular-nums', endTextClass)}>{formatPercent(branch.noRecoveryRate)}</td>
                        <td className={classNames('px-4 py-3 font-black tabular-nums', endTextClass)}>{branch.criticalShortageCount}/{branch.shortageCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-xs font-bold leading-5 text-blue-900 print:hidden">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
          <p>
            {copy.footer}
          </p>
        </div>
      </div>
    </div>
  );
};
