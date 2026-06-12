import { ActualRevenue, Branch, CashDifference, CashFlowSettings, Cheque, ExpectedRevenue, Expense, HRRequest, LostSale, Shortage } from '../../types';
import { calculateForecast } from '../../utils/cashFlowUtils';
import {
  ActionQueueItem,
  BranchHealthScore,
  BranchHealthStatus,
  CommandCenterSeverity,
  OperationalAlert,
  PendingItem,
  TodayRisk
} from './types';

export interface FeedbackResponseSignal {
  id: string;
  branch_cluster?: string;
  submitted_at?: string;
  created_at?: string;
  overall_avg?: number;
  sentiment_label?: 'positive' | 'neutral' | 'negative' | string | null;
  biggest_issue?: string | null;
  improvement_suggestion?: string | null;
  best_thing?: string | null;
  ratings?: Record<string, unknown> | null;
}

export interface SpinSignal {
  id?: string;
  customer_id?: string;
  branch_id?: string;
  voucher_code?: string;
  redeemed_at?: string | null;
  created_at?: string;
}

export interface CommandCenterSourceData {
  branches: Branch[];
  shortages: Shortage[];
  lostSales: LostSale[];
  cashDifferences: CashDifference[];
  cashFlow: CashFlowSignalData;
  hrRequests: HRRequest[];
  feedbackResponses: FeedbackResponseSignal[];
  spinRecords: SpinSignal[];
}

export interface CashFlowSignalData {
  settings: CashFlowSettings | null;
  cheques: Cheque[];
  expenses: Expense[];
  actualRevenues: ActualRevenue[];
  expectedRevenues: ExpectedRevenue[];
}

const nowIso = () => new Date().toISOString();

export const severityWeight: Record<CommandCenterSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const severityPenalty: Record<CommandCenterSeverity, number> = {
  critical: 30,
  high: 20,
  medium: 12,
  low: 5
};

const formatAmount = (amount: number) => `${Math.abs(amount).toFixed(3)} BHD`;

const ageInDays = (timestamp?: string) => {
  if (!timestamp) return 0;
  const created = new Date(timestamp).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 86400000));
};

const isToday = (timestamp?: string) => {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
};

const groupBy = <T,>(items: T[], getKey: (item: T) => string | undefined) => {
  const grouped = new Map<string, T[]>();
  items.forEach(item => {
    const key = getKey(item);
    if (!key) return;
    grouped.set(key, [...(grouped.get(key) || []), item]);
  });
  return grouped;
};

const pushAlert = (alerts: OperationalAlert[], alert: Omit<OperationalAlert, 'createdAt' | 'status'> & { createdAt?: string; status?: OperationalAlert['status'] }) => {
  alerts.push({
    status: 'open',
    createdAt: nowIso(),
    ...alert
  });
};

const getBranchName = (branchMap: Map<string, string>, branchId?: string, fallback?: string) => {
  if (!branchId) return fallback;
  return branchMap.get(branchId) || fallback || 'Unknown Branch';
};

const generateShortageAlerts = (shortages: Shortage[], branchMap: Map<string, string>): OperationalAlert[] => {
  const alerts: OperationalAlert[] = [];
  const active = shortages.filter(shortage => shortage.status !== 'Low');

  active.forEach(shortage => {
    const severity: CommandCenterSeverity = shortage.status === 'Out of Stock'
      ? 'critical'
      : shortage.status === 'Critical'
        ? 'high'
        : 'medium';

    pushAlert(alerts, {
      id: `shortage-${shortage.id}`,
      sourceModule: 'shortages',
      type: 'shortage_recovery',
      severity,
      branchId: shortage.branchId,
      branchName: getBranchName(branchMap, shortage.branchId),
      title: 'Shortage recovery needed',
      message: `${shortage.productName} is marked ${shortage.status}.`,
      recommendedAction: 'Confirm supplier order, branch transfer, or approved alternative.',
      ownerRole: 'Purchasing / Branch team',
      createdAt: shortage.timestamp,
      relatedRecordId: shortage.id,
      relatedRecordType: 'shortage'
    });
  });

  groupBy(active, item => `${item.branchId}:${item.productName.toLowerCase().trim()}`).forEach(items => {
    if (items.length < 3) return;
    const sample = items[0];
    pushAlert(alerts, {
      id: `shortage-repeat-${sample.branchId}-${sample.productName.toLowerCase().replace(/\s+/g, '-')}`,
      sourceModule: 'shortages',
      type: 'repeated_shortage',
      severity: 'high',
      branchId: sample.branchId,
      branchName: getBranchName(branchMap, sample.branchId),
      title: 'Repeated shortage pattern',
      message: `${sample.productName} appears ${items.length} times in active shortage signals.`,
      recommendedAction: 'Treat this as a purchasing/replenishment pattern, not a one-off branch note.',
      ownerRole: 'Purchasing',
      createdAt: sample.timestamp,
      relatedRecordId: sample.productId || sample.id,
      relatedRecordType: 'product_shortage_pattern'
    });
  });

  groupBy(active, item => item.branchId).forEach((items, branchId) => {
    if (items.length < 5) return;
    pushAlert(alerts, {
      id: `shortage-branch-pressure-${branchId}`,
      sourceModule: 'shortages',
      type: 'branch_shortage_pressure',
      severity: items.length >= 10 ? 'critical' : 'high',
      branchId,
      branchName: getBranchName(branchMap, branchId),
      title: 'Branch has many unavailable items',
      message: `${items.length} active shortage items are open for this branch.`,
      recommendedAction: 'Prioritize recovery list and check whether stock transfer is faster than purchase order.',
      ownerRole: 'Operations manager',
      createdAt: items[0]?.timestamp,
      relatedRecordType: 'branch_shortage_pressure'
    });
  });

  return alerts;
};

