import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Compass,
  FileText,
  HelpCircle,
  Landmark,
  LayoutGrid,
  Lightbulb,
  ListChecks,
  MapPinned,
  MessageSquareText,
  MousePointerClick,
  PieChart,
  PlayCircle,
  QrCode,
  Radar,
  Settings2,
  ShieldCheck,
  Truck,
  UsersRound,
  WalletCards,
  X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ModuleHelpKey =
  | 'command-center'
  | 'pos'
  | 'dashboard'
  | 'spin-win'
  | 'hr'
  | 'hr-manager'
  | 'workforce'
  | 'cash-flow'
  | 'cash-tracker'
  | 'corporate-codex'
  | 'settings'
  | 'system-settings'
  | 'access-control'
  | 'feedback-form'
  | 'feedback-admin'
  | 'employee-contributions'
  | 'block-analyzer'
  | 'delivery';

type ModuleHelpTab = 'overview' | 'workflow' | 'features' | 'checks';

type ModuleHelpContent = {
  title: string;
  eyebrow: string;
  summary: string;
  icon: LucideIcon;
  features: string[];
  steps: string[];
  tip: string;
};

const MODULE_HELP_CONTENT: Record<ModuleHelpKey, ModuleHelpContent> = {
  'command-center': {
    title: 'Daily Command Center',
    eyebrow: 'Operations module',
    summary: 'One control view for daily risks, saved tasks, branch health, and urgent follow-up.',
    icon: Radar,
    features: ['Unified alerts', 'Saved operations tasks', 'Branch health', 'Pending work', 'Yesterday exports'],
    steps: [
      'Start by reviewing the risk counters and branch health summary.',
      'Open any alert to inspect the affected branch, workflow, and recommended action.',
      'Create a saved task only when the alert needs accountable follow-up.',
      'Update task status and comments so the event trail stays clear for managers.'
    ],
    tip: 'Suggested actions are not persisted until a real task is created.'
  },
  pos: {
    title: 'Lost Sales & Shortage Log',
    eyebrow: 'Branch entry module',
    summary: 'Record missing products, lost demand, and shortage signals while the customer request is still fresh.',
    icon: ClipboardList,
    features: ['Lost sales entry', 'Shortage entry', 'Pharmacist lock', 'Driver lock', 'Excel export', 'Branch map view'],
    steps: [
      'Select or confirm the active pharmacist before logging records.',
      'Search by product or add a manual item when the product is not listed.',
      'Use lock/unlock when the same pharmacist or driver is repeated across orders.',
      'Submit the record, then use history and exports for daily follow-up.'
    ],
    tip: 'Use clear item names and quantities so dashboard analytics stay readable.'
  },
  dashboard: {
    title: 'Performance Dashboard',
    eyebrow: 'Analytics module',
    summary: 'Review sales loss, shortage performance, branch ranking, and operational signals.',
    icon: BarChart3,
    features: ['KPI cards', 'Date filters', 'Branch filters', 'Lost sales analytics', 'Shortage trends', 'Exports'],
    steps: [
      'Choose the date range before comparing branches or product groups.',
      'Use branch and product filters to isolate the signal you want to explain.',
      'Review KPIs first, then move to trends and detailed records.',
      'Export only after filters match the management question.'
    ],
    tip: 'For branch users, dashboard data should remain scoped to the current branch.'
  },
  'spin-win': {
    title: 'Spin & Win',
    eyebrow: 'Customer engagement module',
    summary: 'Generate customer QR links, redeem vouchers, and monitor branch reward activity.',
    icon: QrCode,
    features: ['Static QR', 'Single session QR', 'Multi-use campaign', 'Voucher redemption', 'Branch metrics', 'Reward controls'],
    steps: [
      'Open Generate QR & Link when a customer or campaign needs a reward entry point.',
      'Use Static for posters, Single for one customer, and Multi for controlled sharing.',
      'Copy or download the QR, then share through the branch-approved channel.',
      'Redeem vouchers through the security code flow before giving the reward.'
    ],
    tip: 'Static QR links must use branch code exchange, not internal branch IDs.'
  },
  hr: {
    title: 'HR Self-Service',
    eyebrow: 'Employee service module',
    summary: 'Submit staff requests and official document requests from the branch portal.',
    icon: FileText,
    features: ['Employee requests', 'Document requests', 'Branch self-service', 'Request tracking'],
    steps: [
      'Choose the request type that matches the employee need.',
      'Fill required fields carefully before submission.',
      'Submit once and wait for HR/admin processing.',
      'Use the same portal to review request state when available.'
    ],
    tip: 'Keep request details professional so generated documents need less correction.'
  },
  'hr-manager': {
    title: 'HR Requests Admin',
    eyebrow: 'Admin HR module',
    summary: 'Review employee requests, manage approvals, and generate official letterheads.',
    icon: ClipboardList,
    features: ['Request queue', 'Approval review', 'Official letters', 'Status tracking'],
    steps: [
      'Scan pending requests by type, branch, and urgency.',
      'Open the request details before approving or rejecting.',
      'Generate official output only after confirming employee data.',
      'Keep request status updated so branches do not duplicate submissions.'
    ],
    tip: 'Do not generate official documents from incomplete employee data.'
  },
  workforce: {
    title: 'Workforce Analytics',
    eyebrow: 'Planning module',
    summary: 'Understand staffing coverage, relief needs, and branch manpower gaps.',
    icon: UsersRound,
    features: ['Staffing KPIs', 'Relief planning', 'Branch comparison', 'Workload signals'],
    steps: [
      'Start from the workforce KPI overview to spot coverage gaps.',
      'Compare branches before deciding where relief support is needed.',
      'Use planning views to balance staffing across active branches.',
      'Document follow-up actions outside the report when manager approval is needed.'
    ],
    tip: 'Use workforce analytics as a planning signal, not as the only HR decision source.'
  },
  'cash-flow': {
    title: 'Cash Flow Planner',
    eyebrow: 'Finance module',
    summary: 'Plan liquidity, monitor expected revenues and expenses, and review financial risk.',
    icon: Landmark,
    features: ['Liquidity forecast', 'Revenue registry', 'Expense planner', 'Supplier view', 'Risk monitoring'],
    steps: [
      'Review the dashboard summary before editing revenues or expenses.',
      'Add expected inflows and outflows with accurate dates.',
      'Use supplier and expense views to understand upcoming pressure.',
      'Recheck the forecast after every major update.'
    ],
    tip: 'The planner is only useful when dates and BHD values are kept current.'
  },
  'cash-tracker': {
    title: 'Branch Cash Tracker',
    eyebrow: 'Branch finance module',
    summary: 'Log daily POS cash differences and keep branch reconciliation visible.',
    icon: WalletCards,
    features: ['Daily cash entry', 'Difference tracking', 'Status updates', 'History review'],
    steps: [
      'Enter the POS and counted cash values for the branch day.',
      'Review the calculated difference before saving.',
      'Add notes when the reason is known.',
      'Use history to follow unresolved differences.'
    ],
    tip: 'Record cash differences daily so finance can spot repeated patterns early.'
  },
  'corporate-codex': {
    title: 'Corporate Codex',
    eyebrow: 'Knowledge module',
    summary: 'Access official policies, circulars, protocols, and internal operating references.',
    icon: BookOpenCheck,
    features: ['Policies', 'Circulars', 'Protocols', 'Search', 'Document library'],
    steps: [
      'Use search or department filters to find the right document.',
      'Open the latest published version before acting on a policy.',
      'Review priority and document type to understand urgency.',
      'Managers can maintain content when they have the right permissions.'
    ],
    tip: 'Treat Codex content as the operating reference, not informal chat history.'
  },
  settings: {
    title: 'Settings & Permissions',
    eyebrow: 'Control module',
    summary: 'Manage branches, users, role permissions, system settings, and operational defaults.',
    icon: Settings2,
    features: ['Branches', 'Pharmacists', 'Users & roles', 'Role permissions', 'Module layout', 'Delivery zones'],
    steps: [
      'Choose the settings tab that matches the configuration area.',
      'Search existing records before adding a new branch, user, or staff member.',
      'Save changes deliberately and re-check permissions after role updates.',
      'Use delivery zones and module layout only when operational data is ready.'
    ],
    tip: 'Settings changes can affect access, so validate with the intended role after saving.'
  },
  'system-settings': {
    title: 'System Settings',
    eyebrow: 'System module',
    summary: 'Manage maintenance mode, branding, module layout, delivery zones, and branch operating records.',
    icon: Settings2,
    features: ['Maintenance mode', 'Login branding', 'Footer branding', 'Module layout', 'Delivery zones', 'Branches'],
    steps: [
      'Start with maintenance status when the domain needs to be paused.',
      'Update branding and login copy before changing public-facing pages.',
      'Use Module Layout to arrange launcher cards and badges.',
      'Maintain branches and delivery zones before relying on branch-level dashboards.'
    ],
    tip: 'System changes affect every user, so refresh and verify from the module launcher after saving.'
  },
  'access-control': {
    title: 'Access Control',
    eyebrow: 'Security module',
    summary: 'Manage people, users, role defaults, module permissions, and trusted login approvals.',
    icon: ShieldCheck,
    features: ['People records', 'Users & roles', 'Role defaults', 'Branch permissions', 'Login approvals'],
    steps: [
      'Review the user or role identity before changing permissions.',
      'Use read/edit levels to separate viewing from operational actions.',
      'Check the role preview to confirm what each identity will see.',
      'Approve login requests only when the device and branch context are expected.'
    ],
    tip: 'After permission changes, validate with the intended role before treating access as final.'
  },
  'feedback-form': {
    title: 'Quality Feedback',
    eyebrow: 'Feedback module',
    summary: 'Submit structured quality feedback and suggestions through the staff-facing form.',
    icon: MessageSquareText,
    features: ['Anonymous feedback', 'Structured questions', 'Comments', 'Submission confirmation'],
    steps: [
      'Answer each visible question honestly and briefly.',
      'Add comments only where context will help the quality team.',
      'Submit once and wait for the confirmation screen.',
      'Avoid entering private customer or staff secrets in free-text comments.'
    ],
    tip: 'Good feedback describes the issue, location, and impact without naming unnecessary people.'
  },
  'feedback-admin': {
    title: 'Feedback Admin',
    eyebrow: 'Quality analytics module',
    summary: 'Analyze quality trends, review comments, and maintain feedback question settings.',
    icon: PieChart,
    features: ['Quality KPIs', 'Comment review', 'Question manager', 'Module settings', 'Exports'],
    steps: [
      'Start with the analytics tab to understand the current quality trend.',
      'Review comments after filtering by period, cluster, or role.',
      'Use the question manager to maintain active feedback fields.',
      'Export results only after filters match the reporting period.'
    ],
    tip: 'Keep question changes controlled so trend comparisons remain meaningful.'
  },
  'employee-contributions': {
    title: 'Team Contributions',
    eyebrow: 'Ideas module',
    summary: 'Share tools, automations, knowledge, and improvement ideas from the team.',
    icon: Lightbulb,
    features: ['Idea submission', 'Tool sharing', 'Knowledge posts', 'Search', 'Filtering'],
    steps: [
      'Search existing contributions before adding a new idea.',
      'Choose the right contribution type and add a concise title.',
      'Describe the operational benefit and how the team should use it.',
      'Review shared items by type when looking for reusable tools.'
    ],
    tip: 'The best contribution explains the problem, the solution, and the expected impact.'
  },
  'block-analyzer': {
    title: 'BH Block Analyzer',
    eyebrow: 'Geography module',
    summary: 'Analyze Bahrain block coverage, opportunities, and density signals.',
    icon: MapPinned,
    features: ['Block overview', 'Coverage opportunities', 'Density analysis', 'Map view', 'Filters'],
    steps: [
      'Use the overview to understand coverage before drilling into opportunities.',
      'Switch tabs based on the question: reach, opportunity, or density.',
      'Use filters to narrow the map or table to the relevant area.',
      'Treat geometry and population data as planning input that still needs business review.'
    ],
    tip: 'Map insights should be validated with real branch and delivery knowledge before action.'
  },
  delivery: {
    title: 'Delivery Recording & Traceability',
    eyebrow: 'Delivery module',
    summary: 'Record delivery orders, manage delivery references, and analyze service coverage.',
    icon: Truck,
    features: ['New delivery orders', 'Drivers', 'Areas', 'Supervisors', 'Coverage map', 'Profitability', 'Exports'],
    steps: [
      'Branch users record each delivery order with driver, pharmacist, value, and block.',
      'Managers maintain drivers, areas, supervisors, and block-to-area references first.',
      'Use coverage analytics to compare branches, blocks, governorates, and service zones.',
      'Export filtered data only after checking branch/date filters.'
    ],
    tip: 'When block references are maintained, area detection becomes faster and more consistent.'
  }
};

