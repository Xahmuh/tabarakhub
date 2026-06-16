import React from 'react';
import { PeriodPreset } from '../utils';

interface PeriodFilterProps {
  preset: PeriodPreset;
  customFrom: string;
  customTo: string;
  onChange: (preset: PeriodPreset, customFrom?: string, customTo?: string) => void;
  labels?: Partial<Record<PeriodPreset, string>>;
  separatorLabel?: string;
}

const PRESETS: Array<{ id: PeriodPreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' }
];

export const PeriodFilter: React.FC<PeriodFilterProps> = ({
  preset,
  customFrom,
  customTo,
  onChange,
  labels,
  separatorLabel = '→'
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <div className="flex bg-slate-100/60 p-1 rounded-lg border border-slate-200/50">
      {PRESETS.map(p => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
            preset === p.id ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {labels?.[p.id] || p.label}
        </button>
      ))}
    </div>
    {preset === 'custom' && (
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={customFrom}
          onChange={e => onChange('custom', e.target.value, customTo)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold outline-none focus:border-brand/40"
        />
        <span className="text-xs font-bold text-slate-400">{separatorLabel}</span>
        <input
          type="date"
          value={customTo}
          onChange={e => onChange('custom', customFrom, e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold outline-none focus:border-brand/40"
        />
      </div>
    )}
  </div>
);
