import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  FileText,
  HelpCircle,
  Landmark,
  LayoutGrid,
  Lightbulb,
  MapPinned,
  MessageSquareText,
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
  | 'feedback-form'
  | 'feedback-admin'
  | 'employee-contributions'
  | 'block-analyzer'
  | 'delivery';

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

export const ModuleHelpButton: React.FC<ModuleHelpButtonProps> = ({ moduleKey, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const content = useMemo(() => moduleKey ? MODULE_HELP_CONTENT[moduleKey] : null, [moduleKey]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!content) return null;

  const Icon = content.icon;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-brand/15 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-brand shadow-sm shadow-brand/5 transition-all hover:border-brand/40 hover:bg-brand/5 active:scale-[0.99] focus-ring ${className}`.trim()}
        aria-label="How to use this module"
      >
        <HelpCircle className="h-4 w-4" />
        <span>How to use this module</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm print:hidden" role="dialog" aria-modal="true" aria-label={`How to use ${content.title}`}>
          <style>{`
            @keyframes moduleHelpStepIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .module-help-step {
              opacity: 0;
              animation: moduleHelpStepIn 360ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            }
          `}</style>
          <div className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_28px_90px_-28px_rgba(15,23,42,0.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-brand/10 bg-brand/5 px-5 py-4 md:px-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white text-brand shadow-sm ring-1 ring-brand/10">
                  <div className="absolute -right-1 -top-1 h-5 w-5 rounded-md bg-brand/90" />
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

            <div className="max-h-[calc(90vh-96px)] overflow-y-auto p-5 md:p-6">
              <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
                <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-white shadow-sm shadow-brand/20">
                      <LayoutGrid className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Included features</p>
                      <h3 className="text-sm font-black text-slate-950">What this module covers</h3>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {content.features.map((feature) => (
                      <span key={feature} className="inline-flex items-center gap-2 rounded-lg border border-brand/10 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-brand" />
                        {feature}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-3 text-xs font-bold leading-5 text-amber-900">
                    {content.tip}
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
                      <PlayCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand">Animated quick start</p>
                      <h3 className="text-sm font-black text-slate-950">Use it step by step</h3>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {content.steps.map((step, index) => (
                      <div
                        key={step}
                        className="module-help-step flex gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                        style={{ animationDelay: `${index * 95}ms` }}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-xs font-black text-white">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold leading-6 text-slate-800">{step}</p>
                        </div>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="mt-5 flex flex-col gap-3 rounded-lg border border-brand/10 bg-brand/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-brand ring-1 ring-brand/10">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold leading-6 text-slate-700">
                    Keep using the module normally. This guide is only a quick operating reference and does not change permissions or data.
                  </p>
                </div>
                <button type="button" onClick={() => setIsOpen(false)} className="btn-primary shrink-0 text-xs uppercase tracking-widest">
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
