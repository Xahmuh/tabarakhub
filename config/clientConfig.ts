export type ClientModuleKey =
  | 'hr'
  | 'qualityFeedback'
  | 'reports'
  | 'excelExport'
  | 'branchDashboard'
  | 'managerDashboard'
  | 'adminDashboard'
  | 'products'
  | 'sales'
  | 'spinWin'
  | 'cashFlow'
  | 'cashTracker'
  | 'corporateCodex'
  | 'employeeContributions'
  | 'settings'
  | 'workforce'
  | 'delivery'
  | 'benefitPayLedger'
  | 'deliveryCoverageAdvanced'
  | 'aiInsights';

export type ClientConfig = {
  appName: string;
  clientName: string;
  logoUrl: string;
  primaryColor: string;
  primaryHoverColor: string;
  primaryDarkColor: string;
  primaryMutedColor: string;
  accentColor: string;
  supportEmail: string;
  enabledModules: Record<ClientModuleKey, boolean>;
  defaultLocale: string;
  currency: string;
  country: string;
  isDemoMode: boolean;
  environmentLabel?: string;
};

const env = import.meta.env;

const readBoolean = (key: string, fallback = true): boolean => {
  const value = env[key];
  if (value === undefined || value === '') return fallback;
  return !['0', 'false', 'no', 'off', 'disabled'].includes(value.toLowerCase());
};

export const clientConfig: ClientConfig = {
  appName: env.VITE_APP_NAME || 'Tabarak Pharmacy',
  clientName: env.VITE_CLIENT_NAME || 'hub',
  logoUrl: env.VITE_CLIENT_LOGO_URL || '/logo.jpg',
  primaryColor: env.VITE_PRIMARY_COLOR || '#B91c1c',
  primaryHoverColor: env.VITE_PRIMARY_HOVER_COLOR || '#991b1b',
  primaryDarkColor: env.VITE_PRIMARY_DARK_COLOR || '#7f1d1d',
  primaryMutedColor: env.VITE_PRIMARY_MUTED_COLOR || 'rgba(185, 28, 28, 0.05)',
  accentColor: env.VITE_ACCENT_COLOR || '#0f172a',
  supportEmail: env.VITE_SUPPORT_EMAIL || 'tabarakph.info@gmail.com',
  defaultLocale: env.VITE_DEFAULT_LOCALE || 'en',
  currency: env.VITE_CURRENCY || 'BHD',
  country: env.VITE_COUNTRY || 'Bahrain',
  isDemoMode: readBoolean('VITE_DEMO_MODE', false),
  environmentLabel: env.VITE_ENVIRONMENT_LABEL || undefined,
  enabledModules: {
    hr: readBoolean('VITE_MODULE_HR'),
    qualityFeedback: readBoolean('VITE_MODULE_QUALITY_FEEDBACK'),
    reports: readBoolean('VITE_MODULE_REPORTS'),
    excelExport: readBoolean('VITE_MODULE_EXCEL_EXPORT'),
    branchDashboard: readBoolean('VITE_MODULE_BRANCH_DASHBOARD'),
    managerDashboard: readBoolean('VITE_MODULE_MANAGER_DASHBOARD'),
    adminDashboard: readBoolean('VITE_MODULE_ADMIN_DASHBOARD'),
    products: readBoolean('VITE_MODULE_PRODUCTS'),
    sales: readBoolean('VITE_MODULE_SALES'),
    spinWin: readBoolean('VITE_MODULE_SPIN_WIN'),
    cashFlow: readBoolean('VITE_MODULE_CASH_FLOW'),
    cashTracker: readBoolean('VITE_MODULE_CASH_TRACKER'),
    corporateCodex: readBoolean('VITE_MODULE_CORPORATE_CODEX'),
    employeeContributions: readBoolean('VITE_MODULE_EMPLOYEE_CONTRIBUTIONS'),
    settings: readBoolean('VITE_MODULE_SETTINGS'),
    workforce: readBoolean('VITE_MODULE_WORKFORCE'),
    delivery: readBoolean('VITE_MODULE_DELIVERY'),
    benefitPayLedger: readBoolean('VITE_MODULE_BENEFIT_PAY_LEDGER'),
    deliveryCoverageAdvanced: readBoolean('VITE_DELIVERY_COVERAGE_ADVANCED_ANALYTICS'),
    aiInsights: readBoolean('VITE_MODULE_AI_INSIGHTS', false),
  },
};

export const isModuleEnabled = (module: ClientModuleKey): boolean => clientConfig.enabledModules[module] !== false;
export const isDemoMode = clientConfig.isDemoMode;
