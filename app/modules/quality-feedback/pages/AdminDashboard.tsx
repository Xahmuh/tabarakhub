import React, { useState } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { KPICard } from '../components/dashboard/KPICard';
import { CommentsTable } from '../components/dashboard/CommentsTable';
import { ProtectedRoute } from '../components/shared/ProtectedRoute';
import { DashboardFilters } from '../types/feedback.types';
import { 
  Loader2, 
  Download, 
  Calendar, 
  Users, 
  Briefcase, 
  RefreshCw, 
  Globe, 
  BarChart3, 
  Settings, 
  FileQuestion,
  Search,
  LayoutDashboard,
  AlertTriangle
} from 'lucide-react';

import { AlertBanner } from '../components/dashboard/AlertBanner';
import { TrendChart } from '../components/dashboard/TrendChart';
import { HeatmapGrid } from '../components/dashboard/HeatmapGrid';
import { BarComparison } from '../components/dashboard/BarComparison';
import { ExperienceBreakdown } from '../components/dashboard/ExperienceBreakdown';
import { exportToExcel } from '../utils/exportData';

import { AIInsightsPanel } from '../components/dashboard/AIInsightsPanel';
import { CorrelationCharts } from '../components/dashboard/CorrelationCharts';
import { QuestionManager } from '../components/admin/QuestionManager';
import { ModuleSettingsControl } from '../components/admin/ModuleSettingsControl';

interface Props {
  userRole?: string;
  onBack?: () => void;
}

type Tab = 'analytics' | 'questions' | 'settings';

export const AdminDashboard: React.FC<Props> = ({ userRole, onBack }) => {
  const [activeTab, setActiveTab] = useState<Tab>('analytics');
  const [filters, setFilters] = useState<DashboardFilters>({
    dateFrom: '',
    dateTo: '',
    cluster: 'All',
    role: 'All',
    experience: 'All',
  });

  const { data, questions, isLoading, error, refresh } = useDashboardData(filters);

  const updateFilter = (key: keyof DashboardFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = () => {
    if (data) {
      exportToExcel(data, `Quality_Feedback_Report_${new Date().toISOString().split('T')[0]}`, questions);
    } else {
      alert("No data available to export with current filters.");
    }
  };

  return (
    <ProtectedRoute roles={['admin', 'manager', 'ceo']} userRole={userRole}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Quality Feedback Admin</h2>
            <p className="text-slate-500 font-medium mt-1">Manage questionnaire and monitor satisfaction metrics.</p>
          </div>
          
          <div className="flex items-center gap-3">
            {activeTab === 'analytics' && (
              <button 
                onClick={handleExport}
                disabled={isLoading || !data?.raw_responses?.length}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
            {onBack && (
              <button onClick={onBack} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all">
                Back to Suite
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
              activeTab === 'analytics' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
              activeTab === 'questions' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileQuestion className="w-4 h-4" />
            Questions
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
              activeTab === 'settings' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            Config
          </button>
        </div>

        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AlertBanner show={!!data?.negative_alert} />

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
              {(() => {
                const monthOptions = [];
                const now = new Date();
                for (let i = 0; i < 24; i++) {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  const val = d.toISOString().substring(0, 7); // YYYY-MM
                  const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  monthOptions.push({ val, label });
                }
                return (
                  <>
                    <label className="flex-1 min-w-[180px]">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Month From</span>
                      <select 
                        value={filters.dateFrom} 
                        onChange={e => updateFilter('dateFrom', e.target.value)} 
                        className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-brand focus:ring-brand outline-none appearance-none"
                      >
                        <option value="">Start Month</option>
                        {monthOptions.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                      </select>
                    </label>
                    <label className="flex-1 min-w-[180px]">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Month To</span>
                      <select 
                        value={filters.dateTo} 
                        onChange={e => updateFilter('dateTo', e.target.value)} 
                        className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-brand focus:ring-brand outline-none appearance-none"
                      >
                        <option value="">End Month</option>
                        {monthOptions.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                      </select>
                    </label>
                  </>
                );
              })()}
              <label className="flex-1 min-w-[150px]">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Cluster</span>
                <select value={filters.cluster} onChange={e => updateFilter('cluster', e.target.value)} className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-brand focus:ring-brand outline-none">
                  <option value="All">All Clusters</option>
                  <option value="North Cluster">North Cluster</option>
                  <option value="Central Cluster">Central Cluster</option>
                  <option value="South Cluster">South Cluster</option>
                  <option value="East Cluster">East Cluster</option>
                </select>
              </label>
              <label className="flex-1 min-w-[150px]">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Role</span>
                <select value={filters.role} onChange={e => updateFilter('role', e.target.value)} className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-brand focus:ring-brand outline-none">
                  <option value="All">All Roles</option>
                  <option value="Pharmacist">Pharmacist</option>
                  <option value="Cashier">Cashier</option>
                  <option value="Warehouse Staff">Warehouse Staff</option>
                  <option value="Delivery">Delivery</option>
                  <option value="Supervisor">Supervisor</option>
                </select>
              </label>
              <button onClick={() => setFilters({ dateFrom: '', dateTo: '', cluster: 'All', role: 'All', experience: 'All' })} className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors" title="Reset Filters">
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {error ? (
              <div className="bg-red-50 text-red-600 p-8 rounded-3xl border border-red-200 text-center space-y-4">
                <AlertTriangle className="w-12 h-12 mx-auto opacity-50" />
                <p className="font-bold">{error}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                  <KPICard title="Health Score" score={data?.management_health_score || 0} colorType="health" />
                  <KPICard title="Operations" score={data?.operations_avg || 0} colorType="ops" />
                  <KPICard title="Purchasing" score={data?.purchasing_avg || 0} colorType="pur" />
                  <KPICard title="HR" score={data?.hr_avg || 0} colorType="hr" />
                  <KPICard title="IT" score={data?.it_avg || 0} colorType="it" />
                  <KPICard title="Responses" score={data?.total_responses || 0} colorType="neutral" />
                </div>

                <TrendChart data={data?.monthly_trend} isLoading={isLoading} />

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <HeatmapGrid data={data?.monthly_trend} isLoading={isLoading} />
                  <BarComparison data={data?.by_cluster} isLoading={isLoading} />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <AIInsightsPanel stats={data?.sentiment_stats} onRefresh={refresh} isLoading={isLoading} />
                  <CorrelationCharts data={data?.correlation_data} isLoading={isLoading} />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <ExperienceBreakdown data={data?.by_experience} isLoading={isLoading} />
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[350px]">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-black text-slate-900 tracking-tight">Recent Comments</h3>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                        <input type="text" placeholder="Search..." className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-brand" />
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      {isLoading ? (
                        <div className="animate-pulse space-y-4">
                          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl" />)}
                        </div>
                      ) : (
                        <div className="h-full overflow-y-auto">
                          <CommentsTable comments={data?.comments || []} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <QuestionManager />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <ModuleSettingsControl />
              </div>
              <div className="lg:col-span-2">
                {/* Existing Phase 3 Settings */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-lg font-black text-slate-900 mb-4">Automation Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-sm font-bold text-slate-700">Monthly PDF Report</p>
                        <p className="text-xs text-slate-500">Send to stakeholders on the 1st of every month</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded uppercase">Active</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-sm font-bold text-slate-700">Critical Trend Alert</p>
                        <p className="text-xs text-slate-500">Notify CEO if satisfaction drops &gt;15% month-over-month</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded uppercase">Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};
