import React, { useState, useEffect, useRef } from 'react';
import { clientConfig } from '../../config/clientConfig';

interface Prize {
    id: string;
    name: string;
    color: string;
}

interface SpinnerProps {
    prizes: Prize[];
    winner?: Prize | null;
    onFinish: (prize: Prize) => void;
    isSpinning: boolean;
}

const fallbackColors = [
    '#B91c1c',
    '#0891b2',
    '#f59e0b',
    '#059669',
    '#7c3aed',
    '#dc2626',
    '#0f766e',
    '#ea580c'
];

const normalizeHex = (value: string | undefined, fallback: string) => {
    const raw = (value || fallback).trim();
    const hex = raw.startsWith('#') ? raw.slice(1) : raw;
    const expanded = hex.length === 3
        ? hex.split('').map(char => char + char).join('')
        : hex;

    return /^[0-9a-fA-F]{6}$/.test(expanded) ? `#${expanded}` : fallback;
};

const adjustHexColor = (value: string, amount: number) => {
    const hex = normalizeHex(value, '#B91c1c').slice(1);
    const channels = [0, 2, 4].map(index => {
        const next = parseInt(hex.slice(index, index + 2), 16) + amount;
        return Math.max(0, Math.min(255, next)).toString(16).padStart(2, '0');
    });
    return `#${channels.join('')}`;
};

const splitPrizeName = (name: string) => {
    let highlight = '';
    let detail = '';

    if (/(\d+%\s*Off)/i.test(name)) {
        const match = name.match(/^(\d+%\s*Off)\s*(.*)/i);
        if (match) {
            highlight = match[1].toUpperCase();
            detail = match[2];
        }
    } else if (/^\d+(\s?BD)?/.test(name) && name.includes('BD')) {
        const match = name.match(/^(\d+\s?BD)\s*(.*)/);
        if (match) {
            highlight = match[1];
            detail = match[2];
        }
    } else if (/^Free/i.test(name)) {
        const match = name.match(/^(Free)\s*(.*)/i);
        if (match) {
            highlight = match[1].toUpperCase();
            detail = match[2];
        }
    } else {
        const parts = name.split(' ');
        highlight = parts[0] || name;
        detail = parts.slice(1).join(' ');
    }

    return {
        highlight: highlight.trim().slice(0, 12),
        detail: detail.trim().slice(0, 18)
    };
};

