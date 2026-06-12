import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { spinWinService } from '../../services/spinWin';
import { supabaseClient } from '../../lib/supabaseClient';
import { SpinSession, Branch } from '../../types';
import {
    QrCode,
    RefreshCcw,
    Clock,
    AlertCircle,
    Smartphone,
    CheckCircle2,
    ExternalLink,
    Users,
    Activity,
    Lock,
    MessageCircle,
    ArrowLeft,
    Copy,
    Send,
    Download
} from 'lucide-react';

import { NETWORK_CONFIG } from '../../lib/networkConfig';

interface BranchQRGeneratorProps {
    branch: Branch;
    onBack: () => void;
}

export const BranchQRGenerator: React.FC<BranchQRGeneratorProps> = ({ branch, onBack }) => {
    const [qrType, setQrType] = useState<'static' | 'single' | 'multi'>('static');
    const qrRef = React.useRef<HTMLDivElement>(null);
    const [session, setSession] = useState<SpinSession | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isLocked, setIsLocked] = useState(branch.isSpinEnabled === false);
    const [copied, setCopied] = useState(false);
    const [showDownloadOptions, setShowDownloadOptions] = useState(false);

    const [talabatMessage, setTalabatMessage] = useState(`*طلبكم بالطريق!*
شكراً لثقتكم بصيدليات تبارك

*استمتع بهدية خاصة!*
دوّر العجلة واربح قسائم وخصومات حصرية مقدمة من صيدليات تبارك
و يمكنكم الاستفادة بالقسائم داخل الفروع او من خلال الطلب واتساب
التوصيل مجاني لجميع مناطق البحرين

*Your order is on the way!*
Thank you for trusting Tabarak Pharmacies

*Enjoy a special gift!*
Spin the wheel and win exclusive vouchers and discounts
from Tabarak Pharmacies, you can use the vouchers inside the branches or through WhatsApp
Free delivery to all areas of Bahrain
`);

    const [whatsappMessage, setWhatsappMessage] = useState(`*العب واربح!*
دوّر العجلة واحصل على قسائم حصرية من صيدليات تبارك
التوصيل مجاني لجميع مناطق البحرين

*Spin and Win!*
Win exclusive vouchers from Tabarak Pharmacies
Free delivery to all areas of Bahrain`);

    useEffect(() => {
        const checkPermission = async () => {
            const { data } = await supabaseClient
                .from('branches')
                .select('is_spin_enabled')
                .eq('id', branch.id)
                .single();
            if (data && data.is_spin_enabled === false) setIsLocked(true);
        };
        checkPermission();
    }, [branch.id]);

    const generateSession = async (type: 'single' | 'multi' | 'static') => {
        if (isLocked || type === 'static') return;
        setIsLoading(true);
        setError('');
        try {
            const isMulti = type === 'multi';
            const newSession = await spinWinService.sessions.generate(branch.id, isMulti);
            setSession(newSession);
            setTimeLeft(isMulti ? 7 * 24 * 60 * 60 : 600);
        } catch (err: any) {
            setError(err.message || 'Failed to generate session.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!isLocked) {
            if (qrType === 'static') {
                setSession(null);
                setTimeLeft(0);
            } else {
                generateSession(qrType);
            }
        }
    }, [qrType, isLocked]);

    useEffect(() => {
        if (timeLeft > 0) {
            const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
            return () => clearInterval(timer);
        } else if (session) {
            setSession(null);
        }
    }, [timeLeft, session]);

    const baseUrl = window.location.origin;
    const currentHost = window.location.hostname;
    const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
    const effectiveBaseUrl = isLocalhost ? `http://${NETWORK_CONFIG.localIp}:${NETWORK_CONFIG.port}` : baseUrl;

    const customerUrl = qrType === 'static'
        ? `${effectiveBaseUrl}/?node=${branch.code}`
        : `${effectiveBaseUrl}/?token=${session?.token || ''}`;

    const talabatUrl = qrType === 'static'
        ? `${effectiveBaseUrl}/?node=${branch.code}&skipRating=true`
        : `${effectiveBaseUrl}/?token=${session?.token || ''}&skipRating=true`;

    const downloadQR = async () => {
        if (!qrRef.current) return;
        setIsLoading(true);
        try {
            const dataUrl = await toPng(qrRef.current, {
                cacheBust: true,
                pixelRatio: 3,
                backgroundColor: '#ffffff',
            });
            const link = document.createElement('a');
            link.download = `spinwin-qr-${branch.code || 'branch'}.jpg`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Download failed', err);
            setError('Image generation failed.');
        } finally {
            setIsLoading(false);
        }
    };

    const downloadPDF = async () => {
        if (!qrRef.current) return;
        setIsLoading(true);
        try {
            const qrDataUrl = await toPng(qrRef.current, {
                cacheBust: true,
                pixelRatio: 4,
                backgroundColor: '#ffffff',
            });

            const baseUrl = window.location.origin;
            const bgUrl = `${baseUrl}/poster-bg.jpg`;

            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(`
                    <html>
                        <head>
                            <title>Spin & Win Poster - ${branch.name}</title>
                            <style>
                                @page { 
                                    size: 200mm 200mm; 
                                    margin: 0; 
                                    }
                                @media print {
                                    html, body {
                                        width: 200mm;
                                        height: 200mm;
                                    }
                                }
                                body { 
                                    margin: 0; 
                                    padding: 0;
                                    display: block;
                                    width: 200mm;
                                    height: 200mm;
                                    -webkit-print-color-adjust: exact;
                                    print-color-adjust: exact;
                                }
                                .poster-container {
                                    width: 200mm;
                                    height: 200mm;
                                    position: relative;
                                    overflow: hidden;
                                }
                                .bg-image {
                                    width: 200mm;
                                    height: 200mm;
                                    position: absolute;
                                    top: 0;
                                    left: 0;
                                    z-index: 1;
                                }
                                .qr-overlay {
                                    position: absolute;
                                    top: 130px;
                                    left: 50%;
                                    transform: translateX(-50%);
                                    width: 320px;
                                    height: 320px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    z-index: 10;
                                }
                                .qr-overlay img {
                                    width: 280px;
                                    height: 280px;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="poster-container">
                                <img src="${bgUrl}" class="bg-image" id="bgImg" />
                                <div class="qr-overlay">
                                    <img src="${qrDataUrl}" id="qrImg" />
                                </div>
                            </div>
                            <script>
                                function checkLoaded() {
                                    const bg = document.getElementById('bgImg');
                                    const qr = document.getElementById('qrImg');
                                    if (bg.complete && qr.complete) {
                                        setTimeout(() => {
                                            window.print();
                                            window.close();
                                        }, 1000);
                                    } else {
                                        setTimeout(checkLoaded, 100);
                                    }
                                }
                                window.onload = checkLoaded;
                            </script>
                        </body>
                    </html>
                `);
                printWindow.document.close();
            }
        } catch (err) {
            console.error('PDF generation failed', err);
            setError('Could not generate PDF.');
        } finally {
            setIsLoading(false);
            setShowDownloadOptions(false);
        }
    };

    const handleCopy = async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(customerUrl);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = customerUrl;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            setError('Could not copy. Manual copy: ' + customerUrl);
        }
    };

    const defaultTalabatMsg = `*طلبكم بالطريق!*
شكراً لثقتكم بصيدليات تبارك

*استمتع بهدية خاصة!*
دوّر العجلة واربح قسائم وخصومات حصرية مقدمة من صيدليات تبارك
و يمكنكم الاستفادة بالقسائم داخل الفروع او من خلال الطلب واتساب
التوصيل مجاني لجميع مناطق البحرين

*Your order is on the way!*
Thank you for trusting Tabarak Pharmacies

*Enjoy a special gift!*
Spin the wheel and win exclusive vouchers and discounts
from Tabarak Pharmacies, you can use the vouchers inside the branches or through WhatsApp
Free delivery to all areas of Bahrain
`;

    const defaultWhatsappMsg = `*العب واربح!*
دوّر العجلة واحصل على قسائم حصرية من صيدليات تبارك
التوصيل مجاني لجميع مناطق البحرين

*Spin and Win!*
Win exclusive vouchers from Tabarak Pharmacies
Free delivery to all areas of Bahrain`;

    if (isLocked) {
        return (
            <div className="max-w-lg mx-auto p-4 lg:p-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden p-12 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-6 mx-auto">
                        <Lock className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-3">Locked by Manager</h2>
                    <p className="text-slate-500 text-sm mb-8">This section has been restricted by the administration.</p>
                    <div className="inline-flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100 text-xs font-bold uppercase tracking-wider mb-8">
                        <Activity className="w-3.5 h-3.5" />
                        Status: Inactive
                    </div>
                    <button onClick={onBack} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold text-sm transition-all">
                        Return to Suite
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-4 lg:p-10 animate-in fade-in slide-in-from-bottom-6 duration-700 space-y-6">
            {/* Back */}
            <button onClick={onBack} className="inline-flex items-center gap-2 text-slate-400 hover:text-red-600 transition-colors group">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span className="text-xs font-bold uppercase tracking-widest">Back to Spin & Win Suite</span>
            </button>

            {/* Network info for localhost */}
            {isLocalhost && (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3">
                    <Activity className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p className="text-xs text-emerald-700 font-medium">
                        QR optimized for mobile via <span className="font-bold underline">{NETWORK_CONFIG.localIp}</span>
                    </p>
                </div>
            )}

            {/* Main QR Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                            <QrCode className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Customer Engagement Generator</h2>
                            <p className="text-white/50 text-xs font-medium">Generate QR codes for customer rewards</p>
                        </div>
                    </div>
                    {(session || qrType === 'static') && (
                        <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                            <span className="text-xs font-bold text-white/80">{qrType === 'static' ? 'Permanent' : 'Active'}</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                    {/* Left: QR */}
                    <div className="p-6 lg:p-8 flex flex-col items-center">
                        {/* QR Code */}
                        <div ref={qrRef} className={`bg-white p-6 rounded-2xl border-2 border-slate-100 mb-6 transition-all ${(!session && qrType !== 'static') ? 'opacity-30 grayscale' : 'shadow-lg'}`}>
                            {(session || qrType === 'static') ? (
                                <QRCodeSVG value={customerUrl} size={200} level="H" includeMargin={false} />
                            ) : (
                                <div className="w-[200px] h-[200px] flex items-center justify-center bg-slate-50 rounded-xl">
                                    <QrCode className="w-14 h-14 text-slate-300" />
                                </div>
                            )}
                        </div>

                        {/* Timer */}
                        {(session || qrType === 'static') && (
                            <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 mb-4 w-full max-w-[280px] justify-center">
                                <Clock className="w-4 h-4 text-red-400" />
                                <span className="text-xs font-bold tabular-nums">
                                    {qrType === 'static'
                                        ? 'Static (Never Expires)'
                                        : qrType === 'multi'
                                            ? `Expires in ${Math.ceil(timeLeft / (24 * 3600))} Days`
                                            : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`
                                    }
                                </span>
                            </div>
                        )}

                        {/* URL */}
                        {(session || qrType === 'static') && (
                            <div className="bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg w-full max-w-[280px] mb-5">
                                <code className="text-[10px] text-slate-600 font-mono break-all">{customerUrl}</code>
                            </div>
                        )}

                        {/* Mode Toggle */}
                        <div className="w-full max-w-[280px] bg-slate-100 p-1 rounded-xl flex mb-5">
                            <button
                                onClick={() => setQrType('static')}
                                className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold transition-all ${qrType === 'static' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                            >
                                Static
                            </button>
                            <button
                                onClick={() => setQrType('single')}
                                className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold transition-all ${qrType === 'single' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                            >
                                Single
                            </button>
                            <button
                                onClick={() => setQrType('multi')}
                                className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold transition-all ${qrType === 'multi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                            >
                                Multi
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 w-full max-w-[280px] relative">
                            {qrType === 'static' ? (
                                <div className="flex-1 relative">
                                    <button
                                        onClick={() => setShowDownloadOptions(!showDownloadOptions)}
                                        disabled={isLoading}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download
                                    </button>

                                    {showDownloadOptions && (
                                        <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-10 animate-in slide-in-from-bottom-2 duration-200">
                                            <button
                                                onClick={() => { downloadQR(); setShowDownloadOptions(false); }}
                                                className="w-full px-4 py-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50"
                                            >
                                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                Download as JPG
                                            </button>
                                            <button
                                                onClick={downloadPDF}
                                                className="w-full px-4 py-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                            >
                                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                                Save as PDF (Print)
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <button
                                    onClick={() => generateSession(qrType)}
                                    disabled={isLoading}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                    Regenerate
                                </button>
                            )}
                            <button
                                onClick={handleCopy}
                                className="flex-1 bg-white border-2 border-slate-200 hover:border-red-200 text-slate-700 hover:text-red-600 font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                            >
                                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                    </div>

                    {/* Right: How it works */}
                    <div className="p-6 lg:p-8">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">How It Works</h3>
                        <p className="text-sm text-slate-500 mb-6">Show QR to customers. They scan, rate, and spin for rewards.</p>

                        <div className="space-y-4">
                            {[
                                { icon: Smartphone, title: 'Scan QR Code', text: 'Customer scans with mobile device', bg: 'bg-blue-50', fg: 'text-blue-600' },
                                { icon: Users, title: 'Enter Details', text: 'Provide phone for verification', bg: 'bg-indigo-50', fg: 'text-indigo-600' },
                                { icon: CheckCircle2, title: 'Rate Branch', text: 'Leave a Google Maps review', bg: 'bg-emerald-50', fg: 'text-emerald-600' },
                                { icon: ExternalLink, title: 'Win Reward', text: 'Spin wheel for voucher prizes', bg: 'bg-amber-50', fg: 'text-amber-600' },
                            ].map((step, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className={`w-9 h-9 ${step.bg} rounded-lg flex items-center justify-center shrink-0`}>
                                        <step.icon className={`w-4 h-4 ${step.fg}`} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-900">{step.title}</h4>
                                        <p className="text-xs text-slate-500">{step.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {error && (
                            <div className="mt-6 bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-red-700">{error}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Talabat Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-white" />
                    <div>
                        <h3 className="text-base font-bold text-white">Talabat Customers</h3>
                        <p className="text-white/70 text-xs">Send personalized delivery notifications with rewards</p>
                    </div>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Send Card */}
                        <div className="bg-slate-50 rounded-xl border border-slate-100 p-5 space-y-4">
                            <h4 className="text-sm font-bold text-slate-900">Send to Customer</h4>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Country Code</label>
                                <input type="text" id="talabat-country-code" defaultValue="973" className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Phone Number</label>
                                <input type="tel" id="talabat-phone" placeholder="33XXXXXX" className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all" />
                            </div>
                            <button
                                onClick={() => {
                                    const countryCode = (document.getElementById('talabat-country-code') as HTMLInputElement)?.value || '973';
                                    const phone = (document.getElementById('talabat-phone') as HTMLInputElement)?.value;
                                    if (!phone) { alert('Please enter customer phone number'); return; }
                                    const fullPhone = `${countryCode}${phone}`;
                                    const message = `${talabatMessage}\n\n Click here to play:\n${talabatUrl}`;
                                    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
                                }}
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <Send className="w-4 h-4" />
                                Send via WhatsApp
                            </button>
                            {qrType !== 'static' ? (
                                <button
                                    onClick={() => generateSession(qrType)}
                                    disabled={isLoading}
                                    className="w-full bg-white border border-orange-200 text-orange-600 hover:bg-orange-50 font-bold py-2 rounded-lg text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                                >
                                    <RefreshCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                                    Regenerate Session Link
                                </button>
                            ) : (
                                <div className="bg-orange-50 text-orange-700 p-2 rounded-lg text-[10px] font-medium text-center">
                                    Using Static Branch Link
                                </div>
                            )}
                        </div>

                        {/* Message Template */}
                        <div className="bg-slate-50 rounded-xl border border-slate-100 p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-slate-900">Message Template</h4>
                                <button onClick={() => setTalabatMessage(defaultTalabatMsg)} className="text-xs font-bold text-orange-600 hover:text-orange-700">Reset</button>
                            </div>
                            <textarea
                                value={talabatMessage}
                                onChange={(e) => setTalabatMessage(e.target.value)}
                                rows={10}
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm leading-relaxed outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all resize-none"
                            />
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>Link added automatically</span>
                                <span>{talabatMessage.length} chars</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* WhatsApp Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-4 flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-white" />
                    <div>
                        <h3 className="text-base font-bold text-white">WhatsApp Customers</h3>
                        <p className="text-white/70 text-xs">Share rewards campaign with your contacts</p>
                    </div>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Quick Share */}
                        <div className="bg-slate-50 rounded-xl border border-slate-100 p-5 space-y-4">
                            <h4 className="text-sm font-bold text-slate-900">Quick Share</h4>
                            <button
                                onClick={() => {
                                    const message = `${whatsappMessage}\n\n Click here to play:\n${customerUrl}`;
                                    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                                }}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <MessageCircle className="w-5 h-5" />
                                Share via WhatsApp
                            </button>
                            {qrType !== 'static' ? (
                                <button
                                    onClick={() => generateSession(qrType)}
                                    disabled={isLoading}
                                    className="w-full bg-white border border-green-200 text-green-600 hover:bg-green-50 font-bold py-2 rounded-lg text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                                >
                                    <RefreshCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                                    Regenerate Session Link
                                </button>
                            ) : (
                                <div className="bg-green-50 text-green-700 p-2 rounded-lg text-[10px] font-medium text-center">
                                    Using Static Branch Link
                                </div>
                            )}
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                                <p className="text-xs text-blue-700">Opens WhatsApp with your message pre-filled. Select contacts to share.</p>
                            </div>
                        </div>

                        {/* Message Template */}
                        <div className="bg-slate-50 rounded-xl border border-slate-100 p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-slate-900">Message Template</h4>
                                <button onClick={() => setWhatsappMessage(defaultWhatsappMsg)} className="text-xs font-bold text-green-600 hover:text-green-700">Reset</button>
                            </div>
                            <textarea
                                value={whatsappMessage}
                                onChange={(e) => setWhatsappMessage(e.target.value)}
                                rows={7}
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm leading-relaxed outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all resize-none"
                            />
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>Link added automatically</span>
                                <span>{whatsappMessage.length} chars</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
