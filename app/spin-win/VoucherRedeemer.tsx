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
import { SpinWheelMark } from './SpinWheelMark';

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
    const voucherStatus = voucher?.redeemed_at ? 'Redeemed' : isExpired ? 'Expired' : voucher ? 'Valid' : 'Waiting';

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-700">
                <ArrowLeft className="h-4 w-4" />
                Back to Spin & Win Suite
            </button>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(340px,0.98fr)]">
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-800 bg-slate-950 p-6 text-white md:p-7">
                        <div className="flex items-start gap-4">
                            <SpinWheelMark size="md" className="shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-200/70">Counter workflow</p>
                                <h2 className="mt-2 text-3xl font-black tracking-tight">Voucher Verification</h2>
                                <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-white/55">
                                    Check the customer code before giving the reward. Redemption stays tied to the current branch.
                                </p>
                                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-black text-white/80">
                                    <MapPin className="h-3.5 w-3.5 text-red-200" />
                                    {branch.name}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 p-5 md:p-7">
                        <form onSubmit={handleSearch} className="space-y-3">
                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Enter Security Code</label>
                            <div className="relative group">
                                <Ticket className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-red-500" />
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
                                    className="w-full rounded-lg border-2 border-slate-100 bg-slate-50 p-4 pl-12 pr-16 text-base font-black uppercase tracking-[0.18em] text-slate-950 outline-none transition-all focus:border-red-500 focus:bg-white"
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading || code.length < 10}
                                    className="absolute right-2.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg bg-slate-950 text-white transition-all hover:bg-red-700 active:scale-95 disabled:opacity-30"
                                    aria-label="Search voucher"
                                >
                                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                                </button>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-3">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Format</p>
                                    <p className="mt-1 text-xs font-black text-slate-700">VOUCH-XXXXXX</p>
                                </div>
                                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Scope</p>
                                    <p className="mt-1 text-xs font-black text-emerald-800">Branch redeem</p>
                                </div>
                                <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-red-700">Status</p>
                                    <p className="mt-1 text-xs font-black text-red-800">{voucherStatus}</p>
                                </div>
                            </div>
                        </form>

                        {error && (
                            <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-4 text-red-700 animate-in zoom-in-95">
                                <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                                <p className="text-sm font-semibold">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-emerald-700 animate-in zoom-in-95">
                                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                                <p className="text-sm font-semibold">{success}</p>
                            </div>
                        )}

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-950">
                                <ShieldCheck className="h-4 w-4 text-red-600" />
                                Verification steps
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                                {[
                                    ['1', 'Search code'],
                                    ['2', 'Check customer'],
                                    ['3', 'Authorize reward']
                                ].map(([step, label]) => (
                                    <div key={step} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-600">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-950 text-[10px] font-black text-white">{step}</span>
                                        {label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                    <div className="mb-5 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Verification result</p>
                            <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">{voucher ? 'Voucher details' : 'Awaiting lookup'}</h3>
                        </div>
                        <div className={`rounded-lg p-3 ${voucher?.redeemed_at ? 'bg-slate-100 text-slate-500' : isExpired ? 'bg-red-50 text-red-600' : voucher ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                            {voucher?.redeemed_at ? <CheckCircle2 className="h-5 w-5" /> : isExpired ? <Clock className="h-5 w-5" /> : voucher ? <ShieldCheck className="h-5 w-5" /> : <Ticket className="h-5 w-5" />}
                        </div>
                    </div>

                    {!voucher ? (
                        <div className="flex min-h-[430px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                            <SpinWheelMark size="lg" />
                            <h4 className="mt-6 text-lg font-black text-slate-950">Search a voucher to verify</h4>
                            <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-slate-500">
                                Enter the customer security code. The result panel will show prize, customer, status, and redemption action.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-5 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className={`rounded-lg border p-4 ${voucher.redeemed_at ? 'border-slate-200 bg-slate-50' : isExpired ? 'border-red-100 bg-red-50' : 'border-emerald-100 bg-emerald-50'}`}>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Current status</p>
                                <p className={`mt-2 text-2xl font-black ${voucher.redeemed_at ? 'text-slate-700' : isExpired ? 'text-red-700' : 'text-emerald-700'}`}>
                                    {voucher.redeemed_at ? 'Already Redeemed' : isExpired ? 'Expired' : 'Valid & Active'}
                                </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-100 bg-white text-red-600">
                                        <Gift className="h-5 w-5" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Won Prize</p>
                                    <h4 className="mt-1 text-lg font-black text-slate-950">{voucher.prize?.name}</h4>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-100 bg-white text-slate-500">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Customer</p>
                                    <h4 className="mt-1 font-black text-slate-950">{voucher.customer?.first_name} {voucher.customer?.last_name}</h4>
                                    <p className="mt-1 text-xs font-semibold text-slate-400">+{voucher.customer?.phone}</p>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-100 bg-white text-slate-500">
                                        <Clock className="h-5 w-5" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Won Date</p>
                                    <h4 className="mt-1 font-black text-slate-950">{new Date(voucher.created_at).toLocaleDateString()}</h4>
                                    <p className="mt-1 text-xs font-semibold text-slate-400">at {voucher.branch?.name}</p>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-100 bg-white text-slate-500">
                                        <MapPin className="h-5 w-5" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Redemption Branch</p>
                                    <h4 className="mt-1 font-black text-slate-950">{voucher.redeemed_branch?.name || branch.name}</h4>
                                    <p className="mt-1 text-xs font-semibold text-slate-400">{voucher.redeemed_at ? 'Recorded redemption' : 'Will be recorded here'}</p>
                                </div>
                            </div>

                            {voucher.redeemed_at ? (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center">
                                    <p className="text-xs font-semibold text-slate-400">This voucher was redeemed on</p>
                                    <p className="mt-1 font-black text-slate-700">{new Date(voucher.redeemed_at).toLocaleString()}</p>
                                </div>
                            ) : isExpired ? (
                                <div className="rounded-lg border border-red-100 bg-red-50 p-5 text-center">
                                    <p className="text-lg font-black text-red-700">EXPIRED</p>
                                    <p className="mt-1 text-xs font-semibold text-red-500">This reward is no longer valid for redemption.</p>
                                </div>
                            ) : (
                                <button
                                    onClick={handleRedeem}
                                    disabled={isLoading}
                                    className="flex w-full items-center justify-center gap-3 rounded-lg bg-emerald-600 py-4 text-sm font-black text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                                    <span>Authorize & Redeem Reward</span>
                                </button>
                            )}
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
};
