// ========================================
// HomePage Component
// ========================================
// Dashboard home page with stat cards and recent sessions

import * as React from 'react';
import { lazy, Suspense } from 'react';
import { useIntl } from 'react-intl';
import { AlertCircle } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardGridContainer } from '@/components/dashboard/DashboardGridContainer';
import { DetailedStatsWidget } from '@/components/dashboard/widgets/DetailedStatsWidget';
import { RecentSessionsWidget } from '@/components/dashboard/widgets/RecentSessionsWidget';
import { ChartSkeleton } from '@/components/charts';
import { Button } from '@/components/ui/Button';
import { useUserDashboardLayout } from '@/hooks/useUserDashboardLayout';
import { WIDGET_IDS } from '@/components/dashboard/defaultLayouts';

// Code-split chart widgets for better initial load performance
const WorkflowStatusPieChartWidget = lazy(() => import('@/components/dashboard/widgets/WorkflowStatusPieChartWidget'));
const ActivityLineChartWidget = lazy(() => import('@/components/dashboard/widgets/ActivityLineChartWidget'));
const TaskTypeBarChartWidget = lazy(() => import('@/components/dashboard/widgets/TaskTypeBarChartWidget'));

/**
 * HomePage component - Dashboard overview with widget-based layout
 */
export function HomePage() {
  const { formatMessage } = useIntl();
  const { resetLayout } = useUserDashboardLayout();

  // Track errors from widgets (optional, for future enhancements)
  const [hasError, _setHasError] = React.useState(false);

  const handleRefresh = () => {
    // Trigger refetch by reloading the page or using React Query's invalidateQueries
    window.location.reload();
  };

  const handleResetLayout = () => {
    resetLayout();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        titleKey="home.dashboard.title"
        descriptionKey="home.dashboard.description"
        onRefresh={handleRefresh}
        onResetLayout={handleResetLayout}
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

      {/* Dashboard Grid with Widgets */}
      <DashboardGridContainer isDraggable={true} isResizable={true}>
        {/* Widget 1: Detailed Stats */}
        <DetailedStatsWidget key={WIDGET_IDS.STATS} />

        {/* Widget 2: Recent Sessions */}
        <RecentSessionsWidget key={WIDGET_IDS.RECENT_SESSIONS} />

        {/* Widget 3: Workflow Status Pie Chart (code-split with Suspense fallback) */}
        <Suspense fallback={<ChartSkeleton type="pie" height={280} />}>
          <WorkflowStatusPieChartWidget key={WIDGET_IDS.WORKFLOW_STATUS} />
        </Suspense>

        {/* Widget 4: Activity Line Chart (code-split with Suspense fallback) */}
        <Suspense fallback={<ChartSkeleton type="line" height={280} />}>
          <ActivityLineChartWidget key={WIDGET_IDS.ACTIVITY} />
        </Suspense>

        {/* Widget 5: Task Type Bar Chart (code-split with Suspense fallback) */}
        <Suspense fallback={<ChartSkeleton type="bar" height={280} />}>
          <TaskTypeBarChartWidget key={WIDGET_IDS.TASK_TYPES} />
        </Suspense>
      </DashboardGridContainer>
    </div>
  );
}

export default HomePage;
