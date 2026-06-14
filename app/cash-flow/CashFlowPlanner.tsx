import React, { useState, useEffect, useMemo } from 'react';
import {
    TrendingUp,
    TrendingDown,
    AlertCircle,
    Plus,
    ArrowRight,
    Calendar,
    CheckCircle2,
    Clock,
    Filter,
    Search,
    ChevronRight,
    Settings,
    Shield,
    CreditCard,
    DollarSign,
    Briefcase,
    History,
    Activity,
    Heart,
    Wallet
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
    Supplier,
    Cheque,
    Expense,
    ActualRevenue,
    ExpectedRevenue,
    ForecastDay,
    CashFlowSettings,
    Role
} from '../../types';
import { BackToModulesButton } from '../shared';
import { calculateForecast, getSmartSuggestions } from '../../utils/cashFlowUtils';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell
} from 'recharts';
import Swal from 'sweetalert2';
import { SuppliersView } from './SuppliersView';
import { ExpensesView } from './ExpensesView';
import { RevenuesView } from './RevenuesView';
import { AuditLogView } from './AuditLogView';
import { BranchCashDifferenceTracker } from './BranchCashDifferenceTracker';
import { isManagerRole } from '../../lib/access';

interface CashFlowPlannerProps {
    onBack: () => void;
    branchId?: string;
    userRole?: Role;
    pharmacistName?: string;
    initialTab?: 'dashboard' | 'suppliers' | 'expenses' | 'revenues' | 'forecast' | 'history';
}

