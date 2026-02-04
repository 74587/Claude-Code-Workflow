// ========================================
// Command Combobox Component
// ========================================
// Searchable dropdown for selecting slash commands

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCommands } from '@/hooks/useCommands';
import type { Command } from '@/lib/api';

interface CommandComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CommandCombobox({ value, onChange, placeholder, className }: CommandComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { commands, isLoading } = useCommands({
    filter: { showDisabled: false },
  });

  // Group commands by group field
  const groupedFiltered = useMemo(() => {
    const filtered = search
      ? commands.filter(
          (c) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.description.toLowerCase().includes(search.toLowerCase()) ||
            c.aliases?.some((a) => a.toLowerCase().includes(search.toLowerCase()))
        )
      : commands;

    const groups: Record<string, Command[]> = {};
    for (const cmd of filtered) {
      const group = cmd.group || 'other';
      if (!groups[group]) groups[group] = [];
      groups[group].push(cmd);
    }
    return groups;
  }, [commands, search]);

  const totalFiltered = useMemo(
    () => Object.values(groupedFiltered).reduce((sum, cmds) => sum + cmds.length, 0),
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
    (name: string) => {
      onChange(name);
      setOpen(false);
      setSearch('');
    },
    [onChange]
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
  const selectedCommand = commands.find((c) => c.name === value);
  const displayValue = value
    ? selectedCommand
      ? `/${selectedCommand.name}`
      : `/${value}`
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

          {/* Command list */}
          <div className="max-h-64 overflow-y-auto p-1">
            {isLoading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : totalFiltered === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No commands found
              </div>
            ) : (
              Object.entries(groupedFiltered)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([group, cmds]) => (
                  <div key={group}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {group}
                    </div>
                    {cmds.map((cmd) => (
                      <button
                        key={cmd.name}
                        type="button"
                        onClick={() => handleSelect(cmd.name)}
                        className={cn(
                          'flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground',
                          value === cmd.name && 'bg-accent/50'
                        )}
                      >
                        <span className="font-mono text-foreground">/{cmd.name}</span>
                        {cmd.description && (
                          <span className="text-xs text-muted-foreground truncate w-full text-left">
                            {cmd.description}
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
