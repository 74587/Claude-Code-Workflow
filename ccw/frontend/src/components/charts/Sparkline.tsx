// ========================================
// Sparkline Component
// ========================================
// Mini line chart for trend visualization in StatCards

import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { getChartColors } from '@/lib/chartTheme';

export interface SparklineProps {
  /** Array of numeric values for the sparkline */
  data: number[];
  /** Optional CSS class name */
  className?: string;
  /** Chart height in pixels (default: 50) */
  height?: number;
  /** Line color (default: primary theme color) */
  color?: string;
  /** Line width (default: 2) */
  strokeWidth?: number;
}

/**
 * Sparkline - Minimal line chart for at-a-glance trend visualization
 *
 * Displays a simple line chart with no axes or labels, optimized for
 * showing trends in constrained spaces like StatCards.
 *
 * @example
 * ```tsx
 * // Show last 7 days of activity
 * <Sparkline data={[12, 19, 3, 5, 2, 3, 7]} height={40} />
 * ```
 */
export function Sparkline({
  data,
  className = '',
  height = 50,
  color,
  strokeWidth = 2,
}: SparklineProps) {
  const colors = useMemo(() => getChartColors(), []);
  const lineColor = color || colors.primary;

  // Transform data into Recharts format
  const chartData = useMemo(() => {
    return data.map((value, index) => ({
      index,
      value,
    }));
  }, [data]);

  // Don't render if no data
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
        >
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={strokeWidth}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default Sparkline;
