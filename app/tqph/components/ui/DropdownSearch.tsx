import React, { useId } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { DropdownSearchProps } from '../../types';
import { useDropdownSearch } from '../../hooks/useDropdownSearch';

/**
 * Reusable DropdownSearch Component (Section 7.2)
 *
 * Strict Compliance:
 * - Flat 2.0 aesthetics per Section 3 tokens
 * - Fuzzy substring matching, typo-tolerant
 * - Keyboard navigation (Arrows, Enter, Esc)
 * - Click-outside dismissal
 * - ARIA combobox / listbox accessibility
 * - Clear button
 * - Grouping support
 */
export function DropdownSearch<T>({
  items,
  getLabel,
  getValue,
  value,
  onChange,
  placeholder = 'Select an option...',
  groupBy,
  disabled = false,
  clearable = true,
  emptyStateLabel = 'No matching options found',
  className = '',
  id
}: DropdownSearchProps<T>) {
  const generatedId = useId();
  const comboboxId = id || `dropdown-search-${generatedId}`;
  const listboxId = `${comboboxId}-listbox`;

  const {
    isOpen,
    searchQuery,
    setSearchQuery,
    highlightedIndex,
    setHighlightedIndex,
    selectedItem,
    flatSelectableItems,
    groupedItems,
    containerRef,
    inputRef,
    listboxRef,
    open,
    close,
    selectItem,
    clearSelection,
    handleKeyDown
  } = useDropdownSearch({
    items,
    getLabel,
    getValue,
    value,
    onChange,
    placeholder,
    groupBy,
    disabled,
    clearable,
    emptyStateLabel
  });

  // Calculate sequential flat index for grouped rendering
  let currentFlatIndex = 0;

  return (
    <div
      ref={containerRef}
      className={`relative w-full text-left font-sans select-none ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Combobox Trigger / Search Input Surface */}
      <div
        id={comboboxId}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-activedescendant={
          highlightedIndex >= 0 && flatSelectableItems[highlightedIndex]
            ? `${comboboxId}-option-${getValue(flatSelectableItems[highlightedIndex])}`
            : undefined
        }
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) {
            if (isOpen) {
              close();
            } else {
              open();
            }
          }
        }}
        className={`
          flex items-center justify-between w-full h-11 px-3.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer
          bg-white border border-slate-200 shadow-sm text-slate-800
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:border-red-200 hover:bg-red-50/20'}
          ${isOpen ? 'border-red-300 ring-2 ring-red-50 shadow-md shadow-red-900/5' : ''}
        `}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-1">
          <Search
            className={`w-4 h-4 flex-shrink-0 transition-colors duration-150 ${
              isOpen ? 'text-red-700' : 'text-slate-400'
            }`}
          />

          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder={selectedItem ? getLabel(selectedItem) : placeholder}
              disabled={disabled}
              className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none text-xs font-bold leading-relaxed"
              onClick={e => e.stopPropagation()}
              autoComplete="off"
              spellCheck={false}
            />
          ) : (
            <span
              className={`truncate text-xs block ${
                selectedItem ? 'text-slate-900 font-bold' : 'text-slate-400 font-medium'
              }`}
            >
              {selectedItem ? getLabel(selectedItem) : placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {clearable && selectedItem && !disabled && (
            <button
              type="button"
              aria-label="Clear selection"
              onClick={clearSelection}
              className="p-1 rounded-md text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors focus:outline-none"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-red-700' : ''
            }`}
          />
        </div>
      </div>

      {/* Floating Listbox Popover */}
      {isOpen && (
        <div
          id={listboxId}
          ref={listboxRef}
          role="listbox"
          tabIndex={-1}
          className="
            absolute z-50 w-full mt-1.5 max-h-64 overflow-y-auto rounded-xl
            bg-white border border-slate-200 shadow-xl shadow-slate-900/10
            p-1.5 focus:outline-none
            scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent
          "
        >
          {flatSelectableItems.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-slate-500">
              <p className="font-bold text-slate-700">{emptyStateLabel}</p>
              {searchQuery && (
                <p className="mt-1 text-slate-400 text-[11px]">
                  No matches for &ldquo;{searchQuery}&rdquo;
                </p>
              )}
            </div>
          ) : (
            groupedItems.map((group, groupIdx) => (
              <div key={group.groupName || `group-${groupIdx}`} className="mb-1 last:mb-0">
                {group.groupName && (
                  <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                    {group.groupName}
                  </div>
                )}

                {group.items.map(item => {
                  const itemIndex = currentFlatIndex++;
                  const itemValue = getValue(item);
                  const itemLabel = getLabel(item);
                  const isSelected = selectedItem !== null && getValue(selectedItem) === itemValue;
                  const isHighlighted = highlightedIndex === itemIndex;
                  const optionId = `${comboboxId}-option-${itemValue}`;

                  return (
                    <div
                      key={itemValue}
                      id={optionId}
                      role="option"
                      aria-selected={isSelected}
                      data-option-index={itemIndex}
                      onMouseEnter={() => setHighlightedIndex(itemIndex)}
                      onClick={e => {
                        e.stopPropagation();
                        selectItem(item);
                      }}
                      className={`
                        flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all duration-100 cursor-pointer
                        ${
                          isSelected
                            ? 'border border-red-200 bg-red-50 text-red-900 font-bold'
                            : isHighlighted
                            ? 'bg-slate-50 text-slate-900 font-semibold'
                            : 'text-slate-700 hover:border-red-100 hover:bg-red-50/40 hover:text-red-950 font-medium'
                        }
                      `}
                    >
                      <span className="truncate pr-2">{itemLabel}</span>

                      {isSelected && (
                        <Check className="w-4 h-4 text-red-700 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
