import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  PackageCheck,
  RefreshCw,
  Route,
  Truck,
  XCircle
} from 'lucide-react';
import Swal from 'sweetalert2';
import { deliveryService } from '../../services/deliveryService';
import { Branch, DeliveryDriver, DeliveryLifecycleStatus, DeliveryOrder, DeliveryOrderEvent, DeliveryPaymentCollectionStatus, DeliveryPaymentTypeConfig } from '../../types';
import { isDeliveryPaymentBlockExempt } from '../../lib/deliveryPaymentTypes';
import { PeriodFilter } from './components/PeriodFilter';
import { PeriodPreset, formatBhd, getPresetRange, periodLabel, todayKey, yesterdayKey } from './utils';

const STATUS_META: Record<DeliveryLifecycleStatus, { label: string; className: string; icon: React.ElementType }> = {
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
    label: 'Delivered',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2
  },
  cancelled: {
    label: 'Cancelled',
    className: 'border-red-200 bg-red-50 text-red-700',
    icon: XCircle
  }
};

const STATUS_ORDER: DeliveryLifecycleStatus[] = ['recorded', 'assigned', 'picked_up', 'delivered', 'cancelled'];

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
  if (status === 'recorded') return ['assigned', 'cancelled'];
  if (status === 'assigned') return ['picked_up', 'cancelled'];
  if (status === 'picked_up') return ['delivered', 'cancelled'];
  return [];
};

const isClosedOrder = (order: DeliveryOrder) =>
  order.deliveryStatus === 'delivered' || order.deliveryStatus === 'cancelled';

const isDriverDispatchOrder = (order: DeliveryOrder, paymentTypes: DeliveryPaymentTypeConfig[]) =>
  order.orderKind === 'internal_transfer' || !isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes);

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

