// ========================================
// useNotifications Hook
// ========================================
// Convenient hook for notification and toast management

import { useCallback } from 'react';
import {
  useNotificationStore,
  selectToasts,
  selectWsStatus,
  selectWsLastMessage,
  selectIsPanelVisible,
  selectPersistentNotifications,
} from '../stores/notificationStore';
import type { Toast, ToastType, WebSocketStatus, WebSocketMessage } from '../types/store';

export interface UseNotificationsReturn {
  /** Current toast queue */
  toasts: Toast[];
  /** WebSocket connection status */
  wsStatus: WebSocketStatus;
  /** Last WebSocket message received */
  wsLastMessage: WebSocketMessage | null;
  /** Whether WebSocket is connected */
  isWsConnected: boolean;
  /** Whether notification panel is visible */
  isPanelVisible: boolean;
  /** Persistent notifications (stored in localStorage) */
  persistentNotifications: Toast[];
  /** Add a toast notification */
  addToast: (type: ToastType, title: string, message?: string, options?: ToastOptions) => string;
  /** Show info toast */
  info: (title: string, message?: string) => string;
  /** Show success toast */
  success: (title: string, message?: string) => string;
  /** Show warning toast */
  warning: (title: string, message?: string) => string;
  /** Show error toast (persistent by default) */
  error: (title: string, message?: string) => string;
  /** Remove a toast */
  removeToast: (id: string) => void;
  /** Clear all toasts */
  clearAllToasts: () => void;
  /** Set WebSocket status */
  setWsStatus: (status: WebSocketStatus) => void;
  /** Set last WebSocket message */
  setWsLastMessage: (message: WebSocketMessage | null) => void;
  /** Toggle notification panel */
  togglePanel: () => void;
  /** Set panel visibility */
  setPanelVisible: (visible: boolean) => void;
  /** Add persistent notification */
  addPersistentNotification: (type: ToastType, title: string, message?: string) => void;
  /** Remove persistent notification */
  removePersistentNotification: (id: string) => void;
  /** Clear all persistent notifications */
  clearPersistentNotifications: () => void;
}

export interface ToastOptions {
  /** Duration in ms (0 = persistent) */
  duration?: number;
  /** Whether toast can be dismissed */
  dismissible?: boolean;
  /** Action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Hook for managing notifications and toasts
 * @returns Notification state and actions
 *
 * @example
 * ```tsx
 * const { toasts, info, success, error, removeToast } = useNotifications();
 *
 * const handleSave = async () => {
 *   try {
 *     await save();
 *     success('Saved', 'Your changes have been saved');
 *   } catch (e) {
 *     error('Error', 'Failed to save changes');
 *   }
 * };
 * ```
 */
export function useNotifications(): UseNotificationsReturn {
  const toasts = useNotificationStore(selectToasts);
  const wsStatus = useNotificationStore(selectWsStatus);
  const wsLastMessage = useNotificationStore(selectWsLastMessage);
  const isPanelVisible = useNotificationStore(selectIsPanelVisible);
  const persistentNotifications = useNotificationStore(selectPersistentNotifications);

  // Actions
  const addToastAction = useNotificationStore((state) => state.addToast);
  const removeToastAction = useNotificationStore((state) => state.removeToast);
  const clearAllToastsAction = useNotificationStore((state) => state.clearAllToasts);
  const setWsStatusAction = useNotificationStore((state) => state.setWsStatus);
  const setWsLastMessageAction = useNotificationStore((state) => state.setWsLastMessage);
  const togglePanelAction = useNotificationStore((state) => state.togglePanel);
  const setPanelVisibleAction = useNotificationStore((state) => state.setPanelVisible);
  const addPersistentAction = useNotificationStore((state) => state.addPersistentNotification);
  const removePersistentAction = useNotificationStore((state) => state.removePersistentNotification);
  const clearPersistentAction = useNotificationStore((state) => state.clearPersistentNotifications);

  // Computed
  const isWsConnected = wsStatus === 'connected';

  // Callbacks
  const addToast = useCallback(
    (type: ToastType, title: string, message?: string, options?: ToastOptions): string => {
      return addToastAction({
        type,
        title,
        message,
        duration: options?.duration,
        dismissible: options?.dismissible,
        action: options?.action,
      });
    },
    [addToastAction]
  );

  const info = useCallback(
    (title: string, message?: string): string => {
      return addToast('info', title, message);
    },
    [addToast]
  );

  const success = useCallback(
    (title: string, message?: string): string => {
      return addToast('success', title, message);
    },
    [addToast]
  );

  const warning = useCallback(
    (title: string, message?: string): string => {
      return addToast('warning', title, message);
    },
    [addToast]
  );

  const error = useCallback(
    (title: string, message?: string): string => {
      // Error toasts are persistent by default
      return addToast('error', title, message, { duration: 0 });
    },
    [addToast]
  );

  const removeToast = useCallback(
    (id: string) => {
      removeToastAction(id);
    },
    [removeToastAction]
  );

  const clearAllToasts = useCallback(() => {
    clearAllToastsAction();
  }, [clearAllToastsAction]);

  const setWsStatus = useCallback(
    (status: WebSocketStatus) => {
      setWsStatusAction(status);
    },
    [setWsStatusAction]
  );

  const setWsLastMessage = useCallback(
    (message: WebSocketMessage | null) => {
      setWsLastMessageAction(message);
    },
    [setWsLastMessageAction]
  );

  const togglePanel = useCallback(() => {
    togglePanelAction();
  }, [togglePanelAction]);

  const setPanelVisible = useCallback(
    (visible: boolean) => {
      setPanelVisibleAction(visible);
    },
    [setPanelVisibleAction]
  );

  const addPersistentNotification = useCallback(
    (type: ToastType, title: string, message?: string) => {
      addPersistentAction({ type, title, message });
    },
    [addPersistentAction]
  );

  const removePersistentNotification = useCallback(
    (id: string) => {
      removePersistentAction(id);
    },
    [removePersistentAction]
  );

  const clearPersistentNotifications = useCallback(() => {
    clearPersistentAction();
  }, [clearPersistentAction]);

  return {
    toasts,
    wsStatus,
    wsLastMessage,
    isWsConnected,
    isPanelVisible,
    persistentNotifications,
    addToast,
    info,
    success,
    warning,
    error,
    removeToast,
    clearAllToasts,
    setWsStatus,
    setWsLastMessage,
    togglePanel,
    setPanelVisible,
    addPersistentNotification,
    removePersistentNotification,
    clearPersistentNotifications,
  };
}
