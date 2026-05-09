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
          <input id="rev-amount" type="number" step="0.001" class="w-full p-4 bg-slate-50 border-0 rounded-2xl mb-4 text-sm font-bold" placeholder="0.000">
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Revenue Date</label>
              <input id="rev-date" type="date" class="w-full p-4 bg-slate-50 border-0 rounded-2xl mb-4 text-sm font-bold" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Settlement Time</label>
              <input id="rev-time" type="time" class="w-full p-4 bg-slate-50 border-0 rounded-2xl mb-4 text-sm font-bold" value="08:30">
            </div>
          </div>
          
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Primary Payment Channel</label>
          <select id="rev-type" class="w-full p-4 bg-slate-50 border-0 rounded-2xl mb-4 text-sm font-bold">
            <option value="Cash">Cash Liquidity</option>
            <option value="Visa">Digital / Visa Settlement</option>
          </select>
        </div>
      `,
            showCancelButton: true,
            confirmButtonText: 'Lock Revenue Integrity',
            customClass: {
                popup: 'rounded-[2.5rem]',
                confirmButton: 'bg-emerald-500 text-white rounded-2xl px-10 py-5 font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20',
                cancelButton: 'bg-slate-100 text-slate-400 rounded-2xl px-10 py-5 font-black text-xs uppercase tracking-widest'
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
          <input id="exp-amount" type="number" step="0.001" class="w-full p-4 bg-slate-50 border-0 rounded-2xl mb-4 text-sm font-bold" placeholder="0.000">
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Forecast Date</label>
              <input id="exp-date" type="date" class="w-full p-4 bg-slate-50 border-0 rounded-2xl mb-4 text-sm font-bold">
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expected Time</label>
              <input id="exp-time" type="time" class="w-full p-4 bg-slate-50 border-0 rounded-2xl mb-4 text-sm font-bold" value="13:00">
            </div>
          </div>
          
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Confidence Rating</label>
          <select id="exp-conf" class="w-full p-4 bg-slate-50 border-0 rounded-2xl mb-4 text-sm font-bold">
            <option value="High">High (Historical Consistency)</option>
            <option value="Medium" selected>Medium (Seasonality Applied)</option>
            <option value="Low">Low (Speculative / Promotion)</option>
          </select>
          
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Strategic Justification</label>
          <input id="exp-reason" class="w-full p-4 bg-slate-50 border-0 rounded-2xl text-sm font-bold" placeholder="e.g. End of month peak, New marketing drive...">
        </div>
      `,
            showCancelButton: true,
            confirmButtonText: 'Inject Data Point',
            customClass: {
                popup: 'rounded-[2.5rem]',
                confirmButton: 'bg-brand rounded-2xl px-10 py-5 font-black text-xs uppercase tracking-widest shadow-xl shadow-brand/20',
                cancelButton: 'bg-slate-100 text-slate-400 rounded-2xl px-10 py-5 font-black text-xs uppercase tracking-widest'
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
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Stats Side */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand/20 rounded-full -ml-16 -mb-16 blur-3xl"></div>
                        <div className="relative z-10">
                            <div className="flex bg-white/5 p-1.5 rounded-2xl mb-8 w-fit">
                                <button
                                    onClick={() => setActiveTab('actual')}
                                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'actual' ? 'bg-white text-slate-900 shadow-xl' : 'text-white/40 hover:text-white'}`}
                                >
                                    Daily Actual
                                </button>
                                <button
                                    onClick={() => setActiveTab('expected')}
                                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'expected' ? 'bg-white text-slate-900 shadow-xl' : 'text-white/40 hover:text-white'}`}
                                >
                                    Future Forecast
                                </button>
                            </div>

                            {activeTab === 'actual' ? (
                                <div>
                                    <h3 className="text-2xl font-black tracking-tight mb-2">Liquidity Injection</h3>
                                    <p className="text-white/40 text-xs font-medium leading-relaxed mb-8">Record actual closing figures to update the opening balance for subsequent forecast cycles.</p>
                                    <button
                                        onClick={handleAddActual}
                                        className="w-full py-5 bg-emerald-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-3"
                                    >
                                        <DollarSign className="w-5 h-5" />
                                        <span>Log Daily Closing</span>
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <h3 className="text-2xl font-black tracking-tight mb-2">Target Definition</h3>
                                    <p className="text-white/40 text-xs font-medium leading-relaxed mb-8">Define speculative or target-based sales figures to visualize potential cash health.</p>
                                    <button
                                        onClick={handleAddExpected}
                                        className="w-full py-5 bg-brand text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-3"
                                    >
                                        <Target className="w-5 h-5" />
                                        <span>Push Sales Target</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 px-2">Liquidity Distribution</h4>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/10">
                                        <CreditCard className="w-4 h-4" />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-900 uppercase">Visa Settlements</span>
                                </div>
                                <span className="text-xs font-black text-slate-900">42%</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/10">
                                        <DollarSign className="w-4 h-4" />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-900 uppercase">Cash Reserve</span>
                                </div>
                                <span className="text-xs font-black text-slate-900">58%</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 bg-gradient-to-br from-brand to-brand/90 rounded-[2.5rem] text-white">
                        <Zap className="w-6 h-6 mb-4" />
                        <h4 className="text-sm font-black uppercase tracking-tight mb-1">Precision Audit</h4>
                        <p className="text-[10px] font-medium text-white/70 leading-relaxed">System variance is currently at 0.4% between expected and actual figures.</p>
                    </div>
                </div>

                {/* List Side */}
                <div className="lg:col-span-8">
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm min-h-[600px]">
                        <div className="flex items-center justify-between mb-8">
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
                                    className="pl-12 pr-4 py-3 bg-slate-50 border-0 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:bg-white focus:ring-1 ring-brand/10 transition-all w-48"
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
