// ========================================
// A2UI Progress Component Renderer
// ========================================
// Maps A2UI Progress component to shadcn/ui Progress

import React from 'react';
import { Progress } from '@/components/ui/Progress';
import type { ComponentRenderer } from '../../core/A2UIComponentRegistry';
import { resolveLiteralOrBinding } from '../A2UIRenderer';
import type { ProgressComponent } from '../../core/A2UITypes';

interface A2UIProgressProps {
  component: ProgressComponent;
  state: Record<string, unknown>;
  onAction: (actionId: string, params: Record<string, unknown>) => void | Promise<void>;
  resolveBinding: (binding: { path: string }) => unknown;
}

/**
 * A2UI Progress Component Renderer
 * For CLI output progress display
 */
export const A2UIProgress: ComponentRenderer = ({ component, state, onAction, resolveBinding }) => {
  const progressComp = component as ProgressComponent;
  const { Progress: progressConfig } = progressComp;

  // Resolve value and max from bindings or use defaults
  const value = progressConfig.value
    ? Number(resolveLiteralOrBinding(progressConfig.value, resolveBinding) ?? 0)
    : 0;
  const max = progressConfig.max ?? 100;

  // Calculate percentage for display (0-100)
  const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div className="w-full space-y-1">
      <Progress value={percentage} max={100} />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Progress</span>
        <span>{Math.round(percentage)}%</span>
      </div>
    </div>
  );
};
