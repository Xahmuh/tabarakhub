import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface BahrainLicensePlateProps {
  plateNumber: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  enableCopy?: boolean;
}

export const BahrainLicensePlate: React.FC<BahrainLicensePlateProps> = ({
  plateNumber,
  size = 'md',
  className = '',
  enableCopy = true
}) => {
  const [copied, setCopied] = useState(false);
  const displayPlate = plateNumber && plateNumber.trim() ? plateNumber.trim() : '00000';

  const handleCopy = (e: React.MouseEvent) => {
    if (!enableCopy) return;
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(displayPlate);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.error('Failed to copy plate number:', err);
    }
  };

  // Size configurations
  const dimensions = {
    xs: 'h-8 w-auto',
    sm: 'h-10 w-auto',
    md: 'h-24 w-auto',
    lg: 'h-36 w-auto'
  }[size];

  return (
    <div
      onClick={handleCopy}
      title={enableCopy ? `Click to copy: ${displayPlate}` : undefined}
      className={`group relative inline-block cursor-pointer select-text filter drop-shadow-sm hover:drop-shadow-md transition-all ${dimensions} ${className}`}
    >
      {/* Floating Copied Tooltip */}
      {copied && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xl flex items-center gap-1 z-30 animate-fade-in pointer-events-none whitespace-nowrap border border-slate-700">
          <Check className="h-2.5 w-2.5 text-emerald-400" />
          Copied {displayPlate}!
        </div>
      )}

      {/* Copy Hover Hint */}
      {enableCopy && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/60 backdrop-blur-xs text-white p-0.5 rounded z-20 pointer-events-none shadow-xs">
          <Copy className="h-2.5 w-2.5" />
        </div>
      )}

      <svg
        viewBox="0 0 500 230"
        className="h-full w-auto"
        style={{ filter: 'drop-shadow(0px 4px 8px rgba(11, 32, 61, 0.25))' }}
      >
        <defs>
          {/* Metallic Background Gradient */}
          <linearGradient id="plateBgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="25%" stopColor="#F8FAFC" />
            <stop offset="75%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>

          {/* Outer Border Bevel Gradient */}
          <linearGradient id="outerBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94A3B8" />
            <stop offset="50%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>

          {/* Navy Numbers Emboss Effect */}
          <filter id="navyEmboss" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="1.5" dy="2.5" stdDeviation="0.5" floodColor="#FFFFFF" floodOpacity="0.9" result="lightOffset" />
            <feDropShadow dx="-1.5" dy="-1.5" stdDeviation="0.8" floodColor="#040D1A" floodOpacity="0.7" />
          </filter>
        </defs>

        {/* Outer Plate Frame with Bevel */}
        <rect
          x="3" y="3"
          width="494" height="224"
          rx="22" ry="22"
          fill="url(#plateBgGrad)"
          stroke="url(#outerBorderGrad)"
          strokeWidth="6"
        />

        {/* Inner Dark Navy Line */}
        <rect
          x="12" y="12"
          width="476" height="206"
          rx="16" ry="16"
          fill="none"
          stroke="#0B203D"
          strokeWidth="5"
        />

        {/* Screw Hole Left */}
        <circle cx="36" cy="72" r="9" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2.5" />
        <circle cx="36" cy="72" r="5" fill="#CBD5E1" />

        {/* Screw Hole Right */}
        <circle cx="464" cy="72" r="9" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2.5" />
        <circle cx="464" cy="72" r="5" fill="#CBD5E1" />

        {/* Left Header Text: BAHRAIN */}
        <text
          x="44" y="55"
          fill="#0B203D"
          fontSize="36"
          fontWeight="800"
          fontFamily="'Bahnschrift', 'Segoe UI', 'Trebuchet MS', Arial, sans-serif"
          letterSpacing="2.5"
        >
          BAHRAIN
        </text>

        {/* Center Header: Official Bahrain Flag */}
        <g transform="translate(222, 22)">
          {/* Flag Outer Border */}
          <rect x="0" y="0" width="56" height="36" fill="#FFFFFF" stroke="#0B203D" strokeWidth="1.5" />
          {/* Red Flag Rectangle */}
          <rect x="0" y="0" width="56" height="36" fill="#DA291C" />
          {/* White Left Segment with 5 Serrated Points */}
          <path
            d="M 0,0 L 16.5,0 
               L 23.5,3.6 L 16.5,7.2 
               L 23.5,10.8 L 16.5,14.4 
               L 23.5,18 L 16.5,21.6 
               L 23.5,25.2 L 16.5,28.8 
               L 23.5,32.4 L 16.5,36 
               L 0,36 Z"
            fill="#FFFFFF"
          />
        </g>

        {/* Right Header Text: البحرين */}
        <text
          x="456" y="56"
          fill="#0B203D"
          fontSize="38"
          fontWeight="800"
          fontFamily="'Amiri', 'Traditional Arabic', 'Noto Naskh Arabic', Arial, serif"
          textAnchor="end"
        >
          البحرين
        </text>

        {/* Dynamic Main Plate Number - Clean & Balanced Typography */}
        <text
          x="250" y="190"
          fill="#0B203D"
          fontSize="130"
          fontWeight="700"
          fontFamily="'Bahnschrift', 'Segoe UI', 'Trebuchet MS', 'Arial Rounded MT Bold', sans-serif"
          textAnchor="middle"
          letterSpacing="4"
          style={{
            filter: 'drop-shadow(1px 1.5px 0px #FFFFFF) drop-shadow(-0.5px -0.5px 0px rgba(4,13,26,0.4))'
          }}
        >
          {displayPlate}
        </text>
      </svg>
    </div>
  );
};