export const CashFlowPlanner: React.FC<CashFlowPlannerProps> = ({ onBack, branchId, userRole = 'branch', pharmacistName, initialTab }) => {
    const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'suppliers' | 'expenses' | 'revenues' | 'forecast' | 'history'>(initialTab || 'dashboard');
    const [loading, setLoading] = useState(true);

    // Data State
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [cheques, setCheques] = useState<Cheque[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [actualRevenues, setActualRevenues] = useState<ActualRevenue[]>([]);
    const [expectedRevenues, setExpectedRevenues] = useState<ExpectedRevenue[]>([]);
    const [settings, setSettings] = useState<CashFlowSettings>({
        safeThreshold: 1000,
        initialBalance: 0,
        forecastHorizon: 30
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [s, c, e, ra, re, st] = await Promise.all([
                supabase.cashFlow.suppliers.list(),
                supabase.cashFlow.cheques.list(),
                supabase.cashFlow.expenses.list(),
                supabase.cashFlow.revenuesActual.list(),
                supabase.cashFlow.revenuesExpected.list(),
                supabase.cashFlow.settings.get()
            ]);
            setSuppliers(s);
            setCheques(c);
            setExpenses(e);
            setActualRevenues(ra);
            setExpectedRevenues(re);
            setSettings(st);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const forecast = useMemo(() => {
        return calculateForecast(settings, cheques, expenses, actualRevenues, expectedRevenues);
    }, [settings, cheques, expenses, actualRevenues, expectedRevenues]);

    const suggestions = useMemo(() => {
        return getSmartSuggestions(forecast, suppliers);
    }, [forecast, suppliers]);

    const stats = useMemo(() => {
        const currentBalance = settings.initialBalance; // simplified for now
        const next30DaysOutflow = forecast.reduce((acc, day) => acc + day.outflow, 0);
        const next30DaysInflow = forecast.reduce((acc, day) => acc + day.inflow, 0);
        const cashGap = forecast.some(day => day.closingBalance < 0)
            ? Math.min(...forecast.map(day => day.closingBalance))
            : 0;

        const upcomingLargestCheque = cheques
            .filter(c => c.status === 'Scheduled')
            .sort((a, b) => b.amount - a.amount)[0];

        const todayForecast = forecast[0] || {} as ForecastDay;
        const morningCoverage = todayForecast.morningBalance || 0;
        const atRiskToday = todayForecast.items?.filter(it => it.type === 'cheque' && it.amount > todayForecast.morningBalance + it.amount).length || 0;
        const cashArriving = todayForecast.items?.filter(it => it.type === 'revenue_actual' && (it.ref.settlementTime || '08:00') < '10:00').reduce((acc, it) => acc + it.amount, 0) || 0;
        const visaArriving = todayForecast.items?.filter(it => (it.type === 'revenue_actual' || it.type === 'revenue_expected') && (it.ref.settlementTime || it.ref.expectedTime || '13:00') >= '10:00').reduce((acc, it) => acc + it.amount, 0) || 0;

        return {
            currentBalance,
            next30DaysOutflow,
            next30DaysInflow,
            cashGap,
            upcomingLargestCheque,
            morningCoverage,
            atRiskToday,
            cashArriving,
            visaArriving
        };
    }, [settings, forecast, cheques]);

    const handleExecuteSuggestion = async (suggestion: any) => {
        const { type, item, date, reason } = suggestion;

        if (type === 'delay_cheque') {
            const { value: newDate } = await Swal.fire({
                title: 'Reschedule Cheque',
                text: `Suggested: ${reason}`,
                input: 'date',
                inputValue: new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0],
                showCancelButton: true,
                confirmButtonText: 'Confirm Delay',
                customClass: {
                    popup: 'rounded-lg',
                    confirmButton: 'bg-brand text-white rounded-lg px-4 py-2.5 font-bold text-sm'
                }
            });

            if (newDate) {
                await supabase.cashFlow.cheques.upsert({
                    ...item,
                    dueDate: newDate,
                    status: 'Delayed',
                    delayReason: `AI Suggestion: ${reason}`
                });
                fetchData();
                Swal.fire({ icon: 'success', title: 'Cheque Rescheduled', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            }
        } else if (type === 'move_to_afternoon') {
            const result = await Swal.fire({
                title: 'Optimize Timeline',
                text: `Move Cheque #${item.chequeNumber} to 1:00 PM (Post-Visa) for better morning coverage?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Execute Move',
                customClass: { popup: 'rounded-lg', confirmButton: 'bg-brand text-white rounded-lg px-4 py-2.5 font-bold text-sm' }
            });

            if (result.isConfirmed) {
                await supabase.cashFlow.cheques.upsert({
                    ...item,
                    executionTime: '13:00'
                });
                fetchData();
                Swal.fire({ icon: 'success', title: 'Timeline Optimized', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            }
        } else if (type === 'delay_expense') {
            const { value: newDate } = await Swal.fire({
                title: 'Postpone Expense',
                text: `Reschedule ${item.category} to alleviate morning pressure?`,
                input: 'date',
                inputValue: new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0],
                showCancelButton: true,
                confirmButtonText: 'Confirm Postpone',
                customClass: { popup: 'rounded-lg', confirmButton: 'bg-brand text-white rounded-lg px-4 py-2.5 font-bold text-sm' }
            });

            if (newDate) {
                await supabase.cashFlow.expenses.upsert({
                    ...item,
                    expenseDate: newDate
                });
                fetchData();
                Swal.fire({ icon: 'success', title: 'Expense Postponed', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            }
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
                <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading financial alerts...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center space-x-3 mb-2">
                        <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest">Global Module</span>
                        <span className="px-3 py-1 bg-brand/10 text-brand rounded-lg text-[10px] font-black uppercase tracking-widest">Manager Control</span>
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Cash Flow <span className="text-brand">Planner & Monitor</span></h2>
                    <p className="text-slate-500 font-medium">Predictive liquidity management and risk auditing</p>
                </div>

                <div className="flex items-center space-x-4">
                    <BackToModulesButton onClick={onBack} />
                </div>
            </div>

            {/* Sub Navigation */}
            <div className="tab-nav w-full overflow-x-auto md:w-fit">
                {[
                    { id: 'dashboard', label: 'Overview', icon: Activity },
                    { id: 'suppliers', label: 'Suppliers & Cheques', icon: CreditCard },
                    { id: 'expenses', label: 'OpEx Planner', icon: TrendingDown },
                    { id: 'revenues', label: 'Revenue Entry', icon: TrendingUp },
                    { id: 'history', label: 'Audit Log', icon: History }
                ].filter(tab => isManagerRole(userRole) || userRole === 'owner' || userRole === 'accounts').map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id as any)}
                        className={`tab-item flex items-center space-x-2 whitespace-nowrap text-[10px] uppercase tracking-widest ${activeSubTab === tab.id ? 'tab-item-brand' : ''}`}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                    </button>
                ))}
                {isManagerRole(userRole) && (
                    <button
                        onClick={() => {
                            Swal.fire({
                                title: 'Global Settings',
                                html: `
                <div class="space-y-4 text-left p-4">
                  <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Safe Threshold (BHD)</label>
                  <input id="safe-threshold" type="number" step="0.001" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-sm font-bold" value="${settings.safeThreshold}">
                  
                  <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Opening Balance (BHD)</label>
                  <input id="initial-balance" type="number" step="0.001" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-sm font-bold" value="${settings.initialBalance}">
                  
                  <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Forecast Horizon</label>
                  <select id="forecast-horizon" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
                    <option value="30" ${settings.forecastHorizon === 30 ? 'selected' : ''}>30 Days</option>
                    <option value="60" ${settings.forecastHorizon === 60 ? 'selected' : ''}>60 Days</option>
                    <option value="90" ${settings.forecastHorizon === 90 ? 'selected' : ''}>90 Days</option>
                  </select>
                </div>
              `,
                                showCancelButton: true,
                                confirmButtonText: 'Save Configuration',
                                customClass: {
                                    popup: 'rounded-lg',
                                    confirmButton: 'bg-brand text-white rounded-lg px-4 py-2.5 font-bold text-sm',
                                    cancelButton: 'bg-slate-100 text-slate-600 rounded-lg px-4 py-2.5 font-bold text-sm'
                                }
                            }).then(async (result) => {
                                if (result.isConfirmed) {
                                    const newSettings = {
                                        safeThreshold: Number((document.getElementById('safe-threshold') as HTMLInputElement).value),
                                        initialBalance: Number((document.getElementById('initial-balance') as HTMLInputElement).value),
                                        forecastHorizon: Number((document.getElementById('forecast-horizon') as HTMLSelectElement).value)
                                    };
                                    await supabase.cashFlow.settings.update(newSettings);
                                    setSettings(newSettings);
                                    Swal.fire('Updated', 'Global settings applied successfully.', 'success');
                                }
                            });
                        }}
                        className="btn-secondary h-9 w-9 !p-0 ml-1"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                )}
            </div>

            {activeSubTab === 'dashboard' && (
                <DashboardView
                    stats={stats}
                    forecast={forecast}
                    suggestions={suggestions}
                    suppliers={suppliers}
                    cheques={cheques}
                    settings={settings}
                    onRefresh={fetchData}
                    onExecuteSuggestion={handleExecuteSuggestion}
                />
            )}

            {activeSubTab === 'suppliers' && (
                <SuppliersView
                    suppliers={suppliers}
                    cheques={cheques}
                    onRefresh={fetchData}
                />
            )}

            {activeSubTab === 'expenses' && (
                <ExpensesView
                    expenses={expenses}
                    onRefresh={fetchData}
                />
            )}

            {activeSubTab === 'revenues' && (
                <RevenuesView
                    actual={actualRevenues}
                    expected={expectedRevenues}
                    onRefresh={fetchData}
                />
            )}

            {activeSubTab === 'history' && (
                <AuditLogView
                    cheques={cheques}
                    expenses={expenses}
                />
            )}
        </div>
    );
};

// --- SUB VIEWS ---

const DashboardView: React.FC<{
    stats: any,
    forecast: ForecastDay[],
    suggestions: any[],
    suppliers: Supplier[],
    cheques: Cheque[],
    settings: CashFlowSettings,
    onRefresh: () => void,
    onExecuteSuggestion: (suggestion: any) => void
}> = ({ stats, forecast, suggestions, suppliers, cheques, settings, onRefresh, onExecuteSuggestion }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Top Stats */}
            <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Morning Coverage"
                    value={stats.morningCoverage}
                    sub="Balance at 9:00 AM"
                    icon={Clock}
                    color={stats.morningCoverage < 0 ? 'red' : 'brand'}
                    trend={stats.morningCoverage < 0 ? 'down' : 'up'}
                />
                <StatCard
                    label="Cheques at Risk"
                    value={stats.atRiskToday}
                    sub="Today's Morning Risk"
                    icon={AlertCircle}
                    color={stats.atRiskToday > 0 ? 'red' : 'emerald'}
                    isCurrency={false}
                />
                <StatCard
                    label="Morning Cash"
                    value={stats.cashArriving}
                    sub="Arriving before 10 AM"
                    icon={DollarSign}
                    color="emerald"
                />
                <StatCard
                    label="Visa Settlement"
                    value={stats.visaArriving}
                    sub="Arriving after 1 PM"
                    icon={CreditCard}
                    color="blue"
                />
            </div>

            {/* Main Chart */}
            <div className="lg:col-span-3 space-y-5">
                <div className="operational-panel p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Liquidity Forecast</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Estimated closing balance over ${settings.forecastHorizon} days</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <div className="w-2 h-2 bg-brand rounded-full"></div>
                                <span>Closing Balance</span>
                            </span>
                            <span className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                <span>Risk Threshold</span>
                            </span>
                        </div>
                    </div>
                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={forecast}>
                                <defs>
                                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }}
                                    tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }}
                                    tickFormatter={(val) => `${val.toLocaleString(undefined, { minimumFractionDigits: 3 })} BHD`}
                                />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload as ForecastDay;
                                            return (
                                                <div className="bg-slate-900 text-white p-4 rounded-lg shadow-xl border border-white/10 backdrop-blur-xl">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-white/50">{new Date(data.date).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between space-x-8">
                                                            <span className="text-xs text-white/50 font-bold uppercase">Opening</span>
                                                            <span className="text-xs font-black">{data.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 3 })} BHD</span>
                                                        </div>
                                                        <div className="flex justify-between space-x-8">
                                                            <span className="text-xs text-red-400 font-bold uppercase">Morning Snapshot</span>
                                                            <span className={`text-xs font-black ${data.morningBalance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                                {data.morningBalance.toLocaleString(undefined, { minimumFractionDigits: 3 })} BHD
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between space-x-8">
                                                            <span className="text-xs text-blue-400 font-bold uppercase">Afternoon Sync</span>
                                                            <span className="text-xs font-black">{data.afternoonBalance.toLocaleString(undefined, { minimumFractionDigits: 3 })} BHD</span>
                                                        </div>
                                                        <div className="pt-2 mt-2 border-t border-white/10 flex justify-between space-x-8">
                                                            <span className="text-xs text-brand font-black uppercase">Closing</span>
                                                            <span className="text-sm font-black text-brand">{data.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 3 })} BHD</span>
                                                        </div>
                                                    </div>
                                                    {data.items.length > 0 && (
                                                        <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                                                            <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Major Events</p>
                                                            {data.items.slice(0, 3).map((it, idx) => (
                                                                <div key={idx} className="flex items-center justify-between text-[10px]">
                                                                    <span className="text-white/80">{it.name}</span>
                                                                    <span className={it.type.includes('revenue') ? 'text-emerald-400' : 'text-red-400'}>
                                                                        {it.type.includes('revenue') ? '+' : '-'}{it.amount.toLocaleString(undefined, { minimumFractionDigits: 3 })} BHD
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            {data.items.length > 3 && <p className="text-[8px] text-white/30 text-center">+{data.items.length - 3} more items</p>}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="closingBalance"
                                    stroke="#ef4444"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorBalance)"
                                    animationDuration={2000}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Heatmap */}
                <div className="operational-panel p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Financial Risk Calendar</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Interactive heatmap of liquidity stability</p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-slate-50 border border-slate-100 rounded"></div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Safe</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-amber-100 rounded"></div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Warning</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-red-100 rounded"></div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Critical</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">{d}</div>
                        ))}
                        {forecast.map((day, idx) => (
                            <div
                                key={day.date}
                                className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all hover:scale-105 cursor-pointer relative group ${day.morningRisk === 'Critical' ? 'bg-red-50 border-red-100 text-red-600' :
                                    day.morningRisk === 'Warning' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                        'bg-slate-50 border-slate-100 text-slate-400'
                                    }`}
                            >
                                <span className="text-xs font-black">{new Date(day.date).getDate()}</span>
                                <div className="flex space-x-0.5 mt-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${day.morningBalance < 0 ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                                    <div className={`w-1.5 h-1.5 rounded-full ${day.afternoonBalance < 0 ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                                </div>
                                <div className="absolute inset-0 bg-slate-900 rounded-xl opacity-0 group-hover:opacity-100 transition-all p-3 flex flex-col justify-center text-white z-20">
                                    <p className="text-[7px] font-black uppercase mb-1">Timeline</p>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[7px] font-bold">
                                            <span>09:00</span>
                                            <span className={day.morningBalance < 0 ? 'text-red-400' : 'text-emerald-400'}>{(day.morningBalance / 1000).toFixed(3)}k BHD</span>
                                        </div>
                                        <div className="flex justify-between text-[7px] font-bold">
                                            <span>13:00</span>
                                            <span className={day.afternoonBalance < 0 ? 'text-red-400' : 'text-emerald-400'}>{(day.afternoonBalance / 1000).toFixed(3)}k BHD</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sidebar Suggestions */}
            <div className="space-y-5">
                <div className="operational-panel p-5">
                    <div>
                        <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center mb-5">
                            <Shield className="w-6 h-6 text-brand" />
                        </div>
                        <h3 className="text-lg font-black tracking-tight mb-2 text-slate-900">Smart Suggestions Engine</h3>
                        <p className="text-slate-500 text-xs font-medium leading-relaxed mb-5">AI models detected {suggestions.length} ways to optimize your cash gap.</p>

                        <div className="space-y-3">
                            {suggestions.length === 0 ? (
                                <div className="p-5 bg-slate-50 border border-slate-100 rounded-lg flex flex-col items-center text-center">
                                    <Heart className="w-8 h-8 text-emerald-400 mb-3" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Perfect Stability</p>
                                    <p className="text-xs text-slate-500 mt-1 font-medium">No liquidity risks detected in the next {settings.forecastHorizon} days.</p>
                                </div>
                            ) : (
                                suggestions.slice(0, 4).map((sug, idx) => (
                                    <div key={idx} className="p-4 bg-slate-50 hover:bg-white border border-slate-100 rounded-lg transition-colors group">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${sug.riskLevel === 'Low' ? 'bg-emerald-500/20 text-emerald-400' :
                                                sug.riskLevel === 'Medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                {sug.riskLevel} Risk
                                            </span>
                                            <span className="text-[8px] font-black text-slate-400 uppercase">{new Date(sug.date).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-900 group-hover:text-brand transition-colors">
                                            {sug.type === 'delay_cheque' ? `Delay Cheque #${sug.item.chequeNumber}` : `Postpone ${sug.item.category}`}
                                        </p>
                                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{sug.reason}</p>
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200/70">
                                            <div className="flex items-center space-x-2">
                                                <span className="text-[8px] font-black text-slate-400 uppercase">Impact</span>
                                                <span className="text-xs font-black text-slate-900">+{sug.impact.toLocaleString(undefined, { minimumFractionDigits: 3 })} BHD</span>
                                            </div>
                                            <button
                                                onClick={() => onExecuteSuggestion(sug)}
                                                className="text-[10px] font-black uppercase text-brand flex items-center group-hover:translate-x-1 transition-transform"
                                            >
                                                <span>Execute</span>
                                                <ArrowRight className="w-3 h-3 ml-1" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {suggestions.length > 4 && (
                            <button className="btn-secondary w-full mt-5 text-[10px] uppercase tracking-widest">
                                View All {suggestions.length} Suggestions
                            </button>
                        )}
                    </div>
                </div>

                <div className="operational-panel p-5">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Upcoming Large Payments</h4>
                    <div className="space-y-4">
                        {cheques
                            .filter(c => c.status === 'Scheduled')
                            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                            .slice(0, 3)
                            .map(c => (
                                <div key={c.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white ${c.priority === 'Critical' ? 'bg-red-500 shadow-sm' :
                                            c.priority === 'Normal' ? 'bg-slate-900' : 'bg-emerald-500'
                                            }`}>
                                            <CreditCard className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-900 leading-none">#{c.chequeNumber}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Due {new Date(c.dueDate).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-black text-slate-900">{c.amount.toLocaleString(undefined, { minimumFractionDigits: 3 })} BHD</span>
                                </div>
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ label: string, value: number, sub: string, icon: any, color: string, trend?: 'up' | 'down', isCurrency?: boolean }> = ({ label, value, sub, icon: Icon, color, trend, isCurrency = true }) => {
    const colorMap: any = {
        brand: 'border-brand/30 text-brand bg-brand/5',
        slate: 'border-slate-200 text-slate-900 bg-slate-50',
        red: 'border-red-200 text-red-600 bg-red-50',
        emerald: 'border-emerald-200 text-emerald-600 bg-emerald-50',
        blue: 'border-blue-200 text-blue-600 bg-blue-50'
    };
    const formattedValue = isCurrency
        ? value.toLocaleString(undefined, { minimumFractionDigits: 3 })
        : value.toLocaleString();

    return (
        <div className={`p-5 rounded-lg border transition-colors bg-white ${colorMap[color] || colorMap.slate} cursor-default`}>
            <div className="flex items-center justify-between mb-5">
                <div className="p-3 bg-white rounded-lg shadow-sm border border-slate-100">
                    <Icon className="w-5 h-5" />
                </div>
                {trend && (
                    <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-[8px] font-black uppercase ${trend === 'up' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>{trend === 'up' ? 'Positive' : 'Deficit'}</span>
                    </div>
                )}
            </div>
            <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</h4>
                <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-black tracking-tight text-slate-900">{formattedValue}</span>
                    {isCurrency && <span className="text-[10px] font-bold text-slate-400 ml-1">BHD</span>}
                </div>
                <p className="text-[10px] font-bold text-slate-500 mt-2 truncate opacity-70">{sub}</p>
            </div>
        </div>
    );
};