const generateLostSalesAlerts = (lostSales: LostSale[], branchMap: Map<string, string>): OperationalAlert[] => {
  const alerts: OperationalAlert[] = [];
  const todaysSales = lostSales.filter(sale => isToday(sale.timestamp));

  todaysSales
    .filter(sale => Number(sale.totalValue || 0) >= 100)
    .forEach(sale => {
      const value = Number(sale.totalValue || 0);
      pushAlert(alerts, {
        id: `lost-sale-high-${sale.id}`,
        sourceModule: 'lost_sales',
        type: 'high_lost_sale_value',
        severity: value >= 250 ? 'critical' : 'high',
        branchId: sale.branchId,
        branchName: getBranchName(branchMap, sale.branchId),
        title: 'High-value lost sale',
        message: `${sale.productName} caused a ${formatAmount(value)} lost-sale signal today.`,
        recommendedAction: 'Review availability and decide whether to source, transfer, or recommend an approved substitute.',
        ownerRole: 'Branch manager / Purchasing',
        createdAt: sale.timestamp,
        relatedRecordId: sale.id,
        relatedRecordType: 'lost_sale'
      });
    });

  groupBy(todaysSales, sale => sale.branchId).forEach((items, branchId) => {
    const total = items.reduce((sum, sale) => sum + Number(sale.totalValue || 0), 0);
    if (items.length < 8 && total < 300) return;
    pushAlert(alerts, {
      id: `lost-sales-branch-${branchId}`,
      sourceModule: 'lost_sales',
      type: 'branch_lost_sales_pressure',
      severity: total >= 600 || items.length >= 15 ? 'critical' : 'high',
      branchId,
      branchName: getBranchName(branchMap, branchId),
      title: 'Branch lost-sales pressure',
      message: `${items.length} lost-sale records today totaling ${formatAmount(total)}.`,
      recommendedAction: 'Review top lost items and resolve the fastest recovery path with purchasing.',
      ownerRole: 'Operations manager',
      createdAt: items[0]?.timestamp,
      relatedRecordType: 'branch_lost_sales'
    });
  });

  return alerts;
};

const generateCashAlerts = (cashDifferences: CashDifference[], branchMap: Map<string, string>): OperationalAlert[] => {
  const alerts: OperationalAlert[] = [];
  cashDifferences
    .filter(diff => diff.status === 'Open')
    .forEach(diff => {
      const amount = Math.abs(Number(diff.difference || 0));
      if (amount <= 0) return;
      const severity: CommandCenterSeverity = amount >= 50 ? 'critical' : amount >= 20 ? 'high' : amount >= 5 ? 'medium' : 'low';
      pushAlert(alerts, {
        id: `cash-difference-${diff.id}`,
        sourceModule: 'cash_tracker',
        type: 'cash_variance',
        severity,
        branchId: diff.branchId,
        branchName: diff.branchName || getBranchName(branchMap, diff.branchId),
        title: 'Open cash variance',
        message: `${diff.differenceType} of ${formatAmount(amount)} is still open.`,
        recommendedAction: 'Review drawer count, invoice evidence, and close with a manager comment.',
        ownerRole: 'Accounts / Branch manager',
        createdAt: diff.createdAt,
        relatedRecordId: diff.id,
        relatedRecordType: 'cash_difference'
      });
    });
  return alerts;
};

