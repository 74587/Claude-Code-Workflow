// ========================================
// ActivityLineChartWidget Component
// ========================================
// Widget wrapper for activity line chart

import { memo } from 'react';
import { useIntl } from 'react-intl';
import { Card } from '@/components/ui/Card';
import { ActivityLineChart, ChartSkeleton } from '@/components/charts';
import { useActivityTimeline, generateMockActivityTimeline } from '@/hooks/useActivityTimeline';

export interface ActivityLineChartWidgetProps {
  /** Data grid attributes for react-grid-layout */
  'data-grid'?: {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
  /** Additional CSS classes */
  className?: string;
}

/**
 * ActivityLineChartWidget - Dashboard widget showing activity trends over time
 * Wrapped with React.memo to prevent unnecessary re-renders when parent updates.
 */
function ActivityLineChartWidgetComponent({ className, ...props }: ActivityLineChartWidgetProps) {
  const { formatMessage } = useIntl();
  const { data, isLoading, error } = useActivityTimeline();

  // Use mock data if API is not ready
  const chartData = data || generateMockActivityTimeline();

  return (
    <div {...props} className={className}>
      <Card className="h-full p-4 flex flex-col">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {formatMessage({ id: 'home.widgets.activity' })}
        </h3>
        {isLoading ? (
          <ChartSkeleton type="line" height={280} />
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-destructive">Failed to load chart data</p>
          </div>
        ) : (
          <ActivityLineChart data={chartData} height={280} />
        )}
      </Card>
    </div>
  );
}

export const ActivityLineChartWidget = memo(ActivityLineChartWidgetComponent);

export default ActivityLineChartWidget;
