import { branchService } from './branchService';
import { deliveryService } from './deliveryService';
import {
  Branch,
  BranchDeliveryCoverageMetric,
  BranchGovernoratePerformanceKpi,
  DeliveryAdvancedCoverage,
  DeliveryBranchCatchment,
  DeliveryBranchCatchmentBlock,
  DeliveryBranchOverlap,
  DeliveryBlock,
  DeliveryBlockMetric,
  DeliveryCampaignOpportunity,
  DeliveryCapacityClass,
  DeliveryCapacityPressure,
  DeliveryConfidence,
  DeliveryCoverageBundle,
  DeliveryCoverageInsightSeverity,
  DeliveryCoverageRecommendation,
  DeliveryCoverageSummary,
  DeliveryCoverageTrend,
  DeliveryDemandTrend,
  DeliveryDemandTrendClass,
  DeliveryExpansionCandidate,
  DeliveryFieldAvailability,
  DeliveryGovernorateKpiQuality,
  DeliveryPaymentType,
  DeliveryPaymentTypeConfig,
  DeliveryGovernorateCoverage,
  DeliveryOrder,
  DeliveryWhiteSpace,
  GovernoratePerformanceKpi,
  Governorate
} from '../types';
import { isDeliveryPaymentBlockExempt } from '../lib/deliveryPaymentTypes';

export interface DeliveryCoverageFilters {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string | null;
  governorate?: Governorate | 'Unknown' | 'all' | null;
  paymentType?: DeliveryPaymentType | 'all' | null;
  /** Reserved: include orders with no block number in the bucketed view. Default true. */
  includeUnknownBlocks?: boolean;
}

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Default window: last 30 days (per spec) when no range is supplied. */
const defaultRange = (): { from: string; to: string } => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: toDateKey(from), to: toDateKey(to) };
};

const blockKey = (order: DeliveryOrder) => (order.blockNumber || '').trim();

const dominant = (breakdown: Map<string, { branchId: string; branchName: string; orderCount: number }>) => {
  let best: { branchId: string; branchName: string; orderCount: number } | null = null;
  for (const row of breakdown.values()) {
    if (!best || row.orderCount > best.orderCount) best = row;
  }
  return best;
};

/** Intra-period trend: first half vs second half. Honest "insufficient_data" below sample. */
const splitTrend = (dates: string[], from: string, to: string): { first: number; second: number } => {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  const mid = start + (end - start) / 2;
  let first = 0;
  let second = 0;
  for (const d of dates) {
    const t = new Date(`${d}T00:00:00`).getTime();
    if (t <= mid) first += 1; else second += 1;
  }
  return { first, second };
};

const computeTrend = (dates: string[], from: string, to: string): DeliveryCoverageTrend => {
  if (dates.length < 4) return 'insufficient_data';
  const { first, second } = splitTrend(dates, from, to);
  if (first === 0 && second === 0) return 'insufficient_data';
  if (second >= first * 1.25) return 'up';
  if (second <= first * 0.75) return 'down';
  return 'stable';
};

const classifyDemand = (dates: string[], from: string, to: string): DeliveryDemandTrendClass => {
  if (dates.length < 4) return 'insufficient_data';
  const { first, second } = splitTrend(dates, from, to);
  if (first === 0 && second > 0) return 'new_demand';
  if (first === 0 && second === 0) return 'insufficient_data';
  if (second >= first * 1.25) return 'increasing';
  if (second <= first * 0.75) return 'decreasing';
  return 'stable';
};

const KNOWN_GOVERNORATES: Governorate[] = ['Capital', 'Muharraq', 'Northern', 'Southern'];

const normalizeGovernorate = (value?: string | null): Governorate | null => {
  const normalized = (value || '').trim().toLowerCase();
  return KNOWN_GOVERNORATES.find(gov => gov.toLowerCase() === normalized) || null;
};

