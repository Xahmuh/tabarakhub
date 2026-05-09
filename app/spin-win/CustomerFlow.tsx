import React, { useState, useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';
import { Spinner } from './Spinner';
import { spinWinService } from '../../services/spinWin';
import { SpinPrize, SpinSession, Customer, Branch } from '../../types';
import {
    Phone,
    Mail,
    MapPin,
    Star,
    Trophy,
    Share2,
    CheckCircle2,
    AlertCircle,
    QrCode,
    Smartphone,
    MessageCircle,
    Download,
    UserCircle,
    ArrowRight,
    Loader2,
    Instagram,
    MessagesSquare
} from 'lucide-react';

interface CustomerFlowProps {
    token: string;
}

export const CustomerFlow: React.FC<CustomerFlowProps> = ({ token }) => {
    const [step, setStep] = useState<'validate' | 'info' | 'review' | 'spin' | 'result'>('validate');
    const [session, setSession] = useState<(SpinSession & { branches?: { name?: string, google_maps_link?: string, whatsapp_number?: string } }) | null>(null);
    const voucherRef = useRef<HTMLDivElement>(null);
    const [phone, setPhone] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [prizes, setPrizes] = useState<SpinPrize[]>([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [wonPrize, setWonPrize] = useState<SpinPrize | null>(null);
    const [voucherCode, setVoucherCode] = useState('');
    const [error, setError] = useState('');
    const [countryCode, setCountryCode] = useState('+973');
    const [isLoading, setIsLoading] = useState(false);
    const [winningPrize, setWinningPrize] = useState<SpinPrize | null>(null);
    const [hasClickedRate, setHasClickedRate] = useState(false);
    const [skipRating, setSkipRating] = useState(false);

    const countryCodes = [
        { code: '+973', country: 'BH' },
        { code: '+966', country: 'SA' },
        { code: '+965', country: 'KW' },
        { code: '+971', country: 'AE' },
        { code: '+974', country: 'QA' },
        { code: '+968', country: 'OM' },
        { code: '+20', country: 'EG' },
        { code: '+44', country: 'UK' },
        { code: '+1', country: 'US' },
        { code: '+91', country: 'IN' },
        { code: '+63', country: 'PH' },
        { code: '+962', country: 'JO' },
        { code: '+961', country: 'LB' }
    ];

    useEffect(() => {
        const validateToken = async () => {
            try {
                const result = await spinWinService.sessions.validate(token);
                if (result && !result.error) {
                    setSession(result);

                    const urlParams = new URLSearchParams(window.location.search);
                    const shouldSkipRating = urlParams.get('skipRating') === 'true';
                    setSkipRating(shouldSkipRating);

                    setStep('info');
                } else {
                    const reason = result?.error || 'INVALID_OR_NOT_FOUND';
                    setError(`Security Check Failed: ${reason}. Please ask the pharmacist for a NEW QR code.`);
                }
            } catch (err: any) {
                setError(`Connection error: ${err.message || 'Check network'}`);
            }
        };
        validateToken();
    }, [token]);

    useEffect(() => {
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', newUrl);

        switch (step) {
            case 'info': document.title = "Register Entry"; break;
            case 'review': document.title = "Unlock Prize"; break;
            case 'spin': document.title = "Lucky Spinner"; break;
            case 'result': document.title = "You Won!"; break;
            default: document.title = "Tabarak Reward Hub";
        }
    }, [step]);

    const [ip, setIp] = useState('');

    const handleInfoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone || !firstName || !lastName) return;
        setIsLoading(true);
        const fullPhone = `${countryCode}${phone}`;

        try {
            let clientIp = '';
            try {
                const ipRes = await fetch('https://api.ipify.org?format=json');
                const ipData = await ipRes.json();
                clientIp = ipData.ip;
                setIp(clientIp);
            } catch (e) {
                console.warn('Failed to fetch IP', e);
            }

            const cust = await spinWinService.customers.upsert(fullPhone, email, firstName, lastName);
            setCustomer(cust);

            const dailyCount = await spinWinService.spins.getDailyCount(clientIp || cust.id, clientIp ? 'ip' : 'customer');

            if (dailyCount >= 2) {
                setError(`Daily limit reached for this device/connection (2 spins). fraud protection active.`);
                return;
            }

            if (session) {
                if (skipRating) {
                    loadPrizes();
                } else {
                    const hasReviewed = await spinWinService.reviews.checkToday(cust.id, session.branchId);
                    if (hasReviewed) {
                        loadPrizes();
                    } else {
                        setStep('review');
                    }
                }
            }
        } catch (err: any) {
            setError(`Error saving your details: ${err.message || 'Check connection'}`);
        } finally {
            setIsLoading(false);
        }
    };

    const loadPrizes = async () => {
        try {
            const activePrizes = await spinWinService.prizes.list();
            setPrizes(activePrizes.filter(p => p.isActive));
            setStep('spin');
        } catch (err) {
            setError('Error loading prizes.');
        }
    };

    const handleReviewClick = async () => {
        if (!customer || !session) return;
        spinWinService.reviews.log({
            customerId: customer.id,
            branchId: session.branchId,
            reviewClicked: true
        });
        const reviewUrl = session.branches?.google_maps_link || 'https://search.google.com/local/writereview?placeid=ChIJo_Y029TfPTUREonl7Y1yN5A';
        window.open(reviewUrl, '_blank');
        setHasClickedRate(true);
    };

    const startSpin = async () => {
        if (isSpinning || isLoading) return;

        setIsLoading(true);
        setError('');

        try {
            const result = await spinWinService.spins.play(token, {
                phone: `${countryCode}${phone}`,
                firstName,
                lastName,
                email,
                ip: ip
            });

            setWinningPrize(result.prize);
            setVoucherCode(result.voucherCode);
            setIsSpinning(true);
        } catch (err: any) {
            console.error('Spin execution failed:', err);
            const msg = err.message || JSON.stringify(err);
            if (msg.includes('TOKEN_INVALID_OR_USED')) setError('This session is no longer valid.');
            else if (msg.includes('NO_PRIZES_CONFIGURED')) setError('No prizes are available right now.');
            else setError(`Server Error: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSpinFinish = () => {
        setIsSpinning(false);
        setWonPrize(winningPrize);
        setStep('result');

        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        document.title = "Your Voucher is Ready!";
    };

    const shareOnWhatsApp = async () => {
        if (!wonPrize || !voucherCode || !customer || !voucherRef.current) return;

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);
        const expiryStr = expiryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        const branchName = session?.branches?.name || 'Tabarak Pharmacy';
        const fullName = `${firstName} ${lastName}`;
        const fullPhone = `${countryCode}${phone}`;
        const text = `Hey Tabarak! I just won ${wonPrize.name} at ${branchName}, My voucher code is ${voucherCode} and its expiry is ${expiryStr}.. my name is ${fullName} and my phone number is ${fullPhone}`;

        setIsLoading(true);
        try {
            await new Promise(r => setTimeout(r, 200));

            const dataUrl = await toPng(voucherRef.current, {
                cacheBust: true,
                pixelRatio: 3,
                backgroundColor: '#b91c1c'
            });

            spinWinService.shares.log({
                voucherCode: voucherCode,
                fromCustomerId: customer.id,
                branchId: session.branchId
            });

            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], `tabarak-voucher.png`, { type: 'image/png' });

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    text: text,
                    title: 'My Tabarak Reward'
                });
            } else {
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
            }
        } catch (err) {
            console.error('Sharing failed', err);
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        } finally {
            setIsLoading(false);
        }
    };

    const downloadVoucher = async () => {
        if (!voucherRef.current) return;
        setIsLoading(true);
        try {
            await new Promise(r => setTimeout(r, 200));
            const dataUrl = await toPng(voucherRef.current, {
                cacheBust: true,
                pixelRatio: 3,
                backgroundColor: '#b91c1c'
            });
            const link = document.createElement('a');
            link.download = `tabarak-voucher-${voucherCode}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Download failed', err);
            setError('Image generation failed. Please take a screenshot.');
        } finally {
            setIsLoading(false);
        }
    };

    if (error) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
                <div className="max-w-sm">
                    <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Oops!</h2>
                    <p className="text-slate-500 text-sm leading-relaxed mb-8">{error}</p>
                    <button onClick={() => window.location.reload()} className="w-full bg-slate-900 hover:bg-red-700 text-white py-4 rounded-2xl font-bold text-sm transition-colors">Try Again</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans flex flex-col selection:bg-brand selection:text-white">
            {/* Header */}
            <div className="bg-white p-4 sm:p-5 border-b border-slate-100 flex items-center justify-center space-x-3 shadow-sm sticky top-0 z-50">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-brand rounded-lg flex items-center justify-center overflow-hidden shadow-inner">
                    <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
                </div>
                <h1 className="text-lg sm:text-xl font-black tracking-tight">Tabarak <span className="text-brand">SPIN & WIN</span></h1>
            </div>

            <div className="flex-1 flex flex-col p-4 sm:p-6 max-w-xl mx-auto w-full">
                {/* Validating Token */}
                {step === 'validate' && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-pulse">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
                            <QrCode className="w-8 h-8 text-slate-300" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-slate-900">Verifying Token</h3>
                            <p className="text-slate-400 text-xs font-medium mt-1">Connecting to Secure Node...</p>
                        </div>
                    </div>
                )}

                {/* Info Form */}
                {step === 'info' && (
                    <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Form header */}
                        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6">
                            <Smartphone className="w-8 h-8 text-red-400 mb-3" />
                            <h2 className="text-xl font-bold text-white tracking-tight">Enter Your Details</h2>
                            <p className="text-white/50 text-xs font-medium mt-1">Fill in to spin the wheel</p>
                        </div>

                        <form onSubmit={handleInfoSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">First Name</label>
                                    <div className="relative">
                                        <UserCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                        <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full pl-10 pr-3 py-3.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-red-500 outline-none transition-all text-sm font-semibold" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Last Name</label>
                                    <div className="relative">
                                        <UserCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                        <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full pl-10 pr-3 py-3.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-red-500 outline-none transition-all text-sm font-semibold" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Phone Number</label>
                                <div className="flex gap-2">
                                    <div className="relative w-[85px] shrink-0">
                                        <select
                                            aria-label="Country Code"
                                            value={countryCode}
                                            onChange={(e) => setCountryCode(e.target.value)}
                                            className="w-full h-full px-2 py-3.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-red-500 outline-none transition-all text-sm font-semibold appearance-none text-center"
                                        >
                                            {countryCodes.map((c) => (
                                                <option key={c.code} value={c.code}>{c.code}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="relative flex-1">
                                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                        <input
                                            type="tel"
                                            required
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                            className="w-full pl-10 pr-3 py-3.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-red-500 outline-none transition-all text-sm font-semibold"
                                            placeholder="xxxxxxxx"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Email <span className="text-slate-300">(Optional)</span></label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-3 py-3.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-red-500 outline-none transition-all text-sm font-semibold" />
                                </div>
                            </div>

                            <button type="submit" disabled={isLoading} className="w-full bg-slate-900 hover:bg-red-700 text-white py-4 rounded-xl font-bold text-sm transition-colors active:scale-[0.98] disabled:bg-slate-300 flex items-center justify-center gap-2">
                                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <>Continue to Spin <ArrowRight className="w-4 h-4" /></>}
                            </button>
                        </form>
                    </div>
                )}

                {/* Review & Spin */}
                {(step === 'review' || step === 'spin') && (
                    <div className="flex-1 flex flex-col items-center justify-between py-4 animate-in zoom-in duration-700">
                        <div className="w-full mb-6">
                            <img
                                src="/spin-header-v4.jpg"
                                alt="Spin and Win"
                                className="w-full h-auto object-cover rounded-2xl"
                            />
                        </div>

                        <div className={`relative transition-all duration-1000 ${step === 'review' ? 'grayscale opacity-40 scale-90 blur-[2px]' : 'scale-110'}`}>
                            <Spinner
                                prizes={prizes.map(p => ({ id: p.id, name: p.name, color: p.color || '' }))}
                                winner={winningPrize}
                                isSpinning={isSpinning}
                                onFinish={handleSpinFinish}
                            />
                            {step === 'review' && (
                                <div className="absolute inset-0 flex items-center justify-center z-30">
                                    <div className="bg-slate-900/90 text-white p-6 rounded-3xl shadow-2xl backdrop-blur-md border border-white/10 flex flex-col items-center space-y-3">
                                        <Star className="w-8 h-8 text-amber-400 fill-amber-400 animate-bounce" />
                                        <span className="font-bold text-xs text-center leading-tight">Unlock Wheel<br />via Google Maps</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="w-full max-w-sm mt-8">
                            {step === 'review' ? (
                                !hasClickedRate ? (
                                    <button onClick={handleReviewClick} className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-[0.98] flex items-center justify-center space-x-3">
                                        <Star className="w-5 h-5" />
                                        <span>Rate Branch to Spin</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button onClick={() => loadPrizes()} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-[0.98] flex items-center justify-center space-x-3 animate-in zoom-in">
                                        <CheckCircle2 className="w-5 h-5" />
                                        <span>I Have Rated - Continue</span>
                                    </button>
                                )
                            ) : (
                                <button
                                    onClick={startSpin}
                                    disabled={isSpinning || isLoading || prizes.length === 0}
                                    className="w-full bg-slate-900 hover:bg-red-700 text-white py-5 rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-3"
                                >
                                    {isLoading ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /><span>Authenticating...</span></>
                                    ) : isSpinning ? (
                                        <span>Consulting Luck...</span>
                                    ) : (
                                        <span>Tap to Spin Wheel!</span>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Result */}
                {step === 'result' && wonPrize && (
                    <div className="animate-in zoom-in duration-700 space-y-6">
                        {/* Winner header */}
                        <div className="text-center pt-4">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Congratulations!</h2>
                            <p className="text-slate-400 text-xs font-medium mt-1">Your reward has been secured</p>
                        </div>

                        {/* Voucher Card */}
                        <div className="bg-[#b91c1c] text-white rounded-2xl overflow-hidden shadow-xl flex relative min-h-[150px]">
                            <div className="w-1/4 border-r-2 border-dashed border-white/30 flex flex-col items-center justify-center p-3 relative bg-black/5">
                                <div className="absolute top-0 right-0 w-4 h-4 bg-slate-50 rounded-full -mr-2 -mt-2"></div>
                                <div className="absolute bottom-0 right-0 w-4 h-4 bg-slate-50 rounded-full -mr-2 -mb-2"></div>
                                <div className="flex flex-col items-center space-y-1 opacity-80">
                                    <div className="w-full flex justify-between space-x-[2px] h-10">
                                        {[2, 1, 3, 1, 2, 4, 1, 2].map((w, i) => (<div key={i} className="bg-white" style={{ width: `${w}px` }}></div>))}
                                    </div>
                                    <span className="text-[6px] font-mono tracking-tighter">ID-{voucherCode.split('-')[1]}</span>
                                </div>
                            </div>
                            <div className="flex-1 p-5 flex flex-col justify-between text-left">
                                <div>
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-xl font-black tracking-tight leading-tight mb-1">{wonPrize.name}</h3>
                                        <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center"><Trophy className="w-3.5 h-3.5" /></div>
                                    </div>
                                    <p className="text-[8px] font-bold uppercase tracking-widest text-white/60">Expires: {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                </div>
                                <div className="flex items-end justify-between mt-3">
                                    <div>
                                        <p className="text-[8px] font-bold uppercase tracking-widest text-white/40 mb-0.5">Security Code</p>
                                        <div className="text-lg font-bold font-mono tracking-widest">{voucherCode}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => {
                                const expiryDate = new Date();
                                expiryDate.setDate(expiryDate.getDate() + 7);
                                const expiryStr = expiryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                                const branchName = session?.branches?.name || 'Tabarak Pharmacy';
                                const fullName = `${firstName} ${lastName}`;
                                const fullPhone = `${countryCode}${phone}`;
                                const text = `Hey Tabarak! I just won ${wonPrize.name} at ${branchName}, My voucher code is ${voucherCode} and its expiry is ${expiryStr}.. my name is ${fullName} and my phone number is ${fullPhone}`;

                                const targetPhone = session?.branches?.whatsapp_number || '97333616996';
                                window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`, '_blank');
                            }} className="bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all active:scale-[0.98]">
                                <MessageCircle className="w-5 h-5" />
                                <span>Share with Pharmacy</span>
                            </button>
                            <button onClick={downloadVoucher} disabled={isLoading} className="bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 p-4 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1.5 transition-all active:scale-[0.98]">
                                <Download className="w-5 h-5" />
                                <span>{isLoading ? 'Saving...' : 'Save Voucher'}</span>
                            </button>
                        </div>

                        {/* Social Channels */}
                        <div className="space-y-3 pt-2">
                            <a
                                href="https://whatsapp.com/channel/0029VaX7ZLf1t90dNDBNaw11"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative overflow-hidden bg-[#25D366] text-white p-4 rounded-2xl shadow-md transition-all active:scale-[0.98] hover:shadow-lg flex items-center justify-between"
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-white/20 rounded-xl">
                                        <MessagesSquare className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <h4 className="font-bold text-xs">Stay Updated</h4>
                                        <p className="text-[10px] opacity-80">Join WhatsApp Channel</p>
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </a>

                            <a
                                href="https://www.instagram.com/tabarak_pharmacy_group/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative overflow-hidden bg-white text-slate-900 p-4 rounded-2xl shadow-md border border-slate-100 transition-all active:scale-[0.98] hover:shadow-lg hover:border-pink-200 flex items-center justify-between"
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white rounded-xl">
                                        <Instagram className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <h4 className="font-bold text-xs text-slate-900">Follow Us</h4>
                                        <p className="text-[10px] text-slate-500">@tabarak_pharmacy_group</p>
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-pink-500 group-hover:translate-x-1 transition-all" />
                            </a>
                        </div>

                        <p className="text-center text-slate-400 text-[10px] font-medium uppercase tracking-wider pt-2">Redeemable at any branch &bull; Valid for 7 days</p>
                    </div>
                )}
            </div>

            {/* Hidden Voucher for Image Generation */}
            {wonPrize && (
                <div style={{ position: 'absolute', left: '-9999px', top: '0' }}>
                    <div ref={voucherRef} className="w-[600px] h-[300px] bg-[#b91c1c] text-white flex relative overflow-hidden font-sans" style={{ borderRadius: '20px' }}>
                        <div className="w-[150px] border-r-2 border-dashed border-white/30 flex flex-col items-center justify-center p-6 bg-black/10">
                            <div className="w-full h-24 flex justify-between space-x-[3px] px-2">
                                {[3, 1, 4, 1, 2, 5, 1, 2, 1, 3, 1, 2].map((w, i) => (<div key={i} className="bg-white" style={{ width: `${w}px` }}></div>))}
                            </div>
                            <span className="mt-4 text-[10px] font-mono font-bold tracking-[0.2em]">{voucherCode}</span>
                        </div>
                        <div className="flex-1 p-10 flex flex-col justify-between relative">
                            <div className="absolute top-0 right-0 p-8 opacity-10"><Trophy size={150} /></div>
                            <div>
                                <h4 className="text-white/60 font-black uppercase tracking-[0.4em] text-xs mb-2">Exclusive Reward</h4>
                                <h2 className="text-5xl font-black tracking-tighter leading-none mb-4">{wonPrize.name}</h2>
                                <p className="text-white/80 font-bold text-sm">Valid at any Tabarak Pharmacy branch.</p>
                            </div>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-white/40 font-black uppercase tracking-widest text-[10px] mb-1">Expiry Date</p>
                                    <p className="font-black text-xl">{new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-white/40 font-black uppercase tracking-widest text-[10px] mb-1">Customer</p>
                                    <p className="font-bold text-sm">{firstName} {lastName}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
