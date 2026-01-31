// ========================================
// MessageRenderer Component
// ========================================
// Renders message content with Markdown support, JSON formatting,
// and escape sequence handling

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '@/lib/utils';
import { JsonFormatter } from '../../LogBlock/JsonFormatter';
import { detectJsonContent } from '../../LogBlock/jsonUtils';

// Import highlight.js styles for code syntax highlighting
// Using a base style that works with both light and dark themes
import 'highlight.js/styles/base16/atelier-forest.css';

// ========== Types ==========

export interface MessageRendererProps {
  /** Content to render */
  content: string;
  /** Additional CSS className */
  className?: string;
  /** Format hint (auto-detect if not specified) */
  format?: 'markdown' | 'text' | 'json';
  /** Maximum lines to display (for text mode) */
  maxLines?: number;
}

// ========== Markdown Component Styles ==========

const markdownComponents: Record<string, string> = {
  h1: 'text-xl font-bold mt-4 mb-2 text-foreground',
  h2: 'text-lg font-semibold mt-3 mb-2 text-foreground',
  h3: 'text-base font-semibold mt-2 mb-1 text-foreground',
  p: 'text-sm leading-relaxed mb-2 text-foreground',
  ul: 'list-disc list-inside mb-2 text-sm space-y-1',
  ol: 'list-decimal list-inside mb-2 text-sm space-y-1',
  li: 'text-sm text-foreground',
  code: 'font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-amber-600 dark:text-amber-400',
  pre: 'bg-muted/80 dark:bg-muted/30 p-3 rounded-lg overflow-x-auto my-2 border border-border/50',
  blockquote: 'border-l-4 border-muted-foreground pl-4 italic text-muted-foreground my-2',
  strong: 'font-semibold text-foreground',
  a: 'text-blue-600 dark:text-blue-400 hover:underline',
};

// ========== Helper Components ==========

/**
 * Inline code renderer for Markdown
 */
function MarkdownCode({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <code
      className={cn(markdownComponents.code, className)}
      {...props}
    >
      {children}
    </code>
  );
}

/**
 * Code block renderer for Markdown with syntax highlighting
 */
function MarkdownPre({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <pre
      className={cn(markdownComponents.pre, className)}
      {...props}
    >
      {children}
    </pre>
  );
}

/**
 * Paragraph renderer for Markdown
 */
function MarkdownParagraph({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(markdownComponents.p, className)}
      {...props}
    >
      {children}
    </p>
  );
}

/**
 * Heading renderers for Markdown
 */
function MarkdownH1({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(markdownComponents.h1, className)}
      {...props}
    >
      {children}
    </h1>
  );
}

function MarkdownH2({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(markdownComponents.h2, className)}
      {...props}
    >
      {children}
    </h2>
  );
}

function MarkdownH3({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(markdownComponents.h3, className)}
      {...props}
    >
      {children}
    </h3>
  );
}

/**
 * List renderers for Markdown
 */
function MarkdownUl({ className, children, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn(markdownComponents.ul, className)}
      {...props}
    >
      {children}
    </ul>
  );
}

function MarkdownOl({ className, children, ...props }: React.HTMLAttributes<HTMLOListElement>) {
  return (
    <ol
      className={cn(markdownComponents.ol, className)}
      {...props}
    >
      {children}
    </ol>
  );
}

function MarkdownLi({ className, children, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      className={cn(markdownComponents.li, className)}
      {...props}
    >
      {children}
    </li>
  );
}

/**
 * Blockquote renderer for Markdown
 */
function MarkdownBlockquote({ className, children, ...props }: React.HTMLAttributes<HTMLQuoteElement>) {
  return (
    <blockquote
      className={cn(markdownComponents.blockquote, className)}
      {...props}
    >
      {children}
    </blockquote>
  );
}

/**
 * Anchor renderer for Markdown
 */
function MarkdownA({ className, children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(markdownComponents.a, className)}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  );
}

/**
 * Strong/Bold renderer for Markdown
 */