const orderValueOrNull = (order: DeliveryOrder): number | null => {
  const value = Number(order.valueBhd);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const getDirectoryGovernorate = (
  blockNumber: string | null | undefined,
  directoryByBlock: Map<string, DeliveryBlock>
): Governorate | null => {
  const key = (blockNumber || '').trim();
  if (!key) return null;
  return normalizeGovernorate(directoryByBlock.get(key)?.governorate);
};

const getOrderGovernorate = (
  order: DeliveryOrder,
  directoryByBlock: Map<string, DeliveryBlock>
): Governorate | null =>
  normalizeGovernorate(order.governorate) || getDirectoryGovernorate(order.blockNumber, directoryByBlock);

const pct = (part: number, total: number) => total > 0 ? (part / total) * 100 : 0;

const normalizeAgainstMax = (value: number, max: number) => max > 0 ? value / max : 0;

export const calculatePurchasePowerProxy = (
  rows: Array<Pick<GovernoratePerformanceKpi, 'ordersCount' | 'totalValue' | 'averageOrderValue'>>
): Array<number | null> => {
  const eligible = rows.filter(row =>
    row.ordersCount > 0
    && row.totalValue !== null
    && row.averageOrderValue !== null
  );
  if (eligible.length === 0) return rows.map(() => null);

  const maxValue = Math.max(...eligible.map(row => row.totalValue || 0));
  const maxAverage = Math.max(...eligible.map(row => row.averageOrderValue || 0));
  const maxOrders = Math.max(...eligible.map(row => row.ordersCount));

  return rows.map(row => {
    if (row.totalValue === null || row.averageOrderValue === null || row.ordersCount <= 0) return null;
    const score = (
      normalizeAgainstMax(row.totalValue, maxValue) * 0.5
      + normalizeAgainstMax(row.averageOrderValue, maxAverage) * 0.3
      + normalizeAgainstMax(row.ordersCount, maxOrders) * 0.2
    ) * 100;
    return Math.round(score);
  });
};

const applyPurchasePowerBands = (rows: GovernoratePerformanceKpi[]): GovernoratePerformanceKpi[] => {
  const scored = rows
    .filter(row => row.purchasePowerProxyScore !== null)
    .sort((a, b) => (b.purchasePowerProxyScore || 0) - (a.purchasePowerProxyScore || 0));
  if (scored.length === 0) return rows;

  const topCut = Math.ceil(scored.length / 3);
  const middleCut = Math.ceil((scored.length * 2) / 3);
  const bandByGov = new Map<Governorate | 'Unknown', GovernoratePerformanceKpi['purchasePowerBand']>();
  scored.forEach((row, index) => {
    const band = index < topCut ? 'high' : index < middleCut ? 'medium' : 'low';
    bandByGov.set(row.governorate, band);
  });

  return rows.map(row => ({
    ...row,
    purchasePowerBand: row.purchasePowerProxyScore === null
      ? 'unavailable'
      : bandByGov.get(row.governorate) || 'unavailable'
  }));
};

export const buildGovernoratePerformanceKpis = (
  orders: DeliveryOrder[],
  directoryBlocks: DeliveryBlock[]
): { rows: GovernoratePerformanceKpi[]; quality: DeliveryGovernorateKpiQuality } => {
  const directoryByBlock = new Map(directoryBlocks.map(block => [block.blockNumber.trim(), block]));
  const agg = new Map<Governorate, { orders: number; value: number; valueOrders: number; blocks: Set<string> }>();

  let ordersWithMappedGovernorate = 0;
  let ordersWithUnmappedGovernorate = 0;
  let ordersWithValue = 0;
  let ordersMissingValue = 0;

  for (const order of orders) {
    const value = orderValueOrNull(order);
    if (value !== null) ordersWithValue += 1;
    else ordersMissingValue += 1;

    const governorate = getOrderGovernorate(order, directoryByBlock);
    if (!governorate) {
      ordersWithUnmappedGovernorate += 1;
      continue;
    }

    ordersWithMappedGovernorate += 1;
    const row = agg.get(governorate) || { orders: 0, value: 0, valueOrders: 0, blocks: new Set<string>() };
    row.orders += 1;
    if (value !== null) {
      row.value += value;
      row.valueOrders += 1;
    }
    const block = blockKey(order);
    if (block) row.blocks.add(block);
    agg.set(governorate, row);
  }

  const rows = KNOWN_GOVERNORATES.map(governorate => {
    const row = agg.get(governorate) || { orders: 0, value: 0, valueOrders: 0, blocks: new Set<string>() };
    const totalValue = row.valueOrders > 0 ? row.value : null;
    const servedBlocksCount = row.blocks.size;
    return {
      governorate,
      ordersCount: row.orders,
      totalValue,
      averageOrderValue: totalValue !== null ? totalValue / row.valueOrders : null,
      servedBlocksCount,
      valuePerServedBlock: totalValue !== null && servedBlocksCount > 0 ? totalValue / servedBlocksCount : null,
      ordersPerServedBlock: servedBlocksCount > 0 ? row.orders / servedBlocksCount : 0,
      purchasePowerProxyScore: null,
      purchasePowerBand: 'unavailable' as const
    };
  }).filter(row => row.ordersCount > 0);

  const scores = calculatePurchasePowerProxy(rows);
  const withScores = applyPurchasePowerBands(rows.map((row, index) => ({
    ...row,
    purchasePowerProxyScore: scores[index]
  }))).sort((a, b) => b.ordersCount - a.ordersCount);

  const directoryBlocksWithGov = directoryBlocks.filter(block => normalizeGovernorate(block.governorate)).length;

  return {
    rows: withScores,
    quality: {
      totalOrdersAnalyzed: orders.length,
      ordersWithMappedGovernorate,
      ordersWithUnmappedGovernorate,
      ordersWithValue,
      ordersMissingValue,
      blocksWithGovernorateMapping: directoryBlocksWithGov,
      blocksWithoutGovernorateMapping: Math.max(0, directoryBlocks.length - directoryBlocksWithGov),
      governorateMappingSource: directoryBlocks.length > 0 || ordersWithMappedGovernorate > 0
        ? 'delivery_orders_snapshot_and_delivery_blocks'
        : 'unavailable',
      orderValueField: 'value_bhd'
    }
  };
};

export const buildBranchGovernoratePerformanceKpis = (
  orders: DeliveryOrder[],
  branches: Branch[],
  directoryBlocks: DeliveryBlock[]
): BranchGovernoratePerformanceKpi[] => {
  const directoryByBlock = new Map(directoryBlocks.map(block => [block.blockNumber.trim(), block]));
  const branchInfo = new Map(branches.map(branch => [branch.id, branch]));
  const branchTotals = new Map<string, { orders: number; value: number; valueOrders: number }>();
  const governorateTotals = new Map<Governorate, { orders: number; value: number; valueOrders: number }>();
  const agg = new Map<string, {
    branchId: string;
    branchCode: string;
    branchName: string;
    governorate: Governorate;
    orders: number;
    value: number;
    valueOrders: number;
    blocks: Set<string>;
  }>();

  for (const order of orders) {
    const governorate = getOrderGovernorate(order, directoryByBlock);
    if (!governorate) continue;

    const value = orderValueOrNull(order);
    const branch = branchInfo.get(order.branchId);
    const branchName = order.branchName || branch?.name || 'Unknown branch';
    const branchCode = branch?.code || branchName;

    const branchTotal = branchTotals.get(order.branchId) || { orders: 0, value: 0, valueOrders: 0 };
    branchTotal.orders += 1;
    if (value !== null) {
      branchTotal.value += value;
      branchTotal.valueOrders += 1;
    }
    branchTotals.set(order.branchId, branchTotal);

    const govTotal = governorateTotals.get(governorate) || { orders: 0, value: 0, valueOrders: 0 };
    govTotal.orders += 1;
    if (value !== null) {
      govTotal.value += value;
      govTotal.valueOrders += 1;
    }
    governorateTotals.set(governorate, govTotal);

    const key = `${order.branchId}:${governorate}`;
    const row = agg.get(key) || {
      branchId: order.branchId,
      branchCode,
      branchName,
      governorate,
      orders: 0,
      value: 0,
      valueOrders: 0,
      blocks: new Set<string>()
    };
    row.orders += 1;
    if (value !== null) {
      row.value += value;
      row.valueOrders += 1;
    }
    const block = blockKey(order);
    if (block) row.blocks.add(block);
    agg.set(key, row);
  }

  return [...agg.values()]
    .map(row => {
      const branchTotal = branchTotals.get(row.branchId) || { orders: 0, value: 0, valueOrders: 0 };
      const govTotal = governorateTotals.get(row.governorate) || { orders: 0, value: 0, valueOrders: 0 };
      const totalValue = row.valueOrders > 0 ? row.value : null;
      return {
        branchId: row.branchId,
        branchCode: row.branchCode,
        branchName: row.branchName,
        governorate: row.governorate,
        ordersCount: row.orders,
        totalValue,
        averageOrderValue: totalValue !== null ? totalValue / row.valueOrders : null,
        servedBlocksCount: row.blocks.size,
        branchValueSharePercent: totalValue !== null && branchTotal.valueOrders > 0 ? pct(row.value, branchTotal.value) : null,
        governorateValueSharePercent: totalValue !== null && govTotal.valueOrders > 0 ? pct(row.value, govTotal.value) : null,
        branchOrderSharePercent: pct(row.orders, branchTotal.orders),
        governorateOrderSharePercent: pct(row.orders, govTotal.orders)
      };
    })
    .sort((a, b) => b.ordersCount - a.ordersCount);
};

// ---------------------------------------------------------------------------
// Base summary (unchanged behaviour, refactored into a pure builder)
// ---------------------------------------------------------------------------

const buildSummary = (
  orders: DeliveryOrder[],
  branches: Branch[],
  directoryBlocks: DeliveryBlock[],
  nameFor: (id: string, fallback?: string | null) => string,
  range: { from: string; to: string },
  paymentTypes: DeliveryPaymentTypeConfig[] = []
): DeliveryCoverageSummary => {
  const totalOrders = orders.length;
  const talabat = orders.filter(o => isDeliveryPaymentBlockExempt(o.paymentType, paymentTypes));
  const mappable = orders.filter(o => !isDeliveryPaymentBlockExempt(o.paymentType, paymentTypes));
  const withBlock = mappable.filter(o => blockKey(o).length > 0);
  const withoutBlock = mappable.filter(o => blockKey(o).length === 0);
  const unresolved = withBlock.filter(o => !o.areaName);

  const knownBlockOrders = withBlock.length;
  const unknownBlockOrders = withoutBlock.length;
  const unknownBlockRate = mappable.length ? unknownBlockOrders / mappable.length : 0;

  type BlockAgg = {
    blockNumber: string;
    areaName?: string | null;
    governorate?: Governorate | null;
    unresolved: boolean;
    orderCount: number;
    dates: string[];
    breakdown: Map<string, { branchId: string; branchName: string; orderCount: number }>;
  };
  const blockMap = new Map<string, BlockAgg>();
  for (const order of withBlock) {
    const key = blockKey(order);
    const agg = blockMap.get(key) || {
      blockNumber: key,
      areaName: order.areaName,
      governorate: order.governorate,
      unresolved: !order.areaName,
      orderCount: 0,
      dates: [],
      breakdown: new Map()
    };
    if (!agg.areaName && order.areaName) { agg.areaName = order.areaName; agg.governorate = order.governorate; agg.unresolved = false; }
    agg.orderCount += 1;
    agg.dates.push(order.orderDate);
    const bn = nameFor(order.branchId, order.branchName);
    const row = agg.breakdown.get(order.branchId) || { branchId: order.branchId, branchName: bn, orderCount: 0 };
    row.orderCount += 1;
    agg.breakdown.set(order.branchId, row);
    blockMap.set(key, agg);
  }

  const blocks: DeliveryBlockMetric[] = [...blockMap.values()].map(agg => {
    const dom = dominant(agg.breakdown);
    return {
      blockNumber: agg.blockNumber,
      areaName: agg.areaName,
      governorate: agg.governorate,
      unresolved: agg.unresolved,
      orderCount: agg.orderCount,
      branchBreakdown: [...agg.breakdown.values()].sort((a, b) => b.orderCount - a.orderCount),
      dominantBranchId: dom?.branchId,
      dominantBranchName: dom?.branchName,
      shareOfTotal: knownBlockOrders ? agg.orderCount / knownBlockOrders : 0,
      trend: computeTrend(agg.dates, range.from, range.to)
    };
  }).sort((a, b) => b.orderCount - a.orderCount);

  const topBlocks = blocks.slice(0, 10);
  const lowBlocks = blocks.length > 6 ? [...blocks].sort((a, b) => a.orderCount - b.orderCount).slice(0, 10) : [];

  const branchAgg = new Map<string, BranchDeliveryCoverageMetric & { _blocks: Map<string, number> }>();
  for (const order of mappable) {
    const id = order.branchId;
    const existing = branchAgg.get(id) || {
      branchId: id,
      branchName: nameFor(id, order.branchName),
      orderCount: 0,
      knownBlockOrders: 0,
      unknownBlockOrders: 0,
      uniqueBlocksServed: 0,
      topBlockNumber: undefined,
      topBlockOrders: 0,
      outsideGovernorateOrders: 0,
      _blocks: new Map<string, number>()
    };
    existing.orderCount += 1;
    const key = blockKey(order);
    if (key) {
      existing.knownBlockOrders += 1;
      const n = (existing._blocks.get(key) || 0) + 1;
      existing._blocks.set(key, n);
      if (n > existing.topBlockOrders) { existing.topBlockOrders = n; existing.topBlockNumber = key; }
    } else {
      existing.unknownBlockOrders += 1;
    }
    if (order.isOutsideGovernorate) existing.outsideGovernorateOrders += 1;
    branchAgg.set(id, existing);
  }
  const branchCoverage: BranchDeliveryCoverageMetric[] = [...branchAgg.values()]
    .map(({ _blocks, ...rest }) => ({ ...rest, uniqueBlocksServed: _blocks.size }))
    .sort((a, b) => b.orderCount - a.orderCount);

  const govAgg = new Map<string, { orderCount: number; blocks: Set<string> }>();
  for (const order of withBlock) {
    const gov = order.governorate || 'Unknown';
    const row = govAgg.get(gov) || { orderCount: 0, blocks: new Set<string>() };
    row.orderCount += 1;
    row.blocks.add(blockKey(order));
    govAgg.set(gov, row);
  }
  const governorateCoverage: DeliveryGovernorateCoverage[] = [...govAgg.entries()]
    .map(([governorate, v]) => ({ governorate: governorate as Governorate | 'Unknown', orderCount: v.orderCount, uniqueBlocks: v.blocks.size }))
    .sort((a, b) => b.orderCount - a.orderCount);

  const { rows: governoratePerformanceKpis, quality: governorateKpiQuality } =
    buildGovernoratePerformanceKpis(orders, directoryBlocks);
  const branchGovernoratePerformanceKpis =
    buildBranchGovernoratePerformanceKpis(orders, branches, directoryBlocks);

  return {
    dateFrom: range.from,
    dateTo: range.to,
    totalOrders,
    mappableOrders: mappable.length,
    talabatOrders: talabat.length,
    knownBlockOrders,
    unknownBlockOrders,
    unknownBlockRate,
    unresolvedBlockOrders: unresolved.length,
    uniqueBlocksServed: blockMap.size,
    topBlocks,
    lowBlocks,
    blocks,
    branchCoverage,
    governorateCoverage,
    governoratePerformanceKpis,
    branchGovernoratePerformanceKpis,
    governorateKpiQuality,
    recommendedActions: buildRecommendations({
      mappableCount: mappable.length,
      unknownBlockRate,
      unresolvedCount: unresolved.length,
      blocks,
      branchCoverage
    }),
    topBlock: blocks[0],
    topBranch: branchCoverage[0]
  };
};

// ---------------------------------------------------------------------------
// Advanced analytics (Phases 2-8) — derived from real orders only.
// ---------------------------------------------------------------------------

const severityFromScore = (score: number): DeliveryCoverageInsightSeverity =>
  score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';

const buildAdvanced = (
  orders: DeliveryOrder[],
  summary: DeliveryCoverageSummary,
  directoryBlocks: Array<{ blockNumber: string; areaName: string; governorate: Governorate }>,
  range: { from: string; to: string },
  paymentTypes: DeliveryPaymentTypeConfig[] = []
): DeliveryAdvancedCoverage => {
  const mappable = orders.filter(o => !isDeliveryPaymentBlockExempt(o.paymentType, paymentTypes));
  const withBlock = mappable.filter(o => blockKey(o).length > 0);

  // value_bhd is the only optional analytic field present; the rest are absent.
  const fieldAvailability: DeliveryFieldAvailability = {
    revenue: true,
    deliveryTiming: false,
    deliveryStatus: false,
    customerIdentifier: false,
    productData: false
  };

  // Per-block dates for trend classification (reuse summary.blocks for counts/breakdown).
  const blockDates = new Map<string, string[]>();
  for (const o of withBlock) {
    const k = blockKey(o);
    const arr = blockDates.get(k) || [];
    arr.push(o.orderDate);
    blockDates.set(k, arr);
  }

  // ---- Demand trends (blocks + branches) ----
  const demandTrends: DeliveryDemandTrend[] = [];
  for (const block of summary.blocks) {
    const dates = blockDates.get(block.blockNumber) || [];
    const { first, second } = splitTrend(dates, range.from, range.to);
    demandTrends.push({
      scope: 'block',
      key: block.blockNumber,
      label: `Block ${block.blockNumber}${block.areaName ? ` · ${block.areaName}` : ''}`,
      firstHalf: first,
      secondHalf: second,
      changePct: first > 0 ? (second - first) / first : null,
      classification: classifyDemand(dates, range.from, range.to)
    });
  }
  const branchDates = new Map<string, string[]>();
  for (const o of mappable) {
    const arr = branchDates.get(o.branchId) || [];
    arr.push(o.orderDate);
    branchDates.set(o.branchId, arr);
  }
  for (const branch of summary.branchCoverage) {
    const dates = branchDates.get(branch.branchId) || [];
    const { first, second } = splitTrend(dates, range.from, range.to);
    demandTrends.push({
      scope: 'branch',
      key: branch.branchId,
      label: branch.branchName,
      firstHalf: first,
      secondHalf: second,
      changePct: first > 0 ? (second - first) / first : null,
      classification: classifyDemand(dates, range.from, range.to)
    });
  }

  const trendForBlock = new Map(
    demandTrends.filter(t => t.scope === 'block').map(t => [t.key, t.classification])
  );

  // ---- Campaign opportunities (cautious) ----
  const campaignOpportunities: DeliveryCampaignOpportunity[] = [];
  // Suppress confident campaign advice when data is thin or quality is poor.
  if (summary.mappableOrders >= 10 && summary.unknownBlockRate < 0.4) {
    const served = summary.blocks.filter(b => !b.unresolved && b.orderCount > 0);
    const counts = served.map(b => b.orderCount).sort((a, b) => a - b);
    const p25 = counts.length ? counts[Math.floor(counts.length * 0.25)] : 0;
    const lowThreshold = Math.max(2, p25);
    const weak = served.filter(b => b.orderCount <= lowThreshold).sort((a, b) => a.orderCount - b.orderCount);
    for (const block of weak.slice(0, 12)) {
      const trend = trendForBlock.get(block.blockNumber) || 'insufficient_data';
      const confidence: DeliveryConfidence = block.orderCount >= 3 ? 'medium' : 'low';
      const declining = trend === 'decreasing';
      campaignOpportunities.push({
        insightId: `campaign:${block.blockNumber}`,
        blockNumber: block.blockNumber,
        areaName: block.areaName,
        governorate: block.governorate,
        orderCount: block.orderCount,
        trend,
        severity: declining ? 'medium' : 'low',
        confidence,
        reason: declining
          ? `Block ${block.blockNumber}${block.areaName ? ` (${block.areaName})` : ''} was served before but delivery activity is declining in this period (${block.orderCount} orders).`
          : `Block ${block.blockNumber}${block.areaName ? ` (${block.areaName})` : ''} has low delivery activity in this period (${block.orderCount} orders).`,
        recommendedAction: 'If this block is within your service area, consider a short targeted campaign (e.g. 7 days) to grow demand. Outcomes are not guaranteed; review results before scaling.'
      });
    }
  }

  // ---- Branch catchment ----
  const branchBlockMap = new Map<string, Map<string, { count: number; area?: string | null }>>();
  const branchValue = new Map<string, number>();
  for (const o of mappable) {
    branchValue.set(o.branchId, (branchValue.get(o.branchId) || 0) + o.valueBhd);
    const k = blockKey(o);
    if (!k) continue;
    const m = branchBlockMap.get(o.branchId) || new Map();
    const cur = m.get(k) || { count: 0, area: o.areaName };
    cur.count += 1;
    if (!cur.area && o.areaName) cur.area = o.areaName;
    m.set(k, cur);
    branchBlockMap.set(o.branchId, m);
  }
  const branchCatchments: DeliveryBranchCatchment[] = summary.branchCoverage.map(branch => {
    const blocks = branchBlockMap.get(branch.branchId) || new Map();
    const branchTotal = branch.knownBlockOrders || 1;
    const tiered: DeliveryBranchCatchmentBlock[] = [...blocks.entries()].map(([blockNumber, v]) => {
      const shareOfBranch = v.count / branchTotal;
      const tier: 'primary' | 'secondary' | 'weak' = shareOfBranch >= 0.15 ? 'primary' : shareOfBranch >= 0.05 ? 'secondary' : 'weak';
      return { blockNumber, areaName: v.area, orderCount: v.count, shareOfBranch, tier };
    }).sort((a, b) => b.orderCount - a.orderCount);
    return {
      branchId: branch.branchId,
      branchName: branch.branchName,
      totalOrders: branch.orderCount,
      totalValueBhd: branchValue.get(branch.branchId) || 0,
      uniqueBlocks: branch.uniqueBlocksServed,
      shareOfTotal: summary.mappableOrders ? branch.orderCount / summary.mappableOrders : 0,
      outsideGovernorateOrders: branch.outsideGovernorateOrders,
      primaryBlocks: tiered.filter(b => b.tier === 'primary').slice(0, 10),
      secondaryBlocks: tiered.filter(b => b.tier === 'secondary').slice(0, 10),
      weakBlocks: tiered.filter(b => b.tier === 'weak').slice(0, 10)
    };
  });

  // ---- Branch overlap / cannibalization ----
  const branchOverlaps: DeliveryBranchOverlap[] = summary.blocks
    .filter(b => b.branchBreakdown.length > 1)
    .map(b => {
      const secondShare = b.branchBreakdown[1] ? b.branchBreakdown[1].orderCount / b.orderCount : 0;
      const severity: DeliveryCoverageInsightSeverity = secondShare >= 0.4 ? 'high' : secondShare >= 0.25 ? 'medium' : 'low';
      return {
        insightId: `overlap:${b.blockNumber}`,
        blockNumber: b.blockNumber,
        areaName: b.areaName,
        governorate: b.governorate,
        totalOrders: b.orderCount,
        branches: b.branchBreakdown.map(br => ({
          branchId: br.branchId,
          branchName: br.branchName,
          orderCount: br.orderCount,
          sharePct: b.orderCount ? (br.orderCount / b.orderCount) * 100 : 0
        })),
        dominantBranchId: b.dominantBranchId,
        dominantBranchName: b.dominantBranchName,
        severity,
        recommendedAction: `Block ${b.blockNumber} is served by ${b.branchBreakdown.length} branches. Review routing rules and service ownership; this is a flag for manager review, not a removal decision.`
      };
    })
    .sort((a, b) => b.totalOrders - a.totalOrders)
    .slice(0, 15);

  const overlapBlocksByBranch = new Map<string, number>();
  for (const ov of branchOverlaps) {
    for (const br of ov.branches) overlapBlocksByBranch.set(br.branchId, (overlapBlocksByBranch.get(br.branchId) || 0) + 1);
  }

  // ---- Capacity pressure ----
  const capacityPressures: DeliveryCapacityPressure[] = summary.branchCoverage.map(branch => {
    const topConc = branch.knownBlockOrders ? branch.topBlockOrders / branch.knownBlockOrders : 0;
    const outsidePct = branch.orderCount ? branch.outsideGovernorateOrders / branch.orderCount : 0;
    const unknownRate = branch.orderCount ? branch.unknownBlockOrders / branch.orderCount : 0;
    const overlapBlocks = overlapBlocksByBranch.get(branch.branchId) || 0;

    let classification: DeliveryCapacityClass;
    let points = 0;
    if (branch.orderCount < 8) {
      classification = 'insufficient_data';
    } else {
      if (outsidePct >= 0.35) points += 2; else if (outsidePct >= 0.2) points += 1;
      if (branch.uniqueBlocksServed >= 15) points += 2; else if (branch.uniqueBlocksServed >= 8) points += 1;
      if (unknownRate >= 0.25) points += 2; else if (unknownRate >= 0.1) points += 1;
      if (overlapBlocks >= 5) points += 1;
      if (topConc >= 0.5) points += 1;
      classification = points >= 5 ? 'overloaded' : points >= 3 ? 'high_pressure' : points >= 1 ? 'watch' : 'normal';
    }

    const action = classification === 'overloaded' || classification === 'high_pressure'
      ? `${branch.branchName} serves ${branch.uniqueBlocksServed} unique blocks with ${Math.round(outsidePct * 100)}% outside-governorate orders. Review delivery capacity, driver allocation, and routing.`
      : classification === 'watch'
        ? `${branch.branchName} shows early pressure signs. Monitor routing and outside-governorate share.`
        : classification === 'insufficient_data'
          ? `Not enough orders for ${branch.branchName} to assess capacity pressure in this period.`
          : `${branch.branchName} capacity looks normal for this period.`;

    return {
      insightId: `capacity:branch:${branch.branchId}`,
      branchId: branch.branchId,
      branchName: branch.branchName,
      orderCount: branch.orderCount,
      uniqueBlocks: branch.uniqueBlocksServed,
      topBlockConcentration: topConc,
      outsideGovernoratePct: outsidePct,
      unknownBlockRate: unknownRate,
      overlapBlocks,
      classification,
      recommendedAction: action
    };
  }).sort((a, b) => b.orderCount - a.orderCount);

  const pressureByBranch = new Map(capacityPressures.map(c => [c.branchId, c]));

  // ---- Expansion candidates (block scope only; clustering needs geometry) ----
  const expansionCandidates: DeliveryExpansionCandidate[] = [];
  if (summary.mappableOrders >= 20) {
    const counts = summary.blocks.map(b => b.orderCount).sort((a, b) => b - a);
    const topQuartileThreshold = counts.length ? counts[Math.floor(counts.length * 0.25)] : Infinity;
    for (const block of summary.blocks) {
      if (block.unresolved || block.orderCount < 8) continue;
      const trend = trendForBlock.get(block.blockNumber) || 'insufficient_data';
      const domPressure = block.dominantBranchId ? pressureByBranch.get(block.dominantBranchId) : undefined;
      const reasons: string[] = [];
      let score = 0;
      if (block.orderCount >= topQuartileThreshold) { score += Math.min(40, Math.round(block.shareOfTotal * 200)); reasons.push('sustained delivery volume'); }
      if (trend === 'increasing') { score += 25; reasons.push('increasing trend'); }
      else if (trend === 'new_demand') { score += 15; reasons.push('newly emerging demand'); }
      if (domPressure && domPressure.outsideGovernoratePct >= 0.35) { score += 20; reasons.push('serving branch has high outside-governorate load'); }
      if (domPressure && (domPressure.classification === 'high_pressure' || domPressure.classification === 'overloaded')) { score += 15; reasons.push('serving branch is under capacity pressure'); }
      score = Math.min(100, score);
      if (score >= 60 && reasons.length >= 2) {
        expansionCandidates.push({
          insightId: `expansion:${block.blockNumber}`,
          scope: 'block',
          blockNumber: block.blockNumber,
          label: `Block ${block.blockNumber}${block.areaName ? ` · ${block.areaName}` : ''}`,
          score,
          reasons,
          severity: severityFromScore(score),
          recommendedAction: 'Candidate for further review — assess whether nearby branch capacity or a coverage reassignment would serve this demand more efficiently. This is not a confirmed expansion decision.'
        });
      }
    }
    expansionCandidates.sort((a, b) => b.score - a.score);
  }

  // ---- White space ----
  let whiteSpace: DeliveryWhiteSpace;
  const servedSet = new Set(summary.blocks.map(b => b.blockNumber));
  if (directoryBlocks.length > 0) {
    const zero = directoryBlocks.filter(b => !servedSet.has(b.blockNumber));
    whiteSpace = {
      mode: 'true_zero_activity',
      trueZeroCount: zero.length,
      items: zero.slice(0, 40).map(b => ({
        blockNumber: b.blockNumber,
        areaName: b.areaName,
        governorate: b.governorate,
        orderCount: 0,
        note: 'No delivery orders in the visible scope for this period.'
      })),
      note: 'Zero-activity blocks are directory blocks with no orders in the visible (RLS-scoped) data for this period — not necessarily zero across the whole company.'
    };
  } else {
    const low = [...summary.blocks].filter(b => !b.unresolved).sort((a, b) => a.orderCount - b.orderCount).slice(0, 20);
    whiteSpace = {
      mode: 'served_low_activity',
      trueZeroCount: 0,
      items: low.map(b => ({
        blockNumber: b.blockNumber,
        areaName: b.areaName,
        governorate: b.governorate,
        orderCount: b.orderCount,
        note: 'Low activity among historically served blocks.'
      })),
      note: 'Block directory was unavailable, so this shows low activity among served blocks only — not true geographic zero-activity blocks.'
    };
  }

  return {
    fieldAvailability,
    campaignOpportunities,
    demandTrends,
    branchCatchments,
    branchOverlaps,
    whiteSpace,
    expansionCandidates,
    capacityPressures
  };
};

// ---------------------------------------------------------------------------
// Public service
// ---------------------------------------------------------------------------

export const deliveryCoverageService = {
  getDeliveryCoverageSummary: async (filters: DeliveryCoverageFilters = {}): Promise<DeliveryCoverageSummary> => {
    const range = filters.dateFrom && filters.dateTo
      ? { from: filters.dateFrom, to: filters.dateTo }
      : defaultRange();
    const [orders, branches, directory, paymentTypes] = await Promise.all([
      deliveryService.orders.list({
        branchId: filters.branchId || undefined,
        dateFrom: range.from,
        dateTo: range.to,
        paymentType: filters.paymentType || undefined,
        governorate: filters.governorate && filters.governorate !== 'Unknown' ? filters.governorate : undefined
      }),
      branchService.list(),
      deliveryService.blocks.list().catch(() => []),
      deliveryService.paymentTypes.list(true)
    ]);
    const scopedOrders = filters.governorate === 'Unknown'
      ? orders.filter(order => !getOrderGovernorate(order, new Map((directory || []).map(block => [block.blockNumber.trim(), block]))))
      : orders;
    const branchNames = new Map(branches.map(b => [b.id, b.name]));
    const nameFor = (id: string, fallback?: string | null) => fallback || branchNames.get(id) || 'Unknown branch';
    return buildSummary(scopedOrders, branches, directory || [], nameFor, range, paymentTypes);
  },

  /** Base summary + advanced analytics in one scoped fetch. */
  getDeliveryCoverageBundle: async (filters: DeliveryCoverageFilters = {}): Promise<DeliveryCoverageBundle> => {
    const range = filters.dateFrom && filters.dateTo
      ? { from: filters.dateFrom, to: filters.dateTo }
      : defaultRange();

    const [orders, branches, directory, paymentTypes] = await Promise.all([
      deliveryService.orders.list({
        branchId: filters.branchId || undefined,
        dateFrom: range.from,
        dateTo: range.to,
        paymentType: filters.paymentType || undefined,
        governorate: filters.governorate && filters.governorate !== 'Unknown' ? filters.governorate : undefined
      }),
      branchService.list(),
      deliveryService.blocks.list().catch(() => []),
      deliveryService.paymentTypes.list(true)
    ]);
    const scopedOrders = filters.governorate === 'Unknown'
      ? orders.filter(order => !getOrderGovernorate(order, new Map((directory || []).map(block => [block.blockNumber.trim(), block]))))
      : orders;

    const branchNames = new Map(branches.map(b => [b.id, b.name]));
    const nameFor = (id: string, fallback?: string | null) => fallback || branchNames.get(id) || 'Unknown branch';

    const summary = buildSummary(scopedOrders, branches, directory || [], nameFor, range, paymentTypes);
    const directoryBlocks = (directory || []).map(b => ({
      blockNumber: b.blockNumber,
      areaName: b.areaName,
      governorate: b.governorate
    }));
    const advanced = buildAdvanced(scopedOrders, summary, directoryBlocks, range, paymentTypes);
    return { summary, advanced };
  }
};

/** Explainable, cautious recommendations derived only from real aggregated data. */
function buildRecommendations(input: {
  mappableCount: number;
  unknownBlockRate: number;
  unresolvedCount: number;
  blocks: DeliveryBlockMetric[];
  branchCoverage: BranchDeliveryCoverageMetric[];
}): DeliveryCoverageRecommendation[] {
  const recs: DeliveryCoverageRecommendation[] = [];
  const { mappableCount, unknownBlockRate, unresolvedCount, blocks, branchCoverage } = input;

  if (mappableCount < 10) {
    if (unknownBlockRate >= 0.1 && mappableCount > 0) {
      recs.push({
        type: 'data_quality_issue',
        severity: 'medium',
        title: 'Low data volume',
        message: `Only ${mappableCount} mappable delivery orders in this period — too few to draw geographic conclusions.`,
        recommendedAction: 'Widen the date range or wait for more recorded orders before acting on coverage insights.'
      });
    }
    return recs;
  }

  if (unknownBlockRate >= 0.1) {
    const pct = Math.round(unknownBlockRate * 100);
    recs.push({
      type: 'data_quality_issue',
      severity: unknownBlockRate >= 0.25 ? 'high' : 'medium',
      title: 'High unknown-block rate',
      message: `${pct}% of mappable delivery orders have no block number recorded.`,
      recommendedAction: 'Improve branch entry accuracy (require a block on non-Talabat orders) before making expansion or marketing decisions.'
    });
  }

  if (unresolvedCount > 0) {
    recs.push({
      type: 'data_quality_issue',
      severity: unresolvedCount >= 10 ? 'medium' : 'low',
      title: 'Blocks missing from the directory',
      message: `${unresolvedCount} order(s) reference block numbers that are not in the block directory, so their area/governorate is unknown.`,
      recommendedAction: 'Add the missing blocks in Delivery Settings → Blocks & Areas so they map to an area and governorate.'
    });
  }

  const strong = blocks.filter(b => b.orderCount >= 5 && b.shareOfTotal >= 0.05).slice(0, 3);
  for (const block of strong) {
    recs.push({
      type: 'strong_service_area',
      severity: 'low',
      title: `Block ${block.blockNumber} is a strong service area`,
      message: `Block ${block.blockNumber}${block.areaName ? ` (${block.areaName})` : ''} accounts for ${Math.round(block.shareOfTotal * 100)}% of located deliveries${block.dominantBranchName ? `, mostly served by ${block.dominantBranchName}` : ''}.`,
      blockNumber: block.blockNumber,
      branchId: block.dominantBranchId,
      branchName: block.dominantBranchName,
      recommendedAction: 'Protect this zone: monitor delivery quality and consider a retention campaign for repeat customers.'
    });
  }

  const weak = [...blocks].filter(b => !b.unresolved).sort((a, b) => a.orderCount - b.orderCount).slice(0, 3);
  for (const block of weak) {
    if (block.orderCount === 0) continue;
    recs.push({
      type: 'marketing_opportunity',
      severity: 'low',
      title: `Block ${block.blockNumber} has low delivery volume`,
      message: `Block ${block.blockNumber}${block.areaName ? ` (${block.areaName})` : ''} recorded only ${block.orderCount} delivery order(s) in this period.`,
      blockNumber: block.blockNumber,
      recommendedAction: 'If this block is within your service area, consider a targeted campaign to grow demand.'
    });
  }

  for (const branch of branchCoverage) {
    if (branch.orderCount >= 20 && branch.outsideGovernorateOrders / branch.orderCount >= 0.35) {
      const pct = Math.round((branch.outsideGovernorateOrders / branch.orderCount) * 100);
      recs.push({
        type: 'expansion_candidate',
        severity: 'medium',
        title: `${branch.branchName} serves heavily outside its governorate`,
        message: `${pct}% of ${branch.branchName}'s located deliveries fall outside its own governorate, which raises driver time and petrol cost.`,
        branchId: branch.branchId,
        branchName: branch.branchName,
        recommendedAction: 'Candidate for further review — check whether nearby branch capacity or a coverage reassignment would serve these zones more efficiently. Do not treat as a confirmed expansion decision.'
      });
      break;
    }
  }

  return recs;
}
