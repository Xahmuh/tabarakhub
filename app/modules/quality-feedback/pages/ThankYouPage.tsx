import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { BackToModulesButton } from '../../../shared';

interface Props {
  onBackToHome: () => void;
}

export const ThankYouPage: React.FC<Props> = ({ onBackToHome }) => {
  return (
    <div className="mx-auto mt-12 max-w-2xl animate-in fade-in zoom-in duration-500 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60 sm:p-12">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
        <CheckCircle2 className="h-10 w-10" />
      </div>

      <div className="mt-7 space-y-3">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">Submitted</p>
        <h2 className="text-4xl font-black tracking-tight text-slate-950">Thank You</h2>
        <p className="text-base font-bold leading-7 text-slate-600">
          Your anonymous feedback has been submitted successfully.
        </p>
        <p className="text-sm font-bold text-slate-400">
          We review all submissions carefully to improve our operations.
        </p>
      </div>

      <div className="mt-8">
        <BackToModulesButton onClick={onBackToHome} className="mx-auto" />
      </div>
    </div>
  );
};
