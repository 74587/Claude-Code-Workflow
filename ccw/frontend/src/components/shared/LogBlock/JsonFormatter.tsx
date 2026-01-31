// ========================================
// JsonFormatter Component
// ========================================
// Displays JSON content in formatted text or card view

import { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, Braces } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  detectJsonContent,
  formatJson,
  getJsonSummary,
  getJsonValueTypeColor,
  type JsonDisplayMode,
} from './jsonUtils';

// ========== Types ==========

export interface JsonFormatterProps {
  /** Content to format */
  content: string;
  /** Display mode */
  displayMode?: JsonDisplayMode;
  /** CSS className */
  className?: string;
  /** Maximum lines for text mode (default: 20) */
  maxLines?: number;
  /** Whether to show type labels in card mode (default: true) */
  showTypeLabels?: boolean;
}

// ========== Helper Components ==========

/**
 * Copy button with feedback
 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 mr-1" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </>
      )}
    </Button>
  );
}

/**
 * JSON value renderer with syntax highlighting
 */
function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const indent = '  '.repeat(depth);
  const colorClass = getJsonValueTypeColor(value);

  if (value === null) {
    return <span className={colorClass}>null</span>;
  }

  if (typeof value === 'boolean') {
    return <span className={colorClass}>{String(value)}</span>;
  }

  if (typeof value === 'number') {
    return <span className={colorClass}>{String(value)}</span>;
  }

  if (typeof value === 'string') {
    return <span className={colorClass}>"{value}"</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-blue-400">[]</span>;
    }

    return (
      <div className="text-blue-400">
        <span>[</span>
        <div className="pl-4">
          {value.map((item, index) => (
            <div key={index} className="hover:bg-muted/50 rounded px-1">
              <JsonValue value={item} depth={depth + 1} />
              {index < value.length - 1 && <span className="text-foreground">,</span>}
            </div>
          ))}
        </div>
        <span>{indent}]</span>
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-yellow-400">{`{}`}</span>;
    }

    return (
      <div className="text-yellow-400">
        <span>{`{`}</span>
        <div className="pl-4">
          {entries.map(([key, val], index) => (
            <div key={key} className="hover:bg-muted/50 rounded px-1">
              <span className="text-cyan-400">"{key}"</span>
              <span className="text-foreground">: </span>
              <JsonValue value={val} depth={depth + 1} />
              {index < entries.length - 1 && <span className="text-foreground">,</span>}
            </div>
          ))}
        </div>
        <span>{indent}{`}`}</span>
      </div>
    );
  }

  return <span>{String(value)}</span>;
}

/**
 * Compact JSON view for inline display
 */
function JsonCompact({ data }: { data: unknown }) {
  return (
    <code className="text-xs font-mono">
      <JsonValue value={data} />
    </code>
  );
}

/**
 * Card view for structured JSON display
 */
function JsonCard({ data, showTypeLabels = true }: { data: unknown; showTypeLabels?: boolean }) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleKey = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    // Primitive or array - use inline view
    return (
      <div className="p-3 bg-muted/30 rounded border border-border">
        <JsonCompact data={data} />
      </div>
    );
  }

  const entries = Object.entries(data as Record<string, unknown>);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
        <Braces className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">JSON Data</span>
        <span className="text-xs text-muted-foreground">
          ({entries.length} {entries.length === 1 ? 'property' : 'properties'})
        </span>
      </div>

      {/* Properties */}
      <div className="divide-y divide-border">
        {entries.map(([key, value]) => {
          const isObject = value !== null && typeof value === 'object';
          const isExpanded = expandedKeys.has(key);
          const isArray = Array.isArray(value);
          const summary = getJsonSummary(value);

          return (
            <div key={key} className="group">
              <div
                className={cn(
                  'flex items-start gap-2 px-3 py-2 hover:bg-muted/30 transition-colors',
                  isObject && 'cursor-pointer'
                )}
                onClick={() => isObject && toggleKey(key)}
              >
                {/* Expand/collapse icon */}
                {isObject && (
                  <div className="shrink-0 mt-0.5">
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                )}

                {/* Key */}
                <span className="font-mono text-sm text-cyan-400 shrink-0">"{key}"</span>
                <span className="text-muted-foreground shrink-0">:</span>

                {/* Value summary or full value */}
                <div className={cn('flex-1 min-w-0', getJsonValueTypeColor(value))}>
                  {showTypeLabels && (
                    <span className="text-xs text-muted-foreground mr-1">
                      {isArray ? 'array' : isObject ? 'object' : typeof value}
                    </span>
                  )}
                  {!isObject ? (
                    <span className="text-sm font-mono break-all">{summary}</span>
                  ) : (
                    <span className="text-sm">{summary}</span>
                  )}
                </div>
              </div>

              {/* Expanded nested object */}
              {isObject && isExpanded && (
                <div className="pl-8 pr-3 pb-2">
                  <div className="p-3 bg-muted/30 rounded border border-border">
                    <JsonCard data={value} showTypeLabels={showTypeLabels} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Text view for formatted JSON
 */
function JsonText({ data, maxLines = 20 }: { data: unknown; maxLines?: number }) {
  const formatted = useMemo(() => formatJson(data), [data]);
  const lines = formatted.split('\n');

  const showTruncated = maxLines && lines.length > maxLines;
  const displayLines = showTruncated ? lines.slice(0, maxLines) : lines;

  return (
    <div className="relative group">
      <pre className="text-xs font-mono bg-muted/30 p-3 rounded border border-border overflow-x-auto">
        <code className="text-foreground">
          {displayLines.map((line, i) => (
            <div key={i} className="hover:bg-muted/50 px-1 -mx-1">
              {line}
            </div>
          ))}
          {showTruncated && (
            <div className="text-muted-foreground italic">
              // ... {lines.length - maxLines} more lines
            </div>
          )}
        </code>
      </pre>

      {/* Copy button */}
      <div className="absolute top-2 right-2">
        <CopyButton text={formatted} />
      </div>
    </div>
  );
}

// ========== Main Component ==========

/**
 * JsonFormatter Component
 *
 * Displays JSON content in various formats:
 * - `text`: Formatted JSON text with syntax highlighting
 * - `card`: Structured card view with collapsible properties
 * - `inline`: Compact inline display
 *
 * Auto-detects JSON from mixed content and validates it.
 */
export function JsonFormatter({
  content,
  displayMode = 'text',
  className,
  maxLines = 20,
  showTypeLabels = true,
}: JsonFormatterProps) {
  // Detect JSON content
  const detection = useMemo(() => detectJsonContent(content), [content]);

  // Not JSON or invalid - show as plain text
  if (!detection.isJson) {
    return (
      <div className={cn('text-xs font-mono text-foreground', className)}>
        {content}
      </div>
    );
  }

  // Valid JSON - render based on display mode
  switch (displayMode) {
    case 'card':
      return (
        <div className={className}>
          <JsonCard data={detection.parsed} showTypeLabels={showTypeLabels} />
        </div>
      );

    case 'inline':
      return (
        <div className={cn('inline-flex items-center gap-1 px-2 py-1 bg-muted/50 rounded border border-border', className)}>
          <Braces className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-xs font-mono">
            <JsonCompact data={detection.parsed} />
          </span>
        </div>
      );

    case 'text':
    default:
      return (
        <div className={className}>
          <JsonText data={detection.parsed} maxLines={maxLines} />
        </div>
      );
  }
}

export default JsonFormatter;
