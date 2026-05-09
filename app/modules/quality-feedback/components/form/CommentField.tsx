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
      <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[120px] rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm focus:border-brand outline-none transition-all resize-none"
        placeholder="Type your comments here..."
      />

      {showPiiWarning && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600 font-medium">
            Do not include your name, phone number, or any personal details. Your feedback must remain anonymous.
          </p>
        </div>
      )}
    </div>
  );
};
