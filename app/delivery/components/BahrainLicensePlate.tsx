import React from 'react';

export interface BahrainLicensePlateProps {
  plateNumber?: string | number | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'fleet-pill' | 'metal-plate';
  withHolder?: boolean;
  holderText?: string;
  className?: string;
}

/**
 * Exact Fleet Motorcycle Plate component matching the Actions & Renewable template.
 * Features the warm amber-bordered badge with the motorcycle icon and bold plate number.
 */
export const FleetMotorcyclePlate: React.FC<{
  plateNumber?: string | number | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}> = ({
  plateNumber = '39717',
  size = 'sm',
  className = ''
}) => {
  const displayPlate = String(plateNumber || '39717').trim();

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[11px] gap-1.5 rounded-[5px]',
    sm: 'px-2.5 py-1 text-[13px] gap-2 rounded-[6px]',
    md: 'px-3.5 py-1.5 text-[15px] gap-2.5 rounded-[8px]',
    lg: 'px-4 py-2 text-[18px] gap-3 rounded-[10px]'
  }[size];

  const iconSizes = {
    xs: 'w-3.5 h-3.5 text-[11px]',
    sm: 'w-4 h-4 text-[13px]',
    md: 'w-5 h-5 text-[15px]',
    lg: 'w-6 h-6 text-[18px]'
  }[size];

  return (
    <div
      className={`inline-flex items-center border border-[#FCD34D] bg-[#FFFBEB] font-black text-[#451A03] shadow-[0_1px_2px_rgba(245,158,11,0.08)] select-none transition hover:border-[#F59E0B] hover:bg-[#FEF3C7] ${sizeClasses} ${className}`}
      style={{
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
      }}
    >
      {/* Motorcycle Icon */}
      <span className={`leading-none shrink-0 ${iconSizes}`} role="img" aria-label="motorcycle">
        🏍️
      </span>

      {/* Bold Plate Number */}
      <span
        className="tracking-wider leading-none tabular-nums font-black"
        style={{
          color: '#3B2314',
          letterSpacing: '0.08em'
        }}
      >
        {displayPlate}
      </span>
    </div>
  );
};

/**
 * Full "FLEET MOTORCYCLES:" Row Header & Badges matching the exact Actions & Renewable template.
 */
export const FleetMotorcyclesBar: React.FC<{
  plateNumbers?: Array<string | number>;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}> = ({
  plateNumbers = ['39717'],
  size = 'sm',
  className = ''
}) => {
  const validPlates = plateNumbers.length > 0 ? plateNumbers : ['39717'];

  return (
    <div className={`inline-flex flex-wrap items-center gap-2.5 ${className}`}>
      {/* Helmet Icon + FLEET MOTORCYCLES: Label */}
      <div className="flex items-center gap-1.5">
        <span className="text-[14px] leading-none" role="img" aria-label="helmet">
          ⛑️
        </span>
        <span className="text-[11px] font-black uppercase tracking-wider text-[#64748B]">
          FLEET MOTORCYCLES:
        </span>
      </div>

      {/* Plate Badges */}
      <div className="flex flex-wrap items-center gap-2">
        {validPlates.map((plate, index) => (
          <FleetMotorcyclePlate key={`${plate}-${index}`} plateNumber={plate} size={size} />
        ))}
      </div>
    </div>
  );
};

/**
 * Unified Bahrain License Plate Component
 * Supports both 'fleet-pill' (Actions & Renewable style) and 'metal-plate' (Embossed metal style)
 */
