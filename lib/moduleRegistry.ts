import { ClientModuleKey, clientConfig, isModuleEnabled } from '../config/clientConfig';

export type AccessFeatureId =
  | 'command_center'
  | 'lost_sales'
  | 'shortages'
  | 'spin_win'
  | 'hr_requests'
  | 'workforce'
  | 'cash_flow'
  | 'cash_tracker'
  | 'corporate_codex'
  | 'quality_feedback'
  | 'feedback_admin'
  | 'employee_contributions'
  | 'workflow_todo'
  | 'delivery'
  | 'benefit_pay_ledger'
  | 'products'
  | 'block_analyzer'
  | 'settings';

export type AccessFeature = {
  id: AccessFeatureId | string;
  label: string;
  module?: ClientModuleKey;
  description?: string;
};

export const ACCESS_FEATURES: AccessFeature[] = [
  { id: 'command_center', label: 'Daily Command Center', description: 'Daily action center and operational follow-up.' },
  { id: 'lost_sales', label: 'Lost Sales Tracker', module: 'sales', description: 'Log and review missed sales requests.' },
  { id: 'shortages', label: 'Shortages Tracker', module: 'sales', description: 'Log and review branch stock gaps.' },
  { id: 'spin_win', label: 'Spin & Win Dashboard', module: 'spinWin', description: 'Customer reward wheel controls and branch QR access.' },
  { id: 'hr_requests', label: 'HR Portal', module: 'hr', description: 'HR self-service and request management.' },
  { id: 'workforce', label: 'Workforce Analytics', module: 'workforce', description: 'Staffing and relief planning analytics.' },
  { id: 'cash_flow', label: 'Cash Flow Planner', module: 'cashFlow', description: 'Liquidity planning and cash flow forecast.' },
  { id: 'cash_tracker', label: 'Branch Cash Tracker', module: 'cashTracker', description: 'Daily branch cash difference tracking.' },
  { id: 'corporate_codex', label: 'Corporate Codex', module: 'corporateCodex', description: 'Policies, circulars, and operating protocols.' },
  { id: 'quality_feedback', label: 'QA Insights', module: 'qualityFeedback', description: 'Controls access to the QA Insights submission form.' },
  { id: 'feedback_admin', label: 'Feedback Admin', module: 'qualityFeedback', description: 'Admin-only by default; non-admin roles need Edit / Full Control to review QA answers and analytics.' },
  { id: 'employee_contributions', label: 'Team Contributions', module: 'employeeContributions', description: 'Employee-submitted tools, projects, and knowledge.' },
  { id: 'workflow_todo', label: 'Workflow & Todo', module: 'workflowTodo', description: 'Branch workflow tasks, personal todos, approvals, and recurring task follow-up.' },
  { id: 'delivery', label: 'Delivery Recording & Traceability', module: 'delivery', description: 'None disables the module, Read keeps dashboards and block coverage visible, Edit allows delivery activity recording.' },
  { id: 'benefit_pay_ledger', label: 'Benefit Pay Ledger', module: 'benefitPayLedger', description: 'None disables the module, Read shows BP dashboard, Edit allows manual BP transfer recording.' },
  { id: 'products', label: 'Product Catalogue', module: 'products', description: 'Product catalogue and item management.' },
  { id: 'block_analyzer', label: 'BH Block Analyzer', description: 'Block coverage and population analysis.' },
  { id: 'settings', label: 'Admin Control', module: 'settings', description: 'Controls System Settings and Access Control modules.' }
];

const formatModuleLabel = (moduleKey: string): string =>
  moduleKey
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());

export const getAccessFeatureLabel = (featureId: string): string =>
  ACCESS_FEATURES.find(feature => feature.id === featureId)?.label || formatModuleLabel(featureId);

const NON_ACCESS_MODULE_KEYS: ClientModuleKey[] = [
  'reports',
  'excelExport',
  'branchDashboard',
  'managerDashboard',
  'adminDashboard'
];

export type SubTool = {
  id: string; // e.g. 'delivery:driver-reconciliation'
  moduleId: AccessFeatureId | string;
  label: string;
  description: string;
  defaultLevel?: 'none' | 'read' | 'edit';
};

