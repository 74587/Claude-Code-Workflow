// ========================================
// Command Combobox Component
// ========================================
// Searchable dropdown for selecting slash commands (commands + skills)

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCommands } from '@/hooks/useCommands';
import { useSkills } from '@/hooks/useSkills';

export interface CommandSelectDetails {
  name: string;
  argumentHint?: string;
  description?: string;
  source: 'command' | 'skill';
}

interface UnifiedItem {
  name: string;
  description: string;
  group: string;
  argumentHint?: string;
  source: 'command' | 'skill';
}

interface CommandComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSelectDetails?: (details: CommandSelectDetails) => void;
  placeholder?: string;
  className?: string;
}

export function CommandCombobox({ value, onChange, onSelectDetails, placeholder, className }: CommandComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { commands, isLoading: commandsLoading } = useCommands({
    filter: { showDisabled: false },
  });

  const { skills, isLoading: skillsLoading } = useSkills({
    filter: { enabledOnly: true },
  });

  const isLoading = commandsLoading || skillsLoading;

  // Merge commands and skills into unified items
  const unifiedItems = useMemo<UnifiedItem[]>(() => {
    const items: UnifiedItem[] = [];

    for (const cmd of commands) {
      items.push({
        name: cmd.name,
        description: cmd.description,
        group: cmd.group || 'other',
        argumentHint: cmd.argumentHint,
        source: 'command',
      });
    }

    for (const skill of skills) {
      items.push({
        name: skill.name,
        description: skill.description,
        group: 'skills',
        source: 'skill',
      });
    }

    return items;
  }, [commands, skills]);

  // Group and filter items
  const groupedFiltered = useMemo(() => {
    const filtered = search
      ? unifiedItems.filter(
          (item) =>
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.description.toLowerCase().includes(search.toLowerCase())
        )
      : unifiedItems;

    const groups: Record<string, UnifiedItem[]> = {};
    for (const item of filtered) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    }
    return groups;
  }, [unifiedItems, search]);

  const totalFiltered = useMemo(
    () => Object.values(groupedFiltered).reduce((sum, items) => sum + items.length, 0),
    [groupedFiltered]
  );

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const handleSelect = useCallback(
    (item: UnifiedItem) => {
      onChange(item.name);
      onSelectDetails?.({
        name: item.name,
        argumentHint: item.argumentHint,
        description: item.description,
        source: item.source,
      });
      setOpen(false);
      setSearch('');
    },
    [onChange, onSelectDetails]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (!open) setOpen(true);
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    },
    []
  );

  // Display label for current value
  const selectedItem = unifiedItems.find((item) => item.name === value);
  const displayValue = value
    ? `/${selectedItem?.name || value}`
    : '';

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          !value && 'text-muted-foreground',
          className
        )}
      >
        <span className={cn('truncate font-mono', !value && 'text-muted-foreground')}>
          {displayValue || placeholder || '/command-name'}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-md">
          {/* Search input */}
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              value={search}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || '/command-name'}
              className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground font-mono"
            />
          </div>

          {/* Items list */}
          <div className="max-h-64 overflow-y-auto p-1">
            {isLoading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : totalFiltered === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No commands found
              </div>
            ) : (
              Object.entries(groupedFiltered)
                .sort(([a], [b]) => {
                  // Skills group last
                  if (a === 'skills') return 1;
                  if (b === 'skills') return -1;
                  return a.localeCompare(b);
                })
                .map(([group, items]) => (
                  <div key={group}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {group}
                    </div>
                    {items.map((item) => (
                      <button
                        key={`${item.source}-${item.name}`}
                        type="button"
                        onClick={() => handleSelect(item)}
                        className={cn(
                          'flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground',
                          value === item.name && 'bg-accent/50'
                        )}
                      >
                        <span className="font-mono text-foreground">/{item.name}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground truncate w-full text-left">
                            {item.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
