// ========================================
// DashboardHeader Component
// ========================================
// Reusable dashboard header with title, description, and refresh action

import * as React from 'react';
import { useIntl } from 'react-intl';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface DashboardHeaderProps {
  /** i18n key for the dashboard title */
  titleKey: string;
  /** i18n key for the dashboard description */
  descriptionKey: string;
  /** Callback when refresh button is clicked */
  onRefresh?: () => void;
  /** Whether the refresh action is currently loading */
  isRefreshing?: boolean;
  /** Callback when reset layout button is clicked */
  onResetLayout?: () => void;
  /** Optional additional actions to render */
  actions?: React.ReactNode;
}

/**
 * DashboardHeader - Reusable header component for dashboard pages
 *
 * Displays a title, description, and optional refresh/reset layout buttons.
 * Supports additional custom actions via the actions prop.
 */
export function DashboardHeader({
  titleKey,
  descriptionKey,
  onRefresh,
  isRefreshing = false,
  onResetLayout,
  actions,
}: DashboardHeaderProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-foreground gradient-text">
          {formatMessage({ id: titleKey })}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {formatMessage({ id: descriptionKey })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {onResetLayout && (
          <Button
            variant="outline"
            size="sm"
            onClick={onResetLayout}
            aria-label="Reset dashboard layout"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'common.actions.resetLayout' })}
          </Button>
        )}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={formatMessage({ id: 'home.dashboard.refreshTooltip' })}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
        )}
      </div>
    </div>
  );
}

export default DashboardHeader;
