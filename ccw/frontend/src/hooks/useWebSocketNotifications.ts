// ========================================
// useWebSocketNotifications Hook
// ========================================
// Watches wsLastMessage from notificationStore and maps WebSocket events
// to persistent notifications for the notification panel

import { useEffect } from 'react';
import { useNotificationStore } from '@/stores';
import type { WebSocketMessage } from '@/types/store';

// WebSocket message types that should create persistent notifications
type NotificationEventType =
  | 'SESSION_CREATED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'CLI_EXECUTION_STARTED'
  | 'CLI_EXECUTION_COMPLETED'
  | 'MEMORY_UPDATED';

interface SessionCreatedPayload {
  sessionId: string;
  title?: string;
}

interface TaskEventPayload {
  sessionId?: string;
  taskId?: string;
  summary?: string;
  error?: string;
}

interface CliExecutionPayload {
  executionId: string;
  tool: string;
  duration?: number;
}

interface MemoryUpdatedPayload {
  memoryId?: string;
  operation?: string;
}

export function useWebSocketNotifications(): void {
  const wsLastMessage = useNotificationStore((state) => state.wsLastMessage);
  const setWsLastMessage = useNotificationStore((state) => state.setWsLastMessage);
  const addPersistentNotification = useNotificationStore(
    (state) => state.addPersistentNotification
  );

  useEffect(() => {
    // Only process when we have a message
    if (!wsLastMessage) {
      return;
    }

    const { type, payload } = wsLastMessage as WebSocketMessage & {
      payload?: unknown;
    };

    // Route message type to appropriate notification
    switch (type as NotificationEventType) {
      case 'SESSION_CREATED': {
        const data = payload as SessionCreatedPayload | undefined;
        const sessionId = data?.sessionId || 'unknown';
        const title = data?.title ? `"${data.title}"` : '';

        addPersistentNotification({
          type: 'info',
          title: 'Session Created',
          message: `New session ${title}created (${sessionId})`,
          read: false,
        });
        break;
      }

      case 'TASK_COMPLETED': {
        const data = payload as TaskEventPayload | undefined;
        const summary = data?.summary || 'Task completed successfully';
        const taskId = data?.taskId;

        addPersistentNotification({
          type: 'success',
          title: 'Task Completed',
          message: taskId ? `${summary} (${taskId})` : summary,
          read: false,
        });
        break;
      }

      case 'TASK_FAILED': {
        const data = payload as TaskEventPayload | undefined;
        const error = data?.error || 'Task execution failed';
        const taskId = data?.taskId;

        addPersistentNotification({
          type: 'error',
          title: 'Task Failed',
          message: taskId ? `${error} (${taskId})` : error,
          duration: 0, // Errors don't auto-dismiss
          read: false,
        });
        break;
      }

      case 'CLI_EXECUTION_STARTED': {
        const data = payload as CliExecutionPayload | undefined;
        const tool = data?.tool || 'CLI';

        addPersistentNotification({
          type: 'info',
          title: 'CLI Execution Started',
          message: `${tool} execution started`,
          read: false,
        });
        break;
      }

      case 'CLI_EXECUTION_COMPLETED': {
        const data = payload as CliExecutionPayload | undefined;
        const tool = data?.tool || 'CLI';
        const duration = data?.duration;
        const durationText = duration ? ` (${duration}ms)` : '';

        addPersistentNotification({
          type: 'success',
          title: 'CLI Execution Completed',
          message: `${tool} execution completed${durationText}`,
          read: false,
        });
        break;
      }

      case 'MEMORY_UPDATED': {
        const data = payload as MemoryUpdatedPayload | undefined;
        const operation = data?.operation || 'update';

        addPersistentNotification({
          type: 'info',
          title: 'Memory Updated',
          message: `Memory ${operation} completed`,
          read: false,
        });
        break;
      }

      default:
        // Unknown message type - ignore
        break;
    }

    // Clear the message after processing to prevent duplicate handling
    setWsLastMessage(null);
  }, [wsLastMessage, addPersistentNotification, setWsLastMessage]);
}

export default useWebSocketNotifications;
