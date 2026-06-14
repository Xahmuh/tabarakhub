import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { AlertTriangle, CheckCircle2, Lock, MapPin, Pencil, Plus, Trash2, Unlock, X } from 'lucide-react';
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

const editActionClass = 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100';
const dangerActionClass = 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100';
const lockButtonClass = (locked: boolean) =>
  `mt-2 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition ${
    locked
      ? 'border-brand/20 bg-brand/5 text-brand hover:bg-brand/10'
      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
  }`;

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
  const [editingOrder, setEditingOrder] = useState<DeliveryOrder | null>(null);

  // Form state
  const [orderDate, setOrderDate] = useState(todayKey());
  const [value, setValue] = useState('');
  const [paymentType, setPaymentType] = useState<DeliveryPaymentType>('CASH');
  const [pharmacistId, setPharmacistId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [isPharmacistLocked, setIsPharmacistLocked] = useState(false);
  const [isDriverLocked, setIsDriverLocked] = useState(false);
  const [locksHydrated, setLocksHydrated] = useState(false);
  const [blockInput, setBlockInput] = useState('');
  const [resolvedBlock, setResolvedBlock] = useState<DeliveryBlock | null>(null);
  const [blockNotFound, setBlockNotFound] = useState(false);
  const [resolvedBlock, setResolvedBlock] = useState<DeliveryBlock | null>(null);
  const [blockNotFound, setBlockNotFound] = useState(false);

  const isTalabat = paymentType === 'TALABAT';
  const areaPreview = isTalabat
    ? 'Not required for Talabat'
    : resolvedBlock
      ? `${resolvedBlock.areaName} | ${resolvedBlock.governorate}`
      : blockNotFound && blockInput.trim()
        ? 'Block not found'
        : 'Enter block number or area';
  // Branch users may record today or yesterday (late-evening catch-up). Managers: any date.
  const minDate = isManager ? undefined : yesterdayKey();
  const maxDate = isManager ? undefined : todayKey();
  const lockStorageKey = `delivery-entry-locks:${branch.id}`;

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

  useEffect(() => {
    setLocksHydrated(false);
    let nextPharmacistId: string | null = null;
    let nextDriverId: string | null = null;
    let nextPharmacistLocked = false;
    let nextDriverLocked = false;
    try {
      const saved = localStorage.getItem(lockStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          pharmacistId?: string | null;
          driverId?: string | null;
          isPharmacistLocked?: boolean;
          isDriverLocked?: boolean;
        };
        if (parsed.isPharmacistLocked && parsed.pharmacistId) {
          nextPharmacistId = parsed.pharmacistId;
          nextPharmacistLocked = true;
        }
        if (parsed.isDriverLocked && parsed.driverId) {
          nextDriverId = parsed.driverId;
          nextDriverLocked = true;
        }
      }
    } catch (error) {
      console.warn('Could not restore delivery entry locks', error);
    } finally {
      setPharmacistId(nextPharmacistId);
      setDriverId(nextDriverId);
      setIsPharmacistLocked(nextPharmacistLocked);
      setIsDriverLocked(nextDriverLocked);
      setLocksHydrated(true);
    }
  }, [lockStorageKey]);

  useEffect(() => {
    if (!locksHydrated) return;
    const hasLockedValue = (isPharmacistLocked && pharmacistId) || (isDriverLocked && driverId);
    if (!hasLockedValue) {
      localStorage.removeItem(lockStorageKey);
      return;
    }
    localStorage.setItem(lockStorageKey, JSON.stringify({
      isPharmacistLocked,
      pharmacistId: isPharmacistLocked ? pharmacistId : null,
      isDriverLocked,
      driverId: isDriverLocked ? driverId : null
    }));
  }, [lockStorageKey, locksHydrated, isPharmacistLocked, pharmacistId, isDriverLocked, driverId]);

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

  const resetForm = (preserveBatchContext = true) => {
    // Keep locked people only; unlocked selectors reset after each order.
    setValue('');
    setBlockInput('');
    setResolvedBlock(null);
    setBlockNotFound(false);
    setEditingOrder(null);
    if (!preserveBatchContext) {
      setOrderDate(todayKey());
      setPaymentType('CASH');
    }
    if (!isPharmacistLocked) {
      setPharmacistId(null);
    }
    if (!isDriverLocked) {
      setDriverId(null);
    }
  };

  const togglePharmacistLock = () => {
    if (isPharmacistLocked) {
      setIsPharmacistLocked(false);
      return;
    }
    if (!pharmacistId) {
      Swal.fire('Select pharmacist first', 'Choose a pharmacist before locking this field.', 'warning');
      return;
    }
    setIsPharmacistLocked(true);
  };

  const toggleDriverLock = () => {
    if (isDriverLocked) {
      setIsDriverLocked(false);
      return;
    }
    if (!driverId) {
      Swal.fire('Select driver first', 'Choose a driver before locking this field.', 'warning');
      return;
    }
    setIsDriverLocked(true);
  };

  const handleEdit = (order: DeliveryOrder) => {
    setEditingOrder(order);
    setOrderDate(order.orderDate);
    setValue(order.valueBhd.toFixed(3));
    setPaymentType(order.paymentType);
    setPharmacistId(order.pharmacistId || null);
    setDriverId(order.driverId || null);
    setBlockInput(order.paymentType === 'TALABAT' ? '' : order.blockNumber || '');
    setResolvedBlock(null);
    setBlockNotFound(false);
    window.requestAnimationFrame(() => {
      document.getElementById('delivery-order-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!orderDate || Number.isNaN(new Date(`${orderDate}T00:00:00`).getTime())) {
      Swal.fire('Missing date', 'Select a valid order date.', 'warning');
      return;
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      Swal.fire('Invalid value', 'Enter an order value greater than zero in BHD.', 'warning');
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
      blockNumber: isTalabat ? null : (resolvedBlock ? resolvedBlock.blockNumber : blockInput.trim()) || null
    };

    setIsSubmitting(true);
    try {
      if (editingOrder) {
        const updated = await deliveryService.orders.update(editingOrder.id, input);
        setTodayOrders(prev => updated.orderDate === todayKey()
          ? prev.map(order => order.id === updated.id ? updated : order)
          : prev.filter(order => order.id !== updated.id)
        );
        resetForm(false);
        return;
      }

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
      Swal.fire(editingOrder ? 'Update failed' : 'Save failed', e?.message || 'Could not save the delivery order.', 'error');
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
        <section id="delivery-order-form" className="operational-panel p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">
                {editingOrder ? 'Edit delivery order' : 'New delivery order'}
              </h3>
              {editingOrder && (
                <p className="mt-1 text-[11px] font-bold text-slate-500">
                  Editing {formatBhd(editingOrder.valueBhd)} / {editingOrder.paymentType}
                </p>
              )}
            </div>
            {editingOrder && (
              <button
                type="button"
                onClick={() => resetForm(false)}
                className={dangerActionClass}
                title="Cancel edit"
                aria-label="Cancel edit"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
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
                options={pharmacists.map(p => ({
                  value: p.id,
                  label: p.code ? `${p.code} - ${p.name}` : p.name,
                  hint: p.code
                }))}
                value={pharmacistId}
                onChange={setPharmacistId}
                placeholder="Select pharmacist…"
                disabled={pharmacists.length === 0 || isPharmacistLocked}
                allowClear={!isPharmacistLocked}
              />
              <button
                type="button"
                onClick={togglePharmacistLock}
                className={lockButtonClass(isPharmacistLocked)}
              >
                {isPharmacistLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                {isPharmacistLocked ? 'Unlock pharmacist' : 'Lock pharmacist'}
              </button>
              {pharmacists.length === 0 && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-700">
                  No pharmacists are assigned to this branch yet. Please ask a manager to update pharmacist assignments.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Driver</label>
              <SearchableSelect
                options={drivers.map(d => ({
                  value: d.id,
                  label: d.driverCode ? `${d.driverCode} - ${d.name}` : d.name,
                  hint: d.driverCode
                }))}
                value={driverId}
                onChange={setDriverId}
                disabled={isDriverLocked}
                allowClear={!isDriverLocked}
                placeholder="Select driver…"
              />
              <button
                type="button"
                onClick={toggleDriverLock}
                className={lockButtonClass(isDriverLocked)}
              >
                {isDriverLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                {isDriverLocked ? 'Unlock driver' : 'Lock driver'}
              </button>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Block or Area {isTalabat ? '(not required for Talabat)' : ''}
              </label>
              <input
                type="text"
                inputMode="text"
                placeholder={isTalabat ? 'Disabled for Talabat' : 'e.g. 905 or Manama'}
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

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Area</label>
              <div className={`flex min-h-[42px] items-center rounded-lg border px-3 py-2.5 text-sm font-bold ${
                resolvedBlock
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                  : blockNotFound && blockInput.trim()
                    ? 'border-amber-100 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-slate-50 text-slate-400'
              }`}>
                {areaPreview}
              </div>
              <p className="mt-1 text-[10px] font-bold text-slate-400">Auto-filled from the block directory</p>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn-primary text-[11px] uppercase tracking-widest disabled:opacity-50"
            >
              {editingOrder ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isSubmitting
                ? editingOrder ? 'Updating...' : 'Saving...'
                : editingOrder ? 'Update order' : 'Record order'}
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
                          <div className="inline-flex items-center gap-1">
                            <button onClick={() => handleEdit(order)} className={editActionClass} title="Edit" aria-label="Edit order">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDelete(order)} className={dangerActionClass} title="Delete" aria-label="Delete order">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
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
                    <div className="mt-3 flex justify-end gap-2">
                      <button onClick={() => handleEdit(order)} className={editActionClass} title="Edit" aria-label="Edit order">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(order)} className={dangerActionClass} title="Delete" aria-label="Delete order">
                        <Trash2 className="h-4 w-4" />
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