export const BahrainLicensePlate: React.FC<BahrainLicensePlateProps> = ({
  plateNumber = '39717',
  size = 'sm',
  variant = 'fleet-pill',
  withHolder = false,
  holderText = 'TABARAK PHARMACY • DELIVERY FLEET',
  className = ''
}) => {
  if (variant === 'fleet-pill') {
    return <FleetMotorcyclePlate plateNumber={plateNumber} size={size} className={className} />;
  }

  const displayPlate = String(plateNumber || '39717').trim();

  // Metal Plate Size configurations
  const sizeStyles = {
    xs: {
      container: 'w-[88px] min-h-[46px] p-1 rounded-[4px]',
      headerTextEn: 'text-[6px] tracking-wider',
      headerTextAr: 'text-[6px]',
      numberText: 'text-[13px] tracking-wider',
      rivet: 'w-1 h-1',
      holder: 'text-[5px] py-0.5'
    },
    sm: {
      container: 'w-[110px] min-h-[58px] p-1.5 rounded-[5px]',
      headerTextEn: 'text-[7.5px] tracking-wider',
      headerTextAr: 'text-[7.5px]',
      numberText: 'text-[17px] tracking-wider',
      rivet: 'w-1.5 h-1.5',
      holder: 'text-[6px] py-0.5'
    },
    md: {
      container: 'w-[140px] min-h-[74px] p-2 rounded-[6px]',
      headerTextEn: 'text-[9.5px] tracking-widest',
      headerTextAr: 'text-[9.5px]',
      numberText: 'text-[22px] tracking-[0.2em]',
      rivet: 'w-2 h-2',
      holder: 'text-[7.5px] py-1'
    },
    lg: {
      container: 'w-[190px] min-h-[100px] p-2.5 rounded-[8px]',
      headerTextEn: 'text-[12px] tracking-widest',
      headerTextAr: 'text-[12px]',
      numberText: 'text-[30px] tracking-[0.25em]',
      rivet: 'w-2.5 h-2.5',
      holder: 'text-[9px] py-1.5'
    }
  }[size];

  return (
    <div className={`inline-flex flex-col select-none ${className}`}>
      {/* Main Metal License Plate */}
      <div
        className={`relative flex flex-col justify-between border border-slate-700/80 bg-gradient-to-br from-white via-slate-100 to-slate-200 text-slate-900 shadow-md ${sizeStyles.container}`}
        style={{
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.9), inset 0 -1px 2px rgba(0,0,0,0.25), 0 3px 8px -1px rgba(15,23,42,0.22)',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif'
        }}
      >
        {/* Embossed Inner Rim Line */}
        <div className="pointer-events-none absolute inset-[2px] rounded-[3px] border border-slate-400/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_1px_1px_rgba(0,0,0,0.1)]" />

        {/* 4 Corner Screw Rivets */}
        <div className={`absolute top-1 left-1 rounded-full border border-slate-400 bg-gradient-to-br from-slate-200 to-slate-400 shadow-inner flex items-center justify-center ${sizeStyles.rivet}`}>
          <div className="w-1/2 h-px bg-slate-600/70 transform rotate-45" />
        </div>
        <div className={`absolute top-1 right-1 rounded-full border border-slate-400 bg-gradient-to-br from-slate-200 to-slate-400 shadow-inner flex items-center justify-center ${sizeStyles.rivet}`}>
          <div className="w-1/2 h-px bg-slate-600/70 transform -rotate-45" />
        </div>
        <div className={`absolute bottom-1 left-1 rounded-full border border-slate-400 bg-gradient-to-br from-slate-200 to-slate-400 shadow-inner flex items-center justify-center ${sizeStyles.rivet}`}>
          <div className="w-1/2 h-px bg-slate-600/70 transform -rotate-12" />
        </div>
        <div className={`absolute bottom-1 right-1 rounded-full border border-slate-400 bg-gradient-to-br from-slate-200 to-slate-400 shadow-inner flex items-center justify-center ${sizeStyles.rivet}`}>
          <div className="w-1/2 h-px bg-slate-600/70 transform rotate-12" />
        </div>

        {/* Top Official Header: BAHRAIN & البحرين */}
        <div className="relative z-10 flex items-center justify-between px-2 pt-0.5 border-b border-slate-400/40 pb-0.5">
          <span
            className={`font-black uppercase text-slate-800 ${sizeStyles.headerTextEn}`}
            style={{
              letterSpacing: '0.15em',
              textShadow: '0.5px 0.5px 0px rgba(255,255,255,0.9), -0.5px -0.5px 0px rgba(0,0,0,0.3)'
            }}
          >
            BAHRAIN
          </span>

          {/* Red/White Bahrain Chevron Crown Badge */}
          <div className="flex items-center gap-0.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600 ring-1 ring-red-700/40" />
          </div>

          <span
            className={`font-black text-slate-800 ${sizeStyles.headerTextAr}`}
            style={{
              textShadow: '0.5px 0.5px 0px rgba(255,255,255,0.9), -0.5px -0.5px 0px rgba(0,0,0,0.3)'
            }}
          >
            البحرين
          </span>
        </div>

        {/* Main Embossed Stamped Plate Number */}
        <div className="relative z-10 flex flex-1 items-center justify-center py-0.5">
          <span
            className={`font-black text-slate-900 leading-none ${sizeStyles.numberText}`}
            style={{
              fontFamily: '"DIN Alternate", "Arial Black", Impact, sans-serif',
              textShadow: '1px 1.5px 0px rgba(255,255,255,0.9), -0.8px -0.8px 0px rgba(15,23,42,0.45), 0 2px 3px rgba(0,0,0,0.25)',
              transform: 'scaleY(1.05)'
            }}
          >
            {displayPlate}
          </span>
        </div>
      </div>

      {/* Optional Branded Fleet Frame / Holder */}
      {withHolder && (
        <div
          className={`-mt-0.5 rounded-b-[4px] bg-slate-950 px-1 text-center font-black uppercase tracking-widest text-slate-200 shadow-md ${sizeStyles.holder}`}
          style={{ letterSpacing: '0.12em' }}
        >
          {holderText}
        </div>
      )}
    </div>
  );
};

export default BahrainLicensePlate;
