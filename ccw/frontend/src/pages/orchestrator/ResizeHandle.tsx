// ========================================
// ResizeHandle Component
// ========================================
// Draggable vertical bar for resizing sidebar panels.
// Uses Tailwind CSS for styling.

import type React from 'react';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  className?: string;
  /** Position of the handle relative to the panel. Default: 'right' */
  position?: 'left' | 'right';
}

/**
 * ResizeHandle Component
 *
 * A 4px-wide transparent drag bar that highlights on hover.
 * Placed on the edge of a sidebar panel for drag-to-resize.
 */
export function ResizeHandle({ onMouseDown, className, position = 'right' }: ResizeHandleProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        'absolute top-0 bottom-0 w-1 cursor-ew-resize z-10',
        'bg-transparent hover:bg-primary transition-colors duration-200',
        position === 'right' ? 'right-0' : 'left-0',
        className,
      )}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      tabIndex={0}
    />
  );
}
