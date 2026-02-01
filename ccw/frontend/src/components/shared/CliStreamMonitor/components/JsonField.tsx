import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface JsonFieldProps {
  fieldName: string;
  value: unknown;
}

export function JsonField({ fieldName, value }: JsonFieldProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isObject = value !== null && typeof value === 'object';
  const isNested = isObject && (Array.isArray(value) || Object.keys(value).length > 0);

  const renderPrimitiveValue = (val: unknown): React.ReactNode => {
    if (val === null) return <span className="text-muted-foreground italic">null</span>;
    if (typeof val === 'boolean') return <span className="text-purple-400 font-medium">{String(val)}</span>;
    if (typeof val === 'number') return <span className="text-orange-400 font-mono">{String(val)}</span>;
    if (typeof val === 'string') {
      // Check if it's a JSON string
      const trimmed = val.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return <span className="text-green-400">"{trimmed.substring(0, 30)}..."</span>;
      }
      return <span className="text-green-400">"{val}"</span>;
    }
    return String(val);
  };

  return (
    <div className={cn(
      'flex items-start gap-2 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors',
      'text-sm'
    )}>
      {/* Field name */}
      <span className="shrink-0 font-mono text-cyan-400 min-w-[100px]">
        {fieldName}
      </span>

      {/* Separator */}
      <span className="shrink-0 text-muted-foreground">:</span>

      {/* Value */}
      <div className="flex-1 min-w-0">
        {isNested ? (
          <details
            open={isExpanded}
            onToggle={(e) => setIsExpanded(e.currentTarget.open)}
            className="group"
          >
            <summary className="cursor-pointer list-none flex items-center gap-1 hover:text-foreground">
              <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                {isExpanded ? '▼' : '▶'}
              </span>
              {Array.isArray(value) ? (
                <span className="text-blue-400">Array[{value.length}]</span>
              ) : (
                <span className="text-yellow-400">Object{'{'}{Object.keys(value).length}{'}'}</span>
              )}
            </summary>
            {isExpanded && (
              <div className="ml-4 mt-2 space-y-1">
                {Array.isArray(value)
                  ? value.map((item, i) => (
                      <div key={i} className="pl-2 border-l border-border/30">
                        {typeof item === 'object' && item !== null ? (
                          <JsonField fieldName={`[${i}]`} value={item} />
                        ) : (
                          renderPrimitiveValue(item)
                        )}
                      </div>
                    ))
                  : Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                      <JsonField key={k} fieldName={k} value={v} />
                    ))
                }
              </div>
            )}
          </details>
        ) : (
          <div className="break-all">{renderPrimitiveValue(value)}</div>
        )}
      </div>
    </div>
  );
}

export default JsonField;
