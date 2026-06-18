import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Coins, Lightbulb, Save, TrendingDown, TrendingUp } from 'lucide-react';
import { deliveryService } from '../../services/deliveryService';
import {
  DeliveryCostSetting, DeliveryDriver, DeliveryOrder, DeliveryPaymentTypeConfig, DriverEfficiency
} from '../../types';
import { PeriodFilter } from './components/PeriodFilter';
import { PeriodPreset, formatBhd, getPresetRange, isDirectOrder, periodLabel, rangeDayCount, sumValue, todayKey } from './utils';

const CLASS_META: Record<string, { label: string; className: string }> = {
  optimum: { label: 'Optimum', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  in_range: { label: 'In range', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  low_efficiency: { label: 'Low efficiency', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  loss_making: { label: 'Loss-making', className: 'border-red-200 bg-red-50 text-red-700' },
  no_cost_data: { label: 'No cost data', className: 'border-slate-200 bg-white text-slate-400' }
};

const effectiveWorkingDays = (periodDays: number, workingDaysPerMonth = 26) =>
  Math.max(1, Math.min(periodDays, Math.round(periodDays * (workingDaysPerMonth / 30))));

/**
 * Efficiency model:
 * - period cost = monthly cost / working days per month × working days in period
 * - cost per order = period cost / orders
 * - with an assumed gross margin %, estimated net = value × margin − period cost.
 *   Without a margin, classification falls back to productivity vs target only
 *   (loss cannot be honestly computed from revenue alone).
 */
const classifyDriver = (
  orders: DeliveryOrder[],
  driver: DeliveryDriver,
  setting: DeliveryCostSetting | undefined,
  periodDays: number
): DriverEfficiency => {
  const driverOrders = orders.filter(o => o.driverId === driver.id && o.orderKind !== 'internal_transfer');
  const count = driverOrders.length;
  const value = sumValue(driverOrders);
  const workingDaysInPeriod = effectiveWorkingDays(periodDays, setting?.workingDaysPerMonth);
  const ordersPerDay = count / workingDaysInPeriod;

  if (!setting) {
    return {
      driverId: driver.id, driverCode: driver.driverCode, driverName: driver.name, orders: count, totalValue: value,
      ordersPerDay, costPerOrder: null, periodCost: null,
      estimatedContribution: null, estimatedNet: null, classification: 'no_cost_data'
    };
  }

  const periodCost = (setting.monthlyCostBhd / setting.workingDaysPerMonth) * Math.max(1, workingDaysInPeriod);
  const costPerOrder = count > 0 ? periodCost / count : null;
  const target = setting.targetOrdersPerDay;
  const productivityRatio = target > 0 ? ordersPerDay / target : 0;

  let estimatedContribution: number | null = null;
  let estimatedNet: number | null = null;
  if (setting.assumedMarginPct !== null && setting.assumedMarginPct !== undefined) {
    estimatedContribution = value * (setting.assumedMarginPct / 100);
    estimatedNet = estimatedContribution - periodCost;
  }

  let classification: DriverEfficiency['classification'];
  if (estimatedNet !== null) {
    if (estimatedNet < 0) classification = 'loss_making';
    else if (productivityRatio >= 1) classification = 'optimum';
    else if (productivityRatio >= 0.5) classification = 'in_range';
    else classification = 'low_efficiency';
  } else {
    if (productivityRatio >= 1) classification = 'optimum';
    else if (productivityRatio >= 0.5) classification = 'in_range';
    else if (count === 0) classification = 'loss_making';
    else classification = 'low_efficiency';
  }

  return {
    driverId: driver.id, driverCode: driver.driverCode, driverName: driver.name, orders: count, totalValue: value,
    ordersPerDay, costPerOrder, periodCost, estimatedContribution, estimatedNet, classification
  };
};

const buildRecommendations = (rows: DriverEfficiency[], outsidePct: number): string[] => {
  const recs: string[] = [];
  const lossMakers = rows.filter(r => r.classification === 'loss_making');
  const lowEff = rows.filter(r => r.classification === 'low_efficiency');
  const noData = rows.filter(r => r.classification === 'no_cost_data');

  if (lossMakers.length > 0) {
    recs.push(`${lossMakers.map(r => r.driverName).join(', ')}: estimated cost exceeds estimated margin. Consider sharing the driver across nearby branches, merging routes, or revisiting working hours.`);
  }
  if (lowEff.length > 0) {
    recs.push(`${lowEff.map(r => r.driverName).join(', ')}: well below the target orders/day. Check whether the branch routes external-channel demand away from the driver or whether marketing of direct delivery is needed.`);
  }
  if (noData.length > 0) {
    recs.push(`Set monthly cost for: ${noData.map(r => r.driverName).join(', ')} to include them in profitability ranking.`);
  }
  if (outsidePct > 25) {
    recs.push(`${outsidePct.toFixed(0)}% of direct orders are delivered outside the branch's own governorate. Optimum is for each pharmacy to mostly serve its own governorate — review block coverage assignments between branches to cut petrol and time.`);
  }
  if (recs.length === 0) {
    recs.push('Delivery operation looks healthy for this period: drivers are within target productivity and margin assumptions cover driver costs.');
  }
  return recs;
};

export const DeliveryProfitability: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [customFrom, setCustomFrom] = useState(todayKey());
  const [customTo, setCustomTo] = useState(todayKey());

  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [settings, setSettings] = useState<DeliveryCostSetting[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<DeliveryPaymentTypeConfig[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const range = getPresetRange(preset, customFrom, customTo);
  const label = periodLabel(preset, range.from, range.to);
  const periodDays = rangeDayCount(range.from, range.to);

  const loadReference = async () => {
    const [driverList, settingList, paymentTypeRows] = await Promise.all([
      deliveryService.drivers.list(),
      deliveryService.costSettings.list(),
      deliveryService.paymentTypes.list(true)
    ]);
    setDrivers(driverList);
    setSettings(settingList);
    setPaymentTypes(paymentTypeRows);
  };

  useEffect(() => { loadReference().catch(e => console.error(e)); }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    deliveryService.orders.list({ dateFrom: range.from, dateTo: range.to })
      .then(data => { if (!cancelled) setOrders(data); })
      .catch(e => { console.error(e); if (!cancelled) setOrders([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [range.from, range.to]);

  const efficiency = useMemo(() => {
    const rows = drivers.map(driver =>
      classifyDriver(orders, driver, settings.find(s => s.driverId === driver.id), periodDays)
    );
    const rank = (r: DriverEfficiency) =>
      r.estimatedNet !== null ? r.estimatedNet : r.ordersPerDay * 1000 - (r.classification === 'no_cost_data' ? 1e9 : 0);
    return rows.sort((a, b) => rank(b) - rank(a));
  }, [drivers, settings, orders, periodDays]);

  const outsidePct = useMemo(() => {
    const direct = orders.filter(o => isDirectOrder(o, paymentTypes) && o.governorate);
    if (direct.length === 0) return 0;
    return (direct.filter(o => o.isOutsideGovernorate).length / direct.length) * 100;
  }, [orders, paymentTypes]);

  const recommendations = useMemo(() => buildRecommendations(efficiency, outsidePct), [efficiency, outsidePct]);

  const editCostSetting = async (driver: DeliveryDriver) => {
    const current = settings.find(s => s.driverId === driver.id);
    const { value } = await Swal.fire({
      title: `<span class="text-xl font-black tracking-tight">Cost — ${driver.name}</span>`,
      html: `
        <div class="space-y-3 text-left p-2">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monthly cost (BHD) — salary, visa, petrol allowance</label>
            <input id="swal-cost" type="number" step="0.001" min="0" value="${current?.monthlyCostBhd ?? ''}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Working days / month</label>
            <input id="swal-days" type="number" min="1" max="31" value="${current?.workingDaysPerMonth ?? 26}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Target orders / day</label>
            <input id="swal-target" type="number" step="0.5" min="1" value="${current?.targetOrdersPerDay ?? 15}" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Assumed gross margin % (optional — enables loss analysis)</label>
            <input id="swal-margin" type="number" step="0.5" min="0" max="100" value="${current?.assumedMarginPct ?? ''}" placeholder="e.g. 25" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
          </div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Save',
      confirmButtonColor: '#B91c1c',
      preConfirm: () => ({
        cost: Number((document.getElementById('swal-cost') as HTMLInputElement).value),
        days: Number((document.getElementById('swal-days') as HTMLInputElement).value),
        target: Number((document.getElementById('swal-target') as HTMLInputElement).value),
        margin: (document.getElementById('swal-margin') as HTMLInputElement).value
      })
    });
    if (!value) return;
    if (!value.cost || value.cost < 0) {
      Swal.fire('Invalid cost', 'Enter the driver monthly cost in BHD.', 'warning');
      return;
    }
    try {
      await deliveryService.costSettings.upsert({
        driverId: driver.id,
        monthlyCostBhd: value.cost,
        workingDaysPerMonth: value.days || 26,
        targetOrdersPerDay: value.target || 15,
        assumedMarginPct: value.margin === '' ? null : Number(value.margin)
      });
      await loadReference();
    } catch (e: any) {
      Swal.fire('Save failed', e?.message || 'Could not save cost settings.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter
          preset={preset} customFrom={customFrom} customTo={customTo}
          onChange={(p, f, t) => { setPreset(p); if (f !== undefined) setCustomFrom(f); if (t !== undefined) setCustomTo(t); }}
        />
        {canEdit && (
          <button onClick={() => setShowSettings(s => !s)} className="btn-secondary text-[10px] uppercase tracking-widest">
            <Coins className="h-3.5 w-3.5" /> {showSettings ? 'Hide cost settings' : 'Cost settings'}
          </button>
        )}
      </div>

      {showSettings && canEdit && (
        <section className="operational-panel p-4 md:p-5">
          <h3 className="mb-1 text-sm font-black uppercase tracking-widest text-slate-700">Driver cost settings</h3>
          <p className="mb-4 text-[11px] font-medium text-slate-500">
            Cost per driver/head drives the efficiency model. Margin % is optional — without it, ranking uses productivity vs target only.
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {drivers.map(driver => {
              const setting = settings.find(s => s.driverId === driver.id);
              return (
                <button
                  key={driver.id}
                  onClick={() => editCostSetting(driver)}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-brand/40"
                >
                  <div>
                    <p className="text-sm font-black text-slate-800">{driver.name}</p>
                    {driver.driverCode && (
                      <p className="text-[10px] font-black uppercase tracking-widest text-brand">{driver.driverCode}</p>
                    )}
                    <p className="text-[11px] font-bold text-slate-400">
                      {setting
                        ? `${formatBhd(setting.monthlyCostBhd)}/mo · ${setting.workingDaysPerMonth}d · target ${setting.targetOrdersPerDay}/day${setting.assumedMarginPct != null ? ` · margin ${setting.assumedMarginPct}%` : ''}`
                        : 'No cost configured'}
                    </p>
                  </div>
                  <Save className="h-4 w-4 text-slate-300" />
                </button>
              );
            })}
            {drivers.length === 0 && <p className="text-xs font-bold text-slate-400">No active drivers yet — add drivers in Delivery Settings.</p>}
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand"></div>
        </div>
      ) : (
        <>
          <section className="operational-panel p-4 md:p-5">
            <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-700">Driver ranking — {label}</h3>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Driver</th>
                    <th className="py-2 pr-3 text-right">Orders</th>
                    <th className="py-2 pr-3 text-right">Value</th>
                    <th className="py-2 pr-3 text-right">Orders / day</th>
                    <th className="py-2 pr-3 text-right">Cost / order</th>
                    <th className="py-2 pr-3 text-right">Est. net</th>
                    <th className="py-2">Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {efficiency.map((row, index) => {
                    const meta = CLASS_META[row.classification];
                    return (
                      <tr key={row.driverId} className="hover:bg-slate-50/50">
                        <td className="py-2.5 pr-3 text-xs font-black text-slate-400">{index + 1}</td>
                        <td className="py-2.5 pr-3 font-black text-slate-800">
                          <div>{row.driverName}</div>
                          {row.driverCode && <div className="text-[10px] font-black uppercase tracking-widest text-brand">{row.driverCode}</div>}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-bold tabular-nums">{row.orders}</td>
                        <td className="py-2.5 pr-3 text-right font-bold tabular-nums">{formatBhd(row.totalValue)}</td>
                        <td className="py-2.5 pr-3 text-right font-bold tabular-nums">{row.ordersPerDay.toFixed(1)}</td>
                        <td className="py-2.5 pr-3 text-right font-bold tabular-nums">{row.costPerOrder !== null ? formatBhd(row.costPerOrder) : '—'}</td>
                        <td className={`py-2.5 pr-3 text-right font-black tabular-nums ${row.estimatedNet !== null ? (row.estimatedNet < 0 ? 'text-red-600' : 'text-emerald-600') : 'text-slate-300'}`}>
                          {row.estimatedNet !== null ? (
                            <span className="inline-flex items-center gap-1">
                              {row.estimatedNet < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                              {formatBhd(row.estimatedNet)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-2.5">
                          <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase ${meta.className}`}>{meta.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 md:hidden">
              {efficiency.map((row, index) => {
                const meta = CLASS_META[row.classification];
                return (
                  <div key={row.driverId} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-slate-800">{index + 1}. {row.driverName}</p>
                      {row.driverCode && <p className="text-[10px] font-black uppercase tracking-widest text-brand">{row.driverCode}</p>}
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${meta.className}`}>{meta.label}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] font-bold text-slate-500">
                      {row.orders} orders · {formatBhd(row.totalValue)} · {row.ordersPerDay.toFixed(1)}/day
                      {row.costPerOrder !== null && ` · ${formatBhd(row.costPerOrder)}/order`}
                      {row.estimatedNet !== null && ` · net ${formatBhd(row.estimatedNet)}`}
                    </p>
                  </div>
                );
              })}
            </div>
            {efficiency.length === 0 && <p className="py-8 text-center text-xs font-bold text-slate-400">No active drivers.</p>}
          </section>

          <section className="operational-panel p-4 md:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-brand" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Recommendations</h3>
            </div>
            <ul className="space-y-2">
              {recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-600">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"></span>
                  {rec}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
};
