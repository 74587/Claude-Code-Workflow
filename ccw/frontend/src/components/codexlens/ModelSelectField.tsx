// ========================================
// ModelSelectField Component
// ========================================
// Combobox-style input for selecting models from local + API sources

import { useState, useRef, useEffect, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EnvVarFieldSchema, ModelGroup } from '@/types/codexlens';
import type { CodexLensModel } from '@/lib/api';

interface ModelSelectFieldProps {
  field: EnvVarFieldSchema;
  value: string;
  onChange: (value: string) => void;
  /** Currently loaded local models (installed) */
  localModels?: CodexLensModel[];
  /** Backend type determines which model list to show */
  backendType: 'local' | 'api';
  disabled?: boolean;
}

interface ModelOption {
  id: string;
  label: string;
  group: string;
}

export function ModelSelectField({
  field,
  value,
  onChange,
  localModels = [],
  backendType,
  disabled = false,
}: ModelSelectFieldProps) {
  const { formatMessage } = useIntl();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Build model options based on backend type
  const options = useMemo<ModelOption[]>(() => {
    const result: ModelOption[] = [];

    if (backendType === 'api') {
      // API mode: show preset API models from schema
      const apiGroups: ModelGroup[] = field.apiModels || [];
      for (const group of apiGroups) {
        for (const item of group.items) {
          result.push({ id: item, label: item, group: group.group });
        }
      }
    } else {
      // Local mode: show installed local models, then preset profiles as fallback
      if (localModels.length > 0) {
        for (const model of localModels) {
          const modelId = model.profile || model.name;
          const displayText =
            model.profile && model.name && model.profile !== model.name
              ? `${model.profile} (${model.name})`
              : model.name || model.profile;
          result.push({
            id: modelId,
            label: displayText,
            group: formatMessage({ id: 'codexlens.downloadedModels', defaultMessage: 'Downloaded Models' }),
          });
        }
      } else {
        // Fallback to preset local models from schema
        const localGroups: ModelGroup[] = field.localModels || [];
        for (const group of localGroups) {
          for (const item of group.items) {
            result.push({ id: item, label: item, group: group.group });
          }
        }
      }
    }

    return result;
  }, [backendType, field.apiModels, field.localModels, localModels, formatMessage]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(
      (opt) => opt.id.toLowerCase().includes(q) || opt.label.toLowerCase().includes(q)
    );
  }, [options, search]);

  // Group filtered options
  const grouped = useMemo(() => {
    const groups: Record<string, ModelOption[]> = {};
    for (const opt of filtered) {
      if (!groups[opt.group]) groups[opt.group] = [];
      groups[opt.group].push(opt);
    }
    return groups;
  }, [filtered]);

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setOpen(false);
    setSearch('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    onChange(val);
    if (!open) setOpen(true);
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={open ? search || value : value}
          onChange={handleInputChange}
          onFocus={() => {
            setOpen(true);
            setSearch('');
          }}
          placeholder={field.placeholder || 'Select model...'}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pr-8 text-sm',
            'ring-offset-background placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        />
        <ChevronDown
          className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
        />
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-md">
          <div className="max-h-56 overflow-y-auto p-1">
            {Object.keys(grouped).length === 0 ? (
              <div className="py-3 text-center text-xs text-muted-foreground">
                {backendType === 'api'
                  ? formatMessage({ id: 'codexlens.noConfiguredModels', defaultMessage: 'No models configured' })
                  : formatMessage({ id: 'codexlens.noLocalModels', defaultMessage: 'No models downloaded' })}
              </div>
            ) : (
              Object.entries(grouped).map(([group, items]) => (
                <div key={group}>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    {group}
                  </div>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={cn(
                        'flex w-full items-center rounded-sm px-2 py-1.5 text-xs cursor-pointer',
                        'hover:bg-accent hover:text-accent-foreground',
                        value === item.id && 'bg-accent/50'
                      )}
                    >
                      {item.label}
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

export default ModelSelectField;
