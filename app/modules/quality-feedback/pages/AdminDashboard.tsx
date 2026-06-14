import React, { useState } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { KPICard } from '../components/dashboard/KPICard';
import { CommentsTable } from '../components/dashboard/CommentsTable';
import { ProtectedRoute } from '../components/shared/ProtectedRoute';
import { DashboardFilters } from '../types/feedback.types';
import { 
  Download, 
  Calendar, 
  Users, 
  Briefcase, 
  RefreshCw, 
  Globe, 
  BarChart3, 
  Settings, 
  FileQuestion,
  LayoutDashboard,
  AlertTriangle,
  Sparkles
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
import { isModuleEnabled } from '../../../../config/clientConfig';
import { isManagerRole } from '../../../../lib/access';
import { BackToModulesButton } from '../../../shared';

interface Props {
  userRole?: string;
  onBack?: () => void;
}

type Tab = 'analytics' | 'questions' | 'settings';
type AnalyticsSection = 'summary' | 'trends' | 'responses';

export const AdminDashboard: React.FC<Props> = ({ userRole, onBack }) => {
  const [activeTab, setActiveTab] = useState<Tab>('analytics');
  const [activeAnalyticsSection, setActiveAnalyticsSection] = useState<AnalyticsSection>('summary');
  const canManageQuestions = isManagerRole(userRole?.toLowerCase());
  const [filters, setFilters] = useState<DashboardFilters>({
    dateFrom: '',
    dateTo: '',
    cluster: 'All',
    role: 'All',
    experience: 'All',
  });

  const { data, questions, isLoading, error, refresh } = useDashboardData(filters);
  const aiInsightsEnabled = isModuleEnabled('aiInsights');

  const updateFilter = (key: keyof DashboardFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = async () => {
    if (data) {
      await exportToExcel(data, `Quality_Feedback_Report_${new Date().toISOString().split('T')[0]}`, questions);
    } else {
      alert("No data available to export with current filters.");
    }
  };

  const analyticsSections = [
    { id: 'summary' as const, label: 'Summary', icon: LayoutDashboard },
    { id: 'trends' as const, label: 'Trends', icon: BarChart3 },
    { id: 'responses' as const, label: 'Responses', icon: Users },
  ];

  return (
    <ProtectedRoute roles={['admin', 'manager', 'owner', 'ceo']} userRole={userRole}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Quality Feedback Admin</h2>
            <p className="text-slate-500 font-medium mt-1">Manage questionnaire and monitor satisfaction metrics.</p>
          </div>
          
          <div className="flex items-center gap-3">
            {activeTab === 'analytics' && isModuleEnabled('excelExport') && (
              <button 
                onClick={handleExport}
                disabled={isLoading || !data?.raw_responses?.length}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
            {onBack && (
              <BackToModulesButton onClick={onBack} />
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-full overflow-x-auto sm:w-fit">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all whitespace-nowrap ${
              activeTab === 'analytics' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all whitespace-nowrap ${
              activeTab === 'questions' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileQuestion className="w-4 h-4" />
            QC Questions
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all whitespace-nowrap ${
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
            <div className="operational-panel p-4 flex flex-wrap gap-4 items-end">
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
                        className="w-full rounded-lg border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-brand focus:ring-brand outline-none appearance-none"
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
                        className="w-full rounded-lg border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-brand focus:ring-brand outline-none appearance-none"
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
                <select value={filters.cluster} onChange={e => updateFilter('cluster', e.target.value)} className="w-full rounded-lg border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-brand focus:ring-brand outline-none">
                  <option value="All">All Clusters</option>
                  <option value="North Cluster">North Cluster</option>
                  <option value="Central Cluster">Central Cluster</option>
                  <option value="South Cluster">South Cluster</option>
                  <option value="East Cluster">East Cluster</option>
                </select>
              </label>
              <label className="flex-1 min-w-[150px]">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Role</span>
                <select value={filters.role} onChange={e => updateFilter('role', e.target.value)} className="w-full rounded-lg border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-brand focus:ring-brand outline-none">
                  <option value="All">All Roles</option>
                  <option value="Pharmacist">Pharmacist</option>
                  <option value="Cashier">Cashier</option>
                  <option value="Warehouse Staff">Warehouse Staff</option>
                  <option value="Delivery">Delivery</option>
                  <option value="Supervisor">Supervisor</option>
                </select>
              </label>
              <button onClick={() => setFilters({ dateFrom: '', dateTo: '', cluster: 'All', role: 'All', experience: 'All' })} className="h-10 w-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors flex items-center justify-center" title="Reset Filters">
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 p-1 bg-white border border-slate-200 rounded-xl w-full overflow-x-auto sm:w-fit">
              {analyticsSections.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveAnalyticsSection(id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all whitespace-nowrap ${
                    activeAnalyticsSection === id ? 'bg-red-50 text-brand' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {error ? (
              <div className="bg-red-50 text-red-600 p-8 rounded-xl border border-red-200 text-center space-y-4">
                <AlertTriangle className="w-12 h-12 mx-auto opacity-50" />
                <p className="font-bold">{error}</p>
              </div>
            ) : (
              <>
                {activeAnalyticsSection === 'summary' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <KPICard title="Health Score" score={data?.management_health_score || 0} colorType="health" />
                      <KPICard title="Responses" score={data?.total_responses || 0} colorType="neutral" />
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <KPICard title="Operations" score={data?.operations_avg || 0} colorType="ops" />
                      <KPICard title="Purchasing" score={data?.purchasing_avg || 0} colorType="pur" />
                      <KPICard title="HR" score={data?.hr_avg || 0} colorType="hr" />
                      <KPICard title="IT" score={data?.it_avg || 0} colorType="it" />
                    </div>

                    {aiInsightsEnabled ? (
                      <AIInsightsPanel stats={data?.sentiment_stats} onRefresh={refresh} isLoading={isLoading} />
                    ) : (
                      <div className="bg-white p-6 rounded-2xl border border-dashed border-slate-200 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">AI insights disabled</h3>
                            <p className="text-sm font-medium text-slate-500 mt-1">
                              Enable VITE_MODULE_AI_INSIGHTS only after the Supabase function and AI provider secrets are configured for this dedicated-client deployment.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeAnalyticsSection === 'trends' && (
                  <div className="space-y-5">
                    <TrendChart data={data?.monthly_trend} isLoading={isLoading} />

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                      <HeatmapGrid data={data?.monthly_trend} isLoading={isLoading} />
                      <BarComparison data={data?.by_cluster} isLoading={isLoading} />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                      <ExperienceBreakdown data={data?.by_experience} isLoading={isLoading} />
                      <CorrelationCharts data={data?.correlation_data} isLoading={isLoading} />
                    </div>
                  </div>
                )}

                {activeAnalyticsSection === 'responses' && (
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[480px]">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                      <div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">Recent Comments</h3>
                        <p className="text-xs text-slate-500 font-medium">Latest written feedback for the selected filters.</p>
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
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <QuestionManager canManage={canManageQuestions} />
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
