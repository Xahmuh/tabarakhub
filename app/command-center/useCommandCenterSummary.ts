import { useCallback, useEffect, useState } from 'react';
import { branchService } from '../../services/branchService';
import { financeService } from '../../services/financeService';
import { hrService } from '../../services/hrService';
import { saleService } from '../../services/saleService';
import { spinWinService } from '../../services/spinWin';
import { feedbackService } from '../modules/quality-feedback/services/feedbackService';
import { isModuleEnabled } from '../../config/clientConfig';
import { supabaseClient } from '../../lib/supabaseClient';
import { ActualRevenue, Branch, CashDifference, CashFlowSettings, Cheque, ExpectedRevenue, Expense, HRRequest, LostSale, Role, Shortage } from '../../types';
import { operationsTaskService } from './operationsTaskService';
import {
  alertsToActionQueue,
  alertsToTodayRisks,
  buildBranchHealthScores,
  buildPendingItems,
  CashFlowSignalData,
  CommandCenterSourceData,
  FeedbackResponseSignal,
  generateOperationalAlerts,
  SpinSignal
} from './alertGenerators';
import { ActionQueueItem, CommandCenterDigestItem, CommandCenterSummary, OperationsTask, YesterdayBranchDigest } from './types';

const emptySummary = (): CommandCenterSummary => ({
  generatedAt: new Date().toISOString(),
  alerts: [],
  operationsTasks: [],
  yesterdayDigest: null,
  todaysRisks: [],
  actionQueue: [],
  branchHealth: [],
  pendingItems: [],
  dataWarnings: []
});

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const isReadAllRole = (role?: Role) => role === 'manager' || role === 'owner' || role === 'warehouse';
const isManagerRole = (role?: Role) => role === 'manager';
const isFinancialRole = (role?: Role) => role === 'manager' || role === 'owner';

const feedbackFilters = {
  dateFrom: '',
  dateTo: '',
  cluster: 'All',
  role: 'All',
  experience: 'All'
};

const normalizeFeedbackSignals = (rows: unknown[]): FeedbackResponseSignal[] =>
  rows
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map(row => ({
      id: String(row.id || crypto.randomUUID()),
      branch_cluster: typeof row.branch_cluster === 'string' ? row.branch_cluster : undefined,
      submitted_at: typeof row.submitted_at === 'string' ? row.submitted_at : undefined,
      created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
      overall_avg: typeof row.overall_avg === 'number' ? row.overall_avg : undefined,
      sentiment_label: typeof row.sentiment_label === 'string' ? row.sentiment_label : null,
      biggest_issue: typeof row.biggest_issue === 'string' ? row.biggest_issue : null,
      improvement_suggestion: typeof row.improvement_suggestion === 'string' ? row.improvement_suggestion : null,
      best_thing: typeof row.best_thing === 'string' ? row.best_thing : null,
      ratings: typeof row.ratings === 'object' && row.ratings !== null
        ? row.ratings as Record<string, unknown>
        : null
    }));

const normalizeSpinSignals = (rows: unknown[]): SpinSignal[] =>
  rows
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map(row => ({
      id: typeof row.id === 'string' ? row.id : undefined,
      customer_id: typeof row.customer_id === 'string' ? row.customer_id : undefined,
      branch_id: typeof row.branch_id === 'string' ? row.branch_id : undefined,
      voucher_code: typeof row.voucher_code === 'string' ? row.voucher_code : undefined,
      redeemed_at: typeof row.redeemed_at === 'string' ? row.redeemed_at : null,
      created_at: typeof row.created_at === 'string' ? row.created_at : undefined
    }));

type CashFlowFetchResult = CashFlowSignalData & {
  warnings: string[];
  hasAnyData: boolean;
};

const emptyCashFlowSignals = (): CashFlowSignalData => ({
  settings: null,
  cheques: [],
  expenses: [],
  actualRevenues: [],
  expectedRevenues: []
});

