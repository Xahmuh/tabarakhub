import React from 'react';
import { TrendingUp, TrendingDown, Minus, Activity, ShieldAlert, ShoppingBag, Users, Laptop } from 'lucide-react';

interface KPICardProps {
  title: string;
  score: number;
  colorType: 'health' | 'ops' | 'pur' | 'hr' | 'it' | 'neutral';
}

export const KPICard: React.FC<KPICardProps> = ({ title, score, colorType }) => {
  const getStyles = () => {
    switch (colorType) {
      case 'health': return { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: Activity };
      case 'ops': return { bg: 'bg-blue-50', text: 'text-blue-600', icon: ShieldAlert };
      case 'pur': return { bg: 'bg-amber-50', text: 'text-amber-600', icon: ShoppingBag };
      case 'hr': return { bg: 'bg-rose-50', text: 'text-rose-600', icon: Users };
      case 'it': return { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: Laptop };
      default: return { bg: 'bg-slate-50', text: 'text-slate-600', icon: Activity };
    }
  };

  const { bg, text, icon: Icon } = getStyles();
  const isScore = colorType !== 'neutral';

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-xl ${bg} ${text} group-hover:scale-110 transition-transform`}>
          <Icon className="w-5 h-5" />
        </div>
        {isScore && (
          <div className="flex items-center gap-1">
            {score >= 3.5 ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : score <= 2.5 ? (
              <TrendingDown className="w-4 h-4 text-rose-500" />
            ) : (
              <Minus className="w-4 h-4 text-amber-500" />
            )}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <h4 className={`text-2xl font-black ${isScore ? 'text-slate-900' : 'text-slate-700'} tracking-tighter mt-1`}>
          {isScore ? score.toFixed(1) : score}
          {isScore && <span className="text-sm text-slate-400 ml-1">/ 5.0</span>}
        </h4>
      </div>
    </div>
  );
};
