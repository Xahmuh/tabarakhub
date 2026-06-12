import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { AlertTriangle, CheckCircle2, MapPin, Plus, Trash2 } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { pharmacistService } from '../../services/pharmacistService';
import {
  Branch, DeliveryBlock, DeliveryDriver, DeliveryOrder, DeliveryOrderInput, DeliveryPaymentType, Pharmacist
} from '../../types';
import { SearchableSelect } from './components/SearchableSelect';
import { formatBhd, todayKey, yesterdayKey } from './utils';

const PAYMENT_TYPES: DeliveryPaymentType[] = ['BP', 'CARD', 'CASH', 'TALABAT'];

const paymentBadge = (type: string) =>
  type === 'TALABAT'
    ? 'border-orange-200 bg-orange-50 text-orange-700'
    : 'border-brand/10 bg-brand/5 text-brand';

interface BranchRecordingPageProps {
  branch: Branch;
  canEdit: boolean;
  isManager: boolean;
}

export const BranchRecordingPage: React.FC<BranchRecordingPageProps> = ({ branch, canEdit, isManager }) => {
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
  const [todayOrders, setTodayOrders] = useState<DeliveryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [orderDate, setOrderDate] = useState(todayKey());
  const [value, setValue] = useState('');
  const [paymentType, setPaymentType] = useState<DeliveryPaymentType>('CASH');
  const [pharmacistId, setPharmacistId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [blockInput, setBlockInput] = useState('');
  const [resolvedBlock, setResolvedBlock] = useState<DeliveryBlock | null>(null);
  const [blockNotFound, setBlockNotFound] = useState(false);

  const isTalabat = paymentType === 'TALABAT';
  // Branch users may record today or yesterday (late-evening catch-up). Managers: any date.
  const minDate = isManager ? undefined : yesterdayKey();
  const maxDate = isManager ? undefined : todayKey();

  const loadReference = async () => {
    try {
      const [driverList, pharmacistList] = await Promise.all([
        deliveryService.drivers.list(),
        pharmacistService.listByBranch(branch.id)
      ]);
      setDrivers(driverList);
      setPharmacists(pharmacistList);
    } catch (e) {
      console.error('Delivery reference load failed', e);
    }
  };

  const loadToday = async () => {
    setIsLoading(true);
    try {
      const orders = await deliveryService.orders.list({
        branchId: branch.id,
        dateFrom: todayKey(),
        dateTo: todayKey()
      });
      setTodayOrders(orders);
    } catch (e) {
      console.error('Delivery list failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadReference(); loadToday(); }, [branch.id]);

  // Resolve block -> area as the user types.
  useEffect(() => {
    let cancelled = false;
    setResolvedBlock(null);
    setBlockNotFound(false);
    const trimmed = blockInput.trim();
    if (!trimmed || isTalabat) return;
    const timer = setTimeout(async () => {
      const block = await deliveryService.blocks.resolve(trimmed);
      if (cancelled) return;
      setResolvedBlock(block);
      setBlockNotFound(!block);
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [blockInput, isTalabat]);

  const resetForm = () => {
    // Keep date + driver: typical batch entry is one driver, many orders.
    setValue('');
    setBlockInput('');
    setResolvedBlock(null);
    setBlockNotFound(false);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const numericValue = Number(value);
    if (!numericValue || numericValue <= 0) {
      Swal.fire('Missing value', 'Enter the order value in BHD.', 'warning');
      return;
    }
    if (!isTalabat && !blockInput.trim()) {
      Swal.fire('Block required', 'Block number is required for all orders except Talabat.', 'warning');
      return;
    }
    if (!isTalabat && blockNotFound) {
      const proceed = await Swal.fire({
        title: 'Unknown block',
        text: `Block ${blockInput.trim()} is not in the block directory. The order will be saved without an area — ask the manager to add this block.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Save anyway',
        confirmButtonColor: '#B91c1c'
      });
      if (!proceed.isConfirmed) return;
    }

    const input: DeliveryOrderInput = {
      branchId: branch.id,
      orderDate,
      valueBhd: numericValue,
      paymentType,
      pharmacistId,
      pharmacistName: pharmacists.find(p => p.id === pharmacistId)?.name || null,
      driverId,
      blockNumber: isTalabat ? null : blockInput.trim() || null
    };

    setIsSubmitting(true);
    try {
      const duplicate = await deliveryService.orders.findRecentDuplicate(input);
      if (duplicate) {
        const proceed = await Swal.fire({
          title: 'Possible duplicate',
          html: `An identical order (<b>${formatBhd(duplicate.valueBhd)} / ${duplicate.paymentType}</b>) was recorded a few minutes ago.<br/>Save this one as well?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Save anyway',
          confirmButtonColor: '#B91c1c'
        });
        if (!proceed.isConfirmed) { setIsSubmitting(false); return; }
      }

      const created = await deliveryService.orders.insert(input);
      if (created.orderDate === todayKey()) {
        setTodayOrders(prev => [created, ...prev]);
      }
      resetForm();
    } catch (e: any) {
      Swal.fire('Save failed', e?.message || 'Could not save the delivery order.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (order: DeliveryOrder) => {
    const confirm = await Swal.fire({
      title: 'Delete order?',
      text: `${formatBhd(order.valueBhd)} · ${order.paymentType} · ${order.orderDate}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#B91c1c'
    });
    if (!confirm.isConfirmed) return;
    try {
      await deliveryService.orders.delete(order.id);
      setTodayOrders(prev => prev.filter(o => o.id !== order.id));
    } catch (e: any) {
      Swal.fire('Delete failed', e?.message || 'Branch users can delete same-day orders only.', 'error');
    }
  };

  const totals = useMemo(() => ({
    count: todayOrders.length,
    value: todayOrders.reduce((acc, o) => acc + o.valueBhd, 0)
  }), [todayOrders]);

  return (
    <div className="space-y-5">
      {canEdit && (
        <section className="operational-panel p-4 md:p-5">
          <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-700">New delivery order</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Order date</label>
              <input
                type="date"
                value={orderDate}
                min={minDate}
                max={maxDate}
                onChange={e => setOrderDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none focus:border-brand/40"
              />
              {!isManager && (
                <p className="mt-1 text-[10px] font-bold text-slate-400">Today or yesterday only</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Order value (BHD)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                placeholder="0.000"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-black outline-none focus:border-brand/40"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Payment type</label>
              <div className="grid grid-cols-4 gap-1 rounded-lg border border-slate-200/50 bg-slate-100/60 p-1">
                {PAYMENT_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPaymentType(type)}
                    className={`rounded-md py-2 text-[11px] font-black transition-all ${
                      paymentType === type ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Pharmacist</label>
              <SearchableSelect
                options={pharmacists.map(p => ({ value: p.id, label: p.name }))}
                value={pharmacistId}
                onChange={setPharmacistId}
                placeholder="Select pharmacist…"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Driver</label>
              <SearchableSelect
                options={drivers.map(d => ({ value: d.id, label: d.name }))}
                value={driverId}
                onChange={setDriverId}
                placeholder="Select driver…"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Block {isTalabat ? '(not required for Talabat)' : ''}
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder={isTalabat ? 'Disabled for Talabat' : 'e.g. 905'}
                value={isTalabat ? '' : blockInput}
                disabled={isTalabat}
                onChange={e => setBlockInput(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm font-bold outline-none ${
                  isTalabat
                    ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                    : 'border-slate-200 bg-slate-50 focus:border-brand/40'
                }`}
              />
              {!isTalabat && resolvedBlock && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <MapPin className="h-3 w-3" /> {resolvedBlock.areaName} · {resolvedBlock.governorate}
                </p>
              )}
              {!isTalabat && blockNotFound && blockInput.trim() && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> Block not found in directory
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn-primary text-[11px] uppercase tracking-widest disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {isSubmitting ? 'Saving…' : 'Record order'}
            </button>
          </div>
        </section>
      )}

      <section className="operational-panel p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Today's deliveries</h3>
          <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
            <span>{totals.count} orders</span>
            <span className="text-slate-300">|</span>
            <span className="text-brand">{formatBhd(totals.value)}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand"></div>
          </div>
        ) : todayOrders.length === 0 ? (
          <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 text-center">
            <CheckCircle2 className="mb-2 h-6 w-6 text-slate-300" />
            <p className="text-xs font-bold text-slate-400">No deliveries recorded today yet.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3 text-right">Value</th>
                    <th className="py-2 px-3">Payment</th>
                    <th className="py-2 pr-3">Pharmacist</th>
                    <th className="py-2 pr-3">Driver</th>
                    <th className="py-2 pr-3">Block / Area</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {todayOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 pr-3 text-xs font-bold text-slate-400">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-black text-slate-900 tabular-nums">{order.valueBhd.toFixed(3)}</td>
                      <td className="py-2.5 px-3">
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${paymentBadge(order.paymentType)}`}>
                          {order.paymentType}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-bold text-slate-600">{order.pharmacistName || '—'}</td>
                      <td className="py-2.5 pr-3 font-bold text-slate-600">{order.driverName || '—'}</td>
                      <td className="py-2.5 pr-3 text-xs font-bold text-slate-500">
                        {order.paymentType === 'TALABAT'
                          ? '—'
                          : order.blockNumber
                            ? `${order.blockNumber}${order.areaName ? ` · ${order.areaName}` : ' · Unknown area'}`
                            : '—'}
                        {order.isOutsideGovernorate && (
                          <span className="ml-2 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-700">OUTSIDE</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {canEdit && (
                          <button onClick={() => handleDelete(order)} className="p-1.5 text-slate-300 hover:text-brand" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {todayOrders.map(order => (
                <div key={order.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-slate-900 tabular-nums">{formatBhd(order.valueBhd)}</span>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${paymentBadge(order.paymentType)}`}>
                      {order.paymentType}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-slate-500">
                    {order.pharmacistName && <span>{order.pharmacistName}</span>}
                    {order.driverName && <span>🛵 {order.driverName}</span>}
                    {order.paymentType !== 'TALABAT' && order.blockNumber && (
                      <span>Block {order.blockNumber}{order.areaName ? ` · ${order.areaName}` : ''}</span>
                    )}
                    {order.isOutsideGovernorate && <span className="text-amber-600">Outside governorate</span>}
                  </div>
                  {canEdit && (
                    <div className="mt-2 flex justify-end">
                      <button onClick={() => handleDelete(order)} className="text-[11px] font-bold text-slate-400 hover:text-brand">
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
