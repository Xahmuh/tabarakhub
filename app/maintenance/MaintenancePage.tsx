import React from 'react';
import { Lock, LogOut, ShieldCheck, Wrench } from 'lucide-react';
import { clientConfig } from '../../config/clientConfig';
import { MaintenanceSettings } from '../../types';

interface MaintenancePageProps {
  settings?: MaintenanceSettings | null;
  onAdminAccess?: () => void;
  onSignOut?: () => void;
  userLabel?: string;
}

export const MaintenancePage: React.FC<MaintenancePageProps> = ({
  settings,
  onAdminAccess,
  onSignOut,
  userLabel
}) => {
  const title = settings?.maintenanceTitle || 'Tabarak Hub is under maintenance';
  const message = settings?.maintenanceMessage || 'We are making a few improvements. Please check back shortly.';

  return (
    <div className="min-h-screen bg-[#fafafa] px-5 py-8 selection:bg-brand/10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col justify-between gap-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-brand shadow-sm shadow-brand/20">
              <img src={clientConfig.logoUrl} alt={`${clientConfig.clientName} logo`} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-tight text-slate-950">{clientConfig.appName}</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{clientConfig.clientName}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700 sm:flex">
            <Wrench className="h-3.5 w-3.5" />
            Maintenance
          </div>
        </header>

        <main className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-lg border border-brand/10 bg-brand/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-brand">
              <ShieldCheck className="h-4 w-4" />
              System pause
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-black tracking-tight text-slate-950 md:text-6xl">{title}</h1>
              <p className="max-w-2xl text-base font-medium leading-8 text-slate-500 md:text-lg">{message}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {onAdminAccess && (
                <button onClick={onAdminAccess} className="btn-primary text-[10px] uppercase tracking-widest">
                  <Lock className="h-4 w-4" />
                  Admin access
                </button>
              )}
              {onSignOut && (
                <button onClick={onSignOut} className="btn-secondary text-[10px] uppercase tracking-widest">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              )}
            </div>
            {userLabel && (
              <p className="text-xs font-bold text-slate-400">
                Signed in as <span className="text-slate-600">{userLabel}</span>. Maintenance access is limited to administrators.
              </p>
            )}
          </section>

          <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-5">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Temporarily offline</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand text-white shadow-sm shadow-brand/20">
                  <Wrench className="h-6 w-6" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                  <div className="h-full w-2/3 rounded-full bg-brand"></div>
                </div>
                <p className="text-sm font-medium leading-6 text-slate-500">
                  The operations team is working on the system. Branch and public workflows will resume once maintenance mode is switched off.
                </p>
              </div>
            </div>
          </aside>
        </main>

        <footer className="text-xs font-bold text-slate-400">
          Need help? Contact <span className="text-slate-600">{clientConfig.supportEmail}</span>
        </footer>
      </div>
    </div>
  );
};
