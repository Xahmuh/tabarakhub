
import React, { useState, useEffect, useTransition } from 'react';

// --- Core Imports ---
import { Pharmacist, AuthState, MaintenanceSettings } from './types';
import { supabase } from './lib/supabase';
import { buildPermissionChecker } from './lib/access';
import { clientConfig, isModuleEnabled } from './config/clientConfig';
import { spinWinService } from './services/spinWin';
import { 
  LoginPage, SelectPharmacistPage, POSPage, DashboardPage, HRPortalPage, 
  HRRequestsSection, WorkforcePage, SuitePage,
  CustomerFlow, SpinWinHub, CorporateCodex, ProjectSettings, AppHeader, Footer, POSGuidelineModal,
  CashFlowPlanner, BranchCashTrackerPage, BlockCoverageAnalyzer, DailyCommandCenter, MaintenancePage,
  FeedbackForm, QualityFeedbackAdmin, EmployeeContributionsPage, DeliveryHub
} from './app/index';


// --- Icons ---
import {
  ShieldCheck,
  QrCode,
  Loader2
} from 'lucide-react';

type AppTab = 'command-center' | 'pos' | 'dashboard' | 'selector' | 'spin-win' | 'hr' | 'hr-manager' | 'workforce' | 'cash-flow' | 'cash-tracker' | 'corporate-codex' | 'settings' | 'feedback-form' | 'feedback-admin' | 'employee-contributions' | 'block-analyzer' | 'delivery';
const SPIN_RETURN_KEY = 'tabarak_spinwin_return';
const SPIN_DRAFT_KEY = 'tabarak_spinwin_customer_draft';
const SPIN_RETURN_TTL_MS = 45 * 60 * 1000;

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
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(true);
  const [isMaintenanceAdminLoginOpen, setIsMaintenanceAdminLoginOpen] = useState(false);
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
        return isModuleEnabled('settings') && role === 'manager' && canUseFeature('settings', 'edit', role);
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
      setShowPOSGuideline(true);
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
        if (isMounted) setMaintenanceSettings(settings);
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
    try {
      const signedInState = await supabase.auth.signInWithPassword(identifier, password);
      const branch = signedInState.user;
      if (!branch) {
        throw new Error('Authenticated account is not linked to a branch profile.');
      }
      const [permissions, rolePermissions] = await Promise.all([
        supabase.permissions.listForBranch(branch.id),
        supabase.permissions.listRoleDefaults(branch.role)
      ]);
      const newState = { user: branch, pharmacist: null, permissions, rolePermissions };
      setAuthState(newState);
      setIsMaintenanceAdminLoginOpen(false);

      if (maintenanceSettings?.isMaintenanceModeEnabled && canControlMaintenance(branch.role) && isModuleEnabled('settings')) {
        sessionStorage.setItem('tabarak_active_tab', 'settings');
        startTransition(() => setActiveTab('settings'));
      } else {
        handleTabChange('selector');
      }
    } catch (err) {
      console.error("Login permission error:", err);
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
    return <LoginPage onLogin={handleLogin} />;
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

  if (!authState.user) {
    return <LoginPage onLogin={handleLogin} />;
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
          setShowPOSGuideline(true);
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
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col selection:bg-brand/10">
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
          <ProjectSettings onBack={() => handleTabChange('selector')} />
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
        <Footer onNavigate={handleTabChange} permissions={authState.permissions} rolePermissions={authState.rolePermissions} user={authState.user} />
      </div>

      <POSGuidelineModal
        isOpen={showPOSGuideline}
        onClose={() => setShowPOSGuideline(false)}
      />
    </div>
  );
};

export default App;
