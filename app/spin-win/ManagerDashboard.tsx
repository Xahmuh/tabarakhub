import React, { useState, useEffect, useMemo } from 'react';
import { spinWinService } from '../../services/spinWin';
import { SpinPrize, Spin, Branch } from '../../types';
import {
    Trophy,
    Settings,
    BarChart3,
    Users,
    Plus,
    Trash2,
    Edit2,
    Save,
    X,
    Filter,
    Download,
    Search,
    CheckCircle2,
    Clock,
    Ticket,
    RefreshCcw,
    Calendar,
    Target,
    Activity,
    Landmark,
    TrendingUp,
    Store,
    MapPin,
    ShieldCheck,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    MessageCircle
} from 'lucide-react';
import { BackToModulesButton, RangeDatePicker } from '../shared';
import { SpinHeatmapCalendar } from './SpinHeatmapCalendar';
import { formatCurrency } from '../../utils/calculations';
import { mapBranchName } from '../../utils/excelUtils';
import { supabaseClient } from '../../lib/supabaseClient';

interface ManagerDashboardProps {
    onBack: () => void;
}

const KPICard: React.FC<{
    label: string;
    value: string | number;
    icon: React.ReactNode;
    subtext?: string;
    color?: 'red' | 'emerald' | 'blue' | 'amber' | 'slate';
    isPrimary?: boolean;
}> = ({ label, value, icon, subtext, color = 'slate', isPrimary }) => {
    const colorMap = {
        red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
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

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ onBack }) => {
    const [activeView, setActiveView] = useState<'analytics' | 'prizes' | 'branches'>('analytics');
    const [prizes, setPrizes] = useState<SpinPrize[]>([]);
    const [spins, setSpins] = useState<any[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isAddingPrize, setIsAddingPrize] = useState(false);
    const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<SpinPrize>>({});
    const [newPrize, setNewPrize] = useState<Partial<SpinPrize>>({
        name: '',
        probabilityWeight: 1,
        isActive: true,
        color: '#F43F5E'
    });

    const [isAddingBranch, setIsAddingBranch] = useState(false);
    const [newBranch, setNewBranch] = useState({
        name: '',
        code: '',
        whatsappNumber: '',
        googleMapsLink: ''
    });

    const [filters, setFilters] = useState({
        branchId: 'all',
        startDate: '',
        endDate: '',
        dateType: 'all' as 'all' | 'today' | '7d' | 'month' | 'custom',
        searchTerm: ''
    });

    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [leaderboardPage, setLeaderboardPage] = useState(1);
    const [manualStart, setManualStart] = useState('');
    const [manualEnd, setManualEnd] = useState('');
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 4000);
    };

    const parseManualDate = (dateStr: string) => {
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;
        const [d, m, y] = parts;
        if (y.length !== 4 || m.length !== 2 || d.length !== 2) return null;
        return `${y}-${m}-${d}`;
    };

    const loadData = async () => {
        setIsSyncing(true);
        try {
            const [prizeList, spinList, branchList] = await Promise.all([
                spinWinService.prizes.list(),
                spinWinService.spins.list({
                    branchId: filters.branchId === 'all' ? undefined : filters.branchId,
                    startDate: filters.startDate,
                    endDate: filters.endDate
                }),
                spinWinService.management.branches.list()
            ]);
            setPrizes(prizeList);
            setSpins(spinList);
            setBranches(branchList);
        } catch (err) {
            console.error('Error loading manager data', err);
        } finally {
            setIsSyncing(false);
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
        loadData();
    }, [filters.branchId, filters.startDate, filters.endDate]);

    const metrics = useMemo(() => {
        const branchStats: Record<string, { spins: number, redemptions: number }> = {};

        spins.forEach(s => {
            const name = s.branch?.name || 'Unknown Node';
            if (!branchStats[name]) branchStats[name] = { spins: 0, redemptions: 0 };
            branchStats[name].spins += 1;
            
            if (s.redeemed_at) {
                const redeemName = s.redeemed_branch?.name || 'External/Unknown';
                if (!branchStats[redeemName]) branchStats[redeemName] = { spins: 0, redemptions: 0 };
                branchStats[redeemName].redemptions += 1;
            }
        });

        const sortedByTraffic = Object.entries(branchStats)
            .sort((a, b) => b[1].spins - a[1].spins)
            .map(([name, data]) => ({ name, value: data.spins }));

        const sortedByRedemption = Object.entries(branchStats)
            .sort((a, b) => b[1].redemptions - a[1].redemptions)
            .map(([name, data]) => ({ name, value: data.redemptions }));

        const totalValueGranted = spins.reduce((acc, s) => acc + (Number(s.prize?.value) || 0), 0);

        return {
            total: spins.length,
            redeemed: spins.filter(s => s.redeemed_at).length,
            redemptionRate: spins.length > 0 ? (spins.filter(s => s.redeemed_at).length / spins.length) * 100 : 0,
            totalValueGranted,
            uniqueCustomers: new Set(spins.map(s => s.customer_id)).size,
            repeatedVisits: spins.length - new Set(spins.map(s => s.customer_id)).size,
            topTraffic: sortedByTraffic,
            topRedemption: sortedByRedemption,
            topBranch: sortedByTraffic[0] ? [sortedByTraffic[0].name, sortedByTraffic[0].value] : ['N/A', 0]
        };
    }, [spins]);

    const exportAudit = async () => {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Spin Audit');
        sheet.columns = [
            { header: 'Date & Time', key: 'created_at', width: 25 },
            { header: 'Voucher Code', key: 'voucher_code', width: 15 },
            { header: 'Customer Name', key: 'customer_name', width: 25 },
            { header: 'Customer Phone', key: 'phone', width: 15 },
            { header: 'Prize', key: 'prize_name', width: 25 },
            { header: 'Value (BHD)', key: 'value', width: 15 },
            { header: 'Branch', key: 'branch_name', width: 30 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Redeemed At', key: 'redeemed_at', width: 25 },
            { header: 'Redeemed Location', key: 'redeemed_location', width: 30 }
        ];
        spins.forEach(s => {
            sheet.addRow({
                created_at: new Date(s.created_at).toLocaleString(),
                voucher_code: s.voucher_code,
                customer_name: s.customer?.first_name || 'N/A',
                phone: s.customer?.phone || 'N/A',
                prize_name: s.prize?.name || 'N/A',
                value: s.prize?.value || 0,
                branch_name: mapBranchName(s.branch?.name || 'N/A'),
                status: s.redeemed_at ? 'REDEEMED' : 'PENDING',
                redeemed_at: s.redeemed_at ? new Date(s.redeemed_at).toLocaleString() : '-',
                redeemed_location: s.redeemed_branch?.name ? mapBranchName(s.redeemed_branch.name) : (s.redeemed_at ? 'External Branch' : '-')
            });
        });
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `SpinWin_Audit_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
    };

    const handleCreatePrize = async () => {
        if (!newPrize.name) return;
        try {
            await spinWinService.prizes.create({ ...newPrize, type: 'general', value: 0, dailyLimit: 0 } as Omit<SpinPrize, 'id' | 'createdAt'>);
            setIsAddingPrize(false);
            setNewPrize({ name: '', probabilityWeight: 1, isActive: true, color: '#F43F5E' });
            loadData();
            showNotification('success', 'Prize created successfully');
        } catch (err) {
            showNotification('error', 'Error creating prize');
        }
    };

    const handleBulkStatusChange = async (enabled: boolean) => {
        if (!confirm(`Are you sure you want to ${enabled ? 'ENABLE' : 'DISABLE'} Spin & Win for ALL branches?`)) return;
        setIsSyncing(true);
        const branchesToUpdate = branches.filter(b => b.role === 'branch');
        let successCount = 0;
        try {
            await Promise.allSettled(
                branchesToUpdate.map(async (b) => {
                    await spinWinService.management.branches.update(b.id, { isSpinEnabled: enabled });
                    successCount++;
                })
            );
            await loadData();
            showNotification('success', `${successCount}/${branchesToUpdate.length} branches ${enabled ? 'activated' : 'suspended'}`);
        } catch (err) {
            showNotification('error', 'Error during bulk update');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleCreateBranch = async () => {
        if (!newBranch.name || !newBranch.code) return;
        try {
            await spinWinService.management.branches.create({
                name: newBranch.name, code: newBranch.code, role: 'branch',
                whatsappNumber: newBranch.whatsappNumber, googleMapsLink: newBranch.googleMapsLink
            });
            setIsAddingBranch(false);
            setNewBranch({ name: '', code: '', whatsappNumber: '', googleMapsLink: '' });
            loadData();
            showNotification('success', 'Branch created');
        } catch (err: any) {
            showNotification('error', `Error: ${err.message || 'Unknown'}`);
        }
    };

    const handleDeletePrize = async (id: string) => {
        if (!confirm('Delete this prize?')) return;
        try {
            await spinWinService.prizes.delete(id);
            loadData();
            showNotification('success', 'Prize deleted');
        } catch (err) {
            showNotification('error', 'Error deleting prize');
        }
    };

    const togglePrizeStatus = async (prize: SpinPrize) => {
        try {
            await spinWinService.prizes.update(prize.id, { isActive: !prize.isActive });
            loadData();
            showNotification('success', `Prize ${!prize.isActive ? 'activated' : 'deactivated'}`);
        } catch (err) {
            showNotification('error', 'Error updating status');
        }
    };

    const startEditing = (prize: SpinPrize) => { setEditingPrizeId(prize.id); setEditForm({ ...prize }); };
    const cancelEditing = () => { setEditingPrizeId(null); setEditForm({}); };

    const handleUpdatePrize = async () => {
        if (!editingPrizeId || !editForm.name) return;
        try {
            await spinWinService.prizes.update(editingPrizeId, {
                name: editForm.name, probabilityWeight: editForm.probabilityWeight,
                value: editForm.value, type: editForm.type, dailyLimit: editForm.dailyLimit, color: editForm.color
            });
            setEditingPrizeId(null);
            loadData();
            showNotification('success', 'Prize updated');
        } catch (err) {
            showNotification('error', 'Error updating prize');
        }
    };

    const dateLabel = filters.dateType === 'today' ? 'Today' : filters.dateType === '7d' ? 'Last 7 Days' : filters.dateType === 'month' ? 'Last Month' : filters.dateType === 'custom' ? 'Custom' : 'All Time';
    const rewardControlMetrics = useMemo(() => {
        const active = prizes.filter(prize => prize.isActive).length;
        const inactive = prizes.length - active;
        const totalWeight = prizes.reduce((sum, prize) => sum + Number(prize.probabilityWeight || 0), 0);
        const highestWeightPrize = prizes
            .slice()
            .sort((a, b) => Number(b.probabilityWeight || 0) - Number(a.probabilityWeight || 0))[0];

        return { active, inactive, totalWeight, highestWeightPrize };
    }, [prizes]);

    return (
        <div className="max-w-[1600px] mx-auto p-4 lg:p-10 animate-in fade-in duration-700 relative">
            {/* Toast */}
            {notification && (
                <div className={`fixed top-6 right-6 z-[200] px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 animate-in slide-in-from-right-10 duration-500 ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                    {notification.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />}
                    <span className="text-sm font-bold">{notification.message}</span>
                    <button onClick={() => setNotification(null)} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar */}
                <aside className="lg:w-72 space-y-4">
                    <div className="bg-slate-900 rounded-2xl p-8 text-white">
                        <h2 className="text-2xl font-black tracking-tight mb-1">Manager<span className="text-red-500">.</span></h2>
                        <p className="text-white/40 text-xs font-medium">Group Loyalty Hub</p>
                    </div>

                    <nav className="bg-white rounded-2xl border border-slate-100 p-3 space-y-1 shadow-sm sticky top-6">
                        {[
                            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
                            { id: 'prizes', label: 'Prize Engine', icon: Trophy },
                            { id: 'branches', label: 'Branch Control', icon: Landmark },
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveView(item.id as any)}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold transition-all ${activeView === item.id
                                    ? 'bg-red-600 text-white shadow-md'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <item.icon className="w-4 h-4" />
                                <span>{item.label}</span>
                            </button>
                        ))}

                        <div className="pt-6">
                            <BackToModulesButton onClick={onBack} />
                        </div>
                    </nav>
                </aside>

                {/* Main */}
                <div className="flex-1 space-y-8">

                    {/* ANALYTICS VIEW */}
                    {activeView === 'analytics' && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Network Overview</h2>
                                    <p className="text-slate-400 text-sm font-medium">Real-time performance metrics</p>
                                </div>
                                {/* Date Filter */}
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
                                                        <button key={t.id} onClick={() => { setFilters(f => ({ ...f, dateType: t.id as any, startDate: '', endDate: '' })); if (t.id !== 'custom') setIsDatePickerOpen(false); }}
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
                                                            className="w-full bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-xs font-bold outline-none focus:border-red-500" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">To (DD-MM-YYYY)</label>
                                                        <input type="text" placeholder="31-01-2026" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)}
                                                            className="w-full bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-xs font-bold outline-none focus:border-red-500" />
                                                    </div>
                                                    <button onClick={() => {
                                                        const s = parseManualDate(manualStart); const e = parseManualDate(manualEnd);
                                                        if (s && e) { setFilters(f => ({ ...f, startDate: s, endDate: e })); setIsDatePickerOpen(false); }
                                                        else showNotification('error', "Invalid format. Use DD-MM-YYYY");
                                                    }} className="w-full bg-slate-900 text-white p-2.5 rounded-lg text-xs font-bold hover:bg-red-700 transition-all">Confirm</button>
                                                    <button onClick={() => { setManualStart(''); setManualEnd(''); setFilters(f => ({ ...f, startDate: '', endDate: '', dateType: 'all' })); setIsDatePickerOpen(false); }}
                                                        className="w-full text-slate-400 text-[10px] font-bold hover:text-red-600">Reset</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* KPIs */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <KPICard label="Total Spins" value={metrics.total} icon={<RefreshCcw size={16} />} isPrimary subtext="All branches" />
                                <KPICard label="Conversion" value={`${metrics.redemptionRate.toFixed(1)}%`} icon={<Target size={16} />} color="red" subtext={`${metrics.redeemed} redeemed`} />
                                <KPICard label="Redeemed" value={metrics.redeemed} icon={<CheckCircle2 size={16} />} color="emerald" subtext="Verified claims" />
                                <KPICard label="Top Branch" value={metrics.topBranch[1]} icon={<Landmark size={16} />} color="amber" subtext={String(metrics.topBranch[0]).split('-')[1] || String(metrics.topBranch[0])} />
                            </div>

                            {/* Heatmap */}
                            <SpinHeatmapCalendar spins={spins} />

                            {/* Leaderboard */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white"><Trophy size={14} /></div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-900">Branch Leaderboard</h3>
                                            <p className="text-[10px] text-slate-400 font-medium">Ranked by engagement volume</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setLeaderboardPage(p => Math.max(1, p - 1))} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-900 hover:text-white transition-all" aria-label="Previous Page"><ChevronLeft size={14} /></button>
                                        <span className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-bold tabular-nums">
                                            {leaderboardPage}/{Math.max(1, Math.ceil(metrics.topTraffic.length / 5))}
                                        </span>
                                        <button onClick={() => setLeaderboardPage(p => Math.min(Math.ceil(metrics.topTraffic.length / 5), p + 1))} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-900 hover:text-white transition-all" aria-label="Next Page"><ChevronRight size={14} /></button>
                                    </div>
                                </div>
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50">
                                            <th className="px-5 py-3 text-center w-14">Rank</th>
                                            <th className="px-5 py-3">Branch</th>
                                            <th className="px-5 py-3 text-center">Spins</th>
                                            <th className="px-5 py-3 text-center">Redeemed</th>
                                            <th className="px-5 py-3 w-1/4">Distribution</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {metrics.topTraffic.slice((leaderboardPage - 1) * 5, leaderboardPage * 5).map((node, idx) => {
                                            const absIdx = (leaderboardPage - 1) * 5 + idx;
                                            const redemptionCount = metrics.topRedemption.find(r => r.name === node.name)?.value || 0;
                                            const rate = node.value > 0 ? (redemptionCount / node.value) * 100 : 0;
                                            const maxVal = metrics.topTraffic[0]?.value || 1;
                                            return (
                                                <tr key={node.name} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-5 py-4 text-center">
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold mx-auto ${absIdx === 0 ? 'bg-amber-400 text-white' : absIdx === 1 ? 'bg-slate-300 text-white' : absIdx === 2 ? 'bg-amber-700/50 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                            #{absIdx + 1}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <p className="font-bold text-sm text-slate-900">{node.name}</p>
                                                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${rate > 50 ? 'bg-emerald-500' : rate > 20 ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                                                            {rate.toFixed(1)}% conversion
                                                        </p>
                                                    </td>
                                                    <td className="px-5 py-4 text-center"><span className="bg-slate-50 px-3 py-1 rounded-lg text-xs font-bold tabular-nums border border-slate-100">{node.value}</span></td>
                                                    <td className="px-5 py-4 text-center"><span className="text-red-600 text-xs font-bold">{redemptionCount}</span></td>
                                                    <td className="px-5 py-4">
                                                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                            <div className="h-full bg-slate-900 group-hover:bg-red-600 transition-colors" style={{ width: `${(node.value / maxVal) * 100}%` }}></div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Intelligence Card */}
                            <div className="bg-slate-900 rounded-2xl p-10 text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-[100px] -mr-48 -mt-48"></div>
                                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                                    <div>
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 mb-4">
                                            <TrendingUp className="w-4 h-4 text-red-400" />
                                            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Strategic Impact</span>
                                        </div>
                                        <h3 className="text-3xl font-black tracking-tight">Intelligence Overview</h3>
                                    </div>
                                    <div className="flex gap-12">
                                        <div>
                                            <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider mb-2">Unique Rate</p>
                                            <div className="text-5xl font-black tabular-nums">{((metrics.uniqueCustomers / (metrics.total || 1)) * 100).toFixed(0)}<span className="text-xl text-red-400 ml-1">%</span></div>
                                        </div>
                                        <div>
                                            <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider mb-2">Repeat Visits</p>
                                            <div className="text-5xl font-black text-red-400 tabular-nums">{metrics.repeatedVisits}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Data Table */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="p-5 border-b border-slate-50 flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 flex-1 min-w-[250px]">
                                        <select className="px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:border-red-500"
                                            value={filters.branchId} onChange={(e) => setFilters(f => ({ ...f, branchId: e.target.value }))} aria-label="Filter by Branch">
                                            <option value="all">All Branches</option>
                                            {branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                                        </select>
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                            <input className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-red-500 text-xs font-semibold"
                                                placeholder="Search codes, phones..." value={filters.searchTerm} onChange={(e) => setFilters(f => ({ ...f, searchTerm: e.target.value }))} />
                                        </div>
                                    </div>
                                    <button onClick={exportAudit} className="bg-slate-900 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors active:scale-[0.98]">
                                        <Download className="w-3.5 h-3.5" /> Export Audit
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</th>
                                                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prize</th>
                                                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Voucher</th>
                                                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Branch</th>
                                                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                                                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {spins.filter(s => !filters.searchTerm || s.voucher_code.toLowerCase().includes(filters.searchTerm.toLowerCase()) || s.customer?.phone?.includes(filters.searchTerm))
                                                .map((spin) => (
                                                    <tr key={spin.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-5 py-4">
                                                            <p className="font-bold text-xs text-slate-900">{spin.customer?.first_name || 'Anonymous'}</p>
                                                            <p className="text-[10px] text-slate-400">{spin.customer?.phone}</p>
                                                        </td>
                                                        <td className="px-5 py-4 text-xs font-bold text-slate-700">{spin.prize?.name}</td>
                                                        <td className="px-5 py-4"><code className="bg-slate-50 px-2 py-1 rounded text-[10px] font-mono text-red-600">{spin.voucher_code}</code></td>
                                                        <td className="px-5 py-4 text-[10px] font-bold text-slate-500">{spin.branch?.name?.split('-')[1] || spin.branch?.name}</td>
                                                        <td className="px-5 py-4">
                                                            {spin.redeemed_at ? (
                                                                <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full text-[10px] font-bold"><CheckCircle2 className="w-3 h-3" /> Redeemed</span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-50 px-2 py-1 rounded-full text-[10px] font-bold"><Clock className="w-3 h-3" /> Pending</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <div className="text-xs font-bold tabular-nums text-slate-700">{new Date(spin.created_at).toLocaleDateString()}</div>
                                                            <div className="text-[10px] text-slate-300">{new Date(spin.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            {!spin.redeemed_at && (() => {
                                                                const daysLeft = Math.floor((new Date(spin.created_at).getTime() + 7 * 24 * 60 * 60 * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
                                                                if (daysLeft < 0) return null;
                                                                const isUrgent = daysLeft <= 3;
                                                                return (
                                                                    <button onClick={async () => {
                                                                        const message = `*Time is running out!*\nRedeem your Tabarak Pharmacies voucher no ${spin.voucher_code} now.\n\n*لا تضيع الفرصة!*\nقسيمتك ${spin.voucher_code} من صيدليات تبارك بتخلص قريب.`;
                                                                        try {
                                                                            const response = await fetch('/spin-header-v4.jpg');
                                                                            const blob = await response.blob();
                                                                            const file = new File([blob], 'tabarak-reminder.jpg', { type: 'image/jpeg' });
                                                                            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                                                                                await navigator.share({ text: message, files: [file] });
                                                                            } else {
                                                                                window.open(`https://wa.me/${spin.customer?.phone}?text=${encodeURIComponent(message)}`, '_blank');
                                                                            }
                                                                        } catch { window.open(`https://wa.me/${spin.customer?.phone}?text=${encodeURIComponent(message)}`, '_blank'); }
                                                                    }}
                                                                        className={`px-3 py-2 rounded-lg font-bold text-[10px] flex items-center gap-1.5 transition-all active:scale-95 ${isUrgent ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
                                                                        <MessageCircle className="w-3 h-3" /> Remind
                                                                    </button>
                                                                );
                                                            })()}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PRIZES VIEW */}
                    {activeView === 'prizes' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-6 duration-700">
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
                                    <div className="p-5 sm:p-6">
                                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-700">
                                                    <Trophy className="h-3.5 w-3.5" />
                                                    Reward Control
                                                </div>
                                                <h3 className="text-2xl font-black tracking-tight text-slate-950">Prize Engine</h3>
                                                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                                                    Configure wheel rewards, probability weight, color identity, and live availability from one control surface.
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setIsAddingPrize(true)}
                                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-sm shadow-red-900/10 transition-all hover:bg-red-700 active:scale-[0.98]"
                                            >
                                                <Plus className="h-4 w-4" /> Add Reward
                                            </button>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-100 bg-slate-50/80 p-4 sm:p-5 lg:border-l lg:border-t-0">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Active</p>
                                                <div className="mt-2 flex items-end justify-between gap-2">
                                                    <span className="text-3xl font-black tabular-nums text-slate-950">{rewardControlMetrics.active}</span>
                                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                                </div>
                                            </div>
                                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Weight</p>
                                                <div className="mt-2 flex items-end justify-between gap-2">
                                                    <span className="text-3xl font-black tabular-nums text-slate-950">{rewardControlMetrics.totalWeight}</span>
                                                    <Target className="h-5 w-5 text-red-600" />
                                                </div>
                                            </div>
                                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Paused</p>
                                                <div className="mt-2 flex items-end justify-between gap-2">
                                                    <span className="text-3xl font-black tabular-nums text-slate-950">{rewardControlMetrics.inactive}</span>
                                                    <Activity className="h-5 w-5 text-slate-400" />
                                                </div>
                                            </div>
                                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Top Weight</p>
                                                <div className="mt-2 min-w-0">
                                                    <p className="truncate text-sm font-black text-slate-950">{rewardControlMetrics.highestWeightPrize?.name || 'No rewards'}</p>
                                                    <p className="mt-1 text-xs font-bold tabular-nums text-red-600">
                                                        {rewardControlMetrics.highestWeightPrize ? `Weight ${rewardControlMetrics.highestWeightPrize.probabilityWeight}` : '0'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {isAddingPrize && (
                                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 p-4 sm:p-5">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                                                <Ticket className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-lg font-black tracking-tight text-slate-950">Create New Reward</h4>
                                                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Set the reward label, wheel probability, color swatch, and launch state.</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setIsAddingPrize(false)}
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
                                            aria-label="Close reward form"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.2fr_0.7fr_0.7fr_0.6fr]">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reward Name</label>
                                            <input
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
                                                placeholder="Ex: 20% Discount"
                                                value={newPrize.name}
                                                onChange={(e) => setNewPrize(p => ({ ...p, name: e.target.value }))}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Weight</label>
                                            <input
                                                type="number"
                                                min={1}
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold tabular-nums text-slate-800 outline-none transition-all focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
                                                value={newPrize.probabilityWeight}
                                                onChange={(e) => setNewPrize(p => ({ ...p, probabilityWeight: Number(e.target.value || 0) }))}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Wheel Color</label>
                                            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                                <input
                                                    type="color"
                                                    className="h-9 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                                                    value={newPrize.color || '#F43F5E'}
                                                    onChange={(e) => setNewPrize(p => ({ ...p, color: e.target.value }))}
                                                />
                                                <span className="text-xs font-black uppercase tabular-nums text-slate-500">{newPrize.color || '#F43F5E'}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</label>
                                            <button
                                                type="button"
                                                onClick={() => setNewPrize(p => ({ ...p, isActive: !p.isActive }))}
                                                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${newPrize.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}
                                            >
                                                {newPrize.isActive ? 'Active' : 'Paused'}
                                                <span className={`h-2.5 w-2.5 rounded-full ${newPrize.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:justify-end sm:p-5">
                                        <button
                                            onClick={() => setIsAddingPrize(false)}
                                            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-100"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleCreatePrize}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-red-700 active:scale-[0.98]"
                                        >
                                            <Save className="h-4 w-4" /> Create Reward
                                        </button>
                                    </div>
                                </div>
                            )}

                            {prizes.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                                        <Trophy className="h-7 w-7" />
                                    </div>
                                    <h4 className="mt-5 text-lg font-black tracking-tight text-slate-950">No rewards configured</h4>
                                    <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">Add the first reward to activate the wheel prize engine for branch QR sessions.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                    {prizes.map((prize) => {
                                        const weight = Number(prize.probabilityWeight || 0);
                                        const share = rewardControlMetrics.totalWeight > 0 ? (weight / rewardControlMetrics.totalWeight) * 100 : 0;
                                        const color = prize.color || '#B91c1c';

                                        return (
                                            <article
                                                key={prize.id}
                                                className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md ${!prize.isActive && editingPrizeId !== prize.id ? 'border-slate-100 opacity-70' : 'border-slate-200'}`}
                                            >
                                                {editingPrizeId === prize.id ? (
                                                    <div className="p-5">
                                                        <div className="mb-5 flex items-start justify-between gap-4">
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-red-600">Editing Reward</p>
                                                                <h4 className="mt-1 text-lg font-black tracking-tight text-slate-950">{prize.name}</h4>
                                                            </div>
                                                            <button
                                                                onClick={cancelEditing}
                                                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-all hover:bg-slate-100"
                                                                aria-label="Cancel editing"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </div>

                                                        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reward Name</label>
                                                                <input
                                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
                                                                    value={editForm.name || ''}
                                                                    onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Weight</label>
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold tabular-nums text-slate-800 outline-none transition-all focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
                                                                    value={editForm.probabilityWeight || 0}
                                                                    onChange={e => setEditForm(p => ({ ...p, probabilityWeight: Number(e.target.value || 0) }))}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="mt-4 space-y-2">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Wheel Color</label>
                                                            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                                                <input
                                                                    type="color"
                                                                    className="h-9 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                                                                    value={editForm.color || '#F43F5E'}
                                                                    onChange={(e) => setEditForm(p => ({ ...p, color: e.target.value }))}
                                                                />
                                                                <span className="text-xs font-black uppercase tabular-nums text-slate-500">{editForm.color || '#F43F5E'}</span>
                                                            </div>
                                                        </div>

                                                        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
                                                            <button
                                                                onClick={cancelEditing}
                                                                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-100"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={handleUpdatePrize}
                                                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-red-700"
                                                            >
                                                                <Save className="h-4 w-4" /> Save Reward
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="h-2" style={{ backgroundColor: color }} />
                                                        <div className="p-5">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="flex min-w-0 items-start gap-3">
                                                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundColor: color }}>
                                                                        <Trophy className="h-5 w-5" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="mb-2 flex flex-wrap items-center gap-2">
                                                                            <span className={`rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-widest ${prize.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                                                                {prize.isActive ? 'Live' : 'Paused'}
                                                                            </span>
                                                                            <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                                                                {color}
                                                                            </span>
                                                                        </div>
                                                                        <h4 className="truncate text-lg font-black tracking-tight text-slate-950">{prize.name}</h4>
                                                                        <p className="mt-1 text-xs font-bold text-slate-400">Reward probability control</p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex shrink-0 items-center gap-1">
                                                                    <button
                                                                        onClick={() => togglePrizeStatus(prize)}
                                                                        className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${prize.isActive ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-50 text-slate-300 hover:bg-slate-100'}`}
                                                                        title={prize.isActive ? 'Deactivate' : 'Activate'}
                                                                        aria-label={prize.isActive ? 'Deactivate reward' : 'Activate reward'}
                                                                    >
                                                                        <Activity className="h-3.5 w-3.5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => startEditing(prize)}
                                                                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900"
                                                                        aria-label="Edit reward"
                                                                    >
                                                                        <Edit2 className="h-3.5 w-3.5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeletePrize(prize.id)}
                                                                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-300 transition-all hover:bg-red-50 hover:text-red-600"
                                                                        aria-label="Delete reward"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="mt-5 grid grid-cols-2 gap-3">
                                                                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Weight</p>
                                                                    <p className="mt-2 text-2xl font-black tabular-nums text-slate-950">{weight}</p>
                                                                </div>
                                                                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Share</p>
                                                                    <p className="mt-2 text-2xl font-black tabular-nums text-slate-950">{share.toFixed(1)}%</p>
                                                                </div>
                                                            </div>

                                                            <div className="mt-4">
                                                                <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                                    <span>Wheel Distribution</span>
                                                                    <span>{share.toFixed(1)}%</span>
                                                                </div>
                                                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                                                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, share)}%`, backgroundColor: color }} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                    {/* BRANCHES VIEW */}
                    {activeView === 'branches' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Branch Control</h3>
                                    <p className="text-slate-400 text-sm font-medium">Manage branch locations and permissions</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleBulkStatusChange(true)} disabled={isSyncing}
                                        className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.98]">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Enable All
                                    </button>
                                    <button onClick={() => handleBulkStatusChange(false)} disabled={isSyncing}
                                        className="px-4 py-2.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.98]">
                                        <X className="w-3.5 h-3.5" /> Suspend All
                                    </button>
                                    <button onClick={() => setIsAddingBranch(true)}
                                        className="px-4 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors flex items-center gap-1.5">
                                        <Plus className="w-3.5 h-3.5" /> Add Branch
                                    </button>
                                    <div className="bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 flex items-center gap-1.5">
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="text-[10px] font-bold text-emerald-800">{branches.filter(b => b.role === 'branch').length} Nodes</span>
                                    </div>
                                </div>
                            </div>

                            {isAddingBranch && (
                                <div className="bg-slate-900 p-8 rounded-2xl text-white">
                                    <h4 className="text-lg font-bold mb-6">New Branch</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Name</label>
                                            <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red-500 text-white" placeholder="City Centre Branch"
                                                value={newBranch.name} onChange={(e) => setNewBranch(p => ({ ...p, name: e.target.value }))} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Code</label>
                                            <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red-500 text-white" placeholder="BH-CC-01"
                                                value={newBranch.code} onChange={(e) => setNewBranch(p => ({ ...p, code: e.target.value }))} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">WhatsApp</label>
                                            <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red-500 text-white" placeholder="97333344445"
                                                value={newBranch.whatsappNumber} onChange={(e) => setNewBranch(p => ({ ...p, whatsappNumber: e.target.value }))} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Google Maps Link</label>
                                            <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red-500 text-white" placeholder="https://maps.app.goo.gl/..."
                                                value={newBranch.googleMapsLink} onChange={(e) => setNewBranch(p => ({ ...p, googleMapsLink: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-3">
                                        <button onClick={() => setIsAddingBranch(false)} className="px-5 py-2.5 text-xs font-bold text-white/40 hover:text-white">Cancel</button>
                                        <button onClick={handleCreateBranch} className="bg-red-600 text-white px-6 py-2.5 rounded-lg text-xs font-bold hover:bg-red-700">Create Branch</button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                {branches.filter(b => b.role === 'branch').map((b) => (
                                    <div key={b.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                                        <div className="flex items-center gap-5 flex-1">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white transition-all ${b.isSpinEnabled ? 'bg-red-600' : 'bg-slate-200 text-slate-400'}`}>
                                                <Store className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-lg font-bold text-slate-900 tracking-tight">{b.name}</h4>
                                                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-400">{b.code}</span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100 focus-within:border-red-300 transition-all">
                                                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                        <input type="text" defaultValue={b.googleMapsLink || ''}
                                                            onBlur={async (e) => { if (e.target.value !== b.googleMapsLink) { await spinWinService.management.branches.update(b.id, { googleMapsLink: e.target.value }); loadData(); } }}
                                                            placeholder="Google Maps Link..." className="bg-transparent border-none outline-none text-[10px] font-semibold text-slate-700 w-full placeholder:text-slate-300" />
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100 focus-within:border-red-300 transition-all">
                                                        <MessageCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                        <input type="text" defaultValue={b.whatsappNumber || ''}
                                                            onBlur={async (e) => { if (e.target.value !== b.whatsappNumber) { await spinWinService.management.branches.update(b.id, { whatsappNumber: e.target.value }); loadData(); } }}
                                                            placeholder="WhatsApp Number..." className="bg-transparent border-none outline-none text-[10px] font-semibold text-slate-700 w-full placeholder:text-slate-300" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-5 shrink-0">
                                            <button
                                                onClick={async () => {
                                                    await spinWinService.management.branches.update(b.id, { isSpinEnabled: !b.isSpinEnabled });
                                                    loadData();
                                                    showNotification('success', `${b.name} ${!b.isSpinEnabled ? 'enabled' : 'disabled'}`);
                                                }}
                                                className={`w-14 h-7 rounded-full p-1 transition-all duration-300 ${b.isSpinEnabled ? 'bg-red-600' : 'bg-slate-200'}`}
                                                title={b.isSpinEnabled ? 'Disable Spin' : 'Enable Spin'}
                                                aria-label={b.isSpinEnabled ? 'Disable Spin' : 'Enable Spin'}
                                            >
                                                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${b.isSpinEnabled ? 'translate-x-7' : 'translate-x-0'}`}></div>
                                            </button>
                                            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border ${b.isSpinEnabled ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                {b.isSpinEnabled ? 'ENABLED' : 'DISABLED'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