const toDateOnly = (value?: string) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const generateCashFlowAlerts = (cashFlow: CashFlowSignalData): OperationalAlert[] => {
  const alerts: OperationalAlert[] = [];
  if (!cashFlow.settings) return alerts;

  const forecast = calculateForecast(
    cashFlow.settings,
    cashFlow.cheques,
    cashFlow.expenses,
    cashFlow.actualRevenues,
    cashFlow.expectedRevenues
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueCheques = cashFlow.cheques
    .filter(cheque => cheque.status !== 'Paid')
    .filter(cheque => {
      const dueDate = toDateOnly(cheque.dueDate);
      return dueDate ? dueDate < today : false;
    })
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 5);

  overdueCheques.forEach(cheque => {
    const amount = Number(cheque.amount || 0);
    pushAlert(alerts, {
      id: `cash-flow-overdue-cheque-${cheque.id}`,
      sourceModule: 'cash_flow',
      type: 'overdue_cheque',
      severity: amount >= cashFlow.settings!.safeThreshold ? 'critical' : 'high',
      title: 'Overdue cheque needs action',
      message: `Cheque #${cheque.chequeNumber} for ${formatAmount(amount)} is past due and not marked paid.`,
      recommendedAction: 'Confirm payment status, reschedule with supplier, or update the cheque record.',
      ownerRole: 'Accounts / Finance manager',
      createdAt: cheque.createdAt || cheque.dueDate,
      dueAt: cheque.dueDate,
      relatedRecordId: cheque.id,
      relatedRecordType: 'cheque'
    });
  });

  const riskyForecastDays = forecast
    .filter(day => day.morningRisk !== 'Safe' || day.riskLevel !== 'Safe')
    .slice(0, 7);

  riskyForecastDays.forEach(day => {
    const isCritical = day.morningRisk === 'Critical' || day.riskLevel === 'Critical';
    const lowestBalance = Math.min(day.morningBalance, day.closingBalance);
    pushAlert(alerts, {
      id: `cash-flow-forecast-risk-${day.date}`,
      sourceModule: 'cash_flow',
      type: 'forecast_liquidity_risk',
      severity: isCritical ? 'critical' : 'medium',
      title: isCritical ? 'Forecasted liquidity gap' : 'Cash flow below safe threshold',
      message: `${day.date} forecast reaches ${formatAmount(lowestBalance)} ${lowestBalance < 0 ? 'deficit' : 'balance'}, with ${formatAmount(day.outflow)} planned outflow.`,
      recommendedAction: 'Review due cheques, expected revenues, and delayable expenses before the morning bank window.',
      ownerRole: 'Finance manager',
      createdAt: nowIso(),
      dueAt: day.date,
      relatedRecordId: day.date,
      relatedRecordType: 'cash_flow_forecast'
    });
  });

  const todayStr = today.toISOString().split('T')[0];
  const todaysUnpaidCheques = cashFlow.cheques
    .filter(cheque => cheque.status !== 'Paid' && cheque.dueDate === todayStr)
    .filter(cheque => Number(cheque.amount || 0) >= Math.max(100, cashFlow.settings!.safeThreshold * 0.25))
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 3);

  todaysUnpaidCheques.forEach(cheque => {
    const amount = Number(cheque.amount || 0);
    pushAlert(alerts, {
      id: `cash-flow-today-cheque-${cheque.id}`,
      sourceModule: 'cash_flow',
      type: 'today_large_cheque',
      severity: amount >= cashFlow.settings!.safeThreshold ? 'high' : 'medium',
      title: 'Large cheque due today',
      message: `Cheque #${cheque.chequeNumber} for ${formatAmount(amount)} is due today.`,
      recommendedAction: 'Confirm available morning coverage and supplier execution timing.',
      ownerRole: 'Accounts',
      createdAt: cheque.createdAt || nowIso(),
      dueAt: cheque.dueDate,
      relatedRecordId: cheque.id,
      relatedRecordType: 'cheque'
    });
  });

  return alerts;
};

