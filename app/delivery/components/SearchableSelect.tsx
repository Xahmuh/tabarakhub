import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
  disabled?: boolean;
  allowClear?: boolean;
  dir?: 'ltr' | 'rtl';
  searchPlaceholder?: string;
  noMatchesLabel?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  allowClear = true,
  dir = 'ltr',
  searchPlaceholder = 'Search...',
  noMatchesLabel = 'No matches'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const isRtl = dir === 'rtl';

  const selected = options.find(o => o.value === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative" dir={dir}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(o => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm font-bold transition-colors ${isRtl ? 'text-right' : 'text-left'} ${
          disabled
            ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
            : isOpen
              ? 'border-brand/40 bg-white ring-2 ring-brand/10'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-brand/30'
        }`}
      >
        <span className={`truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {allowClear && selected && !disabled && (
            <X
              className="h-3.5 w-3.5 text-slate-300 hover:text-brand"
              onClick={e => { e.stopPropagation(); onChange(null); }}
            />
          )}
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="relative border-b border-slate-100 p-2">
            <Search className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300 ${isRtl ? 'right-4' : 'left-4'}`} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className={`w-full rounded-md bg-slate-50 py-2 text-sm font-bold outline-none ${isRtl ? 'pl-3 pr-8 text-right' : 'pl-8 pr-3 text-left'}`}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-3 text-center text-xs font-bold text-slate-400">{noMatchesLabel}</p>
            ) : filtered.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => { onChange(option.value); setIsOpen(false); setQuery(''); }}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-sm font-bold transition-colors hover:bg-brand/5 ${isRtl ? 'text-right' : 'text-left'} ${
                  option.value === value ? 'bg-brand/5 text-brand' : 'text-slate-700'
                }`}
              >
                <span className="truncate">{option.label}</span>
                {option.hint && <span className={`${isRtl ? 'mr-2' : 'ml-2'} shrink-0 text-[10px] font-bold text-slate-400`}>{option.hint}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