export const SUB_TOOLS: SubTool[] = [
  // Lost Sales & Shortages
  { id: 'lost_sales:entry', moduleId: 'lost_sales', label: 'Log Lost Sales', description: 'Enter missed customer requests at branch counter.' },
  { id: 'lost_sales:reports', moduleId: 'lost_sales', label: 'Lost Sales Reports', description: 'Review loss trends and branch summaries.' },
  { id: 'shortages:entry', moduleId: 'shortages', label: 'Log Shortages', description: 'Submit stock shortage items from branch inventory.' },
  { id: 'shortages:reports', moduleId: 'shortages', label: 'Shortage Analysis', description: 'Inspect stock gap aggregates and warehouse alerts.' },

  // Delivery & Tracking
  { id: 'delivery:recording', moduleId: 'delivery', label: 'Order Recording', description: 'Create and log customer delivery orders.' },
  { id: 'delivery:hub', moduleId: 'delivery', label: 'Live Operations Hub', description: 'Real-time dispatch, driver monitoring, and status progression.' },
  { id: 'delivery:analytics', moduleId: 'delivery', label: 'Coverage & Analytics', description: 'Bahrain block heatmaps, speed KPIs, and governorate coverage.' },
  { id: 'delivery:driver-reconciliation', moduleId: 'delivery', label: 'Driver Reconciliation', description: 'Verify cash collected, Benefit Pay matches, and driver variances.' },
  { id: 'delivery:settings', moduleId: 'delivery', label: 'Delivery Settings', description: 'Manage delivery zones, service rings, and driver rates.' },

  // Benefit Pay Ledger
  { id: 'benefit_pay_ledger:manual-entry', moduleId: 'benefit_pay_ledger', label: 'Manual BP Entry', description: 'Record direct counter Benefit Pay transfers with reference screenshots.' },
  { id: 'benefit_pay_ledger:analytics', moduleId: 'benefit_pay_ledger', label: 'Ledger Analytics', description: 'Cross-branch reconciliation reports and bank statement sync.' },
  { id: 'benefit_pay_ledger:audit', moduleId: 'benefit_pay_ledger', label: 'Reconciliation & Audit', description: 'Mark transfers verified and audit discrepancy logs.' },

  // Cash Flow & Cash Tracker
  { id: 'cash_flow:forecast', moduleId: 'cash_flow', label: 'Cash Flow Forecast', description: 'Predictive liquidity projections and bank account runway.' },
  { id: 'cash_flow:commitments', moduleId: 'cash_flow', label: 'Supplier Commitments', description: 'Post-dated cheques, supplier payables, and due date management.' },
  { id: 'cash_flow:audit', moduleId: 'cash_flow', label: 'Cash Flow Audit', description: 'Delayed cheque justification review and audit trails.' },
  { id: 'cash_tracker:entry', moduleId: 'cash_tracker', label: 'Daily Shift Cash Entry', description: 'Submit cash drawer counts, POS receipts, and shift handovers.' },
  { id: 'cash_tracker:reports', moduleId: 'cash_tracker', label: 'Cash Variance Reports', description: 'Inspect branch cash surpluses, shortages, and monthly totals.' },

  // Operational Expenses
  { id: 'operational_expenses:new-expense', moduleId: 'cash_flow', label: 'Record New Expense', description: 'Submit branch or warehouse expense vouchers with receipts.' },
  { id: 'operational_expenses:reports', moduleId: 'cash_flow', label: 'Expense Audit & Ledger', description: 'Review operational expense classifications and ledger totals.' },

  // HR & Workforce
  { id: 'hr_requests:submit', moduleId: 'hr_requests', label: 'Submit HR Request', description: 'Leaves, allowances, certificates, and payroll inquiries.' },
  { id: 'hr_requests:review', moduleId: 'hr_requests', label: 'HR Approvals & Review', description: 'Approve, reject, or comment on staff requests.' },
  { id: 'hr_requests:analytics', moduleId: 'hr_requests', label: 'HR Analytics', description: 'Staff turnover, leave patterns, and department KPIs.' },
  { id: 'workforce:planner', moduleId: 'workforce', label: 'Workforce Planner', description: 'Pharmacist and technician duty rosters and shift coverage.' },

  // Quality & Feedback
  { id: 'quality_feedback:submit', moduleId: 'quality_feedback', label: 'Submit QA Incident', description: 'Log branch incident reports, customer feedback, and dispensing notes.' },
  { id: 'quality_feedback:admin', moduleId: 'quality_feedback', label: 'QA Admin Review', description: 'Review, categorize, and investigate logged incidents.' },
  { id: 'quality_feedback:analytics', moduleId: 'quality_feedback', label: 'QA Insights & Scoring', description: 'Branch customer satisfaction scores and resolution times.' },

  // Spin & Win
  { id: 'spin_win:wheel', moduleId: 'spin_win', label: 'Wheel Game Access', description: 'Allow branch customer interaction on spin wheel screen.' },
  { id: 'spin_win:vouchers', moduleId: 'spin_win', label: 'Voucher Redemption', description: 'Scan and validate won voucher QR codes at POS.' },
  { id: 'spin_win:qr-setup', moduleId: 'spin_win', label: 'Stand QR & Campaign Setup', description: 'Generate branch display stands and adjust win prize probabilities.' },

  // Workflow & Todo
  { id: 'workflow_todo:create-task', moduleId: 'workflow_todo', label: 'Task Creator', description: 'Create and assign operational tasks to branch staff.' },
  { id: 'workflow_todo:approve', moduleId: 'workflow_todo', label: 'Task Approval', description: 'Mark recurring SOPs and compliance tasks verified.' },
  { id: 'workflow_todo:templates', moduleId: 'workflow_todo', label: 'Checklist Templates', description: 'Configure daily opening/closing checklists and maintenance routines.' },

  // Codex, Products & Analyzer
  { id: 'corporate_codex:view', moduleId: 'corporate_codex', label: 'Read Codex', description: 'Access policies, circulars, and standard operating procedures.' },
  { id: 'corporate_codex:publish', moduleId: 'corporate_codex', label: 'Publish Codex Articles', description: 'Author, edit, and publish corporate policies and SOPs.' },
  { id: 'products:view', moduleId: 'products', label: 'Search Catalogue', description: 'Look up barcode, active ingredients, and registered items.' },
  { id: 'products:manage', moduleId: 'products', label: 'Manage Products', description: 'Create, update, or archive product catalogue records.' },
  { id: 'block_analyzer:view', moduleId: 'block_analyzer', label: 'Block Insights', description: 'Interactive Bahrain block demographics and market map.' },
  { id: 'settings:manage', moduleId: 'settings', label: 'Admin Full Control', description: 'System-wide configuration, access control, and maintenance mode.' }
];

