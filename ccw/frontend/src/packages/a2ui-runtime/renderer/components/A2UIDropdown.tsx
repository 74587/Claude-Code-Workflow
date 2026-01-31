// ========================================
// A2UI Dropdown Component Renderer
// ========================================
// Maps A2UI Dropdown component to shadcn/ui Select

import React, { useState, useCallback, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import type { ComponentRenderer } from '../../core/A2UIComponentRegistry';
import { resolveTextContent } from '../A2UIRenderer';
import type { DropdownComponent } from '../../core/A2UITypes';

interface A2UIDropdownProps {
  component: DropdownComponent;
  state: Record<string, unknown>;
  onAction: (actionId: string, params: Record<string, unknown>) => void | Promise<void>;
  resolveBinding: (binding: { path: string }) => unknown;
}

/**
 * A2UI Dropdown Component Renderer
 * Using shadcn/ui Select with options array mapping to SelectItem
 */
export const A2UIDropdown: ComponentRenderer = ({ component, state, onAction, resolveBinding }) => {
  const dropdownComp = component as DropdownComponent;
  const { Dropdown: dropdownConfig } = dropdownComp;

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

  return (
    <Select value={selectedValue} onValueChange={handleChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={dropdownConfig.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {dropdownConfig.options.map((option) => {
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
