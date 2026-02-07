// ========================================
// MarkdownModal Component
// ========================================
// Modal for viewing markdown, JSON, or text content with copy and download actions

import * as React from 'react';
import { FileText, Copy, Download, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

// ========================================
// Types
// ========================================

export type ContentType = 'markdown' | 'json' | 'text';

export interface MarkdownModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when modal is closed */
  onClose: () => void;
  /** Title displayed in modal header */
  title: string;
  /** Content to display */
  content: string;
  /** Type of content for appropriate rendering */
  contentType?: ContentType;
  /** Maximum width of the modal */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  /** Maximum height of content area */
  maxHeight?: string;
  /** Optional custom actions */
  actions?: ModalAction[];
  /** Whether content is loading */
  isLoading?: boolean;
}

export interface ModalAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (content: string) => void | Promise<void>;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  disabled?: boolean;
}

// ========================================
// Component
// ========================================

/**
 * Modal for viewing markdown, JSON, or text content
 * 
 * @example
 * ```tsx
 * <MarkdownModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="IMPL_PLAN.md"
 *   content={implPlanContent}
 *   contentType="markdown"
 * />
 * ```
 */
export function MarkdownModal({
  isOpen,
  onClose,
  title,
  content,
  contentType = 'markdown',
  maxWidth = '2xl',
  maxHeight = '60vh',
  actions,
  isLoading = false,
}: MarkdownModalProps) {
  const { success, error } = useNotifications();
  const [isCopying, setIsCopying] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleCopy = async () => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(content);
      success('Copied', 'Content copied to clipboard');
    } catch (err) {
      error('Error', 'Failed to copy content');
    } finally {
      setIsCopying(false);
    }
  };

  const handleDownload = () => {
    setIsDownloading(true);
    try {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = contentType === 'json' ? 'json' : 'md';
      a.download = `${title.replace(/[^a-z0-9]/gi, '-')}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
      success('Downloaded', `File ${title} downloaded`);
    } catch (err) {
      error('Error', 'Failed to download content');
    } finally {
      setIsDownloading(false);
    }
  };

  const defaultActions: ModalAction[] = [
    {
      label: 'Copy',
      icon: Copy,
      onClick: handleCopy,
      variant: 'outline',
      disabled: isCopying || isLoading || !content,
    },
    {
      label: 'Download',
      icon: Download,
      onClick: handleDownload,
      variant: 'outline',
      disabled: isDownloading || isLoading || !content,
    },
  ];

  const modalActions = actions || defaultActions;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading...</span>
        </div>
      );
    }

    if (!content) {
      return (
        <div className="flex items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <div>
            <p className="text-muted-foreground">No content available</p>
          </div>
        </div>
      );
    }

    switch (contentType) {
      case 'markdown':
        return (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
              {content}
            </pre>
          </div>
        );
      case 'json':
        return (
          <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto font-mono">
            {JSON.stringify(JSON.parse(content), null, 2)}
          </pre>
        );
      case 'text':
        return (
          <pre className="text-sm whitespace-pre-wrap break-words font-sans leading-relaxed">
            {content}
          </pre>
        );
      default:
        return <pre className="text-sm">{content}</pre>;
    }
  };

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  }[maxWidth];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn('flex flex-col', maxWidthClass)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div 
          className="flex-1 overflow-auto py-4" 
          style={{ maxHeight }}
        >
          {renderContent()}
        </div>

        <DialogFooter className="gap-2">
          {modalActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                variant={action.variant || 'default'}
                onClick={() => action.onClick(content)}
                disabled={action.disabled || isLoading}
              >
                {Icon && <Icon className="w-4 h-4 mr-2" />}
                {action.label}
                {(isCopying && action.label === 'Copy') && (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                )}
                {(isDownloading && action.label === 'Download') && (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                )}
              </Button>
            );
          })}
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========================================
// Exports
// ========================================

export default MarkdownModal;