const fetchCashFlowSignals = async (): Promise<CashFlowFetchResult> => {
  const [settingsResult, chequesResult, expensesResult, actualResult, expectedResult] = await Promise.allSettled([
    financeService.cashFlow.settings.get(),
    financeService.cashFlow.cheques.list(),
    financeService.cashFlow.expenses.list(),
    financeService.cashFlow.revenuesActual.list(),
    financeService.cashFlow.revenuesExpected.list()
  ]);

  const warnings: string[] = [];
  if (settingsResult.status === 'rejected') warnings.push(`Cash flow settings unavailable: ${toErrorMessage(settingsResult.reason)}`);
  if (chequesResult.status === 'rejected') warnings.push(`Cheque schedule unavailable: ${toErrorMessage(chequesResult.reason)}`);
  if (expensesResult.status === 'rejected') warnings.push(`Expense schedule unavailable: ${toErrorMessage(expensesResult.reason)}`);
  if (actualResult.status === 'rejected') warnings.push(`Actual revenue records unavailable: ${toErrorMessage(actualResult.reason)}`);
  if (expectedResult.status === 'rejected') warnings.push(`Expected revenue records unavailable: ${toErrorMessage(expectedResult.reason)}`);

  const signals: CashFlowSignalData = {
    settings: settingsResult.status === 'fulfilled' ? settingsResult.value as CashFlowSettings : null,
    cheques: chequesResult.status === 'fulfilled' ? chequesResult.value as Cheque[] : [],
    expenses: expensesResult.status === 'fulfilled' ? expensesResult.value as Expense[] : [],
    actualRevenues: actualResult.status === 'fulfilled' ? actualResult.value as ActualRevenue[] : [],
    expectedRevenues: expectedResult.status === 'fulfilled' ? expectedResult.value as ExpectedRevenue[] : []
  };

  return {
    ...signals,
    warnings,
    hasAnyData: Boolean(
      signals.settings
      || signals.cheques.length
      || signals.expenses.length
      || signals.actualRevenues.length
      || signals.expectedRevenues.length
    )
  };
};

const tasksToActionQueue = (tasks: OperationsTask[]): ActionQueueItem[] =>
  tasks.map(task => ({
    id: `task-${task.id}`,
    taskId: task.id,
    title: task.title,
    branchId: task.branchId || undefined,
    branchName: task.branchName || undefined,
    severity: task.severity,
    priority: task.priority,
    recommendedAction: task.recommendedAction || task.nextStep || 'Review and update this saved task.',
    nextStep: task.nextStep || task.recommendedAction || 'Review and update this saved task.',
    owner: task.ownerRole || undefined,
    ownerRole: task.ownerRole || undefined,
    status: task.status,
    sourceModule: task.sourceModule,
    createdAt: task.createdAt,
    dueAt: task.dueAt || undefined,
    relatedRecordId: task.relatedRecordId || undefined,
    relatedRecordType: task.relatedRecordType || undefined,
    queueSource: 'saved_task'
  }));

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYesterdayWindow = () => {
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return {
    start,
    end,
    date: toDateKey(start),
    dateLabel: start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  };
};

const isInsideWindow = (timestamp: string | undefined, start: Date, end: Date) => {
  if (!timestamp) return false;
  const value = new Date(timestamp).getTime();
  return !Number.isNaN(value) && value >= start.getTime() && value <= end.getTime();
};

const summarizeTopLostItems = (sales: LostSale[]): CommandCenterDigestItem[] => {
  const byProduct = new Map<string, { count: number; value: number }>();
  sales.forEach(sale => {
    const name = sale.productName || 'Unnamed item';
    const current = byProduct.get(name) || { count: 0, value: 0 };
    current.count += Number(sale.quantity || 0);
    current.value += Number(sale.totalValue || 0);
    byProduct.set(name, current);
  });

  return Array.from(byProduct.entries())
    .map(([name, stats]) => ({ name, count: stats.count, value: stats.value }))
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
    .slice(0, 3);
};

