
import React, { useCallback, useEffect, useState, useTransition } from 'react';

// --- Core Imports ---
import { Pharmacist, AuthState, BranchLoginApproval, MaintenanceSettings } from './types';
import { supabase } from './lib/supabase';
import { buildPermissionChecker } from './lib/access';
import { clientConfig, isModuleEnabled } from './config/clientConfig';
import { spinWinService } from './services/spinWin';
import { getSystemSettingsErrorMessage } from './services/systemSettingsService';
import { branchLoginApprovalService } from './services/branchLoginApprovalService';
import { 
  LoginPage, SelectPharmacistPage, POSPage, DashboardPage, HRPortalPage, 
  HRRequestsSection, WorkforcePage, SuitePage,
  CustomerFlow, SpinWinHub, CorporateCodex, ProjectSettings, AppHeader, Footer, POSGuidelineModal,
  CashFlowPlanner, BranchCashTrackerPage, BlockCoverageAnalyzer, DailyCommandCenter, MaintenancePage,
  FeedbackForm, QualityFeedbackAdmin, EmployeeContributionsPage, DeliveryHub
} from './app/index';
import { BranchLoginApprovalWaitingPage } from './app/login/BranchLoginApprovalWaitingPage';


// --- Icons ---
import {
  ShieldCheck,
  QrCode,
  Loader2,
  AlertTriangle
} from 'lucide-react';

type AppTab = 'command-center' | 'pos' | 'dashboard' | 'selector' | 'spin-win' | 'hr' | 'hr-manager' | 'workforce' | 'cash-flow' | 'cash-tracker' | 'corporate-codex' | 'settings' | 'feedback-form' | 'feedback-admin' | 'employee-contributions' | 'block-analyzer' | 'delivery';
const SPIN_RETURN_KEY = 'tabarak_spinwin_return';
const SPIN_DRAFT_KEY = 'tabarak_spinwin_customer_draft';
const SPIN_RETURN_TTL_MS = 45 * 60 * 1000;
const BRANCH_LOGIN_APPROVAL_REQUEST_KEY = 'tabarak_branch_login_approval_request';

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
  role === 'manager' || role === 'owner';

const storeBranchLoginApprovalRequest = (requestId: string | null) => {
  try {
    if (requestId) sessionStorage.setItem(BRANCH_LOGIN_APPROVAL_REQUEST_KEY, requestId);
    else sessionStorage.removeItem(BRANCH_LOGIN_APPROVAL_REQUEST_KEY);
  } catch {
    // Session storage is a pointer only; Supabase remains the approval source.
  }
};

