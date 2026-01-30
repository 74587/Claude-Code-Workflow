// ========================================
// StatCard Component
// ========================================
// Reusable stat card for dashboard metrics

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

const statCardVariants = cva(
  'transition-all duration-200 hover:shadow-md',
  {
    variants: {
      variant: {
        default: 'border-border',
        primary: 'border-primary/30 bg-primary/5',
        success: 'border-success/30 bg-success/5',
        warning: 'border-warning/30 bg-warning/5',
        danger: 'border-destructive/30 bg-destructive/5',
        info: 'border-info/30 bg-info/5',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const iconContainerVariants = cva(
  'flex h-10 w-10 items-center justify-center rounded-lg',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground',
        primary: 'bg-primary/10 text-primary',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/10 text-warning',
        danger: 'bg-destructive/10 text-destructive',
        info: 'bg-info/10 text-info',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface StatCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statCardVariants> {
  /** Card title */
  title: string;
  /** Stat value to display */
  value: number | string;
  /** Optional icon component */
  icon?: LucideIcon;
  /** Optional trend direction */
  trend?: 'up' | 'down' | 'neutral';
  /** Optional trend value (e.g., "+12%") */
  trendValue?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Optional description */
  description?: string;
}

/**
 * StatCard component for displaying dashboard metrics
 *
 * @example
 * ```tsx
 * <StatCard
 *   title="Total Sessions"
 *   value={42}
 *   icon={FolderIcon}
 *   variant="primary"
 *   trend="up"
 *   trendValue="+5"
 * />
 * ```
 */
export function StatCard({
  className,
  variant,
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  isLoading = false,
  description,
  ...props
}: StatCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-success'
      : trend === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground';

  return (
    <Card className={cn(statCardVariants({ variant }), className)} {...props}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              {isLoading ? (
                <div className="h-8 w-16 animate-pulse rounded bg-muted" />
              ) : (
                <p className="text-2xl font-semibold text-card-foreground">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </p>
              )}
              {trend && trendValue && !isLoading && (
                <span className={cn('flex items-center text-xs font-medium', trendColor)}>
                  <TrendIcon className="mr-0.5 h-3 w-3" />
                  {trendValue}
                </span>
              )}
            </div>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {description}
              </p>
            )}
          </div>
          {Icon && (
            <div className={cn(iconContainerVariants({ variant }))}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton loader for StatCard
 */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('animate-pulse', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="mt-3 h-8 w-16 rounded bg-muted" />
          </div>
          <div className="h-10 w-10 rounded-lg bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
