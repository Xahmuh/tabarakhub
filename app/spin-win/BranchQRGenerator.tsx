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
    Download,
    Gift,
    Link2,
    MapPin,
    Phone,
    Share2,
    ShieldCheck
} from 'lucide-react';

import { NETWORK_CONFIG } from '../../lib/networkConfig';

interface BranchQRGeneratorProps {
    branch: Branch;
    onBack: () => void;
}

const escapeHtml = (value: string | number | null | undefined) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

const getPrintableCustomerUrl = (url: string) => url.length > 88 ? `${url.slice(0, 85)}...` : url;

const getQrPrintImageDataUrl = async (qrElement: HTMLDivElement) => {
    const qrSvg = qrElement.querySelector('svg');
    if (qrSvg) {
        const clone = qrSvg.cloneNode(true) as SVGSVGElement;
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('width', '720');
        clone.setAttribute('height', '720');
        clone.setAttribute('shape-rendering', 'crispEdges');
        clone.removeAttribute('class');

        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
    }

    return toPng(qrElement, {
        cacheBust: true,
        pixelRatio: 4,
        backgroundColor: '#ffffff',
    });
};

const buildSpinWinPosterHtml = ({
    branchName,
    branchCode,
    generatedAt,
    modeLabel,
    printableUrl,
    qrDataUrl,
}: {
    branchName: string;
    branchCode: string;
    generatedAt: string;
    modeLabel: string;
    printableUrl: string;
    qrDataUrl: string;
}) => `
    <!doctype html>
    <html>
        <head>
            <title>Spin &amp; Win Poster - ${branchName}</title>
            <meta charset="utf-8" />
            <style>
                @page {
                    size: A4;
                    margin: 0;
                }

                * {
                    box-sizing: border-box;
                }

                html,
                body {
                    width: 210mm;
                    min-height: 297mm;
                    margin: 0;
                    background: #111827;
                    color: #0f172a;
                    font-family: Inter, Arial, Helvetica, sans-serif;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                .sheet {
                    position: relative;
                    width: 210mm;
                    height: 297mm;
                    overflow: hidden;
                    background: #ffffff;
                }

                .hero {
                    position: relative;
                    height: 116mm;
                    padding: 17mm 18mm 0;
                    overflow: hidden;
                    background:
                        linear-gradient(135deg, #7f1d1d 0%, #b91c1c 46%, #ef4444 100%);
                    color: #ffffff;
                }

                .hero::after {
                    content: "";
                    position: absolute;
                    inset: auto -22mm -42mm auto;
                    width: 104mm;
                    height: 104mm;
                    border-radius: 999px;
                    background: conic-gradient(from -20deg, #fef3c7 0 16%, #dc2626 16% 32%, #f59e0b 32% 48%, #fef3c7 48% 64%, #dc2626 64% 80%, #f59e0b 80% 100%);
                    border: 5mm solid rgba(255, 255, 255, 0.2);
                    opacity: 0.24;
                }

                .brand-row {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10mm;
                }

                .brand {
                    display: flex;
                    align-items: center;
                    gap: 4mm;
                    font-size: 10pt;
                    font-weight: 900;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                }

                .brand-mark {
                    display: grid;
                    width: 13mm;
                    height: 13mm;
                    place-items: center;
                    border-radius: 3mm;
                    background: #ffffff;
                    color: #b91c1c;
                    font-size: 16pt;
                    font-weight: 900;
                    line-height: 1;
                }

                .branch-pill {
                    max-width: 74mm;
                    border: 0.3mm solid rgba(255, 255, 255, 0.34);
                    border-radius: 999px;
                    padding: 2.6mm 4mm;
                    background: rgba(255, 255, 255, 0.13);
                    font-size: 8.5pt;
                    font-weight: 800;
                    letter-spacing: 0.08em;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    text-transform: uppercase;
                    white-space: nowrap;
                }

                .headline {
                    position: relative;
                    z-index: 2;
                    max-width: 132mm;
                    margin-top: 21mm;
                }

                .eyebrow {
                    margin: 0 0 4mm;
                    font-size: 8pt;
                    font-weight: 900;
                    letter-spacing: 0.26em;
                    opacity: 0.72;
                    text-transform: uppercase;
                }

                h1 {
                    margin: 0;
                    font-size: 39pt;
                    font-weight: 950;
                    letter-spacing: 0;
                    line-height: 0.95;
                }

                .subtitle {
                    max-width: 112mm;
                    margin: 5mm 0 0;
                    color: rgba(255, 255, 255, 0.82);
                    font-size: 13pt;
                    font-weight: 700;
                    line-height: 1.35;
                }

                .content {
                    position: relative;
                    z-index: 5;
                    padding: 0 18mm 15mm;
                }

                .qr-card {
                    display: grid;
                    grid-template-columns: 1fr 60mm;
                    gap: 11mm;
                    align-items: center;
                    min-height: 94mm;
                    margin-top: -28mm;
                    border: 0.35mm solid #fee2e2;
                    border-radius: 7mm;
                    padding: 10mm;
                    background: #ffffff;
                    box-shadow: 0 8mm 24mm rgba(127, 29, 29, 0.18);
                }

                .scan-copy {
                    min-width: 0;
                }

                .scan-label {
                    display: inline-flex;
                    align-items: center;
                    gap: 2mm;
                    border-radius: 999px;
                    padding: 2mm 3.5mm;
                    background: #fef2f2;
                    color: #991b1b;
                    font-size: 8pt;
                    font-weight: 900;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                }

                h2 {
                    margin: 5mm 0 0;
                    color: #111827;
                    font-size: 25pt;
                    font-weight: 950;
                    letter-spacing: 0;
                    line-height: 1;
                }

                .scan-description {
                    margin: 4mm 0 0;
                    color: #475569;
                    font-size: 10.5pt;
                    font-weight: 600;
                    line-height: 1.5;
                }

                .mode-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 2.5mm;
                    margin-top: 6mm;
                }

                .mode-chip {
                    border-radius: 999px;
                    padding: 2.2mm 3.3mm;
                    background: #0f172a;
                    color: #ffffff;
                    font-size: 8pt;
                    font-weight: 850;
                }

                .mode-chip.secondary {
                    background: #f1f5f9;
                    color: #334155;
                }

                .qr-frame {
                    display: grid;
                    place-items: center;
                    border: 0.55mm solid #111827;
                    border-radius: 6mm;
                    padding: 4mm;
                    background: #ffffff;
                }

                .qr-frame img {
                    display: block;
                    width: 52mm;
                    height: 52mm;
                    object-fit: contain;
                }

                .url-box {
                    margin-top: 5mm;
                    border: 0.3mm dashed #cbd5e1;
                    border-radius: 3mm;
                    padding: 3mm;
                    background: #f8fafc;
                    color: #475569;
                    font-size: 7pt;
                    font-weight: 700;
                    line-height: 1.35;
                    overflow-wrap: anywhere;
                }

                .steps {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 3mm;
                    margin-top: 8mm;
                }

                .step {
                    min-height: 31mm;
                    border: 0.3mm solid #e2e8f0;
                    border-radius: 4mm;
                    padding: 4mm;
                    background: #ffffff;
                }

                .step-number {
                    display: grid;
                    width: 8mm;
                    height: 8mm;
                    place-items: center;
                    border-radius: 999px;
                    background: #dc2626;
                    color: #ffffff;
                    font-size: 8pt;
                    font-weight: 950;
                }

                .step-title {
                    margin: 3mm 0 0;
                    color: #111827;
                    font-size: 9pt;
                    font-weight: 900;
                }

                .step-text {
                    margin: 1.5mm 0 0;
                    color: #64748b;
                    font-size: 7.3pt;
                    font-weight: 650;
                    line-height: 1.35;
                }

                .footer {
                    position: absolute;
                    right: 18mm;
                    bottom: 12mm;
                    left: 18mm;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8mm;
                    border-top: 0.35mm solid #e2e8f0;
                    padding-top: 5mm;
                    color: #64748b;
                    font-size: 7.5pt;
                    font-weight: 750;
                }

                .footer strong {
                    color: #b91c1c;
                    font-size: 12pt;
                    letter-spacing: 0.08em;
                }

                .print-note {
                    text-align: right;
                }
            </style>
        </head>
        <body>
            <main class="sheet">
                <section class="hero">
                    <div class="brand-row">
                        <div class="brand">
                            <div class="brand-mark">T</div>
                            <span>Tabarak Pharmacy</span>
                        </div>
                        <div class="branch-pill">${branchName}${branchCode ? ` / ${branchCode}` : ''}</div>
                    </div>

                    <div class="headline">
                        <p class="eyebrow">Customer rewards</p>
                        <h1>Spin &amp; Win</h1>
                        <p class="subtitle">Scan the QR code, rate your branch experience, spin the wheel, and claim your reward voucher.</p>
                    </div>
                </section>

                <section class="content">
                    <div class="qr-card">
                        <div class="scan-copy">
                            <span class="scan-label">Scan here</span>
                            <h2>Your reward starts here</h2>
                            <p class="scan-description">Open the campaign on your phone and complete the steps during your visit.</p>
                            <div class="mode-row">
                                <span class="mode-chip">${modeLabel}</span>
                                <span class="mode-chip secondary">Branch scoped</span>
                            </div>
                            <div class="url-box">${printableUrl}</div>
                        </div>
                        <div class="qr-frame">
                            <img src="${qrDataUrl}" alt="Spin and Win QR code" id="qrImg" />
                        </div>
                    </div>

                    <div class="steps">
                        <div class="step">
                            <div class="step-number">1</div>
                            <p class="step-title">Scan</p>
                            <p class="step-text">Open the branch reward link from this QR.</p>
                        </div>
                        <div class="step">
                            <div class="step-number">2</div>
                            <p class="step-title">Rate</p>
                            <p class="step-text">Share quick feedback for the branch experience.</p>
                        </div>
                        <div class="step">
                            <div class="step-number">3</div>
                            <p class="step-title">Spin</p>
                            <p class="step-text">Spin the wheel once the flow is ready.</p>
                        </div>
                        <div class="step">
                            <div class="step-number">4</div>
                            <p class="step-title">Redeem</p>
                            <p class="step-text">Use the voucher in branch or through WhatsApp.</p>
                        </div>
                    </div>
                </section>

                <footer class="footer">
                    <strong>HUB</strong>
                    <span>${branchName}${branchCode ? ` - ${branchCode}` : ''}</span>
                    <span class="print-note">Generated ${generatedAt}</span>
                </footer>
            </main>
            <script>
                let printed = false;
                function startPrint() {
                    if (printed) return;
                    printed = true;
                    setTimeout(function () {
                        window.focus();
                        window.print();
                    }, 350);
                }

                window.addEventListener('afterprint', function () {
                    setTimeout(function () {
                        window.close();
                    }, 250);
                });

                window.addEventListener('load', function () {
                    var images = Array.prototype.slice.call(document.images || []);
                    if (!images.length) {
                        startPrint();
                        return;
                    }
                    Promise.all(images.map(function (img) {
                        if (img.complete) return Promise.resolve();
                        return new Promise(function (resolve) {
                            img.onload = resolve;
                            img.onerror = resolve;
                        });
                    })).then(startPrint);
                });

                setTimeout(startPrint, 2500);
            </script>
        </body>
    </html>
`;

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
            const qrDataUrl = await getQrPrintImageDataUrl(qrRef.current);

            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                setError('Could not open the PDF print window. Please allow pop-ups for this site.');
                return;
            }

            const posterHtml = buildSpinWinPosterHtml({
                branchName: escapeHtml(branch.name || 'Branch'),
                branchCode: escapeHtml(branch.code || ''),
                generatedAt: escapeHtml(new Date().toLocaleString()),
                modeLabel: escapeHtml(qrType === 'static' ? 'Permanent branch QR' : qrType === 'multi' ? 'Multi-use campaign' : 'Single customer session'),
                printableUrl: escapeHtml(getPrintableCustomerUrl(customerUrl)),
                qrDataUrl,
            });

            printWindow.document.open();
            printWindow.document.write(posterHtml);
            printWindow.document.close();
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

    const isQrReady = Boolean(session || qrType === 'static');
    const daysLeft = Math.max(1, Math.ceil(timeLeft / (24 * 3600)));
    const expiryLabel = qrType === 'static'
        ? 'Static link - no expiry'
        : qrType === 'multi'
            ? `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
            : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')} remaining`;
    const qrStatusLabel = isQrReady
        ? qrType === 'static' ? 'Permanent branch QR' : 'Session active'
        : 'Waiting for a generated session';
    const branchDisplayName = branch.code ? `${branch.name} - ${branch.code}` : branch.name;
    const currentModeLabel = qrType === 'static'
        ? 'Counter display'
        : qrType === 'multi'
            ? 'Campaign sharing'
            : 'One customer handoff';
    const modeOptions: Array<{
        id: 'static' | 'single' | 'multi';
        title: string;
        description: string;
        meta: string;
        icon: React.ComponentType<{ className?: string }>;
    }> = [
        {
            id: 'static',
            title: 'Static branch QR',
            description: 'Best for counter displays, printed posters, and branch-owned QR assets.',
            meta: 'Never expires',
            icon: QrCode
        },
        {
            id: 'single',
            title: 'Single customer',
            description: 'Short session for a direct customer handoff at the branch.',
            meta: '10 minutes',
            icon: ShieldCheck
        },
        {
            id: 'multi',
            title: 'Multi-use campaign',
            description: 'Reusable campaign link for controlled sharing during an active push.',
            meta: '7 days',
            icon: Share2
        }
    ];
    const journeySteps = [
        { icon: Smartphone, title: 'Scan or open', text: 'Customer reaches the branch reward flow from the QR or link.' },
        { icon: Users, title: 'Identify customer', text: 'Phone details are captured before reward generation.' },
        { icon: CheckCircle2, title: 'Rate branch', text: 'Customer can be guided to the branch review step.' },
        { icon: Gift, title: 'Spin and redeem', text: 'Voucher outcome is tied back to this branch session.' }
    ];

    if (isLocked) {
        return (
            <div className="mx-auto max-w-3xl p-4 md:p-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <section className="operational-panel p-6 text-center md:p-8">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <Lock className="h-8 w-8" />
                    </div>
                    <h2 className="mb-2 text-2xl font-black text-slate-950">Customer engagement is locked</h2>
                    <p className="mx-auto mb-6 max-w-md text-sm leading-6 text-slate-500">
                        QR generation and campaign links are currently restricted by management for this branch.
                    </p>
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-4 py-2 text-xs font-bold text-red-700">
                        <Activity className="h-3.5 w-3.5" />
                        Inactive
                    </div>
                    <button onClick={onBack} className="btn-primary mx-auto w-full max-w-xs">
                        Return to Suite
                    </button>
                </section>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <button onClick={onBack} className="btn-secondary w-fit">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Spin & Win Suite
                </button>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {qrStatusLabel}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">
                        <MapPin className="h-3.5 w-3.5 text-red-600" />
                        {branchDisplayName}
                    </span>
                </div>
            </div>

            <section className="operational-panel overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
                    <div className="border-b border-slate-200 p-5 md:p-6 lg:border-b-0 lg:border-r lg:p-8">
                        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
                                    <QrCode className="h-3.5 w-3.5" />
                                    Generate QR code and link
                                </div>
                                <h2 className="text-3xl font-black text-slate-950 md:text-4xl">Customer Engagement Generator</h2>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                                    Create branch-safe QR codes, copy customer links, and send reward messages without exposing internal keys or branch IDs.
                                </p>
                            </div>
                            <div className="grid min-w-[190px] grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                                <div className="rounded-md bg-white p-3">
                                    <p className="font-bold text-slate-400">Mode</p>
                                    <p className="mt-1 font-black text-slate-900">{currentModeLabel}</p>
                                </div>
                                <div className="rounded-md bg-white p-3">
                                    <p className="font-bold text-slate-400">Validity</p>
                                    <p className="mt-1 font-black text-slate-900">{qrType === 'static' ? 'Always on' : qrType === 'multi' ? '7 days' : '10 min'}</p>
                                </div>
                            </div>
                        </div>

                        {isLocalhost && (
                            <div className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                                <Activity className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                                <p className="text-sm font-medium leading-6 text-emerald-800">
                                    Local QR links are routed through <span className="font-black">{NETWORK_CONFIG.localIp}:{NETWORK_CONFIG.port}</span> so mobile devices can open the branch flow during testing.
                                </p>
                            </div>
                        )}

                        <div className="grid gap-3 md:grid-cols-3">
                            {modeOptions.map((option) => {
                                const Icon = option.icon;
                                const isActive = qrType === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => setQrType(option.id)}
                                        className={`flex min-h-[168px] flex-col justify-between rounded-lg border p-4 text-left transition-colors active:scale-[0.99] ${isActive
                                            ? 'border-red-200 bg-red-50 text-red-950 shadow-sm'
                                            : 'border-slate-200 bg-white text-slate-700 hover:border-red-100 hover:bg-red-50/40'
                                            }`}
                                    >
                                        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${isActive ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            <Icon className="h-5 w-5" />
                                        </span>
                                        <span>
                                            <span className="block text-sm font-black">{option.title}</span>
                                            <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
                                        </span>
                                        <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold ${isActive ? 'bg-white text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {option.meta}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {error && (
                            <div className="mt-5 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}
                    </div>

                    <aside className="bg-slate-50/70 p-5 md:p-6 lg:p-8">
                        <div className="flex h-full flex-col items-center text-center">
                            <div className="mb-4 flex w-full items-center justify-between gap-3 text-left">
                                <div>
                                    <p className="text-xs font-bold text-slate-400">Customer link</p>
                                    <h3 className="text-lg font-black text-slate-950">Ready to share</h3>
                                </div>
                                <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${isQrReady ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {isQrReady ? 'Live' : 'Not ready'}
                                </span>
                            </div>

                            <div
                                ref={qrRef}
                                className={`flex aspect-square w-full max-w-[260px] items-center justify-center rounded-lg border bg-white p-5 transition-all ${isQrReady
                                    ? 'border-slate-200 shadow-sm'
                                    : 'border-slate-200 opacity-40 grayscale'
                                    }`}
                            >
                                {isQrReady ? (
                                    <QRCodeSVG value={customerUrl} size={240} level="H" includeMargin={false} className="h-full w-full" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center rounded-md bg-slate-50">
                                        <QrCode className="h-16 w-16 text-slate-300" />
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex w-full flex-wrap items-center justify-center gap-2">
                                <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
                                    <Clock className="h-3.5 w-3.5 text-red-300" />
                                    {expiryLabel}
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">
                                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                    Branch scoped
                                </span>
                            </div>

                            <div className="mt-4 w-full rounded-lg border border-slate-200 bg-white p-3 text-left">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                        <Link2 className="h-3.5 w-3.5 text-red-600" />
                                        Generated customer URL
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">{qrType}</span>
                                </div>
                                <code className="block break-all text-xs leading-5 text-slate-700">{customerUrl}</code>
                            </div>

                            <div className="relative mt-4 grid w-full grid-cols-2 gap-2">
                                {qrType === 'static' ? (
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowDownloadOptions(!showDownloadOptions)}
                                            disabled={isLoading}
                                            className="btn-primary w-full"
                                        >
                                            <Download className="h-4 w-4" />
                                            Download
                                        </button>

                                        {showDownloadOptions && (
                                            <div className="absolute bottom-full left-0 z-10 mb-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl animate-in slide-in-from-bottom-2 duration-200">
                                                <button
                                                    onClick={() => { downloadQR(); setShowDownloadOptions(false); }}
                                                    className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
                                                >
                                                    <Download className="h-3.5 w-3.5 text-red-600" />
                                                    Download JPG
                                                </button>
                                                <button
                                                    onClick={downloadPDF}
                                                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
                                                >
                                                    <Download className="h-3.5 w-3.5 text-slate-700" />
                                                    Print PDF
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => generateSession(qrType)}
                                        disabled={isLoading}
                                        className="btn-primary w-full"
                                    >
                                        <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                        Regenerate
                                    </button>
                                )}
                                <button onClick={handleCopy} className="btn-secondary w-full">
                                    {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                        </div>
                    </aside>
                </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <section className="operational-panel p-5 md:p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-bold text-slate-400">Customer journey</p>
                            <h3 className="text-xl font-black text-slate-950">What happens after the scan</h3>
                        </div>
                        <div className="rounded-lg bg-red-50 p-3 text-red-700">
                            <Gift className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {journeySteps.map((step, index) => {
                            const Icon = step.icon;
                            return (
                                <div key={step.title} className="rounded-lg border border-slate-200 bg-white p-4">
                                    <div className="mb-3 flex items-center gap-3">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-xs font-black text-slate-600">
                                            {index + 1}
                                        </span>
                                        <Icon className="h-4 w-4 text-red-600" />
                                    </div>
                                    <h4 className="text-sm font-black text-slate-950">{step.title}</h4>
                                    <p className="mt-1 text-xs leading-5 text-slate-500">{step.text}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className="operational-panel p-5 md:p-6">
                    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400">Link variants</p>
                            <h3 className="text-xl font-black text-slate-950">Use the right link for the channel</h3>
                        </div>
                        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Same branch scope
                        </span>
                    </div>
                    <div className="space-y-3">
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                            <div className="mb-2 flex items-center gap-2 text-sm font-black text-slate-950">
                                <Link2 className="h-4 w-4 text-red-600" />
                                Standard customer link
                            </div>
                            <code className="block break-all text-xs leading-5 text-slate-600">{customerUrl}</code>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                            <div className="mb-2 flex items-center gap-2 text-sm font-black text-slate-950">
                                <Smartphone className="h-4 w-4 text-orange-600" />
                                Talabat delivery link
                            </div>
                            <code className="block break-all text-xs leading-5 text-slate-600">{talabatUrl}</code>
                        </div>
                    </div>
                </section>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                <section className="operational-panel overflow-hidden">
                    <div className="border-b border-slate-200 bg-orange-50 px-5 py-4 md:px-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-600 text-white">
                                <Phone className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-950">Talabat customer send</h3>
                                <p className="text-sm text-slate-600">Send the delivery reward link to a specific customer number.</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4 p-5 md:p-6">
                        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                            <div>
                                <label className="mb-1 block text-xs font-bold text-slate-500">Country code</label>
                                <input type="text" id="talabat-country-code" defaultValue="973" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold text-slate-500">Phone number</label>
                                <input type="tel" id="talabat-phone" placeholder="33XXXXXX" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                            </div>
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
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-orange-600 bg-orange-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-700"
                        >
                            <Send className="h-4 w-4" />
                            Send via WhatsApp
                        </button>
                        {qrType !== 'static' ? (
                            <button
                                onClick={() => generateSession(qrType)}
                                disabled={isLoading}
                                className="flex w-full items-center justify-center gap-2 rounded-lg border border-orange-200 bg-white px-4 py-2.5 text-xs font-bold text-orange-700 transition-colors hover:bg-orange-50 disabled:opacity-40"
                            >
                                <RefreshCcw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                                Regenerate session link
                            </button>
                        ) : (
                            <div className="rounded-lg border border-orange-100 bg-orange-50 p-3 text-center text-xs font-bold text-orange-700">
                                Using static branch link
                            </div>
                        )}
                        <div>
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <label className="text-xs font-bold text-slate-500">Message template</label>
                                <button onClick={() => setTalabatMessage(defaultTalabatMsg)} className="text-xs font-bold text-orange-700 hover:text-orange-800">Reset</button>
                            </div>
                            <textarea
                                value={talabatMessage}
                                onChange={(e) => setTalabatMessage(e.target.value)}
                                rows={9}
                                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                            />
                            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                                <span>Link is appended automatically</span>
                                <span>{talabatMessage.length} chars</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="operational-panel overflow-hidden">
                    <div className="border-b border-slate-200 bg-emerald-50 px-5 py-4 md:px-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                                <MessageCircle className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-950">WhatsApp campaign share</h3>
                                <p className="text-sm text-slate-600">Open WhatsApp with the current reward message and link.</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4 p-5 md:p-6">
                        <button
                            onClick={() => {
                                const message = `${whatsappMessage}\n\n Click here to play:\n${customerUrl}`;
                                window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-4 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
                        >
                            <MessageCircle className="h-5 w-5" />
                            Share via WhatsApp
                        </button>
                        {qrType !== 'static' ? (
                            <button
                                onClick={() => generateSession(qrType)}
                                disabled={isLoading}
                                className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-40"
                            >
                                <RefreshCcw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                                Regenerate session link
                            </button>
                        ) : (
                            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-center text-xs font-bold text-emerald-700">
                                Using static branch link
                            </div>
                        )}
                        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-800">
                            WhatsApp opens with the message pre-filled. The branch team still selects the final recipients.
                        </div>
                        <div>
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <label className="text-xs font-bold text-slate-500">Message template</label>
                                <button onClick={() => setWhatsappMessage(defaultWhatsappMsg)} className="text-xs font-bold text-emerald-700 hover:text-emerald-800">Reset</button>
                            </div>
                            <textarea
                                value={whatsappMessage}
                                onChange={(e) => setWhatsappMessage(e.target.value)}
                                rows={9}
                                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            />
                            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                                <span>Link is appended automatically</span>
                                <span>{whatsappMessage.length} chars</span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};
