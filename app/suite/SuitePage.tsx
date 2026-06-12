import React from 'react';
import { 
  Activity, Users, FileText, Landmark, Wallet, BookOpen, Settings, LogOut, ShieldCheck, QrCode, MessageSquare, PieChart, Lightbulb, Map
} from 'lucide-react';
import { AuthState } from '../../types';
import { Footer } from '../shared';
import { clientConfig, isModuleEnabled } from '../../config/clientConfig';
import { ROLE_LABELS } from '../../lib/access';

interface SuitePageProps {
  authState: AuthState;
  isManager: boolean;
  isWarehouse: boolean;
  isPending: boolean;
  checkPermission: (feature: string, minimum?: 'edit' | 'read') => boolean;
  handleTabChange: (tab: any) => void;
  logout: () => void;
}

type ModuleTone = 'default' | 'feature' | 'finance' | 'knowledge';

interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  isPending: boolean;
  badge?: string;
  cta?: string;
  tone?: ModuleTone;
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

const ModuleCard: React.FC<ModuleCardProps> = ({
  title,
  description,
  icon,
  onClick,
  isPending,
  cta = 'Open',
  tone = 'default'
}) => {
  const classes = moduleToneClasses[tone];

  return (
    <button
      onClick={onClick}
      className={`group min-h-[184px] rounded-xl border border-brand/10 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md hover:shadow-brand/10 active:scale-[0.99] focus-ring ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <div className="flex h-full flex-col justify-between gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${classes.icon}`}>
            {icon}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-black tracking-tight text-slate-950 transition-colors group-hover:text-brand">{title}</h3>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-500">{description}</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className={`h-px w-6 bg-current opacity-50 transition-all duration-200 group-hover:w-10 ${classes.cta}`}></span>
          <span className={classes.cta}>{cta}</span>
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
  logout
}) => {
  const role = authState.user?.role;
  const isOwner = role === 'owner';
  const canUseSales = isModuleEnabled('sales');
  const canUseHr = isModuleEnabled('hr');
  const canUseWorkforce = canUseHr && isModuleEnabled('workforce');
  const canOpenDashboard = isModuleEnabled('reports') && (
    isWarehouse
      ? isModuleEnabled('adminDashboard')
      : (isManager || isOwner || role === 'supervisor')
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
      visible: canUseSales && !isWarehouse && (checkPermission('lost_sales', 'edit') || checkPermission('shortages', 'edit')),
      title: 'Lost Sales & Shortage',
      description: 'Log out-of-stock items and customer requested deficits in real time.',
      icon: <Activity className="h-5 w-5" />,
      onClick: () => handleTabChange('pos'),
      isPending,
      badge: 'Entry'
    },
    {
      key: 'dashboard-manager',
      visible: isManager && canOpenDashboard,
      title: 'Performance Portal',
      description: 'Review lost sales, shortage trends, and branch performance with manager-level branch selection.',
      icon: <Activity className="h-5 w-5" />,
      onClick: () => openDashboard('standard'),
      isPending,
      badge: 'Analytics'
    },
    {
      key: 'dashboard-admin',
      visible: isWarehouse && canOpenDashboard && (checkPermission('lost_sales') || checkPermission('shortages')),
      title: 'Performance Portal',
      description: 'Review localized branch performance and inventory trends.',
      icon: <Activity className="h-5 w-5" />,
      onClick: () => openDashboard('standard'),
      isPending,
      badge: 'Analytics'
    },
    {
      key: 'hr-manager',
      visible: isManager && canUseHr && checkPermission('hr_requests'),
      title: 'HR Requests Admin',
      description: 'Review employee requests and generate official letterheads.',
      icon: <Users className="h-5 w-5" />,
      onClick: () => handleTabChange('hr-manager'),
      isPending,
      badge: 'Admin'
    },
    {
      key: 'dashboard-branch',
      visible: !isManager && !isWarehouse && canOpenDashboard && (checkPermission('lost_sales') || checkPermission('shortages')),
      title: 'Performance Portal',
      description: 'Review localized branch performance and inventory trends.',
      icon: <Activity className="h-5 w-5" />,
      onClick: () => openDashboard('standard'),
      isPending,
      badge: 'Analytics'
    },
    {
      key: 'workforce',
      visible: isManager && canUseWorkforce && checkPermission('workforce'),
      title: 'Workforce Analytics',
      description: 'Optimize staffing levels and calculate relief requirements.',
      icon: <Users className="h-5 w-5" />,
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
      visible: !isManager && isModuleEnabled('cashTracker') && checkPermission('cash_tracker'),
      title: 'Branch Cash Tracker',
      description: 'Log and track daily cash differences between POS and count.',
      icon: <Wallet className="h-5 w-5" />,
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
      icon: <BookOpen className="h-5 w-5" />,
      onClick: () => handleTabChange('corporate-codex'),
      isPending,
      badge: 'Knowledge',
      tone: 'knowledge'
    },
    {
      key: 'settings',
      visible: isModuleEnabled('settings') && role === 'manager' && checkPermission('settings', 'edit'),
      title: 'Settings & Permissions',
      description: 'Manage branches, staff access, and enabled workflows.',
      icon: <Settings className="h-5 w-5" />,
      onClick: () => handleTabChange('settings'),
      isPending,
      badge: 'Control'
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
      title: 'QC Insights',
      description: 'Submit anonymous quality feedback and suggestions.',
      icon: <MessageSquare className="h-5 w-5" />,
      onClick: () => handleTabChange('feedback-form'),
      isPending,
      badge: 'Feedback',
      tone: 'feature'
    },
    {
      key: 'feedback-admin',
      visible: isModuleEnabled('qualityFeedback') && (isManager || isOwner) && checkPermission('quality_feedback'),
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
      key: 'block-analyzer',
      visible: (isManager || isOwner) && checkPermission('block_analyzer'),
      title: 'BH Block Analyzer',
      description: 'Analyze block coverage and population data across regions.',
      icon: <Map className="h-5 w-5" />,
      onClick: () => handleTabChange('block-analyzer'),
      isPending,
      badge: 'Analytics',
      tone: 'feature'
    },
    {
      key: 'command-center',
      visible: checkPermission('command_center'),
      title: 'Daily Command Center',
      description: 'Download yesterday branch files, review recovery signals, and follow up daily actions.',
      icon: <ShieldCheck className="h-5 w-5" />,
      onClick: () => handleTabChange('command-center'),
      isPending,
      badge: 'Daily close',
      cta: 'Open command center'
    }
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col selection:bg-brand/10">
      <div className="flex-1 max-w-[1400px] mx-auto w-full px-5 md:px-8 py-8 lg:py-12">
        <div className="mb-8 page-enter">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex items-center space-x-5">
              <div className="w-12 h-12 bg-brand rounded-lg flex items-center justify-center shadow-sm overflow-hidden">
                <img src={clientConfig.logoUrl} alt={`${clientConfig.clientName} logo`} className="w-full h-full object-cover" />
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
            <p className="text-sm font-medium text-slate-400 mt-1">Choose a workflow. Every module keeps the Tabarak red brand accent.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 page-enter">
          {moduleCards
            .filter(card => card.visible)
            .map(({ key, visible, ...card }) => (
              <ModuleCard key={key} {...card} />
            ))}
        </div>

        <div className="mt-10 text-center">
          <button
            onClick={logout}
            className="btn-secondary mx-auto text-xs"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
      <Footer onNavigate={handleTabChange} permissions={authState.permissions} rolePermissions={authState.rolePermissions} user={authState.user} />
    </div>
  );
};
