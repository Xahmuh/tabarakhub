import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  ListChecks,
  PackageX,
  RefreshCcw,
  ClipboardList,
  TrendingDown
} from 'lucide-react';
import { Branch } from '../../types';
import { BackToModulesButton } from '../shared';
import { useCommandCenterSummary } from './useCommandCenterSummary';
import { operationsTaskService } from './operationsTaskService';
import { exportYesterdayLostSales, exportYesterdayOperationsPack, exportYesterdayShortages } from './yesterdayExports';
import { ActionQueueItem, ActionQueueStatus, CommandCenterSeverity, CommandCenterSourceModule } from './types';
import { isManagerRole } from '../../lib/access';
import { isModuleEnabled } from '../../config/clientConfig';
import { BranchCoverageMapWidget } from './BranchCoverageMapWidget';
import { formatBhdWithCurrency } from '../../utils/money';

interface DailyCommandCenterProps {
  user: Branch | null;
  onNavigate?: (tab: any) => void;
}

const severityClasses: Record<CommandCenterSeverity, string> = {
  critical: 'bg-red-50 text-red-700 border-red-100',
  high: 'bg-amber-50 text-amber-700 border-amber-100',
  medium: 'bg-blue-50 text-blue-700 border-blue-100',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-100'
};

const sourceToTab: Partial<Record<CommandCenterSourceModule, string>> = {
  shortages: 'dashboard',
  lost_sales: 'dashboard',
  cash_tracker: 'cash-tracker',
  cash_flow: 'cash-flow',
  hr: 'hr-manager',
  quality_feedback: 'feedback-admin',
  spin_win: 'spin-win',
  delivery_coverage: 'delivery'
};

const sourceLabels: Record<CommandCenterSourceModule, string> = {
  shortages: 'Shortages',
  lost_sales: 'Lost Sales',
  cash_tracker: 'Cash',
  cash_flow: 'Cash Flow',
  hr: 'HR',
  quality_feedback: 'Feedback',
  spin_win: 'Rewards',
  delivery_coverage: 'Delivery'
};

