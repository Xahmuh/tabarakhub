import {
  Branch,
  BranchDeliveryProfile,
  DeliveryCostSetting,
  DeliveryCoverageBundle,
  DeliveryDriver,
  DeliveryOrder,
  DeliveryPaymentType,
  DeliveryPaymentTypeConfig,
  Governorate,
  LostSale,
  Shortage
} from '../../types';
import { branchService } from '../../services/branchService';
import { branchDeliveryProfileService } from '../../services/branchDeliveryProfileService';
import { deliveryCoverageService } from '../../services/deliveryCoverageService';
import { deliveryService } from '../../services/deliveryService';
import { saleService } from '../../services/saleService';
import { isDirectOrder, rangeDayCount, sumValue, todayKey } from '../delivery/utils';

export type OwnerDashboardSection = 'overview' | 'map' | 'traceability' | 'drivers' | 'pharmacies';

export interface OwnerDashboardFilters {
  dateFrom: string;
  dateTo: string;
  branchId?: string | null;
  paymentType?: DeliveryPaymentType | null;
  driverId?: string | null;
  governorate?: Governorate | null;
  search?: string | null;
}

export interface OwnerTodayKpis {
  orders: number;
  valueBhd: number;
  directOrders: number;
  talabatOrders: number;
  activeBranches: number;
  lostSalesValueBhd: number;
  lostCustomers: number;
  criticalShortages: number;
}

export interface OwnerOverviewKpis {
  totalOrders: number;
  totalValueBhd: number;
  directOrders: number;
  talabatOrders: number;
  averageOrderValueBhd: number;
  activeBranches: number;
  knownBlockRate: number;
  unknownBlockRate: number;
  outsideGovernorateRate: number;
  lostSalesValueBhd: number;
  lostCustomers: number;
  noRecoveryLostSales: number;
  criticalShortages: number;
}

export interface OwnerDriverKpi {
  driverId: string;
  driverCode?: string;
  driverName: string;
  isActive: boolean;
  orders: number;
  totalValueBhd: number;
  ordersPerDay: number;
  costPerOrderBhd: number | null;
  periodCostBhd: number | null;
  estimatedContributionBhd: number | null;
  estimatedNetBhd: number | null;
  classification: 'optimum' | 'in_range' | 'low_efficiency' | 'loss_making' | 'no_cost_data';
}

export interface OwnerBranchKpi {
  branchId: string;
  branchCode: string;
  branchName: string;
  deliveryOrders: number;
  deliveryValueBhd: number;
  directOrders: number;
  talabatOrders: number;
  uniqueBlocks: number;
  unknownBlockRate: number;
  outsideGovernorateRate: number;
  topBlockNumber?: string;
  topDriverName?: string;
  lostSalesValueBhd: number;
  lostSalesIncidents: number;
  noRecoveryRate: number;
  shortageCount: number;
  criticalShortageCount: number;
  healthScore: number;
  healthStatus: 'healthy' | 'watch' | 'risk' | 'critical' | 'insufficient_data';
}

export interface OwnerDashboardBundle {
  generatedAt: string;
  range: { from: string; to: string; days: number };
  branches: Branch[];
  drivers: DeliveryDriver[];
  branchProfiles: BranchDeliveryProfile[];
  paymentTypes: DeliveryPaymentTypeConfig[];
  orders: DeliveryOrder[];
  sales: LostSale[];
  shortages: Shortage[];
  coverage: DeliveryCoverageBundle;
  today: OwnerTodayKpis;
  overview: OwnerOverviewKpis;
  branchKpis: OwnerBranchKpi[];
  driverKpis: OwnerDriverKpi[];
}

const toTimestampStart = (dateKey: string) => `${dateKey}T00:00:00.000`;
const toTimestampEnd = (dateKey: string) => `${dateKey}T23:59:59.999`;

const matchesSearch = (order: DeliveryOrder, search?: string | null) => {
  const query = search?.trim().toLowerCase();
  if (!query) return true;
  return [
    order.blockNumber,
    order.areaName,
    order.governorate,
    order.branchName,
    order.driverCode,
    order.driverName,
    order.pharmacistName,
    order.paymentType,
    order.notes
  ].filter(Boolean).join(' ').toLowerCase().includes(query);
};

const pct = (part: number, total: number) => total > 0 ? (part / total) * 100 : 0;

const formatBranchName = (branch: Branch) =>
  [branch.code, branch.name].filter(Boolean).join(' - ') || 'Unknown branch';