const StatusBadge: React.FC<{ status: DeliveryLifecycleStatus }> = ({ status }) => {
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
    if (focusOrderDate) {
      setPreset('custom');
      setCustomFrom(focusOrderDate);
      setCustomTo(focusOrderDate);
    }
    onFocusConsumed?.();
  }, [focusOrderDate, focusOrderId, onFocusConsumed]);

  const statusCounts = useMemo(() => {
    const counts = new Map<DeliveryLifecycleStatus, number>();
    STATUS_ORDER.forEach(status => counts.set(status, 0));
    orders
      .filter(order => isDriverDispatchOrder(order, paymentTypes))
      .forEach(order => counts.set(order.deliveryStatus, (counts.get(order.deliveryStatus) || 0) + 1));
    return counts;
  }, [orders, paymentTypes]);

  const internalDispatchOrders = useMemo(
    () => orders.filter(order => isDriverDispatchOrder(order, paymentTypes)),
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
  const externalNoBlockCount = orders.length - internalDispatchOrders.length;

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

    if (!canManageAll) {
      return [
        {
          label: 'Dispatch total',
          value: String(internalDispatchOrders.length),
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

  const handleCustomerCancel = async (order: DeliveryOrder) => {
    if (lifecycleUnavailable) {
      await Swal.fire('Migration required', 'Apply the Phase 1 lifecycle migration before changing delivery lifecycle status.', 'warning');
      return;
    }

    const result = await Swal.fire({
      title: 'Customer cancelled this order?',
      html: `This will remove <b>${deliveryOrderNumber(order)}</b> from Dispatch, Recording, and driver history.`,
      input: 'text',
      inputLabel: 'Reason or note',
      inputPlaceholder: 'Example: customer cancelled before delivery',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cancel and remove',
      confirmButtonColor: '#B91c1c'
    });
    if (!result.isConfirmed) return;

    const notes = result.value ? String(result.value).trim() : null;
    setSavingOrderId(order.id);
    try {
      await deliveryService.lifecycle.cancelCustomerOrder({
        orderId: order.id,
        notes
      });
      await load();
      await Swal.fire('Customer order cancelled', `${deliveryOrderNumber(order)} was removed from delivery records.`, 'success');
    } catch (cancelError: any) {
      console.error('Customer delivery cancellation failed', cancelError);
      await Swal.fire('Cancel failed', cancelError?.message || 'Could not cancel and remove this delivery order.', 'error');
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleReturnOrder = async (order: DeliveryOrder) => {
    if (lifecycleUnavailable) {
      await Swal.fire('Migration required', 'Apply the return-order migration before reopening closed delivery orders.', 'warning');
      return;
    }

    const result = await Swal.fire({
      title: 'Return closed order?',
      html: `This will reopen <b>${deliveryOrderNumber(order)}</b> so it can be cancelled or processed again.`,
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
      const event = await deliveryService.lifecycle.returnOrder({
        orderId: order.id,
        notes,
        idempotencyKey: `${order.id}:return:${Date.now()}`
      });
      await load();
      await Swal.fire('Order returned', `Delivery reopened as ${STATUS_META[event.newStatus].label.toLowerCase()}.`, 'success');
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

    if (nextStatus === 'cancelled') {
      await handleCustomerCancel(order);
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
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <PeriodFilter preset={preset} customFrom={customFrom} customTo={customTo} onChange={handlePeriodChange} />
        <button onClick={load} className="btn-secondary text-[10px] uppercase tracking-widest" disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

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

      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        {dispatchKpis.map(kpi => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            sub={kpi.sub}
            icon={kpi.icon}
            tone={kpi.tone}
          />
        ))}
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="operational-panel p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Dispatch queue</h3>
              <p className="mt-1 text-xs font-bold text-slate-400">
                {branch ? branch.name : 'All operational branches'} - {label}
              </p>
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

          {isLoading ? (
            <div className="flex h-44 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand"></div>
            </div>
          ) : internalDispatchOrders.length === 0 ? (
            <p className="py-12 text-center text-xs font-bold text-slate-400">No internal driver dispatch orders in this period.</p>
          ) : (
            <div className="space-y-2.5">
              {internalDispatchOrders.map(order => {
                const canActOnOrder = canTransition
                  && !lifecycleUnavailable
                  && (canManageAll || isInsideBranchTransitionWindow(order));
                const canAdvanceOrder = canActOnOrder && !isClosedOrder(order);
                const canReturnOrder = canActOnOrder && isClosedOrder(order);
                const nextStatuses = nextStatusesFor(order.deliveryStatus);
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
                    className={`rounded-lg border bg-white p-3 shadow-sm transition hover:border-brand/30 hover:bg-slate-50/40 hover:shadow-md ${
                      isHighlightedOrder ? 'border-brand/30 ring-2 ring-brand/20' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-brand">
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
                          <StatusBadge status={order.deliveryStatus} />
                        </div>
                        <p className="mt-1 break-words text-[13px] font-black leading-5 text-slate-950">{routeLabel}</p>
                        <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                          {order.orderDate}{!branch ? ` - ${branchLabel}` : ''}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-1.5 lg:justify-end">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left lg:text-right">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Value</p>
                          <p className="mt-0.5 text-base font-black leading-none text-slate-950 tabular-nums">
                            {formatBhd(order.valueBhd)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {order.orderKind !== 'internal_transfer' && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${PAYMENT_COLLECTION_META[order.paymentCollectionStatus].className}`}>
                          {PAYMENT_COLLECTION_META[order.paymentCollectionStatus].label}
                        </span>
                        {isPendingCollectionOrder(order) && (
                          <span className={`inline-flex rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${collectionValueBadgeClass(order)}`}>
                            COD {formatBhd(order.amountToCollectBhd)}
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
                        <span className={order.driverName ? 'text-slate-900' : 'text-slate-300'}>
                          {order.driverName || 'Unassigned'}
                        </span>
                      </DispatchMetaItem>
                      <DispatchMetaItem label="Timing">
                        <p>Pickup wait: <span className="text-slate-900">{formatDuration(pickupWait)}</span></p>
                        <p>Driver time: <span className="text-slate-900">{formatDuration(driverDelivery)}</span></p>
                        <p>Total: <span className="text-slate-900">{formatDuration(totalFulfillment)}</span></p>
                      </DispatchMetaItem>
                      <DispatchMetaItem label="Pickup run">
                        {order.pickupBatchId ? (
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

                    {canTransition && (
                      <div className="mt-2 flex flex-wrap justify-end gap-1.5 border-t border-slate-100 pt-2">
                        {nextStatuses.length === 0 ? (
                          canReturnOrder ? (
                            <button
                              type="button"
                              disabled={savingOrderId === order.id}
                              onClick={() => handleReturnOrder(order)}
                              className="rounded-lg border border-brand/20 bg-brand/5 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-brand shadow-sm transition hover:border-brand/40 hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {savingOrderId === order.id ? 'Saving' : 'Return'}
                            </button>
                          ) : (
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Closed</span>
                          )
                        ) : (
                          nextStatuses.map(nextStatus => (
                            <button
                              key={nextStatus}
                              type="button"
                              disabled={!canAdvanceOrder || savingOrderId === order.id}
                              onClick={() => handleTransition(order, nextStatus)}
                              className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                nextStatus === 'cancelled'
                                  ? 'border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand/30 hover:text-brand'
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

        <aside className="operational-panel p-4 md:p-5">
          <div className="mb-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Lifecycle trace</h3>
            <p className="mt-1 text-xs font-bold text-slate-400">Append-only events after migration approval.</p>
          </div>
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
        </aside>
      </section>
    </div>
  );
};