const formatTime = (value?: string) => {
  if (!value) return 'Now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Now';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatGeneratedAt = (value?: string) => {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

const statusOptions: ActionQueueStatus[] = ['open', 'in_progress', 'resolved', 'dismissed'];

const EmptyState: React.FC<{ title: string; detail: string }> = ({ title, detail }) => (
  <div className="empty-state min-h-[150px]">
    <div className="empty-state-icon">
      <CheckCircle2 className="w-5 h-5" />
    </div>
    <p className="empty-state-title">{title}</p>
    <p className="empty-state-desc">{detail}</p>
  </div>
);

const metricToneClasses = {
  brand: 'border-brand/15 bg-brand/5 text-brand',
  red: 'border-red-100 bg-red-50 text-red-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-500'
};

const CommandMetric: React.FC<{
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
  tone?: keyof typeof metricToneClasses;
}> = ({ label, value, detail, icon, tone = 'slate' }) => (
  <div className="bg-white p-4 md:p-5">
    <div className="flex items-center justify-between gap-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${metricToneClasses[tone]}`}>
        {icon}
      </span>
    </div>
    <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
    <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
  </div>
);

type YesterdayExportType = 'lost-sales' | 'shortages' | 'pack';

const formatBhd = (value: number) => formatBhdWithCurrency(value);
const formatCount = (value: number) => new Intl.NumberFormat().format(Number(value || 0));

export const DailyCommandCenter: React.FC<DailyCommandCenterProps> = ({ user, onNavigate }) => {
  const { summary, isLoading, refresh } = useCommandCenterSummary(user);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState<YesterdayExportType | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [statusDialog, setStatusDialog] = useState<{
    action: ActionQueueItem;
    status: ActionQueueStatus;
    comment: string;
  } | null>(null);
  const canManageTasks = isManagerRole(user?.role);
  const canCreateTasks = canManageTasks;
  const digest = summary.yesterdayDigest;
  const isBranchUser = user?.role === 'branch';
  const showDeliveryMap = Boolean(user && isModuleEnabled('delivery'));
  const activeActionCount = summary.actionQueue.filter(action => action.status === 'open' || action.status === 'in_progress').length;
  const criticalSignalCount = (digest?.criticalShortageCount || 0) + (digest?.outOfStockCount || 0);
  const recoveryFocusItems = [
    ...(digest?.topLostItems || []).map(item => ({
      id: `lost-${item.name}`,
      type: 'Lost sales',
      name: item.name,
      metric: formatBhd(item.value || 0),
      detail: `${formatCount(item.count)} units lost yesterday`,
      reason: 'Recover demand',
      tone: 'border-brand/10 bg-brand/5 text-brand'
    })),
    ...(digest?.topShortageItems || []).map(item => ({
      id: `shortage-${item.name}`,
      type: 'Shortage',
      name: item.name,
      metric: item.status || 'Shortage',
      detail: `${formatCount(item.count)} shortage reports yesterday`,
      reason: item.status === 'Out of Stock' ? 'Urgent stock action' : 'Stock follow-up',
      tone: item.status === 'Out of Stock'
        ? 'border-red-100 bg-red-50 text-red-700'
        : 'border-amber-100 bg-amber-50 text-amber-700'
    }))
  ].slice(0, 6);

  const canUpdateSavedTask = (action: ActionQueueItem) => {
    if (!action.taskId) return false;
    if (canManageTasks) return true;
    return user?.role === 'branch'
      && action.branchId === user.id
      && action.status !== 'resolved'
      && action.status !== 'dismissed';
  };

  const getStatusOptions = (action: ActionQueueItem): ActionQueueStatus[] => {
    if (canManageTasks) return statusOptions;
    if (action.status === 'open') return ['open', 'in_progress', 'resolved', 'dismissed'];
    if (action.status === 'in_progress') return ['in_progress', 'open', 'resolved', 'dismissed'];
    return [action.status];
  };

  const openModule = (sourceModule: CommandCenterSourceModule) => {
    const tab = sourceToTab[sourceModule];
    if (tab) onNavigate?.(tab);
  };

  const openYesterdayDashboard = () => {
    sessionStorage.setItem('tabarak_dashboard_view', 'standard');
    sessionStorage.setItem('tabarak_dashboard_date_filter', 'yesterday');
    onNavigate?.('dashboard');
  };

  const handleYesterdayExport = async (type: YesterdayExportType) => {
    if (!user) return;

    setExportBusy(type);
    setNotice(null);
    try {
      if (type === 'lost-sales') {
        const count = await exportYesterdayLostSales(user);
        setNotice({ type: 'success', message: `Lost sales export ready (${count} records).` });
      } else if (type === 'shortages') {
        const count = await exportYesterdayShortages(user);
        setNotice({ type: 'success', message: `Shortage export ready (${count} records).` });
      } else {
        const result = await exportYesterdayOperationsPack(user);
        setNotice({
          type: 'success',
          message: `Yesterday pack ready (${result.lostSalesCount} lost sales, ${result.shortageCount} shortages).`
        });
      }
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setExportBusy(null);
    }
  };

  const handleCreateTaskFromAction = async (action: ActionQueueItem) => {
    const alert = summary.alerts.find(item =>
      item.id === action.relatedAlertId
      || (
        item.sourceModule === action.sourceModule
        && item.title === action.title
        && (item.relatedRecordId || null) === (action.relatedRecordId || null)
        && (item.relatedRecordType || null) === (action.relatedRecordType || null)
      )
    );
    if (!alert) return;

    setBusyId(`create-${action.id}`);
    setNotice(null);
    try {
      const task = await operationsTaskService.createTaskFromAlert(alert);
      setNotice({ type: 'success', message: `Saved task: ${task.title}` });
      await refresh();
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusyId(null);
    }
  };

  const handleStatusChange = (action: ActionQueueItem, status: ActionQueueStatus) => {
    if (!action.taskId || action.status === status) return;
    setStatusDialog({ action, status, comment: '' });
  };

  const submitStatusChange = async () => {
    if (!statusDialog?.action.taskId) return;
    const { action, status, comment } = statusDialog;
    const normalizedComment = comment.trim() || undefined;
    setBusyId(`status-${action.taskId}`);
    setNotice(null);
    try {
      await operationsTaskService.updateTaskStatus({ taskId: action.taskId, status, comment: normalizedComment });
      setNotice({ type: 'success', message: `Task marked ${status.replace('_', ' ')}` });
      setStatusDialog(null);
      await refresh();
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mb-8 space-y-5 page-enter">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm shadow-brand/20">
                <Activity className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">Operations module</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Daily Command Center</h2>
                <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
                  Morning brief for yesterday performance, delivery coverage, and the few actions worth following today.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:justify-end">
              <span className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                Updated {formatGeneratedAt(summary.generatedAt)}
              </span>
              <BackToModulesButton onClick={() => onNavigate?.('selector')} />
              <button
                type="button"
                onClick={refresh}
                disabled={isLoading}
                className="btn-secondary text-xs"
              >
                <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-slate-100 md:grid-cols-4">
          <CommandMetric
            label="Yesterday lost sales"
            value={formatCount(digest?.lostSalesCount || 0)}
            detail={formatBhd(digest?.lostSalesValue || 0)}
            icon={<TrendingDown className="h-4 w-4" />}
            tone={(digest?.lostSalesCount || 0) > 0 ? 'red' : 'emerald'}
          />
          <CommandMetric
            label="Yesterday shortages"
            value={formatCount(digest?.shortageCount || 0)}
            detail={`${formatCount(criticalSignalCount)} critical signals`}
            icon={<PackageX className="h-4 w-4" />}
            tone={criticalSignalCount > 0 ? 'amber' : 'slate'}
          />
          <CommandMetric
            label="Recovery focus"
            value={recoveryFocusItems.length}
            detail="top items to recover"
            icon={<ListChecks className="h-4 w-4" />}
            tone="brand"
          />
          <CommandMetric
            label="Operations inbox"
            value={activeActionCount}
            detail={`${summary.actionQueue.length} total items`}
            icon={<ClipboardList className="h-4 w-4" />}
            tone={activeActionCount > 0 ? 'amber' : 'emerald'}
          />
        </div>
      </div>

      {summary.dataWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          {summary.dataWarnings.slice(0, 2).join(' | ')}
        </div>
      )}

      {notice && (
        <div className={`rounded-lg border p-4 text-sm font-bold ${notice.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
          {notice.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={`${showDeliveryMap ? 'xl:col-span-5' : 'xl:col-span-12'} rounded-lg border border-slate-200 bg-white p-5 shadow-sm`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                <FileSpreadsheet className="h-4 w-4" />
                Yesterday branch pack
              </div>
              <h4 className="mt-2 text-xl font-black tracking-tight text-slate-950">
                Download your lost sales and shortage yesterday
              </h4>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-500">
                {digest
                  ? `${digest.branchName} | ${digest.dateLabel}`
                  : 'Preparing yesterday scope...'}
                {isBranchUser ? ' | branch-only file access' : ' | manager visible scope'}
              </p>
            </div>
            <span className="w-fit rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
              {digest?.scope === 'branch' ? 'Branch standalone' : 'All visible'}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Lost sales</p>
                <TrendingDown className="h-4 w-4 text-brand" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">{formatCount(digest?.lostSalesCount || 0)}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-500">{formatBhd(digest?.lostSalesValue || 0)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Shortage</p>
                <PackageX className="h-4 w-4 text-brand" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">{formatCount(digest?.shortageCount || 0)}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-500">
                {formatCount((digest?.criticalShortageCount || 0) + (digest?.outOfStockCount || 0))} critical signals
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => handleYesterdayExport('lost-sales')}
              disabled={!user || isLoading || exportBusy !== null}
              className="btn-secondary px-3 py-2 text-xs"
            >
              <Download className="h-4 w-4" />
              {exportBusy === 'lost-sales' ? 'Preparing...' : 'Lost sales'}
            </button>
            <button
              type="button"
              onClick={() => handleYesterdayExport('shortages')}
              disabled={!user || isLoading || exportBusy !== null}
              className="btn-secondary px-3 py-2 text-xs"
            >
              <Download className="h-4 w-4" />
              {exportBusy === 'shortages' ? 'Preparing...' : 'Shortage'}
            </button>
            <button
              type="button"
              onClick={() => handleYesterdayExport('pack')}
              disabled={!user || isLoading || exportBusy !== null}
              className="btn-primary px-3 py-2 text-xs"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {exportBusy === 'pack' ? 'Preparing...' : 'Day pack'}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={openYesterdayDashboard}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-brand/30 hover:bg-brand/5 focus-ring"
              >
                <p className="text-xs font-black uppercase tracking-widest text-slate-700">Open yesterday performance</p>
              </button>
              {isBranchUser && (
                <button
                  type="button"
                  onClick={() => onNavigate?.('pos')}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-brand/30 hover:bg-brand/5 focus-ring"
                >
                  <p className="text-xs font-black uppercase tracking-widest text-slate-700">Log today's lost sales or shortage</p>
                </button>
              )}
          </div>
        </div>

        {showDeliveryMap && (
          <div className="xl:col-span-7">
            <BranchCoverageMapWidget user={user} onOpenDelivery={() => onNavigate?.('delivery')} />
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-brand">
              <ListChecks className="h-4 w-4" />
              Yesterday recovery focus
            </div>
            <h4 className="mt-2 text-xl font-black tracking-tight text-slate-950">Items worth recovering first</h4>
            <p className="mt-1.5 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
              Top lost-demand and shortage signals from yesterday, reduced to a short working list.
            </p>
          </div>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
            {recoveryFocusItems.length} focus items
          </span>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="h-28 rounded-lg bg-slate-100 animate-pulse" />
          ) : recoveryFocusItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recoveryFocusItems.map(item => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wider ${item.tone}`}>
                      {item.type}
                    </span>
                    <span className="rounded-md bg-white px-2 py-1 text-[10px] font-black text-slate-700 shadow-sm">
                      {item.metric}
                    </span>
                  </div>
                  <p className="text-sm font-black leading-5 text-slate-950">{item.name}</p>
                  <p className="mt-2 text-xs font-bold text-slate-500">{item.detail}</p>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-brand">{item.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No recovery focus" detail="Yesterday has no lost-sales or shortage signals in this scope." />
          )}
        </div>
      </div>

      <div className="operational-panel p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-brand">
              <ClipboardList className="h-4 w-4" />
              Operations inbox
            </div>
            <h4 className="mt-2 text-xl font-black tracking-tight text-slate-950">Open work that needs a decision</h4>
            <p className="mt-1.5 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
              Saved tasks and suggested alerts are merged here so the daily page has one action list.
            </p>
          </div>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
            {activeActionCount} active
          </span>
        </div>

        {isLoading ? (
          <div className="h-32 rounded-lg bg-slate-100 animate-pulse" />
        ) : summary.actionQueue.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {summary.actionQueue.slice(0, 8).map(action => {
              const canUpdateStatus = canUpdateSavedTask(action);
              const actionStatusOptions = getStatusOptions(action);
              const canSaveSuggestedAction = canCreateTasks && action.queueSource !== 'saved_task';
              return (
                <div key={action.id} className="rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-brand/30">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${action.queueSource === 'saved_task' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                        {action.queueSource === 'saved_task' ? 'saved task' : 'suggested'}
                      </span>
                      <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${severityClasses[action.priority]}`}>
                        {action.priority}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-black uppercase text-slate-500">
                        {sourceLabels[action.sourceModule]}
                      </span>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${severityClasses[action.severity]}`}>
                      {action.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-black text-slate-950">{action.title}</p>
                  <p className="mt-2 text-xs font-medium leading-5 text-slate-500">{action.nextStep}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-400">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatTime(action.createdAt)}</span>
                    {action.branchName && <span>{action.branchName}</span>}
                    {(action.ownerRole || action.owner) && <span>{action.ownerRole || action.owner}</span>}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => openModule(action.sourceModule)} className="btn-secondary px-3 py-2 text-xs">
                      Open source
                    </button>
                    {canSaveSuggestedAction && (
                      <button
                        type="button"
                        onClick={() => handleCreateTaskFromAction(action)}
                        disabled={busyId === `create-${action.id}`}
                        className="btn-primary px-3 py-2 text-xs"
                      >
                        {busyId === `create-${action.id}` ? 'Saving...' : 'Save task'}
                      </button>
                    )}
                    {canUpdateStatus && (
                      <select
                        aria-label="Update task status"
                        value={action.status}
                        disabled={busyId === `status-${action.taskId}`}
                        onChange={(event) => handleStatusChange(action, event.target.value as ActionQueueStatus)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none hover:bg-slate-50 focus:ring-2 focus:ring-red-200"
                      >
                        {actionStatusOptions.map(status => (
                          <option key={status} value={status}>{status.replace('_', ' ')}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Operations inbox is clear" detail="No saved tasks or suggested actions were found from enabled modules." />
        )}
      </div>
      {statusDialog && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-status-title"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl"
          >
            <div className="border-b border-slate-100 p-5">
              <p id="task-status-title" className="text-sm font-black text-slate-950">Update task status</p>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Mark "{statusDialog.action.title}" as {statusDialog.status.replace('_', ' ')}.
              </p>
            </div>
            <div className="p-5">
              <label className="text-xs font-bold text-slate-600" htmlFor="task-status-comment">
                Optional comment
              </label>
              <textarea
                id="task-status-comment"
                value={statusDialog.comment}
                onChange={(event) => setStatusDialog({ ...statusDialog, comment: event.target.value })}
                className="mt-2 min-h-[110px] w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 outline-none focus:border-red-200 focus:ring-4 focus:ring-red-50"
                placeholder="Add context for the next person reviewing this task..."
              />
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 p-5">
              <button
                type="button"
                onClick={() => setStatusDialog(null)}
                disabled={busyId === `status-${statusDialog.action.taskId}`}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitStatusChange}
                disabled={busyId === `status-${statusDialog.action.taskId}`}
                className="btn-primary"
              >
                {busyId === `status-${statusDialog.action.taskId}` ? 'Saving...' : 'Save status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
