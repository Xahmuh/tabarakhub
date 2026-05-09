import React, { useState } from 'react';
import {
    CreditCard,
    Plus,
    Search,
    ExternalLink,
    ChevronRight,
    MoreVertical,
    Calendar,
    AlertCircle,
    Clock,
    CheckCircle2,
    XCircle,
    User,
    Activity,
    Trash2,
    Edit,
    Briefcase
} from 'lucide-react';
import { Supplier, Cheque, Priority, ChequeStatus, FlexibilityLevel } from '../../types';
import { supabase } from '../../lib/supabase';
import Swal from 'sweetalert2';

interface SuppliersViewProps {
    suppliers: Supplier[];
    cheques: Cheque[];
    onRefresh: () => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({ suppliers, cheques, onRefresh }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
    const supplierCheques = cheques.filter(c => c.supplierId === selectedSupplierId);

    const handleAddSupplier = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Register New Supplier',
            html: `
        <div class="space-y-4 text-left p-4">
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Supplier / Node Name</label>
          <input id="swal-name" class="w-full p-4 bg-slate-50 border-0 rounded-2xl mb-4 text-sm font-bold" placeholder="e.g. Medico Global Solutions">
          
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Payment Flexibility</label>
          <select id="swal-flex" class="w-full p-4 bg-slate-50 border-0 rounded-2xl mb-4 text-sm font-bold">
            <option value="High">High (Allows 15+ Days Delay)</option>
            <option value="Medium" selected>Medium (Allows 7 Days Delay)</option>
            <option value="Low">Low (Fixed Due Dates)</option>
          </select>
          
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Internal Notes</label>
          <textarea id="swal-notes" class="w-full p-4 bg-slate-50 border-0 rounded-2xl h-24 text-sm font-bold" placeholder="Legacy contract details, contact info..."></textarea>
        </div>
      `,
            showCancelButton: true,
            confirmButtonText: 'Initialize Supplier',
            customClass: {
                popup: 'rounded-[2.5rem]',
                confirmButton: 'bg-brand rounded-2xl px-10 py-5 font-black text-xs uppercase tracking-widest',
                cancelButton: 'bg-slate-100 text-slate-400 rounded-2xl px-10 py-5 font-black text-xs uppercase tracking-widest'
            },
            preConfirm: () => {
                return {
                    name: (document.getElementById('swal-name') as HTMLInputElement).value,
                    flexibilityLevel: (document.getElementById('swal-flex') as HTMLSelectElement).value as FlexibilityLevel,
                    notes: (document.getElementById('swal-notes') as HTMLTextAreaElement).value
                };
            }
        });

        if (formValues && formValues.name) {
            await supabase.cashFlow.suppliers.upsert(formValues);
            onRefresh();
            Swal.fire({
                icon: 'success',
                title: 'Supplier Synchronized',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    };

    const handleAddCheque = async () => {
        if (!selectedSupplierId) return;

        const { value: formValues } = await Swal.fire({
            title: 'Issue New Cheque',
            html: `
        <div class="space-y-4 text-left p-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cheque Number</label>
              <input id="swal-num" class="w-full p-4 bg-slate-50 border-0 rounded-2xl mb-4 text-sm font-bold" placeholder="CHQ-9901">
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount (BHD)</label>
              <input id="swal-amount" type="number" step="0.001" class="w-full p-4 bg-slate-50 border-0 rounded-2xl mb-4 text-sm font-bold" placeholder="0.000">
            </div>
          </div>
          
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Maturity / Due Date</label>
              <input id="swal-date" type="date" class="w-full p-4 bg-slate-50 border-0 rounded-2xl mb-4 text-sm font-bold">
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bank Execution Time</label>
              <input id="swal-time" type="time" class="w-full p-4 bg-slate-50 border-0 rounded-2xl mb-4 text-sm font-bold" value="09:00">
            </div>
          </div>
          
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Audit Priority</label>
          <select id="swal-priority" class="w-full p-4 bg-slate-50 border-0 rounded-2xl text-sm font-bold">
            <option value="Critical">Critical (No Delay Possible)</option>
            <option value="Normal" selected>Normal (Standard Cycle)</option>
            <option value="Flexible">Flexible (Can Reschedule)</option>
          </select>
        </div>
      `,
            showCancelButton: true,
            confirmButtonText: 'Register Commitment',
            customClass: {
                popup: 'rounded-[2.5rem]',
                confirmButton: 'bg-brand rounded-2xl px-10 py-5 font-black text-xs uppercase tracking-widest',
                cancelButton: 'bg-slate-100 text-slate-400 rounded-2xl px-10 py-5 font-black text-xs uppercase tracking-widest'
            },
            preConfirm: () => {
                return {
                    supplierId: selectedSupplierId,
                    chequeNumber: (document.getElementById('swal-num') as HTMLInputElement).value,
                    amount: Number((document.getElementById('swal-amount') as HTMLInputElement).value),
                    dueDate: (document.getElementById('swal-date') as HTMLInputElement).value,
                    executionTime: (document.getElementById('swal-time') as HTMLInputElement).value,
                    priority: (document.getElementById('swal-priority') as HTMLSelectElement).value as Priority,
                    status: 'Scheduled' as ChequeStatus
                };
            }
        });

        if (formValues && formValues.chequeNumber && formValues.amount) {
            await supabase.cashFlow.cheques.upsert(formValues);
            onRefresh();
            Swal.fire('Committed', 'Cheque has been added to the forecast.', 'success');
        }
    };

    const handleUpdateChequeStatus = async (cheque: Cheque) => {
        const { value: status } = await Swal.fire({
            title: `Update Cheque #${cheque.chequeNumber}`,
            input: 'select',
            inputOptions: {
                'Scheduled': 'Keep Scheduled',
                'Paid': 'Mark as Paid',
                'Delayed': 'Postpone / Delay'
            },
            inputValue: cheque.status,
            showCancelButton: true,
            confirmButtonText: 'Update Registry',
            customClass: {
                popup: 'rounded-[2.5rem]',
                confirmButton: 'bg-brand rounded-2xl px-10 py-5 font-black text-xs uppercase tracking-widest',
            }
        });

        if (status) {
            let delayReason = cheque.delayReason;
            if (status === 'Delayed') {
                const { value: reason } = await Swal.fire({
                    title: 'Liquidity Adjustment',
                    input: 'textarea',
                    inputPlaceholder: 'Mandatory justification for delay...',
                    showCancelButton: true,
                    confirmButtonText: 'Apply Delay',
                    inputValidator: (value) => {
                        if (!value) return 'Justification is required for audit integrity.';
                        return null;
                    },
                    customClass: {
                        popup: 'rounded-[2.5rem]',
                        confirmButton: 'bg-red-500 rounded-2xl px-10 py-5 font-black text-xs uppercase tracking-widest',
                    }
                });
                if (!reason) return;
                delayReason = reason;

                // Suggested new date
                const { value: newDate } = await Swal.fire({
                    title: 'Reschedule Commitment',
                    input: 'date',
                    inputValue: cheque.dueDate,
                    confirmButtonText: 'Commit New Date',
                    customClass: {
                        popup: 'rounded-[2.5rem]',
                        confirmButton: 'bg-slate-900 rounded-2xl px-10 py-5 font-black text-xs uppercase tracking-widest',
                    }
                });
                if (newDate) {
                    await supabase.cashFlow.cheques.upsert({
                        ...cheque,
                        status: 'Delayed',
                        delayReason,
                        dueDate: newDate
                    });
                }
            } else {
                await supabase.cashFlow.cheques.upsert({ ...cheque, status, delayReason: status === 'Paid' ? null : delayReason });
            }
            onRefresh();
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Supplier List */}
            <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">Suppliers</h3>
                        <button
                            onClick={handleAddSupplier}
                            className="p-3 bg-brand text-white rounded-2xl hover:scale-110 active:scale-90 transition-all shadow-lg shadow-brand/20"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="relative mb-6">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                            type="text"
                            placeholder="Query databases..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-0 rounded-2xl text-xs font-bold focus:ring-2 ring-brand/20 transition-all"
                        />
                    </div>

                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredSuppliers.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setSelectedSupplierId(s.id)}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${selectedSupplierId === s.id ? 'bg-slate-900 text-white shadow-xl translate-x-2' : 'bg-slate-50 hover:bg-white border border-transparent hover:border-slate-100 text-slate-600'}`}
                            >
                                <div className="flex items-center space-x-3 text-left">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedSupplierId === s.id ? 'bg-white/10' : 'bg-white shadow-sm border border-slate-100'}`}>
                                        <Briefcase className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className={`text-xs font-black uppercase tracking-tight ${selectedSupplierId === s.id ? 'text-white' : 'text-slate-900'}`}>{s.name}</p>
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${selectedSupplierId === s.id ? 'text-white/40' : 'text-slate-400'}`}>{s.flexibilityLevel} Flex</span>
                                    </div>
                                </div>
                                <ChevronRight className={`w-4 h-4 transition-transform ${selectedSupplierId === s.id ? 'rotate-90 text-brand' : 'text-slate-200 group-hover:translate-x-1'}`} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Supplier Detail & Cheques */}
            <div className="lg:col-span-8 space-y-6">
                {!selectedSupplier ? (
                    <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center h-[500px]">
                        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 text-slate-200">
                            <User className="w-10 h-10" />
                        </div>
                        <h4 className="text-xl font-black text-slate-900">Selective Node Detail</h4>
                        <p className="text-slate-400 text-sm max-w-xs mt-2">Select a supplier from the registry to manage active commitments and audit trails.</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                                <div className="flex items-center space-x-6">
                                    <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center shadow-2xl shadow-brand/20">
                                        <Briefcase className="text-white w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{selectedSupplier.name}</h3>
                                        <div className="flex items-center space-x-4 mt-2">
                                            <span className="flex items-center space-x-1.5 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[8px] font-black uppercase">
                                                <Activity className="w-3 h-3" />
                                                <span>Flex: {selectedSupplier.flexibilityLevel}</span>
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400">ID: {selectedSupplier.id.slice(0, 8)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-3">
                                    <button
                                        onClick={handleAddCheque}
                                        className="flex items-center space-x-3 px-6 py-4 bg-brand text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-brand/30 hover:scale-105 active:scale-95 transition-all"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Issue Cheque</span>
                                    </button>
                                    <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-red-500 hover:bg-red-50 transition-all">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-3xl">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Strategy & Notes</p>
                                <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                                    "{selectedSupplier.notes || 'No strategic overview provided for this node.'}"
                                </p>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h4 className="text-lg font-black text-slate-900 tracking-tight">Financial Commitments</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active cheques and scheduled transfers</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="px-3 py-1 bg-slate-100 text-slate-900 rounded-full text-[10px] font-black">{supplierCheques.length} Records</span>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left border-b border-slate-50">
                                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descriptor</th>
                                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Maturity</th>
                                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valuation</th>
                                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                            <th className="pb-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {supplierCheques.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-12 text-center">
                                                    <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">No active commitments found</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            supplierCheques.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(c => (
                                                <tr key={c.id} className="group hover:bg-slate-50 transition-colors">
                                                    <td className="py-5">
                                                        <div className="flex items-center space-x-3">
                                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${c.priority === 'Critical' ? 'bg-red-50 text-red-500' :
                                                                c.priority === 'Normal' ? 'bg-blue-50 text-blue-500' : 'bg-emerald-50 text-emerald-500'
                                                                }`}>
                                                                <CreditCard className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[11px] font-black text-slate-900">#{c.chequeNumber}</p>
                                                                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{c.priority} Priority</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-5">
                                                        <div className="flex flex-col space-y-1">
                                                            <div className="flex items-center space-x-2 text-slate-600">
                                                                <Calendar className="w-3 h-3 opacity-30" />
                                                                <span className="text-[11px] font-bold">{new Date(c.dueDate).toLocaleDateString()}</span>
                                                            </div>
                                                            <div className="flex items-center space-x-2 text-slate-400">
                                                                <Clock className="w-3 h-3 opacity-30" />
                                                                <span className="text-[9px] font-black">{c.executionTime || '09:00'} AM</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-5">
                                                        <span className="text-[11px] font-black text-slate-900">{c.amount.toLocaleString(undefined, { minimumFractionDigits: 3 })} BHD</span>
                                                    </td>
                                                    <td className="py-5">
                                                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${c.status === 'Paid' ? 'bg-emerald-100 text-emerald-600' :
                                                            c.status === 'Delayed' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {c.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-5 text-right">
                                                        <button
                                                            onClick={() => handleUpdateChequeStatus(c)}
                                                            className="p-2 text-slate-300 hover:text-brand transition-colors hover:scale-110"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
