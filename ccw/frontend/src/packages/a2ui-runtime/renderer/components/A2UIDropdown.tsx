// ========================================
// A2UI Dropdown Component Renderer
// ========================================
// Renders as EnhancedSelect (Combobox) when searchable,
// or standard shadcn/ui Select otherwise.

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { EnhancedSelect } from '@/components/ui/enhanced-select';
import type { EnhancedSelectOption } from '@/components/ui/enhanced-select';
import type { ComponentRenderer } from '../../core/A2UIComponentRegistry';
import { resolveTextContent, resolveLiteralOrBinding } from '../A2UIRenderer';
import type { DropdownComponent } from '../../core/A2UITypes';


/**
 * A2UI Dropdown Component Renderer
 * Auto-selects rendering mode based on schema fields:
 * - searchable/description/icon/group → EnhancedSelect (Combobox)
 * - basic options only → shadcn/ui Select
 */
export const A2UIDropdown: ComponentRenderer = ({ component, state, onAction, resolveBinding }) => {
  const dropdownComp = component as DropdownComponent;
  const { Dropdown: dropdownConfig } = dropdownComp;

  // Detect if enhanced features are requested
  const hasEnhancedFeatures = dropdownConfig.searchable ||
    dropdownConfig.clearable ||
    dropdownConfig.label ||
    dropdownConfig.error ||
    dropdownConfig.size ||
    dropdownConfig.options.some((opt: any) => opt.description || opt.icon || opt.group || opt.disabled);

  // Resolve initial selected value from binding
  const getInitialValue = (): string => {
    if (!dropdownConfig.selectedValue) return '';
    const resolved = resolveTextContent(dropdownConfig.selectedValue, resolveBinding);
    return resolved;
  };

  // Local state for controlled select
  const [selectedValue, setSelectedValue] = useState(getInitialValue);

  // Update local state when selectedValue binding changes
  useEffect(() => {
    setSelectedValue(getInitialValue());
  }, [dropdownConfig.selectedValue, state]);

  // Handle change with two-way binding
  const handleChange = useCallback((newValue: string) => {
    setSelectedValue(newValue);

    // Trigger action with new selected value
    onAction(dropdownConfig.onChange.actionId, {
      value: newValue,
      ...(dropdownConfig.onChange.parameters || {}),
    });
  }, [dropdownConfig.onChange, onAction]);

  // Resolve enhanced options (always computed to satisfy hooks rules)
  const resolvedOptions: EnhancedSelectOption[] = useMemo(() =>
    dropdownConfig.options.map((opt: any) => ({
      label: resolveTextContent(opt.label, resolveBinding),
      value: opt.value,
      description: opt.description ? resolveTextContent(opt.description, resolveBinding) : undefined,
      icon: opt.icon || undefined,
      disabled: opt.disabled
        ? Boolean(resolveLiteralOrBinding(opt.disabled, resolveBinding))
        : false,
      group: opt.group || undefined,
    })),
    [dropdownConfig.options, resolveBinding]
  );

  const resolvedLabel = dropdownConfig.label
    ? resolveTextContent(dropdownConfig.label, resolveBinding)
    : undefined;

  const resolvedError = dropdownConfig.error
    ? resolveTextContent(dropdownConfig.error, resolveBinding)
    : undefined;

  // ========== Enhanced Mode (Combobox) ==========
  if (hasEnhancedFeatures) {
    return (
      <EnhancedSelect
        options={resolvedOptions}
        value={selectedValue}
        onChange={handleChange}
        placeholder={dropdownConfig.placeholder}
        searchable={dropdownConfig.searchable || false}
        clearable={dropdownConfig.clearable || false}
        size={dropdownConfig.size}
        label={resolvedLabel}
        required={dropdownConfig.required || false}
        error={resolvedError}
      />
    );
  }

  // ========== Standard Mode (Radix Select) ==========
  return (
    <Select value={selectedValue} onValueChange={handleChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={dropdownConfig.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {dropdownConfig.options.map((option: any) => {
          const label = resolveTextContent(option.label, resolveBinding);
          return (
            <SelectItem key={option.value} value={option.value}>
              {label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};
