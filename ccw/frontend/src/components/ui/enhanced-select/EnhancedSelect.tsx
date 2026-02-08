// ========================================
// Enhanced Select Component
// ========================================
// Glassmorphism-styled Combobox with search, groups, descriptions,
// form integration (label/required/error), and keyboard navigation.
// Built on native DOM + Radix-like patterns (no extra deps).

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerVariants, optionItemVariants } from './enhanced-select-variants';
import type { EnhancedSelectProps, EnhancedSelectOption } from './types';

// ========== Grouped + Filtered Options ==========

interface GroupedOptions {
  [group: string]: EnhancedSelectOption[];
}

function groupAndFilter(
  options: EnhancedSelectOption[],
  search: string,
): { grouped: GroupedOptions; total: number } {
  const filtered = search
    ? options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(search.toLowerCase()) ||
          (opt.description && opt.description.toLowerCase().includes(search.toLowerCase()))
      )
    : options;

  const grouped: GroupedOptions = {};
  for (const opt of filtered) {
    const key = opt.group || '';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(opt);
  }

  return { grouped, total: filtered.length };
}

function highlightMatch(text: string, search: string): React.ReactNode {
  if (!search) return text;
  const idx = text.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-foreground rounded-sm px-0.5">{text.slice(idx, idx + search.length)}</mark>
      {text.slice(idx + search.length)}
    </>
  );
}

// ========== Main Component ==========

export function EnhancedSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchable = false,
  clearable = false,
  size = 'default',
  label,
  required,
  error,
  disabled,
  className,
}: EnhancedSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerId = useRef(`enhanced-select-${Math.random().toString(36).slice(2, 8)}`).current;

  // Resolve display label
  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label || '';

  // Group and filter
  const { grouped, total } = useMemo(() => groupAndFilter(options, search), [options, search]);

  // Flat list of visible options for keyboard nav
  const flatVisible = useMemo(() => {
    const result: EnhancedSelectOption[] = [];
    const sortedGroups = Object.keys(grouped).sort((a, b) => {
      if (a === '') return -1;
      if (b === '') return 1;
      return a.localeCompare(b);
    });
    for (const g of sortedGroups) {
      for (const opt of grouped[g]) {
        result.push(opt);
      }
    }
    return result;
  }, [grouped]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
        setHighlightIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Focus search input on open
  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, searchable]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${highlightIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setHighlightIndex(-1);
  }, [disabled]);

  const handleSelect = useCallback(
    (opt: EnhancedSelectOption) => {
      if (opt.disabled) return;
      onChange(opt.value);
      setOpen(false);
      setSearch('');
      setHighlightIndex(-1);
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          handleOpen();
        }
        if ((e.key === 'Backspace' || e.key === 'Delete') && clearable && value) {
          e.preventDefault();
          onChange('');
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          setSearch('');
          setHighlightIndex(-1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setHighlightIndex((prev) => {
            let next = prev + 1;
            while (next < flatVisible.length && flatVisible[next].disabled) next++;
            return next < flatVisible.length ? next : prev;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightIndex((prev) => {
            let next = prev - 1;
            while (next >= 0 && flatVisible[next].disabled) next--;
            return next >= 0 ? next : prev;
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightIndex >= 0 && highlightIndex < flatVisible.length) {
            handleSelect(flatVisible[highlightIndex]);
          }
          break;
      }
    },
    [open, handleOpen, flatVisible, highlightIndex, handleSelect, clearable, value, onChange]
  );

  // Derive state variant
  const stateVariant = disabled ? 'disabled' as const : error ? 'error' as const : 'normal' as const;

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Label */}
      {label && (
        <label htmlFor={triggerId} className="text-sm font-medium leading-none">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      )}

      {/* Select Container */}
      <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
        {/* Trigger */}
        <button
          id={triggerId}
          type="button"
          onClick={() => (open ? setOpen(false) : handleOpen())}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-invalid={!!error}
          aria-required={required}
          data-state={open ? 'open' : 'closed'}
          className={cn(triggerVariants({ size, state: stateVariant }))}
        >
          <span className={cn('truncate', !displayValue && 'text-muted-foreground')}>
            {displayValue || placeholder}
          </span>
          <div className="flex items-center shrink-0">
            {clearable && value && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                onClick={handleClear}
                className="p-0.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </button>

        {/* Dropdown Panel */}
        {open && (
          <div
            className="absolute z-50 mt-1 w-full rounded-lg shadow-lg bg-card/90 backdrop-blur-md border border-primary/20 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
            role="listbox"
            aria-label={label || placeholder}
          >
            {/* Search Input */}
            {searchable && (
              <div className="flex items-center px-3 py-2 border-b border-border/50">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHighlightIndex(-1);
                  }}
                  placeholder={placeholder}
                  className="flex-1 h-7 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  aria-label="Search options"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      inputRef.current?.focus();
                    }}
                    className="p-0.5 rounded-full hover:bg-muted text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Options List */}
            <div ref={listRef} className="max-h-64 overflow-y-auto p-1">
              {total === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {search ? 'No matching options' : 'No options available'}
                </div>
              ) : (
                (() => {
                  let globalIdx = 0;
                  const sortedGroups = Object.keys(grouped).sort((a, b) => {
                    if (a === '') return -1;
                    if (b === '') return 1;
                    return a.localeCompare(b);
                  });

                  return sortedGroups.map((group) => (
                    <div key={group || '__ungrouped'}>
                      {group && (
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {group}
                        </div>
                      )}
                      {grouped[group].map((opt) => {
                        const idx = globalIdx++;
                        const isSelected = opt.value === value;
                        const isHighlighted = idx === highlightIndex;

                        return (
                          <div
                            key={opt.value}
                            data-index={idx}
                            role="option"
                            aria-selected={isSelected}
                            aria-disabled={opt.disabled}
                            onClick={() => handleSelect(opt)}
                            className={cn(
                              optionItemVariants({ isSelected, isDisabled: !!opt.disabled }),
                              isHighlighted && !isSelected && 'bg-accent/50',
                              'pl-3',
                            )}
                          >
                            <div className="flex items-center gap-2 w-full min-w-0">
                              {/* Icon */}
                              {opt.icon && (
                                <span className="shrink-0 text-muted-foreground">{opt.icon}</span>
                              )}
                              {/* Content */}
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="truncate text-sm">
                                  {highlightMatch(opt.label, search)}
                                </span>
                                {opt.description && (
                                  <span className="truncate text-xs text-muted-foreground">
                                    {highlightMatch(opt.description, search)}
                                  </span>
                                )}
                              </div>
                              {/* Check mark */}
                              {isSelected && (
                                <Check className="h-4 w-4 shrink-0 text-primary" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
