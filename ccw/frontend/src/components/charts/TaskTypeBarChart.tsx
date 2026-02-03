// ========================================
// TaskTypeBarChart Component
// ========================================
// Recharts bar chart visualizing task type breakdown

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { TaskTypeCount } from '@/hooks/useTaskTypeCounts';
import { getChartColors, TASK_TYPE_COLORS } from '@/lib/chartTheme';

export interface TaskTypeBarChartProps {
  /** Task type count data */
  data: TaskTypeCount[];
  /** Optional CSS class name */
  className?: string;
  /** Chart height (default: 300) */
  height?: number;
  /** Optional label for the chart */
  title?: string;
}

/**
 * Custom tooltip component for the bar chart
 */
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const { type, count, percentage } = payload[0].payload;
    const displayName = type.charAt(0).toUpperCase() + type.slice(1);
    return (
      <div className="rounded bg-card p-3 shadow-md border border-border">
        <p className="text-sm font-medium text-foreground">{displayName}</p>
        <p className="text-sm text-muted-foreground">
          {count} tasks ({Math.round(percentage || 0)}%)
        </p>
      </div>
    );
  }
  return null;
}

/**
 * TaskTypeBarChart - Visualizes task type distribution
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useTaskTypeCounts();
 * return <TaskTypeBarChart data={data} />;
 * ```
 */
export function TaskTypeBarChart({
  data,
  className = '',
  height = 300,
  title,
}: TaskTypeBarChartProps) {
  const colors = useMemo(() => getChartColors(), []);

  const chartData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      displayName: item.type.charAt(0).toUpperCase() + item.type.slice(1),
    }));
  }, [data]);

  const barColors = useMemo(() => {
    return chartData.map((item) => {
      const colorKey = TASK_TYPE_COLORS[item.type] || 'muted';
      return colors[colorKey];
    });
  }, [chartData, colors]);

  return (
    <div
      className={`w-full ${className}`}
      role="img"
      aria-label="Task type bar chart showing distribution of task types"
    >
      {title && <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
          accessibilityLayer
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} />
          <XAxis
            dataKey="displayName"
            stroke={colors.muted}
            style={{ fontSize: '12px' }}
          />
          <YAxis stroke={colors.muted} style={{ fontSize: '12px' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '14px' }}
            formatter={() => 'Task Count'}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {barColors.map((color, index) => (
              <Cell key={`cell-${index}`} fill={color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TaskTypeBarChart;
