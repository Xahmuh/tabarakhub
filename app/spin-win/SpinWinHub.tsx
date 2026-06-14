import React, { useState, useTransition } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    ClipboardCheck,
    Gift,
    LayoutDashboard,
    Lock,
    QrCode,
    Radio,
    ShieldCheck,
    Store,
    Ticket
} from 'lucide-react';
import { Branch } from '../../types';
import { isManagerRole } from '../../lib/access';
import { BranchQRGenerator } from './BranchQRGenerator';
import { VoucherRedeemer } from './VoucherRedeemer';
import { BranchDashboard } from './BranchDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { BackToModulesButton } from '../shared';
import { SpinWheelMark } from './SpinWheelMark';

interface SpinWinHubProps {
    branch: Branch;
    onBack: () => void;
    userRole: string;
}

type SpinWinSubTab = 'menu' | 'qr' | 'redeem' | 'dashboard';

interface WorkflowStepProps {
    icon: LucideIcon;
    title: string;
    detail: string;
}

const WorkflowStep: React.FC<WorkflowStepProps> = ({ icon: Icon, title, detail }) => (
    <div className="flex gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Icon className="h-4 w-4" />
        </div>
        <div>
            <p className="text-sm font-black text-slate-900">{title}</p>
            <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{detail}</p>
        </div>
    </div>
);

