// ========================================
// A2UIPopupCard Component
// ========================================
// Centered popup dialog for A2UI surfaces with minimalist design
// Used for displayMode: 'popup' surfaces (e.g., ask_question)

import { useCallback, useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { A2UIRenderer } from '@/packages/a2ui-runtime/renderer';
import { useNotificationStore } from '@/stores';
import type { SurfaceUpdate } from '@/packages/a2ui-runtime/core/A2UITypes';
import { cn } from '@/lib/utils';

// ========== Types ==========

interface A2UIPopupCardProps {
  /** A2UI Surface to render */
  surface: SurfaceUpdate;
  /** Callback when dialog is closed */
  onClose: () => void;
}

// ========== Component ==========

export function A2UIPopupCard({ surface, onClose }: A2UIPopupCardProps) {
  const { formatMessage } = useIntl();
  const sendA2UIAction = useNotificationStore((state) => state.sendA2UIAction);

  // Extract title and description from surface components if available
  const titleComponent = surface.components.find(
    (c) => c.id === 'title' && 'Text' in c.component
  );
  const descriptionComponent = surface.components.find(
    (c) => c.id === 'description' && 'Text' in c.component
  );
  const messageComponent = surface.components.find(
    (c) => c.id === 'message' && 'Text' in c.component
  );

  // Get text content from component
  const getTextContent = (component: any): string => {
    if (!component?.component?.Text?.text) return '';
    const text = component.component.Text.text;
    if ('literalString' in text) return text.literalString;
    return '';
  };

  const title = getTextContent(titleComponent) ||
    formatMessage({ id: 'askQuestion.defaultTitle' }) ||
    'Question';
  const description = getTextContent(descriptionComponent) || getTextContent(messageComponent);

  // Filter out title/description components for body rendering
  const bodyComponents = surface.components.filter(
    (c) => c.id !== 'title' && c.id !== 'description' && c.id !== 'message'
  );

  // Create a surface subset for body rendering
  const bodySurface: SurfaceUpdate = {
    ...surface,
    components: bodyComponents,
  };

  // Handle A2UI actions
  const handleAction = useCallback(
    (actionId: string, params?: Record<string, unknown>) => {
      // Send action to backend via WebSocket
      sendA2UIAction(actionId, surface.surfaceId, params);

      // Check if this action should close the dialog
      // (confirm, cancel, submit, answer actions typically resolve the question)
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
        // Send cancel action when closing via ESC or overlay
        sendA2UIAction('cancel', surface.surfaceId, {
          questionId: (surface.initialState as any)?.questionId,
        });
        onClose();
      }
    },
    [sendA2UIAction, surface.surfaceId, onClose]
  );

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          // Minimalist style: no heavy borders, light shadow, rounded corners
          'sm:max-w-[420px] max-h-[80vh] overflow-y-auto',
          'bg-card p-6 rounded-xl shadow-md border-0',
          // Animation classes
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
          'data-[state=open]:duration-300 data-[state=closed]:duration-200'
        )}
      >
        <DialogHeader className="space-y-1.5 pb-4">
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* A2UI Surface Body */}
        <div className="space-y-4 py-2">
          <A2UIRenderer surface={bodySurface} onAction={handleAction} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default A2UIPopupCard;