function MarkdownStrong({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <strong
      className={cn(markdownComponents.strong, className)}
      {...props}
    >
      {children}
    </strong>
  );
}

// ========== Markdown Renderer ==========

/**
 * Markdown content renderer with syntax highlighting
 */
function MarkdownRenderer({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h1: MarkdownH1,
          h2: MarkdownH2,
          h3: MarkdownH3,
          p: MarkdownParagraph,
          ul: MarkdownUl,
          ol: MarkdownOl,
          li: MarkdownLi,
          code: MarkdownCode,
          pre: MarkdownPre,
          blockquote: MarkdownBlockquote,
          a: MarkdownA,
          strong: MarkdownStrong,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ========== Text Renderer ==========

/**
 * Plain text renderer with escape sequence handling
 */
function TextRenderer({ content, maxLines }: { content: string; maxLines?: number }) {
  const lines = useMemo(() => {
    return content.split('\n');
  }, [content]);

  const displayLines = useMemo(() => {
    if (maxLines && lines.length > maxLines) {
      return lines.slice(0, maxLines);
    }
    return lines;
  }, [lines, maxLines]);

  const showTruncated = maxLines && lines.length > maxLines;

  return (
    <div className="text-sm text-foreground whitespace-pre-wrap break-words font-mono">
      {displayLines.map((line, index) => (
        <div key={index}>{line || '\u00A0'}</div>
      ))}
      {showTruncated && (
        <div className="text-muted-foreground italic text-xs mt-2">
          // ... {lines.length - maxLines} more lines
        </div>
      )}
    </div>
  );
}

// ========== Content Detection ==========

/**
 * Auto-detect content format
 */
function detectContentFormat(content: string): 'markdown' | 'json' | 'text' {
  const trimmed = content.trim();

  // Check for JSON first
  const jsonDetection = detectJsonContent(trimmed);
  if (jsonDetection.isJson) {
    return 'json';
  }

  // Check for Markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s+/m,           // Headings
    /^\*{3,}$/m,             // Horizontal rule
    /^\s*[-*+]\s+/m,         // Unordered lists
    /^\s*\d+\.\s+/m,         // Ordered lists
    /\[.*?\]\(.*?\)/,        // Links
    /`{3,}[\s\S]*?`{3,}/,    // Code blocks
    /\*\*.*?\*\*/,           // Bold
    /_.*?_/,                 // Italic
    /^\s*>\s+/m,             // Blockquotes
  ];

  for (const pattern of markdownPatterns) {
    if (pattern.test(trimmed)) {
      return 'markdown';
    }
  }

  // Default to text
  return 'text';
}

// ========== Main Component ==========

/**
 * MessageRenderer Component
 *
 * Renders message content with automatic format detection:
 * - JSON: Structured display with JsonFormatter
 * - Markdown: Rich text with syntax highlighting
 * - Text: Plain text with escape sequence handling
 *
 * Supports escape sequence handling (e.g., \n → newline)
 */
export function MessageRenderer({
  content,
  className,
  format,
  maxLines,
}: MessageRendererProps) {
  // Process escape sequences
  const processedContent = useMemo(() => {
    // Replace common escape sequences
    return content
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '  ')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\');
  }, [content]);

  // Auto-detect format if not specified
  const detectedFormat = useMemo(() => {
    if (format) {
      return format;
    }
    return detectContentFormat(processedContent);
  }, [processedContent, format]);

  // Render based on format
  switch (detectedFormat) {
    case 'json':
      return (
        <div className={className}>
          <JsonFormatter
            content={processedContent}
            displayMode="text"
            maxLines={maxLines}
          />
        </div>
      );

    case 'markdown':
      return (
        <MarkdownRenderer
          content={processedContent}
          className={className}
        />
      );

    case 'text':
    default:
      return (
        <div className={className}>
          <TextRenderer
            content={processedContent}
            maxLines={maxLines}
          />
        </div>
      );
  }
}

export default MessageRenderer;
