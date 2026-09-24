import React, { useCallback, useEffect, useState, useTransition } from 'react';

// --- Core Imports ---
import {
  AuthState,
  Branch,
  BranchLoginApproval,
  BenefitPayTransfer,
  DeliveryNotification,
  MaintenanceSettings
} from './types';
import { supabase } from './lib/supabase';
import { buildPermissionChecker, isManagerRole } from './lib/access';
import { clientConfig, isModuleEnabled } from './config/clientConfig';
import { spinWinService } from './services/spinWin';
import { branchLoginApprovalService } from './services/branchLoginApprovalService';

// --- Shared Shell & Frame Views ---
import { LoginPage } from './app/login';
import { BranchLoginApprovalWaitingPage } from './app/login/BranchLoginApprovalWaitingPage';
import { SelectPharmacistPage } from './app/select-pharmacist';
import { SuitePage } from './app/suite';
import { CustomerFlow } from './app/spin-win';
import { AppHeader, Footer, POSGuidelineModal, ModuleHelpButton } from './app/shared';
import { BlockCoverageAnalyzer } from './app/block-analyzer';
import { MaintenancePage } from './app/maintenance';

// --- Router & Hooks ---
import {
  AppRouter,
  AppTab,
  DeliveryFocusTarget,
  BenefitPayFocusTarget
} from './AppRouter';
import { useDeliveryAlerts } from './hooks/useDeliveryAlerts';
import { useSystemMaintenance } from './hooks/useSystemMaintenance';

// --- Icons ---
import {
  ShieldCheck,
  Loader2,
  AlertTriangle
} from 'lucide-react';

const APP_TABS: AppTab[] = [
  'owner-dashboard',
  'pos',
  'dashboard',
  'selector',
  'spin-win',
  'hr',
  'hr-manager',
  'hr-directory',
  'hr-letter',
  'workforce',
  'cash-flow',
  'cash-tracker',
  'corporate-codex',
  'settings',
  'system-settings',
  'access-control',
  'feedback-form',
  'feedback-admin',
  'employee-contributions',
  'workflow-todo',
  'block-analyzer',
  'delivery',
  'benefit-pay-ledger',
  'operational-expenses',
  'operational-renewals',
  'duty-scheduler',
  'leave-management',
  'notifications',
  'payroll',
  'attendance',
  'tqph'
];

const ACTIVE_TAB_STORAGE_KEY = 'tabarak_active_tab';
const SPIN_RETURN_KEY = 'tabarak_spinwin_return';
const SPIN_DRAFT_KEY = 'tabarak_spinwin_customer_draft';
const SPIN_RETURN_TTL_MS = 45 * 60 * 1000;
const BRANCH_LOGIN_APPROVAL_REQUEST_KEY = 'tabarak_branch_login_approval_request';

const isAppTab = (value: string | null): value is AppTab =>
  !!value && APP_TABS.includes(value as AppTab);

const getStoredActiveTab = (): AppTab | null => {
  try {
    const savedTab = sessionStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    return isAppTab(savedTab) ? savedTab : null;
  } catch {
    return null;
  }
};

const storeActiveTab = (tab: AppTab | null) => {
  try {
    if (tab) sessionStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab);
    else sessionStorage.removeItem(ACTIVE_TAB_STORAGE_KEY);
  } catch {
    // Storage is only used to restore the current module after refresh.
  }
};

const clearStoredActiveTab = () => storeActiveTab(null);

const getRecoverableSpinToken = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(SPIN_RETURN_KEY) || 'null') as { token?: string } | null;
        if (saved?.token && saved.token !== token) {
          sessionStorage.removeItem(SPIN_RETURN_KEY);
          sessionStorage.removeItem(SPIN_DRAFT_KEY);
        }
      } catch {
        sessionStorage.removeItem(SPIN_RETURN_KEY);
        sessionStorage.removeItem(SPIN_DRAFT_KEY);
      }
      return token;
    }

    if (params.has('node') || params.has('branch')) {
      sessionStorage.removeItem(SPIN_RETURN_KEY);
      sessionStorage.removeItem(SPIN_DRAFT_KEY);
      return null;
    }

    const saved = JSON.parse(sessionStorage.getItem(SPIN_RETURN_KEY) || 'null') as { token?: string; url?: string; savedAt?: number } | null;
    if (!saved?.token || !saved.savedAt || Date.now() - saved.savedAt > SPIN_RETURN_TTL_MS) {
      sessionStorage.removeItem(SPIN_RETURN_KEY);
      sessionStorage.removeItem(SPIN_DRAFT_KEY);
      return null;
    }

    if (saved.url && window.location.href !== saved.url) {
      window.history.replaceState({ spinToken: saved.token }, '', saved.url);
    }
    return saved.token;
  } catch {
    sessionStorage.removeItem(SPIN_RETURN_KEY);
    sessionStorage.removeItem(SPIN_DRAFT_KEY);
    return null;
  }
};

