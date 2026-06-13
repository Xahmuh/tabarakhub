import React, { useEffect } from 'react';
import {
    Activity,
    Building2,
    Calendar,
    Clock,
    Minus,
    Plus,
    RefreshCcw,
    ShieldCheck,
    TrendingUp,
    Users
} from 'lucide-react';
import { Region, useStaffingCalculator } from './useStaffingCalculator';

const INITIAL_REGIONS: Region[] = [
    { id: 'r1', name: 'Region 1', branches24h: 0, branchesRegular: 0 },
    { id: 'r2', name: 'Region 2', branches24h: 0, branchesRegular: 0 }
];

const clampNumber = (value: string) => Math.max(0, Number(value) || 0);

const formatDecimal = (value: number, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '0.0';

const TogglePill: React.FC<{
    label: string;
    detail: string;
    checked: boolean;
    onChange: () => void;
    tone: 'brand' | 'emerald' | 'amber';
}> = ({ label, detail, checked, onChange, tone }) => {
    const checkedTone = {
        brand: 'bg-brand',
        emerald: 'bg-emerald-500',
        amber: 'bg-amber-500'
    }[tone];

    return (
        <button
            type="button"
            onClick={onChange}
            className={`flex items-center justify-between gap-4 rounded-lg border p-3 text-left transition-colors ${
                checked ? 'border-brand/20 bg-brand/5' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
        >
            <span>
                <span className="block text-xs font-black uppercase tracking-[0.14em] text-slate-800">{label}</span>
                <span className="mt-1 block text-xs font-semibold text-slate-400">{detail}</span>
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? checkedTone : 'bg-slate-200'}`}>
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
            </span>
        </button>
    );
};

const StepperField: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
    helper?: string;
}> = ({ label, value, onChange, helper }) => (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="mb-3 flex items-start justify-between gap-3">
            <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">{label}</p>
                {helper && <p className="mt-1 text-[11px] font-semibold text-slate-400">{helper}</p>}
            </div>
            <span className="rounded-md bg-white px-2 py-1 text-[10px] font-black text-slate-400 ring-1 ring-slate-200">Input</span>
        </div>
        <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2">
            <button
                type="button"
                onClick={() => onChange(Math.max(0, value - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                aria-label={`Decrease ${label}`}
            >
                <Minus className="h-4 w-4" />
            </button>
            <input
                type="number"
                min={0}
                value={value}
                onChange={event => onChange(clampNumber(event.target.value))}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white text-center text-xl font-black tabular-nums text-slate-950 outline-none transition-all focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
            />
            <button
                type="button"
                onClick={() => onChange(value + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600"
                aria-label={`Increase ${label}`}
            >
                <Plus className="h-4 w-4" />
            </button>
        </div>
    </div>
);

const MetricCard: React.FC<{
    label: string;
    value: string | number;
    unit: string;
    icon: React.ElementType;
    tone?: 'slate' | 'brand' | 'emerald' | 'amber';
}> = ({ label, value, unit, icon: Icon, tone = 'slate' }) => {
    const toneClasses = {
        slate: 'border-slate-200 bg-white text-slate-600',
        brand: 'border-brand/10 bg-brand/5 text-brand',
        emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
        amber: 'border-amber-100 bg-amber-50 text-amber-700'
    };

    return (
        <div className={`rounded-lg border p-4 shadow-sm ${toneClasses[tone]}`}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">{label}</p>
                    <div className="mt-3 flex items-end gap-2">
                        <span className="text-3xl font-black tabular-nums text-slate-950">{value}</span>
                        <span className="mb-1 text-xs font-black uppercase tracking-widest opacity-60">{unit}</span>
                    </div>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80 text-current shadow-sm ring-1 ring-current/10">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    );
};

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
        resetCalculator,
        results
    } = useStaffingCalculator(INITIAL_REGIONS);

    useEffect(() => {
        resetCalculator();
    }, []);

    const hasModelInput = results.totalDailyShifts > 0 || currentStaff > 0 || leaveCycleMonths > 0 || results.ramadan.totalHours > 0;
    const coveragePercent = Math.min(100, Math.max(0, results.coverageRatio * 100));
    const reliefReadiness = results.reliefForceSize > 0
        ? Math.min(100, Math.max(0, results.strategy.reliefCoverageRatio * 100))
        : 0;
    const staffingGapValue = results.staffingGap > 0 ? `-${results.staffingGap}` : `+${Math.abs(results.staffingGap)}`;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                            <Users className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand">Staffing calculator</p>
                            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Workforce & Relief</h2>
                            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                                Model branch coverage, leave cycles, Ramadan hours, and relief headcount. The calculator now opens with a clean zero-state model.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={resetCalculator}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
                        >
                            <RefreshCcw className="h-4 w-4" />
                            Clear model
                        </button>
                        {onBack && (
                            <button
                                type="button"
                                onClick={onBack}
                                className="inline-flex items-center rounded-lg bg-slate-950 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-slate-800"
                            >
                                Back to Modules
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <TogglePill
                    label="Annual leave"
                    detail="+30 days entitlement"
                    checked={includeAnnualLeave}
                    onChange={() => setIncludeAnnualLeave(!includeAnnualLeave)}
                    tone="brand"
                />
                <TogglePill
                    label="Public holidays"
                    detail="+14 days prorated"
                    checked={includePublicHolidays}
                    onChange={() => setIncludePublicHolidays(!includePublicHolidays)}
                    tone="emerald"
                />
                <TogglePill
                    label="Ramadan impact"
                    detail="extra hours conversion"
                    checked={includeRamadan}
                    onChange={() => setIncludeRamadan(!includeRamadan)}
                    tone="amber"
                />
            </section>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
                <section className="space-y-5">
                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-5 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Network model</p>
                                <h3 className="mt-1 text-lg font-black text-slate-950">Branch configuration</h3>
                            </div>
                            <Building2 className="h-5 w-5 text-slate-300" />
                        </div>

                        <div className="space-y-4">
                            {regions.map(region => (
                                <article key={region.id} className="rounded-lg border border-slate-200 bg-white p-4">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <h4 className="text-sm font-black text-slate-950">{region.name}</h4>
                                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                            {region.branches24h + region.branchesRegular} branches
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        <StepperField
                                            label="24h branches"
                                            helper="3 shifts per branch"
                                            value={region.branches24h}
                                            onChange={value => updateRegion(region.id, 'branches24h', value)}
                                        />
                                        <StepperField
                                            label="Regular branches"
                                            helper="2 shifts per branch"
                                            value={region.branchesRegular}
                                            onChange={value => updateRegion(region.id, 'branchesRegular', value)}
                                        />
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-5 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Assumptions</p>
                                <h3 className="mt-1 text-lg font-black text-slate-950">Current staffing</h3>
                            </div>
                            <Calendar className="h-5 w-5 text-slate-300" />
                        </div>
                        <div className="space-y-3">
                            <StepperField
                                label="Current headcount"
                                helper="عدد الصيادلة الحالي"
                                value={currentStaff}
                                onChange={setCurrentStaff}
                            />
                            <StepperField
                                label="Target leave cycle"
                                helper="Months to distribute leave"
                                value={leaveCycleMonths}
                                onChange={setLeaveCycleMonths}
                            />
                        </div>
                    </div>

                    {includeRamadan && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
                            <div className="mb-4 flex items-center gap-3">
                                <Clock className="h-5 w-5 text-amber-600" />
                                <div>
                                    <h3 className="text-sm font-black text-amber-950">Ramadan hour balance</h3>
                                    <p className="text-xs font-semibold text-amber-700/70">Starts at zero. Enter only the hours you want to model.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label className="space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Female hours</span>
                                    <input
                                        type="number"
                                        min={0}
                                        value={ramadanConfig.totalFemaleHours}
                                        onChange={event => setRamadanConfig({ ...ramadanConfig, totalFemaleHours: clampNumber(event.target.value) })}
                                        className="h-11 w-full rounded-lg border border-amber-200 bg-white px-3 text-lg font-black text-amber-950 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                                    />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Male hours</span>
                                    <input
                                        type="number"
                                        min={0}
                                        value={ramadanConfig.totalMaleHours}
                                        onChange={event => setRamadanConfig({ ...ramadanConfig, totalMaleHours: clampNumber(event.target.value) })}
                                        className="h-11 w-full rounded-lg border border-amber-200 bg-white px-3 text-lg font-black text-amber-950 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                                    />
                                </label>
                            </div>
                        </div>
                    )}
                </section>

                <section className="space-y-5">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard label="Daily shifts" value={results.totalDailyShifts} unit="/ day" icon={Clock} tone="slate" />
                        <MetricCard label="Needed staff" value={results.totalPharmacistsNeeded} unit="FTE" icon={Users} tone="brand" />
                        <MetricCard label="Relief force" value={results.reliefForceSize} unit="staff" icon={ShieldCheck} tone="emerald" />
                        <MetricCard label="Staffing gap" value={staffingGapValue} unit="staff" icon={TrendingUp} tone={results.strategy.isUnderstaffed ? 'amber' : 'emerald'} />
                    </div>

                    {!hasModelInput && (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand/10 text-brand">
                                <Activity className="h-6 w-6" />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-700">Zero-state model</h3>
                            <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">
                                Add branch counts, current headcount, and a target leave cycle to generate workforce and relief recommendations.
                            </p>
                        </div>
                    )}

                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Coverage efficiency</p>
                                <h3 className="mt-1 text-lg font-black text-slate-950">Headcount vs daily operations</h3>
                            </div>
                            <span className="text-2xl font-black tabular-nums text-slate-950">{formatDecimal(results.coverageRatio, 2)}x</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${coveragePercent}%` }} />
                        </div>
                        <div className="mt-3 flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <span>0%</span>
                            <span>{formatDecimal(coveragePercent, 0)}% modeled coverage</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center gap-3">
                                <Calendar className="h-5 w-5 text-brand" />
                                <h3 className="text-sm font-black text-slate-950">Time configuration</h3>
                            </div>
                            <dl className="space-y-3 text-sm">
                                <div className="flex justify-between gap-4">
                                    <dt className="font-semibold text-slate-500">Cycle days</dt>
                                    <dd className="font-black text-slate-950">{Math.round(365 * (results.leaveCycleMonths / 12))} days</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <dt className="font-semibold text-slate-500">Weekly leaves</dt>
                                    <dd className="font-black text-red-600">-{Math.round(52 * (results.leaveCycleMonths / 12))} days</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <dt className="font-semibold text-slate-500">Annual leave</dt>
                                    <dd className={includeAnnualLeave ? 'font-black text-red-600' : 'font-black text-slate-400'}>
                                        {includeAnnualLeave ? '-30 days' : '0 days'}
                                    </dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <dt className="font-semibold text-slate-500">Public holidays</dt>
                                    <dd className={includePublicHolidays ? 'font-black text-red-600' : 'font-black text-slate-400'}>
                                        {includePublicHolidays ? `-${Math.round(14 * (results.leaveCycleMonths / 12))} days` : '0 days'}
                                    </dd>
                                </div>
                                <div className="border-t border-slate-100 pt-3">
                                    <div className="flex justify-between gap-4">
                                        <dt className="font-black text-emerald-700">Net working days / employee</dt>
                                        <dd className="font-black text-emerald-700">{formatDecimal(results.workingDaysInCycle)} days</dd>
                                    </div>
                                </div>
                            </dl>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center gap-3">
                                <TrendingUp className="h-5 w-5 text-brand" />
                                <h3 className="text-sm font-black text-slate-950">Manager insight</h3>
                            </div>
                            <div className="space-y-4">
                                <p className="text-sm font-semibold leading-6 text-slate-600">
                                    The model requires <strong>{results.totalPharmacistsNeeded}</strong> total pharmacists, including a relief force of <strong>{results.reliefForceSize}</strong> to protect leave coverage.
                                </p>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Relief readiness</span>
                                        <span className="text-xs font-black text-slate-700">{formatDecimal(reliefReadiness, 0)}%</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-white">
                                        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${reliefReadiness}%` }} />
                                    </div>
                                </div>
                                <p className="text-sm font-bold leading-6 text-slate-500" dir="rtl">
                                    يبدأ النموذج من صفر. أدخل عدد الفروع والصيادلة ودورة الإجازات للحصول على توصية دقيقة.
                                </p>
                            </div>
                        </div>
                    </div>

                    {includeRamadan && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
                            <div className="mb-4 flex items-center gap-3">
                                <Clock className="h-5 w-5 text-amber-600" />
                                <h3 className="text-sm font-black text-amber-950">Ramadan impact analysis</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                <MetricCard label="Extra hours" value={results.ramadan.totalHours.toLocaleString()} unit="hrs" icon={Clock} tone="amber" />
                                <MetricCard label="Female days" value={Math.ceil(results.ramadan.breakdown.femaleDaysOff)} unit="days" icon={Users} tone="slate" />
                                <MetricCard label="Male days" value={Math.ceil(results.ramadan.breakdown.maleDaysOff)} unit="days" icon={Users} tone="slate" />
                                <MetricCard label="Relief needed" value={formatDecimal(results.ramadan.coverageFTE)} unit="FTE" icon={ShieldCheck} tone="amber" />
                            </div>
                        </div>
                    )}

                    <div className={`rounded-lg border p-5 shadow-sm ${
                        results.strategy.isUnderstaffed ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
                    }`}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Strategic recommendation</p>
                                <h3 className="mt-1 text-xl font-black text-slate-950">
                                    {results.strategy.isUnderstaffed ? 'Additional relief planning required' : 'Model is currently balanced'}
                                </h3>
                                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                                    {results.strategy.isUnderstaffed
                                        ? `Current headcount is short by ${results.staffingGap} pharmacist(s). Increase staffing or extend the leave cycle.`
                                        : 'Current assumptions do not show a staffing shortage. Keep monitoring leave and holiday assumptions.'}
                                </p>
                            </div>
                            <div className="rounded-lg border border-white/70 bg-white/70 px-4 py-3 text-right">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Minimum cycle</p>
                                <p className="mt-1 text-2xl font-black text-slate-950">{results.strategy.recommendedCycleMonths}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">months</p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};
