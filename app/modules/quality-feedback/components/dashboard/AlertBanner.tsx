import React from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  show: boolean;
}

export const AlertBanner: React.FC<Props> = ({ show }) => {
  if (!show) return null;

  return (
    <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center gap-4 animate-pulse mb-6">
      <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shrink-0">
        <AlertCircle className="w-6 h-6" />
      </div>
      <div>
        <h4 className="font-black text-rose-900 leading-none">Immediate Attention Required</h4>
        <p className="text-rose-700 text-sm font-medium mt-1">Significant drop in staff satisfaction detected this month.</p>
      </div>
    </div>
  );
};
