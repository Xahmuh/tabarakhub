
import React from 'react';
import {
    Users,
    Calendar,
    Clock,
    Building2,
    Plus,
    Minus,
    Activity,
    ShieldCheck,
    TrendingUp,
    Briefcase
} from 'lucide-react';
import { useStaffingCalculator, Region } from './useStaffingCalculator';

// Initial Data
const INITIAL_REGIONS: Region[] = [
    { id: 'r1', name: 'Region 1', branches24h: 1, branchesRegular: 10 },
    { id: 'r2', name: 'Region 2', branches24h: 1, branchesRegular: 9 },
];

export const WorkforcePage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const {
        regions,
        updateRegion,
        includePublicHolidays,
        setIncludePublicHolidays,
        includeRamadan,
        setIncludeRamadan,
        includeAnnualLeave,
        setIncludeAnnualLeave,
        ramadanConfig,
        setRamadanConfig,
        currentStaff,
        setCurrentStaff,
        leaveCycleMonths,
        setLeaveCycleMonths,
        results
    } = useStaffingCalculator(INITIAL_REGIONS);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700" dir="auto">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 end-0 w-64 h-64 bg-slate-50 rounded-full -me-32 -mt-32 blur-3xl pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600">
                            <Briefcase className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Workforce & Relief</h2>
                            <p className="text-slate-500 font-medium">Strategic Staffing Analysis & Planning</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6 relative z-10">
                    <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-200">
                        <span className="text-sm font-bold text-slate-600">Ramadan Impact</span>
                        <button
                            onClick={() => setIncludeRamadan(!includeRamadan)}
                            className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${includeRamadan ? 'bg-amber-500' : 'bg-slate-300'}`}
                            title="Toggle Ramadan Impact"
                            aria-label="Toggle Ramadan Impact"
                        >
                            <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${includeRamadan ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-200">
                        <span className="text-sm font-bold text-slate-600">Annual Leave (+30 Days)</span>
                        <button
                            onClick={() => setIncludeAnnualLeave(!includeAnnualLeave)}
                            className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${includeAnnualLeave ? 'bg-blue-500' : 'bg-slate-300'}`}
                            title="Toggle Annual Leave Calculation"
                            aria-label="Toggle Annual Leave Calculation"
                        >
                            <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${includeAnnualLeave ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-200">
                        <span className="text-sm font-bold text-slate-600">Public Holidays (+14 Days)</span>
                        <button
                            onClick={() => setIncludePublicHolidays(!includePublicHolidays)}
                            className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${includePublicHolidays ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            title="Toggle Public Holidays"
                            aria-label="Toggle Public Holidays"
                        >
                            <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${includePublicHolidays ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    {onBack && (
                        <button onClick={onBack} className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
                            Back to Dashboard
                        </button>
                    )}
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Inputs */}
                <div className="lg:col-span-1 space-y-6">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest flex items-center">
                        <Building2 className="w-4 h-4 me-2" />
                        Network Configuration
                    </h3>

                    {regions.map((region) => (
                        <div key={region.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-brand/5 hover:border-brand/30 transition-all duration-700 group">
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="text-xl font-bold text-slate-900">{region.name}</h4>
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-brand/10 group-hover:text-brand transition-colors">
                                    <Building2 className="w-4 h-4" />
                                </div>
                            </div>

                            {/* 24h Branches */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-bold text-slate-500">24h Branches (3 Shifts)</span>
                                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">High Demand</span>
                                </div>
                                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl">
                                    <button
                                        onClick={() => updateRegion(region.id, 'branches24h', region.branches24h - 1)}
                                        className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-slate-600 hover:bg-red-50 hover:text-red-500 transition-colors"
                                        title="Decrease 24h Branches"
                                        aria-label="Decrease 24h Branches"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="text-2xl font-black text-slate-900 tabular-nums">{region.branches24h}</span>
                                    <button
                                        onClick={() => updateRegion(region.id, 'branches24h', region.branches24h + 1)}
                                        className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-slate-600 hover:bg-emerald-50 hover:text-emerald-500 transition-colors"
                                        title="Increase 24h Branches"
                                        aria-label="Increase 24h Branches"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Regular Branches */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-bold text-slate-500">Regular Branches (2 Shifts)</span>
                                </div>
                                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl">
                                    <button
                                        onClick={() => updateRegion(region.id, 'branchesRegular', region.branchesRegular - 1)}
                                        className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-slate-600 hover:bg-red-50 hover:text-red-500 transition-colors"
                                        title="Decrease Regular Branches"
                                        aria-label="Decrease Regular Branches"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="text-2xl font-black text-slate-900 tabular-nums">{region.branchesRegular}</span>
                                    <button
                                        onClick={() => updateRegion(region.id, 'branchesRegular', region.branchesRegular + 1)}
                                        className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-slate-600 hover:bg-emerald-50 hover:text-emerald-500 transition-colors"
                                        title="Increase Regular Branches"
                                        aria-label="Increase Regular Branches"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Current Staff Input */}
                    <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl border-2 border-slate-800">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                <Users className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg leading-tight">Current Headcount</h4>
                                <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest">عدد الصيادلة الحالي</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                            <button
                                onClick={() => setCurrentStaff(Math.max(0, currentStaff - 1))}
                                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            <input
                                type="number"
                                value={currentStaff}
                                onChange={(e) => setCurrentStaff(Number(e.target.value))}
                                className="bg-transparent text-center text-3xl font-black focus:outline-none w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                                onClick={() => setCurrentStaff(currentStaff + 1)}
                                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-white hover:bg-emerald-500 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Target Leave Cycle Input */}
                    <div className="bg-indigo-900 text-white p-6 rounded-[2.5rem] shadow-xl border-2 border-indigo-800">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg leading-tight">Target Leave Cycle</h4>
                                <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest">دورة الإجازات المستهدفة</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                            <button
                                onClick={() => setLeaveCycleMonths(Math.max(1, leaveCycleMonths - 1))}
                                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-white hover:bg-amber-500 transition-colors"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            <div className="flex flex-col items-center">
                                <span className="text-3xl font-black">{leaveCycleMonths}</span>
                                <span className="text-[10px] font-bold uppercase opacity-40">Months | شهر</span>
                            </div>
                            <button
                                onClick={() => setLeaveCycleMonths(leaveCycleMonths + 1)}
                                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-white hover:bg-indigo-500 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="mt-4 text-[11px] text-white/40 leading-relaxed text-center">
                            Defines the timeframe for distributing annual leaves across staff.
                            <br />
                            تحديد المدة الزمنية لتوزيع الإجازات السنوية.
                        </p>
                    </div>
                </div>

                {/* Right Column: Results Dashboard */}
                <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest flex items-center">
                        <Activity className="w-4 h-4 me-2" />
                        Analytics Dashboard
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Metric 1 */}
                        <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] relative overflow-hidden group shadow-2xl shadow-slate-900/20 border-2 border-slate-900">
                            <div className="absolute top-0 end-0 w-32 h-32 bg-white/5 rounded-full -me-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
                            <div className="relative z-10">
                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-4">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <p className="text-white/60 font-medium text-sm mb-1">Total Daily Shifts</p>
                                <div className="flex items-end gap-2">
                                    <h4 className="text-4xl font-black tracking-tight">{results.totalDailyShifts}</h4>
                                    <span className="text-sm font-bold text-emerald-400 mb-2">/ Day</span>
                                </div>
                            </div>
                        </div>

                        {/* Metric 2 */}
                        <div className="bg-emerald-500 text-white p-6 rounded-[2.5rem] relative overflow-hidden group shadow-2xl shadow-emerald-500/20 border-2 border-emerald-500">
                            <div className="absolute top-0 end-0 w-32 h-32 bg-black/5 rounded-full -me-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
                            <div className="relative z-10">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                                    <Users className="w-5 h-5" />
                                </div>
                                <p className="text-white/80 font-medium text-sm mb-1">Total Pharmacists Needed</p>
                                <div className="flex items-end gap-2">
                                    <h4 className="text-4xl font-black tracking-tight">{results.totalPharmacistsNeeded}</h4>
                                    <span className="text-sm font-bold text-white/60 mb-2">FTEs</span>
                                </div>
                            </div>
                        </div>

                        {/* Metric 3 */}
                        <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm relative overflow-hidden group hover:border-indigo-100 hover:shadow-xl transition-all duration-700">
                            <div className="absolute top-0 end-0 w-32 h-32 bg-indigo-50/50 rounded-full -me-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
                            <div className="relative z-10">
                                <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center mb-4">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <p className="text-slate-500 font-medium text-sm mb-1">Relief Force Size</p>
                                <div className="flex items-end gap-2">
                                    <h4 className="text-4xl font-black text-slate-900 tracking-tight">{results.reliefForceSize}</h4>
                                    <span className="text-sm font-bold text-indigo-500 mb-2">Pharmacists</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Visualization Section */}
                    <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50/50 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h4 className="text-xl font-bold text-slate-900">Coverage Efficiency</h4>
                                <p className="text-slate-500 text-sm">Ratio of Total Headcount to Daily Shift Requirements</p>
                            </div>
                            <div className="text-end">
                                <span className="text-2xl font-black text-emerald-500">{results.coverageRatio.toFixed(2)}x</span>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Coverage Ratio</p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="relative h-12 bg-slate-100 rounded-xl overflow-hidden mb-4">
                            <div className="w-full h-full flex">
                                <div
                                    className="bg-slate-300 flex items-center justify-center border-e-2 border-white/50 h-full"
                                    style={{ width: `${(1 / results.coverageRatio) * 100}%` }}
                                >
                                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Base Shifts</span>
                                </div>
                                <div
                                    className="bg-emerald-500 flex items-center justify-center text-white/90 h-full flex-1"
                                >
                                    <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap px-2">Relief Buffer</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between text-xs font-medium text-slate-400">
                            <span>0% Coverage</span>
                            <span>100% (Base: {results.totalDailyShifts})</span>
                            <span>{(results.coverageRatio * 100).toFixed(0)}% (Full Capacity)</span>
                        </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:shadow-lg transition-all duration-500">
                            <div className="flex items-center gap-3 mb-4">
                                <Calendar className="w-5 h-5 text-slate-400" />
                                <h4 className="font-bold text-slate-900">Annual Time Configuration</h4>
                            </div>
                            <ul className="space-y-3">
                                <li className="flex justify-between text-sm">
                                    <span className="text-slate-500">Cycle Days ({results.leaveCycleMonths} Mo)</span>
                                    <span className="font-bold text-slate-900">{Math.round(365 * (results.leaveCycleMonths / 12))} Days</span>
                                </li>
                                <li className="flex justify-between text-sm">
                                    <span className="text-slate-500">Weekly Leaves (1/Week)</span>
                                    <span className="font-bold text-red-500">-{Math.round(52 * (results.leaveCycleMonths / 12))} Days</span>
                                </li>
                                <li className="flex justify-between text-sm">
                                    <span className={includeAnnualLeave ? "text-slate-500" : "text-slate-500 opacity-50"}>Annual Leave (Deferred)</span>
                                    <span className={includeAnnualLeave ? "font-bold text-red-500" : "font-bold text-slate-400 opacity-50"}>
                                        {includeAnnualLeave ? "-30 Days" : "0 Days"}
                                    </span>
                                </li>
                                {includePublicHolidays && (
                                    <li className="flex justify-between text-sm">
                                        <span className="text-slate-500">Public Holidays</span>
                                        <span className="font-bold text-red-500">-{Math.round(14 * (results.leaveCycleMonths / 12))} Days</span>
                                    </li>
                                )}
                                {includeRamadan && (
                                    <li className="flex justify-between text-sm">
                                        <span className="text-slate-500">Ramadan Leave (Avg)</span>
                                        <span className="font-bold text-amber-500">
                                            -{((results.basePharmacistsNeeded > 0) ? (results.ramadan.equivalentShifts / results.basePharmacistsNeeded) : 0).toFixed(1)} Days
                                        </span>
                                    </li>
                                )}
                                <li className="flex justify-between text-sm pt-3 border-t border-slate-100">
                                    <span className="text-emerald-600 font-bold">Net Working Days / Emp</span>
                                    <span className="font-black text-emerald-600 text-lg">
                                        {(results.workingDaysInCycle - ((includeRamadan && results.basePharmacistsNeeded > 0) ? (results.ramadan.equivalentShifts / results.basePharmacistsNeeded) : 0)).toFixed(1)} Days
                                    </span>
                                </li>
                            </ul>
                        </div>

                        <div className="bg-indigo-50 p-6 rounded-[2.5rem] border-2 border-indigo-100 shadow-sm shadow-indigo-100/50">
                            <div className="flex items-center gap-3 mb-4">
                                <TrendingUp className="w-5 h-5 text-indigo-500" />
                                <h4 className="font-bold text-indigo-900">Manager Insights | رؤى المدير</h4>
                            </div>
                            <div className="space-y-4">
                                <p className="text-indigo-700/80 text-sm leading-relaxed">
                                    To maintain full operations across all regions, you require a total workforce of <strong>{results.totalPharmacistsNeeded} pharmacists</strong>.
                                    This includes a relief team of <strong>{results.reliefForceSize}</strong> professionals to cover all leave entitlements.
                                </p>

                                <div className="p-4 bg-white/50 rounded-2xl border border-indigo-200/50">
                                    <h5 className="text-xs font-black text-indigo-600 uppercase tracking-tighter mb-2">Staffing Logic | منطق التوظيف</h5>
                                    <p className="text-[13px] text-indigo-900/70 leading-relaxed mb-2">
                                        <strong>13-Month Cycle:</strong> Since staff work 12 months to earn 1 month of leave, the system applies a relief factor (~1.29x). Effectively, <strong>1 relief pharmacist</strong> is required for every <strong>~3.5 core staff members</strong> to ensure zero downtime.
                                    </p>
                                    <p className="text-[13px] text-indigo-900/70 leading-relaxed dir-rtl text-right font-medium">
                                        <strong>دورة الـ 13 شهراً:</strong> بما أن الموظف يعمل 12 شهراً ليستحق شهر إجازة، يطبق النظام معامل إحلال (1.29). فعلياً، تحتاج إلى <strong>صيدلي تغطة / جوكر واحد</strong> لكل <strong>3.5 موظف أساسي</strong> لضمان استمرارية التشغيل أثناء الإجازات.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-widest mt-4">
                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                                <span>System Optimized | نظام مُحسن</span>
                            </div>
                        </div>

                        {/* Ramadan Section */}
                        {includeRamadan && (
                            <div className="bg-amber-50 p-6 rounded-[2.5rem] border-2 border-amber-100 md:col-span-2 shadow-sm shadow-amber-100/50">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-amber-900 leading-none">Ramadan Impact Analysis</h4>
                                        </div>
                                    </div>
                                </div>

                                {/* Controls - Total Hours Input */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div className="bg-pink-50 rounded-2xl p-4 border border-pink-100 flex flex-col relative overflow-hidden">
                                        <div className="absolute top-0 end-0 w-16 h-16 bg-pink-100 rounded-full -me-8 -mt-8 pointer-events-none"></div>
                                        <span className="text-xs font-bold text-pink-400 uppercase tracking-widest mb-2">Total Female Hours</span>
                                        <div className="flex items-end gap-2">
                                            <input
                                                type="number"
                                                className="w-full font-black text-3xl text-pink-900 bg-transparent outline-none p-0 leading-none placeholder-pink-200"
                                                placeholder="0"
                                                value={ramadanConfig.totalFemaleHours}
                                                onChange={(e) => setRamadanConfig({ ...ramadanConfig, totalFemaleHours: Number(e.target.value) })}
                                            />
                                            <span className="text-xs font-bold text-pink-400 mb-1 whitespace-nowrap">Avg (6h = 1 Day)</span>
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex flex-col relative overflow-hidden">
                                        <div className="absolute top-0 end-0 w-16 h-16 bg-blue-100 rounded-full -me-8 -mt-8 pointer-events-none"></div>
                                        <span className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Total Male Hours</span>
                                        <div className="flex items-end gap-2">
                                            <input
                                                type="number"
                                                className="w-full font-black text-3xl text-blue-900 bg-transparent outline-none p-0 leading-none placeholder-blue-200"
                                                placeholder="0"
                                                value={ramadanConfig.totalMaleHours}
                                                onChange={(e) => setRamadanConfig({ ...ramadanConfig, totalMaleHours: Number(e.target.value) })}
                                            />
                                            <span className="text-xs font-bold text-blue-400 mb-1 whitespace-nowrap">Avg (8h = 1 Day)</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-white/60 p-4 rounded-2xl border border-amber-100/50">
                                        <p className="text-amber-800/60 text-xs font-bold uppercase mb-1">Total Excess Hours</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-xl font-black text-amber-900">{results.ramadan.totalHours.toLocaleString()}</span>
                                            <span className="text-[10px] font-bold text-amber-600">Hrs</span>
                                        </div>
                                    </div>

                                    <div className="bg-pink-50/50 p-4 rounded-2xl border border-pink-100/50 text-pink-900">
                                        <p className="opacity-60 text-xs font-bold uppercase mb-1">Female Days Off</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-xl font-black">{Math.ceil(results.ramadan.breakdown?.femaleDaysOff || 0)}</span>
                                            <span className="text-[10px] font-bold opacity-60">Days</span>
                                        </div>
                                    </div>

                                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 text-blue-900">
                                        <p className="opacity-60 text-xs font-bold uppercase mb-1">Male Days Off</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-xl font-black">{Math.ceil(results.ramadan.breakdown?.maleDaysOff || 0)}</span>
                                            <span className="text-[10px] font-bold opacity-60">Days</span>
                                        </div>
                                    </div>

                                    <div className="bg-amber-600 text-white p-4 rounded-2xl shadow-lg shadow-amber-600/20">
                                        <p className="text-white/80 text-xs font-bold uppercase mb-1">Relief Needed</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl font-black">{results.ramadan.coverageFTE.toFixed(1)}</span>
                                            <span className="text-[10px] font-bold text-white/60">FTEs</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 bg-amber-500/10 rounded-xl p-3 flex items-start gap-3">
                                    <Activity className="w-4 h-4 text-amber-600 mt-1 flex-shrink-0" />
                                    <p className="text-xs font-medium text-amber-800 leading-relaxed">
                                        Your workforce calculates <strong>{results.ramadan.totalHours.toLocaleString()} extra working hours</strong> during Ramadan.
                                        This entitles them to <strong>{Math.ceil(results.ramadan.equivalentShifts)} days off</strong> later,
                                        requiring approximately <strong>{Math.ceil(results.ramadan.coverageFTE)} additional relief staff</strong> (or equivalent overtime pay) to maintain operations.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Strategic Recommendation Section */}
                        <div className={`md:col-span-2 p-8 rounded-[2.5rem] border-2 transition-all duration-700 ${results.strategy.isUnderstaffed ? 'bg-amber-50 border-amber-200 shadow-amber-200/20' : 'bg-emerald-50 border-emerald-200 shadow-emerald-200/20'}`}>
                            <div className="flex flex-col md:flex-row justify-between gap-6">
                                <div className="space-y-4 flex-1">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${results.strategy.isUnderstaffed ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                            <TrendingUp className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-black text-slate-900 leading-none">Strategic Recommendation</h4>
                                            <p className="text-slate-500 text-sm font-bold mt-1 uppercase tracking-widest">تحليل العجز والتوصيات الاستراتيجية</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white/60 p-5 rounded-3xl border border-white">
                                            <p className="text-xs font-black text-slate-400 uppercase mb-2">Staffing Gap | فجوة التوظيف</p>
                                            <div className="flex items-end gap-2">
                                                <span className={`text-4xl font-black ${results.strategy.isUnderstaffed ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                    {results.staffingGap > 0 ? `-${results.staffingGap}` : `+${Math.abs(results.staffingGap)}`}
                                                </span>
                                                <span className="text-sm font-bold text-slate-400 mb-2">Pharmacists</span>
                                            </div>
                                        </div>

                                        <div className="bg-white/60 p-5 rounded-3xl border border-white">
                                            <p className="text-xs font-black text-slate-400 uppercase mb-2">Target Cycle | الدورة المستهدفة</p>
                                            <div className="flex items-end gap-2">
                                                <span className={`text-4xl font-black ${leaveCycleMonths < results.strategy.recommendedCycleMonths ? 'text-red-500' : 'text-emerald-500'}`}>
                                                    {leaveCycleMonths}
                                                </span>
                                                <span className="text-sm font-bold text-slate-400 mb-2">Months | شهر</span>
                                            </div>
                                        </div>

                                        <div className="bg-white/60 p-5 rounded-3xl border border-white">
                                            <p className="text-xs font-black text-slate-400 uppercase mb-2">Min. Cycle Required | الحد الأدنى</p>
                                            <div className="flex items-end gap-2">
                                                <span className="text-4xl font-black text-indigo-600">{results.strategy.recommendedCycleMonths}</span>
                                                <span className="text-sm font-bold text-slate-400 mb-2">Months | شهر</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-4">
                                    <div className="bg-white p-6 rounded-3xl border shadow-sm h-full">
                                        <h5 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${leaveCycleMonths < results.strategy.recommendedCycleMonths ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                                            Compliance Status | حالة الامتثال
                                        </h5>

                                        <div className="space-y-4">
                                            {leaveCycleMonths < results.strategy.recommendedCycleMonths ? (
                                                <div className="space-y-2">
                                                    <p className="text-sm text-red-600 font-bold leading-relaxed">
                                                        ⚠️ RISKY: Your target cycle is too short for your current headcount. This will lead to shift vacancies.
                                                    </p>
                                                    <p className="text-[13px] text-red-500 leading-relaxed font-medium dir-rtl text-right">
                                                        خطر: الدورة المستهدفة قصيرة جداً مقارنة بعدد الموظفين الحالي. سيؤدي ذلك إلى عجز في الوردينات.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <p className="text-sm text-emerald-700 font-medium leading-relaxed">
                                                        ✅ SECURE: Your target cycle is sufficient to cover all leaves without affecting daily operations.
                                                    </p>
                                                    <p className="text-[13px] text-emerald-600 leading-relaxed font-medium dir-rtl text-right">
                                                        آمن: الدورة المستهدفة كافية لتغطية جميع الإجازات دون التأثير على سير العمل اليومي.
                                                    </p>
                                                </div>
                                            )}

                                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mt-2">
                                                <p className="text-[11px] text-slate-500 font-bold">
                                                    At <strong>{leaveCycleMonths} months</strong> cycle, you can allow a maximum of <strong>{(results.strategy.availableRelief * (leaveCycleMonths / 12)).toFixed(1)}</strong> staff member(s) on leave simultaneously.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
