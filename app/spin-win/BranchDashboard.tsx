import React, { useState, useEffect } from 'react';
import { spinWinService } from '../../services/spinWin';
import { Branch } from '../../types';
import ExcelJS from 'exceljs';
import { mapBranchName } from '../../utils/excelUtils';
import {
    Users,
    Trophy,
    TrendingUp,
    Calendar,
    ChevronDown,
    Loader2,
    Clock,
    User,
    Bell,
    Gift,
    XCircle,
    RefreshCcw,
    Target,
    Activity,
    CheckCircle,
    Download,
    Search,
    ArrowLeft,
    MessageCircle
} from 'lucide-react';
import { supabaseClient } from '../../lib/supabase';

interface BranchDashboardProps {
    branch: Branch;
    onBack: () => void;
}

const KPICard: React.FC<{
    label: string;
    value: string | number;
    icon: React.ReactNode;
    subtext?: string;
    color?: 'red' | 'emerald' | 'blue' | 'slate';
    isPrimary?: boolean;
}> = ({ label, value, icon, subtext, color = 'slate', isPrimary }) => {
    const colorMap = {
        red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
        slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-100' },
    };
    const c = colorMap[color];

    if (isPrimary) {
        return (
            <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-10 -mt-10"></div>
                <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider">{label}</p>
                    <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">{icon}</div>
                </div>
                <div className="text-4xl font-black tracking-tight tabular-nums">{value}</div>
                {subtext && <p className="text-xs font-medium text-white/40 mt-2">{subtext}</p>}
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-2xl p-6 border ${c.border}`}>
            <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center ${c.text}`}>{icon}</div>
            </div>
            <div className="text-3xl font-black tracking-tight tabular-nums text-slate-900">{value}</div>
            {subtext && <p className="text-xs font-medium text-slate-400 mt-2">{subtext}</p>}
        </div>
    );
};

