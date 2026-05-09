import React, { useState, useTransition } from 'react';
import { Branch } from '../../types';
import {
    QrCode,
    Ticket,
    LayoutDashboard,
    ArrowLeft,
    Lock,
    Zap,
    ChevronRight,
    Shield
} from 'lucide-react';
import { BranchQRGenerator } from './BranchQRGenerator';
import { VoucherRedeemer } from './VoucherRedeemer';
import { BranchDashboard } from './BranchDashboard';
import { ManagerDashboard } from './ManagerDashboard';

interface SpinWinHubProps {
    branch: Branch;
    onBack: () => void;
    userRole: string;
}

export const SpinWinHub: React.FC<SpinWinHubProps> = ({ branch, onBack, userRole }) => {
    const [subTab, setSubTab] = useState<'menu' | 'qr' | 'redeem' | 'dashboard'>('menu');
    const [isPending, startTransition] = useTransition();

    const handleTabChange = (tab: 'menu' | 'qr' | 'redeem' | 'dashboard') => {
        startTransition(() => {
            setSubTab(tab);
        });
    };

    if (userRole === 'manager' || userRole === 'admin') {
        return <ManagerDashboard onBack={onBack} />;
    }

    if (subTab === 'qr') return <BranchQRGenerator branch={branch} onBack={() => handleTabChange('menu')} />;
    if (subTab === 'redeem') return <VoucherRedeemer branch={branch} onBack={() => handleTabChange('menu')} />;
    if (subTab === 'dashboard') return <BranchDashboard branch={branch} onBack={() => handleTabChange('menu')} />;

    const isEnabled = branch.isSpinEnabled !== false;
    const canManage = userRole === 'manager' || userRole === 'admin';

    const menuItems = [
        {
            id: 'qr' as const,
            icon: QrCode,
            title: 'Generate QR & Link',
            description: isEnabled
                ? 'Generate session tokens for physical customers or shared links for delivery orders.'
                : 'Access suspended by Global Administrator. Please contact management to re-enable.',
            cta: isEnabled ? 'Launch Token Protocol' : 'Protocol Safe-Locked',
            gradient: 'from-red-600 to-red-700',
            iconBg: isEnabled ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-400',
            hoverBorder: isEnabled ? 'hover:border-red-200 hover:shadow-red-100/50' : '',
            disabled: !isEnabled,
            ctaColor: isEnabled ? 'text-red-600' : 'text-slate-400'
        },
        {
            id: 'redeem' as const,
            icon: Ticket,
            title: 'Redeem Vouchers',
            description: 'Verify unique security codes and authorize customer prize redemptions in the database.',
            cta: 'Verify Security Code',
            gradient: 'from-slate-800 to-slate-900',
            iconBg: 'bg-amber-50 text-amber-600',
            hoverBorder: 'hover:border-amber-200 hover:shadow-amber-100/50',
            disabled: false,
            ctaColor: 'text-amber-600'
        },
        {
            id: 'dashboard' as const,
            icon: LayoutDashboard,
            title: 'Branch Dashboard',
            description: 'Track engagement metrics, prizes claimed, and customer activity logs for this node.',
            cta: canManage ? 'Global Manager Dashboard' : 'View All Metrics',
            gradient: 'from-emerald-600 to-emerald-700',
            iconBg: 'bg-emerald-50 text-emerald-600',
            hoverBorder: 'hover:border-emerald-200 hover:shadow-emerald-100/50',
            disabled: false,
            ctaColor: 'text-emerald-600'
        }
    ];

    return (
        <div className={`max-w-5xl mx-auto p-4 lg:p-10 animate-in fade-in slide-in-from-bottom-6 duration-700 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Back Navigation */}
            <button
                onClick={onBack}
                className="inline-flex items-center gap-2 text-slate-400 hover:text-red-600 mb-8 transition-colors group"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span className="text-xs font-bold uppercase tracking-widest">Operational Suite</span>
            </button>

            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-200">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                        Spin & Win <span className="text-red-600">Suite</span>
                    </h2>
                </div>
                <div className="flex items-center gap-3">
                    <p className="text-slate-500 text-sm font-medium">Manage spins, rewards, vouchers, and branch performance tracking.</p>
                    {!isEnabled && (
                        <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-red-100">
                            <Lock className="w-3 h-3" />
                            Suspended
                        </span>
                    )}
                </div>
            </div>

            {/* Menu Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => !item.disabled && handleTabChange(item.id)}
                        disabled={item.disabled}
                        className={`group bg-white rounded-2xl border-2 border-slate-100 transition-all duration-300 text-left flex flex-col overflow-hidden ${item.disabled ? 'opacity-60 cursor-not-allowed' : `cursor-pointer hover:shadow-xl ${item.hoverBorder}`} active:scale-[0.98]`}
                    >
                        {/* Colored top bar */}
                        <div className={`h-1.5 w-full bg-gradient-to-r ${item.gradient}`} />

                        <div className="p-7 flex flex-col justify-between flex-1 min-h-[240px]">
                            {/* Icon */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${item.iconBg} ${!item.disabled ? 'group-hover:scale-110' : ''}`}>
                                <item.icon className="w-6 h-6" />
                            </div>

                            {/* Content */}
                            <div className="mt-5">
                                <h3 className="text-lg font-bold text-slate-900 mb-2 tracking-tight">
                                    {item.title}
                                </h3>
                                <p className="text-sm leading-relaxed text-slate-400">
                                    {item.description}
                                </p>
                            </div>

                            {/* CTA */}
                            <div className={`flex items-center gap-2 mt-5 pt-4 border-t border-slate-50 ${item.ctaColor}`}>
                                {item.disabled && <Lock className="w-3 h-3" />}
                                <span className="text-[10px] font-bold uppercase tracking-widest">{item.cta}</span>
                                {!item.disabled && <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Footer Image */}
            <div className="w-full mt-10 rounded-2xl overflow-hidden">
                <img
                    src="/spin-suite-footer.jpg"
                    alt="Spin Suite Footer"
                    className="w-full h-auto object-cover"
                />
            </div>
        </div>
    );
};