const summarizeTopShortageItems = (shortages: Shortage[]): CommandCenterDigestItem[] => {
  const byProduct = new Map<string, { count: number; status: string }>();
  shortages.forEach(shortage => {
    const name = shortage.productName || 'Unnamed item';
    const current = byProduct.get(name) || { count: 0, status: shortage.status };
    current.count += 1;
    if (shortage.status === 'Out of Stock' || (shortage.status === 'Critical' && current.status === 'Low')) {
      current.status = shortage.status;
    }
    byProduct.set(name, current);
  });

  return Array.from(byProduct.entries())
    .map(([name, stats]) => ({ name, count: stats.count, status: stats.status }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
};

const buildYesterdayDigest = (
  user: Branch,
  lostSales: LostSale[],
  shortages: Shortage[],
  canReadAll: boolean
): YesterdayBranchDigest => {
  const window = getYesterdayWindow();
  const yesterdaySales = lostSales.filter(sale => isInsideWindow(sale.timestamp, window.start, window.end));
  const yesterdayShortages = shortages.filter(shortage => isInsideWindow(shortage.timestamp, window.start, window.end));

  return {
    date: window.date,
    dateLabel: window.dateLabel,
    scope: canReadAll ? 'all_visible' : 'branch',
    branchId: canReadAll ? null : user.id,
    branchName: canReadAll ? 'All visible branches' : user.name,
    lostSalesCount: yesterdaySales.length,
    lostSalesUnits: yesterdaySales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0),
    lostSalesValue: yesterdaySales.reduce((sum, sale) => sum + Number(sale.totalValue || 0), 0),
    shortageCount: yesterdayShortages.length,
    criticalShortageCount: yesterdayShortages.filter(shortage => shortage.status === 'Critical').length,
    outOfStockCount: yesterdayShortages.filter(shortage => shortage.status === 'Out of Stock').length,
    topLostItems: summarizeTopLostItems(yesterdaySales),
    topShortageItems: summarizeTopShortageItems(yesterdayShortages)
  };
};

export const useCommandCenterSummary = (user: Branch | null) => {
  const [summary, setSummary] = useState<CommandCenterSummary>(() => emptySummary());
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSummary(emptySummary());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const warnings: string[] = [];
    let successfulSignalSources = 0;
    const canReadAll = isReadAllRole(user.role);
    const canReadManagementSignals = isManagerRole(user.role);
    const canReadFinancialSignals = isFinancialRole(user.role);
    const branchScope = canReadAll ? 'all' : user.id;
    const role = user.role;

    const [
      branchesResult,
      shortagesResult,
      lostSalesResult,
      cashResult,
      cashFlowResult,
      hrResult,
      feedbackResult,
      spinResult,
      tasksResult
    ] = await Promise.allSettled([
      canReadAll ? branchService.list() : Promise.resolve([user]),
      isModuleEnabled('sales') ? saleService.shortages.list(branchScope, role) : Promise.resolve([]),
      isModuleEnabled('sales') ? saleService.sales.list(branchScope, role) : Promise.resolve([]),
      isModuleEnabled('cashTracker') ? financeService.cashDifferences.list(branchScope, role) : Promise.resolve([]),
      isModuleEnabled('cashFlow') && canReadFinancialSignals ? fetchCashFlowSignals() : Promise.resolve({ ...emptyCashFlowSignals(), warnings: [], hasAnyData: false }),
      isModuleEnabled('hr') && canReadManagementSignals ? hrService.list() : Promise.resolve([]),
      isModuleEnabled('qualityFeedback') && canReadManagementSignals ? feedbackService.fetchResponses(feedbackFilters) : Promise.resolve([]),
      isModuleEnabled('spinWin') ? spinWinService.spins.list(canReadAll ? {} : { branchId: user.id }) : Promise.resolve([]),
      operationsTaskService.listOpenTasks()
    ]);

    const branches = branchesResult.status === 'fulfilled' && branchesResult.value.length > 0 ? branchesResult.value : [user];
    if (branchesResult.status === 'rejected') warnings.push(`Branches unavailable: ${toErrorMessage(branchesResult.reason)}`);

    const shortages: Shortage[] = shortagesResult.status === 'fulfilled' ? shortagesResult.value : [];
    if (shortagesResult.status === 'fulfilled' && isModuleEnabled('sales')) successfulSignalSources += 1;
    if (shortagesResult.status === 'rejected') warnings.push(`Shortage signals unavailable: ${toErrorMessage(shortagesResult.reason)}`);

    const lostSales: LostSale[] = lostSalesResult.status === 'fulfilled' ? lostSalesResult.value : [];
    if (lostSalesResult.status === 'fulfilled' && isModuleEnabled('sales')) successfulSignalSources += 1;
    if (lostSalesResult.status === 'rejected') warnings.push(`Lost-sales signals unavailable: ${toErrorMessage(lostSalesResult.reason)}`);

    const cashDifferences: CashDifference[] = cashResult.status === 'fulfilled' ? cashResult.value : [];
    if (cashResult.status === 'fulfilled' && isModuleEnabled('cashTracker')) successfulSignalSources += 1;
    if (cashResult.status === 'rejected') warnings.push(`Cash alerts unavailable: ${toErrorMessage(cashResult.reason)}`);

    const cashFlow = cashFlowResult.status === 'fulfilled'
      ? cashFlowResult.value
      : { ...emptyCashFlowSignals(), warnings: [`Cash flow signals unavailable: ${toErrorMessage(cashFlowResult.reason)}`], hasAnyData: false };
    if (cashFlowResult.status === 'fulfilled' && isModuleEnabled('cashFlow') && canReadFinancialSignals && cashFlow.hasAnyData) successfulSignalSources += 1;
    warnings.push(...cashFlow.warnings);

    const hrRequests: HRRequest[] = hrResult.status === 'fulfilled' ? hrResult.value : [];
    if (hrResult.status === 'fulfilled' && isModuleEnabled('hr') && canReadManagementSignals) successfulSignalSources += 1;
    if (hrResult.status === 'rejected') warnings.push(`HR pending items unavailable: ${toErrorMessage(hrResult.reason)}`);

    const feedbackResponses = feedbackResult.status === 'fulfilled'
      ? normalizeFeedbackSignals(feedbackResult.value as unknown[])
      : [];
    if (feedbackResult.status === 'fulfilled' && isModuleEnabled('qualityFeedback') && canReadManagementSignals) successfulSignalSources += 1;
    if (feedbackResult.status === 'rejected') warnings.push(`Quality feedback signals unavailable: ${toErrorMessage(feedbackResult.reason)}`);

    const spinRecords = spinResult.status === 'fulfilled'
      ? normalizeSpinSignals(spinResult.value as unknown[])
      : [];
    if (spinResult.status === 'fulfilled' && isModuleEnabled('spinWin')) successfulSignalSources += 1;
    if (spinResult.status === 'rejected') warnings.push(`Spin & Win signals unavailable: ${toErrorMessage(spinResult.reason)}`);

    const operationsTasks = tasksResult.status === 'fulfilled' ? tasksResult.value : [];
    if (tasksResult.status === 'rejected') warnings.push(`Saved operations tasks unavailable: ${toErrorMessage(tasksResult.reason)}`);

    const sourceData: CommandCenterSourceData = {
      branches,
      shortages,
      lostSales,
      cashDifferences,
      cashFlow,
      hrRequests,
      feedbackResponses,
      spinRecords
    };
    const yesterdayDigest = buildYesterdayDigest(user, lostSales, shortages, canReadAll);
    const alerts = generateOperationalAlerts(sourceData);
    const todaysRisks = alertsToTodayRisks(alerts).slice(0, 12);
    const savedTaskActions = tasksToActionQueue(operationsTasks);
    const suggestedActions = alertsToActionQueue(alerts)
      .filter(action => !savedTaskActions.some(saved =>
        saved.sourceModule === action.sourceModule
        && saved.title === action.title
        && (saved.relatedRecordId || null) === (action.relatedRecordId || null)
        && (saved.relatedRecordType || null) === (action.relatedRecordType || null)
      ));
    const actionQueue = [...savedTaskActions, ...suggestedActions].slice(0, 12);
    const branchHealth = buildBranchHealthScores(branches, alerts, {
      hasSufficientData: successfulSignalSources > 0,
      focusBranch: user
    });
    const pendingItems = buildPendingItems(alerts, hrRequests);

    setSummary({
      generatedAt: new Date().toISOString(),
      alerts,
      operationsTasks,
      yesterdayDigest,
      todaysRisks,
      actionQueue,
      branchHealth,
      pendingItems,
      dataWarnings: warnings
    });
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;

    const refreshFromSignal = () => {
      void refresh();
    };
    const realtimeTables = [
      ...(isModuleEnabled('sales') ? ['shortages', 'lost_sales'] : []),
      ...(isModuleEnabled('cashTracker') ? ['cash_differences'] : []),
      ...(isModuleEnabled('cashFlow') && isFinancialRole(user.role)
        ? ['cheques', 'expenses', 'revenues_actual', 'revenues_expected', 'cash_flow_settings']
        : []),
      ...(isModuleEnabled('hr') && isManagerRole(user.role) ? ['hr_requests'] : []),
      ...(isModuleEnabled('spinWin') ? ['spins'] : []),
      'operations_tasks',
      'operations_task_events'
    ];
    const channel = supabaseClient.channel(`daily-command-center-${user.id}-${user.role}`);
    realtimeTables.forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, refreshFromSignal);
    });
    channel.subscribe();

    const localEvents = ['tabarak_sales_updated', 'tabarak_shortages_updated'];
    localEvents.forEach(eventName => window.addEventListener(eventName, refreshFromSignal));
    const intervalId = window.setInterval(refreshFromSignal, 60000);

    return () => {
      window.clearInterval(intervalId);
      localEvents.forEach(eventName => window.removeEventListener(eventName, refreshFromSignal));
      void supabaseClient.removeChannel(channel);
    };
  }, [refresh, user]);

  return { summary, isLoading, refresh };
};
