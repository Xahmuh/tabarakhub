import React from 'react';

interface ScoreBadgeProps {
  score: number;
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score }) => {
  const s = score ?? 0;

  const getBadgeStyles = (v: number) => {
    if (v >= 4.5) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (v >= 3.5) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (v >= 2.5) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${getBadgeStyles(s)}`}>
      {s.toFixed(1)}
    </span>
  );
};
