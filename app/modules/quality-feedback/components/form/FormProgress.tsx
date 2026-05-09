import React from 'react';

interface FormProgressProps {
  currentStep: number;
  totalSteps: number;
}

export const FormProgress: React.FC<FormProgressProps> = ({ currentStep, totalSteps }) => {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
        <span className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px]">
            {currentStep}
          </span>
          Step
        </span>
        <span className="text-brand">{Math.round(progress)}% Complete</span>
      </div>

      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand transition-all duration-700 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
