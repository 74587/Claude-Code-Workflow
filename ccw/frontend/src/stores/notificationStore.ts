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
} from '../types/store';
import type { SurfaceUpdate } from '../packages/a2ui-runtime/core/A2UITypes';

// Constants
const NOTIFICATION_STORAGE_KEY = 'ccw_notifications';
const NOTIFICATION_MAX_STORED = 100;
const NOTIFICATION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Helper to generate unique ID
const generateId = (): string => {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(toSave));
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

      // ========== A2UI Actions ==========

      addA2UINotification: (surface: SurfaceUpdate, title = 'A2UI Surface') => {
        const id = generateId();
        const newToast: Toast = {
          id,
          type: 'a2ui',
          title,
          timestamp: new Date().toISOString(),
          dismissible: true,
          duration: 0, // Persistent by default
          a2uiSurface: surface,
          a2uiState: surface.initialState || {},
        };

        set(
          (state) => {
            // Add to toasts array
            const { maxToasts } = state;
            let newToasts = [...state.toasts, newToast];
            if (newToasts.length > maxToasts) {
              newToasts = newToasts.slice(-maxToasts);
            }

            // Store surface in a2uiSurfaces Map
            const newSurfaces = new Map(state.a2uiSurfaces);
            newSurfaces.set(surface.surfaceId, surface);

            return {
              toasts: newToasts,
              a2uiSurfaces: newSurfaces,
            };
          },
          false,
          'addA2UINotification'
        );

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

            // Update notification's a2uiState
            const newToasts = state.toasts.map((toast) => {
              if (toast.a2uiSurface && toast.a2uiSurface.surfaceId === surfaceId) {
                return {
                  ...toast,
                  a2uiState: { ...toast.a2uiState, ...updates },
                };
              }
              return toast;
            });

            return {
              toasts: newToasts,
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
