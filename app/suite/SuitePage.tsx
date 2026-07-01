import React, { useMemo } from 'react';
import { 
  BarChart3, BookOpenCheck, ClipboardCheck, ClipboardList, FileText, Landmark, LayoutGrid, Lightbulb, LogOut, MapPinned, MessageSquareText, PieChart, QrCode, Radar, ReceiptText, Settings2, ShieldCheck, Truck, UsersRound, WalletCards
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
      visible: isOwner,
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
      visible: isManager && canUseHr && checkPermission('hr_requests'),
      title: 'HR Requests Admin',
      description: 'Review employee requests and generate official letterheads.',
      icon: <ClipboardList className="h-5 w-5" />,
      onClick: () => handleTabChange('hr-manager'),
      isPending,
      badge: 'Admin'
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
      visible: isManager && canUseWorkforce && checkPermission('workforce'),
      title: 'Workforce Analytics',
      description: 'Optimize staffing levels and calculate relief requirements.',
      icon: <UsersRound className="h-5 w-5" />,
      onClick: () => handleTabChange('workforce'),
      isPending,
      badge: 'Planning'
    },
    {
      key: 'hr',
      visible: role === 'branch' && canUseHr && checkPermission('hr_requests'),
      title: 'HR Self-Service',
      description: 'Request official documents and certificates directly.',
      icon: <FileText className="h-5 w-5" />,
      onClick: () => handleTabChange('hr'),
      isPending,
      badge: 'Self-service'
    },
    {
      key: 'cash-flow',
      visible: !isOwner && isModuleEnabled('cashFlow') && checkPermission('cash_flow'),
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
      visible: !isManager && !isOwner && isModuleEnabled('cashTracker') && checkPermission('cash_tracker'),
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
      visible: !isOwner && isModuleEnabled('corporateCodex') && checkPermission('corporate_codex'),
      title: 'Corporate Codex',
      description: 'Official policies, circulars, and operating protocols.',
      icon: <BookOpenCheck className="h-5 w-5" />,
      onClick: () => handleTabChange('corporate-codex'),
      isPending,
      badge: 'Knowledge',
      tone: 'knowledge'
    },
    {
      key: 'system-settings',
      visible: isModuleEnabled('settings') && ((isManager && checkPermission('settings', 'edit')) || canOpenApprovalQueue),
      title: 'System Settings',
      description: 'Maintenance mode, branding, module layout, delivery zones, and branch operating setup.',
      icon: <Settings2 className="h-5 w-5" />,
      onClick: () => handleTabChange('system-settings'),
      isPending,
      badge: 'System'
    },
    {
      key: 'access-control',
      visible: isModuleEnabled('settings') && ((isManager && checkPermission('settings', 'edit')) || canOpenApprovalQueue),
      title: 'Access Control',
      description: 'Users, roles, read/edit module permissions, people records, and login approvals.',
      icon: <ShieldCheck className="h-5 w-5" />,
      onClick: () => handleTabChange('access-control'),
      isPending,
      badge: 'Security'
    },
    {
      key: 'spin-win',
      visible: !isOwner && isModuleEnabled('spinWin') && checkPermission('spin_win'),
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
      visible: !isOwner && isModuleEnabled('qualityFeedback') && checkPermission('quality_feedback'),
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
      visible: isModuleEnabled('qualityFeedback') && checkPermission('feedback_admin', 'edit'),
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
      visible: !isOwner && isModuleEnabled('employeeContributions') && checkPermission('employee_contributions'),
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
      visible: !isOwner && isModuleEnabled('workflowTodo') && checkPermission('workflow_todo'),
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
      visible: role !== 'owner' && isModuleEnabled('delivery') && checkPermission('delivery'),
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
      visible: role !== 'owner' && isModuleEnabled('benefitPayLedger') && checkPermission('benefit_pay_ledger'),
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
      key: 'block-analyzer',
      visible: isManager && checkPermission('block_analyzer'),
      title: 'BH Block Analyzer',
      description: 'Analyze block coverage and population data across regions.',
      icon: <MapPinned className="h-5 w-5" />,
      onClick: () => handleTabChange('block-analyzer'),
      isPending,
      badge: 'Analytics',
      tone: 'feature'
    },
    {
      key: 'command-center',
      visible: !isOwner && checkPermission('command_center'),
      title: 'Daily Command Center',
      description: 'Download yesterday branch files, review recovery signals, and follow up daily actions.',
      icon: <Radar className="h-5 w-5" />,
      onClick: () => handleTabChange('command-center'),
      isPending,
      badge: 'new module',
      badgeStyle: 'red',
      cta: 'Open command center'
    }
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col selection:bg-brand/10">
      <div className="flex-1 max-w-[1400px] mx-auto w-full px-5 md:px-8 py-8 lg:py-12">
        <div className="mb-8 page-enter">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex items-center space-x-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-brand/15 bg-brand/10 text-brand shadow-sm">
                <LayoutGrid className="h-6 w-6" strokeWidth={2.3} />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-950 tracking-tight mb-1.5">Operations Modules</h2>
                <div className="flex items-center space-x-3">
                  <span className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-[11px] font-bold">{authState.user?.code}</span>
                  <span className="flex items-center space-x-1.5 text-xs font-medium text-slate-500">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    <span>Connected</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex items-center space-x-4 bg-white p-3 pr-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-400">On duty</span>
                <span className="text-sm font-bold text-slate-900 leading-none mt-0.5">{role && role !== 'branch' ? ROLE_LABELS[role] : authState.pharmacist?.name}</span>
              </div>
            </div>
          </div>
          <div className="divider-gradient"></div>
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
