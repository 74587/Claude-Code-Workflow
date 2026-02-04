// ========================================
// Notification Store
// ========================================
// Manages toasts, WebSocket connection status, and persistent notifications

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  NotificationStore,
  NotificationState,
  Toast,
  WebSocketStatus,
  WebSocketMessage,
  NotificationAction,
  ActionState,
} from '../types/store';
import type { SurfaceUpdate } from '../packages/a2ui-runtime/core/A2UITypes';

// Constants
const NOTIFICATION_STORAGE_KEY = 'ccw_notifications';
const NOTIFICATION_MAX_STORED = 100;
const NOTIFICATION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Patterns that should not be stored in localStorage (potential sensitive data)
const SENSITIVE_PATTERNS = [
  // API keys and tokens (common formats)
  /\b[A-Za-z0-9_-]{20,}\b/g,
  // UUIDs (might be session tokens)
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  // Base64 encoded strings (might be tokens)
  /\b[A-Za-z0-9+/=]{32,}={0,2}\b/g,
];

/**
 * Sanitize notification content before persisting to localStorage
 * Removes potentially sensitive patterns and limits content length
 */
const sanitizeNotification = (toast: Toast): Toast => {
  const sanitizeText = (text: string | null | undefined): string | null => {
    if (!text) return null;
    let sanitized = text;

    // Remove potentially sensitive patterns
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    // Limit length to prevent localStorage bloat
    const MAX_LENGTH = 500;
    if (sanitized.length > MAX_LENGTH) {
      sanitized = sanitized.substring(0, MAX_LENGTH) + '...';
    }

    return sanitized;
  };

  return {
    ...toast,
    title: sanitizeText(toast.title) || toast.title,
    message: sanitizeText(toast.message) || toast.message,
    // Don't persist a2uiSurface or a2uiState as they may contain sensitive runtime data
    a2uiSurface: undefined,
    a2uiState: undefined,
  };
};

// Helper to generate unique ID
const generateId = (): string => {
  return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

// Helper to load notifications from localStorage
const loadFromStorage = (): Toast[] => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (stored) {
      const parsed: Toast[] = JSON.parse(stored);
      // Filter out notifications older than max age
      const cutoffTime = Date.now() - NOTIFICATION_MAX_AGE_MS;
      return parsed.filter((n) => new Date(n.timestamp).getTime() > cutoffTime);
    }
  } catch (e) {
    console.error('[NotificationStore] Failed to load from storage:', e);
  }
  return [];
};

