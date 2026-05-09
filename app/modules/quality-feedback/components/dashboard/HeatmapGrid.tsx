import React from 'react';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

interface Props {
  data?: any[];
  isLoading?: boolean;
}

export const HeatmapGrid: React.FC<Props> = ({ data, isLoading }) => {
  const sections = ['Operations', 'Purchasing', 'HR', 'IT', 'Overall'];
  const sectionKeys = ['operations_avg', 'purchasing_avg', 'hr_avg', 'it_avg', 'score'];

  const getMonthName = (monthStr: string) => {
    if (!monthStr) return '';
    const date = new Date(monthStr + '-01');
    return date.toLocaleString('en-US', { month: 'short' });
  };

  const getScoreConfig = (score: number) => {
    if (score >= 4.5) return { color: 'text-emerald-700', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' };
    if (score >= 3.5) return { color: 'text-emerald-600', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', dot: 'bg-emerald-400' };
    if (score >= 3.0) return { color: 'text-amber-600', bg: 'bg-amber-400/10', border: 'border-amber-400/20', dot: 'bg-amber-400' };
    if (score >= 2.0) return { color: 'text-rose-600', bg: 'bg-rose-400/10', border: 'border-rose-400/20', dot: 'bg-rose-400' };
    return { color: 'text-rose-700', bg: 'bg-rose-600/10', border: 'border-rose-600/20', dot: 'bg-rose-600' };
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col min-h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Section Health (Monthly)</h3>
          <p className="text-xs text-slate-500 font-medium">Average satisfaction scores across all departments</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Good</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Low</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
        {isLoading ? (
          <div className="w-full h-full bg-slate-50 rounded-xl animate-pulse" />
        ) : (
          <div className="min-w-[600px] space-y-4">
            {/* Header Row */}
            <div className="grid grid-cols-[120px_1fr] gap-4">
              <div />
              <div className="grid grid-cols-6 gap-2">
                {data?.map((m, i) => (
                  <div key={i} className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{m.month?.split('-')[0]}</p>
                    <p className="text-sm font-black text-slate-900">{getMonthName(m.month)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Section Rows */}
            {sections.map((section, sIdx) => (
              <div key={section} className="grid grid-cols-[120px_1fr] gap-4 group">
                <div className="flex items-center justify-end pr-4 border-r border-slate-100">
                  <span className="text-xs font-black text-slate-600 uppercase tracking-wider text-right group-hover:text-brand transition-colors">
                    {section}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {data?.map((m, mIdx) => {
                    const score = m[sectionKeys[sIdx]] || 0;
                    const prevScore = mIdx > 0 ? data[mIdx - 1][sectionKeys[sIdx]] || 0 : 0;
                    const { color, bg, border, dot } = getScoreConfig(score);
                    
                    return (
                      <div
                        key={mIdx}
                        className={`relative p-3 rounded-2xl border-2 transition-all hover:scale-105 hover:shadow-lg cursor-default group/cell ${bg} ${border}`}
                      >
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className={`text-lg font-black tracking-tighter ${color}`}>
                            {score.toFixed(1)}
                          </span>
                          
                          {prevScore > 0 && (
                            <div className="flex items-center gap-0.5">
                              {score > prevScore ? (
                                <TrendingUp className="w-3 h-3 text-emerald-500" />
                              ) : score < prevScore ? (
                                <TrendingDown className="w-3 h-3 text-rose-500" />
                              ) : (
                                <Minus className="w-3 h-3 text-slate-300" />
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Status Dot */}
                        <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${dot} shadow-sm opacity-0 group-hover/cell:opacity-100 transition-opacity`} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-xl shadow-sm">
            <Info className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-[11px] font-medium text-slate-500 leading-tight max-w-[200px]">
            Scores are calculated based on active questions for each department.
          </p>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div 
              key={i} 
              className={`w-8 h-2 rounded-full ${
                i === 1 ? 'bg-rose-500' : 
                i === 2 ? 'bg-rose-400' : 
                i === 3 ? 'bg-amber-400' : 
                i === 4 ? 'bg-emerald-400' : 'bg-emerald-500'
              }`} 
            />
          ))}
        </div>
      </div>
    </div>
  );
};
