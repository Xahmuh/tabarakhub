import { ClientModuleKey, clientConfig, isModuleEnabled } from '../config/clientConfig';

export type AccessFeatureId =
  | 'command_center'
  | 'lost_sales'
  | 'shortages'
  | 'spin_win'
  | 'hr_requests'
  | 'hr_directory'
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
  | 'block_analyzer'
  | 'duty_scheduler'
  | 'driver_payroll'
  | 'products'
  | 'operational_expenses'
  | 'operational_renewals'
  | 'leave_management'
  | 'owner_dashboard'
  | 'settings';

export type AccessFeature = {
  id: AccessFeatureId | string;
  label: string;
  module?: ClientModuleKey;
  description?: string;
  subFeatures?: Array<{ id: string; label: string; description?: string }>;
};

export const ACCESS_FEATURES: AccessFeature[] = [
  { id: 'command_center', label: 'Daily Command Center', description: 'Daily action center and operational follow-up.' },
  { id: 'lost_sales', label: 'Lost Sales Tracker', module: 'sales', description: 'Log and review missed sales requests.' },
  { id: 'shortages', label: 'Shortages Tracker', module: 'sales', description: 'Log and review branch stock gaps.' },
  { id: 'spin_win', label: 'Spin & Win Dashboard', module: 'spinWin', description: 'Customer reward wheel controls and branch QR access.' },
  { id: 'hr_requests', label: 'HR Portal', module: 'hr', description: 'HR self-service and request management.' },
  { id: 'hr_directory', label: 'HR Directory', module: 'hr', description: 'Staff directory and organization charts.' },
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
  { 
    id: 'duty_scheduler', 
    label: 'Automated Duty Scheduler', 
    module: 'dutyScheduler', 
    description: 'Generate, manage, and track automated pharmacist duty schedules.',
    subFeatures: [
      { id: 'duty_scheduler:view', label: 'View Duty Scheduler', description: 'Read-only access to schedules and dashboards' },
      { id: 'duty_scheduler:generate', label: 'Generate Schedule', description: 'Trigger a new schedule generation run' },
      { id: 'duty_scheduler:edit_draft', label: 'Edit Draft Schedule', description: 'Make manual changes to a DRAFT / UNDER REVIEW schedule' },
      { id: 'duty_scheduler:manual_override', label: 'Manual Override', description: 'Force a hard-constraint-violating change with reason' },
      { id: 'duty_scheduler:lock', label: 'Lock Schedule', description: 'Lock and unlock shift assignments' },
      { id: 'duty_scheduler:publish', label: 'Publish Schedule', description: 'Move a schedule to PUBLISHED status' },
      { id: 'duty_scheduler:manage_profiles', label: 'Manage Scheduling Profiles', description: 'Create and edit pharmacist scheduling profiles' },
      { id: 'duty_scheduler:manage_rules', label: 'Manage Scheduling Rules', description: 'Edit Control Center scheduling settings' },
      { id: 'duty_scheduler:export', label: 'Export Schedule', description: 'Produce the operational Excel export' },
      { id: 'duty_scheduler:view_audit', label: 'View Audit History', description: 'Read the audit change log for this module' },
      { id: 'duty_scheduler:manage_leave', label: 'Manage Interim Leave Records', description: 'Enter and edit rows in the interim leave records table' },
      { id: 'duty_scheduler:submit_leave', label: 'Submit Annual Leave Request', description: 'Submit annual leave requests' },
      { id: 'duty_scheduler:decide_leave', label: 'Approve/Reject Annual Leave Request', description: 'Approve or reject annual leave requests with available balance validation' },
      { id: 'duty_scheduler:view_ledger', label: 'View Annual Leave Ledger', description: 'View monthly annual leave accrual balances, consumption, and ledgers' },
      { id: 'duty_scheduler:view_rest_compliance', label: 'View Weekly Rest Compliance', description: 'View weekly rest compliance reconciliation report' }
    ]
  },
  {
    id: 'leave_management',
    label: 'Leave Management & Compliance',
    module: 'leaveManagement',
    description: 'Annual leave requests, dynamic accrual ledgers, manual balance adjustments, and Bahrain Labor Law weekly rest compliance.',
    subFeatures: [
      { id: 'leave_management:view', label: 'View Leave & Compliance', description: 'Read-only access to leave requests, ledgers, and rest compliance' },
      { id: 'leave_management:submit_leave', label: 'Submit Annual Leave Request', description: 'Submit annual leave requests for self or staff' },
      { id: 'leave_management:decide_leave', label: 'Approve/Reject Annual Leave Request', description: 'Approve or reject annual leave requests with available balance validation' },
      { id: 'leave_management:manage_ledger', label: 'Manage Annual Leave Ledgers', description: 'Perform manual balance adjustments on employee ledgers' },
      { id: 'leave_management:view_rest_compliance', label: 'View Weekly Rest Compliance', description: 'View weekly rest compliance reconciliation report' }
    ]
  },
  {
    id: 'operational_expenses',
    label: 'Operational Cash Expenses',
    module: 'operationalExpenses',
    description: 'Track and record branch operational cash expenses (Fuel, Maintenance, Supplies, Other).',
    subFeatures: [
      { id: 'operational_expenses:new-expense', label: 'Record New Expense', description: 'Record a new cash expense transaction' },
      { id: 'operational_expenses:expenses', label: 'Expenses List', description: 'View and filter recorded operational expenses' },
      { id: 'operational_expenses:dashboard', label: 'Expense Dashboard', description: 'KPI cards and monthly expense calendar' },
      { id: 'operational_expenses:reports', label: 'Expense Reports', description: 'Detailed category and vehicle expense reports' },
      { id: 'operational_expenses:vehicle-actions', label: 'Actions & Renewals', description: 'Fleet vehicle registration and service alerts' },
      { id: 'operational_expenses:fuel-leaderboard', label: 'Fuel Leaderboard', description: 'Driver and vehicle fuel efficiency leaderboard' }
    ]
  },
  {
    id: 'operational_renewals',
    label: 'Operational Alert & Renewals',
    module: 'operationalRenewals',
    description: 'Track Commercial Registrations, NHRA pharmacy licenses, and employee work permit renewals.',
    subFeatures: [
      { id: 'operational_renewals:view', label: 'View Renewals & Alerts', description: 'Read-only access to renewal alerts and tariffs' },
      { id: 'operational_renewals:manage', label: 'Manage Renewals', description: 'Add, renew, and update compliance items' },
      { id: 'operational_renewals:archive', label: 'Renewals Archive', description: 'Browse expired and historical renewal records' }
    ]
  },
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
