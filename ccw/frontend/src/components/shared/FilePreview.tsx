// ========================================
// FilePreview Component
// ========================================
// File content preview with syntax highlighting

import * as React from 'react';
import { File, Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import type { FileContent } from '@/types/file-explorer';

export interface FilePreviewProps {
  /** File content to display */
  fileContent: FileContent | null | undefined;
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string | null;
  /** Custom class name */
  className?: string;
  /** Maximum file size to preview in bytes */
  maxSize?: number;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
}

/**
 * Get language display name
 */
function getLanguageDisplayName(language?: string): string {
  if (!language) return 'Plain Text';
  
  const languageNames: Record<string, string> = {
    'typescript': 'TypeScript',
    'tsx': 'TypeScript JSX',
    'javascript': 'JavaScript',
    'jsx': 'React JSX',
    'python': 'Python',
    'ruby': 'Ruby',
    'go': 'Go',
    'rust': 'Rust',
    'java': 'Java',
    'csharp': 'C#',
    'php': 'PHP',
    'scala': 'Scala',
    'kotlin': 'Kotlin',
    'markdown': 'Markdown',
    'json': 'JSON',
    'yaml': 'YAML',
    'xml': 'XML',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'less': 'Less',
    'sql': 'SQL',
    'bash': 'Bash',
    'text': 'Plain Text',
  };
  
  return languageNames[language] || language.charAt(0).toUpperCase() + language.slice(1);
}

/**
 * Get file extension from path
 */
function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * Check if file is likely binary
 */
function isBinaryFile(path: string): boolean {
  const binaryExtensions = [
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'svg',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'zip', 'tar', 'gz', 'rar', '7z',
    'mp3', 'mp4', 'avi', 'mov', 'wav',
    'ttf', 'otf', 'woff', 'woff2', 'eot',
    'exe', 'dll', 'so', 'dylib',
    'class', 'jar', 'war',
    'pdb', 'obj', 'o',
  ];
  
  const ext = getFileExtension(path).toLowerCase();
  return binaryExtensions.includes(ext);
}

/**
 * Format file size for display
 */
function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Truncate content if too large
 */
function truncateContent(content: string, maxLines: number = 1000): string {
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;
  
  return lines.slice(0, maxLines).join('\n') + `\n\n... (${lines.length - maxLines} more lines)`;
}

/**
 * FilePreview component
 */
export function FilePreview({
  fileContent,
  isLoading = false,
  error = null,
  className,
  maxSize = 1024 * 1024, // 1MB default
  showLineNumbers = true,
}: FilePreviewProps) {
  const { formatMessage } = useIntl();
  const [copied, setCopied] = React.useState(false);
  const contentRef = React.useRef<HTMLPreElement>(null);

  // Copy content to clipboard
  const handleCopy = async () => {
    if (!fileContent?.content) return;
    
    try {
      await navigator.clipboard.writeText(fileContent.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy content:', err);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-sm text-muted-foreground">
          {formatMessage({ id: 'explorer.preview.loading' })}
        </span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
        <AlertCircle className="h-12 w-12 text-destructive mb-3" />
        <h3 className="text-sm font-medium text-foreground mb-1">
          {formatMessage({ id: 'explorer.preview.errorTitle' })}
        </h3>
        <p className="text-xs text-muted-foreground max-w-md">{error}</p>
      </div>
    );
  }

  // Empty state
  if (!fileContent) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
        <File className="h-12 w-12 text-muted-foreground mb-3" />
        <h3 className="text-sm font-medium text-foreground mb-1">
          {formatMessage({ id: 'explorer.preview.emptyTitle' })}
        </h3>
        <p className="text-xs text-muted-foreground">
          {formatMessage({ id: 'explorer.preview.emptyMessage' })}
        </p>
      </div>
    );
  }

  // Check if file is too large
  const isTooLarge = maxSize > 0 && (fileContent.size || 0) > maxSize;
  const isBinary = isBinaryFile(fileContent.path);

  // Binary file warning
  if (isBinary) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
        <File className="h-12 w-12 text-muted-foreground mb-3" />
        <h3 className="text-sm font-medium text-foreground mb-1">
          {formatMessage({ id: 'explorer.preview.binaryTitle' })}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          {formatMessage({ id: 'explorer.preview.binaryMessage' })}
        </p>
        <div className="text-xs text-muted-foreground">
          <span>{fileContent.path}</span>
          {fileContent.size && (
            <span className="ml-2">({formatFileSize(fileContent.size)})</span>
          )}
        </div>
      </div>
    );
  }

  // File too large warning
  if (isTooLarge) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
        <AlertCircle className="h-12 w-12 text-warning mb-3" />
        <h3 className="text-sm font-medium text-foreground mb-1">
          {formatMessage({ id: 'explorer.preview.tooLargeTitle' })}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          {formatMessage(
            { id: 'explorer.preview.tooLargeMessage' },
            { size: formatFileSize(maxSize) }
          )}
        </p>
        <div className="text-xs text-muted-foreground">
          <span>{fileContent.path}</span>
          {fileContent.size && (
            <span className="ml-2">({formatFileSize(fileContent.size)})</span>
          )}
        </div>
      </div>
    );
  }

  // Get file name and extension
  const fileName = fileContent.path.split('/').pop() || '';
  const extension = getFileExtension(fileContent.path);
  const language = fileContent.language || getLanguageDisplayName(fileContent.language);
  const truncatedContent = truncateContent(fileContent.content);

  // Split into lines for line numbers
  const lines = truncatedContent.split('\n');

  return (
    <div className={cn('file-preview flex flex-col h-full', className)}>
      {/* Preview header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium truncate">{fileName}</span>
          {extension && (
            <span className="text-xs text-muted-foreground uppercase">.{extension}</span>
          )}
          {fileContent.size && (
            <span className="text-xs text-muted-foreground">
              ({formatFileSize(fileContent.size)})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {fileContent.language && (
            <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">
              {language}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleCopy}
            title={formatMessage({ id: 'explorer.preview.copy' })}
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <pre
          ref={contentRef}
          className={cn(
            'text-sm p-4 m-0 bg-background',
            'font-mono leading-relaxed',
            'whitespace-pre-wrap break-words',
            '[&_::selection]:bg-primary/20 [&_::selection]:text-primary'
          )}
        >
          {showLineNumbers ? (
            <div className="flex">
              {/* Line numbers */}
              <div className="text-right text-muted-foreground select-none pr-4 border-r border-border mr-4 min-w-[3rem]">
                {lines.map((_, i) => (
                  <div key={i} className="leading-relaxed">
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Code content */}
              <code className="flex-1">{truncatedContent}</code>
            </div>
          ) : (
            <code>{truncatedContent}</code>
          )}
        </pre>
      </div>

      {/* Footer with metadata */}
      {fileContent.modifiedTime && (
        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
          {formatMessage(
            { id: 'explorer.preview.lastModified' },
            { time: new Date(fileContent.modifiedTime).toLocaleString() }
          )}
        </div>
      )}
    </div>
  );
}

export default FilePreview;
