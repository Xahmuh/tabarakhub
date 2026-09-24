import React, { useMemo } from 'react';
import { 
  AlertTriangle, Award, Banknote, BarChart3, BookOpenCheck, ClipboardCheck, ClipboardList, FileText, Fingerprint, Landmark, LayoutGrid, Lightbulb, LogOut, MapPinned, MessageSquareText, Package, PieChart, QrCode, Radar, ReceiptText, Settings2, ShieldCheck, Truck, UsersRound, WalletCards, Calendar, CalendarCheck
} from 'lucide-react';
import { AuthState, MaintenanceSettings } from '../../types';
import { Footer } from '../shared';
import { clientConfig, isModuleEnabled } from '../../config/clientConfig';
import { ROLE_LABELS } from '../../lib/access';
import { normalizeModuleDisplaySettings } from '../../lib/moduleDisplay';

interface SuitePageProps {
  authState: AuthState;
  isManager: boolean;
  isWarehouse: boolean;
  isPending: boolean;
  checkPermission: (feature: string, minimum?: 'edit' | 'read') => boolean;
  handleTabChange: (tab: any) => void;
  logout: () => void;
  footerSettings?: MaintenanceSettings | null;
}

type ModuleTone = 'default' | 'feature' | 'finance' | 'knowledge';
type ModuleVariant = 'default' | 'brand';
type ModuleBadgeStyle = 'hidden' | 'red';

interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  isPending: boolean;
  badge?: string;
  cta?: string;
  tone?: ModuleTone;
  iconSize?: 'default' | 'large';
  iconPlacement?: 'framed' | 'background';
  variant?: ModuleVariant;
  badgeStyle?: ModuleBadgeStyle;
}

const moduleToneClasses: Record<ModuleTone, {
  icon: string;
  cta: string;
  badge: string;
}> = {
  default: {
    icon: 'bg-brand/10 text-brand group-hover:bg-brand group-hover:text-white',
    cta: 'text-brand',
    badge: 'border-brand/10 bg-brand/5 text-brand'
  },
  feature: {
    icon: 'bg-brand/10 text-brand group-hover:bg-brand group-hover:text-white',
    cta: 'text-brand',
    badge: 'border-brand/10 bg-brand/5 text-brand'
  },
  finance: {
    icon: 'bg-brand/10 text-brand group-hover:bg-brand group-hover:text-white',
    cta: 'text-brand',
    badge: 'border-brand/10 bg-brand/5 text-brand'
  },
  knowledge: {
    icon: 'bg-brand/10 text-brand group-hover:bg-brand group-hover:text-white',
    cta: 'text-brand',
    badge: 'border-brand/10 bg-brand/5 text-brand'
  }
};

const LostSalesShortageIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 128 96"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <path
      d="M29 14H99C109 14 117 22 117 32V58C117 68 109 76 99 76H82"
      stroke="currentColor"
      strokeWidth="9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M46 76H29C19 76 11 68 11 58V32C11 22 19 14 29 14"
      stroke="currentColor"
      strokeWidth="9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M64 47L91 88H37L64 47Z"
      stroke="currentColor"
      strokeWidth="9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ModuleCard: React.FC<ModuleCardProps> = ({
  title,
  description,
  icon,
  onClick,
  isPending,
  badge,
  cta = 'Open',
  tone = 'default',
  iconSize = 'default',
  iconPlacement = 'framed',
  variant = 'default',
  badgeStyle = 'hidden'
}) => {
  const classes = moduleToneClasses[tone];
  const hasBackgroundIcon = iconPlacement === 'background';
  const isBrandVariant = variant === 'brand';
  const iconFrameClass = iconSize === 'large'
    ? 'h-16 w-24 rounded-xl border border-brand/10 bg-brand/5 text-brand group-hover:border-brand/20 group-hover:bg-brand/10 group-hover:text-brand'
    : `h-10 w-10 rounded-lg ${classes.icon}`;
  const backgroundIcon = React.isValidElement<{ className?: string }>(icon)
    ? React.cloneElement(icon, { className: 'h-28 w-36 sm:h-32 sm:w-40' })
    : icon;
  const cardClass = isBrandVariant
    ? 'group relative min-h-[212px] overflow-hidden rounded-xl border border-brand/15 bg-white p-5 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/70 hover:bg-brand/90 hover:shadow-md hover:shadow-brand/20 active:scale-[0.99] focus-ring'
    : 'group relative min-h-[212px] overflow-hidden rounded-xl border border-brand/10 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md hover:shadow-brand/10 active:scale-[0.99] focus-ring';
  const contentClass = isBrandVariant
    ? 'relative z-10 flex h-full flex-col items-center justify-center gap-4'
    : 'relative z-10 flex h-full flex-col justify-between gap-5';
  const backgroundIconClass = isBrandVariant
    ? 'pointer-events-none absolute inset-0 flex items-center justify-center text-brand/10 transition-colors duration-200 group-hover:text-white/25'
    : 'pointer-events-none absolute inset-0 flex items-center justify-center text-brand/10 transition-colors duration-200 group-hover:text-brand/20';
  const titleClass = isBrandVariant
    ? 'text-xl font-black text-slate-950 transition-colors duration-200 group-hover:text-white'
    : 'text-lg font-black tracking-tight text-slate-950 transition-colors group-hover:text-brand';
  const descriptionClass = isBrandVariant
    ? 'mt-2 max-w-[18rem] text-sm font-semibold leading-relaxed text-slate-500 transition-colors duration-200 group-hover:text-white/85'
    : 'mt-1.5 text-sm font-medium leading-relaxed text-slate-500';
  const ctaClass = isBrandVariant ? 'text-white' : classes.cta;
  const ctaContainerClass = isBrandVariant
    ? 'inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white shadow-sm shadow-brand/20'
    : 'flex items-center gap-2 text-xs font-bold';
  const moduleBadgeText = badge?.trim();
  const showModuleBadge = Boolean(moduleBadgeText && badgeStyle === 'red');
  const badgeClass = isBrandVariant
    ? 'inline-flex max-w-full items-center justify-center rounded-full bg-brand px-3 py-1.5 text-center text-[10px] font-black uppercase leading-4 tracking-[0.08em] text-white shadow-sm ring-1 ring-brand/10 transition-colors duration-200 whitespace-normal break-words group-hover:bg-white group-hover:text-brand sm:text-[11px]'
    : 'inline-flex max-w-full items-center justify-center rounded-full bg-brand px-3 py-1.5 text-center text-[10px] font-black uppercase leading-4 tracking-[0.08em] text-white shadow-sm ring-1 ring-brand/10 whitespace-normal break-words sm:text-[11px]';

  return (
    <button
      onClick={onClick}
      className={`${cardClass} ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {hasBackgroundIcon && (
        <div className={backgroundIconClass}>
          {backgroundIcon}
        </div>
      )}
      <div className={contentClass}>
        {!hasBackgroundIcon && (
          <div className="flex items-start justify-between gap-4">
            <div className={`flex shrink-0 items-center justify-center transition-colors ${iconFrameClass}`}>
              {icon}
            </div>
            {showModuleBadge && (
              <span className={badgeClass}>
                {moduleBadgeText}
              </span>
            )}
          </div>
        )}
        <div>
          {hasBackgroundIcon && showModuleBadge && (
            <span className={`mb-3 ${badgeClass}`}>
              {moduleBadgeText}
            </span>
          )}
          <h3 className={titleClass}>{title}</h3>
          <p className={descriptionClass}>{description}</p>
        </div>
        <div className={ctaContainerClass}>
          {!isBrandVariant && (
            <span className={`h-px w-6 bg-current opacity-50 transition-all duration-200 group-hover:w-10 ${ctaClass}`}></span>
          )}
          <span className={ctaClass}>{cta}</span>
        </div>
      </div>
    </button>
  );
};

export const SuitePage: React.FC<SuitePageProps> = ({
  authState,
  isManager,
  isWarehouse,
  isPending,
  checkPermission,
  handleTabChange,
  logout,
  footerSettings
}) => {
  const role = authState.user?.role;
  const isOwner = role === 'owner';
  const canOpenApprovalQueue = isManager;
  const moduleDisplaySettings = useMemo(
    () => normalizeModuleDisplaySettings(footerSettings?.moduleDisplaySettings),
    [footerSettings?.moduleDisplaySettings]
  );
  const moduleDisplayItems = moduleDisplaySettings.items;
  const moduleGridClass = moduleDisplaySettings.gridColumns === 3
    ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
    : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4';
  const moduleDisplayByKey = useMemo(
    () => new Map(moduleDisplayItems.map(item => [item.key, item])),
    [moduleDisplayItems]
  );
  const canUseSales = isModuleEnabled('sales');
  const canUseHr = isModuleEnabled('hr');
  const canUseWorkforce = canUseHr && isModuleEnabled('workforce');
  const canOpenDashboard = isModuleEnabled('reports') && (
    isWarehouse
      ? isModuleEnabled('adminDashboard')
      : (isManager || role === 'supervisor')
        ? isModuleEnabled('managerDashboard')
        : isModuleEnabled('branchDashboard')
  );
  const openDashboard = (mode?: 'standard' | 'expanded' | 'products') => {
    if (mode) sessionStorage.setItem('tabarak_dashboard_view', mode);
    handleTabChange('dashboard');
  };

  const moduleCards: Array<ModuleCardProps & { key: string; visible: boolean }> = [
    {
      key: 'pos',
      visible: !isOwner && canUseSales && !isWarehouse && (checkPermission('lost_sales', 'edit') || checkPermission('shortages', 'edit')),
      title: 'Lost Sales & Shortage Log',
      description: 'Log out-of-stock items and customer requested deficits in real time.',
      icon: <LostSalesShortageIcon />,
      iconPlacement: 'background',
      variant: 'brand',
      onClick: () => handleTabChange('pos'),
      isPending,
      badge: 'Entry'
    },
    {
      key: 'owner-dashboard',
      visible: checkPermission('owner_dashboard'),
      title: 'Owner Dashboard',
      description: 'Read-only performance, delivery traceability, map zones, driver KPIs, and pharmacy KPIs.',
      icon: <ShieldCheck className="h-5 w-5" />,
      onClick: () => handleTabChange('owner-dashboard'),
      isPending,
      badge: 'Owner',
      cta: 'Open owner view',
      tone: 'feature'
    },
    {
      key: 'tqph',
      visible: role !== 'branch' && (isManager || isOwner || role === 'admin' || role === 'supervisor'),
      title: 'Tabarak Quality & Performance Hub (TQPH)',
      description: 'National NHRA compliance simulated audits, 20-branch ranking leaderboard, 6-pillar staff appraisals, and 48h CAPA action center.',
      icon: <ShieldCheck className="h-5 w-5 text-emerald-400" />,
      onClick: () => handleTabChange('tqph'),
      isPending,
      badge: 'Quality Hub',
      cta: 'Open Quality Hub',
      tone: 'feature',
      badgeStyle: 'red'
    },
    {
      key: 'dashboard-manager',
      visible: isManager && canOpenDashboard,
      title: 'Performance Dashboard',
      description: 'Review lost sales, shortage trends, and branch performance with manager-level branch selection.',
      icon: <BarChart3 className="h-5 w-5" />,
      onClick: () => openDashboard('standard'),
      isPending,
      badge: 'Analytics'
    },
    {
      key: 'dashboard-admin',
      visible: isWarehouse && canOpenDashboard && (checkPermission('lost_sales') || checkPermission('shortages')),
      title: 'Performance Dashboard',
      description: 'Review localized branch performance and inventory trends.',
      icon: <BarChart3 className="h-5 w-5" />,
      onClick: () => openDashboard('standard'),
      isPending,
      badge: 'Analytics'
    },
    {
      key: 'hr-manager',
      visible: canUseHr && (isManager || checkPermission('hr_requests')),
      title: 'HR Requests Admin',
      description: 'Review employee requests and generate official letterheads.',
      icon: <ClipboardList className="h-5 w-5" />,
      onClick: () => handleTabChange('hr-manager'),
      isPending,
      badge: 'Admin'
    },
    {
      key: 'hr-directory',
      visible: canUseHr && (isManager || checkPermission('hr_requests')),
      title: 'HR Workforce Directory',
      description: 'Unified staff registry with prefixed codes (E, D, W, M) and geofenced branch locations.',
      icon: <UsersRound className="h-5 w-5" />,
      onClick: () => handleTabChange('hr-directory'),
      isPending,
      badge: 'Directory',
      tone: 'feature'
    },
    {
      key: 'hr-letter',
      visible: canUseHr && (isManager || checkPermission('hr_requests')),
      title: 'Official HR Letter Generator',
      description: 'Generate, customize, live-preview, and print official bilingual corporate HR letters with NHRA licensing and salary matrix.',
      icon: <Award className="h-5 w-5" />,
      onClick: () => handleTabChange('hr-letter'),
      isPending,
      badge: 'Corporate Letters',
      badgeStyle: 'red',
      tone: 'feature'
    },
    {
      key: 'payroll',
      visible: role !== 'branch' && canUseHr && (isManager || isOwner || checkPermission('workforce') || checkPermission('delivery') || checkPermission('hr_requests')),
      title: 'Payroll & Incentive Engine',
      description: 'Enterprise payroll management, driver & employee commissions, target bonuses, attendance deductions, and payslips.',
      icon: <WalletCards className="h-5 w-5" />,
      onClick: () => handleTabChange('payroll'),
      isPending,
      badge: 'new module',
      badgeStyle: 'red',
      tone: 'finance'
    },
    {
      key: 'attendance',
      visible: canUseHr && (isManager || isOwner || checkPermission('workforce') || checkPermission('attendance')),
      title: 'Attendance & Geofencing',
      description: 'GPS radius clock-in/out, live team board, tiered disciplinary penalties engine, and monthly audit reports.',
      icon: <Fingerprint className="h-5 w-5" />,
      onClick: () => handleTabChange('attendance'),
      isPending,
      badge: 'new module',
      badgeStyle: 'red',
      tone: 'feature'
    },
    {
      key: 'dashboard-branch',
      visible: !isManager && !isWarehouse && !isOwner && canOpenDashboard && (checkPermission('lost_sales') || checkPermission('shortages')),
      title: 'Performance Dashboard',
      description: 'Review localized branch performance and inventory trends.',
      icon: <BarChart3 className="h-5 w-5" />,
      onClick: () => openDashboard('standard'),
      isPending,
      badge: 'Analytics'
    },
    {
      key: 'workforce',
      visible: canUseWorkforce && (isManager || checkPermission('workforce')),
      title: 'Workforce Analytics',
      description: 'Optimize staffing levels and calculate relief requirements.',
      icon: <UsersRound className="h-5 w-5" />,
      onClick: () => handleTabChange('workforce'),
      isPending,
      badge: 'Planning'
    },
    {
      key: 'hr',
      visible: canUseHr && (role === 'branch' || checkPermission('hr_requests')),
      title: 'HR Self-Service',
      description: 'Request official documents and certificates directly.',
      icon: <FileText className="h-5 w-5" />,
      onClick: () => handleTabChange('hr'),
      isPending,
      badge: 'Self-service'
    },
    {
      key: 'cash-flow',
      visible: isModuleEnabled('cashFlow') && checkPermission('cash_flow'),
      title: 'Cash Flow Planner',
      description: 'Liquidity forecasting, expense planning, and financial risk monitoring.',
      icon: <Landmark className="h-5 w-5" />,
      onClick: () => handleTabChange('cash-flow'),
      isPending,
      badge: 'Finance',
      tone: 'finance'
    },
    {
      key: 'cash-tracker',
      visible: isModuleEnabled('cashTracker') && checkPermission('cash_tracker'),
      title: 'Branch Cash Tracker',
      description: 'Log and track daily cash differences between POS and count.',
      icon: <WalletCards className="h-5 w-5" />,
      onClick: () => handleTabChange('cash-tracker'),
      isPending,
      badge: 'Finance',
      tone: 'finance'
    },
    {
      key: 'corporate-codex',
      visible: isModuleEnabled('corporateCodex') && checkPermission('corporate_codex'),
      title: 'Corporate Codex',
      description: 'Official policies, circulars, and operating protocols.',
      icon: <BookOpenCheck className="h-5 w-5" />,
      onClick: () => handleTabChange('corporate-codex'),
      isPending,
      badge: 'Knowledge',
      tone: 'knowledge'
    },
    {
      key: 'settings',
      visible: isModuleEnabled('settings') && (isManager || canOpenApprovalQueue || role === 'admin' || checkPermission('settings')),
      title: 'Control Center',
      description: 'Unified management of System Settings, Access Control, Users, Roles & Operational Infrastructure.',
      icon: <Settings2 className="h-5 w-5" />,
      onClick: () => handleTabChange('settings'),
      isPending,
      badge: 'Admin'
    },
    {
      key: 'spin-win',
      visible: isModuleEnabled('spinWin') && checkPermission('spin_win'),
      title: isManager ? 'Reward Control' : 'Spin & Win',
      description: 'Generate QR tokens for the customer reward wheel.',
      icon: <QrCode className="h-5 w-5" />,
      onClick: () => handleTabChange('spin-win'),
      isPending,
      badge: 'Rewards',
      tone: 'feature'
    },
    {
      key: 'feedback-form',
      visible: isModuleEnabled('qualityFeedback') && checkPermission('quality_feedback'),
      title: 'QA Insights',
      description: 'Submit anonymous quality feedback and suggestions.',
      icon: <MessageSquareText className="h-5 w-5" />,
      onClick: () => handleTabChange('feedback-form'),
      isPending,
      badge: 'Feedback',
      tone: 'feature'
    },
    {
      key: 'feedback-admin',
      visible: isModuleEnabled('qualityFeedback') && checkPermission('feedback_admin'),
      title: 'Feedback Admin',
      description: 'Analyze quality metrics and review anonymous feedback.',
      icon: <PieChart className="h-5 w-5" />,
      onClick: () => handleTabChange('feedback-admin'),
      isPending,
      badge: 'Analytics',
      tone: 'feature'
    },
    {
      key: 'employee-contributions',
      visible: isModuleEnabled('employeeContributions') && checkPermission('employee_contributions'),
      title: 'Team Contributions',
      description: 'Discover tools, automations, and projects shared by the team.',
      icon: <Lightbulb className="h-5 w-5" />,
      onClick: () => handleTabChange('employee-contributions'),
      isPending,
      badge: 'Ideas',
      cta: 'Open hub',
      tone: 'knowledge'
    },
    {
      key: 'workflow-todo',
      visible: isModuleEnabled('workflowTodo') && checkPermission('workflow_todo'),
      title: 'Workflow & Todo',
      description: 'Assign branch tasks, track personal todos, review submissions, and follow recurring work.',
      icon: <ClipboardCheck className="h-5 w-5" />,
      onClick: () => handleTabChange('workflow-todo'),
      isPending,
      badge: 'new module',
      badgeStyle: 'red',
      cta: 'Open workflow',
      tone: 'feature'
    },
    {
      key: 'delivery',
      visible: isModuleEnabled('delivery') && checkPermission('delivery'),
      title: 'Delivery Recording & Traceability',
      description: role === 'branch'
        ? 'Record daily delivery orders and track WhatsApp & Talabat activity.'
        : 'Delivery analytics, driver performance, geography, and cost efficiency.',
      icon: <Truck className="h-5 w-5" />,
      onClick: () => handleTabChange('delivery'),
      isPending,
      badge: 'new module',
      badgeStyle: 'red',
      tone: 'feature'
    },
    {
      key: 'benefit-pay-ledger',
      visible: isModuleEnabled('benefitPayLedger') && checkPermission('benefit_pay_ledger'),
      title: role === 'branch' ? 'Benefit Pay Recording & Traceability' : 'Benefit Pay Ledger',
      description: role === 'branch'
        ? 'Record Benefit Pay receipts and export your daily BP sheet.'
        : 'Track branch Benefit Pay transfers and delivery BP auto-sync.',
      icon: <ReceiptText className="h-5 w-5" />,
      onClick: () => handleTabChange('benefit-pay-ledger'),
      isPending,
      badge: 'Finance',
      tone: 'finance'
    },
    {
      key: 'operational-expenses',
      visible: isModuleEnabled('operationalExpenses') && (role === 'branch' || checkPermission('operational_expenses')),
      title: 'Operational Cash Expenses',
      description: role === 'branch'
        ? 'Record operational cash expenses paid by your pharmacy branch.'
        : 'Track, report, and analyze operational cash expenses across branches.',
      icon: <Banknote className="h-5 w-5" />,
      onClick: () => handleTabChange('operational-expenses'),
      isPending,
      badge: 'new module',
      badgeStyle: 'red',
      tone: 'finance'
    },
    {
      key: 'operational-renewals',
      visible: isModuleEnabled('operationalRenewals') && (isManager || isOwner || checkPermission('operational_renewals') || checkPermission('settings')),
      title: 'Operational Alert & Renewals',
      description: 'Proactive compliance tracking and renewal workflow for Commercial Registrations, NHRA licenses, and Work Permits.',
      icon: <AlertTriangle className="h-5 w-5" />,
      onClick: () => handleTabChange('operational-renewals'),
      isPending,
      badge: 'Compliance',
      badgeStyle: 'red',
      tone: 'feature'
    },
    {
      key: 'products',
      visible: false,
      title: 'Product Catalogue',
      description: 'Search item prices, check product details, and browse active inventory catalogue.',
      icon: <Package className="h-5 w-5" />,
      onClick: () => handleTabChange('products'),
      isPending,
      badge: 'Catalogue',
      tone: 'feature'
    },
    {
      key: 'block-analyzer',
      visible: checkPermission('block_analyzer'),
      title: 'BH Block Analyzer',
      description: 'Analyze block coverage and population data across regions.',
      icon: <MapPinned className="h-5 w-5" />,
      onClick: () => handleTabChange('block-analyzer'),
      isPending,
      badge: 'Analytics',
      tone: 'feature'
    },
    {
      key: 'duty-scheduler',
      visible: isModuleEnabled('dutyScheduler') && checkPermission('duty_scheduler'),
      title: 'Duty Scheduler',
      description: 'Generate, manage, and track automated pharmacist duty schedules.',
      icon: <Calendar className="h-5 w-5" />,
      onClick: () => handleTabChange('duty-scheduler'),
      isPending,
      badge: 'Beta',
      tone: 'feature'
    },
    {
      key: 'leave-management',
      visible: isModuleEnabled('leaveManagement') && (
        checkPermission('leave_management') ||
        checkPermission('duty_scheduler') ||
        checkPermission('hr_requests') ||
        isManager ||
        isOwner
      ),
      title: 'Leave Management & Compliance',
      description: 'Annual leave requests, dynamic accrual ledgers, manual balance adjustments, and Bahrain Labor Law weekly rest compliance.',
      icon: <CalendarCheck className="h-5 w-5" />,
      onClick: () => handleTabChange('leave-management'),
      isPending,
      badge: 'Compliance',
      badgeStyle: 'red',
      tone: 'feature'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Banner / Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-black text-xl shadow-inner">
              TH
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Module Launcher</h2>
              <p className="text-sm font-medium text-slate-500">Access operational workspaces and central administration tools</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-slate-700 text-xs font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{role && role !== 'branch' ? ROLE_LABELS[role] : authState.pharmacist?.name}</span>
            </div>
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-700">Modules</h3>
            <p className="text-sm font-medium text-slate-400 mt-1">Choose a workflow</p>
          </div>
        </div>

        <div className={`grid ${moduleGridClass} gap-4 page-enter`}>
          {moduleCards
            .filter(card => card.visible)
            .sort((a, b) => {
              const first = moduleDisplayByKey.get(a.key)?.order ?? 9999;
              const second = moduleDisplayByKey.get(b.key)?.order ?? 9999;
              return first - second || a.key.localeCompare(b.key);
            })
            .map(({ key, visible, ...card }) => {
              const display = moduleDisplayByKey.get(key);
              return (
                <ModuleCard
                  key={key}
                  {...card}
                  badge={display ? display.badge : card.badge}
                  badgeStyle={display ? display.badgeStyle : card.badgeStyle}
                />
              );
            })}
        </div>

        <div className="mt-10 text-center">
          <button
            onClick={logout}
            className="group mx-auto inline-flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-white shadow-sm shadow-brand/20 ring-1 ring-brand/10 transition-all hover:-translate-y-0.5 hover:bg-brand-hover hover:shadow-md hover:shadow-brand/25 active:translate-y-0 active:bg-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
      <Footer onNavigate={handleTabChange} permissions={authState.permissions} rolePermissions={authState.rolePermissions} user={authState.user} settings={footerSettings} />
    </div>
  );
};