export const Spinner: React.FC<SpinnerProps> = ({ prizes, winner, onFinish, isSpinning }) => {
    const [rotation, setRotation] = useState(0);
    const [settledPrizeId, setSettledPrizeId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const settleTimerRef = useRef<number | null>(null);
    const finishTimerRef = useRef<number | null>(null);

    const segments = prizes.length > 0 ? prizes : [
        { id: '1', name: 'Loading...', color: '#cbd5e1' },
        { id: '2', name: 'Please Wait', color: '#94a3b8' }
    ];

    useEffect(() => {
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
        audioRef.current.volume = 0.35;
    }, []);

    useEffect(() => {
        return () => {
            if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
            if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (!isSpinning || !winner) return;

        if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
        if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
        setSettledPrizeId(null);

        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => { });
        }

        const winnerIndex = segments.findIndex(p => p.id === winner.id);
        const safeWinnerIndex = winnerIndex >= 0 ? winnerIndex : 0;
        const prizeCount = segments.length;
        const sliceAngle = 360 / prizeCount;
        const extraSpins = 6 * 360;
        const centerAngle = (safeWinnerIndex + 0.5) * sliceAngle;
        const targetRotation = 270 - centerAngle + extraSpins;

        const currentMod = rotation % 360;
        const targetMod = targetRotation % 360;
        let diff = targetMod - currentMod;
        if (diff < 0) diff += 360;

        const finalRotation = rotation + diff + extraSpins;
        setRotation(finalRotation);

        settleTimerRef.current = window.setTimeout(() => {
            setSettledPrizeId(winner.id);
        }, 4650);

        finishTimerRef.current = window.setTimeout(() => {
            onFinish(winner);
        }, 5350);
    }, [isSpinning, winner]);

    const getCoordinates = (percent: number, radius: number) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x * radius, y * radius];
    };

    return (
        <div className="relative mx-auto w-full max-w-[480px] px-3 py-5">
            <div className={`spin-wheel-stage relative aspect-square ${isSpinning ? 'is-spinning' : ''}`}>
                <div className="absolute inset-[5%] translate-y-[8%] rounded-full bg-slate-950/25 blur-2xl"></div>

                <div className="spin-wheel-frame absolute inset-0 rounded-full">
                    <div className="spin-wheel-rim absolute inset-[1.5%] rounded-full"></div>
                    <div className="spin-wheel-rim-gloss absolute inset-[1.5%] rounded-full"></div>

                    {Array.from({ length: 36 }).map((_, i) => {
                        const angle = (i / 36) * 360;
                        const rad = (angle * Math.PI) / 180;
                        const radius = 49;
                        const x = 50 + radius * Math.cos(rad);
                        const y = 50 + radius * Math.sin(rad);

                        return (
                            <span
                                key={i}
                                className="spin-wheel-bulb absolute h-2.5 w-2.5 rounded-full"
                                style={{
                                    left: `${x}%`,
                                    top: `${y}%`,
                                    transform: 'translate(-50%, -50%)',
                                    animationDelay: `${i * 0.065}s`
                                }}
                            />
                        );
                    })}

                    <div className="absolute inset-[8.5%] rounded-full bg-white shadow-[inset_0_8px_18px_rgba(15,23,42,0.18)]"></div>

                    <svg
                        viewBox="-100 -100 200 200"
                        className="absolute inset-[9.5%] z-[5] h-[81%] w-[81%] drop-shadow-xl"
                        style={{
                            transform: `rotate(${rotation}deg)`,
                            transition: isSpinning ? 'transform 5.1s cubic-bezier(0.12, 0.72, 0.08, 1)' : 'none',
                            willChange: 'transform'
                        }}
                    >
                        <defs>
                            <filter id="real-wheel-shadow" x="-30%" y="-30%" width="160%" height="160%">
                                <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#0f172a" floodOpacity="0.24" />
                            </filter>
                            <radialGradient id="wheel-center-gloss" cx="35%" cy="25%" r="75%">
                                <stop offset="0%" stopColor="rgba(255,255,255,0.46)" />
                                <stop offset="50%" stopColor="rgba(255,255,255,0.08)" />
                                <stop offset="100%" stopColor="rgba(15,23,42,0.18)" />
                            </radialGradient>
                            {segments.map((prize, i) => {
                                const base = normalizeHex(prize.color, fallbackColors[i % fallbackColors.length]);
                                const light = adjustHexColor(base, 26);
                                const dark = adjustHexColor(base, -34);
                                return (
                                    <linearGradient key={prize.id} id={`segment-gradient-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor={light} />
                                        <stop offset="48%" stopColor={base} />
                                        <stop offset="100%" stopColor={dark} />
                                    </linearGradient>
                                );
                            })}
                        </defs>

                        <g filter="url(#real-wheel-shadow)">
                            {segments.map((prize, i) => {
                                const count = segments.length;
                                const sliceAngle = 360 / count;
                                const startAngle = i * sliceAngle;
                                const endAngle = (i + 1) * sliceAngle;
                                const startPercent = startAngle / 360;
                                const endPercent = endAngle / 360;
                                const [startX, startY] = getCoordinates(startPercent, 92);
                                const [endX, endY] = getCoordinates(endPercent, 92);
                                const largeArcFlag = sliceAngle > 180 ? 1 : 0;
                                const pathData = [
                                    'M 0 0',
                                    `L ${startX} ${startY}`,
                                    `A 92 92 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                                    'Z'
                                ].join(' ');

                                const midAngle = startAngle + sliceAngle / 2;
                                const shouldFlipText = midAngle > 90 && midAngle < 270;
                                const textRadius = 57;
                                const { highlight, detail } = splitPrizeName(prize.name);
                                const isWinnerSettled = settledPrizeId === prize.id;

                                return (
                                    <g key={prize.id} className={isWinnerSettled ? 'spin-wheel-winner-segment' : undefined}>
                                        <path
                                            d={pathData}
                                            fill={`url(#segment-gradient-${i})`}
                                            stroke="rgba(255,255,255,0.78)"
                                            strokeWidth="1.4"
                                        />
                                        <path d={pathData} fill="url(#wheel-center-gloss)" opacity="0.44" />
                                        {isWinnerSettled && (
                                            <path
                                                d={pathData}
                                                fill="none"
                                                stroke="#fbbf24"
                                                strokeWidth="3"
                                                opacity="0.95"
                                            />
                                        )}
                                        <g transform={`rotate(${midAngle}) translate(${textRadius} 0) rotate(${shouldFlipText ? 180 : 0})`}>
                                            <text
                                                x="0"
                                                y="0"
                                                fill="#ffffff"
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                style={{
                                                    textShadow: '0 2px 4px rgba(0,0,0,0.46)',
                                                    fontFamily: 'system-ui, sans-serif',
                                                    textTransform: 'uppercase'
                                                }}
                                            >
                                                <tspan x="0" dy={detail ? '-0.44em' : '0.32em'} fontSize="8.8" fontWeight="950">
                                                    {highlight}
                                                </tspan>
                                                {detail && (
                                                    <tspan x="0" dy="1.55em" fontSize={detail.length > 12 ? '4.2' : '4.8'} fontWeight="750">
                                                        {detail}
                                                    </tspan>
                                                )}
                                            </text>
                                        </g>
                                    </g>
                                );
                            })}
                        </g>

                        <circle r="92" fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="2.6" />
                        <circle r="72" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
                        <circle r="36" fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth="0.8" />
                    </svg>

                    <div className="spin-wheel-glass absolute inset-[11%] z-[8] rounded-full pointer-events-none"></div>

                    <div className="absolute left-1/2 top-1/2 z-20 flex h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[5px] border-white bg-slate-950 shadow-2xl">
                        <div className="absolute inset-1 rounded-full border border-white/10"></div>
                        <div className="flex h-[62%] w-[62%] items-center justify-center overflow-hidden rounded-full bg-white shadow-inner">
                            <img src={clientConfig.logoUrl} alt={`${clientConfig.clientName} logo`} className="h-full w-full object-cover" />
                        </div>
                    </div>

                    <div className="absolute -top-2 left-1/2 z-30 -translate-x-1/2">
                        <div className="spin-wheel-pointer relative flex h-16 w-14 items-start justify-center">
                            <div className="absolute top-0 h-9 w-9 rounded-full border-[3px] border-white bg-slate-950 shadow-lg"></div>
                            <div className="absolute top-5 h-9 w-8 rounded-b-full bg-slate-950 shadow-lg"></div>
                            <div className="absolute top-8 h-0 w-0 border-l-[13px] border-r-[13px] border-t-[22px] border-l-transparent border-r-transparent border-t-brand"></div>
                            <div className="absolute top-2 h-3 w-3 rounded-full bg-brand shadow-[0_0_12px_rgba(185,28,28,0.75)]"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-3 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                    {isSpinning ? 'Wheel is spinning' : 'Ready to unlock your reward'}
                </p>
            </div>

            <style>{`
                .spin-wheel-stage {
                    animation: spinWheelFloat 4s ease-in-out infinite;
                    transform-style: preserve-3d;
                }

                .spin-wheel-stage.is-spinning {
                    animation: spinWheelSpinPresence 5.1s ease-in-out;
                }

                .spin-wheel-frame {
                    background:
                        radial-gradient(circle at 32% 24%, rgba(255,255,255,0.34), transparent 30%),
                        radial-gradient(circle at 50% 52%, #ffffff 0 52%, #e2e8f0 53% 57%, #0f172a 58% 100%);
                    box-shadow:
                        inset 0 16px 22px rgba(255,255,255,0.22),
                        inset 0 -18px 30px rgba(15,23,42,0.42),
                        0 24px 48px -28px rgba(15,23,42,0.85);
                }

                .spin-wheel-rim {
                    background:
                        conic-gradient(from 0deg, #7f1d1d, #f8fafc, #B91c1c, #f59e0b, #7f1d1d, #f8fafc, #991b1b);
                    box-shadow:
                        inset 0 0 0 7px rgba(255,255,255,0.16),
                        inset 0 0 0 18px rgba(15,23,42,0.88);
                }

                .spin-wheel-rim-gloss {
                    background: linear-gradient(145deg, rgba(255,255,255,0.24), transparent 34%, rgba(0,0,0,0.22) 78%);
                    mix-blend-mode: screen;
                    opacity: 0.7;
                    pointer-events: none;
                    animation: spinWheelRimGlint 3.8s ease-in-out infinite;
                }

                .spin-wheel-bulb {
                    background: #fff7ed;
                    box-shadow: 0 0 7px rgba(255,247,237,0.8), 0 0 16px rgba(251,191,36,0.32);
                    animation: spinWheelBulbChase 2.35s linear infinite;
                    z-index: 4;
                }

                .spin-wheel-glass {
                    background:
                        radial-gradient(circle at 34% 22%, rgba(255,255,255,0.30), transparent 22%),
                        linear-gradient(135deg, rgba(255,255,255,0.22), transparent 32%, rgba(255,255,255,0.06) 62%, transparent);
                    box-shadow: inset 0 0 28px rgba(255,255,255,0.16);
                }

                .spin-wheel-pointer {
                    animation: spinWheelPointerPulse 1.35s ease-in-out infinite;
                }

                .spin-wheel-stage.is-spinning .spin-wheel-pointer {
                    animation: spinWheelPointerTick 0.16s linear infinite;
                }

                .spin-wheel-winner-segment {
                    animation: spinWheelWinnerGlow 0.7s ease-in-out infinite alternate;
                }

                @keyframes spinWheelFloat {
                    0%, 100% { transform: translateY(0) scale(1); }
                    50% { transform: translateY(-5px) scale(1.005); }
                }

                @keyframes spinWheelSpinPresence {
                    0% { transform: translateY(0) scale(1); }
                    16% { transform: translateY(-7px) scale(1.018); }
                    82% { transform: translateY(-2px) scale(1.01); }
                    100% { transform: translateY(0) scale(1); }
                }

                @keyframes spinWheelBulbChase {
                    0%, 100% { opacity: 0.42; transform: translate(-50%, -50%) scale(0.82); }
                    42% { opacity: 1; transform: translate(-50%, -50%) scale(1.18); }
                }

                @keyframes spinWheelRimGlint {
                    0%, 100% { opacity: 0.42; transform: rotate(0deg); }
                    50% { opacity: 0.78; transform: rotate(10deg); }
                }

                @keyframes spinWheelPointerPulse {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(2px); }
                }

                @keyframes spinWheelPointerTick {
                    0%, 100% { transform: rotate(0deg) translateY(0); }
                    50% { transform: rotate(-4deg) translateY(2px); }
                }

                @keyframes spinWheelWinnerGlow {
                    from { filter: drop-shadow(0 0 0 rgba(251,191,36,0)); }
                    to { filter: drop-shadow(0 0 9px rgba(251,191,36,0.85)); }
                }

                @media (prefers-reduced-motion: reduce) {
                    .spin-wheel-stage,
                    .spin-wheel-rim-gloss,
                    .spin-wheel-bulb,
                    .spin-wheel-pointer,
                    .spin-wheel-winner-segment {
                        animation: none !important;
                    }
                }
            `}</style>
        </div>
    );
};
