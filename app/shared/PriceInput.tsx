import React from 'react';

interface PriceInputProps {
  value: number;
  onChange: (val: number) => void;
  label?: string;
  className?: string;
}

export const PriceInput: React.FC<PriceInputProps> = ({ value, onChange, label, className = "" }) => {
  return (
    <div className={`flex flex-col space-y-2 ${className}`}>
      {label && <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">{label}</label>}
      <div className="relative group/price">
        <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col items-center">
          <span className="text-[10px] font-black text-[#B91c1c] tracking-tighter leading-none">BHD</span>
          <div className="w-1 h-4 bg-[#B91c1c]/20 rounded-full mt-1"></div>
        </div>
        <input
          type="number"
          step="0.001"
          className="w-full pl-20 pr-8 py-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] font-mono font-black text-2xl text-slate-800 outline-none focus:ring-8 focus:ring-[#B91c1c]/5 focus:border-[#B91c1c] transition-all shadow-inner"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
        <div className="absolute right-6 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-200 group-focus-within/price:bg-[#B91c1c] transition-colors"></div>
      </div>
    </div>
  );
};
