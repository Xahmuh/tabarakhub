import { ModuleDisplayItemSetting, ModuleDisplaySettings } from '../types';

export const MODULE_BADGE_MAX_LENGTH = 48;
export const DEFAULT_MODULE_GRID_COLUMNS: ModuleDisplaySettings['gridColumns'] = 4;

export const DEFAULT_MODULE_DISPLAY_ITEMS: ModuleDisplayItemSetting[] = [
  { key: 'pos', order: 10, badge: 'Entry', badgeStyle: 'hidden' },
  { key: 'owner-dashboard', order: 15, badge: 'Owner', badgeStyle: 'hidden' },
  { key: 'dashboard-manager', order: 20, badge: 'Analytics', badgeStyle: 'hidden' },
  { key: 'dashboard-admin', order: 30, badge: 'Analytics', badgeStyle: 'hidden' },
  { key: 'hr-manager', order: 40, badge: 'Admin', badgeStyle: 'hidden' },
  { key: 'hr-directory', order: 45, badge: 'Directory', badgeStyle: 'red' },
  { key: 'driver-payroll', order: 48, badge: 'Payroll', badgeStyle: 'red' },
  { key: 'dashboard-branch', order: 50, badge: 'Analytics', badgeStyle: 'hidden' },
  { key: 'workforce', order: 60, badge: 'Planning', badgeStyle: 'hidden' },
  { key: 'hr', order: 70, badge: 'Self-service', badgeStyle: 'hidden' },
  { key: 'cash-flow', order: 80, badge: 'Finance', badgeStyle: 'hidden' },
  { key: 'cash-tracker', order: 90, badge: 'Finance', badgeStyle: 'hidden' },
  { key: 'corporate-codex', order: 100, badge: 'Knowledge', badgeStyle: 'hidden' },
  { key: 'settings', order: 110, badge: 'Admin', badgeStyle: 'hidden' },
  { key: 'spin-win', order: 130, badge: 'Rewards', badgeStyle: 'hidden' },
  { key: 'feedback-form', order: 140, badge: 'Feedback', badgeStyle: 'hidden' },
  { key: 'feedback-admin', order: 150, badge: 'Analytics', badgeStyle: 'hidden' },
  { key: 'employee-contributions', order: 160, badge: 'Ideas', badgeStyle: 'hidden' },
  { key: 'workflow-todo', order: 165, badge: 'new module', badgeStyle: 'red' },
  { key: 'delivery', order: 170, badge: 'new module', badgeStyle: 'red' },
  { key: 'benefit-pay-ledger', order: 172, badge: 'Finance', badgeStyle: 'hidden' },
  { key: 'products', order: 178, badge: 'Catalogue', badgeStyle: 'hidden' },
  { key: 'block-analyzer', order: 180, badge: 'Analytics', badgeStyle: 'hidden' },
  { key: 'operational-expenses', order: 185, badge: 'Finance', badgeStyle: 'hidden' },
  { key: 'operational-renewals', order: 188, badge: 'Compliance', badgeStyle: 'red' },
  { key: 'duty-scheduler', order: 190, badge: 'Beta', badgeStyle: 'hidden' },
  { key: 'leave-management', order: 195, badge: 'Compliance', badgeStyle: 'red' }
];

export const MODULE_DISPLAY_LABELS: Record<string, string> = {
  pos: 'Lost Sales & Shortage Log',
  'owner-dashboard': 'Owner Dashboard',
  'dashboard-manager': 'Performance Dashboard - Manager',
  'dashboard-admin': 'Performance Dashboard - Admin/Warehouse',
  'hr-manager': 'HR Requests Admin',
  'hr-directory': 'HR Workforce Directory',
  'driver-payroll': 'Driver Payroll & Incentives',
  'dashboard-branch': 'Performance Dashboard - Branch',
  workforce: 'Workforce Analytics',
  hr: 'HR Self-Service',
  'cash-flow': 'Cash Flow Planner',
  'cash-tracker': 'Branch Cash Tracker',
  'corporate-codex': 'Corporate Codex',
  settings: 'Control Center',
  'system-settings': 'Control Center',
  'access-control': 'Control Center',
  'spin-win': 'Spin & Win',
  'feedback-form': 'QA Insights',
  'feedback-admin': 'Feedback Admin',
  'employee-contributions': 'Team Contributions',
  'workflow-todo': 'Workflow & Todo',
  delivery: 'Delivery Recording & Traceability',
  'benefit-pay-ledger': 'Benefit Pay Ledger',
  products: 'Product Catalogue',
  'block-analyzer': 'BH Block Analyzer',
  'operational-expenses': 'Operational Cash Expenses',
  'operational-renewals': 'Operational Alert & Renewals',
  'duty-scheduler': 'Automated Duty Scheduler',
  'leave-management': 'Leave Management & Compliance'
};

const normalizeBadgeStyle = (value: unknown): ModuleDisplayItemSetting['badgeStyle'] =>
  value === 'red' ? 'red' : 'hidden';

const normalizeGridColumns = (value: unknown): ModuleDisplaySettings['gridColumns'] =>
  Number(value) === 3 ? 3 : DEFAULT_MODULE_GRID_COLUMNS;

export const normalizeModuleDisplaySettings = (value: unknown): ModuleDisplaySettings => {
  const gridColumns = normalizeGridColumns((value as ModuleDisplaySettings | null)?.gridColumns);
  const inputItems = Array.isArray((value as ModuleDisplaySettings | null)?.items)
    ? (value as ModuleDisplaySettings).items
    : [];
  const inputByKey = new Map(inputItems.map(item => [String(item?.key || ''), item]));

  const items = DEFAULT_MODULE_DISPLAY_ITEMS.map(defaultItem => {
    const input = inputByKey.get(defaultItem.key);
    const parsedOrder = Number(input?.order);

    return {
      key: defaultItem.key,
      order: Number.isFinite(parsedOrder) ? parsedOrder : defaultItem.order,
      badge: typeof input?.badge === 'string' ? input.badge.trim().slice(0, MODULE_BADGE_MAX_LENGTH) : defaultItem.badge,
      badgeStyle: normalizeBadgeStyle(input?.badgeStyle ?? defaultItem.badgeStyle)
    };
  }).sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));

  return {
    gridColumns,
    items: items.map((item, index) => ({
      ...item,
      order: (index + 1) * 10
    }))
  };
};
