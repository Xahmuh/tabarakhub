
import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface KPIProps {
  label: string;
  value: string | number;
  trend?: number;
  icon: React.ReactNode;
  color?: string;
}

export const KPI: React.FC<KPIProps> = ({ label, value, trend, icon }) => {
  const isPositive = trend && trend > 0;
  
  return (
    <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-[0_4px_30px_rgb(0,0,0,0.01)] hover:border-brand/40 transition-all duration-700 group flex flex-col justify-between h-full relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-slate-50 group-hover:bg-brand transition-colors"></div>
      
      <div className="flex justify-between items-start mb-10">
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-all duration-500 shadow-inner">
          {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: "w-7 h-7 md:w-8 md:h-8" }) : icon}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center text-[10px] font-black px-4 py-2 rounded-xl border ${
            isPositive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
          }`}>
            {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-1.5" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-3 leading-none">{label}</p>
        <p className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter leading-none">{value}</p>
      </div>
    </div>
  );
};