export const BranchDashboard: React.FC<BranchDashboardProps> = ({ branch, onBack }) => {
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        searchTerm: '',
        dateType: 'today' as 'today' | '7d' | 'month' | 'custom' | 'all'
    });
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [manualStart, setManualStart] = useState('');
    const [manualEnd, setManualEnd] = useState('');

    const parseManualDate = (dateStr: string) => {
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;
        const [d, m, y] = parts;
        if (y.length !== 4 || m.length !== 2 || d.length !== 2) return null;
        return `${y}-${m}-${d}`;
    };

    const loadHistory = async () => {
        try {
            const data = await spinWinService.spins.list({
                branchId: branch.id,
                startDate: filters.startDate,
                endDate: filters.endDate
            });
            setHistory(data);
        } catch (err) {
            console.error(err);
        }
    };

    const loadStats = async () => {
        try {
            const data = await spinWinService.spins.getBranchStats(branch.id, filters.startDate, filters.endDate);
            setStats(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const now = new Date();
        if (filters.dateType === 'today') {
            const start = new Date(now.setHours(0, 0, 0, 0)).toISOString();
            setFilters(f => ({ ...f, startDate: start, endDate: '' }));
        } else if (filters.dateType === '7d') {
            const start = new Date(now.setDate(now.getDate() - 7)).toISOString();
            setFilters(f => ({ ...f, startDate: start, endDate: '' }));
        } else if (filters.dateType === 'month') {
            const start = new Date(now.setDate(now.getDate() - 30)).toISOString();
            setFilters(f => ({ ...f, startDate: start, endDate: '' }));
        } else if (filters.dateType === 'all') {
            setFilters(f => ({ ...f, startDate: '', endDate: '' }));
        }
    }, [filters.dateType]);

    useEffect(() => {
        loadHistory();
        loadStats();

        const channel = supabaseClient
            .channel('branch-spins')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'spins',
                    filter: `branch_id=eq.${branch.id}`
                },
                async (payload) => {
                    const [customer, prize] = await Promise.all([
                        supabaseClient.from('customers').select('first_name, phone').eq('id', payload.new.customer_id).single(),
                        supabaseClient.from('spin_prizes').select('name').eq('id', payload.new.prize_id).single()
                    ]);

                    setNotification({
                        name: customer.data?.first_name || 'New Customer',
                        phone: customer.data?.phone,
                        prize: prize.data?.name,
                        vCode: payload.new.voucher_code
                    });

                    loadStats();
                    loadHistory();
                    setTimeout(() => setNotification(null), 10000);
                }
            )
            .subscribe();

        return () => {
            supabaseClient.removeChannel(channel);
        };
    }, [branch.id, filters.startDate, filters.endDate]);

    const exportData = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Branch Audit');

        sheet.columns = [
            { header: 'Date & Time', key: 'created_at', width: 25 },
            { header: 'Voucher Code', key: 'voucher_code', width: 15 },
            { header: 'Customer Name', key: 'customer_name', width: 25 },
            { header: 'Customer Phone', key: 'phone', width: 15 },
            { header: 'Prize', key: 'prize_name', width: 25 },
            { header: 'Value (BHD)', key: 'value', width: 15 },
            { header: 'Branch Giver', key: 'branch_name', width: 30 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Redeemed At', key: 'redeemed_at', width: 25 },
            { header: 'Redeemed Location', key: 'redeemed_location', width: 30 }
        ];

        history.forEach(s => {
            sheet.addRow({
                created_at: new Date(s.created_at).toLocaleString(),
                voucher_code: s.voucher_code,
                customer_name: s.customer?.first_name || 'N/A',
                phone: s.customer?.phone || 'N/A',
                prize_name: s.prize?.name || 'N/A',
                value: s.prize?.value || 0,
                branch_name: mapBranchName(s.branch?.name || branch.name),
                status: s.redeemed_at ? 'REDEEMED' : 'PENDING',
                redeemed_at: s.redeemed_at ? new Date(s.redeemed_at).toLocaleString() : '-',
                redeemed_location: mapBranchName(s.redeemed_branch?.name || (s.redeemed_branch_id ? 'External Branch' : '-'))
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Branch_${branch.code}_Audit.xlsx`;
        link.click();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-red-600" />
            </div>
        );
    }

    const dateLabel = filters.dateType === 'today' ? 'Today' : filters.dateType === '7d' ? 'Last 7 Days' : filters.dateType === 'month' ? 'Last Month' : filters.dateType === 'custom' ? 'Custom Period' : 'All Time';

    return (
        <div className="max-w-6xl mx-auto p-4 lg:p-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Notification */}
            {notification && (
                <div className="fixed top-6 right-6 z-[100] w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 animate-in slide-in-from-right duration-500">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white shrink-0">
                            <Bell className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">New Spin!</p>
                            <p className="text-sm font-bold text-slate-900 truncate">{notification.name}</p>
                            <p className="text-xs text-slate-400">+{notification.phone}</p>
                        </div>
                        <button onClick={() => setNotification(null)} className="text-slate-300 hover:text-slate-900 transition-colors" aria-label="Close notification">
                            <XCircle size={18} />
                        </button>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold"><Gift className="w-3.5 h-3.5" /> {notification.prize}</span>
                        <code className="bg-slate-50 px-2 py-0.5 rounded text-[10px] font-mono text-slate-500">{notification.vCode}</code>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8">
                <div>
                    <button onClick={onBack} className="inline-flex items-center gap-2 text-slate-400 hover:text-red-600 mb-3 transition-colors group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-xs font-bold uppercase tracking-widest">Back to Spin & Win Suite</span>
                    </button>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Branch Dashboard</h2>
                    <p className="text-slate-400 text-sm font-medium">{branch.name}</p>
                </div>

                <div className="relative z-50">
                    <button onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-red-200 transition-all shadow-sm">
                        <Calendar size={14} className="text-red-600" />
                        <span>{dateLabel}</span>
                        <ChevronDown size={12} />
                    </button>
                    {isDatePickerOpen && (
                        <div className={`absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-[100] animate-in slide-in-from-top-3 duration-200 ${filters.dateType === 'custom' ? 'w-64' : 'w-52'}`}>
                            {filters.dateType !== 'custom' ? (
                                <div className="space-y-0.5">
                                    {[
                                        { id: 'all', label: 'All Time' },
                                        { id: 'today', label: 'Today' },
                                        { id: '7d', label: 'Last 7 Days' },
                                        { id: 'month', label: 'Last Month' },
                                        { id: 'custom', label: 'Custom Period' }
                                    ].map(t => (
                                        <button key={t.id} onClick={() => { setFilters(f => ({ ...f, dateType: t.id as any })); if (t.id !== 'custom') setIsDatePickerOpen(false); }}
                                            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${filters.dateType === t.id ? 'bg-red-600 text-white' : 'hover:bg-slate-50 text-slate-700'}`}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-2 space-y-3">
                                    <div>
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">From (DD-MM-YYYY)</label>
                                        <input type="text" placeholder="01-01-2026" value={manualStart} onChange={(e) => setManualStart(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-xs font-bold outline-none focus:border-red-500 transition-all" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">To (DD-MM-YYYY)</label>
                                        <input type="text" placeholder="31-01-2026" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-xs font-bold outline-none focus:border-red-500 transition-all" />
                                    </div>
                                    <button onClick={() => {
                                        const s = parseManualDate(manualStart);
                                        const e = parseManualDate(manualEnd);
                                        if (s && e) { setFilters(f => ({ ...f, startDate: s, endDate: e })); setIsDatePickerOpen(false); }
                                        else { alert("Invalid Format. Use DD-MM-YYYY"); }
                                    }} className="w-full bg-slate-900 text-white p-2.5 rounded-lg text-xs font-bold hover:bg-red-700 transition-all">Confirm</button>
                                    <button onClick={() => { setManualStart(''); setManualEnd(''); setFilters(f => ({ ...f, dateType: 'all', startDate: '', endDate: '' })); setIsDatePickerOpen(false); }}
                                        className="w-full text-slate-400 text-[10px] font-bold hover:text-red-600 transition-colors">Reset</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <KPICard label="Total Spins" value={stats?.spins?.length || 0} icon={<RefreshCcw size={16} />} isPrimary subtext="Total Filtered" />
                <KPICard label="Conversion" value={`${stats?.spins?.length > 0 ? ((stats?.redeemsCount || 0) / stats.spins.length * 100).toFixed(1) : '0.0'}%`} icon={<Target size={16} />} color="red" subtext={`${stats?.redeemsCount || 0} redeemed`} />
                <KPICard label="Redeemed" value={stats?.redeemsCount || 0} icon={<CheckCircle size={16} />} color="emerald" subtext="Verified claims" />
                <KPICard label="Unique Users" value={stats?.uniqueCustomersToday || 0} icon={<Users size={16} />} color="blue" subtext="Active visitors" />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-50 flex flex-wrap items-center justify-between gap-4">
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-red-500 text-xs font-semibold text-slate-900 transition-all"
                            placeholder="Search vouchers, phones..."
                            value={filters.searchTerm}
                            onChange={(e) => setFilters(f => ({ ...f, searchTerm: e.target.value }))}
                        />
                    </div>
                    <button onClick={exportData} className="bg-slate-900 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors active:scale-[0.98]">
                        <Download className="w-3.5 h-3.5" /> Export
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</th>
                                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prize Won</th>
                                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Voucher</th>
                                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Date</th>
                                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {history
                                .filter(s =>
                                    !filters.searchTerm ||
                                    s.voucher_code.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                                    s.customer?.phone?.includes(filters.searchTerm)
                                )
                                .map((s) => (
                                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center space-x-2.5">
                                                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><User size={12} /></div>
                                                <div>
                                                    <p className="text-slate-900 font-bold text-xs">{s.customer?.first_name || 'Incognito'}</p>
                                                    <p className="text-[10px] text-slate-400">+{s.customer?.phone}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-red-600 font-bold text-xs">{s.prize?.name}</td>
                                        <td className="px-5 py-4">
                                            <code className="bg-slate-50 px-2 py-1 rounded text-[10px] font-mono tracking-wider text-slate-600">{s.voucher_code}</code>
                                        </td>
                                        <td className="px-5 py-4">
                                            {s.redeemed_at ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full text-[10px] font-bold">
                                                    <CheckCircle className="w-3 h-3" /> Redeemed
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-50 px-2 py-1 rounded-full text-[10px] font-bold">
                                                    <Clock className="w-3 h-3" /> Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className="text-xs font-bold tabular-nums text-slate-700">{new Date(s.created_at).toLocaleDateString()}</div>
                                            <div className="text-[10px] text-slate-300">{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td className="px-5 py-4">
                                            {!s.redeemed_at && (() => {
                                                const createdDate = new Date(s.created_at);
                                                const expiryDate = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                                                const now = new Date();
                                                const daysLeft = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                                const isUrgent = daysLeft <= 3 && daysLeft >= 0;
                                                const isExpired = daysLeft < 0;

                                                if (isExpired) return null;

                                                return (
                                                    <button
                                                        onClick={async () => {
                                                            const phone = s.customer?.phone || '';
                                                            const voucherCode = s.voucher_code;
                                                            const message = `*Time is running out!*\nRedeem your Tabarak Pharmacies voucher no ${voucherCode} now and make the most of your savings.\n\n*لا تضيع الفرصة!*\nقسيمتك ${voucherCode} من صيدليات تبارك  بتخلص قريب استعملها الحين واستمتع بأقوى توفير.`;

                                                            try {
                                                                const response = await fetch('/spin-header-v4.jpg');
                                                                const blob = await response.blob();
                                                                const file = new File([blob], 'tabarak-reminder.jpg', { type: 'image/jpeg' });

                                                                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                                                                    await navigator.share({ text: message, files: [file] });
                                                                } else {
                                                                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
                                                                }
                                                            } catch (err) {
                                                                console.error('Share failed:', err);
                                                                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
                                                            }
                                                        }}
                                                        className={`px-3 py-2 rounded-lg font-bold text-[10px] transition-all active:scale-95 flex items-center gap-1.5 ${isUrgent
                                                            ? 'bg-red-600 hover:bg-red-700 text-white'
                                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                            }`}
                                                    >
                                                        <MessageCircle className="w-3 h-3" />
                                                        Remind
                                                    </button>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                ))}
                            {history.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-10 text-center text-slate-400 text-sm font-medium">
                                        No activity recorded for this period
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