const lostCustomerKey = (sale: LostSale) => {
  if (sale.sessionId) return sale.sessionId;
  const timestamp = new Date(sale.timestamp).getTime();
  const timestampKey = Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : sale.id;
  return `${sale.branchId}:${sale.lostDate}:${sale.lostHour}:${timestampKey}`;
};

const countLostCustomers = (sales: LostSale[]) =>
  new Set(sales.map(lostCustomerKey)).size;

const buildTodayKpis = (
  orders: DeliveryOrder[],
  sales: LostSale[],
  shortages: Shortage[],
  paymentTypes: DeliveryPaymentTypeConfig[]
): OwnerTodayKpis => {
  const customerOrders = orders.filter(order => order.orderKind !== 'internal_transfer');
  const direct = customerOrders.filter(order => isDirectOrder(order, paymentTypes));
  return {
    orders: customerOrders.length,
    valueBhd: sumValue(customerOrders),
    directOrders: direct.length,
    talabatOrders: customerOrders.length - direct.length,
    activeBranches: new Set(customerOrders.map(order => order.branchId)).size,
    lostSalesValueBhd: sales.reduce((sum, sale) => sum + Number(sale.totalValue || 0), 0),
    lostCustomers: countLostCustomers(sales),
    criticalShortages: shortages.filter(shortage => shortage.status === 'Critical' || shortage.status === 'Out of Stock').length
  };
};

const buildOverview = (
  orders: DeliveryOrder[],
  sales: LostSale[],
  shortages: Shortage[],
  paymentTypes: DeliveryPaymentTypeConfig[]
): OwnerOverviewKpis => {
  const customerOrders = orders.filter(order => order.orderKind !== 'internal_transfer');
  const direct = customerOrders.filter(order => isDirectOrder(order, paymentTypes));
  const knownBlockOrders = direct.filter(order => !!order.blockNumber).length;
  const unknownBlockOrders = direct.length - knownBlockOrders;
  const outsideGovernorateOrders = direct.filter(order => order.isOutsideGovernorate).length;
  const totalValue = sumValue(customerOrders);
  return {
    totalOrders: customerOrders.length,
    totalValueBhd: totalValue,
    directOrders: direct.length,
    talabatOrders: customerOrders.length - direct.length,
    averageOrderValueBhd: customerOrders.length ? totalValue / customerOrders.length : 0,
    activeBranches: new Set(customerOrders.map(order => order.branchId)).size,
    knownBlockRate: pct(knownBlockOrders, direct.length),
    unknownBlockRate: pct(unknownBlockOrders, direct.length),
    outsideGovernorateRate: pct(outsideGovernorateOrders, direct.length),
    lostSalesValueBhd: sales.reduce((sum, sale) => sum + Number(sale.totalValue || 0), 0),
    lostCustomers: countLostCustomers(sales),
    noRecoveryLostSales: sales.filter(sale => !sale.alternativeGiven && !sale.internalTransfer).length,
    criticalShortages: shortages.filter(shortage => shortage.status === 'Critical' || shortage.status === 'Out of Stock').length
  };
};

const classifyDriver = (
  orders: DeliveryOrder[],
  driver: DeliveryDriver,
  setting: DeliveryCostSetting | undefined,
  periodDays: number
): OwnerDriverKpi => {
  const driverOrders = orders.filter(order => order.driverId === driver.id);
  const orderCount = driverOrders.length;
  const totalValue = sumValue(driverOrders);
  const ordersPerDay = orderCount / Math.max(1, periodDays);

  if (!setting) {
    return {
      driverId: driver.id,
      driverCode: driver.driverCode,
      driverName: driver.name,
      isActive: driver.isActive,
      orders: orderCount,
      totalValueBhd: totalValue,
      ordersPerDay,
      costPerOrderBhd: null,
      periodCostBhd: null,
      estimatedContributionBhd: null,
      estimatedNetBhd: null,
      classification: 'no_cost_data'
    };
  }

  const workingDaysInPeriod = Math.min(periodDays, Math.round(periodDays * (setting.workingDaysPerMonth / 30)));
  const periodCost = (setting.monthlyCostBhd / setting.workingDaysPerMonth) * Math.max(1, workingDaysInPeriod);
  const costPerOrder = orderCount > 0 ? periodCost / orderCount : null;
  const target = setting.targetOrdersPerDay;
  const productivityRatio = target > 0 ? ordersPerDay / target : 0;
  const estimatedContribution = setting.assumedMarginPct == null ? null : totalValue * (setting.assumedMarginPct / 100);
  const estimatedNet = estimatedContribution == null ? null : estimatedContribution - periodCost;

  let classification: OwnerDriverKpi['classification'];
  if (estimatedNet != null) {
    if (estimatedNet < 0) classification = 'loss_making';
    else if (productivityRatio >= 1) classification = 'optimum';
    else if (productivityRatio >= 0.5) classification = 'in_range';
    else classification = 'low_efficiency';
  } else if (productivityRatio >= 1) {
    classification = 'optimum';
  } else if (productivityRatio >= 0.5) {
    classification = 'in_range';
  } else if (orderCount === 0) {
    classification = 'loss_making';
  } else {
    classification = 'low_efficiency';
  }

  return {
    driverId: driver.id,
    driverCode: driver.driverCode,
    driverName: driver.name,
    isActive: driver.isActive,
    orders: orderCount,
    totalValueBhd: totalValue,
    ordersPerDay,
    costPerOrderBhd: costPerOrder,
    periodCostBhd: periodCost,
    estimatedContributionBhd: estimatedContribution,
    estimatedNetBhd: estimatedNet,
    classification
  };
};