const generateHrAlerts = (hrRequests: HRRequest[]): OperationalAlert[] => {
  const alerts: OperationalAlert[] = [];
  const pending = hrRequests.filter(request => request.status === 'Pending');

  pending.forEach(request => {
    const days = ageInDays(request.timestamp);
    if (days < 3) return;
    pushAlert(alerts, {
      id: `hr-overdue-${request.id}`,
      sourceModule: 'hr',
      type: 'overdue_hr_request',
      severity: days >= 7 ? 'high' : 'medium',
      title: 'HR approval overdue',
      message: `${request.type || 'HR request'} ${request.refNum} has been pending for ${days} days.`,
      recommendedAction: 'Approve, reject, complete, or request the missing information.',
      ownerRole: 'HR admin',
      createdAt: request.timestamp,
      dueAt: request.reqDate,
      relatedRecordId: request.id,
      relatedRecordType: 'hr_request'
    });
  });

  if (pending.length >= 10) {
    pushAlert(alerts, {
      id: 'hr-pending-volume',
      sourceModule: 'hr',
      type: 'hr_pending_volume',
      severity: pending.length >= 20 ? 'high' : 'medium',
      title: 'HR pending queue is growing',
      message: `${pending.length} HR requests are waiting for action.`,
      recommendedAction: 'Batch review pending requests and clear overdue approvals first.',
      ownerRole: 'HR admin',
      relatedRecordType: 'hr_pending_queue'
    });
  }

  return alerts;
};

const scoreFromResponse = (response: FeedbackResponseSignal) => {
  if (typeof response.overall_avg === 'number') return response.overall_avg;
  const ratings = response.ratings;
  if (!ratings) return 0;
  const values = Object.values(ratings).filter((value): value is number => typeof value === 'number' && value > 0);
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const extractFeedbackWords = (responses: FeedbackResponseSignal[]) => {
  const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'need', 'needs', 'more', 'very']);
  const counts = new Map<string, number>();
  responses.flatMap(response => [
    response.biggest_issue,
    response.improvement_suggestion,
    response.best_thing
  ])
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .forEach(word => counts.set(word, (counts.get(word) || 0) + 1));

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
};

const generateFeedbackAlerts = (responses: FeedbackResponseSignal[]): OperationalAlert[] => {
  const alerts: OperationalAlert[] = [];
  if (responses.length < 5) return alerts;

  const scored = responses.map(response => scoreFromResponse(response)).filter(score => score > 0);
  if (scored.length >= 5) {
    const average = scored.reduce((sum, score) => sum + score, 0) / scored.length;
    if (average < 3) {
      pushAlert(alerts, {
        id: 'feedback-low-rating',
        sourceModule: 'quality_feedback',
        type: 'low_feedback_rating',
        severity: average < 2.5 ? 'high' : 'medium',
        title: 'Quality feedback score is low',
        message: `Average feedback score is ${average.toFixed(1)} across ${scored.length} responses.`,
        recommendedAction: 'Review comments, identify the top operational theme, and assign a manager owner.',
        ownerRole: 'Operations manager',
        relatedRecordType: 'feedback_score'
      });
    }
  }

  const negativeCount = responses.filter(response => response.sentiment_label === 'negative').length;
  const positiveCount = responses.filter(response => response.sentiment_label === 'positive').length;
  if (negativeCount >= 3 && negativeCount > positiveCount) {
    pushAlert(alerts, {
      id: 'feedback-negative-trend',
      sourceModule: 'quality_feedback',
      type: 'negative_feedback_trend',
      severity: negativeCount >= 8 ? 'high' : 'medium',
      title: 'Negative feedback needs review',
      message: `${negativeCount} negative responses currently exceed positive feedback volume.`,
      recommendedAction: 'Read the latest anonymous comments and identify one operational follow-up.',
      ownerRole: 'Operations manager',
      relatedRecordType: 'feedback_sentiment'
    });
  }

  const [topWord, count] = extractFeedbackWords(responses)[0] || [];
  if (topWord && count >= 3) {
    pushAlert(alerts, {
      id: `feedback-keyword-${topWord}`,
      sourceModule: 'quality_feedback',
      type: 'repeated_complaint_keyword',
      severity: 'medium',
      title: 'Repeated feedback theme',
      message: `"${topWord}" appears repeatedly in feedback comments.`,
      recommendedAction: 'Review matching comments and decide whether the theme maps to HR, purchasing, IT, or operations.',
      ownerRole: 'Operations manager',
      relatedRecordType: 'feedback_keyword'
    });
  }

  return alerts;
};