export const getSubToolsForModule = (moduleId: string): SubTool[] =>
  SUB_TOOLS.filter(tool => tool.moduleId === moduleId);

export type PermissionPresetId = 'branch_standard' | 'branch_restricted' | 'auditor' | 'full_operator' | 'reset_default';

export interface PermissionPreset {
  id: PermissionPresetId;
  label: string;
  description: string;
  tone: 'brand' | 'emerald' | 'amber' | 'blue' | 'slate';
  permissions: Array<{ featureName: string; accessLevel: 'none' | 'read' | 'edit' }>;
}

export const PERMISSION_PRESETS: PermissionPreset[] = [
  {
    id: 'branch_standard',
    label: 'Branch Standard',
    description: 'Standard daily operations: recording, sales logs, shift tracking, and codex viewing.',
    tone: 'brand',
    permissions: [
      { featureName: 'lost_sales', accessLevel: 'edit' },
      { featureName: 'shortages', accessLevel: 'edit' },
      { featureName: 'cash_tracker', accessLevel: 'edit' },
      { featureName: 'delivery', accessLevel: 'edit' },
      { featureName: 'benefit_pay_ledger', accessLevel: 'edit' },
      { featureName: 'hr_requests', accessLevel: 'read' },
      { featureName: 'quality_feedback', accessLevel: 'read' },
      { featureName: 'spin_win', accessLevel: 'read' },
      { featureName: 'corporate_codex', accessLevel: 'read' },
      { featureName: 'workflow_todo', accessLevel: 'edit' },
      { featureName: 'cash_flow', accessLevel: 'none' },
      { featureName: 'workforce', accessLevel: 'none' },
      { featureName: 'feedback_admin', accessLevel: 'none' },
      { featureName: 'settings', accessLevel: 'none' }
    ]
  },
  {
    id: 'branch_restricted',
    label: 'Branch Restricted',
    description: 'Restricted access: entry only for daily sales & shifts; analytical modules hidden.',
    tone: 'amber',
    permissions: [
      { featureName: 'lost_sales', accessLevel: 'edit' },
      { featureName: 'shortages', accessLevel: 'edit' },
      { featureName: 'cash_tracker', accessLevel: 'edit' },
      { featureName: 'delivery', accessLevel: 'read' },
      { featureName: 'benefit_pay_ledger', accessLevel: 'read' },
      { featureName: 'hr_requests', accessLevel: 'read' },
      { featureName: 'quality_feedback', accessLevel: 'none' },
      { featureName: 'spin_win', accessLevel: 'none' },
      { featureName: 'corporate_codex', accessLevel: 'read' },
      { featureName: 'workflow_todo', accessLevel: 'read' },
      { featureName: 'cash_flow', accessLevel: 'none' },
      { featureName: 'workforce', accessLevel: 'none' },
      { featureName: 'feedback_admin', accessLevel: 'none' },
      { featureName: 'settings', accessLevel: 'none' }
    ]
  },
  {
    id: 'auditor',
    label: 'Auditor (Read-Only)',
    description: 'Executive view: read-only access across all operational modules and financial reports.',
    tone: 'blue',
    permissions: [
      { featureName: 'lost_sales', accessLevel: 'read' },
      { featureName: 'shortages', accessLevel: 'read' },
      { featureName: 'cash_tracker', accessLevel: 'read' },
      { featureName: 'delivery', accessLevel: 'read' },
      { featureName: 'benefit_pay_ledger', accessLevel: 'read' },
      { featureName: 'hr_requests', accessLevel: 'read' },
      { featureName: 'quality_feedback', accessLevel: 'read' },
      { featureName: 'feedback_admin', accessLevel: 'read' },
      { featureName: 'spin_win', accessLevel: 'read' },
      { featureName: 'corporate_codex', accessLevel: 'read' },
      { featureName: 'workflow_todo', accessLevel: 'read' },
      { featureName: 'cash_flow', accessLevel: 'read' },
      { featureName: 'workforce', accessLevel: 'read' },
      { featureName: 'products', accessLevel: 'read' },
      { featureName: 'block_analyzer', accessLevel: 'read' },
      { featureName: 'settings', accessLevel: 'none' }
    ]
  },
  {
    id: 'full_operator',
    label: 'Full Operator',
    description: 'Full operational control across all tools and features (non-admin).',
    tone: 'emerald',
    permissions: [
      { featureName: 'lost_sales', accessLevel: 'edit' },
      { featureName: 'shortages', accessLevel: 'edit' },
      { featureName: 'cash_tracker', accessLevel: 'edit' },
      { featureName: 'delivery', accessLevel: 'edit' },
      { featureName: 'benefit_pay_ledger', accessLevel: 'edit' },
      { featureName: 'hr_requests', accessLevel: 'edit' },
      { featureName: 'quality_feedback', accessLevel: 'edit' },
      { featureName: 'feedback_admin', accessLevel: 'edit' },
      { featureName: 'spin_win', accessLevel: 'edit' },
      { featureName: 'corporate_codex', accessLevel: 'edit' },
      { featureName: 'workflow_todo', accessLevel: 'edit' },
      { featureName: 'cash_flow', accessLevel: 'edit' },
      { featureName: 'workforce', accessLevel: 'edit' },
      { featureName: 'products', accessLevel: 'edit' },
      { featureName: 'block_analyzer', accessLevel: 'edit' },
      { featureName: 'settings', accessLevel: 'none' }
    ]
  },
  {
    id: 'reset_default',
    label: 'Reset to Role Defaults',
    description: 'Clears all user-specific overrides so access perfectly inherits the role matrix.',
    tone: 'slate',
    permissions: []
  }
];

export const getEnabledAccessFeatures = (): AccessFeature[] => {
  const knownFeatures = ACCESS_FEATURES.filter(feature => !feature.module || isModuleEnabled(feature.module));
  const representedModules = new Set(ACCESS_FEATURES.map(feature => feature.module).filter(Boolean));
  const automaticFeatures = (Object.keys(clientConfig.enabledModules) as ClientModuleKey[])
    .filter(moduleKey =>
      clientConfig.enabledModules[moduleKey] !== false
      && !representedModules.has(moduleKey)
      && !NON_ACCESS_MODULE_KEYS.includes(moduleKey)
    )
    .map(moduleKey => ({
      id: moduleKey,
      label: formatModuleLabel(moduleKey),
      module: moduleKey,
      description: 'Auto-registered module access. Defaults to no access until an admin approves it.'
    }));

  return [...knownFeatures, ...automaticFeatures].filter((feature, index, features) =>
    features.findIndex(item => item.id === feature.id) === index
  );
};