const canControlMaintenance = (role?: string | null) =>
  isManagerRole(role);

const storeBranchLoginApprovalRequest = (requestId: string | null) => {
  try {
    if (requestId) sessionStorage.setItem(BRANCH_LOGIN_APPROVAL_REQUEST_KEY, requestId);
    else sessionStorage.removeItem(BRANCH_LOGIN_APPROVAL_REQUEST_KEY);
  } catch {
    // Session storage is a pointer only; Supabase remains the approval source.
  }
};

const SystemSettingsWarning: React.FC<{ message: string | null; showDetails?: boolean }> = ({ message, showDetails }) => {
  if (!message) return null;

  return (
    <div className="fixed left-1/2 top-3 z-[120] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left shadow-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-black text-amber-900">System settings could not be loaded.</p>
          <p className="mt-1 text-xs font-bold leading-5 text-amber-800">
            Maintenance status, footer branding, login badges, and POS instruction copy are using in-app fallbacks until a manager verifies migrations, RLS, and connectivity.
          </p>
          {showDetails && <p className="mt-2 break-words text-[11px] font-semibold leading-5 text-amber-700">{message}</p>}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>({ user: null, pharmacist: null });
  const [activeTab, setActiveTab] = useState<AppTab | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // System maintenance settings and branding hook
  const {
    maintenanceSettings,
    setMaintenanceSettings,
    maintenanceSettingsError,
    isMaintenanceLoading
  } = useSystemMaintenance();

  const [isMaintenanceAdminLoginOpen, setIsMaintenanceAdminLoginOpen] = useState(false);
  const [pendingBranchApproval, setPendingBranchApproval] = useState<BranchLoginApproval | null>(null);
  const [pendingBranchAuthState, setPendingBranchAuthState] = useState<AuthState | null>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPOSGuideline, setShowPOSGuideline] = useState(false);
  const [showPharmacistSelector, setShowPharmacistSelector] = useState(false);
  const [customerFlowError, setCustomerFlowError] = useState<string | null>(null);
  const [activePOSBranch, setActivePOSBranch] = useState<Branch | null>(null);
  const [deliveryFocusTarget, setDeliveryFocusTarget] = useState<DeliveryFocusTarget | null>(null);
  const [benefitPayFocusTarget, setBenefitPayFocusTarget] = useState<BenefitPayFocusTarget | null>(null);
  const [hrLetterInitialData, setHrLetterInitialData] = useState<any>(null);
  const [isCustomerFlow] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('token') || params.has('node') || params.has('branch');
  });

  const isDashboardEnabledForRole = (role?: string) => {
    if (!isModuleEnabled('reports')) return false;
    if (role === 'warehouse') return isModuleEnabled('adminDashboard');
    if (isManagerRole(role) || role === 'owner' || role === 'supervisor') return isModuleEnabled('managerDashboard');
    return isModuleEnabled('branchDashboard');
  };

  const canUseFeature = (
    feature: string,
    minimum: 'read' | 'edit' = 'read',
    role = authState.user?.role,
    permissionState: Pick<AuthState, 'permissions' | 'rolePermissions'> = authState
  ) =>
    buildPermissionChecker(role, permissionState.permissions, permissionState.rolePermissions)(feature, minimum);

  const canReceiveDeliveryNotifications = !!authState.user && isModuleEnabled('delivery') && canUseFeature('delivery', 'read');
  const shouldShowPOSGuideline = () => maintenanceSettings?.posGuidelineEnabled !== false;
  const isBranchLoginApprovalRequired = maintenanceSettings?.branchLoginApprovalRequired !== false;

  // Real-time delivery notification & alert audio hook
  const {
    deliveryNotificationUnreadCount,
    setDeliveryNotificationUnreadCount,
    hasDeliveryNotificationAlert,
  } = useDeliveryAlerts({
    userId: authState.user?.id,
    canReceiveDeliveryNotifications,
    activeTab
  });

  const isTabEnabled = (
    tab: AppTab | null,
    role = authState.user?.role,
    permissionState: Pick<AuthState, 'permissions' | 'rolePermissions'> = authState
  ) => {
    if (!tab || tab === 'selector') return true;
    switch (tab) {
      case 'owner-dashboard':
        return canUseFeature('owner_dashboard', 'read', role, permissionState);
      case 'pos':
        return isModuleEnabled('sales') && (canUseFeature('lost_sales', 'edit', role, permissionState) || canUseFeature('shortages', 'edit', role, permissionState));
      case 'dashboard':
        return isDashboardEnabledForRole(role) && (canUseFeature('lost_sales', 'read', role, permissionState) || canUseFeature('shortages', 'read', role, permissionState));
      case 'spin-win':
        return isModuleEnabled('spinWin') && canUseFeature('spin_win', 'read', role, permissionState);
      case 'hr':
        return isModuleEnabled('hr') && (role === 'branch' || canUseFeature('hr_requests', 'read', role, permissionState));
      case 'hr-manager':
        return isModuleEnabled('hr') && canUseFeature('hr_requests', 'read', role, permissionState);
      case 'hr-directory':
      case 'hr-letter':
        return isModuleEnabled('hr') && (isManagerRole(role) || canUseFeature('hr_requests', 'read', role, permissionState));
      case 'workforce':
        return isModuleEnabled('hr') && isModuleEnabled('workforce') && canUseFeature('workforce', 'read', role, permissionState);
      case 'cash-flow':
        return isModuleEnabled('cashFlow') && canUseFeature('cash_flow', 'read', role, permissionState);
      case 'cash-tracker':
        return isModuleEnabled('cashTracker') && canUseFeature('cash_tracker', 'read', role, permissionState);
      case 'corporate-codex':
        return isModuleEnabled('corporateCodex') && canUseFeature('corporate_codex', 'read', role, permissionState);
      case 'settings':
      case 'system-settings':
      case 'access-control':
        return isModuleEnabled('settings') && (
          (isManagerRole(role) && canUseFeature('settings', 'edit', role, permissionState))
          || role === 'admin'
        );
      case 'feedback-form':
        return isModuleEnabled('qualityFeedback') && canUseFeature('quality_feedback', 'read', role, permissionState);
      case 'feedback-admin':
        return isModuleEnabled('qualityFeedback') && canUseFeature('feedback_admin', 'edit', role, permissionState);
      case 'employee-contributions':
        return isModuleEnabled('employeeContributions') && canUseFeature('employee_contributions', 'read', role, permissionState);
      case 'workflow-todo':
        return isModuleEnabled('workflowTodo') && canUseFeature('workflow_todo', 'read', role, permissionState);
      case 'block-analyzer':
        return isManagerRole(role) && canUseFeature('block_analyzer', 'read', role, permissionState);
      case 'delivery':
        return isModuleEnabled('delivery') && canUseFeature('delivery', 'read', role, permissionState);
      case 'benefit-pay-ledger':
        return isModuleEnabled('benefitPayLedger') && canUseFeature('benefit_pay_ledger', 'read', role, permissionState);
      case 'operational-expenses':
        return isModuleEnabled('operationalExpenses') && (role === 'branch' || canUseFeature('operational_expenses', 'read', role, permissionState));
      case 'operational-renewals':
        return isModuleEnabled('operationalRenewals') && (isManagerRole(role) || canUseFeature('operational_renewals', 'read', role, permissionState) || canUseFeature('settings', 'read', role, permissionState));
      case 'duty-scheduler':
        return isModuleEnabled('dutyScheduler') && (isManagerRole(role) || canUseFeature('duty_scheduler', 'read', role, permissionState));
      case 'leave-management':
        return isModuleEnabled('leaveManagement') && (isManagerRole(role) || canUseFeature('leave_management', 'read', role, permissionState) || canUseFeature('duty_scheduler', 'read', role, permissionState) || canUseFeature('hr_requests', 'read', role, permissionState));
      case 'notifications':
        return isModuleEnabled('delivery') && canUseFeature('delivery', 'read', role, permissionState);
      case 'payroll':
        return role !== 'branch' && isModuleEnabled('hr') && (isManagerRole(role) || canUseFeature('hr_requests', 'read', role, permissionState) || canUseFeature('workforce', 'read', role, permissionState) || canUseFeature('delivery', 'read', role, permissionState));
      case 'tqph':
        return role !== 'branch' && (isManagerRole(role) || role === 'owner' || role === 'supervisor');
      default:
        return true;
    }
  };

  const getRestorableActiveTab = (state: AuthState): AppTab => {
    const savedTab = getStoredActiveTab();
    return savedTab && isTabEnabled(savedTab, state.user?.role, state) ? savedTab : 'selector';
  };

  const handleTabChange = (tab: AppTab | null) => {
    if (!isTabEnabled(tab)) {
      setActiveTab('selector');
      storeActiveTab('selector');
      return;
    }
    if (tab !== 'pos') {
      setActivePOSBranch(null);
    }
    if (tab === 'pos' && !authState.pharmacist) {
      setShowPharmacistSelector(true);
      return;
    }
    if (tab === 'pos') {
      if (shouldShowPOSGuideline()) setShowPOSGuideline(true);
    }
    if (tab) {
      storeActiveTab(tab);
    } else {
      clearStoredActiveTab();
    }
    startTransition(() => {
      setActiveTab(tab);
    });
  };

  const clearPendingBranchApproval = () => {
    storeBranchLoginApprovalRequest(null);
    setPendingBranchApproval(null);
    setPendingBranchAuthState(null);
  };

  const signOutToLoginWithNotice = useCallback(async (message: string) => {
    clearPendingBranchApproval();
    await supabase.auth.signOut();
    setAuthState({ user: null, pharmacist: null, permissions: [] });
    setActiveTab(null);
    setLoginNotice(message);
    setIsMaintenanceAdminLoginOpen(false);
  }, []);

  const enterAuthenticatedApp = useCallback(async (baseState: AuthState) => {
    const user = baseState.user;
    if (!user) {
      throw new Error('Authenticated account is not linked to an active app profile.');
    }

    const [branchPermissions, userPermissions, rolePermissions] = await Promise.all([
      user.role === 'branch' ? supabase.permissions.listForBranch(user.id) : Promise.resolve([]),
      supabase.permissions.listForUser(user.userId || user.id),
      supabase.permissions.listRoleDefaults(user.role)
    ]);

    const newState = { user, pharmacist: null, permissions: [...userPermissions, ...branchPermissions], rolePermissions };
    if (user.role !== 'branch') {
      storeBranchLoginApprovalRequest(null);
    }
    setPendingBranchApproval(null);
    setPendingBranchAuthState(null);
    setLoginNotice(null);
    setAuthState(newState);
    setIsMaintenanceAdminLoginOpen(false);

    if (maintenanceSettings?.isMaintenanceModeEnabled && canControlMaintenance(user.role) && isModuleEnabled('settings')) {
      storeActiveTab('settings');
      startTransition(() => setActiveTab('settings'));
    } else {
      const restoredTab = getRestorableActiveTab(newState);
      storeActiveTab(restoredTab);
      startTransition(() => setActiveTab(restoredTab));
    }
  }, [maintenanceSettings]);

  const beginBranchLoginApproval = useCallback(async (signedInState: AuthState) => {
    const branch = signedInState.user;
    if (!branch) {
      throw new Error('Authenticated branch account is not linked to an active app profile.');
    }

    const request = await branchLoginApprovalService.createBranchLoginApprovalRequest({ branchId: branch.id });
    storeBranchLoginApprovalRequest(request.id);

    if (request.status === 'approved') {
      await enterAuthenticatedApp(signedInState);
      return;
    }

    if (request.status === 'rejected') {
      throw new Error('Your login request was rejected by admin.');
    }

    if (request.status !== 'pending') {
      throw new Error('Login approval expired. Please try again.');
    }

    setPendingBranchAuthState({ user: branch, pharmacist: null, permissions: [], rolePermissions: [] });
    setPendingBranchApproval(request);
    setAuthState({ user: null, pharmacist: null, permissions: [] });
    setActiveTab(null);
    setLoginNotice(null);
  }, [enterAuthenticatedApp]);

  const handleApprovedBranchLogin = useCallback(async (approval: BranchLoginApproval) => {
    if (!pendingBranchAuthState?.user) {
      await signOutToLoginWithNotice('Unable to verify login approval. For security, access is blocked.');
      return;
    }
    try {
      storeBranchLoginApprovalRequest(approval.id);
      setIsInitializing(true);
      await enterAuthenticatedApp(pendingBranchAuthState);
    } catch (error) {
      console.error('Approved branch login could not enter app:', error);
      await signOutToLoginWithNotice('Unable to verify login approval. For security, access is blocked.');
    } finally {
      setIsInitializing(false);
    }
  }, [enterAuthenticatedApp, pendingBranchAuthState, signOutToLoginWithNotice]);

  const handleRejectedBranchLogin = useCallback(async () => {
    await signOutToLoginWithNotice('Your login request was rejected by admin.');
  }, [signOutToLoginWithNotice]);

  const handleExpiredBranchLogin = useCallback(async () => {
    await signOutToLoginWithNotice('Login approval expired. Please try again.');
  }, [signOutToLoginWithNotice]);

  const handleBranchApprovalVerificationError = useCallback(async () => {
    await signOutToLoginWithNotice('Unable to verify login approval. For security, access is blocked.');
  }, [signOutToLoginWithNotice]);

  const handleCancelBranchApproval = useCallback(async () => {
    const requestId = pendingBranchApproval?.id;
    try {
      if (requestId) await branchLoginApprovalService.cancelBranchLoginApproval(requestId);
    } catch (error) {
      console.warn('Could not cancel branch login approval before sign-out:', error);
    }
    await signOutToLoginWithNotice('Login approval cancelled. Please sign in again.');
  }, [pendingBranchApproval?.id, signOutToLoginWithNotice]);

  const [customerToken, setCustomerToken] = useState<string | null>(() => getRecoverableSpinToken());
  const [isBhAnalyzerPage] = useState(() => {
    const cleanPath = window.location.pathname.replace(/\/+$/, '') || '/';
    const params = new URLSearchParams(window.location.search);
    return cleanPath.toLowerCase() === '/bh_analyzer' || params.get('bh_analyzer') === '1';
  });

  // Legacy static branch QR links are exchanged server-side for short-lived secure tokens.
  useEffect(() => {
    if (isBhAnalyzerPage) return;

    const handleStaticToken = async () => {
      const params = new URLSearchParams(window.location.search);
      const branchCode = params.get('node') || params.get('branch');

      if (branchCode && !customerToken) {
        setCustomerFlowError(null);
        try {
          const session = await spinWinService.sessions.generateFromBranchCode(branchCode);
          params.delete('node');
          params.delete('branch');
          params.set('token', session.token);

          const nextUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
          window.history.replaceState({ spinToken: session.token }, '', nextUrl);
          setCustomerToken(session.token);
        } catch {
          setCustomerFlowError('This QR code is not available right now. Please ask the branch team for help.');
          setIsInitializing(false);
        }
      }
    };
    handleStaticToken();
  }, [customerToken, isBhAnalyzerPage]);

  // Session recovery on initial mount
  useEffect(() => {
    if (isBhAnalyzerPage) {
      setIsInitializing(false);
      return;
    }

    const init = async () => {
      if (isMaintenanceLoading) return;

      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session as AuthState | null;
        if (session?.user) {
          if (session.user.role === 'branch') {
            if (!isBranchLoginApprovalRequired) {
              storeBranchLoginApprovalRequest(null);
              await enterAuthenticatedApp(session);
              return;
            }

            try {
              const { data: rawSessionData } = await supabase.client.auth.getSession();
              const authUserId = rawSessionData.session?.user.id;
              const approval = await branchLoginApprovalService.createBranchLoginApprovalRequest({ branchId: session.user.id });

              if (!authUserId || approval.userId !== authUserId || approval.branchId !== session.user.id) {
                await signOutToLoginWithNotice('Unable to verify login approval. For security, access is blocked.');
                return;
              }

              storeBranchLoginApprovalRequest(approval.id);

              if (approval.status === 'approved') {
                await enterAuthenticatedApp(session);
                return;
              }

              if (approval.status === 'pending') {
                setPendingBranchAuthState({ user: session.user, pharmacist: null, permissions: [], rolePermissions: [] });
                setPendingBranchApproval(approval);
                setAuthState({ user: null, pharmacist: null, permissions: [] });
                setActiveTab(null);
                return;
              }

              if (approval.status === 'rejected') {
                await signOutToLoginWithNotice('Your login request was rejected by admin.');
                return;
              }

              await signOutToLoginWithNotice('Login approval expired. Please try again.');
              return;
            } catch (approvalError) {
              console.error('Branch login approval verification failed:', approvalError);
              await signOutToLoginWithNotice('Unable to verify login approval. For security, access is blocked.');
              return;
            }
          }

          let currentSession: AuthState = session;
          if (currentSession.user) {
            try {
              const [branchPerms, userPerms, rolePerms] = await Promise.all([
                currentSession.user.role === 'branch' ? supabase.permissions.listForBranch(currentSession.user.id) : Promise.resolve([]),
                supabase.permissions.listForUser(currentSession.user.userId || currentSession.user.id),
                supabase.permissions.listRoleDefaults(currentSession.user.role)
              ]);
              currentSession.permissions = [...userPerms, ...branchPerms];
              currentSession.rolePermissions = rolePerms;
            } catch (pErr) {
              console.error("Init permission fetch error:", pErr);
              if (!currentSession.permissions) currentSession.permissions = [];
              if (!currentSession.rolePermissions) currentSession.rolePermissions = [];
            }
          }
          setAuthState(currentSession);
          const restoredTab = getRestorableActiveTab(currentSession);
          storeActiveTab(restoredTab);
          setActiveTab(restoredTab);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, [enterAuthenticatedApp, isBhAnalyzerPage, isBranchLoginApprovalRequired, isMaintenanceLoading, signOutToLoginWithNotice]);

  const handleLogin = async (identifier: string, password: string) => {
    setIsInitializing(true);
    setLoginNotice(null);
    try {
      const signedInState = await supabase.auth.signInWithPassword(identifier, password);
      const branch = signedInState.user;
      if (!branch) {
        throw new Error('Authenticated account is not linked to a branch profile.');
      }

      if (branch.role === 'branch') {
        if (isBranchLoginApprovalRequired) {
          await beginBranchLoginApproval(signedInState);
        } else {
          storeBranchLoginApprovalRequest(null);
          await enterAuthenticatedApp(signedInState);
        }
        return;
      }

      await enterAuthenticatedApp(signedInState);
    } catch (err) {
      console.error("Login permission error:", err);
      clearPendingBranchApproval();
      await supabase.auth.signOut();
      setAuthState({ user: null, pharmacist: null, permissions: [] });
      setActiveTab(null);
      throw err;
    } finally {
      setIsInitializing(false);
    }
  };

  const logout = async () => {
    clearStoredActiveTab();
    storeBranchLoginApprovalRequest(null);
    await supabase.auth.signOut();
    setAuthState({ user: null, pharmacist: null, permissions: [] });
    setActivePOSBranch(null);
    setDeliveryNotificationUnreadCount(0);
    setActiveTab(null);
    setIsMaintenanceAdminLoginOpen(false);
  };

  const handleBackToPharmacist = () => {
    const newState = { ...authState, pharmacist: null };
    setAuthState(newState);
    setShowPharmacistSelector(true);
  };

  const handleOpenBenefitPayFromDelivery = (transfer: BenefitPayTransfer) => {
    setBenefitPayFocusTarget({
      deliveryOrderId: transfer.deliveryOrderId,
      transferDate: transfer.transferDate,
      branchId: transfer.branchId
    });
    handleTabChange('benefit-pay-ledger');
  };

  const handleOpenDeliveryFromBenefitPay = (transfer: BenefitPayTransfer) => {
    setDeliveryFocusTarget({
      orderId: transfer.deliveryOrderId,
      orderDate: transfer.transferDate,
      branchId: transfer.branchId
    });
    handleTabChange('delivery');
  };

  const handleOpenDeliveryFromNotification = (notification: DeliveryNotification) => {
    setDeliveryFocusTarget({
      orderId: notification.orderId,
      orderDate: notification.payload.orderDate || null,
      branchId: notification.branchId || notification.payload.branchId || null
    });
    handleTabChange('delivery');
  };

  const isMaintenanceEnabled = maintenanceSettings?.isMaintenanceModeEnabled === true;
  const canBypassMaintenance = canControlMaintenance(authState.user?.role);
  const isMaintenanceAdminLoginAllowed = isMaintenanceEnabled && isMaintenanceAdminLoginOpen && !authState.user;
  const shouldRenderMaintenance = isMaintenanceEnabled && !canBypassMaintenance && !isMaintenanceAdminLoginAllowed;
  const pharmacyLogoUrl = maintenanceSettings?.pharmacyLogoUrl?.trim() || clientConfig.logoUrl;
  const loadingSpinnerUrl = maintenanceSettings?.loadingSpinnerUrl?.trim() || '';

  if (isInitializing || isMaintenanceLoading) {
    const isRewardFlowLoading = isCustomerFlow && !isMaintenanceLoading;

    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 text-center space-y-8">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 rounded-3xl bg-brand/5 blur-xl"></div>
          {loadingSpinnerUrl ? (
            <img
              src={loadingSpinnerUrl}
              alt="Loading"
              className="relative h-20 w-20 object-contain"
            />
          ) : (
            <Loader2 className="relative h-14 w-14 animate-spin text-brand" />
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">
            {isRewardFlowLoading ? 'Reward hub' : clientConfig.clientName}
          </h3>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-[0.2em]">
            {isRewardFlowLoading ? 'Verifying Security Token...' : 'Establishing connection...'}
          </p>
        </div>
      </div>
    );
  }

  if (shouldRenderMaintenance) {
    return (
      <MaintenancePage
        settings={maintenanceSettings}
        onAdminAccess={!authState.user ? () => setIsMaintenanceAdminLoginOpen(true) : undefined}
        onSignOut={authState.user ? logout : undefined}
        userLabel={authState.user?.code || authState.user?.name}
      />
    );
  }

  if (isMaintenanceAdminLoginAllowed) {
    return (
      <>
        <SystemSettingsWarning message={maintenanceSettingsError} />
        <LoginPage onLogin={handleLogin} settings={maintenanceSettings} notice={loginNotice} />
      </>
    );
  }

  if (isBhAnalyzerPage) {
    return <BlockCoverageAnalyzer onBack={() => window.location.assign('/')} />;
  }

  if (customerToken) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerFlow token={customerToken} logoUrl={pharmacyLogoUrl} spinnerUrl={loadingSpinnerUrl} />
      </div>
    );
  }

  if (isCustomerFlow && customerFlowError) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 text-center space-y-4">
        <ShieldCheck className="w-10 h-10 text-brand" />
        <h1 className="text-xl font-black text-slate-900">Secure QR Required</h1>
        <p className="max-w-sm text-sm font-medium text-slate-500">{customerFlowError}</p>
      </div>
    );
  }

  // Block main app if we are in customer flow but still initializing
  if (isCustomerFlow && !customerToken) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 text-center">
        <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-900">Entering Secure Reward Session...</p>
      </div>
    );
  }

  if (pendingBranchApproval && pendingBranchAuthState?.user) {
    return (
      <BranchLoginApprovalWaitingPage
        request={pendingBranchApproval}
        branchName={pendingBranchAuthState.user.name}
        onApproved={handleApprovedBranchLogin}
        onRejected={handleRejectedBranchLogin}
        onExpired={handleExpiredBranchLogin}
        onVerificationError={handleBranchApprovalVerificationError}
        onCancel={handleCancelBranchApproval}
        logoUrl={pharmacyLogoUrl}
      />
    );
  }

  if (!authState.user) {
    return (
      <>
        <SystemSettingsWarning message={maintenanceSettingsError} />
        <LoginPage onLogin={handleLogin} settings={maintenanceSettings} notice={loginNotice} />
      </>
    );
  }

  const isManager = isManagerRole(authState.user?.role);
  const isWarehouse = authState.user?.role === 'warehouse';

  const checkPermission = buildPermissionChecker(
    authState.user?.role,
    authState.permissions,
    authState.rolePermissions
  );

  if (showPharmacistSelector || (activeTab === 'pos' && !authState.pharmacist)) {
    return (
      <SelectPharmacistPage
        branch={authState.user!}
        backLabel="Back to Modules"
        onSelect={(pharmacist, operatingBranch) => {
          const newState = { ...authState, pharmacist };
          setAuthState(newState);
          setActivePOSBranch(operatingBranch || authState.user);
          setShowPharmacistSelector(false);
          if (shouldShowPOSGuideline()) setShowPOSGuideline(true);
          storeActiveTab('pos');
          startTransition(() => setActiveTab('pos'));
        }}
        onLogout={() => {
          setShowPharmacistSelector(false);
          setActivePOSBranch(null);
          handleTabChange('selector');
        }}
      />
    );
  }

  if (activeTab === null || activeTab === 'selector') {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col selection:bg-brand/10">
        <SystemSettingsWarning message={maintenanceSettingsError} showDetails={isManager} />
        <AppHeader
          authState={authState}
          activeTab="selector"
          isWarehouse={isWarehouse}
          canOpenDashboard={isTabEnabled('dashboard')}
          checkPermission={checkPermission}
          onNavigateHome={() => handleTabChange('selector')}
          onTabChange={handleTabChange}
          onLogout={logout}
          onOpenNotifications={canReceiveDeliveryNotifications ? () => handleTabChange('notifications') : undefined}
          notificationUnreadCount={deliveryNotificationUnreadCount}
          hasNotificationAlert={hasDeliveryNotificationAlert}
          settings={maintenanceSettings}
        />
        <SuitePage
          authState={authState}
          isManager={isManager}
          isWarehouse={isWarehouse}
          isPending={isPending}
          checkPermission={checkPermission}
          handleTabChange={handleTabChange}
          logout={logout}
          footerSettings={maintenanceSettings}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col selection:bg-brand/10">
      <SystemSettingsWarning message={maintenanceSettingsError} showDetails={isManager} />
      <AppHeader
        authState={authState}
        activeTab={activeTab}
        isWarehouse={isWarehouse}
        canOpenDashboard={isTabEnabled('dashboard')}
        checkPermission={checkPermission}
        onNavigateHome={() => handleTabChange('selector')}
        onTabChange={handleTabChange}
        onLogout={logout}
        onOpenNotifications={canReceiveDeliveryNotifications ? () => handleTabChange('notifications') : undefined}
        notificationUnreadCount={deliveryNotificationUnreadCount}
        hasNotificationAlert={hasDeliveryNotificationAlert}
        settings={maintenanceSettings}
      />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-5 md:px-8 py-6">
        <div className="mb-4 flex justify-end print:hidden">
          <ModuleHelpButton moduleKey={activeTab === 'selector' ? null : activeTab} />
        </div>
        <AppRouter
          activeTab={activeTab}
          authState={authState}
          activePOSBranch={activePOSBranch}
          pharmacyLogoUrl={pharmacyLogoUrl}
          hrLetterInitialData={hrLetterInitialData}
          deliveryFocusTarget={deliveryFocusTarget}
          benefitPayFocusTarget={benefitPayFocusTarget}
          checkPermission={checkPermission}
          onTabChange={handleTabChange}
          onBackToPharmacist={handleBackToPharmacist}
          onSetDeliveryFocusTarget={setDeliveryFocusTarget}
          onSetBenefitPayFocusTarget={setBenefitPayFocusTarget}
          onSetHrLetterInitialData={setHrLetterInitialData}
          onDeliveryNotificationUnreadCountChange={setDeliveryNotificationUnreadCount}
          onOpenBenefitPayFromDelivery={handleOpenBenefitPayFromDelivery}
          onOpenDeliveryFromBenefitPay={handleOpenDeliveryFromBenefitPay}
          onOpenDeliveryFromNotification={handleOpenDeliveryFromNotification}
          onSettingsChange={setMaintenanceSettings}
        />
      </main>

      <div className="print:hidden">
        <Footer
          onNavigate={handleTabChange}
          permissions={authState.permissions}
          rolePermissions={authState.rolePermissions}
          user={authState.user}
          settings={maintenanceSettings}
        />
      </div>

      <POSGuidelineModal
        isOpen={showPOSGuideline}
        onClose={() => setShowPOSGuideline(false)}
        settings={maintenanceSettings}
      />
    </div>
  );
};

export default App;
