// ========================================
// ChartSkeleton Component
// ========================================
// Loading skeleton for chart components

export interface ChartSkeletonProps {
  /** Skeleton type: pie, line, or bar */
  type?: 'pie' | 'line' | 'bar';
  /** Height in pixels (default: 300) */
  height?: number;
  /** Optional CSS class name */
  className?: string;
}

/**
 * ChartSkeleton - Animated loading skeleton for chart components
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useWorkflowStatusCounts();
 *
 * if (isLoading) return <ChartSkeleton type="pie" />;
 * return <WorkflowStatusPieChart data={data} />;
 * ```
 */
export function ChartSkeleton({
  type = 'bar',
  height = 300,
  className = '',
}: ChartSkeletonProps) {
  return (
    <div className={`w-full animate-pulse ${className}`} style={{ height }}>
      {type === 'pie' && <PieSkeleton height={height} />}
      {type === 'line' && <LineSkeleton height={height} />}
      {type === 'bar' && <BarSkeleton height={height} />}
    </div>
  );
}

/**
 * Pie chart skeleton
 */
function PieSkeleton({ height }: { height: number }) {
  const radius = Math.min(height * 0.3, 80);
  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <div
        className="rounded-full bg-muted"
        style={{ width: radius * 2, height: radius * 2 }}
      />
      <div className="flex gap-4 mt-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted" />
            <div className="w-12 h-3 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Line chart skeleton
 */
function LineSkeleton({ height: _height }: { height: number }) {
  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex-1 flex items-end gap-2">
        {[40, 65, 45, 80, 55, 70, 60].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-muted rounded-t"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-4">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="w-8 h-3 rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}

/**
 * Bar chart skeleton
 */
function BarSkeleton({ height: _height }: { height: number }) {
  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex-1 flex items-end gap-3">
        {[60, 85, 45, 70, 55, 30].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-muted rounded-t"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="w-10 h-3 rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}

export default ChartSkeleton;
