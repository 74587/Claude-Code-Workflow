// ========================================
// TaskTypeBarChartWidget Component
// ========================================
// Widget wrapper for task type bar chart

import { memo } from 'react';
import { useIntl } from 'react-intl';
import { Card } from '@/components/ui/Card';
import { TaskTypeBarChart, ChartSkeleton } from '@/components/charts';
import { useTaskTypeCounts, generateMockTaskTypeCounts } from '@/hooks/useTaskTypeCounts';

export interface TaskTypeBarChartWidgetProps {
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
 * TaskTypeBarChartWidget - Dashboard widget showing task type distribution
 * Wrapped with React.memo to prevent unnecessary re-renders when parent updates.
 */
function TaskTypeBarChartWidgetComponent({ className, ...props }: TaskTypeBarChartWidgetProps) {
  const { formatMessage } = useIntl();
  const { data, isLoading } = useTaskTypeCounts();

  // Use mock data if API call fails or returns no data
  const chartData = data || generateMockTaskTypeCounts();

  return (
    <div {...props} className={className}>
      <Card className="h-full p-4 flex flex-col">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {formatMessage({ id: 'home.widgets.taskTypes' })}
        </h3>
        {isLoading ? (
          <ChartSkeleton type="bar" height={280} />
        ) : (
          <TaskTypeBarChart data={chartData} height={280} />
        )}
      </Card>
    </div>
  );
}

export const TaskTypeBarChartWidget = memo(TaskTypeBarChartWidgetComponent);

export default TaskTypeBarChartWidget;
