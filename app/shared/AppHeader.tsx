import React from 'react';
import { LayoutDashboard, LogOut, RefreshCcw, Settings, ShoppingCart } from 'lucide-react';
import { AuthState } from '../../types';
import { clientConfig, isModuleEnabled } from '../../config/clientConfig';

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
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  authState,
  activeTab = null,
  isWarehouse = false,
  canOpenDashboard = isModuleEnabled('reports'),
  checkPermission,
  onNavigateHome,
  onTabChange,
  onLogout
}) => {
  const canOpenApprovalQueue = authState.user?.role === 'admin' || authState.user?.role === 'owner';
  const canShowSwitcher =
    !!onTabChange &&
    !!checkPermission &&
    (activeTab === 'pos' || activeTab === 'dashboard' || activeTab === 'settings') &&
    !isWarehouse;

  return (
    <header className="sticky top-0 z-[120] min-h-[72px] border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl print:hidden">
      <div className="mx-auto flex min-h-[72px] max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-8">
        <div className="flex min-w-0 items-center overflow-hidden">
          <button
            type="button"
            onClick={onNavigateHome}
            className="group flex shrink-0 items-center space-x-4 rounded-lg text-left focus-ring"
            aria-label="Back to operations modules"
          >
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-brand shadow-sm transition-transform duration-300 group-hover:scale-105">
              <img src={clientConfig.logoUrl} alt={`${clientConfig.clientName} logo`} className="h-full w-full object-cover" />
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
            <div className="flex rounded-lg border border-slate-200/50 bg-slate-100/60 p-1">
              {isModuleEnabled('sales') && (checkPermission('lost_sales') || checkPermission('shortages')) && (
                <button
                  type="button"
                  onClick={() => onTabChange('pos')}
                  className={`flex items-center space-x-2 rounded-md px-4 py-2 text-xs font-bold transition-all duration-200 ${activeTab === 'pos' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span>Items Entry</span>
                </button>
              )}
              {canOpenDashboard && (
                <button
                  type="button"
                  onClick={() => onTabChange('dashboard')}
                  className={`flex items-center space-x-2 rounded-md px-4 py-2 text-xs font-bold transition-all duration-200 ${activeTab === 'dashboard' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>Dashboard</span>
                </button>
              )}
              {isModuleEnabled('settings') && ((authState.user?.role === 'manager' && checkPermission('settings', 'edit')) || canOpenApprovalQueue) && (
                <button
                  type="button"
                  onClick={() => onTabChange('settings')}
                  className={`flex items-center space-x-2 rounded-md px-4 py-2 text-xs font-bold transition-all duration-200 ${activeTab === 'settings' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Settings</span>
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
