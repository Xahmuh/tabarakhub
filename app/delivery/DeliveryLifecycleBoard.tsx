import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  PackageCheck,
  RefreshCw,
  Route,
  Search,
  Truck,
  XCircle
} from 'lucide-react';
import Swal from 'sweetalert2';
import { deliveryService } from '../../services/deliveryService';
import { Branch, DeliveryDriver, DeliveryLifecycleStatus, DeliveryOrder, DeliveryOrderEvent, DeliveryPaymentCollectionStatus, DeliveryPaymentTypeConfig } from '../../types';
import { isDeliveryPaymentBlockExempt, isTalabatDeliveryPayment } from '../../lib/deliveryPaymentTypes';
import { PeriodFilter } from './components/PeriodFilter';
import { PeriodPreset, formatBhd, getPresetRange, periodLabel, todayKey, yesterdayKey } from './utils';

type DispatchStatus = DeliveryLifecycleStatus | 'returned';
const STATUS_META: Record<DispatchStatus, { label: string; className: string; icon: React.ElementType }> = {
  recorded: {
    label: 'Recorded',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
    icon: Clock3
  },
  assigned: {
    label: 'Assigned',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    icon: Truck
  },
  picked_up: {
    label: 'Picked up',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: Route
  },
  delivered: {
    label: 'Complete',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2
  },
  cancelled: {
    label: 'Cancelled',
    className: 'border-red-200 bg-red-50 text-red-700',
    icon: XCircle
  },
  returned: {
    label: 'Returned',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: Route
  }
};

const STATUS_ORDER: DispatchStatus[] = ['recorded', 'assigned', 'picked_up', 'delivered', 'cancelled', 'returned'];
type DispatchView = 'all' | 'recorded' | 'assigned' | 'picked_up' | 'closed' | 'returned';

const PAYMENT_COLLECTION_META: Record<DeliveryPaymentCollectionStatus, { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  collect_on_delivery: { label: 'Collect on delivery', className: 'border-red-200 bg-red-50 text-red-700' },
  partial: { label: 'Partial collect', className: 'border-amber-200 bg-amber-50 text-amber-700' }
};

const lifecycleTimeFor = (order: DeliveryOrder) =>
  order.deliveredAt || order.pickedUpAt || order.assignedAt || order.cancelledAt || order.lifecycleUpdatedAt || order.createdAt;

const minutesBetween = (start?: string | null, end?: string | null) => {
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return Math.round((endMs - startMs) / 60000);
};

const averageMinutes = (values: Array<number | null>) => {
  const valid = values.filter((value): value is number => typeof value === 'number');
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
};

const formatDuration = (minutes: number | null) => {
  if (minutes === null) return '-';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

const shortRunId = (value?: string | null) => value ? value.slice(0, 8) : null;
const deliveryOrderNumber = (order: DeliveryOrder) => order.orderNumber || `#${order.id.slice(0, 8)}`;

const isInsideBranchTransitionWindow = (order: DeliveryOrder) =>
  order.orderDate >= yesterdayKey() && order.orderDate <= todayKey();

const nextStatusesFor = (status: DeliveryLifecycleStatus): DeliveryLifecycleStatus[] => {
  if (status === 'recorded') return ['assigned'];
  if (status === 'assigned') return ['picked_up'];
  if (status === 'picked_up') return ['delivered'];
  return [];
};

const isClosedOrder = (order: DeliveryOrder) =>
  order.deliveryStatus === 'delivered' || order.deliveryStatus === 'cancelled';

const isManualRecordedOnlyOrder = (order: DeliveryOrder) =>
  order.dispatchMode === 'log_only'
  && order.orderKind !== 'internal_transfer'
  && !isTalabatDeliveryPayment(order.paymentType);

const dispatchDisplayStatus = (order: DeliveryOrder): DispatchStatus =>
  order.deliveryStatus === 'cancelled' && order.cancelledReason?.startsWith('Customer return:')
    ? 'returned'
    : isManualRecordedOnlyOrder(order) && order.deliveryStatus === 'recorded'
      ? 'delivered'
      : order.deliveryStatus;

const isDriverDispatchOrder = (order: DeliveryOrder, paymentTypes: DeliveryPaymentTypeConfig[]) =>
  order.dispatchMode !== 'log_only' && (order.orderKind === 'internal_transfer' || !isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes));

const isPendingCollectionOrder = (order: DeliveryOrder) =>
  order.paymentCollectionStatus !== 'paid' && order.amountToCollectBhd > 0;

const isBenefitPayOrder = (order: DeliveryOrder) => order.paymentType === 'BP';

const isCollectionConfirmedByDriver = (order: DeliveryOrder) =>
  isPendingCollectionOrder(order)
  && (Boolean(order.driverPaymentCollectedAt) || order.driverPaymentCollectedAmountBhd > 0);

