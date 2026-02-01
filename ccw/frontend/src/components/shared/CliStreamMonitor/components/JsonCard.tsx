// ========================================
// JsonCard Component
// ========================================
// Collapsible card component for displaying JSON data with type-based styling

import { useState } from 'react';
import {
  Wrench,
  Settings,
  Info,
  Code,
  Copy,
  ChevronRight,
  AlertTriangle,
  Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { JsonField } from './JsonField';

// ========== Types ==========

export interface JsonCardProps {
  /** JSON data to display */
  data: Record<string, unknown>;
  /** Type of the card (affects styling and icon) */
  type: 'tool_call' | 'metadata' | 'system' | 'stdout' | 'stderr' | 'thought';
  /** Timestamp for the data */
  timestamp?: number;
  /** Callback when copy button is clicked */
  onCopy?: () => void;
}

// ========== Type Configuration ==========

type TypeConfig = {
  icon: typeof Wrench;
  label: string;
  color: string;
  bg: string;
};

const TYPE_CONFIGS: Record<string, TypeConfig> = {
  tool_call: {
    icon: Wrench,
    label: 'Tool Call',
    color: 'text-green-400',
    bg: 'bg-green-950/30 border-green-900/50',
  },
  metadata: {
    icon: Info,
    label: 'Metadata',
    color: 'text-yellow-400',
    bg: 'bg-yellow-950/30 border-yellow-900/50',
  },
  system: {
    icon: Settings,
    label: 'System',
    color: 'text-blue-400',
    bg: 'bg-blue-950/30 border-blue-900/50',
  },
  stdout: {
    icon: Code,
    label: 'Data',
    color: 'text-cyan-400',
    bg: 'bg-cyan-950/30 border-cyan-900/50',
  },
  stderr: {
    icon: AlertTriangle,
    label: 'Error',
    color: 'text-red-400',
    bg: 'bg-red-950/30 border-red-900/50',
  },
  thought: {
    icon: Brain,
    label: 'Thought',
    color: 'text-purple-400',
    bg: 'bg-purple-950/30 border-purple-900/50',
  },
};

// ========== Component ==========

export function JsonCard({
  data,
  type,
  timestamp,
  onCopy,
}: JsonCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const entries = Object.entries(data);
  const visibleCount = isExpanded ? entries.length : 3;
  const hasMore = entries.length > 3;

  const config = TYPE_CONFIGS[type];
  const Icon = config.icon;

  return (
    <div className={cn('border rounded-lg overflow-hidden my-2', config.bg)}>
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2 cursor-pointer',
          'hover:bg-black/5 dark:hover:bg-white/5 transition-colors'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', config.color)} />
          <span className="text-sm font-medium">{config.label}</span>
          <Badge variant="secondary" className="text-xs h-5">
            {entries.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {timestamp && (
            <span className="text-xs text-muted-foreground font-mono">
              {new Date(timestamp).toLocaleTimeString()}
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onCopy?.();
            }}
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              setShowRaw(!showRaw);
            }}
          >
            <Code className="h-3 w-3" />
          </Button>
          <ChevronRight
            className={cn(
              'h-4 w-4 transition-transform',
              isExpanded && 'rotate-90'
            )}
          />
        </div>
      </div>

      {/* Content */}
      {showRaw ? (
        <pre className="p-3 text-xs bg-black/20 overflow-x-auto max-h-60">
          <code>{JSON.stringify(data, null, 2)}</code>
        </pre>
      ) : (
        <div className="divide-y divide-border/30">
          {entries.slice(0, visibleCount).map(([key, value]) => (
            <JsonField key={key} fieldName={key} value={value} />
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="w-full px-3 py-2 text-xs text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
            >
              {isExpanded
                ? '▲ Show less'
                : `▼ Show ${entries.length - 3} more fields`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default JsonCard;