const generateSpinAlerts = (spinRecords: SpinSignal[], branchMap: Map<string, string>): OperationalAlert[] => {
  const alerts: OperationalAlert[] = [];
  if (spinRecords.length === 0) return alerts;

  const todaysSpins = spinRecords.filter(spin => isToday(spin.created_at));
  groupBy(todaysSpins, spin => spin.customer_id).forEach((items, customerId) => {
    if (items.length <= 2) return;
    const sample = items[0];
    pushAlert(alerts, {
      id: `spin-repeat-customer-${customerId}`,
      sourceModule: 'spin_win',
      type: 'repeat_customer_spins',
      severity: items.length >= 5 ? 'high' : 'medium',
      branchId: sample.branch_id,
      branchName: getBranchName(branchMap, sample.branch_id),
      title: 'Repeat reward activity',
      message: `One customer has ${items.length} spin records today.`,
      recommendedAction: 'Review server-side rate limiting and voucher validity before honoring repeated rewards.',
      ownerRole: 'Marketing / Operations',
      createdAt: sample.created_at,
      relatedRecordId: customerId,
      relatedRecordType: 'spin_customer_pattern'
    });
  });

  const staleUnredeemed = spinRecords.filter(spin => !spin.redeemed_at && ageInDays(spin.created_at) >= 7);
  groupBy(staleUnredeemed, spin => spin.branch_id).forEach((items, branchId) => {
    if (items.length < 10) return;
    pushAlert(alerts, {
      id: `spin-stale-redemptions-${branchId}`,
      sourceModule: 'spin_win',
      type: 'stale_unredeemed_vouchers',
      severity: items.length >= 25 ? 'high' : 'medium',
      branchId,
      branchName: getBranchName(branchMap, branchId),
      title: 'Unredeemed vouchers are piling up',
      message: `${items.length} vouchers are older than 7 days and not redeemed.`,
      recommendedAction: 'Check campaign messaging, redemption process, and expiry handling.',
      ownerRole: 'Marketing / Branch manager',
      createdAt: items[0]?.created_at,
      relatedRecordType: 'spin_voucher_backlog'
    });
  });

  return alerts;
};

export const generateOperationalAlerts = (data: CommandCenterSourceData): OperationalAlert[] => {
  const branchMap = new Map(data.branches.map(branch => [branch.id, branch.name]));
  return sortAlerts([
    ...generateShortageAlerts(data.shortages, branchMap),
    ...generateLostSalesAlerts(data.lostSales, branchMap),
    ...generateCashAlerts(data.cashDifferences, branchMap),
    ...generateCashFlowAlerts(data.cashFlow),
    ...generateHrAlerts(data.hrRequests),
    ...generateFeedbackAlerts(data.feedbackResponses),
    ...generateSpinAlerts(data.spinRecords, branchMap)
  ]);
};

