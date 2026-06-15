import React from 'react';
import { AlertCircle } from 'lucide-react';

interface CommentFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  showPiiWarning?: boolean;
}

export const CommentField: React.FC<CommentFieldProps> = ({ label, value, onChange, required, showPiiWarning }) => {
  return (
    <div className="space-y-3">
      <span className="flex items-center gap-1.5 text-sm font-black text-slate-800">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[132px] w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10"
        placeholder="Type your comments here..."
      />

      {showPiiWarning && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs font-bold leading-5 text-amber-900">
            Do not include your name, phone number, or any personal details. Your feedback must remain anonymous.
          </p>
        </div>
      )}
    </div>
  );
};
