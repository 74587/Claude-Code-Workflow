// ========================================
// InsightsHistoryList Component
// ========================================
// Display past insight analysis results with tool icon, timestamp, pattern count, and suggestion count

import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Bot,
  Code2,
  Cpu,
  Brain,
  Loader2,
} from 'lucide-react';
import type { InsightHistory } from '@/lib/api';

export interface InsightsHistoryListProps {
  /** Array of historical insights */
  insights?: InsightHistory[];
  /** Loading state */
  isLoading?: boolean;
  /** Called when an insight card is clicked */
  onInsightSelect?: (insightId: string) => void;
  /** Optional className */
  className?: string;
}

// Tool icon mapping
const toolConfig = {
  gemini: {
    icon: Sparkles,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    label: 'Gemini',
  },
  qwen: {
    icon: Bot,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    label: 'Qwen',
  },
  codex: {
    icon: Code2,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    label: 'Codex',
  },
  default: {
    icon: Cpu,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    label: 'CLI',
  },
};

/**
 * Format timestamp to relative time (e.g., "2h ago")
 */
function formatTimeAgo(timestamp: string, locale: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  const isZh = locale === 'zh';

  if (minutes < 1) return isZh ? '刚刚' : 'Just now';
  if (minutes < 60) return isZh ? `${minutes} 分钟前` : `${minutes}m ago`;
  if (hours < 24) return isZh ? `${hours} 小时前` : `${hours}h ago`;
  if (days < 7) return isZh ? `${days} 天前` : `${days}d ago`;
  return date.toLocaleDateString();
}

/**
 * Get severity level from patterns
 * Pattern severity: 'error' | 'warning' | 'info'
 */
function getSeverityLevel(patterns: InsightHistory['patterns']): 'low' | 'medium' | 'high' {
  if (!patterns || patterns.length === 0) return 'low';
  const hasHigh = patterns.some(p => p.severity === 'error');
  const hasMedium = patterns.some(p => p.severity === 'warning');
  return hasHigh ? 'high' : hasMedium ? 'medium' : 'low';
}

/**
 * Severity color mapping
 */
const severityConfig = {
  low: {
    border: 'border-l-4 border-l-green-500',
  },
  medium: {
    border: 'border-l-4 border-l-yellow-500',
  },
  high: {
    border: 'border-l-4 border-l-red-500',
  },
};

/**
 * InsightHistoryCard component for displaying a single insight history entry
 */
function InsightHistoryCard({
  insight,
  locale,
  onClick,
}: {
  insight: InsightHistory;
  locale: string;
  onClick: () => void;
}) {
  const { formatMessage } = useIntl();
  const severity = getSeverityLevel(insight.patterns);
  const config = toolConfig[insight.tool as keyof typeof toolConfig] ?? toolConfig.default;
  const ToolIcon = config.icon;
  const timeAgo = formatTimeAgo(insight.created_at, locale);
  const patternCount = insight.patterns?.length ?? 0;
  const suggestionCount = insight.suggestions?.length ?? 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-3 rounded-lg border border-border bg-card hover:bg-muted/50 cursor-pointer transition-colors',
        'border-l-4',
        severityConfig[severity].border
      )}
    >
      {/* Header: Tool and timestamp */}
      <div className="flex items-center justify-between mb-2">
        <div className={cn('flex items-center gap-1.5', config.color)}>
          <ToolIcon className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{config.label}</span>
        </div>
        <div className="text-xs text-muted-foreground">{timeAgo}</div>
      </div>

      {/* Stats: Patterns, Suggestions, Prompts */}
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-semibold text-foreground">{patternCount}</span>
          <span className="text-xs text-muted-foreground">
            {formatMessage({ id: 'prompts.insightsHistory.patterns' })}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-semibold text-foreground">{suggestionCount}</span>
          <span className="text-xs text-muted-foreground">
            {formatMessage({ id: 'prompts.insightsHistory.suggestions' })}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-semibold text-foreground">{insight.prompt_count}</span>
          <span className="text-xs text-muted-foreground">
            {formatMessage({ id: 'prompts.insightsHistory.prompts' })}
          </span>
        </div>
      </div>

      {/* Pattern preview (if available) */}
      {insight.patterns && insight.patterns.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div
            className={cn(
              'flex items-start gap-1.5 text-xs',
              insight.patterns[0].severity === 'error'
                ? 'text-red-500'
                : insight.patterns[0].severity === 'warning'
                  ? 'text-yellow-600'
                  : 'text-blue-500'
            )}
          >
            <span className="font-medium uppercase">
              {insight.patterns[0].name?.split(' ')[0] || 'Pattern'}
            </span>
            <span className="text-muted-foreground truncate flex-1">
              {insight.patterns[0].description?.slice(0, 50)}
              {insight.patterns[0].description && insight.patterns[0].description.length > 50 ? '...' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * InsightsHistoryList component - Display past insight analysis results
 */
export function InsightsHistoryList({
  insights = [],
  isLoading = false,
  onInsightSelect,
  className,
}: InsightsHistoryListProps) {
  const { formatMessage } = useIntl();
  const locale = useIntl().locale;

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">
            {formatMessage({ id: 'prompts.insightsHistory.loading' })}
          </span>
        </div>
      </div>
    );
  }

  // Empty state
  if (insights.length === 0) {
    return (
      <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <Brain className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <h3 className="text-sm font-medium text-foreground mb-1">
            {formatMessage({ id: 'prompts.insightsHistory.empty.title' })}
          </h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            {formatMessage({ id: 'prompts.insightsHistory.empty.message' })}
          </p>
        </div>
      </div>
    );
  }

  // List of insights
  return (
    <div className={cn('space-y-2', className)}>
      {insights.map((insight) => (
        <InsightHistoryCard
          key={insight.id}
          insight={insight}
          locale={locale}
          onClick={() => onInsightSelect?.(insight.id)}
        />
      ))}
    </div>
  );
}

export default InsightsHistoryList;