export const sortAlerts = <T extends { severity: CommandCenterSeverity; createdAt?: string }>(items: T[]) =>
  [...items].sort((a, b) => {
    const severityDelta = severityWeight[b.severity] - severityWeight[a.severity];
    if (severityDelta !== 0) return severityDelta;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

export const alertsToTodayRisks = (alerts: OperationalAlert[]): TodayRisk[] =>
  sortAlerts(alerts.filter(alert => alert.status === 'open')).map(alert => ({
    id: alert.id,
    riskType: alert.type,
    title: alert.title,
    branchId: alert.branchId,
    branchName: alert.branchName,
    severity: alert.severity,
    message: alert.message,
    recommendedAction: alert.recommendedAction,
    owner: alert.ownerRole,
    ownerRole: alert.ownerRole,
    status: alert.status,
    sourceModule: alert.sourceModule,
    createdAt: alert.createdAt,
    dueAt: alert.dueAt,
    relatedRecordId: alert.relatedRecordId,
    relatedRecordType: alert.relatedRecordType
  }));

export const alertsToActionQueue = (alerts: OperationalAlert[]): ActionQueueItem[] =>
  sortAlerts(alerts.filter(alert => alert.status === 'open' && alert.severity !== 'low')).map(alert => ({
    id: `action-${alert.id}`,
    title: alert.title,
    branchId: alert.branchId,
    branchName: alert.branchName,
    severity: alert.severity,
    priority: alert.severity,
    recommendedAction: alert.recommendedAction,
    nextStep: alert.recommendedAction,
    owner: alert.ownerRole,
    ownerRole: alert.ownerRole,
    status: 'open',
    sourceModule: alert.sourceModule,
    createdAt: alert.createdAt,
    dueAt: alert.dueAt,
    relatedAlertId: alert.id,
    relatedRecordId: alert.relatedRecordId,
    relatedRecordType: alert.relatedRecordType,
    queueSource: 'suggested_action'
  }));

const statusFromScore = (score: number): BranchHealthStatus => {
  if (score < 50) return 'critical';
  if (score < 70) return 'risk';
  if (score < 85) return 'watch';
  return 'healthy';
};

const severityFromStatus = (status: BranchHealthStatus): CommandCenterSeverity => {
  if (status === 'critical') return 'critical';
  if (status === 'risk') return 'high';
  if (status === 'watch' || status === 'insufficient_data') return 'medium';
  return 'low';
};

export const buildBranchHealthScores = (
  branches: Branch[],
  alerts: OperationalAlert[],
  options: { hasSufficientData: boolean; focusBranch?: Branch | null } = { hasSufficientData: true }
): BranchHealthScore[] => {
  const branchMap = new Map(branches.map(branch => [branch.id, branch.name]));
  if (options.focusBranch && !branchMap.has(options.focusBranch.id)) {
    branchMap.set(options.focusBranch.id, options.focusBranch.name);
  }

  if (!options.hasSufficientData && alerts.length === 0) {
    const branch = options.focusBranch || branches[0];
    if (!branch) return [];
    return [{
      branchId: branch.id,
      branchName: branch.name,
      score: 0,
      status: 'insufficient_data',
      severity: 'medium',
      riskCount: 0,
      pendingCount: 0,
      signals: [],
      topReasons: ['Insufficient real data to score branch health.'],
      hasSufficientData: false
    }];
  }

  const branchIds = new Set<string>([
    ...branches.map(branch => branch.id),
    ...alerts.map(alert => alert.branchId).filter((id): id is string => Boolean(id))
  ]);

  return Array.from(branchIds)
    .map(branchId => {
      const branchAlerts = alerts.filter(alert => alert.branchId === branchId);
      const penalty = branchAlerts.reduce((total, alert) => total + severityPenalty[alert.severity], 0);
      const score = Math.max(0, Math.min(100, 100 - penalty));
      const status = statusFromScore(score);
      const reasons = sortAlerts(branchAlerts).slice(0, 3).map(alert => alert.title);
      return {
        branchId,
        branchName: branchMap.get(branchId) || 'Unknown Branch',
        score,
        status,
        severity: severityFromStatus(status),
        riskCount: branchAlerts.length,
        pendingCount: branchAlerts.filter(alert => alert.status === 'open' && alert.severity !== 'low').length,
        signals: reasons,
        topReasons: reasons.length > 0 ? reasons : ['No active alerts from enabled modules.'],
        hasSufficientData: true
      };
    })
    .filter(score => score.riskCount > 0 || score.status !== 'healthy')
    .sort((a, b) => a.score - b.score)
    .slice(0, 8);
};

export const buildPendingItems = (alerts: OperationalAlert[], hrRequests: HRRequest[]): PendingItem[] => {
  const countByModule = new Map<string, { count: number; severity: CommandCenterSeverity }>();
  alerts.filter(alert => alert.status === 'open').forEach(alert => {
    const existing = countByModule.get(alert.sourceModule);
    if (!existing) {
      countByModule.set(alert.sourceModule, { count: 1, severity: alert.severity });
      return;
    }
    existing.count += 1;
    if (severityWeight[alert.severity] > severityWeight[existing.severity]) existing.severity = alert.severity;
  });

  const pendingItems: PendingItem[] = Array.from(countByModule.entries()).map(([module, value]) => ({
    id: `pending-${module}`,
    label: module.replace(/_/g, ' '),
    count: value.count,
    sourceModule: module as PendingItem['sourceModule'],
    severity: value.severity
  }));

  const pendingHr = hrRequests.filter(request => request.status === 'Pending').length;
  if (pendingHr > 0 && !pendingItems.some(item => item.sourceModule === 'hr')) {
    pendingItems.push({
      id: 'pending-hr-requests',
      label: 'pending HR requests',
      count: pendingHr,
      sourceModule: 'hr',
      severity: pendingHr >= 10 ? 'medium' : 'low'
    });
  }

  return sortAlerts(pendingItems).slice(0, 8);
};