const collectionValueBadgeClass = (order: DeliveryOrder) =>
  isCollectionConfirmedByDriver(order)
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-red-200 bg-red-50 text-red-700';

const benefitPayTraceIconClass = 'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100';

const StatusBadge: React.FC<{ status: DispatchStatus }> = ({ status }) => {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${meta.className}`}>
      <Icon className="h-3 w-3" /> {meta.label}
    </span>
  );
};

type KpiTone = 'brand' | 'blue' | 'amber' | 'emerald' | 'rose' | 'slate';

const KPI_TONE_CLASSES: Record<KpiTone, { card: string; icon: string; label: string; sub: string }> = {
  brand: {
    card: 'border-brand/20 bg-brand/5',
    icon: 'bg-brand text-white',
    label: 'text-brand',
    sub: 'text-slate-600'
  },
  blue: {
    card: 'border-blue-200 bg-blue-50/70',
    icon: 'bg-blue-600 text-white',
    label: 'text-blue-700',
    sub: 'text-blue-900/70'
  },
  amber: {
    card: 'border-amber-200 bg-amber-50/80',
    icon: 'bg-amber-600 text-white',
    label: 'text-amber-700',
    sub: 'text-amber-900/70'
  },
  emerald: {
    card: 'border-emerald-200 bg-emerald-50/80',
    icon: 'bg-emerald-600 text-white',
    label: 'text-emerald-700',
    sub: 'text-emerald-900/70'
  },
  rose: {
    card: 'border-red-200 bg-red-50/80',
    icon: 'bg-red-600 text-white',
    label: 'text-red-700',
    sub: 'text-red-900/70'
  },
  slate: {
    card: 'border-slate-200 bg-white',
    icon: 'bg-slate-900 text-white',
    label: 'text-slate-500',
    sub: 'text-slate-500'
  }
};

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone?: KpiTone;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, icon, tone = 'slate' }) => {
  const toneClasses = KPI_TONE_CLASSES[tone];

  return (
    <div className={`group min-h-[116px] rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClasses.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${toneClasses.label}`}>{label}</p>
          <p className="mt-2 break-words text-2xl font-black leading-tight text-slate-950 tabular-nums">{value}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm ${toneClasses.icon}`}>
          {icon}
        </div>
      </div>
      {sub && <p className={`mt-3 text-xs font-bold leading-4 ${toneClasses.sub}`}>{sub}</p>}
    </div>
  );
};

const DispatchMetaItem: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <div className="mt-0.5 text-[11px] font-bold leading-4 text-slate-700">{children}</div>
  </div>
);

interface DeliveryLifecycleBoardProps {
  branch?: Branch | null;
  canTransition: boolean;
  canManageAll: boolean;
  focusOrderId?: string | null;
  focusOrderDate?: string | null;
  onFocusConsumed?: () => void;
  onOpenBenefitPayTransfer?: (order: DeliveryOrder) => void;
}

