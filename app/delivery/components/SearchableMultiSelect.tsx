import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface SearchableMultiSelectProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  dir?: 'ltr' | 'rtl';
  searchPlaceholder?: string;
  noMatchesLabel?: string;
}

export const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
  options,
  selectedValues,
  onChange,
  placeholder = 'All branches',
  disabled = false,
  dir = 'ltr',
  searchPlaceholder = 'Search branches...',
  noMatchesLabel = 'No matching branches'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const isRtl = dir === 'rtl';

  const selectedOptions = useMemo(
    () => options.filter(o => selectedValues.includes(o.value)),
    [options, selectedValues]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      (o.hint && o.hint.toLowerCase().includes(q))
    );
  }, [options, query]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const selectAll = () => {
    onChange(options.map(o => o.value));
  };

  const clearAll = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange([]);
  };

  const isAllSelected = options.length > 0 && selectedValues.length === options.length;

  return (
    <div ref={containerRef} className="relative" dir={dir}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(o => !o)}
        className={`flex w-full min-h-[48px] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${isRtl ? 'text-right' : 'text-left'} ${
          disabled
            ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
            : isOpen
              ? 'border-brand/40 bg-white ring-2 ring-brand/10'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-brand/30'
        }`}
      >
        <div className="flex flex-1 flex-wrap items-center gap-1.5 overflow-hidden py-0.5">
          {selectedValues.length === 0 ? (
            <span className="truncate text-slate-400">{placeholder}</span>
          ) : isAllSelected ? (
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
              <span>{placeholder}</span>
              <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-black text-brand">
                All ({options.length})
              </span>
            </span>
          ) : selectedValues.length === 1 ? (
            <span className="flex items-center gap-1.5 truncate text-slate-900 font-bold">
              {selectedOptions[0]?.hint && (
                <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-black text-brand shrink-0">
                  {selectedOptions[0].hint}
                </span>
              )}
              <span className="truncate">{selectedOptions[0]?.label || selectedValues[0]}</span>
            </span>
          ) : selectedValues.length <= 3 ? (
            <div className="flex flex-wrap items-center gap-1">
              {selectedOptions.map(opt => (
                <span
                  key={opt.value}
                  className="inline-flex items-center gap-1 rounded bg-slate-200/70 px-1.5 py-0.5 text-[11px] font-black text-slate-800"
                >
                  <span>{opt.hint || opt.label}</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOption(opt.value);
                    }}
                    className="cursor-pointer text-slate-400 hover:text-red-600"
                    title="Remove"
                  >
                    ×
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-slate-900 font-bold">
              <span className="rounded bg-brand px-2 py-0.5 text-xs font-black text-white">
                {selectedValues.length} branches
              </span>
              <span className="truncate text-xs font-semibold text-slate-500">
                {selectedOptions.slice(0, 3).map(o => o.hint || o.label).join(', ')}...
              </span>
            </span>
          )}
        </div>

        <span className="flex shrink-0 items-center gap-1 ml-1">
          {selectedValues.length > 0 && !disabled && (
            <span
              onClick={clearAll}
              className="rounded p-1 text-slate-300 transition hover:bg-slate-200 hover:text-brand"
              title="Reset to all branches"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-40 mt-1 w-full min-w-[18rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          {/* Search Box */}
          <div className="relative border-b border-slate-100 p-2">
            <Search className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 ${isRtl ? 'right-4' : 'left-4'}`} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className={`w-full rounded-md bg-slate-50 py-1.5 text-xs font-bold outline-none ring-1 ring-slate-200 focus:ring-brand/40 ${
                isRtl ? 'pl-3 pr-8 text-right' : 'pl-8 pr-3 text-left'
              }`}
            />
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-1.5 text-[11px] font-bold">
            <span className="text-slate-500">
              {selectedValues.length === 0 ? (
                <span>All active</span>
              ) : (
                <span className="text-brand">{selectedValues.length} of {options.length} selected</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-slate-600 hover:text-brand hover:underline font-bold"
              >
                Select all
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-slate-600 hover:text-brand hover:underline font-bold"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 p-1">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-xs font-bold text-slate-400">{noMatchesLabel}</p>
            ) : (
              filtered.map(option => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleOption(option.value)}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-xs font-bold transition-colors ${
                      isSelected ? 'bg-brand/5 text-brand' : 'text-slate-700 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          isSelected
                            ? 'border-brand bg-brand text-white shadow-xs'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">{option.label}</span>
                    </div>

                    {option.hint && (
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          isSelected ? 'bg-brand/10 text-brand' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {option.hint}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer with Done button */}
          <div className="border-t border-slate-100 bg-slate-50 p-2 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-medium">
              Click anywhere outside or press Esc to apply
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setQuery('');
              }}
              className="rounded-md bg-slate-900 px-3 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
