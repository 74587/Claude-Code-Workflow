// ========================================
// WidgetWrapper Component
// ========================================
// Wrapper component for dashboard widgets with drag handle and common styling

import * as React from 'react';
import { GripVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface WidgetWrapperProps {
  /** Widget ID for identification */
  id: string;
  /** Widget title displayed in header */
  title: string;
  /** Children to render inside the widget */
  children: React.ReactNode;
  /** Whether the widget can be dragged */
  isDraggable?: boolean;
  /** Whether the widget can be removed */
  canRemove?: boolean;
  /** Callback when remove button is clicked */
  onRemove?: (id: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the header with drag handle */
  showHeader?: boolean;
  /** Style prop passed by react-grid-layout */
  style?: React.CSSProperties;
}

/**
 * WidgetWrapper - Standardized wrapper for dashboard widgets
 *
 * Uses forwardRef to support react-grid-layout which requires
 * refs on child elements for positioning and measurement.
 */
export const WidgetWrapper = React.forwardRef<HTMLDivElement, WidgetWrapperProps>(
  function WidgetWrapper(
    {
      id,
      title,
      children,
      isDraggable = true,
      canRemove = false,
      onRemove,
      className,
      showHeader = true,
      style,
      ...rest
    },
    ref
  ) {
    const handleRemove = React.useCallback(() => {
      onRemove?.(id);
    }, [id, onRemove]);

    return (
      <div ref={ref} className={cn('h-full flex flex-col', className)} style={style} {...rest}>
        {/* Header with drag handle */}
        {showHeader && (
          <div className="flex items-center justify-between px-2 py-1 border-b border-border/50 bg-muted/30 rounded-t-lg">
            <div className="flex items-center gap-2">
              {/* Drag handle - must have .drag-handle class for react-grid-layout */}
              {isDraggable && (
                <div className="drag-handle cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted transition-colors">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <span className="text-sm font-medium text-foreground">{title}</span>
            </div>

            {/* Widget actions */}
            <div className="flex items-center gap-1">
              {canRemove && onRemove && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleRemove}
                  aria-label={`Remove ${title} widget`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Widget content */}
        <div className="flex-1 min-h-0">
          {children}
        </div>
      </div>
    );
  }
);

export default WidgetWrapper;
