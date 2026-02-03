// ========================================
// ActivityHeatmapWidget Component
// ========================================
// Widget showing activity distribution as a vertical heatmap (narrow layout)

import { memo } from 'react';
import { useIntl } from 'react-intl';
import { Card } from '@/components/ui/Card';
import { useActivityTimeline } from '@/hooks/useActivityTimeline';
import { cn } from '@/lib/utils';

export interface ActivityHeatmapWidgetProps {
  className?: string;
}

const WEEKS = 12; // 12 weeks = ~3 months
const DAYS_PER_WEEK = 7;
const TOTAL_CELLS = WEEKS * DAYS_PER_WEEK;

// Generate heatmap data for WEEKS x 7 grid
function generateHeatmapData(activityData: number[] = []): { value: number; intensity: number }[] {
  const heatmap: { value: number; intensity: number }[] = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const value = activityData[i] ?? Math.floor(Math.random() * 10);
    const intensity = Math.min(100, (value / 10) * 100);
    heatmap.push({ value, intensity });
  }
  return heatmap;
}

function getIntensityColor(intensity: number): string {
  if (intensity === 0) return 'bg-muted/50';
  if (intensity < 25) return 'bg-primary/20';
  if (intensity < 50) return 'bg-primary/40';
  if (intensity < 75) return 'bg-primary/60';
  return 'bg-primary';
}

// Short day labels for narrow layout
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function ActivityHeatmapWidgetComponent({ className }: ActivityHeatmapWidgetProps) {
  const { formatMessage } = useIntl();
  const { data, isLoading } = useActivityTimeline();

  const activityValues = data?.map((item) => item.sessions + item.tasks) || [];
  const heatmapData = generateHeatmapData(activityValues);

  // Get month labels for week rows
  const getWeekLabel = (weekIdx: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - (WEEKS - 1 - weekIdx) * 7);
    // Only show month for first week of each month
    if (weekIdx === 0 || date.getDate() <= 7) {
      return date.toLocaleString('default', { month: 'short' });
    }
    return '';
  };

  return (
    <Card className={cn('h-full p-3 flex flex-col', className)}>
      <h3 className="text-sm font-semibold text-foreground mb-2">
        {formatMessage({ id: 'home.widgets.activity' })}
      </h3>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-full w-full bg-muted rounded animate-pulse" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Day header row */}
          <div className="flex gap-[2px] mb-1">
            <div className="w-8 shrink-0" /> {/* Spacer for month labels */}
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="flex-1 text-center text-[9px] text-muted-foreground font-medium"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Vertical grid: rows = weeks (flowing down), columns = days */}
          <div className="flex-1 flex flex-col gap-[2px] min-h-0 overflow-auto">
            {Array.from({ length: WEEKS }).map((_, weekIdx) => {
              const monthLabel = getWeekLabel(weekIdx);
              return (
                <div key={weekIdx} className="flex gap-[2px] items-center">
                  {/* Month label */}
                  <div className="w-8 shrink-0 text-[9px] text-muted-foreground truncate">
                    {monthLabel}
                  </div>
                  {/* Day cells for this week */}
                  {Array.from({ length: DAYS_PER_WEEK }).map((_, dayIdx) => {
                    const cellIndex = weekIdx * DAYS_PER_WEEK + dayIdx;
                    const cell = heatmapData[cellIndex];
                    return (
                      <div
                        key={dayIdx}
                        className={cn(
                          'flex-1 aspect-square rounded-sm border border-border/30 transition-opacity hover:opacity-80 cursor-help relative group min-w-0',
                          getIntensityColor(cell.intensity)
                        )}
                        title={`${cell.value} activities`}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-foreground text-background rounded text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity">
                          {cell.value}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-1 mt-2 text-[9px] text-muted-foreground">
            <span>Less</span>
            {[0, 25, 50, 75, 100].map((intensity, i) => (
              <div
                key={i}
                className={cn('w-[8px] h-[8px] rounded-sm border border-border/30', getIntensityColor(intensity))}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      )}
    </Card>
  );
}

export const ActivityHeatmapWidget = memo(ActivityHeatmapWidgetComponent);

export default ActivityHeatmapWidget;
