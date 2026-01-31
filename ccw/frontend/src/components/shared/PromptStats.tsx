// ========================================
// PromptStats Component
// ========================================
// Statistics display for prompt history

import * as React from 'react';
import { useIntl } from 'react-intl';
import { StatCard, StatCardSkeleton } from '@/components/shared/StatCard';
import { MessageSquare, FileType, Hash } from 'lucide-react';

export interface PromptStatsProps {
  /** Total number of prompts */
  totalCount: number;
  /** Average prompt length in characters */
  avgLength: number;
  /** Most common intent/category */
  topIntent: string | null;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * PromptStats component - displays prompt history statistics
 *
 * Shows three key metrics:
 * - Total prompts: overall count of stored prompts
 * - Average length: mean character count across all prompts
 * - Top intent: most frequently used category
 */
export function PromptStats({
  totalCount,
  avgLength,
  topIntent,
  isLoading = false,
}: PromptStatsProps) {
  const { formatMessage } = useIntl();

  // Format average length for display
  const formatLength = (length: number): string => {
    if (length >= 1000) {
      return `${(length / 1000).toFixed(1)}k`;
    }
    return length.toString();
  };

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      <StatCard
        title={formatMessage({ id: 'prompts.stats.totalCount' })}
        value={totalCount}
        icon={MessageSquare}
        variant="primary"
        isLoading={isLoading}
        description={formatMessage({ id: 'prompts.stats.totalCountDesc' })}
      />
      <StatCard
        title={formatMessage({ id: 'prompts.stats.avgLength' })}
        value={formatLength(avgLength)}
        icon={FileType}
        variant="info"
        isLoading={isLoading}
        description={formatMessage({ id: 'prompts.stats.avgLengthDesc' })}
      />
      <StatCard
        title={formatMessage({ id: 'prompts.stats.topIntent' })}
        value={topIntent || formatMessage({ id: 'prompts.stats.noIntent' })}
        icon={Hash}
        variant="success"
        isLoading={isLoading}
        description={formatMessage({ id: 'prompts.stats.topIntentDesc' })}
      />
    </div>
  );
}

/**
 * Skeleton loader for PromptStats
 */
export function PromptStatsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  );
}

export default PromptStats;
