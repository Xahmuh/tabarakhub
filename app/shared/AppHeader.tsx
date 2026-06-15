import React from 'react';
import { LayoutDashboard, LogOut, RefreshCcw, Settings, ShieldCheck, ShoppingCart } from 'lucide-react';
import { AuthState, MaintenanceSettings } from '../../types';
import { clientConfig, isModuleEnabled } from '../../config/clientConfig';
import { isManagerRole } from '../../lib/access';

export type AppHeaderTab = 'pos' | 'dashboard' | 'settings' | string | null;

interface AppHeaderProps {
  authState: AuthState;
  activeTab?: AppHeaderTab;
  isWarehouse?: boolean;
  canOpenDashboard?: boolean;
  checkPermission?: (feature: string, minimum?: 'edit' | 'read') => boolean;
  onNavigateHome: () => void;
  onTabChange?: (tab: any) => void;
  onLogout: () => void;
  settings?: MaintenanceSettings | null;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  authState,
  activeTab = null,
  isWarehouse = false,
  canOpenDashboard = isModuleEnabled('reports'),
  checkPermission,
  onNavigateHome,
  onTabChange,
  onLogout,
  settings
}) => {
  const canOpenApprovalQueue = isManagerRole(authState.user?.role);
  const headerLogoUrl = settings?.pharmacyLogoUrl?.trim() || clientConfig.logoUrl;
  const canShowSwitcher =
    !!onTabChange &&
    !!checkPermission &&
    (activeTab === 'pos' || activeTab === 'dashboard' || activeTab === 'settings' || activeTab === 'system-settings' || activeTab === 'access-control') &&
    !isWarehouse;

  return (
    <header className="sticky top-0 z-[120] min-h-[72px] border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl print:hidden">
      <div className="mx-auto flex min-h-[72px] max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-8">
        <div className="flex min-w-0 items-center overflow-hidden">
          <button
            type="button"
            onClick={onNavigateHome}
            className="group flex shrink-0 items-center space-x-4 rounded-lg text-left focus-ring"
            aria-label="Back to Modules"
          >
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-brand shadow-sm transition-transform duration-300 group-hover:scale-105">
              <img src={headerLogoUrl} alt={`${clientConfig.clientName} logo`} className="h-full w-full object-cover" />
            </div>
            <div>
              <h1 className="text-lg font-black leading-none tracking-tight text-slate-900">
                Tabarak
              </h1>
              {clientConfig.environmentLabel && (
                <span className="ml-2 text-[10px] font-bold text-slate-400">{clientConfig.environmentLabel}</span>
              )}
              <p className="mt-0.5 flex items-center text-[11px] font-bold text-slate-400">
                <span className="mr-1.5 h-1 w-1 rounded-full bg-emerald-500"></span>
                {authState.user?.code}
              </p>
            </div>
          </button>
        </div>

        {canShowSwitcher && (
          <div className="order-3 flex w-full justify-center md:order-none md:w-auto">
            <div className="relative inline-flex items-center gap-1 rounded-2xl border border-slate-200/60 bg-white/50 p-1.5 shadow-inner backdrop-blur-md">
              {isModuleEnabled('sales') && (checkPermission('lost_sales') || checkPermission('shortages')) && (
                <button
                  type="button"
                  onClick={() => onTabChange('pos')}
                  className={`group relative z-10 flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-[13px] font-bold transition-all duration-300 ${
                    activeTab === 'pos' 
                      ? 'bg-slate-900 text-white shadow-md ring-1 ring-slate-900/5' 
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <ShoppingCart className={`h-4 w-4 transition-colors duration-300 ${activeTab === 'pos' ? 'text-white' : 'text-slate-400 group-hover:text-brand'}`} />
                  <span>Items Entry</span>
                </button>
              )}
              {canOpenDashboard && (
                <button
                  type="button"
                  onClick={() => onTabChange('dashboard')}
                  className={`group relative z-10 flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-[13px] font-bold transition-all duration-300 ${
                    activeTab === 'dashboard' 
                      ? 'bg-slate-900 text-white shadow-md ring-1 ring-slate-900/5' 
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <LayoutDashboard className={`h-4 w-4 transition-colors duration-300 ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-400 group-hover:text-brand'}`} />
                  <span>Dashboard</span>
                </button>
              )}
              {isModuleEnabled('settings') && ((isManagerRole(authState.user?.role) && checkPermission('settings', 'edit')) || canOpenApprovalQueue) && (
                <button
                  type="button"
                  onClick={() => onTabChange('system-settings')}
                  className={`group relative z-10 flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-[13px] font-bold transition-all duration-300 ${
                    activeTab === 'settings' || activeTab === 'system-settings'
                      ? 'bg-slate-900 text-white shadow-md ring-1 ring-slate-900/5' 
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Settings className={`h-4 w-4 transition-colors duration-300 ${activeTab === 'settings' || activeTab === 'system-settings' ? 'text-white' : 'text-slate-400 group-hover:text-brand'}`} />
                  <span>System</span>
                </button>
              )}
              {isModuleEnabled('settings') && ((isManagerRole(authState.user?.role) && checkPermission('settings', 'edit')) || canOpenApprovalQueue) && (
                <button
                  type="button"
                  onClick={() => onTabChange('access-control')}
                  className={`group relative z-10 flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-[13px] font-bold transition-all duration-300 ${
                    activeTab === 'access-control'
                      ? 'bg-slate-900 text-white shadow-md ring-1 ring-slate-900/5'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className={`h-4 w-4 transition-colors duration-300 ${activeTab === 'access-control' ? 'text-white' : 'text-slate-400 group-hover:text-brand'}`} />
                  <span>Access</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="group rounded-lg p-2.5 text-slate-300 transition-all hover:bg-brand/5 hover:text-brand active:scale-90"
            title="Refresh"
            aria-label="Refresh page"
          >
            <RefreshCcw className="h-4.5 w-4.5 transition-transform duration-500 group-hover:rotate-180" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg p-2.5 text-slate-300 transition-all hover:bg-brand/5 hover:text-brand active:scale-90"
            title="Sign Out"
            aria-label="Sign out"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
