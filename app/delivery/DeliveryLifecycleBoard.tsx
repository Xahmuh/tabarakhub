import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  History,
  PackageCheck,
  RefreshCw,
  Route,
  Truck,
  XCircle
} from 'lucide-react';
import Swal from 'sweetalert2';
import { deliveryService } from '../../services/deliveryService';
import { Branch, DeliveryDriver, DeliveryLifecycleStatus, DeliveryOrder, DeliveryOrderEvent } from '../../types';
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

const lifecycleTimeFor = (order: DeliveryOrder) =>
  order.deliveredAt || order.pickedUpAt || order.assignedAt || order.cancelledAt || order.lifecycleUpdatedAt || order.createdAt;

const isInsideBranchTransitionWindow = (order: DeliveryOrder) =>
  order.orderDate >= yesterdayKey() && order.orderDate <= todayKey();

const nextStatusesFor = (status: DeliveryLifecycleStatus): DeliveryLifecycleStatus[] => {
  if (status === 'recorded') return ['assigned', 'cancelled'];
  if (status === 'assigned') return ['picked_up', 'delivered', 'cancelled'];
  if (status === 'picked_up') return ['delivered', 'cancelled'];
  return [];
};

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
  const [events, setEvents] = useState<DeliveryOrderEvent[]>([]);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [eventErrorMessage, setEventErrorMessage] = useState<string | null>(null);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);

  const range = getPresetRange(preset, customFrom, customTo);
  const label = periodLabel(preset, range.from, range.to);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setEventErrorMessage(null);
    try {
      const [orderRows, driverRows] = await Promise.all([
        deliveryService.orders.list({
          branchId: branch?.id,
          dateFrom: range.from,
          dateTo: range.to
        }),
        deliveryService.drivers.list()
      ]);
      setOrders(orderRows);
      setDrivers(driverRows);

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
      setIsLoading(false);
    }
  }, [branch?.id, range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  const statusCounts = useMemo(() => {
    const counts = new Map<DeliveryLifecycleStatus, number>();
    STATUS_ORDER.forEach(status => counts.set(status, 0));
    orders.forEach(order => counts.set(order.deliveryStatus, (counts.get(order.deliveryStatus) || 0) + 1));
    return counts;
  }, [orders]);

  const valueInMotion = useMemo(
    () => orders
      .filter(order => order.deliveryStatus === 'assigned' || order.deliveryStatus === 'picked_up')
      .reduce((total, order) => total + order.valueBhd, 0),
    [orders]
  );

  const recentEvents = useMemo(() => events.slice(0, 8), [events]);
  const lifecycleUnavailable = !!eventErrorMessage;

  const handlePeriodChange = (nextPreset: PeriodPreset, from?: string, to?: string) => {
    setPreset(nextPreset);
    if (from !== undefined) setCustomFrom(from);
    if (to !== undefined) setCustomTo(to);
  };

  const chooseDriver = async (order: DeliveryOrder) => {
    const options = drivers.reduce<Record<string, string>>((driverOptions, driver) => {
      driverOptions[driver.id] = `${driver.driverCode ? `${driver.driverCode} - ` : ''}${driver.name}`;
      return driverOptions;
    }, {});

    if (Object.keys(options).length === 0) {
      await Swal.fire('No active drivers', 'Add or activate drivers in Delivery Settings before assigning orders.', 'warning');
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

      <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm font-semibold leading-6 text-blue-900">
        <div className="flex items-start gap-3">
          <History className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <div>
            <p className="font-black">Phase 1 internal lifecycle tracking</p>
            <p className="mt-1 text-xs font-bold text-blue-800/80">
              This board uses existing delivery orders and drivers. Orders assigned to a linked driver account appear in the driver mobile app, while admin/branch lifecycle changes continue through strict audited RPCs.
            </p>
          </div>
        </div>
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

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <KpiCard label="Total orders" value={String(orders.length)} sub={label} icon={<PackageCheck className="h-4 w-4" />} />
        <KpiCard label="Assigned" value={String(statusCounts.get('assigned') || 0)} icon={<Truck className="h-4 w-4" />} />
        <KpiCard label="Picked up" value={String(statusCounts.get('picked_up') || 0)} icon={<Route className="h-4 w-4" />} />
        <KpiCard label="Delivered" value={String(statusCounts.get('delivered') || 0)} icon={<CheckCircle2 className="h-4 w-4" />} />
        <KpiCard label="In motion value" value={formatBhd(valueInMotion)} icon={<Clock3 className="h-4 w-4" />} />
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="operational-panel p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Dispatch queue</h3>
              <p className="mt-1 text-xs font-bold text-slate-400">
                {branch ? branch.name : 'All operational branches'} - {label}
              </p>
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
          ) : orders.length === 0 ? (
            <p className="py-12 text-center text-xs font-bold text-slate-400">No delivery orders in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="py-2 pr-3">Order</th>
                    {!branch && <th className="py-2 pr-3">Branch</th>}
                    <th className="py-2 pr-3">Driver</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Last lifecycle time</th>
                    {canTransition && <th className="py-2 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {orders.map(order => {
                    const canActOnOrder = canTransition
                      && !lifecycleUnavailable
                      && (canManageAll || isInsideBranchTransitionWindow(order))
                      && !['delivered', 'cancelled'].includes(order.deliveryStatus);
                    const nextStatuses = nextStatusesFor(order.deliveryStatus);
                    return (
                      <tr key={order.id} className="hover:bg-slate-50/50">
                        <td className="py-3 pr-3">
                          <p className="text-xs font-black text-slate-900">{order.orderDate} - {formatBhd(order.valueBhd)}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {order.paymentType} {order.blockNumber ? `- Block ${order.blockNumber}` : ''}
                          </p>
                        </td>
                        {!branch && <td className="py-3 pr-3 text-xs font-bold text-slate-500">{order.branchName || 'Unknown branch'}</td>}
                        <td className="py-3 pr-3 text-xs font-bold text-slate-500">{order.driverName || 'Unassigned'}</td>
                        <td className="py-3 pr-3"><StatusBadge status={order.deliveryStatus} /></td>
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
