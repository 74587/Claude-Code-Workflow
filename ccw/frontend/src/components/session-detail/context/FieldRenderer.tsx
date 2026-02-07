// ========================================
// FieldRenderer Component
// ========================================
// Renders various data types for context display

import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export interface FieldRendererProps {
  value: unknown;
  type?: 'string' | 'array' | 'object' | 'files' | 'tags' | 'auto';
  className?: string;
}

/**
 * FieldRenderer component - Automatically renders different data types
 */
export function FieldRenderer({ value, type = 'auto', className }: FieldRendererProps) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">-</span>;
  }

  const detectedType = type === 'auto' ? detectType(value) : type;

  switch (detectedType) {
    case 'array':
      return <ArrayRenderer value={value as unknown[]} className={className} />;
    case 'object':
      return <ObjectRenderer value={value as Record<string, unknown>} className={className} />;
    case 'files':
      return <FilesRenderer value={value as Array<{ path: string }>} className={className} />;
    case 'tags':
      return <TagsRenderer value={value as string[]} className={className} />;
    default:
      return <StringRenderer value={String(value)} className={className} />;
  }
}

function detectType(value: unknown): 'string' | 'array' | 'object' | 'files' | 'tags' {
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null && 'path' in value[0]) {
      return 'files';
    }
    if (value.length > 0 && typeof value[0] === 'string') {
      return 'tags';
    }
    return 'array';
  }
  if (typeof value === 'object' && value !== null) {
    return 'object';
  }
  return 'string';
}

function StringRenderer({ value, className }: { value: string; className?: string }) {
  return <span className={cn('text-foreground', className)}>{value}</span>;
}

function ArrayRenderer({ value, className }: { value: unknown[]; className?: string }) {
  if (!Array.isArray(value)) {
    return <FieldRenderer value={value} type="auto" className={className} />;
  }

  if (value.length === 0) {
    return <span className="text-muted-foreground italic">Empty</span>;
  }

  return (
    <ul className={cn('space-y-1', className)}>
      {value.map((item, index) => (
        <li key={index} className="text-sm text-foreground flex items-start gap-2">
          <span className="text-muted-foreground">{index + 1}.</span>
          <span className="flex-1">{String(item)}</span>
        </li>
      ))}
    </ul>
  );
}

function ObjectRenderer({ value, className }: { value: Record<string, unknown>; className?: string }) {
  const entries = Object.entries(value).filter(([_, v]) => v !== null && v !== undefined);

  if (entries.length === 0) {
    return <span className="text-muted-foreground italic">Empty</span>;
  }

  return (
    <div className={cn('space-y-2', className)}>
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-start gap-2">
          <span className="text-sm font-medium text-muted-foreground min-w-[100px] capitalize">
            {formatLabel(key)}:
          </span>
          <span className="text-sm text-foreground flex-1">
            {typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)}
          </span>
        </div>
      ))}
    </div>
  );
}

function FilesRenderer({ value, className }: { value: Array<{ path: string }>; className?: string }) {
  if (!Array.isArray(value)) {
    return <FieldRenderer value={value} type="auto" className={className} />;
  }

  if (value.length === 0) {
    return <span className="text-muted-foreground italic">No files</span>;
  }

  return (
    <div className={cn('space-y-1', className)}>
      {value.map((file, index) => (
        <div
          key={index}
          className="flex items-center gap-2 p-2 bg-muted rounded text-sm font-mono text-foreground"
        >
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="truncate">{file.path}</span>
        </div>
      ))}
    </div>
  );
}

function TagsRenderer({ value, className }: { value: string[]; className?: string }) {
  if (!Array.isArray(value)) {
    return <FieldRenderer value={value} type="auto" className={className} />;
  }

  if (value.length === 0) {
    return <span className="text-muted-foreground italic">No tags</span>;
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {value.map((tag, index) => (
        <Badge key={index} variant="outline" className="px-2 py-0.5">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
