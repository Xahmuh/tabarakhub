import React from 'react';
import { 
  Activity, Users, FileText, Landmark, Wallet, BookOpen, Settings, LogOut, ShieldCheck, QrCode, MessageSquare, PieChart, Lightbulb
} from 'lucide-react';
import { AuthState } from '../../types';
import { Footer } from '../shared';

interface SuitePageProps {
  authState: AuthState;
  isManager: boolean;
  isAdmin01: boolean;
  isAccounts: boolean;
  isPending: boolean;
  checkPermission: (feature: string) => boolean;
  handleTabChange: (tab: any) => void;
  logout: () => void;
}

export const SuitePage: React.FC<SuitePageProps> = ({
  authState,
  isManager,
  isAdmin01,
  isAccounts,
  isPending,
  checkPermission,
  handleTabChange,
  logout
}) => {
  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col selection:bg-brand/10">
      <div className="flex-1 max-w-[1400px] mx-auto w-full px-6 md:px-10 py-10 lg:py-20">
        <div className="mb-12 page-enter">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-5">
              <div className="w-14 h-14 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/20 overflow-hidden">
                <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-1.5">Operational <span className="text-brand">Suite</span></h2>
                <div className="flex items-center space-x-3">
                  <span className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-[10px] font-bold uppercase tracking-wider">{authState.user?.code}</span>
                  <span className="flex items-center space-x-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span>Connected</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex items-center space-x-4 bg-white p-3 pr-5 rounded-xl border border-slate-100 shadow-sm">
              <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">On Duty</span>
                <span className="text-sm font-bold text-slate-900 leading-none mt-0.5">{isManager ? 'Administrator' : authState.pharmacist?.name}</span>
              </div>
            </div>
          </div>
          <div className="divider-gradient"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 page-enter">
          {/* 1. Global Analytics / Lost Sales */}
          {!isAdmin01 && !isAccounts && (checkPermission('lost_sales') || checkPermission('shortages')) && (
            <button
              onClick={() => handleTabChange('pos')}
              className={`group p-7 rounded-2xl border border-slate-200/80 bg-white transition-all duration-300 text-left flex flex-col justify-between h-[280px] active:scale-[0.98] relative overflow-hidden card-hover hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-brand/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand group-hover:text-white transition-all duration-400 relative z-10 shadow-sm">
                <Activity className="w-6 h-6" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-black mb-1.5 tracking-tight text-slate-900">
                  Lost Sales & Shortage
                </h3>
                <p className="font-medium text-sm leading-relaxed text-slate-400">
                  Log out-of-stock items and customer requested deficits in real-time.
                </p>
              </div>
              <div className="flex items-center space-x-3 relative z-10">
                <div className="h-px bg-brand/60 w-6 group-hover:w-12 transition-all duration-400"></div>
                <span className="text-brand font-bold text-[10px] uppercase tracking-widest">
                  Open Module
                </span>
              </div>
            </button>
          )}

          {/* 2. Performance Portal (Branch) / HR Admin (Manager) */}
          {isManager ? (
            isAdmin01 ? (
              <button
                onClick={() => handleTabChange('dashboard')}
                className={`group p-7 rounded-2xl border border-slate-200/80 bg-white transition-all duration-300 text-left flex flex-col justify-between h-[280px] active:scale-[0.98] relative overflow-hidden card-hover hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-brand/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand group-hover:text-white transition-all duration-400 relative z-10 shadow-sm">
                  <Activity className="w-6 h-6" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-xl font-black text-slate-900 mb-1.5 tracking-tight">Performance Portal</h3>
                  <p className="text-slate-400 font-medium text-sm leading-relaxed">Review localized branch performance and inventory trends.</p>
                </div>
                <div className="flex items-center space-x-3 relative z-10">
                  <div className="h-px bg-brand/60 w-6 group-hover:w-12 transition-all duration-400"></div>
                  <span className="text-brand font-bold text-[10px] uppercase tracking-widest">Open Module</span>
                </div>
              </button>
            ) : (checkPermission('hr_requests') && (
              <button
                onClick={() => handleTabChange('hr-manager')}
                className={`group p-7 rounded-2xl border border-slate-200/80 bg-white transition-all duration-300 text-left flex flex-col justify-between h-[280px] active:scale-[0.98] relative overflow-hidden card-hover hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-brand/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand group-hover:text-white transition-all duration-400 relative z-10 shadow-sm">
                  <Users className="w-6 h-6" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-xl font-black text-slate-900 mb-1.5 tracking-tight">HR Requests Admin</h3>
                  <p className="text-slate-400 font-medium text-sm leading-relaxed">Review incoming employee requests and generate official letterheads.</p>
                </div>
                <div className="flex items-center space-x-3 relative z-10">
                  <div className="h-px bg-brand/60 w-6 group-hover:w-12 transition-all duration-400"></div>
                  <span className="text-brand font-bold text-[10px] uppercase tracking-widest">Open Module</span>
                </div>
              </button>
            ))
          ) : (!isAccounts && (checkPermission('lost_sales') || checkPermission('shortages')) && (
            <button
              onClick={() => handleTabChange('dashboard')}
              className={`group p-7 rounded-2xl border border-slate-200/80 bg-white transition-all duration-300 text-left flex flex-col justify-between h-[280px] active:scale-[0.98] relative overflow-hidden card-hover hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-brand/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand group-hover:text-white transition-all duration-400 relative z-10 shadow-sm">
                <Activity className="w-6 h-6" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-black text-slate-900 mb-1.5 tracking-tight">Performance Portal</h3>
                <p className="text-slate-400 font-medium text-sm leading-relaxed">Review localized branch performance and inventory trends.</p>
              </div>
              <div className="flex items-center space-x-3 relative z-10">
                <div className="h-px bg-brand/60 w-6 group-hover:w-12 transition-all duration-400"></div>
                <span className="text-brand font-bold text-[10px] uppercase tracking-widest">Open Module</span>
              </div>
            </button>
          ))}

          {/* 3. Workforce (Manager) / HR Self-Service (Branch) */}
          {isManager ? (!isAdmin01 && authState.user?.role === 'manager' && checkPermission('hr_requests') && (
            <button
              onClick={() => handleTabChange('workforce')}
              className={`group p-7 rounded-2xl border border-slate-200/80 bg-white transition-all duration-300 text-left flex flex-col justify-between h-[280px] active:scale-[0.98] relative overflow-hidden card-hover hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-brand/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand group-hover:text-white transition-all duration-400 relative z-10 shadow-sm">
                <Users className="w-6 h-6" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-black text-slate-900 mb-1.5 tracking-tight">Workforce Analytics</h3>
                <p className="text-slate-400 font-medium text-sm leading-relaxed">Optimize staffing levels and calculate relief requirements.</p>
              </div>
              <div className="flex items-center space-x-3 relative z-10">
                <div className="h-px bg-brand/60 w-6 group-hover:w-12 transition-all duration-400"></div>
                <span className="text-brand font-bold text-[10px] uppercase tracking-widest">Open Module</span>
              </div>
            </button>
          )) : (!isAccounts && checkPermission('hr_requests') && (
            <button
              onClick={() => handleTabChange('hr')}
              className={`group p-7 rounded-2xl border border-slate-200/80 bg-white transition-all duration-300 text-left flex flex-col justify-between h-[280px] active:scale-[0.98] relative overflow-hidden card-hover hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-brand/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand group-hover:text-white transition-all duration-400 relative z-10 shadow-sm">
                <FileText className="w-6 h-6" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-black text-slate-900 mb-1.5 tracking-tight">HR Self-Service</h3>
                <p className="text-slate-400 font-medium text-sm leading-relaxed">Request official documents and certificates directly through our portal.</p>
              </div>
              <div className="flex items-center space-x-3 relative z-10">
                <div className="h-px bg-brand/60 w-6 group-hover:w-12 transition-all duration-400"></div>
                <span className="text-brand font-bold text-[10px] uppercase tracking-widest">Open Module</span>
              </div>
            </button>
          ))}

          {/* 4. Cash Flow (Manager) / Cash Tracker (Both) */}
          {isManager ? (!isAdmin01 && checkPermission('cash_flow') && (
            <button
              onClick={() => handleTabChange('cash-flow')}
              className={`group p-7 rounded-2xl border border-slate-200/80 bg-white transition-all duration-300 text-left flex flex-col justify-between h-[280px] active:scale-[0.98] relative overflow-hidden card-hover hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-brand/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand group-hover:text-white transition-all duration-400 relative z-10 shadow-sm">
                <Landmark className="w-6 h-6" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-black text-slate-900 mb-1.5 tracking-tight">Cash Flow Planner</h3>
                <p className="text-slate-400 font-medium text-sm leading-relaxed">Liquidity forecasting, expense planning, and financial risk monitoring.</p>
              </div>
              <div className="flex items-center space-x-3 relative z-10">
                <div className="h-px bg-brand/60 w-6 group-hover:w-12 transition-all duration-400"></div>
                <span className="text-brand font-bold text-[10px] uppercase tracking-widest">Open Module</span>
              </div>
            </button>
          )) : (checkPermission('cash_tracker') && (
            <button
              onClick={() => handleTabChange('cash-tracker')}
              className={`group p-7 rounded-2xl border border-slate-200/80 bg-white transition-all duration-300 text-left flex flex-col justify-between h-[280px] active:scale-[0.98] relative overflow-hidden card-hover hover:border-slate-800/30 hover:shadow-xl hover:shadow-slate-800/5 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-slate-800 group-hover:text-white transition-all duration-400 relative z-10 shadow-sm">
                <Wallet className="w-6 h-6" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-black text-slate-900 mb-1.5 tracking-tight">Branch Cash Tracker</h3>
                <p className="text-slate-400 font-medium text-sm leading-relaxed">Log and track daily cash discrepancies between POS and cash count.</p>
              </div>
              <div className="flex items-center space-x-3 relative z-10">
                <div className="h-px bg-slate-800/60 w-6 group-hover:w-12 transition-all duration-400"></div>
                <span className="text-slate-800 font-bold text-[10px] uppercase tracking-widest">Open Module</span>
              </div>
            </button>
          ))}

          {/* 5. Corporate Codex */}
          {!isAdmin01 && !isAccounts && checkPermission('corporate_codex') && (
            <button
              onClick={() => handleTabChange('corporate-codex')}
              className={`group p-7 rounded-2xl border border-slate-200/80 bg-white transition-all duration-300 text-left flex flex-col justify-between h-[280px] active:scale-[0.98] relative overflow-hidden card-hover hover:border-slate-900/30 hover:shadow-xl hover:shadow-slate-900/5 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all duration-400 relative z-10 shadow-sm">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-black text-slate-900 mb-1.5 tracking-tight">Corporate Codex</h3>
                <p className="text-slate-400 font-medium text-sm leading-relaxed">Official policies, administrative circulars, and standard protocols.</p>
              </div>
              <div className="flex items-center space-x-3 relative z-10">
                <div className="h-px bg-slate-900/60 w-6 group-hover:w-12 transition-all duration-400"></div>
                <span className="text-slate-900 font-bold text-[10px] uppercase tracking-widest">Open Module</span>
              </div>
            </button>
          )}

          {/* 6. Settings (Manager Only) */}
          {!isAdmin01 && authState.user?.role === 'manager' && checkPermission('settings') && (
            <button
              onClick={() => handleTabChange('settings')}
              className={`group p-7 rounded-2xl border border-slate-200/80 bg-white transition-all duration-300 text-left flex flex-col justify-between h-[280px] active:scale-[0.98] relative overflow-hidden card-hover hover:border-slate-800/30 hover:shadow-xl hover:shadow-slate-800/5 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-slate-800 group-hover:text-white transition-all duration-400 relative z-10 shadow-sm">
                <Settings className="w-6 h-6" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-black text-slate-900 mb-1.5 tracking-tight">Infrastructure Control</h3>
                <p className="text-slate-400 font-medium text-sm leading-relaxed">Manage branches, personnel credentials, and system permissions.</p>
              </div>
              <div className="flex items-center space-x-3 relative z-10">
                <div className="h-px bg-slate-800/60 w-6 group-hover:w-12 transition-all duration-400"></div>
                <span className="text-slate-800 font-bold text-[10px] uppercase tracking-widest">Open Module</span>
              </div>
            </button>
          )}

          {/* 7. Spin & Win */}
          {!isAdmin01 && !isAccounts && checkPermission('spin_win') && (
            <button
              onClick={() => handleTabChange('spin-win')}
              className={`group p-7 rounded-2xl border border-slate-200/80 bg-white transition-all duration-300 text-left flex flex-col justify-between h-[280px] active:scale-[0.98] relative overflow-hidden card-hover hover:border-slate-900/30 hover:shadow-xl hover:shadow-slate-900/5 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all duration-400 relative z-10 shadow-sm">
                <QrCode className="w-6 h-6" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-black text-slate-900 mb-1.5 tracking-tight">{isManager ? 'Reward Control' : 'Spin & Win'}</h3>
                <p className="text-slate-400 font-medium text-sm leading-relaxed">Generate QR tokens for the customer reward wheel.</p>
              </div>
              <div className="flex items-center space-x-3 relative z-10">
                <div className="h-px bg-slate-900/60 w-6 group-hover:w-12 transition-all duration-400"></div>
                <span className="text-slate-900 font-bold text-[10px] uppercase tracking-widest">Open Module</span>
              </div>
            </button>
          )}

          {/* 8. QC Insights (All Users) */}
          <button
            onClick={() => handleTabChange('feedback-form')}
            className={`group p-7 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 border border-red-400/20 hover:border-white/30 shadow-lg hover:shadow-xl hover:shadow-red-500/20 transition-all duration-300 text-left flex flex-col justify-between h-[280px] active:scale-[0.98] relative overflow-hidden card-hover ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-2xl"></div>
            <div className="flex items-start justify-between relative z-10">
              <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center text-white group-hover:bg-white group-hover:text-red-500 transition-all duration-400 ring-1 ring-white/20 shadow-sm">
                <MessageSquare className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-1 bg-white/20 text-white text-[9px] font-bold uppercase tracking-widest rounded-lg ring-1 ring-white/20">New Module</span>
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-black text-white tracking-tight">QC Insights</h3>
              <p className="text-white/70 font-medium text-sm leading-relaxed mt-1.5">Submit anonymous quality feedback and suggestions.</p>
            </div>
            <div className="flex items-center space-x-3 relative z-10">
              <div className="h-px bg-white/50 w-6 group-hover:w-12 transition-all duration-400"></div>
              <span className="text-white/90 font-bold text-[10px] uppercase tracking-widest">Open Module</span>
            </div>
          </button>

          {/* 9. Feedback Admin (Admin/Manager) */}
          {isManager && (
            <button
              onClick={() => handleTabChange('feedback-admin')}
              className={`group p-7 rounded-2xl border border-slate-200/80 bg-white transition-all duration-300 text-left flex flex-col justify-between h-[280px] active:scale-[0.98] relative overflow-hidden card-hover hover:border-slate-800/30 hover:shadow-xl hover:shadow-slate-800/5 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-slate-800 group-hover:text-white transition-all duration-400 relative z-10 shadow-sm">
                <PieChart className="w-6 h-6" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-black text-slate-900 mb-1.5 tracking-tight">Feedback Admin</h3>
                <p className="text-slate-400 font-medium text-sm leading-relaxed">Analyze quality metrics and review anonymous feedback.</p>
              </div>
              <div className="flex items-center space-x-3 relative z-10">
                <div className="h-px bg-slate-800/60 w-6 group-hover:w-12 transition-all duration-400"></div>
                <span className="text-slate-800 font-bold text-[10px] uppercase tracking-widest">Open Module</span>
              </div>
            </button>
          )}

          {/* 10. Employee Contributions */}
          {checkPermission('employee_contributions') && (
            <button
              onClick={() => handleTabChange('employee-contributions')}
              className={`group p-7 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 border border-red-400/20 hover:border-white/30 shadow-lg hover:shadow-xl hover:shadow-red-500/20 transition-all duration-300 text-left flex flex-col justify-between h-[280px] active:scale-[0.98] relative overflow-hidden card-hover ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-2xl"></div>
              <div className="flex items-start justify-between relative z-10">
                <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center text-white group-hover:bg-white group-hover:text-red-500 transition-all duration-400 ring-1 ring-white/20 shadow-sm">
                  <Lightbulb className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 bg-white/20 text-white text-[9px] font-bold uppercase tracking-widest rounded-lg ring-1 ring-white/20">Knowledge Share</span>
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-black text-white tracking-tight">Employee Contributions</h3>
                <p className="text-white/70 font-medium text-sm leading-relaxed mt-1.5">Discover tools, automations, and projects shared by the team.</p>
              </div>
              <div className="flex items-center space-x-3 relative z-10">
                <div className="h-px bg-white/50 w-6 group-hover:w-12 transition-all duration-400"></div>
                <span className="text-white/90 font-bold text-[10px] uppercase tracking-widest">Open Hub</span>
              </div>
            </button>
          )}
        </div>

        <div className="mt-16 text-center">
          <button
            onClick={logout}
            className="group px-6 py-3 bg-white border border-slate-100 hover:border-red-200 hover:bg-red-50 text-slate-400 hover:text-brand rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center mx-auto space-x-3 shadow-sm"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
      <Footer onNavigate={handleTabChange} permissions={authState.permissions} user={authState.user} />
    </div>
  );
};