// Helper to save notifications to localStorage
const saveToStorage = (notifications: Toast[]): void => {
  if (typeof window === 'undefined') return;

  try {
    // Keep only the last N notifications
    const toSave = notifications.slice(0, NOTIFICATION_MAX_STORED);
    // Sanitize notification content before persisting to localStorage
    const sanitized = toSave.map(sanitizeNotification);
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (e) {
    console.error('[NotificationStore] Failed to save to storage:', e);
  }
};

// Initial state
const initialState: NotificationState = {
  // Toast queue (ephemeral, UI-only)
  toasts: [],
  maxToasts: 5,

  // WebSocket status
  wsStatus: 'disconnected',
  wsLastMessage: null,
  wsReconnectAttempts: 0,

  // Notification panel
  isPanelVisible: false,

  // Persistent notifications (stored in localStorage)
  persistentNotifications: [],

  // A2UI surfaces
  a2uiSurfaces: new Map<string, SurfaceUpdate>(),

  // Current question dialog state (legacy)
  currentQuestion: null,

  // Current popup card surface (for displayMode: 'popup')
  currentPopupCard: null,

  // Action state tracking
  actionStates: new Map<string, ActionState>(),
};

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ========== Toast Actions ==========

      addToast: (toast: Omit<Toast, 'id' | 'timestamp'>): string => {
        const id = generateId();
        const newToast: Toast = {
          ...toast,
          id,
          timestamp: new Date().toISOString(),
          dismissible: toast.dismissible ?? true,
          duration: toast.duration ?? 5000, // Default 5 seconds
        };

        set(
          (state) => {
            const { maxToasts } = state;
            // Add new toast at the end, remove oldest if over limit
            let newToasts = [...state.toasts, newToast];
            if (newToasts.length > maxToasts) {
              newToasts = newToasts.slice(-maxToasts);
            }
            return { toasts: newToasts };
          },
          false,
          'addToast'
        );

        // Auto-remove after duration (if not persistent)
        if (newToast.duration && newToast.duration > 0) {
          setTimeout(() => {
            get().removeToast(id);
          }, newToast.duration);
        }

        return id;
      },

      removeToast: (id: string) => {
        set(
          (state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
          }),
          false,
          'removeToast'
        );
      },

      clearAllToasts: () => {
        set({ toasts: [] }, false, 'clearAllToasts');
      },

      // ========== WebSocket Status Actions ==========

      setWsStatus: (status: WebSocketStatus) => {
        set({ wsStatus: status }, false, 'setWsStatus');
      },

      setWsLastMessage: (message: WebSocketMessage | null) => {
        set({ wsLastMessage: message }, false, 'setWsLastMessage');
      },

      incrementReconnectAttempts: () => {
        set(
          (state) => ({
            wsReconnectAttempts: state.wsReconnectAttempts + 1,
          }),
          false,
          'incrementReconnectAttempts'
        );
      },

      resetReconnectAttempts: () => {
        set({ wsReconnectAttempts: 0 }, false, 'resetReconnectAttempts');
      },

      // ========== Notification Panel Actions ==========

      togglePanel: () => {
        set(
          (state) => ({
            isPanelVisible: !state.isPanelVisible,
          }),
          false,
          'togglePanel'
        );
      },

      setPanelVisible: (visible: boolean) => {
        set({ isPanelVisible: visible }, false, 'setPanelVisible');
      },

      // ========== Persistent Notification Actions ==========

      addPersistentNotification: (notification: Omit<Toast, 'id' | 'timestamp'>) => {
        const id = generateId();
        const newNotification: Toast = {
          ...notification,
          id,
          timestamp: new Date().toISOString(),
          dismissible: notification.dismissible ?? true,
        };

        set(
          (state) => ({
            persistentNotifications: [newNotification, ...state.persistentNotifications],
          }),
          false,
          'addPersistentNotification'
        );

        // Also save to localStorage
        const state = get();
        saveToStorage(state.persistentNotifications);
      },

      removePersistentNotification: (id: string) => {
        set(
          (state) => ({
            persistentNotifications: state.persistentNotifications.filter((n) => n.id !== id),
          }),
          false,
          'removePersistentNotification'
        );

        // Also save to localStorage
        const state = get();
        saveToStorage(state.persistentNotifications);
      },

      clearPersistentNotifications: () => {
        set({ persistentNotifications: [] }, false, 'clearPersistentNotifications');

        // Also clear localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem(NOTIFICATION_STORAGE_KEY);
        }
      },

      loadPersistentNotifications: () => {
        const loaded = loadFromStorage();
        set({ persistentNotifications: loaded }, false, 'loadPersistentNotifications');
      },

      savePersistentNotifications: () => {
        const state = get();
        saveToStorage(state.persistentNotifications);
      },

      markAllAsRead: () => {
        set(
          (state) => ({
            persistentNotifications: state.persistentNotifications.map((n) => ({
              ...n,
              read: true,
            })),
          }),
          false,
          'markAllAsRead'
        );

        // Also save to localStorage
        const state = get();
        saveToStorage(state.persistentNotifications);
      },

      // ========== Read Status Management ==========

      toggleNotificationRead: (id: string) => {
        set(
          (state) => {
            // Check both toasts and persistentNotifications
            const toastIndex = state.toasts.findIndex((t) => t.id === id);
            const persistentIndex = state.persistentNotifications.findIndex((n) => n.id === id);

            if (toastIndex === -1 && persistentIndex === -1) {
              return state; // Notification not found
            }

            const newState = { ...state };
            if (toastIndex !== -1) {
              const newToasts = [...state.toasts];
              newToasts[toastIndex] = {
                ...newToasts[toastIndex],
                read: !newToasts[toastIndex].read,
              };
              newState.toasts = newToasts;
            }
            if (persistentIndex !== -1) {
              const newPersistent = [...state.persistentNotifications];
              newPersistent[persistentIndex] = {
                ...newPersistent[persistentIndex],
                read: !newPersistent[persistentIndex].read,
              };
              newState.persistentNotifications = newPersistent;
              // Save to localStorage for persistent notifications
              saveToStorage(newPersistent);
            }

            return newState;
          },
          false,
          'toggleNotificationRead'
        );
      },

      // ========== Action State Management ==========

      setActionState: (actionKey: string, actionState: ActionState) => {
        set(
          (state) => {
            const newActionStates = new Map(state.actionStates);
            newActionStates.set(actionKey, actionState);
            return { actionStates: newActionStates };
          },
          false,
          'setActionState'
        );
      },

      executeAction: async (action: NotificationAction, notificationId: string, actionKey?: string) => {
        const key = actionKey || `${notificationId}-${action.label}`;
        const state = get();

        // Check if action is disabled
        const currentActionState = state.actionStates.get(key);
        if (currentActionState?.status === 'loading' || action.disabled) {
          return;
        }

        // Set loading state
        const newActionStates = new Map(state.actionStates);
        newActionStates.set(key, {
          status: 'loading',
          lastAttempt: new Date().toISOString(),
        });
        set({ actionStates: newActionStates });

        try {
          await action.onClick();
          // Set success state
          const successStates = new Map(get().actionStates);
          successStates.set(key, {
            status: 'success',
            lastAttempt: new Date().toISOString(),
          });
          set({ actionStates: successStates });
        } catch (error) {
          // Set error state
          const errorStates = new Map(get().actionStates);
          errorStates.set(key, {
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            lastAttempt: new Date().toISOString(),
          });
          set({ actionStates: errorStates });
        }
      },

      retryAction: async (actionKey: string) => {
        const state = get();
        const actionState = state.actionStates.get(actionKey);

        if (!actionState) {
          console.warn(`[NotificationStore] No action state found for key: ${actionKey}`);
          return;
        }

        // Reset to idle and let executeAction handle it
        get().setActionState(actionKey, { status: 'idle', lastAttempt: new Date().toISOString() });

        // Note: The caller should re-invoke executeAction with the original action
        // This method just resets the state for retry
      },

      // ========== A2UI Actions ==========

      addA2UINotification: (surface: SurfaceUpdate, title = 'A2UI Surface') => {
        // Route based on displayMode
        if (surface.displayMode === 'popup') {
          // Popup mode: show as centered dialog
          set(
            (state) => {
              // Store surface in a2uiSurfaces Map
              const newSurfaces = new Map(state.a2uiSurfaces);
              newSurfaces.set(surface.surfaceId, surface);

              return {
                currentPopupCard: surface,
                a2uiSurfaces: newSurfaces,
              };
            },
            false,
            'addA2UINotification (popup)'
          );

          return surface.surfaceId;
        }

        // Panel mode (default): show in notification panel
        const id = generateId();
        const newNotification: Toast = {
          id,
          type: 'a2ui',
          title,
          timestamp: new Date().toISOString(),
          dismissible: true,
          duration: 0, // Persistent by default
          a2uiSurface: surface,
          a2uiState: surface.initialState || {},
          read: false,
        };

        set(
          (state) => {
            // Store surface in a2uiSurfaces Map
            const newSurfaces = new Map(state.a2uiSurfaces);
            newSurfaces.set(surface.surfaceId, surface);

            return {
              // A2UI surfaces should be visible in the NotificationPanel (which reads persistentNotifications)
              // and should also bump the unread badge in the header.
              persistentNotifications: [newNotification, ...state.persistentNotifications],
              a2uiSurfaces: newSurfaces,
              // Auto-open panel for interactive A2UI surfaces
              isPanelVisible: true,
            };
          },
          false,
          'addA2UINotification (panel)'
        );

        // Persist to localStorage (same behavior as addPersistentNotification)
        const state = get();
        saveToStorage(state.persistentNotifications);

        return id;
      },

      updateA2UIState: (surfaceId: string, updates: Record<string, unknown>) => {
        set(
          (state) => {
            // Update a2uiSurfaces Map
            const newSurfaces = new Map(state.a2uiSurfaces);
            const surface = newSurfaces.get(surfaceId);
            if (surface) {
              // Update surface initial state
              newSurfaces.set(surfaceId, {
                ...surface,
                initialState: { ...surface.initialState, ...updates } as Record<string, unknown>,
              });
            }

            // Update notification's a2uiState (both toast queue and persistent panel list)
            const newToasts = state.toasts.map((toast) => {
              if (toast.a2uiSurface && toast.a2uiSurface.surfaceId === surfaceId) {
                return {
                  ...toast,
                  a2uiState: { ...toast.a2uiState, ...updates },
                  a2uiSurface: surface
                    ? { ...toast.a2uiSurface, initialState: { ...toast.a2uiSurface.initialState, ...updates } }
                    : toast.a2uiSurface,
                };
              }
              return toast;
            });

            const newPersistentNotifications = state.persistentNotifications.map((notification) => {
              if (notification.a2uiSurface && notification.a2uiSurface.surfaceId === surfaceId) {
                return {
                  ...notification,
                  a2uiState: { ...notification.a2uiState, ...updates },
                  a2uiSurface: surface
                    ? {
                        ...notification.a2uiSurface,
                        initialState: { ...notification.a2uiSurface.initialState, ...updates },
                      }
                    : notification.a2uiSurface,
                };
              }
              return notification;
            });

            return {
              toasts: newToasts,
              persistentNotifications: newPersistentNotifications,
              a2uiSurfaces: newSurfaces,
            };
          },
          false,
          'updateA2UIState'
        );
      },

      sendA2UIAction: (actionId: string, surfaceId: string, parameters = {}) => {
        // This will be called by components to send actions via WebSocket
        // The actual WebSocket send will be handled by the WebSocket manager
        // For now, we just dispatch a custom event that the WebSocket handler can listen to
        const event = new CustomEvent('a2ui-action', {
          detail: {
            type: 'a2ui-action',
            actionId,
            surfaceId,
            parameters,
          },
        });
        window.dispatchEvent(event);
      },

      // ========== Current Question Actions ==========

      setCurrentQuestion: (question: any) => {
        set({ currentQuestion: question }, false, 'setCurrentQuestion');
      },

      // ========== Current Popup Card Actions ==========

      setCurrentPopupCard: (surface: SurfaceUpdate | null) => {
        set({ currentPopupCard: surface }, false, 'setCurrentPopupCard');
      },
    }),
    { name: 'NotificationStore' }
  )
);

