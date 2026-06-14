import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { BackToModulesButton } from '../../../shared';

interface Props {
  onBackToHome: () => void;
}

export const ThankYouPage: React.FC<Props> = ({ onBackToHome }) => {
  return (
    <div className="max-w-2xl mx-auto p-12 mt-12 bg-white rounded-3xl shadow-xl border border-slate-200 text-center space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-12 h-12" />
      </div>

      <div className="space-y-3">
        <h2 className="text-4xl font-black text-slate-900">Thank You</h2>
        <p className="text-slate-600 text-lg font-medium">
          Your anonymous feedback has been submitted successfully.
        </p>
        <p className="text-slate-400 text-sm">
          We review all submissions carefully to improve our operations.
        </p>
      </div>

      <BackToModulesButton onClick={onBackToHome} className="mx-auto" />
    </div>
  );
};
