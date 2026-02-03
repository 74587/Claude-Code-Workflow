// ========================================
// WorkflowStatusPieChartWidget Component
// ========================================
// Widget wrapper for workflow status pie chart

import { memo } from 'react';
import { useIntl } from 'react-intl';
import { Card } from '@/components/ui/Card';
import { WorkflowStatusPieChart, ChartSkeleton } from '@/components/charts';
import { useWorkflowStatusCounts, generateMockWorkflowStatusCounts } from '@/hooks/useWorkflowStatusCounts';

export interface WorkflowStatusPieChartWidgetProps {
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
 * WorkflowStatusPieChartWidget - Dashboard widget showing workflow status distribution
 * Wrapped with React.memo to prevent unnecessary re-renders when parent updates.
 */
function WorkflowStatusPieChartWidgetComponent({ className, ...props }: WorkflowStatusPieChartWidgetProps) {
  const { formatMessage } = useIntl();
  const { data, isLoading, error } = useWorkflowStatusCounts();

  // Use mock data if API is not ready
  const chartData = data || generateMockWorkflowStatusCounts();

  return (
    <div {...props} className={className}>
      <Card className="h-full p-4 flex flex-col">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {formatMessage({ id: 'home.widgets.workflowStatus' })}
        </h3>
        {isLoading ? (
          <ChartSkeleton type="pie" height={280} />
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-destructive">Failed to load chart data</p>
          </div>
        ) : (
          <WorkflowStatusPieChart data={chartData} height={280} />
        )}
      </Card>
    </div>
  );
}

export const WorkflowStatusPieChartWidget = memo(WorkflowStatusPieChartWidgetComponent);

export default WorkflowStatusPieChartWidget;
