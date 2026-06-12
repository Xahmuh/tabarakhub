import React, { useState } from 'react';
import {
    Plus,
    Search,
    Calendar,
    Trash2,
    Edit,
    Filter,
    TrendingDown,
    Briefcase,
    AlertCircle,
    Clock,
    ArrowRight,
    ShieldAlert,
    Zap
} from 'lucide-react';
import { Expense, Priority, ExpenseType } from '../../types';
import { supabase } from '../../lib/supabase';
import Swal from 'sweetalert2';

interface ExpensesViewProps {
    expenses: Expense[];
    onRefresh: () => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({ expenses, onRefresh }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'All' | 'Fixed' | 'Variable'>('All');

    const filteredExpenses = expenses.filter(e =>
        (e.category.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (filterType === 'All' || e.type === filterType)
    );

    const handleAddExpense = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Schedule New Expense (OpEx)',
            html: `
        <div class="space-y-4 text-left p-4">
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expense Category</label>
          <input id="ex-cat" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-sm font-bold" placeholder="e.g. Rent, Salaries, Electricity...">
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount (BHD)</label>
              <input id="ex-amount" type="number" step="0.001" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-sm font-bold" placeholder="0.000">
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Execution Date</label>
              <input id="ex-date" type="date" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-sm font-bold">
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
             <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expense Type</label>
              <select id="ex-type" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-sm font-bold">
                <option value="Variable">Variable</option>
                <option value="Fixed">Fixed Cost</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Strategic Priority</label>
              <select id="ex-priority" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-sm font-bold">
                <option value="High">High (Immediate)</option>
                <option value="Medium" selected>Medium</option>
                <option value="Low">Low (Deferrable)</option>
              </select>
            </div>
          </div>

          <div class="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-100 rounded-lg">
            <input id="ex-delay" type="checkbox" class="w-5 h-5 accent-brand rounded-lg">
            <label for="ex-delay" class="text-[10px] font-black text-brand uppercase tracking-widest">Delay Allowed (Smart Engine)</label>
          </div>
          
          <div id="delay-settings" class="hidden animate-in fade-in duration-300">
             <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mt-4">Max Delay Days</label>
             <input id="ex-max-delay" type="number" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold" value="0">
          </div>
        </div>
      `,
            didOpen: () => {
                const check = document.getElementById('ex-delay') as HTMLInputElement;
                const div = document.getElementById('delay-settings') as HTMLElement;
                check.addEventListener('change', () => {
                    div.style.display = check.checked ? 'block' : 'none';
                });
            },
            showCancelButton: true,
            confirmButtonText: 'Initialize Expense',
            customClass: {
                popup: 'rounded-lg',
                confirmButton: 'bg-brand text-white rounded-lg px-4 py-2.5 font-bold text-sm',
                cancelButton: 'bg-slate-100 text-slate-600 rounded-lg px-4 py-2.5 font-bold text-sm'
            },
            preConfirm: () => {
                return {
                    category: (document.getElementById('ex-cat') as HTMLInputElement).value,
                    amount: Number((document.getElementById('ex-amount') as HTMLInputElement).value),
                    expenseDate: (document.getElementById('ex-date') as HTMLInputElement).value,
                    type: (document.getElementById('ex-type') as HTMLSelectElement).value as ExpenseType,
                    priority: (document.getElementById('ex-priority') as HTMLSelectElement).value as Priority,
                    delayAllowed: (document.getElementById('ex-delay') as HTMLInputElement).checked,
                    maxDelayDays: Number((document.getElementById('ex-max-delay') as HTMLInputElement).value)
                };
            }
        });

        if (formValues && formValues.category) {
            await supabase.cashFlow.expenses.upsert(formValues);
            onRefresh();
            Swal.fire('Scheduled', 'Operating expense sync complete.', 'success');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="operational-panel p-5 md:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Operating Expenses Registry</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Audit and planning of recurring outflows</p>
                    </div>

                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                            <input
                                type="text"
                                placeholder="Search categories..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
                            />
                        </div>

                        <div className="tab-nav">
                            {['All', 'Fixed', 'Variable'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setFilterType(type as any)}
                                    className={`tab-item text-[10px] uppercase tracking-widest ${filterType === type ? 'tab-item-brand' : ''}`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={handleAddExpense}
                            className="btn-primary text-[10px] uppercase tracking-widest"
                        >
                            <Plus className="w-5 h-5" />
                            <span>Schedule Cost</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left border-b border-slate-100">
                                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Cost Center</th>
                                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Financial Type</th>
                                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Execution Date</th>
                                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Valuation</th>
                                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Constraint</th>
                                <th className="pb-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center">
                                        <div className="flex flex-col items-center justify-center opacity-20">
                                            <Zap className="w-12 h-12 mb-4" />
                                            <p className="text-xs font-black uppercase tracking-widest">No scheduled expenses found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredExpenses.sort((a, b) => new Date(a.expenseDate).getTime() - new Date(b.expenseDate).getTime()).map(e => (
                                    <tr key={e.id} className="group hover:bg-slate-50 transition-all duration-300">
                                        <td className="py-6 px-4">
                                            <div className="flex items-center space-x-4">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${e.type === 'Fixed' ? 'bg-brand shadow-sm' : 'bg-white border border-slate-200'
                                                    }`}>
                                                    <TrendingDown className={`w-5 h-5 ${e.type === 'Fixed' ? 'text-white' : 'text-slate-400'}`} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900 tracking-tight">{e.category}</p>
                                                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest mr-2 ${e.priority === 'High' ? 'bg-red-50 text-red-500' :
                                                        e.priority === 'Medium' ? 'bg-amber-50 text-amber-500' : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                        {e.priority} Priority
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-6 px-4">
                                            <span className={`text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 ${e.type === 'Fixed' ? 'text-slate-900' : 'text-slate-400'}`}>
                                                <div className={`w-2 h-2 rounded-full ${e.type === 'Fixed' ? 'bg-brand' : 'bg-slate-300'}`}></div>
                                                <span>{e.type} Cost</span>
                                            </span>
                                        </td>
                                        <td className="py-6 px-4">
                                            <div className="flex items-center space-x-2 text-slate-600">
                                                <Calendar className="w-4 h-4 opacity-30" />
                                                <span className="text-xs font-bold font-mono uppercase tracking-tight">{new Date(e.expenseDate).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="py-6 px-4">
                                            <div className="flex items-baseline space-x-1">
                                                <span className="text-lg font-black text-slate-900 tracking-tighter">{e.amount.toLocaleString(undefined, { minimumFractionDigits: 3 })} BHD</span>
                                            </div>
                                        </td>
                                        <td className="py-6 px-4">
                                            {e.delayAllowed ? (
                                                <div className="flex items-center space-x-2 text-emerald-500">
                                                    <Clock className="w-4 h-4" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Max {e.maxDelayDays}d Delay</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center space-x-2 text-red-400">
                                                    <ShieldAlert className="w-4 h-4" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Fixed Obligation</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-6 px-4 text-right">
                                            <button className="p-2 text-slate-300 hover:text-brand transition-colors">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button className="p-2 text-slate-300 hover:text-red-500 transition-colors ml-2">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