// Initialize persistent notifications on store creation
if (typeof window !== 'undefined') {
  const loaded = loadFromStorage();
  if (loaded.length > 0) {
    useNotificationStore.setState({ persistentNotifications: loaded });
  }
}

// Selectors for common access patterns
export const selectToasts = (state: NotificationStore) => state.toasts;
export const selectWsStatus = (state: NotificationStore) => state.wsStatus;
export const selectWsLastMessage = (state: NotificationStore) => state.wsLastMessage;
export const selectIsPanelVisible = (state: NotificationStore) => state.isPanelVisible;
export const selectPersistentNotifications = (state: NotificationStore) =>
  state.persistentNotifications;
export const selectCurrentQuestion = (state: NotificationStore) => state.currentQuestion;
export const selectCurrentPopupCard = (state: NotificationStore) => state.currentPopupCard;

// Helper to create toast shortcuts
export const toast = {
  info: (title: string, message?: string) =>
    useNotificationStore.getState().addToast({ type: 'info', title, message }),
  success: (title: string, message?: string) =>
    useNotificationStore.getState().addToast({ type: 'success', title, message }),
  warning: (title: string, message?: string) =>
    useNotificationStore.getState().addToast({ type: 'warning', title, message }),
  error: (title: string, message?: string) =>
    useNotificationStore.getState().addToast({ type: 'error', title, message, duration: 0 }),
};
