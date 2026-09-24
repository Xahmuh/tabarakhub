import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DropdownSearchProps } from '../types';

/**
 * Lightweight typo-tolerant fuzzy matcher.
 * Scores matches higher for exact matches, word-starts, and consecutive characters.
 */
export function fuzzyMatchScore(pattern: string, text: string): number {
  const p = pattern.trim().toLowerCase();
  const t = text.trim().toLowerCase();

  if (!p) return 1;
  if (t === p) return 1000;
  if (t.startsWith(p)) return 500;

  // Word boundary match
  const words = t.split(/[\s\-_/.,]+/);
  for (const w of words) {
    if (w.startsWith(p)) return 400;
  }

  // Substring match
  const subIdx = t.indexOf(p);
  if (subIdx !== -1) {
    return 300 - subIdx;
  }

  // Fuzzy subsequence match with typo tolerance
  let pIdx = 0;
  let score = 0;
  let consecutive = 0;
  let prevMatchIdx = -2;

  for (let tIdx = 0; tIdx < t.length && pIdx < p.length; tIdx++) {
    if (t[tIdx] === p[pIdx]) {
      score += 10;
      if (tIdx === prevMatchIdx + 1) {
        consecutive++;
        score += consecutive * 8;
      } else {
        consecutive = 0;
      }
      prevMatchIdx = tIdx;
      pIdx++;
    }
  }

  if (pIdx === p.length) {
    return score;
  }

  // Typo tolerance: simple 1-character omission / transposition test
  if (p.length >= 3) {
    let matches = 0;
    for (let i = 0; i < p.length; i++) {
      if (t.includes(p[i])) matches++;
    }
    if (matches >= p.length - 1 && t.length > 0) {
      return 50 + (matches * 5);
    }
  }

  return 0;
}

export function useDropdownSearch<T>({
  items,
  getLabel,
  getValue,
  value,
  onChange,
  groupBy,
  disabled
}: DropdownSearchProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  // Find currently selected item
  const selectedItem = useMemo(() => {
    if (value === null || value === undefined) return null;
    return items.find(item => getValue(item) === value) ?? null;
  }, [items, getValue, value]);

  // Filter and score items
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return items;
    }

    const scored = items
      .map(item => ({
        item,
        score: fuzzyMatchScore(searchQuery, getLabel(item))
      }))
      .filter(entry => entry.score > 0);

    scored.sort((a, b) => b.score - a.score);
    return scored.map(entry => entry.item);
  }, [items, searchQuery, getLabel]);

  // Group filtered items if groupBy is provided
  const groupedItems = useMemo(() => {
    if (!groupBy) {
      return [{ groupName: undefined, items: filteredItems }];
    }

    const groupsMap = new Map<string, T[]>();
    for (const item of filteredItems) {
      const groupName = groupBy(item) || 'Other';
      if (!groupsMap.has(groupName)) {
        groupsMap.set(groupName, []);
      }
      groupsMap.get(groupName)!.push(item);
    }

    return Array.from(groupsMap.entries()).map(([groupName, groupItems]) => ({
      groupName,
      items: groupItems
    }));
  }, [filteredItems, groupBy]);

  // Flattened array of items for sequential keyboard indexing
  const flatSelectableItems = useMemo(() => {
    return filteredItems;
  }, [filteredItems]);

  // Close dropdown and reset query
  const close = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  }, []);

  // Open dropdown
  const open = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    setSearchQuery('');

    // Highlight the currently selected item if present, else first item
    if (selectedItem) {
      const idx = flatSelectableItems.findIndex(
        it => getValue(it) === getValue(selectedItem)
      );
      setHighlightedIndex(idx >= 0 ? idx : 0);
    } else {
      setHighlightedIndex(0);
    }

    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  }, [disabled, selectedItem, flatSelectableItems, getValue]);

  // Select an item
  const selectItem = useCallback(
    (item: T) => {
      onChange(getValue(item));
      close();
    },
    [onChange, getValue, close]
  );

  // Clear selection
  const clearSelection = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
      setSearchQuery('');
      setHighlightedIndex(-1);
      inputRef.current?.focus();
    },
    [onChange]
  );

  // Handle outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        close();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, close]);

  // Keep highlighted item in view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listboxRef.current) {
      const optionEl = listboxRef.current.querySelector(
        `[data-option-index="${highlightedIndex}"]`
      ) as HTMLElement | null;

      if (optionEl) {
        optionEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        setHighlightedIndex(prev => {
          if (flatSelectableItems.length === 0) return -1;
          const next = prev + 1;
          return next >= flatSelectableItems.length ? 0 : next;
        });
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        setHighlightedIndex(prev => {
          if (flatSelectableItems.length === 0) return -1;
          const next = prev - 1;
          return next < 0 ? flatSelectableItems.length - 1 : next;
        });
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < flatSelectableItems.length
        ) {
          selectItem(flatSelectableItems[highlightedIndex]);
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        close();
        break;
      }
      case 'Tab': {
        close();
        break;
      }
    }
  };

  return {
    isOpen,
    setIsOpen,
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
  };
}
