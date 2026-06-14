import React, { useEffect, useMemo, useState } from 'react';
import { FileDown, Printer, Package, Wallet, MessageCircle, UtensilsCrossed } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import { Branch, DeliveryOrder } from '../../types';
import { PeriodFilter } from './components/PeriodFilter';
import { PeriodPreset, formatBhd, getPresetRange, isDirectOrder, periodLabel, sumValue, todayKey } from './utils';
import { exportOrdersToExcel, printReport } from './exports';
import { isModuleEnabled } from '../../config/clientConfig';
import Swal from 'sweetalert2';

type ViewMode = 'combined' | 'direct' | 'talabat';

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

interface BranchDeliveryDashboardProps {
  branch: Branch;
  canEdit?: boolean;
  onEdit?: (order: DeliveryOrder) => void;
}

export const BranchDeliveryDashboard: React.FC<BranchDeliveryDashboardProps> = ({ branch, canEdit, onEdit }) => {
  const [preset, setPreset] = useState<PeriodPreset>('today');
  const [customFrom, setCustomFrom] = useState(todayKey());
  const [customTo, setCustomTo] = useState(todayKey());
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('combined');

  const range = getPresetRange(preset, customFrom, customTo);
  const label = periodLabel(preset, range.from, range.to);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await deliveryService.orders.list({
          branchId: branch.id,
          dateFrom: range.from,
          dateTo: range.to
        });
        if (!cancelled) setOrders(data);
      } catch (e) {
        console.error('Delivery dashboard load failed', e);
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [branch.id, range.from, range.to]);

  const direct = useMemo(() => orders.filter(isDirectOrder), [orders]);
  const talabat = useMemo(() => orders.filter(o => o.paymentType === 'TALABAT'), [orders]);

  const visibleOrders = view === 'combined' ? orders : view === 'direct' ? direct : talabat;

  const handlePeriodChange = (p: PeriodPreset, from?: string, to?: string) => {
    setPreset(p);
    if (from !== undefined) setCustomFrom(from);
    if (to !== undefined) setCustomTo(to);
  };

  const handleExcel = () => {
    exportOrdersToExcel(
      visibleOrders.map(o => ({ ...o, branchName: o.branchName || branch.name })),
      `${branch.name} — Delivery Orders — ${label}`,
      `Delivery_${branch.code}_${range.from}_${range.to}`
    ).catch(err => console.error(err));
  };

  const handleDelete = async (order: DeliveryOrder) => {
    const confirm = await Swal.fire({
      title: 'Delete this order?',
      text: `Are you sure you want to delete this order (${order.valueBhd.toFixed(3)} BHD)?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      confirmButtonColor: '#B91c1c'
    });
    if (!confirm.isConfirmed) return;
    try {
      await deliveryService.orders.delete(order.id);
      setOrders(prev => prev.filter(o => o.id !== order.id));
    } catch (e: any) {
      Swal.fire('Delete failed', e?.message || 'Branch users can only delete their own active orders.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <PeriodFilter preset={preset} customFrom={customFrom} customTo={customTo} onChange={handlePeriodChange} />
        <div className="flex items-center gap-2">
          {isModuleEnabled('excelExport') && (
            <button onClick={handleExcel} className="btn-secondary text-[10px] uppercase tracking-widest">
              <FileDown className="h-3.5 w-3.5" /> Excel
            </button>
          )}
          <button onClick={printReport} className="btn-secondary text-[10px] uppercase tracking-widest">
            <Printer className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Print header — only visible on paper */}
      <div className="hidden print:block">
        <h1 className="text-xl font-black">{branch.name} — Delivery Report</h1>
        <p className="text-sm">{label}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Total orders" value={String(orders.length)} sub={label} icon={<Package className="h-4 w-4" />} />
        <KpiCard label="Total value" value={formatBhd(sumValue(orders))} icon={<Wallet className="h-4 w-4" />} />
        <KpiCard
          label="WhatsApp / Direct"
          value={String(direct.length)}
          sub={formatBhd(sumValue(direct))}
          icon={<MessageCircle className="h-4 w-4" />}
        />
        <KpiCard
          label="Talabat"
          value={String(talabat.length)}
          sub={formatBhd(sumValue(talabat))}
          icon={<UtensilsCrossed className="h-4 w-4" />}
        />
      </div>

      <section className="operational-panel p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex bg-slate-100/60 p-1 rounded-lg border border-slate-200/50">
            {([
              { id: 'combined', label: 'Combined' },
              { id: 'direct', label: 'WhatsApp / Direct' },
              { id: 'talabat', label: 'Talabat' }
            ] as Array<{ id: ViewMode; label: string }>).map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  view === v.id ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <p className="text-xs font-bold text-slate-400">{visibleOrders.length} orders · {formatBhd(sumValue(visibleOrders))}</p>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand"></div>
          </div>
        ) : visibleOrders.length === 0 ? (
          <p className="py-10 text-center text-xs font-bold text-slate-400">No delivery orders in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3 text-right">Value (BHD)</th>
                  <th className="py-2 px-3">Payment</th>
                  <th className="py-2 pr-3">Pharmacist</th>
                  <th className="py-2 pr-3">Driver</th>
                  <th className="py-2 pr-3">Block</th>
                  <th className="py-2 pr-3">Area</th>
                  {canEdit && <th className="py-2 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visibleOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/50">
                    <td className="py-2 pr-3 text-xs font-bold text-slate-500">{order.orderDate}</td>
                    <td className="py-2 pr-3 text-right font-black text-slate-900 tabular-nums">{order.valueBhd.toFixed(3)}</td>
                    <td className="py-2 px-3 text-xs font-black text-slate-600">{order.paymentType}</td>
                    <td className="py-2 pr-3 text-xs font-bold text-slate-500">{order.pharmacistName || '—'}</td>
                    <td className="py-2 pr-3 text-xs font-bold text-slate-500">{order.driverName || '—'}</td>
                    <td className="py-2 pr-3 text-xs font-bold text-slate-500">{order.blockNumber || '—'}</td>
                    <td className="py-2 pr-3 text-xs font-bold text-slate-500">
                      {order.areaName || '—'}
                      {order.isOutsideGovernorate && (
                        <span className="ml-1.5 rounded-md border border-amber-200 bg-amber-50 px-1 py-0.5 text-[9px] font-black text-amber-700">OUT</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          {onEdit && (
                            <button onClick={() => onEdit(order)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100" title="Edit" aria-label="Edit order">
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                            </button>
                          )}
                          <button onClick={() => handleDelete(order)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100" title="Delete" aria-label="Delete order">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