const buildDriverKpis = (
  orders: DeliveryOrder[],
  drivers: DeliveryDriver[],
  settings: DeliveryCostSetting[],
  periodDays: number
) => {
  const driverIdsWithOrders = new Set(orders.map(order => order.driverId).filter(Boolean) as string[]);
  return drivers
    .filter(driver => driver.isActive || driverIdsWithOrders.has(driver.id))
    .map(driver => classifyDriver(orders, driver, settings.find(setting => setting.driverId === driver.id), periodDays))
    .sort((a, b) => {
      const aRank = a.estimatedNetBhd ?? (a.ordersPerDay * 1000 - (a.classification === 'no_cost_data' ? 1e9 : 0));
      const bRank = b.estimatedNetBhd ?? (b.ordersPerDay * 1000 - (b.classification === 'no_cost_data' ? 1e9 : 0));
      return bRank - aRank || b.orders - a.orders || a.driverName.localeCompare(b.driverName);
    });
};

const branchStatusFromScore = (score: number, hasData: boolean): OwnerBranchKpi['healthStatus'] => {
  if (!hasData) return 'insufficient_data';
  if (score >= 82) return 'healthy';
  if (score >= 65) return 'watch';
  if (score >= 45) return 'risk';
  return 'critical';
};

const buildBranchKpis = (
  branches: Branch[],
  orders: DeliveryOrder[],
  sales: LostSale[],
  shortages: Shortage[],
  paymentTypes: DeliveryPaymentTypeConfig[]
): OwnerBranchKpi[] => {
  return branches.map(branch => {
    const branchOrders = orders.filter(order => order.branchId === branch.id && order.orderKind !== 'internal_transfer');
    const direct = branchOrders.filter(order => isDirectOrder(order, paymentTypes));
    const knownBlockOrders = direct.filter(order => !!order.blockNumber).length;
    const unknownBlockRate = pct(direct.length - knownBlockOrders, direct.length);
    const outsideGovernorateRate = pct(direct.filter(order => order.isOutsideGovernorate).length, direct.length);
    const branchSales = sales.filter(sale => sale.branchId === branch.id);
    const branchShortages = shortages.filter(shortage => shortage.branchId === branch.id);
    const noRecoveryRate = pct(
      branchSales.filter(sale => !sale.alternativeGiven && !sale.internalTransfer).length,
      branchSales.length
    );

    const blockCounts = new Map<string, number>();
    direct.forEach(order => {
      if (order.blockNumber) blockCounts.set(order.blockNumber, (blockCounts.get(order.blockNumber) || 0) + 1);
    });
    const topBlockNumber = [...blockCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    const driverCounts = new Map<string, { name: string; count: number }>();
    branchOrders.forEach(order => {
      if (!order.driverId) return;
      const row = driverCounts.get(order.driverId) || { name: order.driverName || 'Unknown driver', count: 0 };
      row.count += 1;
      driverCounts.set(order.driverId, row);
    });
    const topDriverName = [...driverCounts.values()].sort((a, b) => b.count - a.count)[0]?.name;

    const lostValue = branchSales.reduce((sum, sale) => sum + Number(sale.totalValue || 0), 0);
    const criticalShortageCount = branchShortages.filter(shortage => shortage.status === 'Critical' || shortage.status === 'Out of Stock').length;
    const dataVolume = branchOrders.length + branchSales.length + branchShortages.length;
    const score = Math.max(0, Math.min(100, Math.round(
      100
      - Math.min(25, unknownBlockRate * 0.35)
      - Math.min(20, outsideGovernorateRate * 0.25)
      - Math.min(20, noRecoveryRate * 0.2)
      - Math.min(25, criticalShortageCount * 4)
      - Math.min(10, lostValue > 0 ? Math.log10(lostValue + 1) * 2 : 0)
    )));

    return {
      branchId: branch.id,
      branchCode: branch.code || '',
      branchName: branch.name || formatBranchName(branch),
      deliveryOrders: branchOrders.length,
      deliveryValueBhd: sumValue(branchOrders),
      directOrders: direct.length,
      talabatOrders: branchOrders.length - direct.length,
      uniqueBlocks: blockCounts.size,
      unknownBlockRate,
      outsideGovernorateRate,
      topBlockNumber,
      topDriverName,
      lostSalesValueBhd: lostValue,
      lostSalesIncidents: branchSales.length,
      noRecoveryRate,
      shortageCount: branchShortages.length,
      criticalShortageCount,
      healthScore: score,
      healthStatus: branchStatusFromScore(score, dataVolume > 0)
    };
  }).sort((a, b) => {
    if (a.healthStatus === 'insufficient_data' && b.healthStatus !== 'insufficient_data') return 1;
    if (b.healthStatus === 'insufficient_data' && a.healthStatus !== 'insufficient_data') return -1;
    return a.healthScore - b.healthScore
      || b.deliveryOrders - a.deliveryOrders
      || b.lostSalesValueBhd - a.lostSalesValueBhd
      || a.branchCode.localeCompare(b.branchCode);
  });
};

export const ownerDashboardService = {
  loadBundle: async (filters: OwnerDashboardFilters): Promise<OwnerDashboardBundle> => {
    const range = { from: filters.dateFrom, to: filters.dateTo, days: rangeDayCount(filters.dateFrom, filters.dateTo) };
    const branchId = filters.branchId || undefined;
    const today = todayKey();
    const orderFilters = {
      branchId,
      dateFrom: range.from,
      dateTo: range.to,
      paymentType: filters.paymentType || undefined,
      driverId: filters.driverId || undefined,
      governorate: filters.governorate || undefined
    };
    const coverageFilters = {
      branchId,
      dateFrom: range.from,
      dateTo: range.to,
      paymentType: filters.paymentType || undefined,
      governorate: filters.governorate || undefined
    };
    const timestampOptions = {
      timestampFrom: toTimestampStart(range.from),
      timestampTo: toTimestampEnd(range.to)
    };
    const todayTimestampOptions = {
      timestampFrom: toTimestampStart(today),
      timestampTo: toTimestampEnd(today)
    };

    const [
      allBranches,
      drivers,
      costSettings,
      paymentTypes,
      rawOrders,
      coverage,
      branchProfiles,
      sales,
      shortages,
      todayOrders,
      todaySales,
      todayShortages
    ] = await Promise.all([
      branchService.list(),
      deliveryService.drivers.list(true),
      deliveryService.costSettings.list(),
      deliveryService.paymentTypes.list(true),
      deliveryService.orders.list(orderFilters),
      deliveryCoverageService.getDeliveryCoverageBundle(coverageFilters),
      branchDeliveryProfileService.listBranchDeliveryProfiles().catch(() => []),
      saleService.sales.list(branchId || 'all', 'owner', timestampOptions),
      saleService.shortages.list(branchId || 'all', 'owner', timestampOptions),
      deliveryService.orders.list({ branchId, dateFrom: today, dateTo: today }),
      saleService.sales.list(branchId || 'all', 'owner', todayTimestampOptions),
      saleService.shortages.list(branchId || 'all', 'owner', todayTimestampOptions)
    ]);

    const branches = allBranches.filter(branch => branch.role === 'branch');
    const branchNames = new Map(branches.map(branch => [branch.id, formatBranchName(branch)]));
    const orders = rawOrders
      .map(order => ({ ...order, branchName: order.branchName || branchNames.get(order.branchId) || 'Unknown branch' }))
      .filter(order => matchesSearch(order, filters.search));
    const customerOrders = orders.filter(order => order.orderKind !== 'internal_transfer');

    return {
      generatedAt: new Date().toISOString(),
      range,
      branches,
      drivers,
      branchProfiles,
      paymentTypes,
      orders: customerOrders,
      sales,
      shortages,
      coverage,
      today: buildTodayKpis(todayOrders, todaySales, todayShortages, paymentTypes),
      overview: buildOverview(customerOrders, sales, shortages, paymentTypes),
      branchKpis: buildBranchKpis(branches, customerOrders, sales, shortages, paymentTypes),
      driverKpis: buildDriverKpis(customerOrders, drivers, costSettings, range.days)
    };
  }
};
