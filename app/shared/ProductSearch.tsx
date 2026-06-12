import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, X, ChevronRight, Command, Loader2 } from 'lucide-react';
import { Product } from '../../types';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/calculations';
import { getPriceIncludingVat, formatVatLabel } from '../../utils/vat';

interface ProductSearchProps {
  onSelect: (product: Product) => void;
  onManual: (query: string) => void;
}

export const ProductSearch: React.FC<ProductSearchProps> = ({ onSelect, onManual }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (query.trim().length >= 1) {
      setIsSearching(true);
      const timer = setTimeout(async () => {
        const matches = await supabase.products.search(query);

        // AUTO-SELECT LOGIC for Barcode Scanners (Direct exact match)
        const q = query.trim().toLowerCase();
        const exactMatch = matches.find(p =>
          p.internalCode?.toLowerCase() === q ||
          p.internationalCode?.toLowerCase() === q
        );

        if (exactMatch && query.length >= 4) { // Typical min barcode length
          onSelect(exactMatch);
          setQuery('');
          setIsOpen(false);
          setIsSearching(false);
          return;
        }

        setResults(matches.slice(0, 8));
        setIsOpen(true);
        setActiveIndex(0);
        setIsSearching(false);
      }, 100); // Faster bounce for scanners
      return () => clearTimeout(timer);
    } else {
      setResults([]);
      setIsOpen(false);
      setActiveIndex(-1);
      setIsSearching(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        onSelect(results[activeIndex]);
        setQuery('');
      } else if (results.length === 0 && query.trim()) {
        onManual(query);
        setQuery('');
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none z-10">
          {isSearching ? (
            <Loader2 className="text-brand w-4 h-4 animate-spin" />
          ) : (
            <Search className={`w-5 h-5 transition-colors duration-200 ${isOpen ? 'text-brand' : 'text-slate-400 group-focus-within:text-brand'}`} />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          className="w-full h-12 md:h-14 pl-12 pr-20 md:pr-24 bg-white border border-slate-200 rounded-xl text-sm md:text-base font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand shadow-sm transition-all duration-200"
          placeholder="Search by name or code..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length > 0 && setIsOpen(true)}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="p-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all duration-200"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-400 select-none">
            <Command className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold tracking-widest">K</span>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="absolute mt-2 w-full bg-white rounded-xl shadow-xl shadow-slate-200/70 border border-slate-200 overflow-hidden z-[2000] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
            {results.length > 0 ? (
              <div className="py-2">
                {results.map((product, idx) => (
                  <button
                    key={product.id}
                    onClick={() => { onSelect(product); setQuery(''); setIsOpen(false); }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full px-4 py-3 flex items-center justify-between gap-4 transition-all group ${activeIndex === idx ? 'bg-brand/5' : 'bg-transparent hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${activeIndex === idx ? 'bg-brand text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <Package className="w-5 h-5" />
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 min-w-0">
                          <p className={`text-sm md:text-base font-bold leading-tight truncate ${activeIndex === idx ? 'text-brand' : 'text-slate-900'}`}>{product.name}</p>
                          {product.internalCode && <span className="text-[11px] font-bold text-slate-400 shrink-0">#{product.internalCode}</span>}
                          {/* Display Price next to name */}
                          <span className="text-xs font-mono font-bold text-brand bg-brand/5 px-2 py-0.5 rounded-md shrink-0">
                            {formatCurrency(getPriceIncludingVat(product.defaultPrice, product.vatEnabled, product.vatRate))}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wide truncate">{product.agent || 'N/A'}</span>
                          <span className="text-[10px] md:text-xs font-bold text-slate-300">|</span>
                          <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wide">{product.internalCode || 'NO-CODE'}</span>
                          <span className="text-[10px] md:text-xs font-bold text-slate-300">|</span>
                          <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wide">{formatVatLabel(product.vatEnabled, product.vatRate)}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${activeIndex === idx ? 'bg-brand/10 text-brand translate-x-0.5' : 'bg-slate-50 text-slate-300'}`}>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-slate-500 font-semibold text-sm">No matching products found.</p>
                <button
                  onClick={() => { onManual(query); setQuery(''); setIsOpen(false); }}
                  className="btn-primary mt-4"
                >
                  Create Manual Entry
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
