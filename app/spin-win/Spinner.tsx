import React, { useState, useEffect, useRef } from 'react';

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

export const Spinner: React.FC<SpinnerProps> = ({ prizes, winner, onFinish, isSpinning }) => {
    const [rotation, setRotation] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const segments = prizes.length > 0 ? prizes : [
        { id: '1', name: 'Loading...', color: '#cbd5e1' },
        { id: '2', name: 'Please Wait', color: '#94a3b8' }
    ];

    const colors = [
        '#B91c1c',
        '#0891b2',
        '#f59e0b',
    ];

    useEffect(() => {
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
        audioRef.current.volume = 0.4;
    }, []);

    useEffect(() => {
        if (isSpinning && winner) {
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => { });
            }

            const winnerIndex = segments.findIndex(p => p.id === winner.id);
            const prizeCount = segments.length;
            const sliceAngle = 360 / prizeCount;

            const extraSpins = 5 * 360;
            const centerAngle = (winnerIndex + 0.5) * sliceAngle;
            let targetRotation = 270 - centerAngle;
            targetRotation = targetRotation + extraSpins;

            const currentMod = rotation % 360;
            const targetMod = targetRotation % 360;
            let diff = targetMod - currentMod;
            if (diff < 0) diff += 360;

            const finalRotation = rotation + diff + extraSpins;
            setRotation(finalRotation);

            setTimeout(() => {
                onFinish(winner);
            }, 5000);
        }
    }, [isSpinning, winner]);

    const getCoordinates = (percent: number, radius: number) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x * radius, y * radius];
    };

    return (
        <div className="relative w-full max-w-[460px] aspect-square mx-auto">
            {/* Outer ring decorative dots */}
            <div className="absolute inset-[-6%] rounded-full border-[6px] border-slate-900 shadow-2xl z-0 bg-slate-900">
                {/* Decorative bulbs around the rim */}
                {Array.from({ length: 24 }).map((_, i) => {
                    const angle = (i / 24) * 360;
                    const rad = (angle * Math.PI) / 180;
                    const r = 50;
                    const x = 50 + r * Math.cos(rad);
                    const y = 50 + r * Math.sin(rad);
                    return (
                        <div
                            key={i}
                            className={`absolute w-2.5 h-2.5 rounded-full ${i % 2 === 0 ? 'bg-amber-400' : 'bg-white'}`}
                            style={{
                                left: `${x}%`,
                                top: `${y}%`,
                                transform: 'translate(-50%, -50%)',
                                boxShadow: i % 2 === 0 ? '0 0 6px rgba(251,191,36,0.6)' : '0 0 4px rgba(255,255,255,0.4)'
                            }}
                        />
                    );
                })}
            </div>

            {/* Inner white ring */}
            <div className="absolute inset-[1%] rounded-full border-4 border-white/20 z-[1]"></div>

            {/* SVG Wheel */}
            <svg
                viewBox="-100 -100 200 200"
                className="w-full h-full relative z-[2] drop-shadow-lg"
                style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: isSpinning ? 'transform 5s cubic-bezier(0.2, 0, 0.1, 1)' : 'none'
                }}
            >
                {segments.map((prize, i) => {
                    const count = segments.length;
                    const sliceAngle = 360 / count;
                    const startAngle = i * sliceAngle;
                    const endAngle = (i + 1) * sliceAngle;

                    const color = prize.color || colors[i % colors.length];

                    const startPercent = startAngle / 360;
                    const endPercent = endAngle / 360;

                    const [startX, startY] = getCoordinates(startPercent, 92);
                    const [endX, endY] = getCoordinates(endPercent, 92);

                    const largeArcFlag = sliceAngle > 180 ? 1 : 0;

                    const pathData = [
                        `M 0 0`,
                        `L ${startX} ${startY}`,
                        `A 92 92 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                        `Z`
                    ].join(' ');

                    const midAngle = startAngle + sliceAngle / 2;

                    let highlight = "";
                    let detail = "";

                    if (/(\d+%\s*Off)/i.test(prize.name)) {
                        const match = prize.name.match(/^(\d+%\s*Off)\s*(.*)/i);
                        if (match) {
                            highlight = match[1].toUpperCase();
                            detail = match[2];
                        }
                    } else if (/^\d+(\s?BD)?/.test(prize.name) && prize.name.includes('BD')) {
                        const match = prize.name.match(/^(\d+\s?BD)\s*(.*)/);
                        if (match) {
                            highlight = match[1];
                            detail = match[2];
                        }
                    } else if (/^Free/i.test(prize.name)) {
                        const match = prize.name.match(/^(Free)\s*(.*)/i);
                        if (match) {
                            highlight = match[1].toUpperCase();
                            detail = match[2];
                        }
                    } else {
                        const parts = prize.name.split(' ');
                        highlight = parts[0];
                        detail = parts.slice(1).join(' ');
                    }

                    const detailText = detail.trim();
                    const textRadius = 60;

                    let startDy = "0.35em";
                    let detailDy = "0";

                    if (detailText) {
                        startDy = "-0.5em";
                        detailDy = "1.8em";
                    }

                    let detailFontSize = "5.5";
                    if (detailText.length > 18) detailFontSize = "4.5";
                    else if (detailText.length > 12) detailFontSize = "5";

                    return (
                        <g key={prize.id}>
                            <path d={pathData} fill={color} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                            {/* Subtle inner shadow line */}
                            <path d={pathData} fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
                            <text
                                x={textRadius}
                                y={0}
                                fill="#ffffff"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                transform={`rotate(${midAngle}) translate(0, 0)`}
                                style={{
                                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                                    fontFamily: 'system-ui, sans-serif',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em'
                                }}
                            >
                                <tspan
                                    x={textRadius}
                                    dy={startDy}
                                    fontSize="9"
                                    fontWeight="900"
                                >
                                    {highlight}
                                </tspan>
                                {detailText && (
                                    <tspan
                                        x={textRadius}
                                        dy={detailDy}
                                        fontSize={detailFontSize}
                                        fontWeight="600"
                                    >
                                        {detailText}
                                    </tspan>
                                )}
                            </text>
                        </g>
                    );
                })}
            </svg>

            {/* Center Hub */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[18%] h-[18%] bg-slate-900 rounded-full border-4 border-white shadow-xl z-20 flex items-center justify-center">
                <div className="w-[40%] h-[40%] bg-red-600 rounded-full shadow-[0_0_12px_rgba(185,28,28,0.6)]"></div>
            </div>

            {/* Indicator Arrow - Cleaner triangle */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30">
                <svg width="36" height="36" viewBox="0 0 36 36">
                    <filter id="arrow-shadow">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3" />
                    </filter>
                    <path d="M 18 36 L 6 12 Q 18 8 30 12 Z" fill="#1e293b" filter="url(#arrow-shadow)" />
                    <circle cx="18" cy="12" r="3" fill="#b91c1c" />
                </svg>
            </div>
        </div>
    );
};
