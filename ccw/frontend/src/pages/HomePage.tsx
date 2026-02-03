// ========================================
// HomePage Component
// ========================================
// Dashboard home page with combined stats, workflow status, and activity heatmap

import * as React from 'react';
import { useIntl } from 'react-intl';
import { AlertCircle } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { WorkflowTaskWidget } from '@/components/dashboard/widgets/WorkflowTaskWidget';
import { RecentSessionsWidget } from '@/components/dashboard/widgets/RecentSessionsWidget';
import { Button } from '@/components/ui/Button';

/**
 * HomePage component - Dashboard overview with fixed widget layout
 */
export function HomePage() {
  const { formatMessage } = useIntl();

  // Track errors from widgets (optional, for future enhancements)
  const [hasError, _setHasError] = React.useState(false);

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        titleKey="home.dashboard.title"
        descriptionKey="home.dashboard.description"
        onRefresh={handleRefresh}
      />

      {/* Error alert (optional, shown if widgets encounter critical errors) */}
      {hasError && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">{formatMessage({ id: 'home.errors.loadFailed' })}</p>
            <p className="text-xs mt-0.5">
              {formatMessage({ id: 'common.errors.unknownError' })}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            {formatMessage({ id: 'home.errors.retry' })}
          </Button>
        </div>
      )}

      {/* Dashboard Widgets - Simple flex layout for dynamic height */}
      <div className="flex flex-col gap-4">
        {/* Row 1: Combined Stats + Workflow Status + Task Details */}
        <WorkflowTaskWidget />

        {/* Row 2: Recent Sessions */}
        <RecentSessionsWidget />
      </div>
    </div>
  );
}

export default HomePage;
