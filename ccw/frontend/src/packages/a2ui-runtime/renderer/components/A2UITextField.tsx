// ========================================
// A2UI TextField Component Renderer
// ========================================
// Maps A2UI TextField component to shadcn/ui Input

import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/Input';
import type { ComponentRenderer } from '../../core/A2UIComponentRegistry';
import { resolveLiteralOrBinding } from '../A2UIRenderer';
import type { TextFieldComponent } from '../../core/A2UITypes';

interface A2UITextFieldProps {
  component: TextFieldComponent;
  state: Record<string, unknown>;
  onAction: (actionId: string, params: Record<string, unknown>) => void | Promise<void>;
  resolveBinding: (binding: { path: string }) => unknown;
}

/**
 * A2UI TextField Component Renderer
 * Two-way binding via onChange updates to local state
 */
export const A2UITextField: ComponentRenderer = ({ component, state, onAction, resolveBinding }) => {
  const fieldComp = component as TextFieldComponent;
  const { TextField: fieldConfig } = fieldComp;

  // Resolve initial value from binding or use empty string
  const initialValue = fieldConfig.value
    ? String(resolveLiteralOrBinding(fieldConfig.value, resolveBinding) ?? '')
    : '';

  // Local state for controlled input
  const [localValue, setLocalValue] = useState(initialValue);

  // Handle change with two-way binding
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Trigger action with new value
    onAction(fieldConfig.onChange.actionId, {
      value: newValue,
      ...(fieldConfig.onChange.parameters || {}),
    });
  }, [fieldConfig.onChange, onAction]);

  return (
    <Input
      type={fieldConfig.type || 'text'}
      value={localValue}
      onChange={handleChange}
      placeholder={fieldConfig.placeholder}
    />
  );
};