interface ModuleHelpButtonProps {
  moduleKey: ModuleHelpKey | null;
  className?: string;
}

const HELP_TABS: Array<{
  id: ModuleHelpTab;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { id: 'overview', label: 'Overview', description: 'Purpose and outcomes', icon: Compass },
  { id: 'workflow', label: 'Workflow', description: 'Animated quick start', icon: PlayCircle },
  { id: 'features', label: 'Features', description: 'Everything included', icon: LayoutGrid },
  { id: 'checks', label: 'Checks', description: 'Safe operating habits', icon: ListChecks }
];

export const ModuleHelpButton: React.FC<ModuleHelpButtonProps> = ({ moduleKey, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ModuleHelpTab>('overview');
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [selectedFeatureIndex, setSelectedFeatureIndex] = useState(0);
  const content = useMemo(() => moduleKey ? MODULE_HELP_CONTENT[moduleKey] : null, [moduleKey]);
  const activeTabMeta = HELP_TABS.find((tab) => tab.id === activeTab) ?? HELP_TABS[0];

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('overview');
    setActiveStepIndex(0);
    setSelectedFeatureIndex(0);
  }, [isOpen, moduleKey]);

  if (!content) return null;

  const Icon = content.icon;
  const ActiveTabIcon = activeTabMeta.icon;
  const activeStep = content.steps[activeStepIndex] ?? content.steps[0];
  const selectedFeature = content.features[selectedFeatureIndex] ?? content.features[0];
  const safeChecks = [
    `Confirm the right role and branch scope before using ${content.title}.`,
    'Check filters, dates, and selected records before saving or exporting.',
    'Keep entries clear enough for managers to review without extra context.',
    content.tip
  ];
  const overviewStats = [
    { label: 'Features', value: content.features.length.toString() },
    { label: 'Workflow steps', value: content.steps.length.toString() },
    { label: 'Mode', value: content.eyebrow.replace(' module', '') }
  ];

  const renderTabPanel = () => {
    if (activeTab === 'workflow') {
      return (
        <div className="grid min-h-0 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-2">
            {content.steps.map((step, index) => {
              const isActive = index === activeStepIndex;
              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => setActiveStepIndex(index)}
                  className={`module-help-step group flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                    isActive
                      ? 'border-brand/40 bg-brand/5 shadow-sm shadow-brand/10'
                      : 'border-slate-200 bg-white hover:border-brand/25 hover:bg-brand/5'
                  }`}
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                    isActive ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-brand group-hover:text-white'
                  }`}>
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-black ${isActive ? 'text-brand' : 'text-slate-800'}`}>
                      Step {index + 1}
                    </span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{step}</span>
                  </span>
                  <ChevronRight className={`mt-1 h-4 w-4 shrink-0 transition-transform ${isActive ? 'translate-x-0.5 text-brand' : 'text-slate-300 group-hover:text-brand'}`} />
                </button>
              );
            })}
          </div>

          <div className="operational-panel-muted flex min-h-[320px] flex-col justify-between p-5">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm">
                  <MousePointerClick className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Selected action</p>
                  <h3 className="text-base font-black text-slate-950">Step {activeStepIndex + 1} guidance</h3>
                </div>
              </div>
              <p className="text-lg font-black leading-8 text-slate-950">{activeStep}</p>
            </div>
            <div className="mt-6 rounded-lg border border-brand/10 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Operator note</p>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-700">{content.tip}</p>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'features') {
      return (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[1fr_0.9fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            {content.features.map((feature, index) => {
              const isSelected = index === selectedFeatureIndex;
              return (
                <button
                  key={feature}
                  type="button"
                  onClick={() => setSelectedFeatureIndex(index)}
                  className={`module-help-step group flex min-h-[94px] items-start gap-3 rounded-lg border p-4 text-left transition-all ${
                    isSelected
                      ? 'border-brand/45 bg-brand/5 shadow-sm shadow-brand/10'
                      : 'border-slate-200 bg-white hover:border-brand/25 hover:bg-slate-50'
                  }`}
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isSelected ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-brand/10 group-hover:text-brand'
                  }`}>
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black leading-5 text-slate-900">{feature}</span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">Tap to focus this capability.</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="operational-panel-muted p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Feature focus</p>
            <h3 className="mt-2 text-xl font-black leading-7 text-slate-950">{selectedFeature}</h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              Use this capability inside {content.title} as part of the normal operating flow. Confirm the active filters and role scope before taking any action.
            </p>
            <div className="mt-5 space-y-2">
              {content.steps.slice(0, 3).map((step, index) => (
                <div key={step} className="flex items-start gap-3 rounded-lg bg-white p-3 ring-1 ring-slate-200">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-950 text-[10px] font-black text-white">{index + 1}</span>
                  <p className="text-xs font-bold leading-5 text-slate-600">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'checks') {
      return (
        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-3">
            {safeChecks.map((check, index) => (
              <div
                key={check}
                className="module-help-step flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4"
                style={{ animationDelay: `${index * 65}ms` }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <p className="text-sm font-bold leading-6 text-slate-700">{check}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-amber-100 bg-amber-50 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-amber-700 ring-1 ring-amber-100">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Safety rule</p>
                <h3 className="text-base font-black text-amber-950">Operate with clean data</h3>
              </div>
            </div>
            <p className="mt-4 text-sm font-bold leading-6 text-amber-900">
              This guide helps users understand the module. It does not bypass role permissions, branch scoping, approval rules, or existing security policies.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="operational-panel-muted p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand text-white shadow-sm shadow-brand/20">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">{content.eyebrow}</p>
              <h3 className="text-lg font-black text-slate-950">{content.title}</h3>
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{content.summary}</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {overviewStats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-lg font-black text-slate-950">{stat.value}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveTab('workflow')}
            className="module-help-step group rounded-lg border border-slate-200 bg-white p-4 text-left transition-all hover:border-brand/30 hover:bg-brand/5"
          >
            <PlayCircle className="h-5 w-5 text-brand" />
            <h4 className="mt-3 text-sm font-black text-slate-950">Follow the workflow</h4>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Open the animated steps and click each action to understand the daily flow.</p>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('features')}
            className="module-help-step group rounded-lg border border-slate-200 bg-white p-4 text-left transition-all hover:border-brand/30 hover:bg-brand/5"
            style={{ animationDelay: '70ms' }}
          >
            <LayoutGrid className="h-5 w-5 text-brand" />
            <h4 className="mt-3 text-sm font-black text-slate-950">Explore all features</h4>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Review every included tool and focus the capability you need.</p>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('checks')}
            className="module-help-step group rounded-lg border border-slate-200 bg-white p-4 text-left transition-all hover:border-brand/30 hover:bg-brand/5 sm:col-span-2"
            style={{ animationDelay: '140ms' }}
          >
            <ShieldCheck className="h-5 w-5 text-brand" />
            <h4 className="mt-3 text-sm font-black text-slate-950">Review safe operating checks</h4>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Use the checklist before saving, exporting, approving, or sharing module data.</p>
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg active:scale-[0.99] focus-ring ${className}`.trim()}
        aria-label="How to use this module"
      >
        <HelpCircle className="h-4 w-4" />
        <span>How to use this module</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm print:hidden sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`How to use ${content.title}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <style>{`
            @keyframes moduleHelpStepIn {
              from { opacity: 0; transform: translateY(12px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .module-help-step {
              opacity: 0;
              animation: moduleHelpStepIn 320ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            }
          `}</style>
          <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_28px_90px_-28px_rgba(15,23,42,0.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-brand/10 bg-brand/5 px-4 py-4 md:px-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white text-brand shadow-sm ring-1 ring-brand/10">
                  <div className="absolute -right-1 -top-1 h-5 w-5 rounded-md bg-brand/90 shadow-sm shadow-brand/20" />
                  <Icon className="relative h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">{content.eyebrow}</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 md:text-2xl">{content.title}</h2>
                  <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-600">{content.summary}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand focus-ring"
                aria-label="Close module help"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="border-b border-slate-200 bg-slate-50/70 p-3 lg:border-b-0 lg:border-r lg:p-4">
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-1" role="tablist" aria-label="Module help sections">
                  {HELP_TABS.map((tab) => {
                    const TabIcon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex min-h-[74px] items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all ${
                          isActive
                            ? 'border-brand/40 bg-white text-brand shadow-sm shadow-brand/10'
                            : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white'
                        }`}
                      >
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          isActive ? 'bg-brand text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'
                        }`}>
                          <TabIcon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-black uppercase tracking-[0.12em]">{tab.label}</span>
                          <span className={`mt-1 hidden text-[11px] font-semibold leading-4 sm:block ${isActive ? 'text-brand/70' : 'text-slate-400'}`}>
                            {tab.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="min-h-0 overflow-y-auto p-4 scrollbar-thin md:p-6" role="tabpanel" aria-label={activeTabMeta.label}>
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white">
                      <ActiveTabIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Interactive guide</p>
                      <h3 className="text-lg font-black text-slate-950">{activeTabMeta.label}</h3>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-brand">{content.features.length} features</span>
                    <span className="badge badge-neutral">{content.steps.length} steps</span>
                  </div>
                </div>

                {renderTabPanel()}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-brand/10 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
              <div className="flex items-center gap-3">
                <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/5 text-brand ring-1 ring-brand/10 sm:flex">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <p className="text-xs font-bold leading-5 text-slate-600">
                  This guide is an operating reference only. It does not change permissions, branch scoping, approvals, or saved data.
                </p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="btn-primary shrink-0 text-xs uppercase tracking-widest">
                Got it
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
