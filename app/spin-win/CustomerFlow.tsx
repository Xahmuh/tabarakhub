import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { Spinner } from './Spinner';
import { spinWinService } from '../../services/spinWin';
import { SpinPrize, SpinSession, Customer, Branch } from '../../types';
import { clientConfig, isDemoMode } from '../../config/clientConfig';
import {
    Phone,
    Mail,
    MapPin,
    Star,
    Trophy,
    Share2,
    CheckCircle2,
    AlertCircle,
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
    logoUrl?: string;
    spinnerUrl?: string;
}

const SPIN_RETURN_KEY = 'tabarak_spinwin_return';
const SPIN_DRAFT_KEY = 'tabarak_spinwin_customer_draft';
const SPIN_RETURN_TTL_MS = 45 * 60 * 1000;

type SpinRecoveryStep = 'info' | 'review' | 'spin';

type SpinFlowDraft = {
    token: string;
    step: SpinRecoveryStep;
    phone: string;
    firstName: string;
    lastName: string;
    email: string;
    countryCode: string;
    hasClickedRate: boolean;
    mapsOpenedAt?: number;
    savedAt: number;
};

type MotionPermissionState = 'unsupported' | 'prompt' | 'enabled' | 'denied';

type WheelMotionState = {
    tiltX: number;
    tiltY: number;
    nudge: number;
    strength: number;
};