const readBranchLoginApprovalRequest = () => {
  try {
    return sessionStorage.getItem(BRANCH_LOGIN_APPROVAL_REQUEST_KEY);
  } catch {
    return null;
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

const hexToRgbParts = (value: string, fallback: string) => {
  const normalized = value.trim().replace('#', '');
  const hex = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return fallback;

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `${red} ${green} ${blue}`;
};

const App: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>({ user: null, pharmacist: null });
  const [activeTab, setActiveTab] = useState<AppTab | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [maintenanceSettings, setMaintenanceSettings] = useState<MaintenanceSettings | null>(null);
  const [maintenanceSettingsError, setMaintenanceSettingsError] = useState<string | null>(null);
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(true);
  const [isMaintenanceAdminLoginOpen, setIsMaintenanceAdminLoginOpen] = useState(false);
  const [pendingBranchApproval, setPendingBranchApproval] = useState<BranchLoginApproval | null>(null);
  const [pendingBranchAuthState, setPendingBranchAuthState] = useState<AuthState | null>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPOSGuideline, setShowPOSGuideline] = useState(false);
  const [showPharmacistSelector, setShowPharmacistSelector] = useState(false);
  const [customerFlowError, setCustomerFlowError] = useState<string | null>(null);
  const [isCustomerFlow] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('token') || params.has('node') || params.has('branch');
  });

  const isDashboardEnabledForRole = (role?: string) => {
    if (!isModuleEnabled('reports')) return false;
    if (role === 'warehouse') return isModuleEnabled('adminDashboard');
    if (role === 'manager' || role === 'owner' || role === 'supervisor') return isModuleEnabled('managerDashboard');
    return isModuleEnabled('branchDashboard');
  };

  const canUseFeature = (feature: string, minimum: 'read' | 'edit' = 'read', role = authState.user?.role) =>
    buildPermissionChecker(role, authState.permissions, authState.rolePermissions)(feature, minimum);
  const shouldShowPOSGuideline = () => maintenanceSettings?.posGuidelineEnabled !== false;

  const isTabEnabled = (tab: AppTab | null, role = authState.user?.role) => {
    if (!tab || tab === 'selector') return true;
    switch (tab) {
      case 'command-center':
        return canUseFeature('command_center', 'read', role);
      case 'pos':
        return isModuleEnabled('sales') && (canUseFeature('lost_sales', 'edit', role) || canUseFeature('shortages', 'edit', role));
      case 'dashboard':
        return isDashboardEnabledForRole(role) && (canUseFeature('lost_sales', 'read', role) || canUseFeature('shortages', 'read', role));
      case 'spin-win':
        return isModuleEnabled('spinWin') && canUseFeature('spin_win', 'read', role);
      case 'hr':
      case 'hr-manager':
        return isModuleEnabled('hr') && canUseFeature('hr_requests', 'read', role);
      case 'workforce':
        return isModuleEnabled('hr') && isModuleEnabled('workforce') && canUseFeature('workforce', 'read', role);
      case 'cash-flow':
        return isModuleEnabled('cashFlow') && canUseFeature('cash_flow', 'read', role);
      case 'cash-tracker':
        return isModuleEnabled('cashTracker') && canUseFeature('cash_tracker', 'read', role);
      case 'corporate-codex':
        return isModuleEnabled('corporateCodex') && canUseFeature('corporate_codex', 'read', role);
      case 'settings':
        return isModuleEnabled('settings') && (
          (role === 'manager' && canUseFeature('settings', 'edit', role))
          || role === 'owner'
          || role === 'admin'
        );
      case 'feedback-form':
        return isModuleEnabled('qualityFeedback') && canUseFeature('quality_feedback', 'read', role);
      case 'feedback-admin':
        return isModuleEnabled('qualityFeedback') && (role === 'manager' || role === 'owner') && canUseFeature('quality_feedback', 'read', role);
      case 'employee-contributions':
        return isModuleEnabled('employeeContributions') && canUseFeature('employee_contributions', 'read', role);
      case 'block-analyzer':
        return (role === 'manager' || role === 'owner') && canUseFeature('block_analyzer', 'read', role);
      case 'delivery':
        return isModuleEnabled('delivery') && canUseFeature('delivery', 'read', role);
      default:
        return true;
    }
  };

  const handleTabChange = (tab: AppTab | null) => {
    if (!isTabEnabled(tab)) {
      setActiveTab('selector');
      sessionStorage.setItem('tabarak_active_tab', 'selector');
      return;
    }
    if (tab === 'pos' && !authState.pharmacist) {
      setShowPharmacistSelector(true);
      return;
    }
    if (tab === 'pos') {
      if (shouldShowPOSGuideline()) setShowPOSGuideline(true);
    }
    if (tab) {
      sessionStorage.setItem('tabarak_active_tab', tab);
    } else {
      sessionStorage.removeItem('tabarak_active_tab');
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

    const [permissions, rolePermissions] = await Promise.all([
      supabase.permissions.listForBranch(user.id),
      supabase.permissions.listRoleDefaults(user.role)
    ]);

    const newState = { user, pharmacist: null, permissions, rolePermissions };
    if (user.role !== 'branch') {
      storeBranchLoginApprovalRequest(null);
    }
    setPendingBranchApproval(null);
    setPendingBranchAuthState(null);
    setLoginNotice(null);
    setAuthState(newState);
    setIsMaintenanceAdminLoginOpen(false);

    if (maintenanceSettings?.isMaintenanceModeEnabled && canControlMaintenance(user.role) && isModuleEnabled('settings')) {
      sessionStorage.setItem('tabarak_active_tab', 'settings');
      startTransition(() => setActiveTab('settings'));
    } else {
      handleTabChange('selector');
    }
  }, [maintenanceSettings]);

  const beginBranchLoginApproval = useCallback(async (signedInState: AuthState) => {
    const branch = signedInState.user;
    if (!branch) {
      throw new Error('Authenticated branch account is not linked to an active app profile.');
    }

    const request = await branchLoginApprovalService.createBranchLoginApprovalRequest({ branchId: branch.id });
    storeBranchLoginApprovalRequest(request.id);
    setPendingBranchAuthState({ user: branch, pharmacist: null, permissions: [], rolePermissions: [] });
    setPendingBranchApproval(request);
    setAuthState({ user: null, pharmacist: null, permissions: [] });
    setActiveTab(null);
    setLoginNotice(null);
  }, []);

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

  useEffect(() => {
    document.title = `${clientConfig.clientName} | ${clientConfig.appName}`;
    const root = document.documentElement;
    root.style.setProperty('--client-primary-color', clientConfig.primaryColor);
    root.style.setProperty('--client-primary-hover-color', clientConfig.primaryHoverColor);
    root.style.setProperty('--client-primary-dark-color', clientConfig.primaryDarkColor);
    root.style.setProperty('--client-primary-muted-color', clientConfig.primaryMutedColor);
    root.style.setProperty('--client-accent-color', clientConfig.accentColor);
    root.style.setProperty('--client-primary-rgb', hexToRgbParts(clientConfig.primaryColor, '185 28 28'));
    root.style.setProperty('--client-primary-hover-rgb', hexToRgbParts(clientConfig.primaryHoverColor, '153 27 27'));
    root.style.setProperty('--client-primary-dark-rgb', hexToRgbParts(clientConfig.primaryDarkColor, '127 29 29'));
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadMaintenanceSettings = async () => {
      try {
        const settings = await supabase.systemSettings.getMaintenanceSettings();
        if (isMounted) {
          setMaintenanceSettings(settings);
          setMaintenanceSettingsError(null);
        }
      } catch (error) {
        if (isMounted) {
          setMaintenanceSettings(null);
          setMaintenanceSettingsError(getSystemSettingsErrorMessage(error));
        }
      } finally {
        if (isMounted) setIsMaintenanceLoading(false);
      }
    };

    loadMaintenanceSettings();

    return () => {
      isMounted = false;
    };
  }, []);

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

  useEffect(() => {
    if (isBhAnalyzerPage) {
      setIsInitializing(false);
      return;
    }

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session as AuthState | null;
        if (session?.user) {
          if (session.user.role === 'branch') {
            const requestId = readBranchLoginApprovalRequest();
            if (!requestId) {
              await signOutToLoginWithNotice('Unable to verify login approval. For security, access is blocked.');
              return;
            }

            try {
              const { data: rawSessionData } = await supabase.client.auth.getSession();
              const authUserId = rawSessionData.session?.user.id;
              const approval = await branchLoginApprovalService.getBranchLoginApprovalStatus(requestId);
              if (!authUserId || approval.userId !== authUserId || approval.branchId !== session.user.id) {
                await signOutToLoginWithNotice('Unable to verify login approval. For security, access is blocked.');
                return;
              }

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
              const [perms, rolePerms] = await Promise.all([
                supabase.permissions.listForBranch(currentSession.user.id),
                supabase.permissions.listRoleDefaults(currentSession.user.role)
              ]);
              currentSession.permissions = perms;
              currentSession.rolePermissions = rolePerms;
            } catch (pErr) {
              console.error("Init permission fetch error:", pErr);
              // Fallback: ensure permissions is at least an empty array if undefined
              if (!currentSession.permissions) currentSession.permissions = [];
              if (!currentSession.rolePermissions) currentSession.rolePermissions = [];
            }
          }
          setAuthState(currentSession);
          const savedTab = sessionStorage.getItem('tabarak_active_tab') as AppTab | null;
          if (savedTab && isTabEnabled(savedTab, currentSession.user?.role)) {
            setActiveTab(savedTab);
          } else {
            setActiveTab('selector');
          }
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, [isBhAnalyzerPage]);

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
        await beginBranchLoginApproval(signedInState);
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

  const handleSelectPharmacist = (pharmacist: Pharmacist) => {
    const newState = { ...authState, pharmacist };
    setAuthState(newState);
    const savedTab = sessionStorage.getItem('tabarak_active_tab');
    if (savedTab && savedTab !== 'selector') {
      startTransition(() => setActiveTab(savedTab as any));
    } else {
      handleTabChange('selector');
    }
  };

  const logout = async () => {
    sessionStorage.removeItem('tabarak_active_tab');
    storeBranchLoginApprovalRequest(null);
    await supabase.auth.signOut();
    setAuthState({ user: null, pharmacist: null, permissions: [] });
    setActiveTab(null);
    setIsMaintenanceAdminLoginOpen(false);
  };

  const handleBackToPharmacist = () => {
    const newState = { ...authState, pharmacist: null };
    setAuthState(newState);
    setShowPharmacistSelector(true);
  };

  const isMaintenanceEnabled = maintenanceSettings?.isMaintenanceModeEnabled === true;
  const canBypassMaintenance = canControlMaintenance(authState.user?.role);
  const isMaintenanceAdminLoginAllowed = isMaintenanceEnabled && isMaintenanceAdminLoginOpen && !authState.user;
  const shouldRenderMaintenance = isMaintenanceEnabled && !canBypassMaintenance && !isMaintenanceAdminLoginAllowed;

  if (isInitializing || isMaintenanceLoading) {
    const isRewardFlowLoading = isCustomerFlow && !isMaintenanceLoading;

    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 text-center space-y-8">
        <div className="relative">
          <div className="w-16 h-16 border-[3px] border-slate-100 border-t-brand rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            {isRewardFlowLoading ? (
              <QrCode className="w-6 h-6 text-brand" />
            ) : (
              <div className="w-8 h-8 bg-brand rounded-lg shadow-lg shadow-brand/20 overflow-hidden">
                <img src={clientConfig.logoUrl} alt={`${clientConfig.clientName} logo`} className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">
            {isRewardFlowLoading ? 'Reward Hub' : clientConfig.clientName}
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
        <CustomerFlow token={customerToken} />
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

  const isManager = authState.user?.role === 'manager';
  const isWarehouse = authState.user?.role === 'warehouse';

  const checkPermission = buildPermissionChecker(
    authState.user?.role,
    authState.permissions,
    authState.rolePermissions
  );

  if (showPharmacistSelector) {
    return (
      <SelectPharmacistPage
        branch={authState.user!}
        backLabel="Back to Modules"
        onSelect={(pharmacist) => {
          const newState = { ...authState, pharmacist };
          setAuthState(newState);
          setShowPharmacistSelector(false);
          if (shouldShowPOSGuideline()) setShowPOSGuideline(true);
          sessionStorage.setItem('tabarak_active_tab', 'pos');
          startTransition(() => setActiveTab('pos'));
        }}
        onLogout={() => setShowPharmacistSelector(false)}
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
      />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-5 md:px-8 py-6">
        {activeTab === 'command-center' ? (
          <DailyCommandCenter user={authState.user} onNavigate={handleTabChange} />
        ) : activeTab === 'pos' ? (
          <POSPage branch={authState.user!} pharmacist={authState.pharmacist!} permissions={authState.permissions || []} onBackToPharmacist={handleBackToPharmacist} />
        ) : activeTab === 'spin-win' ? (
          <SpinWinHub
            branch={authState.user!}
            onBack={() => handleTabChange('selector')}
            userRole={authState.user?.role || 'branch'}
          />
        ) : activeTab === 'hr' ? (
          <HRPortalPage onBack={() => handleTabChange('selector')} />
        ) : activeTab === 'hr-manager' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">HR Admin Portal</h2>
                <p className="text-slate-500 font-medium">Manage employee requests and approvals</p>
              </div>
              <button onClick={() => handleTabChange('selector')} className="btn-secondary">
                Back to Modules
              </button>
            </div>
            <HRRequestsSection />
          </div>
        ) : activeTab === 'workforce' ? (
          <WorkforcePage onBack={() => handleTabChange('selector')} />
        ) : activeTab === 'cash-flow' ? (
          <CashFlowPlanner
            onBack={() => handleTabChange('selector')}
            branchId={authState.user?.id}
            userRole={authState.user?.role}
            pharmacistName={authState.pharmacist?.name}
            initialTab="dashboard"
          />
        ) : activeTab === 'cash-tracker' ? (
          <BranchCashTrackerPage
            onBack={() => handleTabChange('selector')}
            branchId={authState.user?.id}
            userRole={authState.user?.role}
            pharmacistName={authState.pharmacist?.name}
          />
        ) : activeTab === 'corporate-codex' ? (
          <CorporateCodex
            userRole={authState.user?.role || 'branch'}
            onBack={() => handleTabChange('selector')}
          />
        ) : activeTab === 'settings' ? (
          <ProjectSettings onBack={() => handleTabChange('selector')} onSettingsChange={setMaintenanceSettings} currentRole={authState.user?.role} />
        ) : activeTab === 'feedback-form' ? (
          <FeedbackForm onBack={() => handleTabChange('selector')} />
        ) : activeTab === 'feedback-admin' ? (
          <QualityFeedbackAdmin 
            userRole={authState.user?.role} 
            onBack={() => handleTabChange('selector')} 
          />
        ) : activeTab === 'employee-contributions' ? (
          <EmployeeContributionsPage 
            userRole={authState.user?.role} 
            branchCode={authState.user?.code}
            onBack={() => handleTabChange('selector')} 
          />
        ) : activeTab === 'block-analyzer' ? (
          <BlockCoverageAnalyzer onBack={() => handleTabChange('selector')} />
        ) : activeTab === 'delivery' ? (
          <DeliveryHub
            user={authState.user!}
            onBack={() => handleTabChange('selector')}
            checkPermission={checkPermission}
          />
        ) : (

          <DashboardPage
            user={authState.user!}
            permissions={authState.permissions || []}
            onBack={() => handleTabChange('selector')}
          />
        )}
      </main>

      <div className="print:hidden">
        <Footer onNavigate={handleTabChange} permissions={authState.permissions} rolePermissions={authState.rolePermissions} user={authState.user} settings={maintenanceSettings} />
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
