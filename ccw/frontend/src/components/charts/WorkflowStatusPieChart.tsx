// ========================================
// WorkflowStatusPieChart Component
// ========================================
// Recharts pie chart visualizing workflow status distribution

import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { WorkflowStatusCount } from '@/hooks/useWorkflowStatusCounts';
import { getChartColors, STATUS_COLORS } from '@/lib/chartTheme';

export interface WorkflowStatusPieChartProps {
  /** Workflow status count data */
  data: WorkflowStatusCount[];
  /** Optional CSS class name */
  className?: string;
  /** Chart height (default: 300) */
  height?: number;
  /** Optional label for the chart */
  title?: string;
}

/**
 * Custom tooltip component for the pie chart
 */
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const { name, value, payload: data } = payload[0];
    const percentage = data.percentage ?? Math.round((value / 100) * 100);
    return (
      <div className="rounded bg-card p-2 shadow-md border border-border">
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="text-sm text-muted-foreground">
          {value} ({percentage}%)
        </p>
      </div>
    );
  }
  return null;
}

/**
 * WorkflowStatusPieChart - Visualizes workflow status distribution
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useWorkflowStatusCounts();
 * return <WorkflowStatusPieChart data={data} />;
 * ```
 */
export function WorkflowStatusPieChart({
  data,
  className = '',
  height = 300,
  title,
}: WorkflowStatusPieChartProps) {
  const colors = useMemo(() => getChartColors(), []);

  const chartData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      displayName: item.status.charAt(0).toUpperCase() + item.status.slice(1).replace('_', ' '),
    }));
  }, [data]);

  const sliceColors = useMemo(() => {
    return chartData.map((item) => {
      const colorKey = STATUS_COLORS[item.status];
      return colors[colorKey];
    });
  }, [chartData, colors]);

  return (
    <div
      className={`w-full ${className}`}
      role="img"
      aria-label="Workflow status pie chart showing distribution of workflow statuses"
    >
      {title && <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          accessibilityLayer
        >
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ displayName, percentage }) => `${displayName} ${Math.round(percentage || 0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="count"
          >
            {sliceColors.map((color, index) => (
              <Cell key={`cell-${index}`} fill={color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(_value, entry: any) => entry.payload.displayName}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default WorkflowStatusPieChart;
