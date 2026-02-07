// ========================================
// ActivityLineChart Component
// ========================================
// Recharts line chart visualizing activity timeline

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ActivityTimelineData } from '@/hooks/useActivityTimeline';
import { getChartColors } from '@/lib/chartTheme';

export interface ActivityLineChartProps {
  /** Activity timeline data */
  data: ActivityTimelineData[];
  /** Optional CSS class name */
  className?: string;
  /** Chart height (default: 300) */
  height?: number;
  /** Optional label for the chart */
  title?: string;
}

/**
 * Custom tooltip component for the line chart
 */
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded bg-card p-3 shadow-md border border-border">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        {payload.map((item: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: item.color }}>
            {item.name}: {item.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

/**
 * Format date for X-axis display (MM/DD)
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * ActivityLineChart - Visualizes sessions and tasks over time
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useActivityTimeline();
 * return <ActivityLineChart data={data} />;
 * ```
 */
export function ActivityLineChart({
  data,
  className = '',
  height = 300,
  title,
}: ActivityLineChartProps) {
  const colors = useMemo(() => getChartColors(), []);

  const chartData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      displayDate: formatDate(item.date),
    }));
  }, [data]);

  return (
    <div
      className={`w-full ${className}`}
      role="img"
      aria-label="Activity timeline line chart showing sessions and tasks over time"
      data-testid="activity-line-chart"
    >
      {title && <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
          accessibilityLayer
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} />
          <XAxis
            dataKey="displayDate"
            stroke={colors.muted}
            style={{ fontSize: '12px' }}
          />
          <YAxis stroke={colors.muted} style={{ fontSize: '12px' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '14px' }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="sessions"
            stroke={colors.primary}
            strokeWidth={2}
            dot={{ fill: colors.primary, r: 4 }}
            activeDot={{ r: 6 }}
            name="Sessions"
          />
          <Line
            type="monotone"
            dataKey="tasks"
            stroke={colors.success}
            strokeWidth={2}
            dot={{ fill: colors.success, r: 4 }}
            activeDot={{ r: 6 }}
            name="Tasks"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ActivityLineChart;
