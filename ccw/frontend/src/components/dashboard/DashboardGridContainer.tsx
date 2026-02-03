// ========================================
// DashboardGridContainer Component
// ========================================
// Responsive grid layout using react-grid-layout for draggable/resizable widgets

import * as React from 'react';
import { Responsive, WidthProvider, Layout as RGLLayout } from 'react-grid-layout';
import { cn } from '@/lib/utils';
import { useUserDashboardLayout } from '@/hooks/useUserDashboardLayout';
import { GRID_BREAKPOINTS, GRID_COLS, GRID_ROW_HEIGHT } from './defaultLayouts';
import type { DashboardLayouts } from '@/types/store';

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface DashboardGridContainerProps {
  /** Child elements to render in the grid (widgets/sections) */
  children: React.ReactNode;
  /** Additional CSS classes for the grid container */
  className?: string;
  /** Whether grid items are draggable */
  isDraggable?: boolean;
  /** Whether grid items are resizable */
  isResizable?: boolean;
}

/**
 * DashboardGridContainer - Responsive grid layout with drag-drop support
 *
 * Uses react-grid-layout for draggable and resizable dashboard widgets.
 * Layouts are persisted to localStorage and Zustand store.
 *
 * Breakpoints:
 * - lg: >= 1024px (12 columns)
 * - md: >= 768px (6 columns)
 * - sm: >= 640px (2 columns)
 */
export function DashboardGridContainer({
  children,
  className,
  isDraggable = true,
  isResizable = true,
}: DashboardGridContainerProps) {
  const { layouts, updateLayouts } = useUserDashboardLayout();

  // Handle layout change (debounced via hook)
  const handleLayoutChange = React.useCallback(
    (_currentLayout: RGLLayout[], allLayouts: DashboardLayouts) => {
      updateLayouts(allLayouts);
    },
    [updateLayouts]
  );

  return (
    <ResponsiveGridLayout
      className={cn('dashboard-grid', className)}
      layouts={layouts}
      breakpoints={GRID_BREAKPOINTS}
      cols={GRID_COLS}
      rowHeight={GRID_ROW_HEIGHT}
      isDraggable={isDraggable}
      isResizable={isResizable}
      onLayoutChange={handleLayoutChange}
      draggableHandle=".drag-handle"
      containerPadding={[0, 0]}
      margin={[16, 16]}
    >
      {children}
    </ResponsiveGridLayout>
  );
}

export default DashboardGridContainer;
