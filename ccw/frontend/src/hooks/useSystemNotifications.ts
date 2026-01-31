// ========================================
// useSystemNotifications Hook
// ========================================
// Browser native notification support with permission handling,
// localStorage preference persistence, icon/badge display,
// click-to-focus behavior, and 5-second auto-close

import { useState, useEffect, useCallback } from 'react';

// Local storage key for system notifications preference
const SYSTEM_NOTIFICATIONS_ENABLED_KEY = 'ccw_system_notifications_enabled';

// Auto-close timeout for native notifications (ms)
const NOTIFICATION_AUTO_CLOSE_MS = 5000;

/**
 * System notification options
 */
export interface SystemNotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
}

/**
 * Return type for useSystemNotifications hook
 */
export interface UseSystemNotificationsReturn {
  enabled: boolean;
  permission: NotificationPermission;
  toggleEnabled: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  showNotification: (options: SystemNotificationOptions) => void;
}

/**
 * Check if Notification API is supported
 */
function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Load system notifications enabled preference from localStorage
 */
function loadEnabledPreference(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const saved = localStorage.getItem(SYSTEM_NOTIFICATIONS_ENABLED_KEY);
    return saved === 'true';
  } catch {
    console.warn('[useSystemNotifications] Failed to load preference from localStorage');
    return false;
  }
}

/**
 * Save system notifications enabled preference to localStorage
 */
function saveEnabledPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(SYSTEM_NOTIFICATIONS_ENABLED_KEY, String(enabled));
  } catch {
    console.warn('[useSystemNotifications] Failed to save preference to localStorage');
  }
}

/**
 * Hook for browser native notification support
 *
 * Features:
 * - Permission handling with browser dialog
 * - localStorage preference persistence
 * - Icon/badge display
 * - Click-to-focus window behavior
 * - 5-second auto-close
 * - Graceful handling when API unavailable
 *
 * @returns Object with enabled state, permission status, and control functions
 */
export function useSystemNotifications(): UseSystemNotificationsReturn {
  const [enabled, setEnabled] = useState<boolean>(() => loadEnabledPreference());
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (!isNotificationSupported()) return 'denied';
    return Notification.permission;
  });

  // Sync permission state with window.Notification
  useEffect(() => {
    if (!isNotificationSupported()) return;

    const checkPermission = () => {
      setPermission(Notification.permission);
    };

    checkPermission();

    // Listen for permission changes (some browsers support this)
    window.addEventListener('notificationpermissionchange', checkPermission);
    return () => {
      window.removeEventListener('notificationpermissionchange', checkPermission);
    };
  }, []);

  /**
   * Request browser notification permission
   * Prompts user with browser permission dialog
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNotificationSupported()) {
      console.warn('[useSystemNotifications] Notification API not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      setPermission('granted');
      return true;
    }

    if (Notification.permission === 'denied') {
      setPermission('denied');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.warn('[useSystemNotifications] Failed to request permission:', error);
      return false;
    }
  }, []);

  /**
   * Toggle system notifications enabled state
   * Requests permission if not granted when enabling
   */
  const toggleEnabled = useCallback(async (): Promise<void> => {
    if (enabled) {
      // Disabling - just update preference
      const newState = false;
      setEnabled(newState);
      saveEnabledPreference(newState);
    } else {
      // Enabling - request permission first
      const granted = await requestPermission();
      if (granted) {
        const newState = true;
        setEnabled(newState);
        saveEnabledPreference(newState);
      }
    }
  }, [enabled, requestPermission]);

  /**
   * Show a native browser notification
   * Only shows if enabled and permission granted
   */
  const showNotification = useCallback((options: SystemNotificationOptions) => {
    if (!enabled) return;
    if (!isNotificationSupported()) return;
    if (permission !== 'granted') return;

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        badge: options.badge || '/favicon.ico',
        tag: options.tag || `ccw-notif-${Date.now()}`,
        requireInteraction: options.requireInteraction || false,
      });

      // Click handler: focus window and close notification
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after 5 seconds (unless requireInteraction is true)
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, NOTIFICATION_AUTO_CLOSE_MS);
      }
    } catch (error) {
      console.warn('[useSystemNotifications] Failed to show notification:', error);
    }
  }, [enabled, permission]);

  return {
    enabled,
    permission,
    toggleEnabled,
    requestPermission,
    showNotification,
  };
}

export default useSystemNotifications;
