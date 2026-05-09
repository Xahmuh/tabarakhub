
import React, { useState, useEffect, useTransition } from 'react';

// --- Core Imports ---
import { Branch, Pharmacist, AuthState } from './types';
import { supabase } from './lib/supabase';
import { spinWinService } from './services/spinWin';
import { 
  LoginPage, SelectPharmacistPage, POSPage, DashboardPage, HRPortalPage, 
  HRRequestsSection, WorkforcePage, SuitePage,
  CustomerFlow, SpinWinHub, CorporateCodex, ProjectSettings, Footer, POSGuidelineModal,
  CashFlowPlanner, BranchCashTrackerPage, BlockCoverageAnalyzer,
  FeedbackForm, QualityFeedbackAdmin
} from './app/index';


// --- Icons ---
import {
  LayoutDashboard,
  ShoppingCart,
  LogOut,
  ChevronRight,
  Activity,
  Globe,
  ShieldCheck,
  Landmark,
  RefreshCcw,
  QrCode,
  FileText,
  Loader2,
  Users,
  Wallet,
  BookOpen,
  Settings
} from 'lucide-react';

const App: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>({ user: null, pharmacist: null });
  const [activeTab, setActiveTab] = useState<'pos' | 'dashboard' | 'selector' | 'spin-win' | 'hr' | 'hr-manager' | 'workforce' | 'cash-flow' | 'cash-tracker' | 'corporate-codex' | 'settings' | 'feedback-form' | 'feedback-admin' | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [showPOSGuideline, setShowPOSGuideline] = useState(false);
  const [showPharmacistSelector, setShowPharmacistSelector] = useState(false);
  const [isCustomerFlow] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('token') || params.has('node') || params.has('branch');
  });

  const handleTabChange = (tab: 'pos' | 'dashboard' | 'selector' | 'spin-win' | 'hr' | 'hr-manager' | 'workforce' | 'cash-flow' | 'cash-tracker' | 'corporate-codex' | 'settings' | 'feedback-form' | 'feedback-admin' | null) => {
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

  const [customerToken, setCustomerToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
  });
  const [isBhAnalyzerPage] = useState(() => {
    const cleanPath = window.location.pathname.replace(/\/+$/, '') || '/';
    const params = new URLSearchParams(window.location.search);
    return cleanPath.toLowerCase() === '/bh_analyzer' || params.get('bh_analyzer') === '1';
  });

  // Handle Static QR Codes (e.g. ?node=BH-01 or ?branch=BH-01)
  useEffect(() => {
    if (isBhAnalyzerPage) return;

    const handleStaticToken = async () => {
      const params = new URLSearchParams(window.location.search);
      const branchCode = params.get('node') || params.get('branch');

      if (branchCode && !customerToken) {
        setIsInitializing(true);
        try {
          const branch = await supabase.branches.findByCode(branchCode);
          if (branch) {
            // Generate a multi-use token for this branch
            const session = await spinWinService.sessions.generate(branch.id, true);
            if (session?.token) {
              setCustomerToken(session.token);
            }
          }
        } catch (err) {
          console.error("Static token error:", err);
        } finally {
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
        const session = data?.session;
        if (session) {
          let currentSession = session as any;
          if (currentSession.user) {
            try {
              const perms = await supabase.permissions.listForBranch(currentSession.user.id);
              currentSession.permissions = perms;
              supabase.auth.setSession(currentSession);
            } catch (pErr) {
              console.error("Init permission fetch error:", pErr);
              // Fallback: ensure permissions is at least an empty array if undefined
              if (!currentSession.permissions) currentSession.permissions = [];
            }
          }
          setAuthState(currentSession);
          const savedTab = sessionStorage.getItem('tabarak_active_tab');
          if (savedTab) {
            setActiveTab(savedTab as any);
          } else if (currentSession.user?.role === 'admin' || currentSession.user?.role === 'manager') {
            setActiveTab('dashboard');
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

  const handleLogin = async (branch: Branch) => {
    setIsInitializing(true);
    try {
      const permissions = await supabase.permissions.listForBranch(branch.id);
      const newState = { user: branch, pharmacist: null, permissions };
      setAuthState(newState);
      supabase.auth.setSession(newState);
      handleTabChange('selector');
    } catch (err) {
      console.error("Login permission error:", err);
      const newState = { user: branch, pharmacist: null, permissions: [] };
      setAuthState(newState);
      supabase.auth.setSession(newState);
      handleTabChange('selector');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSelectPharmacist = (pharmacist: Pharmacist) => {
    const newState = { ...authState, pharmacist };
    setAuthState(newState);
    supabase.auth.setSession(newState);
    const savedTab = sessionStorage.getItem('tabarak_active_tab');
    if (savedTab && savedTab !== 'selector') {
      startTransition(() => setActiveTab(savedTab as any));
    } else {
      handleTabChange('selector');
    }
  };

  const logout = () => {
    sessionStorage.removeItem('tabarak_active_tab');
    supabase.auth.signOut();
    window.location.reload();
  };

  const handleBackToPharmacist = () => {
    const newState = { ...authState, pharmacist: null };
    setAuthState(newState);
    supabase.auth.setSession(newState);
    setShowPharmacistSelector(true);
  };

  if (isBhAnalyzerPage) {
    return <BlockCoverageAnalyzer />;
  }

  if (customerToken) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerFlow token={customerToken} />
      </div>
    );
  }

  // If we are definitely in customer flow but waiting for token exchange (static QR)
  if (isCustomerFlow && isInitializing) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 text-center space-y-8">
        <div className="relative">
          <div className="w-16 h-16 border-[3px] border-slate-100 border-t-brand rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <QrCode className="w-6 h-6 text-brand" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Reward Hub</h3>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-[0.2em]">Verifying Security Token...</p>
        </div>
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

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center space-y-8">
        <div className="relative">
          <div className="w-16 h-16 border-[3px] border-slate-100 border-t-brand rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 bg-brand rounded-lg shadow-lg shadow-brand/20 overflow-hidden">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-sm font-black text-slate-900 uppercase tracking-[0.3em]">Tabarak</p>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Establishing connection...</p>
        </div>
      </div>
    );
  }

  if (!authState.user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const isManager = authState.user?.role === 'manager' || authState.user?.role === 'admin';
  const isAccounts = authState.user?.role === 'accounts';
  const isAdmin01 = authState.user?.code === 'ADMIN01';

  const checkPermission = (feature: string) => {
    // Admins and Managers have full access by default, but we still check for explicit denies
    if (!authState.permissions) return true;
    const perm = authState.permissions.find(p => p.featureName === feature);
    if (!perm) return true; // Default to allow if no specific rule
    return perm.accessLevel !== 'none';
  };

  if (showPharmacistSelector) {
    return (
      <SelectPharmacistPage
        branch={authState.user!}
        backLabel="Back to Suite"
        onSelect={(pharmacist) => {
          const newState = { ...authState, pharmacist };
          setAuthState(newState);
          supabase.auth.setSession(newState);
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
      <SuitePage
        authState={authState}
        isManager={isManager}
        isAdmin01={isAdmin01}
        isAccounts={isAccounts}
        isPending={isPending}
        checkPermission={checkPermission}
        handleTabChange={handleTabChange}
        logout={logout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col selection:bg-brand/10">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-[100] h-[72px] shadow-sm print:hidden">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 h-full flex items-center justify-between">
          <div className="flex-1 flex items-center overflow-hidden">
            <div className="flex items-center space-x-4 cursor-pointer group shrink-0" onClick={() => handleTabChange('selector')}>
              <div className="w-10 h-10 bg-brand rounded-lg flex items-center justify-center shadow-md shadow-brand/20 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-900 tracking-tighter leading-none">Tabarak<span className="text-brand">.</span></h1>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 flex items-center">
                  <span className="w-1 h-1 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
                  {authState.user?.code}
                </p>
              </div>
            </div>
          </div>

          {/* Centered Switcher */}
          {(activeTab === 'pos' || activeTab === 'dashboard' || activeTab === 'settings') && !isAdmin01 && (
            <div className="flex-1 flex justify-center">
              <div className="flex bg-slate-100/60 p-1 rounded-lg border border-slate-200/50">
                {(checkPermission('lost_sales') || checkPermission('shortages')) && (
                  <button
                    onClick={() => handleTabChange('pos')}
                    className={`px-5 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center space-x-2 ${activeTab === 'pos' ? 'bg-white text-brand shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Items Entry</span>
                  </button>
                )}
                <button
                  onClick={() => handleTabChange('dashboard')}
                  className={`px-5 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center space-x-2 ${activeTab === 'dashboard' ? 'bg-white text-brand shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </button>
                {authState.user?.role === 'manager' && (
                  <button
                    onClick={() => handleTabChange('settings')}
                    className={`px-5 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center space-x-2 ${activeTab === 'settings' ? 'bg-white text-brand shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Settings</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 flex items-center justify-end space-x-2">
            <button
              onClick={() => window.location.reload()}
              className="p-2.5 text-slate-300 hover:text-brand hover:bg-brand/5 rounded-lg transition-all active:scale-90 group"
              title="Refresh"
            >
              <RefreshCcw className="w-4.5 h-4.5 group-hover:rotate-180 transition-transform duration-500" />
            </button>
            <button
              onClick={logout}
              className="p-2.5 text-slate-300 hover:text-brand hover:bg-brand/5 rounded-lg transition-all active:scale-90"
              title="Sign Out"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-6 md:px-10 py-8">
        {activeTab === 'pos' ? (
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
              <button onClick={() => handleTabChange('selector')} className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50">
                Back to Suite
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
        ) : (

          <DashboardPage
            user={authState.user!}
            permissions={authState.permissions || []}
            onBack={() => handleTabChange('selector')}
          />
        )}
      </main>

      <div className="print:hidden">
        <Footer onNavigate={handleTabChange} permissions={authState.permissions} user={authState.user} />
      </div>

      <POSGuidelineModal
        isOpen={showPOSGuideline}
        onClose={() => setShowPOSGuideline(false)}
      />
    </div>
  );
};

export default App;


