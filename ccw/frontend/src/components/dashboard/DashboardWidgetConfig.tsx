// ========================================
// DashboardWidgetConfig Component
// ========================================
// Configuration panel for managing dashboard widgets visibility and layout

import * as React from 'react';
import { useIntl } from 'react-intl';
import { ChevronDown, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/lib/utils';
import type { WidgetConfig } from '@/types/store';

export interface DashboardWidgetConfigProps {
  /** List of widget configurations */
  widgets: WidgetConfig[];
  /** Callback when widget visibility changes */
  onWidgetToggle: (widgetId: string) => void;
  /** Callback when reset layout is requested */
  onResetLayout: () => void;
  /** Whether the panel is currently open */
  isOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

/**
 * DashboardWidgetConfig - Widget configuration panel
 *
 * Allows users to:
 * - Toggle widget visibility
 * - Reset layout to defaults
 * - Quickly manage what widgets appear on dashboard
 */
export function DashboardWidgetConfig({
  widgets,
  onWidgetToggle,
  onResetLayout,
  isOpen = false,
  onOpenChange,
}: DashboardWidgetConfigProps) {
  const { formatMessage } = useIntl();
  const [open, setOpen] = React.useState(isOpen);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  const visibleCount = widgets.filter((w) => w.visible).length;
  const allVisible = visibleCount === widgets.length;

  const handleToggleAll = () => {
    // If all visible, hide all. If any hidden, show all.
    widgets.forEach((widget) => {
      if (allVisible) {
        onWidgetToggle(widget.i);
      } else if (!widget.visible) {
        onWidgetToggle(widget.i);
      }
    });
  };

  const handleResetLayout = () => {
    onResetLayout();
    setOpen(false);
  };

  return (
    <div className="relative">
      {/* Toggle button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleOpenChange(!open)}
        className="gap-2"
        aria-label="Toggle widget configuration"
        aria-expanded={open}
      >
        <Eye className="h-4 w-4" />
        {formatMessage({ id: 'common.dashboard.config.title' })}
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
        />
      </Button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-border bg-card shadow-lg z-50">
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {formatMessage({ id: 'common.dashboard.config.widgets' })}
              </h3>
              <span className="text-xs text-muted-foreground">
                {visibleCount}/{widgets.length}
              </span>
            </div>

            {/* Toggle all button */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleAll}
                className="w-full justify-start gap-2 text-xs h-8"
              >
                {allVisible ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    {formatMessage({ id: 'common.dashboard.config.hideAll' })}
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    {formatMessage({ id: 'common.dashboard.config.showAll' })}
                  </>
                )}
              </Button>
            </div>

            {/* Widget list */}
            <div className="space-y-2 border-t border-border pt-4">
              {widgets.map((widget) => (
                <div
                  key={widget.i}
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={`widget-${widget.i}`}
                    checked={widget.visible}
                    onCheckedChange={() => onWidgetToggle(widget.i)}
                    className="h-4 w-4"
                  />
                  <label
                    htmlFor={`widget-${widget.i}`}
                    className="flex-1 text-sm text-foreground cursor-pointer"
                  >
                    {widget.name}
                  </label>
                </div>
              ))}
            </div>

            {/* Reset button */}
            <div className="border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetLayout}
                className="w-full justify-start gap-2"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {formatMessage({ id: 'common.dashboard.config.resetLayout' })}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardWidgetConfig;
