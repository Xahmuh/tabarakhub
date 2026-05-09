import React, { useState } from 'react';
import { spinWinService } from '../../services/spinWin';
import { Branch } from '../../types';
import {
    Ticket,
    Search,
    CheckCircle2,
    XCircle,
    Clock,
    User,
    MapPin,
    Gift,
    ShieldCheck,
    Loader2,
    ArrowLeft
} from 'lucide-react';

interface VoucherRedeemerProps {
    branch: Branch;
    onBack: () => void;
}

export const VoucherRedeemer: React.FC<VoucherRedeemerProps> = ({ branch, onBack }) => {
    const [code, setCode] = useState('VOUCH-');
    const [voucher, setVoucher] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length < 10) return;

        setIsLoading(true);
        setError('');
        setSuccess('');
        setVoucher(null);

        try {
            const data = await spinWinService.vouchers.find(code.trim().toUpperCase());
            if (!data) {
                setError('Voucher code not found in system.');
            } else {
                setVoucher(data);
            }
        } catch (err) {
            setError('Database connection error.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRedeem = async () => {
        if (!voucher) return;
        setIsLoading(true);
        try {
            await spinWinService.vouchers.redeem(voucher.id, branch.id);
            setSuccess('Voucher successfully redeemed!');
            setVoucher({ ...voucher, redeemed_at: new Date().toISOString(), redeemed_branch_id: branch.id });
        } catch (err) {
            setError('Redemption failed. Try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const isExpired = voucher && !voucher.redeemed_at && (new Date(voucher.created_at).getTime() + 7 * 24 * 60 * 60 * 1000) < Date.now();

    return (
        <div className="max-w-3xl mx-auto p-4 lg:p-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Back */}
            <button onClick={onBack} className="inline-flex items-center gap-2 text-slate-400 hover:text-red-600 mb-8 transition-colors group">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span className="text-xs font-bold uppercase tracking-widest">Back to Spin & Win Suite</span>
            </button>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                            <Ticket className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Voucher Verification</h2>
                            <p className="text-white/50 text-sm font-medium">Secure protocol for redeeming customer rewards</p>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    {/* Search Input */}
                    <form onSubmit={handleSearch} className="relative mb-8">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-2 block">Enter Security Code</label>
                        <div className="relative group">
                            <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-red-500 transition-colors" />
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => {
                                    const val = e.target.value.toUpperCase();
                                    if (!val.startsWith('VOUCH-')) {
                                        if (val === 'VOUCH') setCode('VOUCH-');
                                        else setCode('VOUCH-' + val.replace('VOUCH-', ''));
                                    } else {
                                        setCode(val);
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (code === 'VOUCH-' && (e.key === 'Backspace' || e.key === 'Delete')) {
                                        e.preventDefault();
                                    }
                                }}
                                placeholder="VOUCH-XXXXXX"
                                className="w-full bg-slate-50 border-2 border-slate-100 focus:border-red-500 focus:bg-white p-4 pl-12 pr-14 rounded-xl outline-none font-bold text-lg tracking-widest transition-all"
                            />
                            <button
                                type="submit"
                                disabled={isLoading || code.length < 10}
                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-900 hover:bg-red-700 text-white p-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-30"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                            </button>
                        </div>
                    </form>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center space-x-3 mb-6 border border-red-100 animate-in zoom-in-95">
                            <XCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-semibold">{error}</p>
                        </div>
                    )}

                    {/* Success */}
                    {success && (
                        <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-center space-x-3 mb-6 border border-emerald-100 animate-in zoom-in-95">
                            <CheckCircle2 className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-semibold">{success}</p>
                        </div>
                    )}

                    {/* Voucher Details */}
                    {voucher && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Prize & Customer */}
                                <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 space-y-5">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
                                            <Gift className="w-5 h-5 text-red-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Won Prize</p>
                                            <h4 className="font-bold text-slate-900 text-lg">{voucher.prize?.name}</h4>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
                                            <User className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</p>
                                            <h4 className="font-bold text-slate-900">{voucher.customer?.first_name} {voucher.customer?.last_name}</h4>
                                            <p className="text-slate-400 text-xs">+{voucher.customer?.phone}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Date & Status */}
                                <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 space-y-5">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
                                            <Clock className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Won Date</p>
                                            <h4 className="font-bold text-slate-900">{new Date(voucher.created_at).toLocaleDateString()}</h4>
                                            <p className="text-[10px] text-slate-400 font-medium">at {voucher.branch?.name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
                                            <MapPin className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Redemption Status</p>
                                            {voucher.redeemed_at ? (
                                                <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold text-xs">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Already Redeemed
                                                </span>
                                            ) : isExpired ? (
                                                <span className="inline-flex items-center gap-1.5 text-red-500 font-bold text-xs">
                                                    <Clock className="w-3.5 h-3.5" /> Expired
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 text-blue-600 font-bold text-xs">
                                                    <ShieldCheck className="w-3.5 h-3.5" /> Valid & Active
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action */}
                            {voucher.redeemed_at ? (
                                <div className="bg-slate-50 p-5 rounded-xl text-center border border-slate-100">
                                    <p className="text-slate-400 text-xs font-medium">This voucher was redeemed on</p>
                                    <p className="text-slate-700 font-bold mt-1">{new Date(voucher.redeemed_at).toLocaleString()}</p>
                                </div>
                            ) : isExpired ? (
                                <div className="bg-red-50 p-5 rounded-xl text-center border border-red-100">
                                    <p className="text-red-700 font-bold text-lg">EXPIRED</p>
                                    <p className="text-red-500 text-xs font-medium mt-1">This reward is no longer valid for redemption.</p>
                                </div>
                            ) : (
                                <button
                                    onClick={handleRedeem}
                                    disabled={isLoading}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-200 transition-all active:scale-[0.98] flex items-center justify-center space-x-3"
                                >
                                    {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                                    <span>Authorize & Redeem Reward</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