type MotionPermissionEvent = {
    requestPermission?: () => Promise<'granted' | 'denied'>;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isSpinRecoveryStateExpired = (savedAt?: number) =>
    !savedAt || Date.now() - savedAt > SPIN_RETURN_TTL_MS;

const clearSpinRecoveryState = () => {
    sessionStorage.removeItem(SPIN_RETURN_KEY);
    sessionStorage.removeItem(SPIN_DRAFT_KEY);
};

const loadSpinRecoveryState = (token: string): SpinFlowDraft | null => {
    try {
        const draft = JSON.parse(sessionStorage.getItem(SPIN_DRAFT_KEY) || 'null') as Partial<SpinFlowDraft> | null;
        const savedAt = Number(draft?.savedAt);
        if (!draft?.token || draft.token !== token || !Number.isFinite(savedAt) || isSpinRecoveryStateExpired(savedAt)) {
            clearSpinRecoveryState();
            return null;
        }

        return {
            token,
            step: draft.step === 'review' || draft.step === 'spin' ? draft.step : 'info',
            phone: draft.phone || '',
            firstName: draft.firstName || '',
            lastName: draft.lastName || '',
            email: draft.email || '',
            countryCode: draft.countryCode || '+973',
            hasClickedRate: Boolean(draft.hasClickedRate),
            mapsOpenedAt: draft.mapsOpenedAt,
            savedAt
        };
    } catch {
        clearSpinRecoveryState();
        return null;
    }
};

const saveSpinRecoveryState = (draft: Omit<SpinFlowDraft, 'savedAt'> & { url: string }) => {
    try {
        const savedAt = Date.now();
        const safeDraft: SpinFlowDraft = {
            token: draft.token,
            step: draft.step,
            phone: draft.phone,
            firstName: draft.firstName,
            lastName: draft.lastName,
            email: draft.email,
            countryCode: draft.countryCode,
            hasClickedRate: draft.hasClickedRate,
            mapsOpenedAt: draft.mapsOpenedAt,
            savedAt
        };

        sessionStorage.setItem(SPIN_RETURN_KEY, JSON.stringify({
            token: safeDraft.token,
            url: draft.url,
            step: safeDraft.step,
            hasClickedRate: safeDraft.hasClickedRate,
            mapsOpenedAt: safeDraft.mapsOpenedAt,
            savedAt
        }));
        sessionStorage.setItem(SPIN_DRAFT_KEY, JSON.stringify(safeDraft));
    } catch {
        // Recovery storage is only UX state; RPC validation remains authoritative.
    }
};

export const CustomerFlow: React.FC<CustomerFlowProps> = ({ token, logoUrl = clientConfig.logoUrl, spinnerUrl = '/spinner.svg' }) => {
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
    const [motionPermission, setMotionPermission] = useState<MotionPermissionState>('unsupported');
    const [wheelMotion, setWheelMotion] = useState<WheelMotionState>({ tiltX: 0, tiltY: 0, nudge: 0, strength: 0 });
    const lastMotionSpinRef = useRef(0);
    const motionResetRef = useRef<number | null>(null);

    // UX recovery only. Server RPCs remain the security boundary for token validity and spin execution.
    const buildSpinReturnUrl = (ratingOverride = skipRating) => {
        const params = new URLSearchParams(window.location.search);
        params.set('token', token);
        if (ratingOverride) params.set('skipRating', 'true');
        else params.delete('skipRating');
        return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    };

    const currentRecoveryStep = (): SpinRecoveryStep =>
        step === 'review' || step === 'spin' ? step : 'info';

    const persistSpinReturn = (
        ratingOverride = skipRating,
        patch: Partial<Omit<SpinFlowDraft, 'token' | 'savedAt'>> = {}
    ) => {
        const url = buildSpinReturnUrl(ratingOverride);
        window.history.replaceState({ spinToken: token }, '', url);
        const existing = loadSpinRecoveryState(token);
        saveSpinRecoveryState({
            token,
            url,
            step: patch.step ?? currentRecoveryStep(),
            phone: patch.phone ?? phone,
            firstName: patch.firstName ?? firstName,
            lastName: patch.lastName ?? lastName,
            email: patch.email ?? email,
            countryCode: patch.countryCode ?? countryCode,
            hasClickedRate: patch.hasClickedRate ?? hasClickedRate,
            mapsOpenedAt: patch.mapsOpenedAt ?? existing?.mapsOpenedAt
        });
        return url;
    };

    const saveFlowDraft = (patch: Partial<Omit<SpinFlowDraft, 'token' | 'savedAt'>> = {}) =>
        persistSpinReturn(skipRating, patch);

    const readFlowDraft = (): SpinFlowDraft | null => loadSpinRecoveryState(token);

    const clearSpinRecovery = () => clearSpinRecoveryState();

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

                    const savedDraft = readFlowDraft();
                    if (savedDraft) {
                        setPhone(savedDraft.phone);
                        setFirstName(savedDraft.firstName);
                        setLastName(savedDraft.lastName);
                        setEmail(savedDraft.email);
                        setCountryCode(savedDraft.countryCode);
                        setHasClickedRate(savedDraft.hasClickedRate);
                        const restoredStep = !shouldSkipRating && (savedDraft.hasClickedRate || savedDraft.step === 'review' || savedDraft.step === 'spin')
                            ? 'review'
                            : 'info';
                        persistSpinReturn(shouldSkipRating, {
                            ...savedDraft,
                            step: restoredStep
                        });
                        setStep(restoredStep);
                        return;
                    }

                    persistSpinReturn(shouldSkipRating, { step: 'info' });
                    setStep('info');
                } else {
                    clearSpinRecovery();
                    setError('This reward session is not available right now. Please ask the branch team for a new QR code.');
                }
            } catch {
                clearSpinRecovery();
                setError('We could not verify this reward session. Please check your connection and try again.');
            }
        };
        validateToken();
    }, [token]);

    useEffect(() => {
        if (step === 'info' || step === 'review' || step === 'spin') {
            persistSpinReturn(skipRating, { step });
        }

        switch (step) {
            case 'info': document.title = `Register Entry | ${clientConfig.clientName} | ${clientConfig.appName}`; break;
            case 'review': document.title = `Unlock Prize | ${clientConfig.clientName} | ${clientConfig.appName}`; break;
            case 'spin': document.title = `Lucky Spinner | ${clientConfig.clientName} | ${clientConfig.appName}`; break;
            case 'result': document.title = `You Won! | ${clientConfig.clientName} | ${clientConfig.appName}`; break;
            default: document.title = `${clientConfig.clientName} | ${clientConfig.appName}`;
        }
    }, [step, skipRating, token]);

    const handleInfoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone || !firstName || !lastName) return;
        setIsLoading(true);
        const fullPhone = `${countryCode}${phone}`;

        try {
            const cust = await spinWinService.customers.upsert(fullPhone, email, firstName, lastName);
            setCustomer(cust);
            saveFlowDraft({ hasClickedRate: false, step: 'info' });

            if (isDemoMode) {
                const dailyCount = await spinWinService.spins.getDailyCount(cust.id, 'customer');

                if (dailyCount >= 2) {
                    setError(`Daily limit reached for this demo customer (2 spins).`);
                    return;
                }
            }
            // Production fraud/rate checks are enforced server-side inside the spin RPC.

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
        } catch {
            setError('We could not save your details right now. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const loadPrizes = async () => {
        try {
            const activePrizes = await spinWinService.prizes.list();
            setPrizes(activePrizes.filter(p => p.isActive));
            saveFlowDraft({ hasClickedRate: true, step: 'spin' });
            setStep('spin');
        } catch (err) {
            setError('Error loading prizes.');
        }
    };

    const handleReviewClick = async () => {
        if (!customer || !session) return;
        const mapsOpenedAt = Date.now();
        setHasClickedRate(true);
        saveFlowDraft({ hasClickedRate: true, step: 'review', mapsOpenedAt });
        void spinWinService.reviews.log({
            customerId: customer.id,
            branchId: session.branchId,
            reviewClicked: true
        });
        const reviewUrl = session.branches?.google_maps_link || 'https://search.google.com/local/writereview?placeid=ChIJo_Y029TfPTUREonl7Y1yN5A';
        const opened = window.open(reviewUrl, '_blank', 'noopener,noreferrer');
        if (!opened) {
            window.location.assign(reviewUrl);
        }
    };

    const startSpin = useCallback(async (source: 'tap' | 'motion' = 'tap') => {
        if (isSpinning || isLoading) return;

        setIsLoading(true);
        setError('');

        if ('vibrate' in navigator) {
            (navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean }).vibrate?.(
                source === 'motion' ? [28, 22, 48] : 30
            );
        }

        try {
            const result = await spinWinService.spins.play(token, {
                phone: `${countryCode}${phone}`,
                firstName,
                lastName,
                email
            });

            setWinningPrize(result.prize);
            setVoucherCode(result.voucherCode);
            setIsSpinning(true);
        } catch (err: any) {
            console.error('Spin execution failed:', err);
            const msg = err.message || JSON.stringify(err);
            const tokenFailure = msg.includes('TOKEN_INVALID_OR_USED') || msg.includes('TOKEN_EXPIRED') || msg.includes('TOKEN_NOT_FOUND');
            if (tokenFailure) {
                clearSpinRecovery();
                setError('This session is no longer valid. Please ask the pharmacist for a new QR code.');
            }
            else if (msg.includes('SPIN_DAILY_LIMIT_REACHED')) setError('You have already played today. Please visit us again tomorrow.');
            else if (msg.includes('NO_PRIZES_CONFIGURED')) setError('No prizes are available right now.');
            else setError('We could not complete the spin right now. Please ask the branch team for help.');
        } finally {
            setIsLoading(false);
        }
    }, [countryCode, email, firstName, isLoading, isSpinning, lastName, phone, token]);

    const requestMotionAccess = useCallback(async () => {
        const motionWindow = window as Window & {
            DeviceMotionEvent?: MotionPermissionEvent;
            DeviceOrientationEvent?: MotionPermissionEvent;
        };

        if (!motionWindow.DeviceMotionEvent && !motionWindow.DeviceOrientationEvent) {
            setMotionPermission('unsupported');
            return;
        }

        const permissionRequests: Array<() => Promise<'granted' | 'denied'>> = [];

        if (typeof motionWindow.DeviceMotionEvent?.requestPermission === 'function') {
            permissionRequests.push(() => motionWindow.DeviceMotionEvent!.requestPermission!());
        }

        if (typeof motionWindow.DeviceOrientationEvent?.requestPermission === 'function') {
            permissionRequests.push(() => motionWindow.DeviceOrientationEvent!.requestPermission!());
        }

        if (permissionRequests.length === 0) {
            setMotionPermission('enabled');
            return;
        }

        try {
            const results = await Promise.all(permissionRequests.map(request => request()));
            setMotionPermission(results.every(result => result === 'granted') ? 'enabled' : 'denied');
        } catch {
            setMotionPermission('denied');
        }
    }, []);

    useEffect(() => {
        if (step !== 'spin') {
            setWheelMotion({ tiltX: 0, tiltY: 0, nudge: 0, strength: 0 });
            return;
        }

        const motionWindow = window as Window & {
            DeviceMotionEvent?: MotionPermissionEvent;
            DeviceOrientationEvent?: MotionPermissionEvent;
        };

        if (!motionWindow.DeviceMotionEvent && !motionWindow.DeviceOrientationEvent) {
            setMotionPermission('unsupported');
            return;
        }

        const needsPermission =
            typeof motionWindow.DeviceMotionEvent?.requestPermission === 'function' ||
            typeof motionWindow.DeviceOrientationEvent?.requestPermission === 'function';

        setMotionPermission(current => {
            if (current === 'enabled' || current === 'denied') return current;
            return needsPermission ? 'prompt' : 'enabled';
        });
    }, [step]);

    useEffect(() => {
        if (step !== 'spin' || motionPermission !== 'enabled') return;

        const scheduleMotionReset = () => {
            if (motionResetRef.current) window.clearTimeout(motionResetRef.current);
            motionResetRef.current = window.setTimeout(() => {
                setWheelMotion({ tiltX: 0, tiltY: 0, nudge: 0, strength: 0 });
            }, 850);
        };

        const handleOrientation = (event: DeviceOrientationEvent) => {
            const gamma = clamp(Number(event.gamma || 0), -34, 34);
            const beta = clamp(Number(event.beta || 0), -28, 42);

            setWheelMotion(current => ({
                ...current,
                tiltX: clamp(gamma / 4, -8, 8),
                tiltY: clamp(-beta / 8, -6, 6),
                nudge: clamp(gamma * 0.45 + beta * 0.12, -20, 20),
                strength: Math.max(current.strength, clamp(Math.abs(gamma) * 1.8, 0, 100))
            }));
            scheduleMotionReset();
        };

        const handleMotion = (event: DeviceMotionEvent) => {
            const rotationRate = event.rotationRate;
            const acceleration = event.accelerationIncludingGravity || event.acceleration;
            const rotationStrength = Math.hypot(
                Number(rotationRate?.alpha || 0),
                Number(rotationRate?.beta || 0),
                Number(rotationRate?.gamma || 0)
            );
            const accelerationStrength = Math.hypot(
                Number(acceleration?.x || 0),
                Number(acceleration?.y || 0),
                Number(acceleration?.z || 0)
            );
            const visualStrength = clamp(Math.max(rotationStrength / 5, Math.max(0, accelerationStrength - 9.8) * 7), 0, 100);

            if (visualStrength > 1) {
                setWheelMotion(current => ({
                    ...current,
                    nudge: clamp(current.nudge + Number(rotationRate?.gamma || 0) / 28, -22, 22),
                    strength: visualStrength
                }));
                scheduleMotionReset();
            }

            const now = Date.now();
            const strongRotation = rotationStrength > 420;
            const strongSwing = accelerationStrength > 24;

            if (
                prizes.length > 0 &&
                !isSpinning &&
                !isLoading &&
                now - lastMotionSpinRef.current > 2400 &&
                (strongRotation || strongSwing)
            ) {
                lastMotionSpinRef.current = now;
                startSpin('motion');
            }
        };

        window.addEventListener('deviceorientation', handleOrientation as EventListener, { passive: true });
        window.addEventListener('devicemotion', handleMotion as EventListener, { passive: true });

        return () => {
            window.removeEventListener('deviceorientation', handleOrientation as EventListener);
            window.removeEventListener('devicemotion', handleMotion as EventListener);
            if (motionResetRef.current) window.clearTimeout(motionResetRef.current);
        };
    }, [isLoading, isSpinning, motionPermission, prizes.length, startSpin, step]);

    const handleSpinFinish = () => {
        setIsSpinning(false);
        setWonPrize(winningPrize);
        setStep('result');
        clearSpinRecovery();

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

    const motionStatusLabel = motionPermission === 'enabled'
        ? wheelMotion.strength > 12 ? 'Moving' : 'Armed'
        : motionPermission === 'prompt'
            ? 'Enable'
            : motionPermission === 'denied'
                ? 'Blocked'
                : 'Tap only';
    const isWheelStep = step === 'review' || step === 'spin';

    if (error) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
                <div className="max-w-sm">
                    <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Oops!</h2>
                    <p className="text-slate-500 text-sm leading-relaxed mb-8">{error}</p>
                    <button onClick={() => { clearSpinRecovery(); window.location.reload(); }} className="w-full bg-slate-900 hover:bg-red-700 text-white py-4 rounded-2xl font-bold text-sm transition-colors">Try Again</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans flex flex-col selection:bg-brand selection:text-white">
            {/* Header */}
            {!isWheelStep && (
                <div className="bg-white p-4 sm:p-5 border-b border-slate-100 flex items-center justify-center space-x-3 shadow-sm sticky top-0 z-50">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 bg-brand rounded-lg flex items-center justify-center overflow-hidden shadow-inner">
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    <h1 className="text-lg sm:text-xl font-black tracking-tight">hub <span className="text-brand">SPIN & WIN</span></h1>
                </div>
            )}

            <div className={`flex-1 flex flex-col w-full ${isWheelStep ? '' : 'p-4 sm:p-6 max-w-xl mx-auto'}`}>
                {/* Validating Token */}
                {step === 'validate' && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-pulse">
                        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-100">
                            <img src={spinnerUrl} alt="Loading" className="h-20 w-20 object-contain" />
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
                    <div className="relative flex min-h-[100svh] flex-col overflow-hidden bg-slate-950 text-white animate-in fade-in duration-500">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(220,38,38,0.28),transparent_34%),linear-gradient(180deg,#111827_0%,#020617_64%,#111827_100%)]" />
                        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-red-700/25 to-transparent" />

                        <div className="relative z-10 flex min-h-[100svh] flex-col px-4 pb-5 pt-4 sm:px-6">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-200/70">
                                        {session?.branches?.name || 'Tabarak Pharmacy'}
                                    </p>
                                    <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                                        Spin the Wheel
                                    </h2>
                                </div>
                                <div className="shrink-0 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/70">
                                    {step === 'review' ? 'Locked' : 'Ready'}
                                </div>
                            </div>

                            <div className="mt-4 aspect-[4/1] w-full overflow-hidden border border-white/10 bg-white shadow-2xl">
                                <img
                                    src="/spin-header-v4.jpg"
                                    alt="Spin and Win"
                                    className="block h-full w-full object-cover"
                                />
                            </div>

                            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-3">
                                <div className={`relative w-full max-w-[min(86vw,420px)] transition-all duration-700 ${step === 'review' ? 'grayscale opacity-55 scale-[0.94] blur-[1.5px]' : 'scale-100'}`}>
                                    <Spinner
                                        prizes={prizes.map(p => ({ id: p.id, name: p.name, color: p.color || '' }))}
                                        winner={winningPrize}
                                        isSpinning={isSpinning}
                                        onFinish={handleSpinFinish}
                                        motionTiltX={wheelMotion.tiltX}
                                        motionTiltY={wheelMotion.tiltY}
                                        motionNudge={wheelMotion.nudge}
                                        isMotionActive={motionPermission === 'enabled' && wheelMotion.strength > 8}
                                        logoUrl={logoUrl}
                                    />
                                    {step === 'review' && (
                                        <div className="absolute inset-0 z-30 flex items-center justify-center">
                                            <div className="flex max-w-[210px] flex-col items-center rounded-[1.75rem] border border-white/10 bg-slate-950/90 p-5 text-center shadow-2xl backdrop-blur-md">
                                                <Star className="h-8 w-8 animate-bounce fill-amber-400 text-amber-400" />
                                                <span className="mt-3 text-xs font-black uppercase leading-tight tracking-[0.16em] text-white">Unlock Wheel</span>
                                                <span className="mt-1 text-[10px] font-bold leading-relaxed text-white/50">Google Maps rating required</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {step === 'spin' && (
                                    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.07] p-3 shadow-xl">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-red-200">
                                                    <Smartphone className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Motion Spin</p>
                                                    <p className="text-[10px] font-bold text-white/35">Twist strength</p>
                                                </div>
                                            </div>
                                            <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${motionPermission === 'enabled' ? 'bg-emerald-400/15 text-emerald-200' : motionPermission === 'prompt' ? 'bg-amber-400/15 text-amber-200' : 'bg-white/10 text-white/45'}`}>
                                                {motionStatusLabel}
                                            </span>
                                        </div>
                                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-red-400 via-amber-300 to-emerald-300 transition-all duration-150"
                                                style={{ width: `${clamp(wheelMotion.strength, 0, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="w-full max-w-sm self-center space-y-3 pb-1">
                                {step === 'review' ? (
                                    !hasClickedRate ? (
                                        <button onClick={handleReviewClick} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-red-600 py-4 text-sm font-black text-white shadow-lg shadow-red-950/30 transition-all hover:bg-red-700 active:scale-[0.98]">
                                            <Star className="h-5 w-5" />
                                            <span>Rate Branch to Spin</span>
                                            <ArrowRight className="h-4 w-4" />
                                        </button>
                                    ) : (
                                        <button onClick={() => { saveFlowDraft({ hasClickedRate: true, step: 'review' }); loadPrizes(); }} className="flex w-full animate-in zoom-in items-center justify-center gap-3 rounded-2xl bg-emerald-600 py-4 text-sm font-black text-white shadow-lg shadow-emerald-950/30 transition-all hover:bg-emerald-700 active:scale-[0.98]">
                                            <CheckCircle2 className="h-5 w-5" />
                                            <span>I Have Rated - Continue</span>
                                        </button>
                                    )
                                ) : (
                                    <>
                                        <button
                                            onClick={() => startSpin('tap')}
                                            disabled={isSpinning || isLoading || prizes.length === 0}
                                            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-4 text-sm font-black text-slate-950 shadow-2xl transition-all hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
                                        >
                                            {isLoading ? (
                                                <><Loader2 className="h-5 w-5 animate-spin" /><span>Authenticating...</span></>
                                            ) : isSpinning ? (
                                                <span>Consulting Luck...</span>
                                            ) : (
                                                <span>Tap to Spin Wheel</span>
                                            )}
                                        </button>

                                        {motionPermission === 'prompt' && (
                                            <button
                                                type="button"
                                                onClick={requestMotionAccess}
                                                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] py-3 text-xs font-black uppercase tracking-[0.14em] text-white/80 transition-all hover:bg-white/[0.12] active:scale-[0.98]"
                                            >
                                                <Smartphone className="h-4 w-4" />
                                                Enable Phone Motion
                                            </button>
                                        )}

                                        {motionPermission === 'denied' && (
                                            <p className="text-center text-[10px] font-bold leading-relaxed text-white/40">
                                                Motion access is blocked by the browser. Tap spin still works.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
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
