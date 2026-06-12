import React from 'react';
import {
    History,
    Search,
    Calendar,
    Clock,
    AlertCircle,
    ArrowRight,
    ShieldCheck,
    FileText,
    User,
    Briefcase
} from 'lucide-react';
import { Cheque, Expense } from '../../types';

interface AuditLogViewProps {
    cheques: Cheque[];
    expenses: Expense[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ cheques, expenses }) => {
    // Combine all "events" with justifications/logs
    const delayedCheques = cheques.filter(c => c.status === 'Delayed' && c.delayReason);

    // Sort by date/timestamp if available, otherwise due date
    const auditEntries = [...delayedCheques].sort((a, b) =>
        new Date(b.createdAt || b.dueDate).getTime() - new Date(a.createdAt || a.dueDate).getTime()
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="operational-panel p-5 md:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Strategy Audit Trail</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Immutable record of financial re-prioritization</p>
                    </div>

                    <div className="flex items-center space-x-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="flex items-center space-x-2 px-4 border-r border-slate-200">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Integrity Level</span>
                            <div className="flex space-x-0.5">
                                <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>
                                <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>
                                <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>
                                <div className="w-1 h-3 bg-emerald-300 rounded-full"></div>
                            </div>
                        </div>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Hashed Logs Active</span>
                    </div>
                </div>

                <div className="space-y-6">
                    {auditEntries.length === 0 ? (
                        <div className="py-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-lg flex items-center justify-center mx-auto mb-5 text-slate-200">
                                <ShieldCheck className="w-8 h-8" />
                            </div>
                            <h4 className="text-lg font-black text-slate-900">Clear Financial History</h4>
                            <p className="text-slate-400 text-xs font-medium max-w-xs mx-auto mt-2">No delayed commitments or justification entries found in the current audit horizon.</p>
                        </div>
                    ) : (
                        auditEntries.map((entry, idx) => (
                            <div key={idx} className="relative pl-8 pb-12 last:pb-0 group">
                                {/* Timeline Line */}
                                <div className="absolute left-[11px] top-2 bottom-0 w-0.5 bg-slate-100 group-last:bg-transparent"></div>

                                {/* Timeline Dot */}
                                <div className="absolute left-0 top-1.5 w-6 h-6 bg-white border-4 border-slate-100 rounded-full z-10 group-hover:border-brand transition-colors"></div>

                                <div className="bg-slate-50 group-hover:bg-white border border-slate-100 p-5 rounded-lg transition-colors">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
                                                <History className="w-5 h-5 text-brand" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Commitment Adjustment</p>
                                                <h4 className="text-lg font-black text-slate-900 tracking-tight">Cheque #{entry.chequeNumber}</h4>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-3">
                                            <span className="px-3 py-1 bg-white text-slate-600 rounded-md text-[10px] font-black uppercase tracking-widest border border-slate-100">
                                                {new Date(entry.createdAt || entry.dueDate).toLocaleDateString()}
                                            </span>
                                            <span className="px-3 py-1 bg-red-100 text-red-600 rounded-md text-[10px] font-black uppercase tracking-widest">
                                                Status: Delayed
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                        <div className="space-y-4">
                                            <div className="flex items-start space-x-3">
                                                <FileText className="w-4 h-4 text-brand mt-1 shrink-0" />
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Manager Justification</p>
                                                    <p className="text-sm font-medium text-slate-700 leading-relaxed italic">"{entry.delayReason}"</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-3 pt-2">
                                                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                                                    <User className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-500">
                                                    Authorized by <span className="text-slate-900 font-black">Group Manager</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white p-4 rounded-lg border border-slate-100">
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Impact</span>
                                                <span className="text-sm font-black text-brand">+{entry.amount.toLocaleString(undefined, { minimumFractionDigits: 3 })} BHD In-Day Liquidity</span>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-400 font-bold">New Maturity Date</span>
                                                    <span className="text-slate-900 font-black">{new Date(entry.dueDate).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-400 font-bold">Original Priority</span>
                                                    <span className="text-slate-900 font-black uppercase tracking-widest">{entry.priority}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
