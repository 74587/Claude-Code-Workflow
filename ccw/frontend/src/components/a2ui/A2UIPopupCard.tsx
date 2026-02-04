// ========================================
// A2UIPopupCard Component
// ========================================
// Centered popup dialog for A2UI surfaces with minimalist design
// Used for displayMode: 'popup' surfaces (e.g., ask_question)
// Supports markdown content parsing

import { useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { A2UIRenderer } from '@/packages/a2ui-runtime/renderer';
import { useNotificationStore } from '@/stores';
import type { SurfaceUpdate, SurfaceComponent } from '@/packages/a2ui-runtime/core/A2UITypes';
import { cn } from '@/lib/utils';

// ========== Types ==========

interface A2UIPopupCardProps {
  /** A2UI Surface to render */
  surface: SurfaceUpdate;
  /** Callback when dialog is closed */
  onClose: () => void;
}

type QuestionType = 'confirm' | 'select' | 'multi-select' | 'input' | 'unknown';

// ========== Helpers ==========

/** Get text content from A2UI Text component */
function getTextContent(component: SurfaceComponent | undefined): string {
  if (!component?.component) return '';
  const comp = component.component as any;
  if (!comp?.Text?.text) return '';
  const text = comp.Text.text;
  if ('literalString' in text) return text.literalString;
  return '';
}

/** Detect question type from surface */
function detectQuestionType(surface: SurfaceUpdate): QuestionType {
  const state = surface.initialState as Record<string, unknown> | undefined;
  if (state?.questionType) {
    return state.questionType as QuestionType;
  }
  // Fallback: detect from components
  const hasCheckbox = surface.components.some((c) => 'Checkbox' in (c.component as any));
  const hasRadioGroup = surface.components.some((c) => 'RadioGroup' in (c.component as any));
  const hasDropdown = surface.components.some((c) => 'Dropdown' in (c.component as any));
  const hasTextField = surface.components.some((c) => 'TextField' in (c.component as any));
  const hasConfirmCancel = surface.components.some(
    (c) => c.id === 'confirm-btn' || c.id === 'cancel-btn'
  );

  if (hasCheckbox) return 'multi-select';
  if (hasRadioGroup) return 'select';
  if (hasDropdown) return 'select';
  if (hasTextField) return 'input';
  if (hasConfirmCancel) return 'confirm';
  return 'unknown';
}

/** Check if component is an action button */
function isActionButton(component: SurfaceComponent): boolean {
  const comp = component.component as any;
  return 'Button' in comp;
}

// ========== Markdown Component ==========

interface MarkdownContentProps {
  content: string;
  className?: string;
}

function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Customize rendered elements
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          code: ({ children, className }) => {
            const isInline = !className;
            return isInline ? (
              <code className="px-1 py-0.5 bg-muted rounded text-sm">{children}</code>
            ) : (
              <code className={cn('block p-2 bg-muted rounded text-sm overflow-x-auto', className)}>
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ========== Component ==========

export function A2UIPopupCard({ surface, onClose }: A2UIPopupCardProps) {
  const { formatMessage } = useIntl();
  const sendA2UIAction = useNotificationStore((state) => state.sendA2UIAction);

  // Detect question type
  const questionType = useMemo(() => detectQuestionType(surface), [surface]);

  // Extract title, message, and description from surface components
  const titleComponent = surface.components.find(
    (c) => c.id === 'title' && 'Text' in (c.component as any)
  );
  const messageComponent = surface.components.find(
    (c) => c.id === 'message' && 'Text' in (c.component as any)
  );
  const descriptionComponent = surface.components.find(
    (c) => c.id === 'description' && 'Text' in (c.component as any)
  );

  const title =
    getTextContent(titleComponent) ||
    formatMessage({ id: 'askQuestion.defaultTitle', defaultMessage: 'Question' });
  const message = getTextContent(messageComponent);
  const description = getTextContent(descriptionComponent);

  // Separate body components (interactive elements) from action buttons
  const { bodyComponents, actionButtons } = useMemo(() => {
    const body: SurfaceComponent[] = [];
    const actions: SurfaceComponent[] = [];

    for (const comp of surface.components) {
      // Skip title, message, description
      if (['title', 'message', 'description'].includes(comp.id)) continue;

      // Separate action buttons (confirm, cancel, submit)
      if (isActionButton(comp) && ['confirm-btn', 'cancel-btn', 'submit-btn'].includes(comp.id)) {
        actions.push(comp);
      } else {
        body.push(comp);
      }
    }

    return { bodyComponents: body, actionButtons: actions };
  }, [surface.components]);

  // Create surfaces for body and actions
  const bodySurface: SurfaceUpdate = useMemo(
    () => ({ ...surface, components: bodyComponents }),
    [surface, bodyComponents]
  );

  const actionsSurface: SurfaceUpdate = useMemo(
    () => ({ ...surface, components: actionButtons }),
    [surface, actionButtons]
  );

  // Handle A2UI actions
  const handleAction = useCallback(
    (actionId: string, params?: Record<string, unknown>) => {
      // Send action to backend via WebSocket
      sendA2UIAction(actionId, surface.surfaceId, params);

      // Check if this action should close the dialog
      const resolvingActions = ['confirm', 'cancel', 'submit', 'answer'];
      if (resolvingActions.includes(actionId)) {
        onClose();
      }
    },
    [sendA2UIAction, surface.surfaceId, onClose]
  );

  // Handle dialog close (ESC key or overlay click)
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        sendA2UIAction('cancel', surface.surfaceId, {
          questionId: (surface.initialState as any)?.questionId,
        });
        onClose();
      }
    },
    [sendA2UIAction, surface.surfaceId, onClose]
  );

  // Determine dialog width based on question type
  const dialogWidth = useMemo(() => {
    switch (questionType) {
      case 'multi-select':
        return 'sm:max-w-[480px]';
      case 'input':
        return 'sm:max-w-[500px]';
      default:
        return 'sm:max-w-[420px]';
    }
  }, [questionType]);

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          // Base styles
          dialogWidth,
          'max-h-[80vh] overflow-y-auto',
          'bg-card p-6 rounded-xl shadow-lg border border-border/50',
          // Animation classes
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
          'data-[state=open]:duration-300 data-[state=closed]:duration-200'
        )}
        onInteractOutside={(e) => {
          // Prevent closing when clicking outside
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing with ESC key
          e.preventDefault();
        }}
      >
        {/* Header */}
        <DialogHeader className="space-y-2 pb-4">
          <DialogTitle className="text-lg font-semibold leading-tight">{title}</DialogTitle>
          {message && (
            <div className="text-base text-foreground">
              <MarkdownContent content={message} />
            </div>
          )}
          {description && (
            <div className="text-sm text-muted-foreground">
              <MarkdownContent content={description} className="prose-muted" />
            </div>
          )}
        </DialogHeader>

        {/* Body - Interactive elements */}
        {bodyComponents.length > 0 && (
          <div className={cn(
            'py-3',
            // Add specific styling for multi-select (checkbox list)
            questionType === 'multi-select' && 'space-y-2 max-h-[300px] overflow-y-auto px-1'
          )}>
            {questionType === 'multi-select' ? (
              // Render each checkbox individually for better control
              bodyComponents.map((comp) => (
                <div key={comp.id} className="py-1">
                  <A2UIRenderer
                    surface={{ ...bodySurface, components: [comp] }}
                    onAction={handleAction}
                  />
                </div>
              ))
            ) : (
              <A2UIRenderer surface={bodySurface} onAction={handleAction} />
            )}
          </div>
        )}

        {/* Footer - Action buttons */}
        {actionButtons.length > 0 && (
          <DialogFooter className="pt-4">
            <div className="flex flex-row justify-end gap-3">
              {actionButtons.map((comp) => (
                <A2UIRenderer
                  key={comp.id}
                  surface={{ ...actionsSurface, components: [comp] }}
                  onAction={handleAction}
                />
              ))}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default A2UIPopupCard;