export const SpinWinHub: React.FC<SpinWinHubProps> = ({ branch, onBack, userRole }) => {
    const [subTab, setSubTab] = useState<SpinWinSubTab>('menu');
    const [isPending, startTransition] = useTransition();

    const handleTabChange = (tab: SpinWinSubTab) => {
        startTransition(() => {
            setSubTab(tab);
        });
    };

    const isAdmin = isManagerRole(userRole);

    if (isAdmin || userRole === 'owner') {
        return <ManagerDashboard onBack={onBack} />;
    }

    if (subTab === 'qr') return <BranchQRGenerator branch={branch} onBack={() => handleTabChange('menu')} />;
    if (subTab === 'redeem') return <VoucherRedeemer branch={branch} onBack={() => handleTabChange('menu')} />;
    if (subTab === 'dashboard') return <BranchDashboard branch={branch} onBack={() => handleTabChange('menu')} />;

    const isEnabled = branch.isSpinEnabled !== false;
    const branchName = branch.name || 'Current branch';
    const branchCode = branch.code || 'Unassigned';

    const readinessItems = [
        {
            label: isEnabled ? 'Reward access is active' : 'Reward access is suspended',
            helper: isEnabled ? 'QR generation is available for this branch.' : 'QR generation is blocked by admin control.',
            isReady: isEnabled
        },
        {
            label: branch.googleMapsLink ? 'Google review link connected' : 'Google review link missing',
            helper: branch.googleMapsLink ? 'Customer review return flow can continue.' : 'Add the branch review link from admin settings.',
            isReady: Boolean(branch.googleMapsLink)
        },
        {
            label: branch.whatsappNumber ? 'WhatsApp sharing is configured' : 'WhatsApp sharing not configured',
            helper: branch.whatsappNumber ? 'Campaign links can be shared from this branch.' : 'Add branch WhatsApp number for cleaner sharing.',
            isReady: Boolean(branch.whatsappNumber)
        }
    ];

    const menuItems = [
        {
            id: 'qr' as const,
            icon: QrCode,
            eyebrow: 'Entry point',
            title: 'Generate QR & Link',
            description: isEnabled
                ? 'Generate session tokens for physical customers or shared links for delivery orders.'
                : 'Access suspended by Global Administrator. Please contact management to re-enable.',
            points: ['Static poster QR', 'Single or multi-use sessions'],
            cta: isEnabled ? 'Create Customer QR' : 'QR Disabled',
            accent: 'bg-red-600',
            iconBg: isEnabled ? 'bg-red-50 text-red-600 ring-red-100' : 'bg-slate-100 text-slate-400 ring-slate-100',
            hoverBorder: isEnabled ? 'hover:border-red-200 hover:shadow-red-100/60' : '',
            disabled: !isEnabled,
            ctaColor: isEnabled ? 'text-red-600' : 'text-slate-400'
        },
        {
            id: 'redeem' as const,
            icon: Ticket,
            eyebrow: 'Counter workflow',
            title: 'Redeem Vouchers',
            description: 'Verify unique security codes and authorize customer prize redemptions in the database.',
            points: ['Voucher lookup', 'Controlled branch redemption'],
            cta: 'Verify Security Code',
            accent: 'bg-amber-500',
            iconBg: 'bg-amber-50 text-amber-600 ring-amber-100',
            hoverBorder: 'hover:border-amber-200 hover:shadow-amber-100/50',
            disabled: false,
            ctaColor: 'text-amber-600'
        },
        {
            id: 'dashboard' as const,
            icon: LayoutDashboard,
            eyebrow: 'Branch insight',
            title: 'Branch Dashboard',
            description: 'Track engagement metrics, prizes claimed, and customer activity logs for this node.',
            points: ['Spin activity', 'Prize and voucher signals'],
            cta: 'View Branch Metrics',
            accent: 'bg-emerald-600',
            iconBg: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
            hoverBorder: 'hover:border-emerald-200 hover:shadow-emerald-100/50',
            disabled: false,
            ctaColor: 'text-emerald-600'
        }
    ];

    return (
        <div className={`mx-auto max-w-7xl space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                    <SpinWheelMark size="sm" className="shrink-0" />
                    <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600">Customer engagement</span>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${isEnabled ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                {isEnabled ? 'Live' : 'Suspended'}
                            </span>
                        </div>
                        <h2 className="text-3xl font-black tracking-tight text-slate-950 lg:text-4xl">
                            Spin & Win <span className="text-red-600">Rewards</span>
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                            Operate customer reward QR sessions, voucher redemption, and branch-level activity from one focused control page.
                        </p>
                    </div>
                </div>
                <BackToModulesButton onClick={onBack} className="self-start" />
            </div>

            <section className="overflow-hidden rounded-lg border border-red-100 bg-white shadow-sm">
                <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="bg-slate-950">
                        <div className="bg-[#a90417]">
                        <img
                            src="/spin-header-v4.jpg"
                            alt="Spin and Win rewards"
                                className="block h-auto w-full object-contain"
                        />
                        </div>
                        <div className="flex flex-col gap-6 p-6 text-white lg:p-8">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                                    <Store className="h-3.5 w-3.5" />
                                    {branchName}
                                </span>
                                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/90">
                                    Code {branchCode}
                                </span>
                            </div>
                            <div className="max-w-xl">
                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-100">Reward flow cockpit</p>
                                <h3 className="mt-3 text-2xl font-black tracking-tight lg:text-3xl">Fast customer entry. Clean voucher control.</h3>
                                <p className="mt-3 max-w-lg text-sm font-medium leading-6 text-white/75">
                                    Start a customer session, validate a prize code, or review branch reward signals without leaving the module.
                                </p>
                            </div>
                        </div>
                    </div>

                    <aside className="border-t border-red-100 bg-white p-6 lg:border-l lg:border-t-0">
                        <div className="flex items-center gap-4">
                            <SpinWheelMark size="md" className="shrink-0" />
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Campaign status</p>
                                <h3 className="mt-1 text-lg font-black text-slate-950">{isEnabled ? 'Ready to operate' : 'Access suspended'}</h3>
                            </div>
                        </div>
                        <div className="mt-6 space-y-3">
                            {readinessItems.map((item) => (
                                <div key={item.label} className="flex gap-3">
                                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.isReady ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {item.isReady ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-900">{item.label}</p>
                                        <p className="mt-0.5 text-xs font-medium leading-5 text-slate-500">{item.helper}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </aside>
                </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => !item.disabled && handleTabChange(item.id)}
                            disabled={item.disabled}
                            className={`group flex min-h-[286px] flex-col rounded-lg border bg-white text-left shadow-sm transition-all duration-300 ${item.disabled ? 'cursor-not-allowed border-slate-100 opacity-60' : `cursor-pointer border-slate-200 hover:-translate-y-0.5 hover:shadow-xl ${item.hoverBorder}`} active:scale-[0.99]`}
                        >
                            <span className={`h-1 w-full rounded-t-lg ${item.accent}`} />
                            <div className="flex flex-1 flex-col p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ring-1 ${item.iconBg} transition-transform duration-300 ${!item.disabled ? 'group-hover:scale-105' : ''}`}>
                                        <item.icon className="h-5 w-5" />
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                        {item.eyebrow}
                                    </span>
                                </div>

                                <div className="mt-5 flex-1">
                                    <h3 className="text-lg font-black tracking-tight text-slate-950">{item.title}</h3>
                                    <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{item.description}</p>
                                    <div className="mt-4 space-y-2">
                                        {item.points.map((point) => (
                                            <div key={point} className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                                <span className={`h-1.5 w-1.5 rounded-full ${item.accent}`} />
                                                {point}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className={`mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 ${item.ctaColor}`}>
                                    {item.disabled && <Lock className="h-3.5 w-3.5" />}
                                    <span className="text-[10px] font-black uppercase tracking-[0.18em]">{item.cta}</span>
                                    {!item.disabled && <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Secure flow</p>
                            <h3 className="text-base font-black text-slate-950">Recommended order</h3>
                        </div>
                    </div>
                    <div className="mt-5 space-y-4">
                        <WorkflowStep icon={QrCode} title="Open a QR session" detail="Use static QR for posters or generate a controlled session for a customer." />
                        <WorkflowStep icon={Gift} title="Customer spins" detail="The customer completes the reward flow and receives a voucher code." />
                        <WorkflowStep icon={ClipboardCheck} title="Redeem at counter" detail="Verify the code before giving the prize to keep records clean." />
                        <WorkflowStep icon={Radio} title="Review signals" detail="Use branch metrics to check claims, usage, and repeat activity." />
                    </div>
                </aside>
            </div>
        </div>
    );
};
