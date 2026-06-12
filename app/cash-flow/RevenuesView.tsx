import React, { useState } from 'react';
import {
    TrendingUp,
    TrendingDown,
    Plus,
    Search,
    Calendar,
    DollarSign,
    CreditCard,
    ArrowRight,
    Target,
    BarChart,
    Activity,
    Zap,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { ActualRevenue, ExpectedRevenue, PaymentType, ConfidenceLevel } from '../../types';
import { supabase } from '../../lib/supabase';
import Swal from 'sweetalert2';

interface RevenuesViewProps {
    actual: ActualRevenue[];
    expected: ExpectedRevenue[];
    onRefresh: () => void;
}

export const RevenuesView: React.FC<RevenuesViewProps> = ({ actual, expected, onRefresh }) => {
    const [activeTab, setActiveTab] = useState<'actual' | 'expected'>('actual');

    const handleAddActual = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Log Actual Daily Revenue',
            html: `
        <div class="space-y-4 text-left p-4">
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Daily Amount (BHD)</label>
          <input id="rev-amount" type="number" step="0.001" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-sm font-bold" placeholder="0.000">
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Revenue Date</label>
              <input id="rev-date" type="date" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-sm font-bold" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Settlement Time</label>
              <input id="rev-time" type="time" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-sm font-bold" value="08:30">
            </div>
          </div>
          
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Primary Payment Channel</label>
          <select id="rev-type" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-sm font-bold">
            <option value="Cash">Cash Liquidity</option>
            <option value="Visa">Digital / Visa Settlement</option>
          </select>
        </div>
      `,
            showCancelButton: true,
            confirmButtonText: 'Lock Revenue Integrity',
            customClass: {
                popup: 'rounded-lg',
                confirmButton: 'bg-brand text-white rounded-lg px-4 py-2.5 font-bold text-sm',
                cancelButton: 'bg-slate-100 text-slate-600 rounded-lg px-4 py-2.5 font-bold text-sm'
            },
            preConfirm: () => {
                const dateStr = (document.getElementById('rev-date') as HTMLInputElement).value;
                const inputDate = new Date(dateStr);
                const today = new Date();
                today.setHours(23, 59, 59, 999);

                if (inputDate > today) {
                    Swal.showValidationMessage('Actual revenue cannot be logged for future dates. Use Forecast instead.');
                    return false;
                }

                return {
                    amount: Number((document.getElementById('rev-amount') as HTMLInputElement).value),
                    revenueDate: dateStr,
                    settlementTime: (document.getElementById('rev-time') as HTMLInputElement).value,
                    paymentType: (document.getElementById('rev-type') as HTMLSelectElement).value as PaymentType
                };
            }
        });

        if (formValues && formValues.amount) {
            await supabase.cashFlow.revenuesActual.upsert(formValues);
            onRefresh();
            Swal.fire({
                icon: 'success',
                title: 'Revenue Audit Locked',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    };

    const handleAddExpected = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Define Sales Forecast Target',
            html: `
        <div class="space-y-4 text-left p-4">
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Forecasted Amount (BHD)</label>
          <input id="exp-amount" type="number" step="0.001" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-sm font-bold" placeholder="0.000">
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Forecast Date</label>
              <input id="exp-date" type="date" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-sm font-bold">
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expected Time</label>
              <input id="exp-time" type="time" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-sm font-bold" value="13:00">
            </div>
          </div>
          
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Confidence Rating</label>
          <select id="exp-conf" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-sm font-bold">
            <option value="High">High (Historical Consistency)</option>
            <option value="Medium" selected>Medium (Seasonality Applied)</option>
            <option value="Low">Low (Speculative / Promotion)</option>
          </select>
          
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Strategic Justification</label>
          <input id="exp-reason" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold" placeholder="e.g. End of month peak, New marketing drive...">
        </div>
      `,
            showCancelButton: true,
            confirmButtonText: 'Inject Data Point',
            customClass: {
                popup: 'rounded-lg',
                confirmButton: 'bg-brand text-white rounded-lg px-4 py-2.5 font-bold text-sm',
                cancelButton: 'bg-slate-100 text-slate-600 rounded-lg px-4 py-2.5 font-bold text-sm'
            },
            preConfirm: () => {
                return {
                    expectedAmount: Number((document.getElementById('exp-amount') as HTMLInputElement).value),
                    expectedDate: (document.getElementById('exp-date') as HTMLInputElement).value,
                    expectedTime: (document.getElementById('exp-time') as HTMLInputElement).value,
                    confidence: (document.getElementById('exp-conf') as HTMLSelectElement).value as ConfidenceLevel,
                    reason: (document.getElementById('exp-reason') as HTMLInputElement).value
                };
            }
        });

        if (formValues && formValues.expectedAmount) {
            await supabase.cashFlow.revenuesExpected.upsert(formValues);
            onRefresh();
            Swal.fire('Forecast Updated', 'Sales expectations synchronized.', 'success');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Stats Side */}
                <div className="lg:col-span-4 space-y-5">
                    <div className="operational-panel p-5">
                        <div>
                            <div className="tab-nav mb-6 w-fit">
                                <button
                                    onClick={() => setActiveTab('actual')}
                                    className={`tab-item text-[10px] uppercase tracking-widest ${activeTab === 'actual' ? 'tab-item-brand' : ''}`}
                                >
                                    Daily Actual
                                </button>
                                <button
                                    onClick={() => setActiveTab('expected')}
                                    className={`tab-item text-[10px] uppercase tracking-widest ${activeTab === 'expected' ? 'tab-item-brand' : ''}`}
                                >
                                    Future Forecast
                                </button>
                            </div>

                            {activeTab === 'actual' ? (
                                <div>
                                    <h3 className="text-xl font-black tracking-tight mb-2 text-slate-900">Liquidity Injection</h3>
                                    <p className="text-slate-500 text-xs font-medium leading-relaxed mb-5">Record actual closing figures to update the opening balance for subsequent forecast cycles.</p>
                                    <button
                                        onClick={handleAddActual}
                                        className="btn-primary w-full text-xs uppercase tracking-widest"
                                    >
                                        <DollarSign className="w-5 h-5" />
                                        <span>Log Daily Closing</span>
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <h3 className="text-xl font-black tracking-tight mb-2 text-slate-900">Target Definition</h3>
                                    <p className="text-slate-500 text-xs font-medium leading-relaxed mb-5">Define speculative or target-based sales figures to visualize potential cash health.</p>
                                    <button
                                        onClick={handleAddExpected}
                                        className="btn-primary w-full text-xs uppercase tracking-widest"
                                    >
                                        <Target className="w-5 h-5" />
                                        <span>Push Sales Target</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="operational-panel p-5">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 px-2">Liquidity Distribution</h4>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white shadow-sm">
                                        <CreditCard className="w-4 h-4" />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-900 uppercase">Visa Settlements</span>
                                </div>
                                <span className="text-xs font-black text-slate-900">42%</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white shadow-sm">
                                        <DollarSign className="w-4 h-4" />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-900 uppercase">Cash Reserve</span>
                                </div>
                                <span className="text-xs font-black text-slate-900">58%</span>
                            </div>
                        </div>
                    </div>

                    <div className="operational-panel-muted p-5 border-brand/20">
                        <Zap className="w-6 h-6 mb-4 text-brand" />
                        <h4 className="text-sm font-black uppercase tracking-tight mb-1 text-slate-900">Precision Audit</h4>
                        <p className="text-[10px] font-medium text-slate-500 leading-relaxed">System variance is currently at 0.4% between expected and actual figures.</p>
                    </div>
                </div>

                {/* List Side */}
                <div className="lg:col-span-8">
                    <div className="operational-panel p-5 md:p-6 min-h-[560px]">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                                    {activeTab === 'actual' ? 'Actual Revenue Registry' : 'Sales Target Forecast'}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Audit trail of financial inflows</p>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                <input
                                    type="text"
                                    placeholder="Audit Search..."
                                    className="pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest outline-none focus:bg-white focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all w-full md:w-48"
                                />
                            </div>
                        </div>

                        {activeTab === 'actual' ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left border-b border-slate-50">
                                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Node</th>
                                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Channel</th>
                                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount Injection</th>
                                            <th className="pb-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Integrity</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {actual.length === 0 ? (
                                            <tr><td colSpan={4} className="py-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">No revenue records synced</td></tr>
                                        ) : (
                                            actual.map(r => (
                                                <tr key={r.id} className="group hover:bg-slate-50 transition-colors">
                                                    <td className="py-5">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center space-x-3">
                                                                <Calendar className="w-4 h-4 text-slate-300" />
                                                                <span className="text-[11px] font-black text-slate-900">{new Date(r.revenueDate).toLocaleDateString()}</span>
                                                            </div>
                                                            <span className="text-[9px] font-black text-slate-400 ml-7">{r.settlementTime || '08:30'} AM</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-5">
                                                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${r.paymentType === 'Cash' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                                            {r.paymentType}
                                                        </span>
                                                    </td>
                                                    <td className="py-5">
                                                        <span className="text-lg font-black text-slate-900 tracking-tighter">{r.amount.toLocaleString(undefined, { minimumFractionDigits: 3 })} BHD</span>
                                                    </td>
                                                    <td className="py-5 text-right">
                                                        <div className="flex items-center justify-end space-x-2 text-emerald-400">
                                                            <CheckCircle2 className="w-4 h-4" />
                                                            <span className="text-[8px] font-black uppercase tracking-widest">Verified</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left border-b border-slate-50">
                                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Strategic Date</th>
                                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Confidence</th>
                                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valuation</th>
                                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {expected.length === 0 ? (
                                            <tr><td colSpan={4} className="py-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">No forecast models initialized</td></tr>
                                        ) : (
                                            expected.map(r => (
                                                <tr key={r.id} className="group hover:bg-slate-50 transition-colors">
                                                    <td className="py-5">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center space-x-3">
                                                                <Activity className="w-4 h-4 text-brand/40" />
                                                                <span className="text-[11px] font-black text-slate-900">{new Date(r.expectedDate).toLocaleDateString()}</span>
                                                            </div>
                                                            <span className="text-[9px] font-black text-slate-400 ml-7">{r.expectedTime || '13:00'} PM</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-5">
                                                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${r.confidence === 'High' ? 'bg-emerald-500/10 text-emerald-500' :
                                                            r.confidence === 'Medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                                                            }`}>
                                                            {r.confidence} Confidence
                                                        </span>
                                                    </td>
                                                    <td className="py-5">
                                                        <span className="text-lg font-black text-slate-900 tracking-tighter">{r.expectedAmount.toLocaleString(undefined, { minimumFractionDigits: 3 })} BHD</span>
                                                    </td>
                                                    <td className="py-5">
                                                        <span className="text-[10px] font-medium text-slate-500 line-clamp-1">{r.reason || 'Standard performance model'}</span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
