import React from 'react';

interface FormProgressProps {
  currentStep: number;
  totalSteps: number;
}

export const FormProgress: React.FC<FormProgressProps> = ({ currentStep, totalSteps }) => {
  const safeTotal = Math.max(totalSteps, 1);
  const safeCurrent = Math.min(Math.max(currentStep, 1), safeTotal);
  const progress = (safeCurrent / safeTotal) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-[10px] text-slate-700 shadow-sm">
            {safeCurrent}
          </span>
          Step progress
        </span>
        <span className="text-brand">{Math.round(progress)}% complete</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70">
        <div
          className="h-full rounded-full bg-brand transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
