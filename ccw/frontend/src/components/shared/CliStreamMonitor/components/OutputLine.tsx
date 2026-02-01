// ========================================
// OutputLine Component
// ========================================
// Renders a single output line with JSON auto-detection

import { useMemo } from 'react';
import { Brain, Settings, AlertCircle, Info, MessageCircle, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { JsonCard } from './JsonCard';
import { detectJsonInLine } from '../utils/jsonDetector';

// ========== Types ==========

export interface OutputLineProps {
  line: {
    type: 'stdout' | 'stderr' | 'metadata' | 'thought' | 'system' | 'tool_call';
    content: string;
    timestamp: number;
  };
  onCopy?: (content: string) => void;
}

// ========== Helper Functions ==========

/**
 * Get the icon component for a given output line type
 */
function getOutputLineIcon(type: OutputLineProps['line']['type']) {
  switch (type) {
    case 'thought':
      return <Brain className="h-3 w-3" />;
    case 'system':
      return <Settings className="h-3 w-3" />;
    case 'stderr':
      return <AlertCircle className="h-3 w-3" />;
    case 'metadata':
      return <Info className="h-3 w-3" />;
    case 'tool_call':
      return <Wrench className="h-3 w-3" />;
    case 'stdout':
    default:
      return <MessageCircle className="h-3 w-3" />;
  }
}

/**
 * Get the CSS class name for a given output line type
 * Reuses the existing implementation from LogBlock utils
 */
function getOutputLineClass(type: OutputLineProps['line']['type']): string {
  switch (type) {
    case 'thought':
      return 'text-purple-400';
    case 'system':
      return 'text-blue-400';
    case 'stderr':
      return 'text-red-400';
    case 'metadata':
      return 'text-yellow-400';
    case 'tool_call':
      return 'text-green-400';
    case 'stdout':
    default:
      return 'text-foreground';
  }
}

// ========== Component ==========

/**
 * OutputLine - Renders a single CLI output line
 *
 * Features:
 * - Auto-detects JSON content and renders with JsonCard
 * - Shows appropriate icon based on line type
 * - Applies color styling based on line type
 * - Supports copy functionality
 */
export function OutputLine({ line, onCopy }: OutputLineProps) {
  // Memoize JSON detection to avoid re-parsing on every render
  const jsonDetection = useMemo(() => detectJsonInLine(line.content), [line.content]);

  return (
    <div className={cn('flex gap-2 text-xs', getOutputLineClass(line.type))}>
      {/* Icon indicator */}
      <span className="text-muted-foreground shrink-0 mt-0.5">
        {getOutputLineIcon(line.type)}
      </span>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        {jsonDetection.isJson && jsonDetection.parsed ? (
          <JsonCard
            data={jsonDetection.parsed}
            type={line.type as 'tool_call' | 'metadata' | 'system' | 'stdout'}
            timestamp={line.timestamp}
            onCopy={() => onCopy?.(line.content)}
          />
        ) : (
          <span className="break-all whitespace-pre-wrap">{line.content}</span>
        )}
      </div>
    </div>
  );
}

export default OutputLine;
