import React, { useState } from 'react';
import {
  ShieldCheck,
  BarChart3,
  ClipboardCheck,
  Building2,
  UserCheck,
  ArrowLeft,
  Sparkles,
  Download,
  CheckCircle2
} from 'lucide-react';
import { AdminTQPHDashboardView } from './AdminTQPHDashboardView';
import { SupervisorEvaluationFlow } from './SupervisorEvaluationFlow';
import { BranchInspectionsView } from './BranchInspectionsView';
import { PharmacistPerformanceView } from './PharmacistPerformanceView';
import { User } from '../../types';

export type TQPHViewTab = 'admin' | 'supervisor' | 'branch' | 'pharmacist';

interface TQPHHubViewProps {
  initialTab?: TQPHViewTab;
  currentUser?: User;
  onBackToModules?: () => void;
  className?: string;
}

/**
 * TQPH Unified Hub View (Section 7.3)
 * Provides master shell navigation across all 4 core views of the
 * Tabarak Quality & Performance Hub:
 * 1. /admin/tqph-dashboard (Executive Command Board)
 * 2. /supervisor/audits/new (Supervisor 4-Tab Evaluation Flow)
 * 3. /branch/inspections (Branch Manager Portal & CAPA Action Center)
 * 4. /pharmacist/performance (Pharmacist Personal Portal)
 */
export const TQPHHubView: React.FC<TQPHHubViewProps> = ({
  initialTab = 'admin',
  currentUser,
  onBackToModules,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<TQPHViewTab>(currentUser?.role === 'supervisor' ? 'supervisor' : initialTab);
  const [targetBranchId, setTargetBranchId] = useState<string | undefined>();
  const [targetPharmacistId, setTargetPharmacistId] = useState<string | undefined>();

  // Navigation callbacks between views
  const handleNavigateToBranch = (branchId: string) => {
    setTargetBranchId(branchId);
    setActiveTab('branch');
  };

  const handleNavigateToPharmacist = (pharmacistId: string) => {
    setTargetPharmacistId(pharmacistId);
    setActiveTab('pharmacist');
  };

  if (!currentUser?.id) {
    return <div role="alert" className="p-6 text-sm text-red-800">Sign in to use TQPH.</div>;
  }

  return (
    <div className={`min-h-screen bg-slate-50/60 text-slate-900 font-sans selection:bg-red-100 ${className}`}>
      {/* ── Top Master Header & Navigation Shell ──────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Left: Branding & Back to Modules Button */}
          <div className="flex items-center gap-3">
            {onBackToModules && (
              <button
                type="button"
                onClick={onBackToModules}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-all text-xs font-bold flex items-center gap-1.5 shadow-xs"
                title="Return to TabarakHub Main Suite"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Suite Modules</span>
              </button>
            )}

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-700 text-white flex items-center justify-center shadow-sm shadow-red-700/20 flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black tracking-tight text-slate-950 uppercase">
                    Tabarak Quality & Performance Hub
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-black uppercase tracking-wider border border-slate-200">
                    TQPH
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500 hidden sm:block">
                  NHRA audit records and staff performance
                </p>
              </div>
            </div>
          </div>

          {/* Right: 4-View Switcher Bar */}
          <nav className="inline-flex items-center gap-1 bg-slate-100/90 p-1.5 rounded-xl border border-slate-200 shadow-inner overflow-x-auto">
            {/* View 1: Admin Command Board */}
            {currentUser.role === 'admin' && <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`
                px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap
                ${
                  activeTab === 'admin'
                    ? 'bg-white text-slate-950 shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }
              `}
            >
              <BarChart3 className={`w-3.5 h-3.5 ${activeTab === 'admin' ? 'text-red-700' : 'text-slate-400'}`} />
              <span>Admin Board</span>
            </button>}

            {/* View 2: Supervisor Evaluation Flow */}
            <button
              type="button"
              onClick={() => setActiveTab('supervisor')}
              className={`
                px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap
                ${
                  activeTab === 'supervisor'
                    ? 'bg-white text-slate-950 shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }
              `}
            >
              <ClipboardCheck className={`w-3.5 h-3.5 ${activeTab === 'supervisor' ? 'text-red-700' : 'text-slate-400'}`} />
              <span>Supervisor Flow</span>
            </button>

            {/* View 3: Branch Inspections & CAPA */}
            <button
              type="button"
              onClick={() => setActiveTab('branch')}
              className={`
                px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap
                ${
                  activeTab === 'branch'
                    ? 'bg-white text-slate-950 shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }
              `}
            >
              <Building2 className={`w-3.5 h-3.5 ${activeTab === 'branch' ? 'text-red-700' : 'text-slate-400'}`} />
              <span>Branch & CAPA</span>
            </button>

            {/* View 4: Pharmacist Personal Portal */}
            <button
              type="button"
              onClick={() => setActiveTab('pharmacist')}
              className={`
                px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap
                ${
                  activeTab === 'pharmacist'
                    ? 'bg-white text-slate-950 shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }
              `}
            >
              <UserCheck className={`w-3.5 h-3.5 ${activeTab === 'pharmacist' ? 'text-red-700' : 'text-slate-400'}`} />
              <span>Pharmacist Portal</span>
            </button>
          </nav>
        </div>
      </header>

      {/* ── Active View Body ──────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'admin' && (
          <AdminTQPHDashboardView
            onNavigateToBranch={handleNavigateToBranch}
            onNavigateToPharmacist={handleNavigateToPharmacist}
          />
        )}

        {activeTab === 'supervisor' && (
          <SupervisorEvaluationFlow
            currentUser={currentUser}
            onCompleted={() => setActiveTab(currentUser.role === 'supervisor' ? 'supervisor' : 'admin')}
            onExit={onBackToModules}
          />
        )}

        {activeTab === 'branch' && (
          <BranchInspectionsView
            initialBranchId={targetBranchId}
            onExit={() => setActiveTab(currentUser.role === 'supervisor' ? 'supervisor' : 'admin')}
          />
        )}

        {activeTab === 'pharmacist' && (
          <PharmacistPerformanceView
            initialPharmacistId={targetPharmacistId}
            onExit={() => setActiveTab(currentUser.role === 'supervisor' ? 'supervisor' : 'admin')}
          />
        )}
      </main>
    </div>
  );
};
