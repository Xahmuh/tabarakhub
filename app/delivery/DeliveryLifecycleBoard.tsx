import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
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

const isDriverDispatchOrder = (order: DeliveryOrder, paymentTypes: DeliveryPaymentTypeConfig[]) =>
  order.orderKind === 'internal_transfer' || !isDeliveryPaymentBlockExempt(order.paymentType, paymentTypes);

const isPendingCollectionOrder = (order: DeliveryOrder) =>
  order.paymentCollectionStatus !== 'paid' && order.amountToCollectBhd > 0;

const StatusBadge: React.FC<{ status: DeliveryLifecycleStatus }> = ({ status }) => {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${meta.className}`}>
      <Icon className="h-3 w-3" /> {meta.label}
    </span>
  );
};

const KpiCard: React.FC<{ label: string; value: string; sub?: string; icon: React.ReactNode }> = ({ label, value, sub, icon }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/5 text-brand">{icon}</div>
    </div>
    <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 tabular-nums">{value}</p>
    {sub && <p className="mt-1 text-xs font-bold text-slate-500">{sub}</p>}
  </div>
);

interface DeliveryLifecycleBoardProps {
  branch?: Branch | null;
  canTransition: boolean;
  canManageAll: boolean;
}

export const DeliveryLifecycleBoard: React.FC<DeliveryLifecycleBoardProps> = ({ branch, canTransition, canManageAll }) => {
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
          dateTo: range.to
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
        setEvents(eventRows);
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
  }, [branch?.id, range.from, range.to]);

  useEffect(() => {
    load();
    const intervalId = window.setInterval(() => {
      load({ silent: true }).catch(refreshError => console.warn('Delivery lifecycle auto-refresh failed', refreshError));
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [load]);

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

    if (nextStatus === 'cancelled') {
      const result = await Swal.fire({
        title: 'Cancel delivery lifecycle?',
        input: 'text',
        inputLabel: 'Reason or note',
        inputPlaceholder: 'Example: customer cancelled',
        showCancelButton: true,
        confirmButtonText: 'Cancel delivery',
        confirmButtonColor: '#B91c1c'
      });
      if (!result.isConfirmed) return;
      notes = result.value ? String(result.value).trim() : null;
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

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 2xl:grid-cols-9">
        <KpiCard label="Driver dispatch" value={String(internalDispatchOrders.length)} sub={label} icon={<PackageCheck className="h-4 w-4" />} />
        <KpiCard label="Actual delivery" value={String(actualDispatchOrders.length)} icon={<PackageCheck className="h-4 w-4" />} />
        <KpiCard label="Internal transfer" value={String(transferDispatchOrders.length)} icon={<Route className="h-4 w-4" />} />
        <KpiCard label="Assigned" value={String(statusCounts.get('assigned') || 0)} icon={<Truck className="h-4 w-4" />} />
        <KpiCard label="Picked up" value={String(statusCounts.get('picked_up') || 0)} icon={<Route className="h-4 w-4" />} />
        <KpiCard label="Delivered" value={String(statusCounts.get('delivered') || 0)} icon={<CheckCircle2 className="h-4 w-4" />} />
        <KpiCard label="Pending collect" value={formatBhd(pendingCollectionValue)} icon={<Clock3 className="h-4 w-4" />} />
        <KpiCard label="In motion value" value={formatBhd(valueInMotion)} icon={<Clock3 className="h-4 w-4" />} />
        <KpiCard label="Avg delivery" value={formatDuration(timingSummary.avgDriverDelivery)} sub="pickup to delivered" icon={<Route className="h-4 w-4" />} />
        <KpiCard label="Pickup runs" value={String(timingSummary.batchCount)} sub={timingSummary.avgBatchSize ? `${timingSummary.avgBatchSize} orders/run avg` : 'awaiting batches'} icon={<Truck className="h-4 w-4" />} />
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="py-2 pr-3">Order</th>
                    <th className="py-2 pr-3">Type</th>
                    {!branch && <th className="py-2 pr-3">Branch</th>}
                    <th className="py-2 pr-3">Driver</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Timing</th>
                    <th className="py-2 pr-3">Pickup run</th>
                    <th className="py-2 pr-3">Last lifecycle time</th>
                    {canTransition && <th className="py-2 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {internalDispatchOrders.map(order => {
                    const canActOnOrder = canTransition
                      && !lifecycleUnavailable
                      && (canManageAll || isInsideBranchTransitionWindow(order))
                      && !['delivered', 'cancelled'].includes(order.deliveryStatus);
                    const nextStatuses = nextStatusesFor(order.deliveryStatus);
                    const pickupWait = minutesBetween(order.assignedAt || order.createdAt, order.pickedUpAt);
                    const driverDelivery = minutesBetween(order.pickedUpAt, order.deliveredAt);
                    const totalFulfillment = minutesBetween(order.assignedAt || order.createdAt, order.deliveredAt);
                    const batchSize = order.pickupBatchId ? pickupBatchSizes.get(order.pickupBatchId) || 1 : null;
                    return (
                      <tr key={order.id} className="hover:bg-slate-50/50">
                        <td className="py-3 pr-3">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-brand">
                            {deliveryOrderNumber(order)}
                          </p>
                          <p className="text-xs font-black text-slate-900">
                            {order.orderDate} - {order.orderKind === 'internal_transfer' ? 'Internal transfer' : formatBhd(order.valueBhd)}
                          </p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {order.orderKind === 'internal_transfer'
                              ? `${order.transferFromBranchName || order.branchName || 'Source'} -> ${order.transferToBranchName || 'Destination'}`
                              : `${order.paymentType} ${order.blockNumber ? `- Block ${order.blockNumber}` : ''}`}
                          </p>
                          {order.orderKind !== 'internal_transfer' && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className={`inline-flex rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${PAYMENT_COLLECTION_META[order.paymentCollectionStatus].className}`}>
                                {PAYMENT_COLLECTION_META[order.paymentCollectionStatus].label}
                              </span>
                              {isPendingCollectionOrder(order) && (
                                <span className="inline-flex rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-red-700">
                                  collect {formatBhd(order.amountToCollectBhd)}
                                </span>
                              )}
                              {order.cashHandedToDriverBhd > 0 && (
                                <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-600">
                                  driver cash {formatBhd(order.cashHandedToDriverBhd)}
                                </span>
                              )}
                            </div>
                          )}
                          {order.driverPaymentNote && (
                            <p className="mt-1 max-w-[280px] truncate text-[10px] font-semibold text-red-600" title={order.driverPaymentNote}>
                              {order.driverPaymentNote}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                            order.orderKind === 'internal_transfer'
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'border-slate-200 bg-slate-50 text-slate-600'
                          }`}>
                            {order.orderKind === 'internal_transfer' ? 'Transfer' : 'Delivery'}
                          </span>
                        </td>
                        {!branch && (
                          <td className="py-3 pr-3 text-xs font-bold text-slate-500">
                            {order.transferFromBranchName || order.branchName || 'Unknown branch'}
                          </td>
                        )}
                        <td className="py-3 pr-3 text-xs font-bold text-slate-500">{order.driverName || 'Unassigned'}</td>
                        <td className="py-3 pr-3"><StatusBadge status={order.deliveryStatus} /></td>
                        <td className="py-3 pr-3 text-[10px] font-bold leading-5 text-slate-500">
                          <p>Pickup wait: <span className="text-slate-800">{formatDuration(pickupWait)}</span></p>
                          <p>Driver time: <span className="text-slate-800">{formatDuration(driverDelivery)}</span></p>
                          <p>Total: <span className="text-slate-800">{formatDuration(totalFulfillment)}</span></p>
                        </td>
                        <td className="py-3 pr-3 text-[10px] font-bold leading-5 text-slate-500">
                          {order.pickupBatchId ? (
                            <>
                              <p className="font-black text-slate-700">Run #{shortRunId(order.pickupBatchId)}</p>
                              <p>{batchSize} order{batchSize === 1 ? '' : 's'} picked up together</p>
                              {order.batchDeliverySequence ? <p>Stop {order.batchDeliverySequence}</p> : null}
                            </>
                          ) : (
                            <span className="text-slate-300">Not picked up</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-xs font-bold text-slate-500">{lifecycleTimeFor(order) || '-'}</td>
                        {canTransition && (
                          <td className="py-3 text-right">
                            {nextStatuses.length === 0 ? (
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Closed</span>
                            ) : (
                              <div className="inline-flex flex-wrap justify-end gap-1">
                                {nextStatuses.map(nextStatus => (
                                  <button
                                    key={nextStatus}
                                    type="button"
                                    disabled={!canActOnOrder || savingOrderId === order.id}
                                    onClick={() => handleTransition(order, nextStatus)}
                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 shadow-sm transition hover:border-brand/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    {savingOrderId === order.id ? 'Saving' : STATUS_META[nextStatus].label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
