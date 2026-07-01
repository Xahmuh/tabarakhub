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