export const DeliveryLifecycleBoard: React.FC<DeliveryLifecycleBoardProps> = ({
  branch,
  canTransition,
  canManageAll,
  focusOrderId,
  focusOrderDate,
  onFocusConsumed,
  onOpenBenefitPayTransfer
}) => {
  const [preset, setPreset] = useState<PeriodPreset>('today');
  const [customFrom, setCustomFrom] = useState(todayKey());
  const [customTo, setCustomTo] = useState(todayKey());
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<DeliveryPaymentTypeConfig[]>([]);
  const [events, setEvents] = useState<DeliveryOrderEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [eventErrorMessage, setEventErrorMessage] = useState<string | null>(null);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [dispatchView, setDispatchView] = useState<DispatchView>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const range = getPresetRange(preset, customFrom, customTo);
  const label = periodLabel(preset, range.from, range.to);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setIsLoading(true);
    setErrorMessage(null);
    setEventErrorMessage(null);
    try {
      const [orderRows, paymentTypeRows] = await Promise.all([
        deliveryService.orders.list({
          branchId: branch?.id,
          dateFrom: range.from,
          dateTo: range.to,
          orderKind: canManageAll ? 'all' : 'actual_delivery'
        }),
        deliveryService.paymentTypes.list(true).catch(paymentTypeError => {
          console.warn('Delivery payment types unavailable for lifecycle board', paymentTypeError);
          return [] as DeliveryPaymentTypeConfig[];
        })
      ]);
      setOrders(orderRows);
      setPaymentTypes(paymentTypeRows);

      try {
        const eventRows = await deliveryService.lifecycle.listEvents({
          branchId: branch?.id,
          dateFrom: range.from,
          dateTo: range.to,
          limit: 300
        });
        if (canManageAll) {
          setEvents(eventRows);
        } else {
          const visibleOrderIds = new Set(orderRows.map(order => order.id));
          setEvents(eventRows.filter(event => visibleOrderIds.has(event.orderId)));
        }
      } catch (eventError: any) {
        console.warn('Delivery lifecycle events unavailable', eventError);
        setEvents([]);
        setEventErrorMessage(eventError?.message || 'Lifecycle traceability is unavailable until the Phase 1 migration is applied.');
      }
    } catch (loadError: any) {
      console.error('Delivery lifecycle board load failed', loadError);
      setOrders([]);
      setEvents([]);
      setErrorMessage(loadError?.message || 'Could not load delivery lifecycle data.');
    } finally {
      if (!options?.silent) setIsLoading(false);
    }
  }, [branch?.id, canManageAll, range.from, range.to]);

  useEffect(() => {
    load();
    const intervalId = window.setInterval(() => {
      load({ silent: true }).catch(refreshError => console.warn('Delivery lifecycle auto-refresh failed', refreshError));
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [load]);

  useEffect(() => {
    if (!focusOrderId) return;
    setHighlightedOrderId(focusOrderId);
    setDispatchView('all');
    setSearchQuery('');
    if (focusOrderDate) {
      setPreset('custom');
      setCustomFrom(focusOrderDate);
      setCustomTo(focusOrderDate);
    }
    onFocusConsumed?.();
  }, [focusOrderDate, focusOrderId, onFocusConsumed]);

  const statusCounts = useMemo(() => {
    const counts = new Map<DispatchStatus, number>();
    STATUS_ORDER.forEach(status => counts.set(status, 0));
    orders
      .filter(order => (isDriverDispatchOrder(order, paymentTypes) || isManualRecordedOnlyOrder(order))
        && (order.deliveryStatus !== 'cancelled' || order.cancelledReason?.startsWith('Customer return:')))
      .forEach(order => {
        const status = dispatchDisplayStatus(order);
        counts.set(status, (counts.get(status) || 0) + 1);
      });
    return counts;
  }, [orders, paymentTypes]);

  const internalDispatchOrders = useMemo(
    () => orders.filter(order => isDriverDispatchOrder(order, paymentTypes)),
    [orders, paymentTypes]
  );
  const dispatchBoardOrders = useMemo(
    () => orders.filter(order => (isDriverDispatchOrder(order, paymentTypes) || isManualRecordedOnlyOrder(order))
      && (order.deliveryStatus !== 'cancelled' || order.cancelledReason?.startsWith('Customer return:'))),
    [orders, paymentTypes]
  );
  const actualDispatchOrders = useMemo(
    () => internalDispatchOrders.filter(order => order.orderKind !== 'internal_transfer'),
    [internalDispatchOrders]
  );
  const transferDispatchOrders = useMemo(
    () => internalDispatchOrders.filter(order => order.orderKind === 'internal_transfer'),
    [internalDispatchOrders]
  );
  const externalNoBlockCount = orders.length - dispatchBoardOrders.length;
  const dispatchViews = useMemo(() => [
    { id: 'all' as const, label: 'All orders', count: dispatchBoardOrders.length },
    { id: 'recorded' as const, label: 'To assign', count: statusCounts.get('recorded') || 0 },
    { id: 'assigned' as const, label: 'Awaiting pickup', count: statusCounts.get('assigned') || 0 },
    { id: 'picked_up' as const, label: 'On the road', count: statusCounts.get('picked_up') || 0 },
    { id: 'closed' as const, label: 'Complete', count: statusCounts.get('delivered') || 0 },
    { id: 'returned' as const, label: 'Returned', count: statusCounts.get('returned') || 0 }
  ], [dispatchBoardOrders.length, statusCounts]);
  const visibleDispatchOrders = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return dispatchBoardOrders.filter(order => {
      const matchesView = dispatchView === 'all'
        || (dispatchView === 'closed'
          ? dispatchDisplayStatus(order) === 'delivered'
          : dispatchDisplayStatus(order) === dispatchView);
      if (!matchesView) return false;
      if (!query) return true;
      return [
        deliveryOrderNumber(order), order.blockNumber, order.driverName, order.branchName,
        order.transferFromBranchName, order.transferToBranchName, order.paymentType
      ].some(value => String(value || '').toLocaleLowerCase().includes(query));
    });
  }, [dispatchBoardOrders, dispatchView, searchQuery]);

  const valueInMotion = useMemo(
    () => internalDispatchOrders
      .filter(order => order.deliveryStatus === 'assigned' || order.deliveryStatus === 'picked_up')
      .reduce((total, order) => total + order.valueBhd, 0),
    [internalDispatchOrders]
  );
  const pendingCollectionValue = useMemo(
    () => internalDispatchOrders
      .filter(isPendingCollectionOrder)
      .reduce((total, order) => total + order.amountToCollectBhd, 0),
    [internalDispatchOrders]
  );

  const pickupBatchSizes = useMemo(() => {
    const sizes = new Map<string, number>();
    internalDispatchOrders.forEach(order => {
      if (!order.pickupBatchId) return;
      sizes.set(order.pickupBatchId, (sizes.get(order.pickupBatchId) || 0) + 1);
    });
    return sizes;
  }, [internalDispatchOrders]);

  const timingSummary = useMemo(() => {
    const pickupWaits = internalDispatchOrders.map(order =>
      minutesBetween(order.assignedAt || order.createdAt, order.pickedUpAt)
    );
    const driverDeliveryTimes = internalDispatchOrders.map(order =>
      minutesBetween(order.pickedUpAt, order.deliveredAt)
    );
    const totalFulfillmentTimes = internalDispatchOrders.map(order =>
      minutesBetween(order.assignedAt || order.createdAt, order.deliveredAt)
    );
    const batchCount = pickupBatchSizes.size;
    const batchOrderCount = [...pickupBatchSizes.values()].reduce((sum, size) => sum + size, 0);

    return {
      avgPickupWait: averageMinutes(pickupWaits),
      avgDriverDelivery: averageMinutes(driverDeliveryTimes),
      avgTotalFulfillment: averageMinutes(totalFulfillmentTimes),
      batchCount,
      avgBatchSize: batchCount ? Math.round((batchOrderCount / batchCount) * 10) / 10 : null
    };
  }, [internalDispatchOrders, pickupBatchSizes]);

  const dispatchKpis = useMemo<KpiCardProps[]>(() => {
    const assignedCount = statusCounts.get('assigned') || 0;
    const pickedUpCount = statusCounts.get('picked_up') || 0;
    const deliveredCount = statusCounts.get('delivered') || 0;
    const returnedCount = statusCounts.get('returned') || 0;

    if (!canManageAll) {
      return [
        {
          label: 'Dispatch total',
          value: String(dispatchBoardOrders.length),
          sub: label,
          tone: 'brand',
          icon: <PackageCheck className="h-4 w-4" />
        },
        {
          label: 'Assigned',
          value: String(assignedCount),
          sub: 'waiting pickup',
          tone: 'blue',
          icon: <Truck className="h-4 w-4" />
        },
        {
          label: 'Picked up',
          value: String(pickedUpCount),
          sub: 'on road now',
          tone: 'amber',
          icon: <Route className="h-4 w-4" />
        },
        {
          label: 'Delivered',
          value: String(deliveredCount),
          sub: 'completed',
          tone: 'emerald',
          icon: <CheckCircle2 className="h-4 w-4" />
        },
        { label: 'Returned orders', value: String(returnedCount), tone: 'amber', icon: <Route className="h-4 w-4" /> },
        {
          label: 'Pending collect',
          value: formatBhd(pendingCollectionValue),
          sub: 'cash to confirm',
          tone: 'rose',
          icon: <Clock3 className="h-4 w-4" />
        },
        {
          label: 'In motion value',
          value: formatBhd(valueInMotion),
          sub: 'assigned + picked up',
          tone: 'slate',
          icon: <Route className="h-4 w-4" />
        }
      ];
    }

    return [
      {
        label: 'Driver dispatch',
        value: String(internalDispatchOrders.length),
        sub: label,
        tone: 'brand',
        icon: <PackageCheck className="h-4 w-4" />
      },
      {
        label: 'Actual delivery',
        value: String(actualDispatchOrders.length),
        tone: 'blue',
        icon: <PackageCheck className="h-4 w-4" />
      },
      {
        label: 'Internal transfer',
        value: String(transferDispatchOrders.length),
        tone: 'amber',
        icon: <Route className="h-4 w-4" />
      },
      {
        label: 'Assigned',
        value: String(assignedCount),
        tone: 'blue',
        icon: <Truck className="h-4 w-4" />
      },
      {
        label: 'Picked up',
        value: String(pickedUpCount),
        tone: 'amber',
        icon: <Route className="h-4 w-4" />
      },
      {
        label: 'Delivered',
        value: String(deliveredCount),
        tone: 'emerald',
        icon: <CheckCircle2 className="h-4 w-4" />
      },
      { label: 'Returned orders', value: String(returnedCount), tone: 'amber', icon: <Route className="h-4 w-4" /> },
      {
        label: 'Pending collect',
        value: formatBhd(pendingCollectionValue),
        tone: 'rose',
        icon: <Clock3 className="h-4 w-4" />
      },
      {
        label: 'In motion value',
        value: formatBhd(valueInMotion),
        tone: 'slate',
        icon: <Clock3 className="h-4 w-4" />
      },
      {
        label: 'Avg delivery',
        value: formatDuration(timingSummary.avgDriverDelivery),
        sub: 'pickup to delivered',
        tone: 'slate',
        icon: <Route className="h-4 w-4" />
      },
      {
        label: 'Pickup runs',
        value: String(timingSummary.batchCount),
        sub: timingSummary.avgBatchSize ? `${timingSummary.avgBatchSize} orders/run avg` : 'awaiting batches',
        tone: 'slate',
        icon: <Truck className="h-4 w-4" />
      }
    ];
  }, [
    actualDispatchOrders.length,
    canManageAll,
    internalDispatchOrders.length,
    label,
    pendingCollectionValue,
    statusCounts,
    timingSummary.avgBatchSize,
    timingSummary.avgDriverDelivery,
    timingSummary.batchCount,
    transferDispatchOrders.length,
    valueInMotion
  ]);

  const recentEvents = useMemo(() => events.slice(0, 8), [events]);
  const lifecycleUnavailable = !!eventErrorMessage;

  const handlePeriodChange = (nextPreset: PeriodPreset, from?: string, to?: string) => {
    setPreset(nextPreset);
    if (from !== undefined) setCustomFrom(from);
    if (to !== undefined) setCustomTo(to);
  };

  const chooseDriver = async (order: DeliveryOrder) => {
    let branchDrivers: DeliveryDriver[] = [];
    try {
      branchDrivers = await deliveryService.drivers.listByBranch(order.branchId);
    } catch (driverLoadError: any) {
      await Swal.fire('Driver assignments unavailable', driverLoadError?.message || 'Could not load assigned drivers for this branch.', 'error');
      return null;
    }

    const options = branchDrivers.reduce<Record<string, string>>((driverOptions, driver) => {
      driverOptions[driver.id] = `${driver.driverCode ? `${driver.driverCode} - ` : ''}${driver.name}`;
      return driverOptions;
    }, {});

    if (Object.keys(options).length === 0) {
      await Swal.fire('No branch drivers', 'Assign active drivers to this branch from Access Control before dispatching orders.', 'warning');
      return null;
    }

    const result = await Swal.fire({
      title: order.driverId ? 'Confirm driver' : 'Assign driver',
      input: 'select',
      inputOptions: options,
      inputValue: order.driverId || undefined,
      inputPlaceholder: 'Select a driver',
      showCancelButton: true,
      confirmButtonText: 'Continue',
      inputValidator: value => value ? null : 'Select a driver first.'
    });

    return result.isConfirmed ? String(result.value) : null;
  };

  const handleReturnOrder = async (order: DeliveryOrder) => {
    if (lifecycleUnavailable) {
      await Swal.fire('Migration required', 'Apply the return-order migration before reopening closed delivery orders.', 'warning');
      return;
    }

    const result = await Swal.fire({
      title: 'Customer return?',
      html: `This will mark <b>${deliveryOrderNumber(order)}</b> as Returned in Dispatch.`,
      input: 'text',
      inputLabel: 'Return note',
      inputPlaceholder: 'Example: customer requested cancellation after close',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Return order',
      confirmButtonColor: '#B91c1c'
    });
    if (!result.isConfirmed) return;

    const notes = result.value ? String(result.value).trim() : null;
    setSavingOrderId(order.id);
    try {
      await deliveryService.lifecycle.customerReturnCompletedOrder(order.id, notes);
      await load();
      await Swal.fire('Order returned', `${deliveryOrderNumber(order)} is now Returned in Dispatch.`, 'success');
    } catch (returnError: any) {
      console.error('Delivery return failed', returnError);
      await Swal.fire('Return failed', returnError?.message || 'Could not return this delivery order.', 'error');
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleTransition = async (order: DeliveryOrder, nextStatus: DeliveryLifecycleStatus) => {
    if (lifecycleUnavailable) {
      await Swal.fire('Migration required', 'Apply the Phase 1 lifecycle migration before changing delivery lifecycle status.', 'warning');
      return;
    }

    let driverId = order.driverId || null;
    let notes: string | null = null;

    if ((nextStatus === 'assigned' || nextStatus === 'picked_up' || nextStatus === 'delivered') && !driverId) {
      const selectedDriverId = await chooseDriver(order);
      if (!selectedDriverId) return;
      driverId = selectedDriverId;
    }

    setSavingOrderId(order.id);
    try {
      await deliveryService.lifecycle.transition({
        orderId: order.id,
        nextStatus,
        driverId,
        notes,
        idempotencyKey: `${order.id}:${nextStatus}:${Date.now()}`
      });
      await load();
      await Swal.fire('Lifecycle updated', `Delivery marked as ${STATUS_META[nextStatus].label.toLowerCase()}.`, 'success');
    } catch (transitionError: any) {
      console.error('Delivery lifecycle transition failed', transitionError);
      await Swal.fire('Update failed', transitionError?.message || 'Could not update delivery lifecycle status.', 'error');
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleOpenBenefitPayTrace = async (order: DeliveryOrder) => {
    if (!isBenefitPayOrder(order)) return;
    if (!order.benefitPayReceivedTime) {
      await Swal.fire({
        title: 'Benefit Pay trace pending',
        text: 'Add or confirm the Benefit Pay received time first. The order will then appear automatically in Benefit Pay Recording & Traceability.',
        icon: 'info',
        confirmButtonText: 'Got it',
        confirmButtonColor: '#B91c1c'
      });
      return;
    }
    onOpenBenefitPayTransfer?.(order);
  };

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-sm print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-5 p-5 md:p-6">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-red-300">Delivery operations / Dispatch</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">Move orders forward.</h2>
            <p className="mt-2 text-xs font-medium text-slate-300">
              {branch ? branch.name : 'All operational branches'} · {label}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-slate-900">
              <PeriodFilter preset={preset} customFrom={customFrom} customTo={customTo} onChange={handlePeriodChange} />
            </div>
            <button type="button" onClick={() => load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 px-3 text-xs font-bold text-white transition hover:bg-white/10 disabled:opacity-50" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
      </header>

      {eventErrorMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p>Lifecycle migration is pending or unavailable.</p>
              <p className="mt-1 text-xs font-semibold">{eventErrorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-3 lg:grid-cols-6" aria-label="Dispatch stage filters">
        {dispatchViews.map(view => (
          <button
            key={view.id}
            type="button"
            onClick={() => setDispatchView(view.id)}
            aria-pressed={dispatchView === view.id}
            className={`min-w-0 border-b border-r border-slate-100 px-4 py-3 text-left transition hover:bg-brand/5 focus-visible:outline-brand ${dispatchView === view.id ? 'bg-brand/10 shadow-[inset_0_3px_0_#ef4444]' : ''}`}
          >
            <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">{view.label}</span>
            <span className={`mt-1 block font-mono text-2xl font-bold tabular-nums ${dispatchView === view.id ? 'text-brand' : 'text-slate-950'}`}>{view.count}</span>
          </button>
        ))}
      </div>
      {dispatchKpis.some(kpi => !['Dispatch total', 'Assigned', 'Picked up', 'Delivered', 'Returned orders'].includes(kpi.label)) && (
        <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-xs font-bold text-slate-600 focus-visible:outline-brand">More operating metrics</summary>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 lg:grid-cols-3">
            {dispatchKpis.filter(kpi => !['Dispatch total', 'Assigned', 'Picked up', 'Delivered', 'Returned orders'].includes(kpi.label)).map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
          </div>
        </details>
      )}

      <section className="space-y-4">
        <div className="operational-panel overflow-hidden p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black text-slate-900">Dispatch queue <span className="font-mono text-sm text-slate-400">/ {visibleDispatchOrders.length}</span></h3>
              <p className="mt-1 text-xs font-medium text-slate-500">Find an order, then use its next action. Open details only when needed.</p>
              {externalNoBlockCount > 0 && (
                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-orange-600">
                  {externalNoBlockCount} external/no-block order{externalNoBlockCount === 1 ? '' : 's'} hidden from dispatch
                </p>
              )}
            </div>
            {!canTransition && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Read only
              </span>
            )}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4">
            <label className="relative block min-w-[220px] flex-1">
              <span className="sr-only">Search dispatch orders</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search order, driver, block or branch"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none"
              />
            </label>
            <span className="font-mono text-[11px] text-slate-500" role="status">{visibleDispatchOrders.length} shown / {dispatchBoardOrders.length} total</span>
          </div>

          {isLoading ? (
            <div className="flex h-44 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand"></div>
            </div>
          ) : visibleDispatchOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">
              <p className="text-sm font-bold text-slate-700">No orders match this view.</p>
              <p className="mt-1 text-xs text-slate-500">Try another stage, search term or date range.</p>
              <button type="button" onClick={() => { setSearchQuery(''); setDispatchView('all'); }} className="mt-3 text-xs font-bold text-brand hover:underline">Show all orders</button>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleDispatchOrders.map(order => {
                const isRecordedOnly = isManualRecordedOnlyOrder(order);
                const displayStatus = dispatchDisplayStatus(order);
                const displayDriverName = isRecordedOnly
                  ? order.recordedDriverName || order.recordedDriverCode || order.driverName
                  : order.driverName;
                const canActOnOrder = !isRecordedOnly
                  && canTransition
                  && !lifecycleUnavailable
                  && (canManageAll || isInsideBranchTransitionWindow(order));
                const canAdvanceOrder = canActOnOrder && !isClosedOrder(order);
                const canReturnOrder = canTransition
                  && !lifecycleUnavailable
                  && (isRecordedOnly && order.deliveryStatus === 'recorded'
                    || !isRecordedOnly && order.deliveryStatus === 'delivered' && Boolean(order.pickedUpAt && order.deliveredAt));
                const nextStatuses = isRecordedOnly ? [] : nextStatusesFor(order.deliveryStatus);
                const pickupWait = minutesBetween(order.assignedAt || order.createdAt, order.pickedUpAt);
                const driverDelivery = minutesBetween(order.pickedUpAt, order.deliveredAt);
                const totalFulfillment = minutesBetween(order.assignedAt || order.createdAt, order.deliveredAt);
                const batchSize = order.pickupBatchId ? pickupBatchSizes.get(order.pickupBatchId) || 1 : null;
                const branchLabel = order.transferFromBranchName || order.branchName || 'Unknown branch';
                const routeLabel = order.orderKind === 'internal_transfer'
                  ? `${order.transferFromBranchName || order.branchName || 'Source'} -> ${order.transferToBranchName || 'Destination'}`
                  : `${order.paymentType}${order.blockNumber ? ` - Block ${order.blockNumber}` : ''}`;
                const isHighlightedOrder = highlightedOrderId === order.id;

                return (
                  <article
                    key={order.id}
                    className={`overflow-hidden rounded-xl border border-l-4 bg-white shadow-sm transition hover:shadow-md ${
                      isHighlightedOrder ? 'border-brand ring-2 ring-brand/20' : displayStatus === 'recorded' ? 'border-slate-200 border-l-brand' : displayStatus === 'picked_up' ? 'border-slate-200 border-l-amber-500' : displayStatus === 'assigned' ? 'border-slate-200 border-l-blue-500' : 'border-slate-200 border-l-slate-300'
                    }`}
                  >
                    <div className="flex flex-col gap-3 p-3.5 md:flex-row md:items-center md:justify-between md:gap-5 md:p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-xs font-bold text-brand">
                            {deliveryOrderNumber(order)}
                          </p>
                          {isBenefitPayOrder(order) && onOpenBenefitPayTransfer && (
                            <button
                              type="button"
                              onClick={() => handleOpenBenefitPayTrace(order)}
                              className={benefitPayTraceIconClass}
                              title="Open Benefit Pay trace"
                              aria-label="Open Benefit Pay trace"
                            >
                              <ArrowUpRight className="h-3 w-3" />
                            </button>
                          )}
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                            order.orderKind === 'internal_transfer'
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'border-slate-200 bg-slate-50 text-slate-600'
                          }`}>
                            {order.orderKind === 'internal_transfer' ? 'Transfer' : 'Delivery'}
                          </span>
                          <StatusBadge status={displayStatus} />
                          {isPendingCollectionOrder(order) && (
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${collectionValueBadgeClass(order)}`}>
                              Collect {formatBhd(order.amountToCollectBhd)}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 break-words text-sm font-black leading-5 text-slate-950">{routeLabel}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          {order.orderDate}{!branch ? ` · ${branchLabel}` : ''} · <span className={displayDriverName ? 'text-slate-700' : 'font-bold text-brand'}>{displayDriverName || 'Driver not assigned'}</span>
                        </p>
                      </div>

                      <div className="shrink-0 border-t border-slate-100 pt-2 md:min-w-[112px] md:border-l md:border-t-0 md:pl-4 md:pt-0 md:text-right">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Order value</p>
                        <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-950">{formatBhd(order.valueBhd)}</p>
                      </div>
                    </div>

                    <details className="group/details border-t border-slate-100 bg-slate-50/50">
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 focus-visible:outline-brand md:px-4 [&::-webkit-details-marker]:hidden">
                        <span>Payment, timing &amp; route details</span>
                        <span className="ml-auto font-mono text-[10px] text-slate-400 group-open/details:hidden">Show +</span>
                        <span className="ml-auto hidden font-mono text-[10px] text-slate-400 group-open/details:inline">Hide −</span>
                      </summary>
                      <div className="border-t border-slate-100 px-3.5 pb-3 pt-2 md:px-4">
                    {order.orderKind !== 'internal_transfer' && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${PAYMENT_COLLECTION_META[order.paymentCollectionStatus].className}`}>
                          {PAYMENT_COLLECTION_META[order.paymentCollectionStatus].label}
                        </span>
                        {isPendingCollectionOrder(order) && (
                          <span className={`inline-flex rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${collectionValueBadgeClass(order)}`}>
                            Cash {formatBhd(order.amountToCollectBhd)}
                          </span>
                        )}
                        {order.cashHandedToDriverBhd > 0 && (
                          <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-600">
                            driver change {formatBhd(order.cashHandedToDriverBhd)}
                          </span>
                        )}
                      </div>
                    )}

                    {order.driverPaymentNote && (
                      <p className="mt-1.5 truncate text-[10px] font-semibold text-red-600" title={order.driverPaymentNote}>
                        {order.driverPaymentNote}
                      </p>
                    )}

                    <div className="mt-2 grid gap-x-3 gap-y-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                      {!branch && (
                        <DispatchMetaItem label="Branch">
                          <span className="break-words">{branchLabel}</span>
                        </DispatchMetaItem>
                      )}
                      <DispatchMetaItem label="Driver">
                        <span className={displayDriverName ? 'text-slate-900' : 'text-slate-300'}>
                          {displayDriverName || 'Unassigned'}
                          {isRecordedOnly && <span className="ml-1 text-slate-500">· Recorded only</span>}
                        </span>
                      </DispatchMetaItem>
                      <DispatchMetaItem label="Timing">
                        {isRecordedOnly ? (
                          <span className="text-slate-500">Not recorded for Log Only orders</span>
                        ) : (
                          <>
                            <p>Pickup wait: <span className="text-slate-900">{formatDuration(pickupWait)}</span></p>
                            <p>Driver time: <span className="text-slate-900">{formatDuration(driverDelivery)}</span></p>
                            <p>Total: <span className="text-slate-900">{formatDuration(totalFulfillment)}</span></p>
                          </>
                        )}
                      </DispatchMetaItem>
                      <DispatchMetaItem label="Pickup run">
                        {isRecordedOnly ? (
                          <span className="text-slate-500">No driver run</span>
                        ) : order.pickupBatchId ? (
                          <>
                            <p className="font-black text-slate-900">Run #{shortRunId(order.pickupBatchId)}</p>
                            <p>{batchSize} order{batchSize === 1 ? '' : 's'} together</p>
                            {order.batchDeliverySequence ? <p>Stop {order.batchDeliverySequence}</p> : null}
                          </>
                        ) : (
                          <span className="text-slate-300">Not picked up</span>
                        )}
                      </DispatchMetaItem>
                      <DispatchMetaItem label="Last update">
                        <span>{lifecycleTimeFor(order) || '-'}</span>
                      </DispatchMetaItem>
                    </div>
                      </div>
                    </details>

                    {canTransition && (
                      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-3.5 py-2.5 md:px-4">
                        {nextStatuses.length === 0 ? (
                          canReturnOrder ? (
                            <button
                              type="button"
                              disabled={savingOrderId === order.id}
                              onClick={() => handleReturnOrder(order)}
                              className="min-h-9 rounded-lg border border-brand/20 bg-brand/5 px-3 text-xs font-bold text-brand transition hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {savingOrderId === order.id ? 'Saving' : 'Customer return'}
                            </button>
                          ) : (
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{isRecordedOnly ? 'Recorded only' : order.deliveryStatus === 'cancelled' ? 'Returned' : 'Complete'}</span>
                          )
                        ) : (
                          nextStatuses.map(nextStatus => (
                            <button
                              key={nextStatus}
                              type="button"
                              disabled={!canAdvanceOrder || savingOrderId === order.id}
                              onClick={() => handleTransition(order, nextStatus)}
                              className={`min-h-9 rounded-lg border px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                nextStatus === 'cancelled'
                                  ? 'border-red-200 bg-white text-red-700 hover:bg-red-50'
                                  : 'border-brand bg-brand text-white hover:brightness-110'
                              }`}
                            >
                              {savingOrderId === order.id ? 'Saving' : nextStatus === 'cancelled' ? 'Customer cancel' : STATUS_META[nextStatus].label}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <details className="operational-panel p-4 md:p-5">
          <summary className="cursor-pointer text-sm font-black text-slate-800 focus-visible:outline-brand">
            Lifecycle trace <span className="ml-2 font-mono text-xs text-slate-400">{recentEvents.length} recent events</span>
          </summary>
          <p className="mt-1 text-xs font-medium text-slate-500">Append-only events after migration approval.</p>
          <div className="mt-4">
          {eventErrorMessage ? (
            <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-5 text-amber-800">
              Event trace is pending until the local Phase 1 migration is approved and applied.
            </p>
          ) : recentEvents.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-xs font-bold leading-5 text-slate-400">
              No lifecycle events recorded in this period yet.
            </p>
          ) : (
            <div className="space-y-3">
              {recentEvents.map(event => (
                <div key={event.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={event.newStatus} />
                    <span className="text-[10px] font-bold text-slate-400">{event.createdAt}</span>
                  </div>
                  <p className="mt-2 text-xs font-black text-slate-700">{event.branchName || 'Branch'} {event.driverName ? `- ${event.driverName}` : ''}</p>
                  {event.notes && <p className="mt-1 text-xs font-semibold text-slate-500">{event.notes}</p>}
                </div>
              ))}
            </div>
          )}
          </div>
        </details>
      </section>
    </div>
  );
};
